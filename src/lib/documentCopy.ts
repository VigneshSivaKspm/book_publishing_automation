import type { BookDocument, BookPage } from '../types'

/** Extract clean text for Header section */
export function extractHeaderText(book: BookDocument): string {
  const hf = book.headerFooter
  const lines: string[] = []

  lines.push(`========================================`)
  lines.push(`HEADER METADATA`)
  lines.push(`Document Title: ${book.title}`)
  if (book.subtitle) lines.push(`Subtitle: ${book.subtitle}`)
  lines.push(`Chapter Label & No: ${hf.chapterLabel || 'Chapter'} ${hf.chapterNumber || '02'}`)
  lines.push(`Chapter Title: ${hf.chapterTitle || book.title}`)
  lines.push(`Institution / Study Circle: ${hf.middleBoxText || 'Karthikeyan Analysis Study Circle'}`)
  lines.push(`Middle Subject Title: ${hf.middleRightText || hf.chapterTitle || book.title}`)
  lines.push(`========================================`)

  return lines.join('\n')
}

/** Extract clean text for Body Content section (all pages or single page) */
export function extractBodyContentText(pages: BookPage[], options?: { cleanAnswers?: boolean }): string {
  const pageTexts: string[] = []

  pages.forEach((page, pageIdx) => {
    const blockTexts: string[] = []
    page.blocks.forEach((b) => {
      if (b.type === 'heading1' || b.type === 'heading2' || b.type === 'heading3') {
        blockTexts.push(`\n### ${b.text}\n`)
      } else if (b.type === 'mcq') {
        let txt = b.text
        if (options?.cleanAnswers) {
          txt = txt.replace(/\[✓\s*[A-E]?\]/gi, '').trim()
        }
        blockTexts.push(txt)
      } else if (b.type === 'math') {
        blockTexts.push(`$$${b.text.replace(/^\$\$|\$\$$/g, '')}$$`)
      } else if (b.type === 'list') {
        blockTexts.push(`• ${b.text}`)
      } else if (b.type === 'paragraph') {
        if (b.text.trim()) blockTexts.push(b.text)
      }
    })
    pageTexts.push(`--- Page ${pageIdx + 1} ---\n` + blockTexts.join('\n\n'))
  })

  return pageTexts.join('\n\n')
}

/** Extract clean text for Footer & Answer Key section */
export function extractFooterText(book: BookDocument): string {
  const hf = book.headerFooter
  const lines: string[] = []

  lines.push(`========================================`)
  lines.push(`FOOTER & ANSWER KEY`)
  lines.push(`Brand Footer: ${hf.footerLeft || 'Karthikeyan Analysis Learning Resources'}`)

  const allMcqs: { num: string; answer: string }[] = []
  let mcqSeq = 0
  book.pages.forEach((p) => {
    p.blocks.forEach((b) => {
      if (b.type === 'mcq') {
        mcqSeq++
        const num = b.text.match(/^(\d+)/)?.[1] || String(mcqSeq)
        const ans = b.answer || b.text.match(/\[✓\s*([A-E])\]/i)?.[1] || 'A'
        allMcqs.push({ num, answer: ans.toUpperCase() })
      }
    })
  })

  if (allMcqs.length > 0) {
    lines.push(`\nANSWER KEY (${allMcqs.length} Questions):`)
    const grid: string[] = []
    allMcqs.forEach((m) => grid.push(`${m.num}. (${m.answer})`))
    lines.push(grid.join('   '))
  }

  lines.push(`========================================`)
  return lines.join('\n')
}

/** Extract Full Document string (Header + Body + Footer/Answer Key) */
export function extractFullDocumentText(book: BookDocument): string {
  const header = extractHeaderText(book)
  const body = extractBodyContentText(book.pages)
  const footer = extractFooterText(book)

  return `${header}\n\n${body}\n\n${footer}`
}

/** Extract clean text from an active page container DOM node, stripping headers, footers, UI controls & floating toolbars */
export function extractActivePageDomText(containerEl?: HTMLElement | null): string {
  const target =
    containerEl ||
    (document.querySelector('#page-body-content, .page-body-container, .page-canvas.active') as HTMLElement | null)
  if (!target) return ''

  const clone = target.cloneNode(true) as HTMLElement
  const removeSelectors = [
    '.document-header',
    '.document-footer',
    '.no-copy',
    '.select-none',
    'button',
    'select',
    'input',
    'textarea',
    '[role="button"]',
    '.placement-tips',
    '.floating-toolbar',
    '.formatting-bar',
  ]
  clone.querySelectorAll(removeSelectors.join(',')).forEach((el) => el.remove())

  let text = clone.innerText || clone.textContent || ''
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text
}

/** Helper to copy text to clipboard with browser fallback */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback below */
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}
