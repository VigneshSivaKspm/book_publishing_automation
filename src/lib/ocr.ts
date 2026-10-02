import { createWorker, type Worker } from 'tesseract.js'
import { structureExamText } from './mcqEngine'
import { structureDocumentText } from './docStructure'
import { extractChapterMeta, type ChapterMeta } from './chapterMeta'
import { parseDocxToPages } from './docxParse'
import type { ContentBlock } from '../types'
import { addLog } from './logger'
import { getApiToken } from './api'

let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger: () => {},
    })
  }
  return workerPromise
}

export interface OcrProgress {
  status: string
  progress: number
}

export interface OcrResult {
  text: string
  confidence: number
  blocks: ContentBlock[]
  mcqCount: number
  answered: number
  /** Present when the scanned page was an answer-key grid. */
  answerKey?: Record<number, string>
  /** Chapter title / number read from the page header. */
  chapterMeta?: ChapterMeta
}


/**
 * Page OCR goes through the publishing server (/api/ocr/page), which holds
 * the OpenAI key and returns a schema-validated structured extraction
 * converted to the canonical text these importers parse.
 */
async function serverPageOcr(imageDataUrl: string, mode: 'qa' | 'document'): Promise<string> {
  const token = getApiToken()
  let res: Response
  try {
    res = await fetch('/api/ocr/page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ image: imageDataUrl, mode }),
    })
  } catch {
    throw new Error('Publishing server unreachable — the /api server is not running or not deployed.')
  }
  const data = (await res.json().catch(() => null)) as { text?: string; confidence?: number; error?: { message?: string } } | null
  if (!res.ok || typeof data?.text !== 'string') {
    const message =
      data?.error?.message ??
      (res.status === 404 || res.status === 405 || res.status >= 500
        ? 'Publishing server not available at /api (production needs the Node server deployed).'
        : `Server OCR failed (${res.status}).`)
    addLog({ category: 'ocr', level: 'error', title: 'Server OCR failed', details: message })
    throw new Error(message)
  }
  addLog({
    category: 'ocr',
    level: 'success',
    title: mode === 'document' ? 'Document page transcribed (server)' : 'Question page transcribed (server)',
    details: `${data.text.length} characters, model confidence ${Math.round((data.confidence ?? 0) * 100)}%.`,
  })
  return data.text
}

/** Question-paper page → canonical "N. stem (year) / A) …" text via the server. */
export function callOpenAiVision(imageDataUrl: string): Promise<string> {
  return serverPageOcr(imageDataUrl, 'qa')
}

/** Study-material page → structured Markdown-like text via the server. */
export function callOpenAiDocVision(imageDataUrl: string): Promise<string> {
  return serverPageOcr(imageDataUrl, 'document')
}

/** Extract the embedded text layer of a PDF, one string per page. Offline fallback for Doc Scan. */
export async function extractPdfTextLayer(file: File): Promise<string[]> {
  try {
    const pdfjs = await loadPdfJs()
    if (!pdfjs) return []
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    const out: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      // Rebuild real lines (and blank lines between paragraphs) from glyph
      // positions so headings, labels and solution steps survive the fallback.
      const items = content.items as Array<{ str?: string; hasEOL?: boolean; transform?: number[]; height?: number }>
      let text = ''
      let lastY: number | null = null
      let lineH = 12
      for (const it of items) {
        const y: number = it.transform?.[5] ?? lastY ?? 0
        if (it.height) lineH = it.height
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          if (!text.endsWith('\n')) text += '\n'
          if (Math.abs(y - lastY) > lineH * 1.9) text += '\n'
        }
        text += it.str || ''
        if (it.hasEOL) text += '\n'
        lastY = y
      }
      out.push(
        text
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim(),
      )
    }
    return out
  } catch (err) {
    console.warn('PDF text-layer extraction failed:', err)
    return []
  }
}

/**
 * Previously sent raw text to a model to "restructure" it, which could rewrite
 * source wording. Disabled under source-fidelity rules: local parsing is used.
 */
export async function callOpenAiDocText(_rawText: string): Promise<string> {
  throw new Error('AI restructuring of raw text is disabled (source fidelity). Local document parsing is used.')
}

/** AI OCR → structured blocks powered by OpenAI AI Vision + Tesseract Fallback.
 *  `mode: 'document'` keeps syllabus structure (headings/lists/tables); `'qa'` parses MCQs. */
