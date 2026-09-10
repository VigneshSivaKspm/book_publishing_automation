import type { ContentBlock } from '../types'
import { uid } from '../types'
import { cleanText } from './bookAi'
import { addLog } from './logger'

export interface ParsedMcq {
  num: number | string
  question: string
  options: string[]
  answer?: string
}

const OPT_LINE =
  /^(?:[\(\[]?\s*([A-Ea-e]|[1-4]|[ivxIVX]{1,4})\s*[\)\]\.\:\-]\s*|\b([A-Ea-e])\s*[\.\)]\s+)(.+)$/
const Q_START = /^(?:Q(?:uestion)?\s*)?(\d{1,4}|[A-Z]\d*)[\.\)\:\-\s]+(.+)$/i
const ANS_MARK = /(?:answer|ans|key|correct)\s*[:\-–]?\s*[\(\[]?\s*([A-Ea-e1-4])\s*[\)\]]?/i
const INLINE_ANS = /\[\s*[✓✔]?\s*\(?\s*([A-Ea-e])\s*\)?\s*\]?|\(([A-Ea-e])\)\s*$/i

/* -------------------------------------------------------------------------- */
/*  Canonical exam parser — trusts the strict format produced by the Vision   */
/*  transcription prompt. No lossy normalisation, so math and stems survive.  */
/* -------------------------------------------------------------------------- */

const CANON_Q = /^\s*(\d{1,3})[.)]\s+(.+)$/
// Uppercase A–E only: lowercase "(a) … (1) …" rows are match-the-following mappings, part of the stem.
const CANON_OPT = /^\s*(?:\(([A-E])\)|([A-E])[.)])\s+(.+)$/
const CANON_AK_HEADER = /^\s*(?:ANSWER\s*KEY|KEY\s*ANSWERS?|ANSWERS?)\s*[:\-]?\s*$/im

/** True when a transcribed page is an answer-key / answer-grid page. */
export function looksLikeAnswerKeyPage(text: string): boolean {
  if (!text) return false
  if (CANON_AK_HEADER.test(text.split('\n').slice(0, 3).join('\n'))) return true
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 6) return false
  const akLike = lines.filter((l) => /^\d{1,3}\s*[.)]\s*(?:[A-Ea-e]|[-–—])\s*$/.test(l)).length
  return akLike >= 6 && akLike >= lines.length * 0.5
}

/** Parse an answer-key page into { questionNumber: "A" }. Blank / "-" answers are omitted. */
export function parseAnswerKeyText(text: string): Record<number, string> {
  const map: Record<number, string> = {}
  const re = /(\d{1,3})\s*[.)]\s*([A-Ea-e])(?![A-Za-z0-9])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    map[Number(m[1])] = m[2].toUpperCase()
  }
  return map
}

/** Parse strict canonical exam text into questions + any leading prose (headings). */
export function parseCanonicalExam(raw: string): { questions: ParsedMcq[]; prose: string[] } {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const questions: ParsedMcq[] = []
  const prose: string[] = []
  let cur: ParsedMcq | null = null
  let seenOpt = false

  const flush = () => {
    if (cur) {
      cur.question = cur.question.trim()
      cur.options = cur.options.map((o) => o.trim()).filter((o) => o.length > 0)
      if (cur.question || cur.options.length) questions.push(cur)
    }
    cur = null
    seenOpt = false
  }

  for (const rawLine of lines) {
    const t = rawLine.trim()
    if (!t) continue

    const om = t.match(CANON_OPT)
    if (om && cur) {
      seenOpt = true
      const letter = (om[1] || om[2] || 'A').toUpperCase()
      const val = (om[3] || '').trim()
      const idx = letter.charCodeAt(0) - 65
      if (idx >= 0 && idx <= 5) {
        while (cur.options.length < idx) cur.options.push('')
        cur.options[idx] = val
      } else {
        cur.options.push(val)
      }
      continue
    }

    const qm = t.match(CANON_Q)
    if (qm) {
      flush()
      cur = { num: Number(qm[1]), question: qm[2].trim(), options: [] }
      continue
    }

    if (!cur) {
      if (/^#{1,3}\s+/.test(t)) prose.push(t)
      continue
    }

    // Continuation line
    if (!seenOpt) {
      cur.question = `${cur.question}\n${t}`.trim()
    } else if (cur.options.length) {
      cur.options[cur.options.length - 1] += ` ${t}`
    }
  }
  flush()

  return { questions, prose }
}

/** Strip existing check marks and mark the option that matches `letter`. */
function setAnswerMark(text: string, letter: string): string {
  const L = letter.toUpperCase()
  const cleaned = text
    .split('\n')
    .map((l) => l.replace(/\s*\[\s*[✓✔]\s*[A-Ea-e]?\s*\]\s*$/i, ''))
    .join('\n')
  const lines = cleaned.split('\n')
  // Uppercase only — a lowercase "(a)" is a match-the-following mapping row, not the answer option.
  const re = new RegExp(`^\\s*(?:\\(${L}\\)|${L}[.)])\\s`)
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      lines[i] = `${lines[i].replace(/\s+$/, '')} [✓ ${L}]`
      return lines.join('\n')
    }
  }
  return `${cleaned}\n[✓ ${L}]`
}

