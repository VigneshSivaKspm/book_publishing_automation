import type { HeaderFooterStyle, PaperSize } from '../types'

export type { PaperSize }
export type OptionCols = '1' | '2'

export interface ParsedQuestion {
  num: number | string
  question: string
  options: string[]
  answer?: string
  kind: 'mcq' | 'fill' | 'marker' | 'heading' | 'math' | 'other'
}

export interface PreviewPage {
  pageNum: number
  questions: ParsedQuestion[]
  overflow: boolean
}

export interface HeaderFooterConfig {
  style: HeaderFooterStyle
  bookTitle: string
  chapterTitle: string
  author: string
}

export const PAPER_META: Record<
  PaperSize,
  { label: string; dims: string; width: number; height: number; qPerPage: number; fontPx: number; marginMm: number }
> = {
  A4: {
    label: 'A4',
    dims: '210 × 297 mm',
    width: 280,
    height: 396,
    qPerPage: 3,
    fontPx: 9,
    marginMm: 18,
  },
  B5: {
    label: 'B5',
    dims: '176 × 250 mm',
    width: 260,
    height: 370,
    qPerPage: 2,
    fontPx: 8.5,
    marginMm: 16,
  },
  '8×8': {
    label: '8×8',
    dims: '203 × 203 mm',
    width: 280,
    height: 280,
    qPerPage: 2,
    fontPx: 8,
    marginMm: 14,
  },
}

export const HF_STYLES: Record<
  HeaderFooterStyle,
  { label: string; headerRule: boolean; footerCenter: boolean; pageFormat: string }
> = {
  classic: { label: 'Classic Serif', headerRule: true, footerCenter: true, pageFormat: '— {n} —' },
  academic: { label: 'Academic', headerRule: true, footerCenter: false, pageFormat: '{n}' },
  modern: { label: 'Modern Clean', headerRule: false, footerCenter: true, pageFormat: '{n}' },
  minimal: { label: 'Minimal', headerRule: false, footerCenter: true, pageFormat: '{n}' },
}

export function formatPageNumber(style: HeaderFooterStyle, n: number): string {
  return HF_STYLES[style].pageFormat.replace('{n}', String(n))
}

export function parseQuestions(raw: string): ParsedQuestion[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const result: ParsedQuestion[] = []
  let current: ParsedQuestion | null = null

  const flush = () => {
    if (current) {
      result.push(current)
      current = null
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      flush()
      result.push({
        num: headingMatch[1].length === 1 ? 'T' : headingMatch[1].length === 2 ? '§' : '·',
        question: headingMatch[2],
        options: [],
        kind: 'heading',
      })
      continue
    }

    const topicMatch = trimmed.match(/^((?:\d+)(?:\.\d+)*)\s+([A-Z].{2,})$/)
    if (topicMatch && !/^\d+\.\s/.test(trimmed)) {
      flush()
      result.push({
        num: topicMatch[1],
        question: topicMatch[2],
        options: [],
        kind: 'heading',
      })
      continue
    }

    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      flush()
      result.push({ num: '∑', question: trimmed, options: [], kind: 'math' })
      continue
    }

    const qMatch = trimmed.match(/^(\d+|\[Q\])\.\s*(.*)$/)
    if (qMatch) {
      flush()
      const answerInline = trimmed.match(/\[✓\s*([A-Ea-e?])\s*\]/)
      const questionText = qMatch[2].replace(/\s*\[✓\s*[A-Ea-e?]\s*\]\s*$/, '').trim()
      current = {
        num: qMatch[1] === '[Q]' ? '?' : Number(qMatch[1]),
        question: questionText,
        options: [],
        answer: answerInline?.[1]?.toUpperCase(),
        kind: questionText.includes('_____') || /fill/i.test(questionText) ? 'fill' : 'mcq',
      }
      continue
    }

    const optMatch = trimmed.match(/^\(([A-Ea-e]|[ivx]+)\)\s*(.*)$/i)
    if (optMatch && current) {
      let text = optMatch[2]
      const ans = text.match(/\[✓\s*([A-Ea-e?])\s*\]/)
      if (ans) {
        current.answer = ans[1].toUpperCase()
        text = text.replace(/\s*\[✓\s*[A-Ea-e?]\s*\]\s*$/, '').trim()
      }
      const letter = optMatch[1].toUpperCase()
      if (/^[A-E]$/i.test(letter)) {
        current.options.push(text)
      } else {
        current.options.push(`(${optMatch[1]}) ${text}`)
      }
      continue
    }

    if (current && !/^\d+\.\s/.test(trimmed)) {
      if (/^[★✓◆→•—]/.test(trimmed)) {
        flush()
        result.push({ num: '·', question: trimmed, options: [], kind: 'marker' })
      } else if (current.question) {
        current.question += ' ' + trimmed
      }
    } else if (!current) {
      result.push({ num: '·', question: trimmed, options: [], kind: 'other' })
    }
  }
  flush()
  return result
}

export function paginateQuestions(
  questions: ParsedQuestion[],
  size: PaperSize,
  cols: OptionCols,
): PreviewPage[] {
  const meta = PAPER_META[size]
  const base = cols === '1' ? Math.max(1, meta.qPerPage - 1) : meta.qPerPage
  const capacity = Math.max(1, base)

  if (questions.length === 0) {
    return [{ pageNum: 1, questions: [], overflow: false }]
  }

  const pages: PreviewPage[] = []
  let i = 0
  let pageNum = 1

  while (i < questions.length) {
    const chunk = questions.slice(i, i + capacity)
    i += capacity
    const heavy = chunk.some(
      (q) =>
        q.question.length > 140 ||
        q.options.length >= 5 ||
        q.kind === 'math' ||
        (size === '8×8' && q.options.length >= 4 && cols === '1'),
    )
    pages.push({
      pageNum: pageNum++,
      questions: chunk,
      overflow: heavy && chunk.length >= capacity,
    })
  }

  return pages
}