export async function ocrImageToBlocks(
  source: File | Blob | string,
  onProgress?: (p: OcrProgress) => void,
  opts?: { mode?: 'qa' | 'document' },
): Promise<OcrResult> {
  const mode = opts?.mode ?? 'qa'
  addLog({
    category: 'ocr',
    level: 'info',
    title: 'OCR Scan Initiated',
    details: `Processing file input for OCR extraction...`,
  })
  onProgress?.({ status: 'Connecting to OpenAI Vision…', progress: 0.15 })

  let text = ''
  let confidence = 0

  try {
    let dataUrl = ''
    if (typeof source === 'string') {
      dataUrl = source
    } else if (source instanceof File) {
      dataUrl = await readFileAsDataUrl(source)
    } else {
      dataUrl = await readFileAsDataUrl(new File([source], 'scan.jpg', { type: source.type }))
    }

    onProgress?.({
      status: mode === 'document' ? 'OpenAI Vision reading headings, lists & tables…' : 'OpenAI Vision AI analyzing questions & options…',
      progress: 0.45,
    })
    text = mode === 'document' ? await callOpenAiDocVision(dataUrl) : await callOpenAiVision(dataUrl)
    // The server response is schema-validated, but no fabricated aggregate
    // accuracy is reported. Per-block confidence is preserved by provider adapters.
  } catch (err) {
    addLog({
      category: 'ocr',
      level: 'warn',
      title: 'Tesseract Fallback Engaged',
      details: `OpenAI Vision unavailable, falling back to local Tesseract OCR engine.`,
    })
    console.warn('OpenAI Vision AI fallback to Tesseract:', err)
    onProgress?.({ status: 'Tesseract OCR reading fallback…', progress: 0.5 })
    const worker = await getWorker()
    const result = await worker.recognize(source)
    text = result.data.text
    confidence = result.data.confidence ?? 80
  }

  const { meta: chapterMeta, text: body } = extractChapterMeta(text)

  if (mode === 'document') {
    onProgress?.({ status: 'Structuring headings, paragraphs & tables…', progress: 0.85 })
    const blocks = structureDocumentText(body).map((block) => ({
      ...block,
      sourcePage: 1,
      ...(confidence > 0 ? { confidence: confidence / 100 } : { warnings: ['Provider confidence was not available; compare with the source.'] }),
    }))
    onProgress?.({ status: 'Done', progress: 1.0 })
    addLog({
      category: 'formatting',
      level: 'success',
      title: 'OCR Output Structured (Document Mode)',
      details: `Generated ${blocks.length} blocks (headings, lists & tables preserved).`,
    })
    return { text, confidence, blocks, mcqCount: 0, answered: 0, chapterMeta }
  }

  onProgress?.({ status: 'Formatting questions, choices & answers…', progress: 0.85 })
  const structured = structureExamText(body)
  onProgress?.({ status: 'Done', progress: 1.0 })

  addLog({
    category: 'formatting',
    level: 'success',
    title: 'OCR Output Converted to Blocks',
    details: structured.answerKey
      ? `Detected an ANSWER KEY page (${Object.keys(structured.answerKey).length} answers).`
      : `Generated ${structured.blocks.length} blocks (${structured.mcqCount} MCQs, ${structured.answered} answered).`,
  })

  return {
    text,
    confidence,
    blocks: structured.blocks.map((block) => ({
      ...block,
      sourcePage: 1,
      ...(confidence > 0 ? { confidence: confidence / 100 } : { warnings: ['Provider confidence was not available; compare with the source.'] }),
    })),
    mcqCount: structured.mcqCount,
    answered: structured.answered,
    answerKey: structured.answerKey,
    chapterMeta,
  }
}

let pdfJsLoaded = false

async function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib
  if (pdfJsLoaded) return (window as any).pdfjsLib

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      pdfJsLoaded = true
      const pdfjs = (window as any).pdfjsLib
      if (pdfjs && pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      resolve(pdfjs)
    }
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

export async function convertPdfToPageImages(file: File, maxPages = 25): Promise<string[]> {
  try {
    const pdfjs = await loadPdfJs()
    if (!pdfjs) return []

    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise

    const imageUrls: string[] = []
    const numPages = Math.min(pdf.numPages, maxPages)

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 3.0 }) // ~216 DPI for OCR
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: ctx, viewport }).promise
      imageUrls.push(canvas.toDataURL('image/png'))
    }

    return imageUrls
  } catch (err) {
    console.warn('PDF rendering error:', err)
    return []
  }
}

export async function parsePdfFile(file: File): Promise<string> {
  try {
    const pageImages = await convertPdfToPageImages(file, 5)
    if (pageImages.length > 0) {
      const texts: string[] = []
      for (const img of pageImages) {
        const text = await callOpenAiVision(img)
        if (text) texts.push(text)
      }
      if (texts.length > 0) return texts.join('\n\n')
    }
  } catch (err) {
    console.warn('PDF extraction fallback:', err)
  }
  return ''
}

/** Parse multi-page PDF or PPTX files into an array of text strings (one per slide/page).
 *  `mode: 'document'` transcribes faithfully for syllabus books; `'qa'` for question papers. */