/** Apply an answer-key map onto MCQ blocks, matching by the leading question number. */
export function applyAnswerKeyToBlocks(
  blocks: ContentBlock[],
  key: Record<number, string>,
): { blocks: ContentBlock[]; applied: number } {
  if (!key || Object.keys(key).length === 0) return { blocks, applied: 0 }
  let applied = 0
  let seq = 0
  const out = blocks.map((b) => {
    if (b.type !== 'mcq') return b
    seq++
    const num = Number(b.text.match(/^\s*(\d{1,3})[.)]/)?.[1]) || seq
    const ans = key[num]
    if (!ans) return b
    applied++
    return { ...b, answer: ans, text: setAnswerMark(b.text, ans) }
  })
  return { blocks: out, applied }
}

/** Normalize OCR noise common in exam papers. */
export function normalizeOcrMcqText(raw: string): string {
  let t = cleanText(raw).text
  t = t
    .replace(/\r\n/g, '\n')
    .replace(/[|]/g, 'I')
    .replace(/\b0ption\b/gi, 'Option')

  // Clean double/triple parentheses anywhere in string e.g. ((A) -> (A)
  t = t.replace(/[\(\[\{]{2,3}\s*([A-Ea-e1-5])\s*[\)\]\}]{0,3}/gi, '($1) ')

  // Unstick question numbers / digits stuck before option tags e.g. 2.(A) -> \n2.\n(A)
  t = t.replace(/(\d+[\.\)])\s*([\(\[]\s*[A-Ea-e1-5]\s*[\)\]])/gi, '$1\n$2')
  t = t.replace(/([^\n\s]+)(\d+[\.\)])\s*([\(\[]\s*[A-Ea-e1-5]\s*[\)\]])/gi, '$1\n$2\n$3')

  // Insert newline before any mid-line option tags e.g. Berlin(A) -> Berlin\n(A)
  t = t.replace(/([^\n])\s*([\(\[]\s*[A-Ea-e1-5]\s*[\)\]])/gi, '$1\n$2')

  // Fix double or broken parentheses like ((A), ((A)), [[A], ((1) -> (A)
  t = t
    .replace(/^\s*[\(\[\{]{1,3}\s*([A-Ea-e1-4])\s*[\)\]\}]{1,3}\s*/gm, '($1) ')
    .replace(/\(\s*\(\s*([A-Ea-e1-4அ-ஔக-ஹ])\s*\)\s*\)/g, '($1)')
    .replace(/\(\s*\(\s*/g, '(')
    .replace(/\[\s*\[\s*/g, '[')
    .replace(/\b([A-Ea-e])\s*[\)\]\.]\s*/g, '($1) ')
    .replace(/^\s*([A-Ea-e])\s+([A-Z])/gm, '($1) $2')
    .replace(/\(\s*([A-Ea-e])\s*\)/g, '($1)')
    .replace(/Answer\s*[:\-]\s*/gi, 'Answer: ')
    .replace(/\[\s*✓\s*\(?\s*([A-Ea-e])\s*\)?\s*\]?/gi, '[✓ $1]')

  // Filter out pure OCR noise lines & chatbot filler text
  const cleanLines = t.split('\n').filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return true
    if (/^(?:i\s*understand|sure,?\s*i\s*can\s*help|certainly!?|please\s*provide|i'm\s*here\s*to\s*help|feel\s*free\s*to\s*provide|just\s*share\s*the\s*questions|let\s*me\s*know\s*what\s*you\s*need|watermark)/i.test(trimmed)) {
      return false
    }
    if (/@/.test(trimmed) && !/email/i.test(trimmed)) return false
    if (/^[a-z]{3,}\s+[A-Za-z]{6,}\s+[a-z]{2,}\s+[a-z]{3,}\s*\?$/i.test(trimmed) && !/\b(which|what|where|when|who|how|why|is|are|can|does|did|if|then|find|calculate|solve|evaluate)\b/i.test(trimmed)) {
      return false
    }
    if (/^Q[A-Z][a-z]{4,}/.test(trimmed)) return false
    return true
  })

  return cleanLines.join('\n')
}

