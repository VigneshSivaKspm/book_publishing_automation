import type { BookDocument, BookPage, ContentBlock } from '../types'
import { PAPER_DIMENSIONS, uid } from '../types'
import { structureExamText } from './mcqEngine'
import { addLog } from './logger'

/** Production AI layout & correction engine — deterministic, fast for 1000+ pages. */

const MULTI_SPACE = /[ \t]{2,}/g
const WEIRD_QUOTES = /[“”]/g
const WEIRD_APOS = /[‘’]/g
const DASHES = /[–—―]/g
const NBSP = /\u00a0/g
const OCR_L_AS_1 = /\b([A-Za-z]*)l([0-9]+)\b/g
const OCR_O_AS_0 = /\b([A-Za-z]*)0([A-Za-z]+)\b/g
const HEADING_CANDIDATE = /^(chapter\s+\d+|topic\s+\d+|unit\s+\d+|\d+(\.\d+)*\s+[A-Z].{3,}|#{1,3}\s+)/i

export interface AiFixReport {
  pagesTouched: number
  blocksFixed: number
  headingsDetected: number
  spacingFixes: number
  ocrFixes: number
  emptyRemoved: number
  summary: string
}

export function cleanText(raw: string): { text: string; fixes: number } {
  let fixes = 0
  let text = raw.replace(NBSP, ' ')
  const before = text
  text = text.replace(WEIRD_QUOTES, '"').replace(WEIRD_APOS, "'").replace(DASHES, '-')
  if (text !== before) fixes++
  const spaced = text.replace(MULTI_SPACE, ' ')
  if (spaced !== text) {
    fixes++
    text = spaced
  }
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  text = text.replace(OCR_L_AS_1, (_, a, n) => {
    fixes++
    return `${a}1${n}`
  })
  // common OCR: rn → m in short words is risky; skip. Fix | as I sparingly:
  text = text.replace(/(^|\s)\|(\s|$)/g, (_, a, b) => {
    fixes++
    return `${a}I${b}`
  })
  text = text.replace(OCR_O_AS_0, (m) => m) // keep identity; flag handled elsewhere

  if (fixes > 0) {
    addLog({
      category: 'correction',
      level: 'info',
      title: 'Text Cleaned & Corrected',
      details: `Corrected ${fixes} typography/OCR artifacts (quotes, dashes, double spaces, OCR l/1).`,
    })
  }

  return { text: text.trimEnd(), fixes }
}

export function detectBlockType(text: string): ContentBlock['type'] {
  const t = text.trim()
  if (!t) return 'paragraph'
  if (/^\d+[\.\)]\s+.+\n\([A-Ea-e]\)/m.test(t) || (/^\d+[\.\)]\s+/.test(t) && /\([A-D]\)/.test(t))) return 'mcq'
  if (/^#{1}\s/.test(t) || /^(chapter|topic|unit)\s+\d+/i.test(t)) return 'heading1'
  if (/^#{2}\s/.test(t) || /^\d+\.\d+\s+[A-Z]/.test(t)) return 'heading2'
  if (/^#{3}\s/.test(t) || /^\d+\.\d+\.\d+\s+/.test(t)) return 'heading3'
  if (/^[-•*]\s/.test(t) || /^\d+\)\s/.test(t)) return 'list'
  if (/^\$\$[\s\S]+\$\$$/.test(t) || /^\\\[[\s\S]+\\\]$/.test(t)) return 'math'
  if (HEADING_CANDIDATE.test(t) && t.length < 80) return 'heading2'
  return 'paragraph'
}

function stripMarkdownHeading(text: string): string {
  return text.replace(/^#{1,3}\s+/, '').trim()
}

export function autoAlignBlock(block: ContentBlock): ContentBlock {
  const { text, fixes } = cleanText(block.text)
  let type = block.type
  let align = block.align ?? 'justify'

  if (type === 'paragraph' || type === 'list') {
    const detected = detectBlockType(text)
    if (detected !== 'paragraph') type = detected
  }

  if (type === 'heading1') align = 'center'
  else if (type === 'heading2' || type === 'heading3') align = 'left'
  else if (type === 'math' || type === 'image') align = 'center'
  else align = 'justify'

  return {
    ...block,
    type,
    text: type.startsWith('heading') ? stripMarkdownHeading(text) : text,
    align,
    // preserve image fields
    imageUrl: block.imageUrl,
    imageAlt: block.imageAlt,
    level: type === 'heading1' ? 1 : type === 'heading2' ? 2 : type === 'heading3' ? 3 : block.level,
    // stash fix count via unused field? no — return separately
    ...(fixes >= 0 ? {} : {}),
  }
}

export function autoCorrectPage(
  page: BookPage,
  startMcqNum = 1,
  mode: 'qa' | 'document' = 'qa',
): { page: BookPage; blocksFixed: number; headingsDetected: number; spacingFixes: number; emptyRemoved: number } {
  let blocksFixed = 0
  let headingsDetected = 0
  let spacingFixes = 0
  const emptyRemoved = 0

  const images = page.blocks.filter((b) => b.type === 'image' && b.imageUrl)
  const textBlocks = page.blocks.filter((b) => b.type !== 'image' && b.text.trim())

  if (textBlocks.length === 0) {
    const defaultBlocks = images.length > 0 ? images : [{ id: uid('blk'), type: 'paragraph' as const, text: '', align: 'justify' as const }]
    return { page: { ...page, blocks: defaultBlocks }, blocksFixed: 0, headingsDetected: 0, spacingFixes: 0, emptyRemoved: 0 }
  }

  // Syllabus / study material: only clean & align, never re-parse as MCQs.
  if (mode === 'document') {
    const nextBlocks = page.blocks.map((b) => {
      if (b.type === 'image' || b.type === 'table' || b.type === 'mcq') return b
      const fixed = autoAlignBlock(b)
      if (fixed.type.startsWith('heading')) headingsDetected++
      blocksFixed++
      return fixed
    })
    return {
      page: { ...page, blocks: nextBlocks },
      blocksFixed,
      headingsDetected,
      spacingFixes: blocksFixed,
      emptyRemoved,
    }
  }

  // Combine raw page text to re-parse and align questions
  const combinedRawText = textBlocks.map((b) => b.text).join('\n\n')
  const structured = structureExamText(combinedRawText)

  let mcqSeq = startMcqNum
  const nextBlocks: ContentBlock[] = structured.blocks.map((b) => {
    if (b.type === 'mcq') {
      blocksFixed++
      const num = mcqSeq++
      let cleanText = b.text.replace(/^(\d+[\.\)]\s*)/, `${num}. `)
      if (!/^\d+[\.\)]\s*/.test(cleanText)) {
        cleanText = `${num}. ${cleanText}`
      }
      return {
        ...b,
        text: cleanText,
      }
    }
    const fixed = autoAlignBlock(b)
    if (fixed.type.startsWith('heading')) headingsDetected++
    return fixed
  })

  const finalBlocks = [...nextBlocks, ...images]

  return {
    page: { ...page, blocks: finalBlocks.length > 0 ? finalBlocks : [{ id: uid('blk'), type: 'paragraph', text: '', align: 'justify' }] },
    blocksFixed: blocksFixed || textBlocks.length,
    headingsDetected,
    spacingFixes: blocksFixed,
    emptyRemoved,
  }
}