export async function parseMultiPageDocument(
  file: File,
  onProgress?: (info: { status: string; progress: number; page?: number; totalPages?: number }) => void,
  opts?: { mode?: 'qa' | 'document' },
): Promise<string[]> {
  const fileName = file.name.toLowerCase()
  const mode = opts?.mode ?? 'qa'
  const pageTexts: string[] = []
  const transcribe = (img: string) => (mode === 'document' ? callOpenAiDocVision(img) : callOpenAiVision(img))

  // 1. PDF Documents: Render pages to crisp images & transcribe via ChatGPT Vision (gpt-4o)
  if (fileName.endsWith('.pdf')) {
    onProgress?.({ status: 'Rendering PDF page high-resolution images…', progress: 0.1 })
    addLog({
      category: 'ocr',
      level: 'info',
      title: mode === 'document' ? 'PDF Document Scanning' : 'PDF Vision Scanning',
      details: `Rendering PDF page images for exact ChatGPT Vision (gpt-4o) ${mode === 'document' ? 'document' : 'question'} extraction...`,
    })
    const pageImages = await convertPdfToPageImages(file, 60)
    const totalPages = pageImages.length
    let textLayer: string[] | null = null

    if (totalPages > 0) {
      let failures = 0
      for (let i = 0; i < totalPages; i++) {
        const stepProgress = 0.15 + ((i + 1) / totalPages) * 0.75
        onProgress?.({
          status: `Page ${i + 1} of ${totalPages}: ChatGPT Vision scanning text${mode === 'document' ? ', lists & tables' : ' & math formulas'}…`,
          progress: stepProgress,
          page: i + 1,
          totalPages,
        })

        let out = ''
        try {
          out = await transcribe(pageImages[i])
        } catch (err) {
          failures++
          console.warn(`PDF Page ${i + 1} Vision transcription error:`, err)
          // Fallback A: embedded PDF text layer (offline, exact for digital PDFs)
          if (!textLayer) {
            onProgress?.({ status: 'Vision unavailable — reading embedded PDF text…', progress: stepProgress })
            textLayer = await extractPdfTextLayer(file)
          }
          out = textLayer[i] || ''
          // Fallback B: local Tesseract OCR on the rendered image
          if (!out.trim()) {
            try {
              onProgress?.({ status: `Page ${i + 1}: local Tesseract OCR fallback…`, progress: stepProgress })
              const worker = await getWorker()
              const r = await worker.recognize(pageImages[i])
              out = r.data.text || ''
            } catch (ocrErr) {
              console.warn(`PDF Page ${i + 1} Tesseract fallback error:`, ocrErr)
            }
          }
        }
        if (out && out.trim()) pageTexts.push(out.trim())
      }
      if (failures > 0) {
        addLog({
          category: 'ocr',
          level: 'warn',
          title: 'Vision Fallback Used',
          details: `${failures}/${totalPages} page(s) fell back to PDF text layer / Tesseract. Check the OpenAI API key & quota.`,
        })
      }
      if (pageTexts.length > 0) return pageTexts
    }
  }

  // 2. Word Documents (.docx): read the XML content directly via mammoth — no
  //    OCR / vision needed, so this is both faster and far more accurate.
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    onProgress?.({ status: 'Reading Word document…', progress: 0.2 })
    addLog({
      category: 'ocr',
      level: 'info',
      title: 'Word Document Parsing',
      details: `Extracting ${mode === 'document' ? 'structured content (headings, lists & tables)' : 'question text'} from ${file.name}...`,
    })
    const docxPages = await parseDocxToPages(file, mode)
    onProgress?.({ status: 'Structuring content…', progress: 0.8 })
    if (docxPages.length > 0) return docxPages
    addLog({
      category: 'ocr',
      level: 'warn',
      title: 'Word Document Empty / Unreadable',
      details: `No text could be extracted from ${file.name}. Legacy .doc files must be re-saved as .docx.`,
    })
    return ['']
  }

  // 3. PPTX / PPT Documents:
  if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const decoder = new TextDecoder('utf-8', { fatal: false })
      const rawText = decoder.decode(arrayBuffer)
      const slideMatches = rawText.split(/(?:ppt\/slides\/slide\d+\.xml|<p:sld[^>]*>|--- Slide \d+ ---)/gi)
      if (slideMatches.length > 1) {
        slideMatches.forEach((slideRaw, idx) => {
          if (idx === 0 && slideMatches.length > 1) return
          const textTokens = slideRaw.match(/<a:t[^>]*>([^<]+)<\/a:t>/gi)
          if (textTokens && textTokens.length > 0) {
            const cleanSlideText = textTokens
              .map((t) => t.replace(/<[^>]+>/g, '').trim())
              .filter(Boolean)
              .join('\n')
            if (cleanSlideText.length > 10) {
              pageTexts.push(cleanSlideText)
            }
          }
        })
      }
    } catch {
      /* ignore */
    }
  }

  // 3. Fallback for TXT or plain text documents:
  if (pageTexts.length === 0) {
    try {
      const text = await file.text()
      if (text.trim().length > 0 && !text.includes('%PDF-')) {
        const sections = text.split(/(?:\n{3,}|--- Slide \d+ ---|--- Page \d+ ---|Slide \d+:|Page \d+:)/gi)
        sections.forEach((sec) => {
          if (sec.trim().length > 10) pageTexts.push(sec.trim())
        })
      }
    } catch {
      /* ignore */
    }
  }

  return pageTexts.length > 0 ? pageTexts : ['']
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise
    await w.terminate()
    workerPromise = null
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