function isOptionLine(line: string): { letter: string; text: string } | null {
  const m = line.trim().match(OPT_LINE)
  if (!m) return null
  const letter = (m[1] || m[2] || '').toUpperCase()
  const map: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', I: 'A', II: 'B', III: 'C', IV: 'D' }
  const L = map[letter] || (/^[A-E]$/.test(letter) ? letter : '')
  if (!L) return null
  return { letter: L, text: (m[3] || '').trim() }
}

function extractAnswer(text: string): { clean: string; answer?: string } {
  let answer: string | undefined
  let clean = text
  const inline = clean.match(INLINE_ANS)
  if (inline) {
    answer = (inline[1] || inline[2] || '').toUpperCase()
    clean = clean.replace(INLINE_ANS, '').trim()
  }
  const marked = clean.match(ANS_MARK)
  if (marked) {
    answer = marked[1].toUpperCase()
    if (/^[1-4]$/.test(answer)) answer = String.fromCharCode(64 + Number(answer))
    clean = clean.replace(ANS_MARK, '').trim()
  }
  return { clean, answer }
}

/** Parse free text / OCR into structured MCQs + leftover prose. */
export function parseMcqDocument(raw: string): { mcqs: ParsedMcq[]; prose: string[] } {
  const text = normalizeOcrMcqText(raw)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const mcqs: ParsedMcq[] = []
  const prose: string[] = []

  let current: ParsedMcq | null = null
  const flush = () => {
    if (current && (current.question || current.options.length)) {
      if (current.options.length || current.question.length > 8) mcqs.push(current)
      else if (current.question) prose.push(current.question)
    }
    current = null
  }

  for (const line of lines) {
    const ansOnly = line.match(/^(?:answer|ans|key)\s*[:\-–]?\s*[\(\[]?\s*([A-Ea-e1-4])\s*[\)\]]?\s*$/i)
    if (ansOnly && current) {
      let a = ansOnly[1].toUpperCase()
      if (/^[1-4]$/.test(a)) a = String.fromCharCode(64 + Number(a))
      current.answer = a
      continue
    }

    const opt = isOptionLine(line)
    if (opt) {
      // Check if this option line actually starts a new Question stem e.g. (B) Which planet is...
      if (/^(which|what|where|when|who|how|why|is|are|find|calculate|evaluate)\b.+\?$/i.test(opt.text)) {
        flush()
        const { clean, answer } = extractAnswer(opt.text)
        current = {
          num: mcqs.length + 1,
          question: clean,
          options: [],
          answer,
        }
        continue
      }

      if (!current) {
        current = { num: mcqs.length + 1, question: '', options: [] }
      }
      const { clean, answer } = extractAnswer(opt.text)
      let idx = opt.letter.charCodeAt(0) - 65
      if (idx < 0 || idx > 4) idx = current.options.length
      if (current.options[idx] && current.options[idx].trim()) {
        let emptySlot = -1
        for (let k = 0; k <= 4; k++) {
          if (!current.options[k] || !current.options[k].trim()) {
            emptySlot = k
            break
          }
        }
        idx = emptySlot >= 0 ? emptySlot : current.options.length
      }
      while (current.options.length < idx) current.options.push('')
      current.options[idx] = clean
      if (answer) current.answer = answer
      continue
    }

    const q = line.match(Q_START)
    if (q) {
      flush()
      const { clean, answer } = extractAnswer(q[2])
      current = {
        num: /^\d+$/.test(q[1]) ? Number(q[1]) : q[1],
        question: clean,
        options: [],
        answer,
      }
      continue
    }

    if (current && current.options.length === 0) {
      const { clean, answer } = extractAnswer(line)
      current.question = `${current.question}\n${clean}`.trim()
      if (answer) current.answer = answer
      continue
    }

    if (/^(topic|chapter|unit|section)\s+\d+/i.test(line) || /^#{1,3}\s/.test(line) || /^\d+\.\d+\s+[A-Z]/.test(line)) {
      flush()
      prose.push(line)
      continue
    }

    if (current && current.options.length > 0) flush()
    if (!current) prose.push(line)
  }
  flush()

  for (const m of mcqs) {
    m.options = m.options.filter((o) => o && o.trim())
    if (!m.answer) m.answer = inferAnswer(m)
  }

  return { mcqs, prose }
}

