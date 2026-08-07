import { createWorker, type Worker } from 'tesseract.js'
import { structureExamText } from './mcqEngine'
import type { ContentBlock } from '../types'

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || (typeof window !== 'undefined' ? localStorage.getItem('GROQ_API_KEY') || '' : '')
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

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

/** Call Groq Vision API (LLaMA 3.2 Vision) for ultra-fast high accuracy image question scanning */
export async function callGroqVision(imageDataUrl: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
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
    throw new Error(`Groq Vision error: ${res.status} ${errText}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

/** Call Groq 70B AI model for document text structure & question generation */
export async function callGroqDocText(rawText: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
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
    throw new Error(`Groq Text error: ${res.status} ${errText}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

/** AI OCR → MCQ-aware structured blocks powered by Groq AI Vision + Tesseract Fallback */
export async function ocrImageToBlocks(
  source: File | Blob | string,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  onProgress?.({ status: 'Connecting to Groq AI Vision…', progress: 0.15 })

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

    onProgress?.({ status: 'Groq Vision AI analyzing questions & options…', progress: 0.45 })
    text = await callGroqVision(dataUrl)
    confidence = 98
  } catch (err) {
    console.warn('Groq Vision AI fallback to Tesseract:', err)
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