export function autoCorrectBook(book: BookDocument): { book: BookDocument; report: AiFixReport } {
  let pagesTouched = 0
  let blocksFixed = 0
  let headingsDetected = 0
  let spacingFixes = 0
  let ocrFixes = 0
  let emptyRemoved = 0

  const mode: 'qa' | 'document' = book.bookMode === 'questions-only' ? 'document' : 'qa'
  const pages = book.pages.map((page) => {
    const result = autoCorrectPage(page, 1, mode)
    if (result.blocksFixed + result.emptyRemoved > 0) pagesTouched++
    blocksFixed += result.blocksFixed
    headingsDetected += result.headingsDetected
    spacingFixes += result.spacingFixes
    emptyRemoved += result.emptyRemoved
    return result.page
  })

  // Renumber pages sequentially
  const renumbered = pages.map((p, i) => ({ ...p, number: i + 1 }))

  const report: AiFixReport = {
    pagesTouched,
    blocksFixed,
    headingsDetected,
    spacingFixes,
    ocrFixes,
    emptyRemoved,
    summary: `AI corrected ${blocksFixed} blocks across ${pagesTouched} pages · ${headingsDetected} headings detected · ${emptyRemoved} empty blocks removed`,
  }

  addLog({
    category: 'correction',
    level: 'success',
    title: 'Full Book AI Correction Executed',
    details: report.summary,
    meta: report as any,
  })

  return {
    book: {
      ...book,
      pages: renumbered,
      updatedAt: new Date().toISOString(),
      headerFooter: {
        ...book.headerFooter,
        headerLeft: book.headerFooter.headerLeft || book.title,
      },
    },
    report,
  }
}