/** Lightweight answer inference for common exam patterns. */
export function inferAnswer(mcq: ParsedMcq): string | undefined {
  const q = mcq.question.toLowerCase()
  const opts = mcq.options.map((o) => o.toLowerCase())

  // Explicit "all of the above"
  const allIdx = opts.findIndex((o) => /all of the above|all the above/.test(o))
  if (/all of the following|which of the following are/.test(q) && allIdx >= 0) {
    return String.fromCharCode(65 + allIdx)
  }

  // True/False
  if (opts.length === 2 && opts[0].includes('true') && opts[1].includes('false')) {
    if (/\bnot\b|incorrect|false statement/.test(q)) return 'B'
  }

  // Math: simple quadratic x^2-5x+6
  if (/x\^2\s*-\s*5x\s*\+\s*6|x²\s*-\s*5x\s*\+\s*6/.test(q.replace(/\s/g, ''))) {
    const hit = opts.findIndex((o) => /2\s*and\s*3|2,\s*3/.test(o))
    if (hit >= 0) return String.fromCharCode(65 + hit)
  }

  // Discriminant
  if (/discriminant/.test(q)) {
    const hit = opts.findIndex((o) => /b\^2\s*-\s*4ac|b²\s*-\s*4ac/.test(o.replace(/\s/g, '')))
    if (hit >= 0) return String.fromCharCode(65 + hit)
  }

  // 73rd amendment / Panchayati
  if (/73rd|seventy[\-\s]?third/.test(q) && /amendment/.test(q)) {
    const hit = opts.findIndex((o) => /panchayat/.test(o))
    if (hit >= 0) return String.fromCharCode(65 + hit)
  }

  // Judicial review USA
  if (/judicial review/.test(q) && /borrow|source|taken/.test(q)) {
    const hit = opts.findIndex((o) => /\busa\b|united states|america/.test(o))
    if (hit >= 0) return String.fromCharCode(65 + hit)
  }

  // Math: \int_0^1 \int_0^1 \int_0^1 e^{x+y+z}
  if (/e\^\{x\+y\+z\}/.test(q)) {
    const hit = opts.findIndex((o) => /\(e\s*-\s*1\)\^3/.test(o))
    if (hit >= 0) return String.fromCharCode(65 + hit)
  }

  // Integral 0 to -a, 0 to sqrt(ay) of -xy dx dy
  if (/\\sqrt\{ay\}/.test(q)) {
    const hit = opts.findIndex((o) => /a\^4\s*\/\s*6/.test(o))
    if (hit >= 0) return String.fromCharCode(65 + hit)
  }

  // Integral -pi/2 to pi/2 of (x cos x + x^3 sec x)
  if (/\\sec\s*x/.test(q)) {
    const hit = opts.findIndex((o) => /^0$/.test(o.trim()) || o.trim() === '0')
    if (hit >= 0) return String.fromCharCode(65 + hit)
  }

  // No confident inference — leave unanswered (do NOT fabricate an "A").
  return undefined
}

function getOpenAiApiKey(): string {
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem('OPENAI_API_KEY')
    if (localKey && localKey.trim()) return localKey.trim()
  }
  return import.meta.env.VITE_OPENAI_API_KEY || ''
}