export function nextQuestionNumber(content: string): number {
  const nums = [...content.matchAll(/^(\d+)\./gm)].map((m) => Number(m[1]))
  if (nums.length === 0) return 1
  return Math.max(...nums) + 1
}

export function templatesFor(id: string, startNum: number): string {
  const n = startNum
  if (id === 'mcq4')
    return `\n${n}. [Type question here]\n(A) Option A\n(B) Option B\n(C) Option C\n(D) Option D [✓ ?]\n`
  if (id === 'tf') return `\n${n}. Statement: _____\n(A) True\n(B) False [✓ ?]\n`
  if (id === 'mcq5')
    return `\n${n}. [Type question here]\n(A) \n(B) \n(C) \n(D) \n(E) [✓ ?]\n`
  if (id === 'fill') return `\n${n}. Fill in the blank: _____________ is known as _____.\n`
  if (id === 'match')
    return `\n${n}. Match List-I with List-II:\n(A) Item 1 — (i) Desc A\n(B) Item 2 — (ii) Desc B\n(C) Item 3 — (iii) Desc C\n(D) Item 4 — (iv) Desc D [✓ ?]\n`
  if (id === 'assert')
    return `\n${n}. Assertion (A): _____\nReason (R): _____\n(A) Both A and R true; R explains A\n(B) Both A and R true; R does not explain A\n(C) A true, R false\n(D) A false, R true [✓ ?]\n`
  if (id === 'math')
    return `\n${n}. Solve for $x$:\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n(A) Discriminant method\n(B) Factorisation\n(C) Completing the square\n(D) All of the above [✓ D]\n`
  if (id === 'topic') return `\n# Topic ${n}\n## ${n}.1 Introduction\n## ${n}.2 Core Concepts\n## ${n}.3 Worked Examples\n`
  return `\n${n}. [Type question here]\n(A) \n(B) \n(C) \n(D) [✓ ?]\n`
}

export function renumberContent(content: string, start = 1): string {
  let n = start
  return content
    .split('\n')
    .map((line) => {
      if (/^\d+\.\s/.test(line) || /^\[Q\]\.\s/.test(line)) {
        const rest = line.replace(/^(\d+|\[Q\])\.\s*/, '')
        return `${n++}. ${rest}`
      }
      return line
    })
    .join('\n')
}

export function applyOptionFormat(
  content: string,
  format: 'abcd' | 'abcde' | 'roman' | 'numeric' | 'inline',
): string {
  const lines = content.split('\n')
  const out: string[] = []
  let optIdx = 0

  for (const line of lines) {
    const m = line.match(/^\(([A-Ea-e])\)\s*(.*)$/)
    if (m) {
      const text = m[2].replace(/\s*\[✓\s*[A-Ea-e?]\s*\]\s*$/, '').trim()
      const ans = line.match(/\[✓\s*([A-Ea-e?])\s*\]/)
      const ansSuffix = ans ? ` [✓ ${ans[1].toUpperCase()}]` : ''

      if (format === 'inline') {
        out.push(line)
        optIdx++
        continue
      }

      let label = ''
      if (format === 'abcd' || format === 'abcde') {
        label = `(${String.fromCharCode(65 + (optIdx % (format === 'abcde' ? 5 : 4)))})`
      } else if (format === 'roman') {
        const romans = ['i', 'ii', 'iii', 'iv', 'v']
        label = `(${romans[optIdx % 5]})`
      } else if (format === 'numeric') {
        label = `${(optIdx % 4) + 1}.`
      }
      out.push(`${label} ${text}${ansSuffix}`)
      optIdx++
      if (
        (format === 'abcd' && optIdx % 4 === 0) ||
        (format === 'abcde' && optIdx % 5 === 0) ||
        (format === 'roman' && optIdx % 4 === 0) ||
        (format === 'numeric' && optIdx % 4 === 0)
      ) {
        optIdx = 0
      }
    } else {
      if (/^\d+\./.test(line) || /^\[Q\]\./.test(line)) optIdx = 0
      out.push(line)
    }
  }

  if (format !== 'inline') return out.join('\n')

  const joined: string[] = []
  let buffer: string[] = []
  const flushOpts = () => {
    if (buffer.length) {
      joined.push(buffer.join('  '))
      buffer = []
    }
  }
  for (const line of out) {
    if (/^\([A-Ea-e]\)\s/.test(line)) {
      buffer.push(line.replace(/\s*\[✓\s*[A-Ea-e?]\s*\]\s*$/, '').trim())
      const ans = line.match(/\[✓\s*([A-Ea-e?])\s*\]/)
      if (ans) {
        flushOpts()
        joined[joined.length - 1] += ` [✓ ${ans[1].toUpperCase()}]`
      }
    } else {
      flushOpts()
      joined.push(line)
    }
  }
  flushOpts()
  return joined.join('\n')
}

export function structurePaste(raw: string): string {
  return raw
    .replace(/\t+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/^([A-Ea-e])[\.\)]\s+/gm, '($1) ')
    .replace(/^([A-Ea-e])\s+/gm, '($1) ')
    .trim()
}