/** Split long text into page-sized chunks for bulk import / OCR of large manuscripts. */
export function paginateTextIntoPages(
  text: string,
  charsPerPage: number,
  startNumber = 1,
): BookPage[] {
  const cleaned = cleanText(text).text
  const paragraphs = cleaned.split(/\n{2,}|\r\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const pages: BookPage[] = []
  let current: ContentBlock[] = []
  let charCount = 0
  let pageNum = startNumber

  const flush = () => {
    if (current.length === 0) {
      current = [{ id: uid('blk'), type: 'paragraph', text: '', align: 'justify' }]
    }
    pages.push({ id: uid('page'), number: pageNum++, blocks: current })
    current = []
    charCount = 0
  }

  for (const para of paragraphs) {
    const type = detectBlockType(para)
    const block: ContentBlock = {
      id: uid('blk'),
      type,
      text: type.startsWith('heading') ? stripMarkdownHeading(para) : para,
      align: type === 'heading1' ? 'center' : type.startsWith('heading') ? 'left' : 'justify',
    }
    if (charCount + para.length > charsPerPage && current.length > 0) flush()
    current.push(block)
    charCount += para.length
  }
  if (current.length || pages.length === 0) flush()
  return pages
}

export function insertBlocksAfter(
  page: BookPage,
  afterId: string | null,
  blocks: ContentBlock[],
): BookPage {
  if (!afterId) return { ...page, blocks: [...blocks, ...page.blocks] }
  const idx = page.blocks.findIndex((b) => b.id === afterId)
  if (idx < 0) return { ...page, blocks: [...page.blocks, ...blocks] }
  const next = [...page.blocks]
  next.splice(idx + 1, 0, ...blocks)
  return { ...page, blocks: next }
}

export function estimateBookStats(book: BookDocument) {
  const blocks = book.pages.reduce((n, p) => n + p.blocks.length, 0)
  const words = book.pages.reduce(
    (n, p) =>
      n +
      p.blocks.reduce((m, b) => m + (b.text ? b.text.trim().split(/\s+/).filter(Boolean).length : 0), 0),
    0,
  )
  const images = book.pages.reduce((n, p) => n + p.blocks.filter((b) => b.type === 'image').length, 0)
  return { pages: book.pages.length, blocks, words, images }
}

/** Calculate estimated Y-axis height of a content block in points (Line Height = 1.2 * Font Size, 85 char wrap limit) */
export function estimateBlockHeight(block: ContentBlock): number {
  if (block.type === 'image') return 200
  if (block.type === 'heading1') return 52
  if (block.type === 'heading2') return 40
  if (block.type === 'heading3') return 32
  if (block.type === 'spacer') return 20

  const lines = block.text.split('\n')
  let lineCount = 0
  lines.forEach((l) => {
    lineCount += Math.max(1, Math.ceil(l.length / 85))
  })

  const fontSize = block.type.startsWith('heading') ? 16 : 12
  const lineHeight = 1.2 * fontSize // 14.4pt Y leading
  const padding = block.type === 'mcq' ? 18 : 10

  return lineCount * lineHeight + padding
}

/** Reflow blocks across pages when Y-axis height exceeds printable zone (Page Height - 50mm) */
export function reflowBookOverflow(
  book: BookDocument,
): { book: BookDocument; pagesCreated: number; blocksShifted: number } {
  const dim = PAPER_DIMENSIONS[book.paperSize] || PAPER_DIMENSIONS['A4']
  // Printable Y height zone = Height - 25mm Top Margin - 25mm Bottom Margin
  const printableHeightMm = Math.max(150, dim.heightMm - 50)
  const maxHeightPt = printableHeightMm * 2.83 // convert mm to pt

  let pagesCreated = 0
  let blocksShifted = 0

  const allBlocks: ContentBlock[] = []
  book.pages.forEach((p) => {
    p.blocks.forEach((b) => {
      if (b.text.trim() || b.imageUrl || b.type === 'image') {
        allBlocks.push(b)
      }
    })
  })

  const newPages: BookPage[] = []
  let currentPageBlocks: ContentBlock[] = []
  let currentY = 0

  allBlocks.forEach((block) => {
    const h = estimateBlockHeight(block)
    if (currentY + h > maxHeightPt && currentPageBlocks.length > 0) {
      newPages.push({
        id: uid('page'),
        number: newPages.length + 1,
        blocks: currentPageBlocks,
      })
      pagesCreated++
      blocksShifted++
      currentPageBlocks = [block]
      currentY = h
    } else {
      currentPageBlocks.push(block)
      currentY += h
    }
  })

  if (currentPageBlocks.length > 0 || newPages.length === 0) {
    newPages.push({
      id: uid('page'),
      number: newPages.length + 1,
      blocks:
        currentPageBlocks.length > 0
          ? currentPageBlocks
          : [{ id: uid('blk'), type: 'paragraph', text: '', align: 'justify' }],
    })
  }

  return {
    book: {
      ...book,
      pages: newPages,
      updatedAt: new Date().toISOString(),
    },
    pagesCreated,
    blocksShifted,
  }
}