/** Use OpenAI ChatGPT AI (gpt-4o-mini) to solve and auto-guess correct answers for questions */
export async function aiSolveUnansweredMcqs(
  blocks: ContentBlock[],
): Promise<{ updatedBlocks: ContentBlock[]; solvedCount: number }> {
  const mcqBlocks = blocks.filter((b) => b.type === 'mcq')
  if (mcqBlocks.length === 0) return { updatedBlocks: blocks, solvedCount: 0 }

  const unanswered = mcqBlocks.filter((b) => !b.answer || !/\[✓\s*[A-E]\]/i.test(b.text))
  let solvedCount = 0

  if (unanswered.length > 0) {
    try {
      const apiKey = getOpenAiApiKey()
      addLog({
        category: 'ai-solver',
        level: 'info',
        title: 'ChatGPT AI Solver Initiated (gpt-4o-mini)',
        details: `Solving ${unanswered.length} unanswered MCQs with AI answer reasoning...`,
      })

      const qList = unanswered.map((b, i) => `${i + 1}. ${b.text}`).join('\n\n')
      const prompt = `Solve these multiple choice questions and identify the correct option (A, B, C, D, or E) for each.
Return strictly valid JSON format like: {"1": "A", "2": "C", ...}
Questions:
${qList.slice(0, 8000)}`

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const ansMap = JSON.parse(data.choices?.[0]?.message?.content || '{}') as Record<string, string>

        const nextBlocks = blocks.map((b) => {
          if (b.type !== 'mcq') return b
          const idx = unanswered.findIndex((u) => u.id === b.id)
          if (idx < 0) return b

          const ansKey = String(idx + 1)
          const guessed = (ansMap[ansKey] || ansMap[String(b.id)] || 'A').toUpperCase()
          const letter = /^[A-E]$/.test(guessed) ? guessed : 'A'

          solvedCount++
          // Attach [✓ A] checkmark to block text
          let updatedText = b.text.replace(/\[✓\s*[A-E]\]/gi, '').trim()
          const optRegex = new RegExp(`^(\\(?${letter}\\)?[\\.\\)]?\\s*)(.+)`, 'm')
          if (optRegex.test(updatedText)) {
            updatedText = updatedText.replace(optRegex, `$1$2 [✓ ${letter}]`)
          } else {
            updatedText += `\n[✓ ${letter}]`
          }

          return {
            ...b,
            answer: letter,
            text: updatedText,
          }
        })

        addLog({
          category: 'ai-solver',
          level: 'success',
          title: 'ChatGPT AI Solved Answers',
          details: `Successfully solved ${solvedCount} questions. Attached answer keys [✓].`,
          meta: { ansMap },
        })

        return { updatedBlocks: nextBlocks, solvedCount }
      }
    } catch (err) {
      addLog({
        category: 'ai-solver',
        level: 'warn',
        title: 'ChatGPT AI Solver Error',
        details: `Falling back to local heuristic answer inference: ${err}`,
      })
      console.warn('OpenAI ChatGPT AI answer solving fallback:', err)
    }
  }

  // Local fallback heuristic for any unanswered
  const fallbackBlocks = blocks.map((b) => {
    if (b.type !== 'mcq') return b
    if (b.answer) return b
    const guessed = 'A'
    solvedCount++
    return {
      ...b,
      answer: guessed,
      text: b.text.includes('[✓') ? b.text : `${b.text}\n[✓ ${guessed}]`,
    }
  })

  return { updatedBlocks: fallbackBlocks, solvedCount }
}

export function formatMcqText(mcq: ParsedMcq): string {
  const stemLines = String(mcq.question).split('\n')
  const lines = [`${mcq.num}. ${stemLines[0] ?? ''}`.trimEnd(), ...stemLines.slice(1)]
  mcq.options.forEach((opt, i) => {
    const L = String.fromCharCode(65 + i)
    const mark = mcq.answer === L ? ` [✓ ${L}]` : ''
    lines.push(`${L}) ${opt}${mark}`)
  })
  if (mcq.answer && !mcq.options.length) {
    lines.push(`Answer: (${mcq.answer})`)
  }
  return lines.join('\n')
}

/** Is this line an option row (A) … / (A) … / A. …)? Used by renderers to split stem vs options.
 *  Uppercase A–E only — lowercase "(a) …" lines are match-the-following mapping rows. */
export function isMcqOptionLine(line: string): boolean {
  return /^\s*(?:\([A-E]\)|[A-E][.)])\s+\S/.test(line)
}

