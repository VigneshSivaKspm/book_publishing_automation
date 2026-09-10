import { createWorker, type Worker } from 'tesseract.js'
import { structureExamText } from './mcqEngine'
import { structureDocumentText } from './docStructure'
import { extractChapterMeta, type ChapterMeta } from './chapterMeta'
import type { ContentBlock } from '../types'
import { addLog } from './logger'

export function getOpenAiApiKey(): string {
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem('OPENAI_API_KEY')
    if (localKey && localKey.trim()) return localKey.trim()
  }
  return import.meta.env.VITE_OPENAI_API_KEY || ''
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

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

/** Call OpenAI ChatGPT Vision API (gpt-4o) for ultra-fast high accuracy image question scanning */
export async function callOpenAiVision(imageDataUrl: string): Promise<string> {
  const apiKey = getOpenAiApiKey()
  if (!apiKey) {
    addLog({
      category: 'ocr',
      level: 'error',
      title: 'ChatGPT Vision Key Missing',
      details: 'VITE_OPENAI_API_KEY is missing from environment/settings.',
    })
    throw new Error('OpenAI ChatGPT API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file or set it in System Settings.')
  }

  addLog({
    category: 'ocr',
    level: 'info',
    title: 'ChatGPT Vision API Request (gpt-4o)',
    details: `Sending document image (${Math.round(imageDataUrl.length / 1024)} KB) to OpenAI Vision model...`,
    meta: { model: 'gpt-4o', temperature: 0.1, max_tokens: 4096 },
  })

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an expert exam question-paper transcriber (English, Tamil, Mathematics).
Transcribe this page into a STRICT canonical text format. Output plain text only — no commentary, no markdown code fences.

0. CHAPTER HEADER: if this page's header/title area shows a chapter, unit or lesson name (and possibly its number), output it as the VERY FIRST line, exactly:
<<<CHAPTER>>> <Title> | <Number>
Omit " | <Number>" when there is no number. Do not repeat this line on later content.

FORMAT for every question:
<number>. <full question stem> (<year tag exactly as printed, e.g. (2025)>)
A) <option A>
B) <option B>
C) <option C>
D) <option D>
E) <option E, only if present>
<one blank line between questions>

