import type { BookPage, ContentBlock } from '../types'
import { uid } from '../types'
import { cleanText } from './bookAi'
import { addLog } from './logger'

/**
 * Syllabus / study-material structurer.
 *
 * Unlike `structureExamText` (which assumes an MCQ question paper) this keeps the
 * original document shape: chapter titles, numbered section headings, paragraphs,
 * bullet / lettered / roman / numbered lists, display formulas and tables.
 * It never invents questions or answers.
 */

const H1 = /^#\s+(.+)$/
const H2 = /^##\s+(.+)$/
const H3 = /^###\s+(.+)$/
const H4PLUS = /^#{4,}\s+(.+)$/
const CHAPTER_TITLE = /^(chapter|topic|unit)\s+[\dIVXLC]+\b/i
// "2.1 Importance of Micro Economics"
const SEC_2 = /^(\d+\.\d+)\.?\s+([A-Za-z].{2,90})$/
// "2.6.1 Characteristics of Human Wants" / "2.6.1. Classification of Goods"
const SEC_3 = /^(\d+\.\d+\.\d+)\.?\s+(.+)$/
// "2.4 Production Possibility Curve" style single-number section on its own line
const SEC_1 = /^(\d+)\.\s+([A-Z][A-Za-z].{3,80})$/

const SYMBOL_BULLET = /^\s*([-*•▪◦‣∙·]|[➢➤►▶‣]|o)\s+\S/
const LETTER_BULLET = /^\s*(\([a-zA-Z]\)|[a-zA-Z][.)])\s+\S/
const ROMAN_BULLET = /^\s*(\((?:i{1,3}|iv|v|vi{1,3}|ix|x)\)|(?:i{1,3}|iv|v|vi{1,3}|ix|x)[.)])\s+\S/i
const NUM_BULLET = /^\s*\d{1,2}[.)]\s+\S/

const DISPLAY_MATH = /^\$\$[\s\S]+\$\$$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_SEP = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/