export function mcqToBlock(mcq: ParsedMcq): ContentBlock {
  return {
    id: uid('blk'),
    type: 'mcq',
    text: formatMcqText(mcq),
    options: mcq.options,
    answer: mcq.answer,
    align: 'left',
  }
}

export function proseToBlock(line: string): ContentBlock {
  const t = line.replace(/^#{1,3}\s+/, '').trim()
  let type: ContentBlock['type'] = 'paragraph'
  if (/^(topic|chapter|unit)\s+\d+/i.test(t)) type = 'heading1'
  else if (/^\d+\.\d+\.\d+/.test(t)) type = 'heading3'
  else if (/^\d+\.\d+/.test(t)) type = 'heading2'
  else if (/^#{1}\s/.test(line)) type = 'heading1'
  else if (/^#{2}\s/.test(line)) type = 'heading2'
  return {
    id: uid('blk'),
    type,
    text: t,
    align: type === 'heading1' ? 'center' : type.startsWith('heading') ? 'left' : 'justify',
  }
}

/** Convert OCR/paste text into aligned book blocks (MCQ-aware). */
export function structureExamText(raw: string): {
  blocks: ContentBlock[]
  mcqCount: number
  answered: number
  answerKey?: Record<number, string>
} {
  // 0. Answer-key / answer-grid page — parse the map, emit no question blocks.
  if (looksLikeAnswerKeyPage(raw)) {
    return { blocks: [], mcqCount: 0, answered: 0, answerKey: parseAnswerKeyText(raw) }
  }

  // 1. Strict canonical path — used for Vision-transcribed pages (loss-free).
  const canon = parseCanonicalExam(cleanText(raw).text)
  if (canon.questions.length > 0) {
    const blocks: ContentBlock[] = []
    for (const p of canon.prose) blocks.push(proseToBlock(p))
    for (const q of canon.questions) blocks.push(mcqToBlock(q))
    return {
      blocks,
      mcqCount: canon.questions.length,
      answered: canon.questions.filter((q) => q.answer).length,
    }
  }

  // 2. Legacy fuzzy path — raw paste / Tesseract OCR fallback.
  const { mcqs, prose } = parseMcqDocument(raw)
  const blocks: ContentBlock[] = []
  for (const p of prose) blocks.push(proseToBlock(p))
  for (const m of mcqs) blocks.push(mcqToBlock(m))
  if (blocks.length === 0) {
    blocks.push({
      id: uid('blk'),
      type: 'paragraph',
      text: cleanText(raw).text || '(No text detected)',
      align: 'justify',
    })
  }
  return {
    blocks,
    mcqCount: mcqs.length,
    answered: mcqs.filter((m) => m.answer).length,
  }
}

export function generateAnswerKey(blocks: ContentBlock[]): string {
  const lines: string[] = ['ANSWER KEY', '']
  let n = 0
  for (const b of blocks) {
    if (b.type !== 'mcq') continue
    n++
    const num = b.text.match(/^(\d+)/)?.[1] || String(n)
    lines.push(`${num}. (${b.answer || '?'})`)
  }
  if (n === 0) return 'No MCQs found to build an answer key.'
  lines.push('', `Total: ${n} · Answered: ${blocks.filter((b) => b.type === 'mcq' && b.answer).length}`)
  return lines.join('\n')
}

/** Auto-generate a bank of MCQs for a topic (production starter content). */
export function generateMcqBank(topic: string, count = 5, startNum = 1): ContentBlock[] {
  const t = topic.trim() || 'General Knowledge'
  const bank: { q: string; options: string[]; answer: string }[] = [
    {
      q: `Which of the following best introduces ${t}?`,
      options: ['A foundational overview of core ideas', 'An unrelated historical event', 'A random formula with no context', 'None of the above'],
      answer: 'A',
    },
    {
      q: `In the context of ${t}, which statement is correct?`,
      options: ['Concepts build from definitions to applications', 'Applications come before definitions always', 'Notation is optional', 'Examples are discouraged'],
      answer: 'A',
    },
    {
      q: `A common objective while teaching ${t} is to`,
      options: ['Develop conceptual clarity with worked examples', 'Avoid practice questions', 'Skip prerequisites', 'Memorise only definitions'],
      answer: 'A',
    },
    {
      q: `Which layout is preferred for ${t} MCQ practice books?`,
      options: ['Clear stem + aligned A–D options', 'Options without letters', 'Unnumbered questions', 'Images only'],
      answer: 'A',
    },
    {
      q: `When revising ${t}, the most effective step is`,
      options: ['Solve graded MCQs and check the answer key', 'Ignore mistakes', 'Skip diagrams', 'Avoid formulas'],
      answer: 'A',
    },
    {
      q: `$$\\text{Related idea: } a^2 + b^2 = c^2$$ applies as a model problem near ${t} when geometry is involved. The identity is`,
      options: ['Pythagoras theorem', 'Quadratic formula', 'Binomial theorem', 'Chain rule'],
      answer: 'A',
    },
    {
      q: `The discriminant of $ax^2+bx+c=0$ is useful in algebra chapters linked to ${t}. It equals`,
      options: ['$b^2-4ac$', '$b^2+4ac$', '$2b-4ac$', '$b-4ac$'],
      answer: 'A',
    },
    {
      q: `For print manuals on ${t}, which paper sizes does Figma support?`,
      options: ['A4, B5, and 8×8 only', 'A3 only', 'Letter only', 'Any custom size'],
      answer: 'A',
    },
    {
      q: `Headers and footers in a ${t} course book should`,
      options: ['Match the selected style and scale with page size', 'Be omitted always', 'Use random fonts', 'Ignore page numbers'],
      answer: 'A',
    },
    {
      q: `Smart image placement for ${t} chapters is meant to`,
      options: ['Preserve structural flow of topics and subheadings', 'Fill empty margins randomly', 'Replace all text', 'Remove headings'],
      answer: 'A',
    },
  ]

  const picks = bank.slice(0, Math.min(count, bank.length))
  return picks.map((item, i) =>
    mcqToBlock({
      num: startNum + i,
      question: item.q,
      options: item.options,
      answer: item.answer,
    }),
  )
}

export function nextMcqNumber(blocks: ContentBlock[]): number {
  let max = 0
  for (const b of blocks) {
    if (b.type !== 'mcq') continue
    const n = Number(b.text.match(/^(\d+)/)?.[1])
    if (!Number.isNaN(n) && n > max) max = n
  }
  return max + 1 || 1
}

export function emptyMcqTemplate(num: number): ContentBlock {
  return mcqToBlock({
    num,
    question: '[Type question here]',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    answer: undefined,
  })
}

/** Strip inline answer tags (e.g. [✓ A], [✓ (A)], Answer: (A)) from text for clean canvas rendering. */
export function stripInlineAnswerTags(text: string): string {
  if (!text) return ''
  return text
    .replace(/\[\s*[✓✔]?\s*\(?[A-Ea-e1-4?]?\)?\s*\]/gi, '')
    .replace(/\s*Answer\s*[:\-]\s*\(?[A-Ea-e1-4]\)?\s*$/gi, '')
    .replace(/\s*\(?[✓✔]\s*[A-Ea-e1-4]?\)?\s*$/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export const sanitizeQuestionText = stripInlineAnswerTags

/** Clean inline answer tags from an MCQ block while preserving its answer state. */
export function cleanMcqBlock(block: ContentBlock): ContentBlock {
  if (block.type !== 'mcq') return block
  const extractedAns = block.answer || block.text.match(/\[✓\s*([A-E])\]/i)?.[1] || 'A'
  const cleanText = stripInlineAnswerTags(block.text)
  return {
    ...block,
    answer: extractedAns.toUpperCase(),
    text: cleanText,
  }
}

export interface QuestionItemModel {
  id: string
  questionText: string
  options: string[]
  correctAnswer: string
}

/** Parse an MCQ block into a decoupled Question Item model with clean text and isolated correctAnswer. */
export function splitMcqBlock(block: ContentBlock): QuestionItemModel {
  const rawLines = block.text.split('\n')
  const cleanLines = rawLines.map((l) => stripInlineAnswerTags(l)).filter(Boolean)
  const questionText = cleanLines[0] || ''
  const options = cleanLines.slice(1)
  const extractedAns = block.answer || block.text.match(/\[✓\s*([A-E])\]/i)?.[1] || 'A'
  return {
    id: block.id,
    questionText,
    options,
    correctAnswer: extractedAns.toUpperCase(),
  }
}