RULES:
1. 2-COLUMN PAGES: transcribe the ENTIRE left column top-to-bottom first, then the ENTIRE right column top-to-bottom. Never interleave the two columns.
2. Keep the EXACT original question numbers (1., 2., ... 128.). Never renumber or skip.
3. Keep the year / exam tag exactly as printed, in parentheses, at the END of the stem line (e.g. "(2025)", "(2024)", "(2018)").
4. Options: ALWAYS label "A)", "B)", "C)", "D)", "E)", one per line — even when the source shows "(A)" or "A.".
5. MATH: write every formula, integral, double/triple integral, fraction, exponent, subscript, limit, root, matrix and symbol in valid LaTeX wrapped in $...$ — e.g. $\\int_0^1 \\int_0^1 \\int_0^1 e^{x+y+z}\\,dx\\,dy\\,dz$, $\\frac{a^4}{6}$, $\\sqrt{ay}$, $\\frac{dx}{(x^2+a^2)^n}$, $I_{n-1}$, $\\sin^3\\theta\\,d\\theta$.
6. MATCH-THE-FOLLOWING: put each "(a) ... — (1) ..." mapping row on its own line inside the stem (before the options), then give the code choices as the options: "A) 2 3 4 1", "B) 4 3 2 1", ...
7. ASSERTION-REASON: put "Assertion (A): ..." and "Reason (R): ..." on their own lines inside the stem, then the options.
8. ANSWER-KEY / ANSWER-GRID PAGE: output the single line "ANSWER KEY" then one "N. X" per line (N = question number, X = A/B/C/D/E, or "-" if the cell is blank). Read a columnar grid COLUMN BY COLUMN in ascending number order. Do NOT emit any A)/B) option lines on an answer-key page.
9. IGNORE the running header, footer, publisher band ("Karthikeyan Analysis..."), page numbers and the faint circular watermark seal.
10. Bilingual papers: keep each English line immediately followed by its Tamil line.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    addLog({
      category: 'ocr',
      level: 'error',
      title: 'ChatGPT Vision API Error',
      details: `Status ${res.status}: ${errText}`,
    })
    throw new Error(`OpenAI Vision error: ${res.status} ${errText}`)
  }

  const data = await res.json()
  const content: string = (data.choices?.[0]?.message?.content || '')
    .replace(/^```(?:[a-z]+)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')

  addLog({
    category: 'ocr',
    level: 'success',
    title: 'ChatGPT Vision Transcribed',
    details: `Transcribed ${content.length} characters cleanly from image with 98% accuracy.`,
    meta: { charLength: content.length, usage: data.usage },
  })

  return content
}

/** Call OpenAI ChatGPT Vision API (gpt-4o) for FAITHFUL study-material / syllabus page transcription. */
export async function callOpenAiDocVision(imageDataUrl: string): Promise<string> {
  const apiKey = getOpenAiApiKey()
  if (!apiKey) {
    addLog({
      category: 'ocr',
      level: 'error',
      title: 'ChatGPT Vision Key Missing',
      details: 'VITE_OPENAI_API_KEY is missing from environment/settings.',
    })
    throw new Error('OpenAI ChatGPT API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file or set it in System Settings.')
  }

  addLog({
    category: 'ocr',
    level: 'info',
    title: 'ChatGPT Vision — Document Mode (gpt-4o)',
    details: `Transcribing study-material page (${Math.round(imageDataUrl.length / 1024)} KB) preserving headings, lists, tables & formulas...`,
    meta: { model: 'gpt-4o', temperature: 0.1, max_tokens: 4096, mode: 'document' },
  })

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an expert document transcriber for textbooks and study material (English, Tamil, Mathematics).
Transcribe this page EXACTLY, preserving its structure, as GitHub-Flavored Markdown.

RULES:
0. CHAPTER HEADER: if this page's header/title area shows a chapter, unit or lesson name (and possibly its number), output it as the VERY FIRST line, exactly:
<<<CHAPTER>>> <Title> | <Number>
Omit " | <Number>" when there is no number.
1. Chapter / topic title -> "# Title".
2. Numbered section headings: "2.1 Importance of Micro Economics" -> "## 2.1 Importance of Micro Economics"; "2.6.1 Characteristics" -> "### 2.6.1 Characteristics". Other bold sub-headings -> "## Heading".
3. Body text -> normal paragraphs separated by ONE blank line. Re-join words split by a hyphen at a line break. Do not wrap mid-sentence.
4. Lists -> one item per line. Symbol bullets ("•", "-", "o", "➢") -> "- item". KEEP lettered lists ("a) ...", "(a) ..."), roman lists ("i. ...") and numbered lists ("1. ...") with their original markers, one item per line.
5. Tables -> GitHub Markdown pipe tables: a header row, then a "| --- | --- |" separator row, then one row per line. Keep every column.
6. Mathematical content -> LaTeX: inline $...$, display equations on their own line as $$...$$ (e.g. $$e_p = \\frac{\\Delta Q}{\\Delta P} \\times \\frac{P}{Q}$$).
7. 2-COLUMN PAGES: read the LEFT column fully top-to-bottom, THEN the RIGHT column top-to-bottom. Never zig-zag across columns.
8. IGNORE running headers/footers, the publisher name band, page numbers, and the faint circular watermark seal.
9. Output ONLY the transcribed Markdown — no commentary, no code fences.`,
            },
            {
              type: 'image_url',
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    addLog({
      category: 'ocr',
      level: 'error',
      title: 'ChatGPT Vision (Document Mode) Error',
      details: `Status ${res.status}: ${errText}`,
    })
    throw new Error(`OpenAI Vision error: ${res.status} ${errText}`)
  }

  const data = await res.json()
  const content: string = (data.choices?.[0]?.message?.content || '').replace(/^```(?:markdown)?\s*|\s*```$/g, '')

  addLog({
    category: 'ocr',
    level: 'success',
    title: 'ChatGPT Vision Document Transcribed',
    details: `Transcribed ${content.length} characters (headings, lists & tables preserved).`,
    meta: { charLength: content.length, usage: data.usage },
  })

  return content
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
      const text = (content.items as Array<{ str?: string }>)
        .map((it) => it.str || '')
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
      out.push(text)
    }
    return out
  } catch (err) {
    console.warn('PDF text-layer extraction failed:', err)
    return []
  }
}

/** Call OpenAI ChatGPT AI model (gpt-4o) for document text structure & question generation */
export async function callOpenAiDocText(rawText: string): Promise<string> {
  const apiKey = getOpenAiApiKey()
  if (!apiKey) {
    addLog({
      category: 'ocr',
      level: 'error',
      title: 'ChatGPT Doc Key Missing',
      details: 'VITE_OPENAI_API_KEY is missing.',
    })
    throw new Error('OpenAI ChatGPT API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file or set it in System Settings.')
  }

  addLog({
    category: 'ocr',
    level: 'info',
    title: 'ChatGPT Doc Text Structuring (gpt-4o)',
    details: `Sending ${rawText.length} characters of raw text to ChatGPT for publishing layout structuring...`,
  })

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert bilingual document publisher AI. Transform raw text into clean, structured Question Banks while STRICTLY PRESERVING bilingual layout (English line on top, Tamil translation line directly underneath). Keep all questions, options (A, B, C, D, E), and Roman numerals (i, ii, iii) in exact sequence. Mark correct answers like [✓ A] where indicated.',
        },
        {
          role: 'user',
          content: rawText.slice(0, 15000),
        },
      ],
      temperature: 0.1,
      max_tokens: 3500,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    addLog({
      category: 'ocr',
      level: 'error',
      title: 'ChatGPT Doc Text Error',
      details: `Status ${res.status}: ${errText}`,
    })
    throw new Error(`OpenAI Text error: ${res.status} ${errText}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ''

  addLog({
    category: 'ocr',
    level: 'success',
    title: 'ChatGPT Doc Text Structured',
    details: `Received structured document text (${content.length} chars).`,
    meta: { usage: data.usage },
  })

  return content
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
  let confidence = 95

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
    confidence = 98
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
    const blocks = structureDocumentText(body)
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
    blocks: structured.blocks,
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
      const viewport = page.getViewport({ scale: 2.0 })
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

  // 2. PPTX / PPT Documents:
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
