import { createWorker, type Worker } from 'tesseract.js'
import { structureExamText } from './mcqEngine'
import type { ContentBlock } from '../types'

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
}

/** Call OpenAI ChatGPT Vision API (gpt-4o) for ultra-fast high accuracy image question scanning */
export async function callOpenAiVision(imageDataUrl: string): Promise<string> {
  const apiKey = getOpenAiApiKey()
  if (!apiKey) {
    throw new Error('OpenAI ChatGPT API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file or set it in System Settings.')
  }

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
              text: `You are an expert bilingual exam paper OCR transcriber (English and Tamil).
Transcribe the provided document image EXACTLY line-by-line in its original layout.
CRITICAL BILINGUAL RULES:
1. For bilingual question papers with English text on top and Tamil text below: PRESERVE EVERY LINE OF ENGLISH TEXT AND EVERY LINE OF TAMIL TRANSLATION DIRECTLY UNDERNEATH IT.
2. Do NOT skip, drop, or translate away Tamil text. Keep the exact order: English line first, then Tamil text line directly below.
3. Keep Roman numerals like (i), (ii), (iii), (iv) and their Tamil text lines directly below.
4. Keep options (A), (B), (C), (D), (E) and their Tamil text lines directly below each option.
5. Transcribe mathematical formulas, symbols (≠, ≤, ≥, √), and equations verbatim.
6. If an answer is indicated, mark it like [✓ A]. Output full text verbatim.`,
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
      max_tokens: 3000,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI Vision error: ${res.status} ${errText}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

/** Call OpenAI ChatGPT AI model (gpt-4o) for document text structure & question generation */
export async function callOpenAiDocText(rawText: string): Promise<string> {
  const apiKey = getOpenAiApiKey()
  if (!apiKey) {
    throw new Error('OpenAI ChatGPT API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file or set it in System Settings.')
  }

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
    throw new Error(`OpenAI Text error: ${res.status} ${errText}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

/** AI OCR → MCQ-aware structured blocks powered by OpenAI AI Vision + Tesseract Fallback */
export async function ocrImageToBlocks(
  source: File | Blob | string,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
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

    onProgress?.({ status: 'OpenAI Vision AI analyzing questions & options…', progress: 0.45 })
    text = await callOpenAiVision(dataUrl)
    confidence = 98
  } catch (err) {
    console.warn('OpenAI Vision AI fallback to Tesseract:', err)
    onProgress?.({ status: 'Tesseract OCR reading fallback…', progress: 0.5 })
    const worker = await getWorker()
    const result = await worker.recognize(source)
    text = result.data.text
    confidence = result.data.confidence ?? 80
  }

  onProgress?.({ status: 'Formatting questions, choices & answers…', progress: 0.85 })
  const structured = structureExamText(text)
  onProgress?.({ status: 'Done', progress: 1.0 })

  return {
    text,
    confidence,
    blocks: structured.blocks,
    mcqCount: structured.mcqCount,
    answered: structured.answered,
  }
}

export async function parsePdfFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const decoder = new TextDecoder('utf-8')
    const raw = decoder.decode(arrayBuffer)

    // Extract readable text stream from PDF Tj / TJ tokens
    const textMatches = raw.match(/\(([^()]{2,})\)\s*Tj|\[\s*\(([^()]{2,})\)\s*\]\s*TJ/g)
    if (textMatches && textMatches.length > 5) {
      const extracted = textMatches
        .map((m) => m.replace(/[\(\)\[\]]|\bTJ\b|\bTj\b/g, '').trim())
        .filter((t) => t.length > 1)
        .join(' ')
      if (extracted.length > 50) {
        return extracted
          .replace(/\s+/g, ' ')
          .replace(/([.!?])\s+([A-Z])/g, '$1\n$2')
          .replace(/(\d+\.\d+)\s+([A-Z])/g, '\n\n$1 $2')
      }
    }
  } catch (err) {
    console.warn('Native PDF extraction fallback:', err)
  }
  return ''
}

/** Parse multi-page PDF or PPTX files into an array of text strings (one per slide/page) */
export async function parseMultiPageDocument(file: File): Promise<string[]> {
  const fileName = file.name.toLowerCase()
  const pageTexts: string[] = []

  try {
    const arrayBuffer = await file.arrayBuffer()
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const rawText = decoder.decode(arrayBuffer)

    // 1. Check for PPTX / slide XML chunks in array buffer string
    if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt') || rawText.includes('ppt/slides/slide')) {
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
          } else {
            const cleanSlideText = slideRaw
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
            if (cleanSlideText.length > 20) {
              pageTexts.push(cleanSlideText)
            }
          }
        })
      }
    }

    // 2. Check for PDF page text tokens
    if (pageTexts.length === 0 && (fileName.endsWith('.pdf') || rawText.includes('%PDF-1.'))) {
      const rawPdfPages = rawText.split(/\f|\/Page\b|\/Type\s*\/Page\b/gi)
      if (rawPdfPages.length > 1) {
        rawPdfPages.forEach((pageRaw) => {
          const textMatches = pageRaw.match(/\(([^()]{2,})\)\s*Tj|\[\s*\(([^()]{2,})\)\s*\]\s*TJ/g)
          if (textMatches && textMatches.length > 2) {
            const extracted = textMatches
              .map((m) => m.replace(/[\(\)\[\]]|\bTJ\b|\bTj\b/g, '').trim())
              .filter((t) => t.length > 1)
              .join(' ')
            if (extracted.length > 30) {
              pageTexts.push(
                extracted
                  .replace(/\s+/g, ' ')
                  .replace(/([.!?])\s+([A-Z])/g, '$1\n$2')
                  .replace(/(\d+\.\d+)\s+([A-Z])/g, '\n\n$1 $2'),
              )
            }
          }
        })
      }
    }

    // 3. Fallback: Split raw text by slide/page section markers or double spacing
    if (pageTexts.length === 0) {
      const text = await file.text()
      const sections = text.split(/(?:\n{3,}|--- Slide \d+ ---|--- Page \d+ ---|Slide \d+:|Page \d+:)/gi)
      if (sections.length > 1) {
        sections.forEach((sec) => {
          if (sec.trim().length > 15) pageTexts.push(sec.trim())
        })
      } else if (text.trim().length > 0) {
        pageTexts.push(text.trim())
      }
    }
  } catch (err) {
    console.warn('Multi-page document parsing fallback:', err)
  }

  return pageTexts.length > 0 ? pageTexts : [await file.text().catch(() => '')]
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