function headingBlock(level: 1 | 2 | 3, text: string): ContentBlock {
  const clean = text.replace(/^#+\s*/, '').replace(/\s+$/, '').trim()
  return {
    id: uid('blk'),
    type: level === 1 ? 'heading1' : level === 2 ? 'heading2' : 'heading3',
    text: clean,
    align: level === 1 ? 'center' : 'left',
    level,
  }
}

/** Normalise a bullet line: symbol bullets become "• ", ordered markers stay. */
function normalizeBullet(line: string): string {
  const t = line.trim()
  if (SYMBOL_BULLET.test(line)) {
    return `• ${t.replace(/^\s*([-*•▪◦‣∙·]|[➢➤►▶‣]|o)\s+/, '')}`
  }
  return t
}

function isBulletLine(rawLine: string): boolean {
  return (
    SYMBOL_BULLET.test(rawLine) ||
    LETTER_BULLET.test(rawLine) ||
    ROMAN_BULLET.test(rawLine) ||
    NUM_BULLET.test(rawLine)
  )
}

export function structureDocumentText(raw: string): ContentBlock[] {
  const text = cleanText(raw || '').text.replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  const blocks: ContentBlock[] = []

  let para: string[] = []
  let list: string[] = []
  let table: string[] = []

  const flushPara = () => {
    if (para.length) {
      const joined = para.join(' ').replace(/\s{2,}/g, ' ').trim()
      if (joined) blocks.push({ id: uid('blk'), type: 'paragraph', text: joined, align: 'justify' })
      para = []
    }
  }
  const flushList = () => {
    if (list.length) {
      blocks.push({ id: uid('blk'), type: 'list', text: list.join('\n'), align: 'left' })
      list = []
    }
  }
  const flushTable = () => {
    if (table.length) {
      // keep a table only if it has at least a header + one data row
      const rows = table.filter((r) => !TABLE_SEP.test(r))
      if (rows.length >= 1) {
        blocks.push({ id: uid('blk'), type: 'table', text: table.join('\n'), align: 'left' })
      } else {
        para.push(table.join(' '))
        flushPara()
      }
      table = []
    }
  }
  const flushAll = () => {
    flushPara()
    flushList()
    flushTable()
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '')
    const t = line.trim()

    if (!t) {
      flushPara()
      flushList()
      flushTable()
      continue
    }

    // --- tables -------------------------------------------------------------
    if (TABLE_ROW.test(t)) {
      flushPara()
      flushList()
      table.push(t)
      continue
    }
    flushTable()

    // --- headings ----------------------------------------------------------
    let m: RegExpMatchArray | null
    if ((m = t.match(H1))) {
      flushAll()
      blocks.push(headingBlock(1, m[1]))
      continue
    }
    if ((m = t.match(H2))) {
      flushAll()
      blocks.push(headingBlock(2, m[1]))
      continue
    }
    if ((m = t.match(H3)) || (m = t.match(H4PLUS))) {
      flushAll()
      blocks.push(headingBlock(3, m[1]))
      continue
    }
    if ((m = t.match(SEC_3))) {
      flushAll()
      blocks.push(headingBlock(3, `${m[1]} ${m[2].trim()}`))
      continue
    }
    if ((m = t.match(SEC_2))) {
      flushAll()
      blocks.push(headingBlock(2, `${m[1]} ${m[2].trim()}`))
      continue
    }
    if ((m = t.match(SEC_1)) && !isBulletLine(line)) {
      flushAll()
      blocks.push(headingBlock(2, `${m[1]} ${m[2].trim()}`))
      continue
    }
    if (CHAPTER_TITLE.test(t) && t.length < 42) {
      flushAll()
      blocks.push(headingBlock(1, t))
      continue
    }

    // --- display math ----------------------------------------------------
    if (DISPLAY_MATH.test(t)) {
      flushAll()
      blocks.push({ id: uid('blk'), type: 'math', text: t, align: 'center' })
      continue
    }

    // --- lists -----------------------------------------------------------
    if (isBulletLine(line)) {
      flushPara()
      list.push(normalizeBullet(line))
      continue
    }
    // indented wrap of the previous bullet
    if (list.length && /^\s{2,}\S/.test(rawLine)) {
      list[list.length - 1] += ` ${t}`
      continue
    }

    // --- paragraph -----------------------------------------------------
    flushList()
    para.push(t)
  }

  flushAll()

  if (blocks.length === 0) {
    blocks.push({
      id: uid('blk'),
      type: 'paragraph',
      text: text.trim() || '(No text detected)',
      align: 'justify',
    })
  }

  return blocks
}

/** Convert an array of transcribed page texts into structured book pages. */
export function structureDocumentPages(pageTexts: string[], startNumber = 1): BookPage[] {
  const pages: BookPage[] = []
  pageTexts.forEach((txt, i) => {
    const blocks = structureDocumentText(txt)
    pages.push({
      id: uid('page'),
      number: startNumber + i,
      blocks: blocks.length ? blocks : [{ id: uid('blk'), type: 'paragraph', text: '', align: 'justify' }],
    })
  })

  const headings = pages.reduce((n, p) => n + p.blocks.filter((b) => b.type.startsWith('heading')).length, 0)
  const tables = pages.reduce((n, p) => n + p.blocks.filter((b) => b.type === 'table').length, 0)
  addLog({
    category: 'formatting',
    level: 'success',
    title: 'Syllabus Document Structured',
    details: `Built ${pages.length} page(s) · ${headings} headings · ${tables} tables (no MCQ parsing applied).`,
  })

  return pages
}

/** Parse a GitHub-style markdown pipe table into header + rows. */
export function parseMarkdownTable(md: string): { header: string[]; rows: string[][] } {
  const lines = md
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('|'))
  const splitRow = (row: string) =>
    row
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((c) => c.trim())

  const isSep = (l: string) => /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(l)
  const dataLines = lines.filter((l) => !isSep(l))
  if (dataLines.length === 0) return { header: [], rows: [] }

  const header = splitRow(dataLines[0])
  const rows = dataLines.slice(1).map(splitRow)
  return { header, rows }
}
