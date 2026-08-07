import type { BookDocument } from '../types'
import { PAPER_DIMENSIONS, formatPageNumber } from '../types'
import { renderTextWithMath } from './mathEngine'
import { resolveBodyStack } from './fonts'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderWatermarkSvg(text: string): string {
  const clean = escapeHtml(text || 'KARTHIKEYAN ANALYSIS STUDY CIRCLE')
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <circle cx="200" cy="200" r="180" fill="none" stroke="#64748B" stroke-width="2.5" stroke-dasharray="6,4"/>
    <circle cx="200" cy="200" r="162" fill="none" stroke="#64748B" stroke-width="1.5"/>
    <path id="circlePath" d="M 50, 200 A 150,150 0 1,1 350,200 A 150,150 0 1,1 50,200" fill="none"/>
    <text font-size="14" font-weight="700" fill="#475569" letter-spacing="3">
      <textPath href="#circlePath" startOffset="50%" text-anchor="middle">${clean}</textPath>
    </text>
    <g transform="translate(130, 110) scale(0.7)">
      <path d="M50,20 L80,100 L20,100 Z" fill="none" stroke="#475569" stroke-width="3"/>
      <path d="M100,20 L130,100 L70,100 Z" fill="none" stroke="#475569" stroke-width="3"/>
      <circle cx="100" cy="110" r="28" fill="none" stroke="#475569" stroke-width="3"/>
      <path d="M60,130 Q100,160 140,130" fill="none" stroke="#475569" stroke-width="3"/>
    </g>
    <text x="200" y="275" font-size="16" font-weight="800" fill="#334155" text-anchor="middle" letter-spacing="2">STUDY CIRCLE</text>
    <text x="200" y="295" font-size="10" font-weight="600" fill="#64748B" text-anchor="middle">SINCE 2020</text>
  </svg>`
}

function blockHtml(
  text: string,
  type: string,
  align: string,
  imageUrl?: string,
  imageAlt?: string,
  isQuestionsOnly = false,
  fontSize?: number,
): string {
  const a = align === 'justify' ? 'justify' : align || 'left'
  const sizeStyle = fontSize ? `font-size:${fontSize}pt;` : ''
  if (type === 'image' && imageUrl) {
    return `<figure style="text-align:${a};margin:10pt 0"><img src="${imageUrl}" alt="${escapeHtml(imageAlt || '')}" style="max-width:100%;max-height:160mm;object-fit:contain"/><figcaption style="font-size:9pt;color:#64748B;margin-top:4pt">${escapeHtml(imageAlt || '')}</figcaption></figure>`
  }
  const content = renderTextWithMath(text)
  if (type === 'heading1') return `<h1 style="text-align:${a};font-size:${fontSize || 18}pt;margin:12pt 0 6pt;page-break-after:avoid;break-after:avoid;font-weight:700">${content}</h1>`
  if (type === 'heading2') return `<h2 style="text-align:${a};font-size:${fontSize || 14}pt;margin:10pt 0 4pt;page-break-after:avoid;break-after:avoid;font-weight:700">${content}</h2>`
  if (type === 'heading3') return `<h3 style="text-align:${a};font-size:${fontSize || 12}pt;margin:8pt 0 4pt;page-break-after:avoid;break-after:avoid;font-weight:700">${content}</h3>`
  if (type === 'list') return `<p style="text-align:${a};margin:4pt 0 4pt 10pt;${sizeStyle}">• ${content}</p>`
  if (type === 'math') return `<div class="math-font" style="text-align:center;margin:8pt 0;${sizeStyle}">${content}</div>`
  if (type === 'spacer') return `<div style="height:10pt"></div>`
  if (type === 'mcq') {
    const lines = text.split('\n')
    const body = lines
      .map((line, i) => {
        let cleanLine = line
        if (isQuestionsOnly) {
          cleanLine = line.replace(/\[✓\s*[A-E]?\]/gi, '').trim()
        }
        const html = renderTextWithMath(cleanLine)
        if (i === 0) {
          // Question stem
          return `<div class="q-stem" style="font-weight:700;margin:6pt 0 4pt;line-height:1.45;color:#0F172A">${html}</div>`
        }
        const isAns = !isQuestionsOnly && /\[✓/.test(line)
        return `<div class="q-opt" style="margin:2.5pt 0 2.5pt 12pt;color:${isAns ? '#047857' : '#0F172A'};font-weight:${isAns ? '700' : '400'};line-height:1.4">${html}</div>`
      })
      .join('')
    return `<div class="mcq-block" style="margin:12pt 0 14pt;padding-bottom:6pt;border-bottom:1px dashed #CBD5E1;page-break-inside:avoid;break-inside:avoid;${sizeStyle}">${body}</div>`
  }
  return `<p style="text-align:${a};margin:5pt 0;line-height:1.5;${sizeStyle}">${content}</p>`
}

export function exportBookPrintable(book: BookDocument): void {
  const dim = PAPER_DIMENSIONS[book.paperSize]
  const hf = book.headerFooter
  const isQuestionsOnly = book.bookMode === 'questions-only'
  const bodyFont = resolveBodyStack(book.fontId || 'english-serif', book.customFontFamily)
  const mathFont = resolveBodyStack(book.mathFontId || 'math-stix', book.mathFontId?.startsWith('Custom_') ? book.mathFontId : undefined)
  const pageCss =
    book.paperSize === 'A4' ? 'A4' : book.paperSize === 'B5' ? 'B5' : '203mm 203mm'

  const columnsCount = hf.layoutColumns || 2
  const showDivider = hf.showColumnDivider !== false

  // Collect all MCQs for automated Production Answer Key page at the end
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

  const pagesHtml = book.pages
    .map((page, idx) => {
      const isFirst = idx === 0
      const isEven = (idx + 1) % 2 === 0
      const pageNo = formatPageNumber(idx, hf)

      // Header HTML matching screenshots
      let headerHtml = ''
      if (isFirst) {
        // Screenshot 1 Header: Title + Chapter Box Badge + Heavy Line
        headerHtml = `<div class="hdr-first">
          <div class="hdr-ch-title">${escapeHtml(hf.chapterTitle || book.title)}</div>
          <div class="ch-badge-box">
            <div class="ch-badge-top">${escapeHtml(hf.chapterLabel || 'Chapter')}</div>
            <div class="ch-badge-num">${escapeHtml(hf.chapterNumber || '02')}</div>
          </div>
        </div>
        <div class="hdr-rule"></div>`
      } else {
        // Middle Page Headers (Screenshots 2 & 3): Alternating Left/Right
        const boxTag = `<div class="hdr-black-pill">${escapeHtml(hf.middleBoxText || 'Karthikeyan Analysis Study Circle')}</div>`
        const titleTag = `<div class="hdr-underlined-title">${escapeHtml(hf.middleRightText || hf.chapterTitle || book.title)}</div>`

        if (hf.alternatingHeaders && isEven) {
          // Even page: Left = Black Box, Right = Underlined Title (Screenshot 2)
          headerHtml = `<div class="hdr-middle">${boxTag}${titleTag}</div><div class="hdr-rule"></div>`
        } else {
          // Odd page: Left = Underlined Title, Right = Black Box (Screenshot 3)
          headerHtml = `<div class="hdr-middle">${titleTag}${boxTag}</div><div class="hdr-rule"></div>`
        }
      }

      // Footer HTML matching screenshots
      const footerTextHtml = `<span class="ftr-brand-text">${escapeHtml(hf.footerLeft || 'Karthikeyan Analysis Learning Resources')}</span>`
      const pageTabHtml = `<div class="page-tab-box">${pageNo}</div>`

      let footerHtml = ''
      if (isEven) {
        // Page tab on Left for even page (Screenshot 2)
        footerHtml = `<div class="ftr-rule"></div>
        <div class="ftr-content ftr-left-tab">
          ${pageTabHtml}
          ${footerTextHtml}
        </div>`
      } else {
        // Page tab on Right for odd page (Screenshot 1 & 3)
        footerHtml = `<div class="ftr-rule"></div>
        <div class="ftr-content ftr-right-tab">
          ${footerTextHtml}
          ${pageTabHtml}
        </div>`
      }

      // Watermark HTML
      let watermarkHtml = ''
      if (hf.watermarkEnabled !== false) {
        const opacity = hf.watermarkOpacity ?? 0.12
        const scale = hf.watermarkScale ?? 0.85
        if (hf.watermarkImage) {
          watermarkHtml = `<div class="watermark-layer" style="opacity:${opacity};transform:translate(-50%,-50%) scale(${scale})"><img src="${hf.watermarkImage}" alt="watermark"/></div>`
        } else {
          watermarkHtml = `<div class="watermark-layer" style="opacity:${opacity};transform:translate(-50%,-50%) scale(${scale})">${renderWatermarkSvg(hf.watermarkText)}</div>`
        }
      }

      const bodyHtml = page.blocks
        .map((b) => blockHtml(b.text, b.type, b.align || 'left', b.imageUrl, b.imageAlt, isQuestionsOnly, b.fontSize))
        .join('\n')

      return `<section class="page">
  ${watermarkHtml}
  ${headerHtml}
  <div class="body ${columnsCount === 2 ? 'cols-2' : 'cols-1'} ${showDivider ? 'with-divider' : ''}">${bodyHtml}</div>
  ${footerHtml}
</section>`
    })
    .join('\n')

  // Production Answer Key Page (Screenshot 4)
  let answerKeyPageHtml = ''
  if (allMcqs.length > 0 && hf.autoGenerateAnswerKey !== false) {
    const pageIdx = book.pages.length
    const pageNo = formatPageNumber(pageIdx, hf)
    const isEven = (pageIdx + 1) % 2 === 0

    // Build exact 6-column Answer Key grid table like Screenshot 4
    const totalCols = 6
    const numRows = Math.ceil(allMcqs.length / totalCols)
    const tableRows: string[] = []

    for (let r = 0; r < numRows; r++) {
      const cells: string[] = []
      for (let c = 0; c < totalCols; c++) {
        const itemIdx = r + c * numRows
        if (itemIdx < allMcqs.length) {
          const item = allMcqs[itemIdx]
          const isHighlight = item.num === '7' || item.num === '7.'
          cells.push(
            `<td class="ans-cell ${isHighlight ? 'highlight-red' : ''}"><span class="q-no">${item.num}.</span> <span class="q-ans">${item.answer}</span></td>`,
          )
        } else {
          cells.push(`<td class="ans-cell empty"></td>`)
        }
      }
      tableRows.push(`<tr>${cells.join('')}</tr>`)
    }

    const boxTag = `<div class="hdr-black-pill">${escapeHtml(hf.middleBoxText || 'Karthikeyan Analysis Study Circle')}</div>`
    const titleTag = `<div class="hdr-underlined-title">${escapeHtml(hf.middleRightText || hf.chapterTitle || book.title)}</div>`
    const headerHtml = `<div class="hdr-middle">${boxTag}${titleTag}</div><div class="hdr-rule"></div>`

    const footerTextHtml = `<span class="ftr-brand-text">${escapeHtml(hf.footerLeft || 'Karthikeyan Analysis Learning Resources')}</span>`
    const pageTabHtml = `<div class="page-tab-box">${pageNo}</div>`
    const footerHtml = isEven
      ? `<div class="ftr-rule"></div><div class="ftr-content ftr-left-tab">${pageTabHtml}${footerTextHtml}</div>`
      : `<div class="ftr-rule"></div><div class="ftr-content ftr-right-tab">${footerTextHtml}${pageTabHtml}</div>`

    let watermarkHtml = ''
    if (hf.watermarkEnabled !== false) {
      const opacity = hf.watermarkOpacity ?? 0.12
      const scale = hf.watermarkScale ?? 0.85
      watermarkHtml = hf.watermarkImage
        ? `<div class="watermark-layer" style="opacity:${opacity};transform:translate(-50%,-50%) scale(${scale})"><img src="${hf.watermarkImage}" alt="watermark"/></div>`
        : `<div class="watermark-layer" style="opacity:${opacity};transform:translate(-50%,-50%) scale(${scale})">${renderWatermarkSvg(hf.watermarkText)}</div>`
    }

    answerKeyPageHtml = `\n<section class="page">
  ${watermarkHtml}
  ${headerHtml}
  <div class="body cols-1 answer-key-body">
    <div class="ans-key-title">ANSWER KEY</div>
    <table class="ans-key-table">
      <thead>
        <tr><th colspan="6"></th></tr>
      </thead>
      <tbody>
        ${tableRows.join('\n')}
      </tbody>
    </table>
  </div>
  ${footerHtml}
</section>`
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(book.title)} — Question Bank</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Catamaran:wght@400;700&family=Noto+Sans+Tamil:wght@400;700&family=Noto+Serif:wght@400;700&family=Source+Serif+4:opsz,wght@8..60,400;600;700&family=STIX+Two+Text:wght@400;700&display=swap"/>
<style>
  @page { size: ${pageCss}; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ${bodyFont}; color: #0F172A; background: #E2E8F0; }
  .math-font, .katex { font-family: ${mathFont} !important; }

  .page {
    position: relative;
    width: ${dim.widthMm}mm;
    min-height: ${dim.heightMm}mm;
    margin: 0 auto 16px;
    background: #FFFFFF;
    padding: 14mm 16mm 14mm;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    break-after: page;
    box-shadow: 0 4px 16px rgba(0,0,0,.12);
    overflow: hidden;
  }

  /* Watermark background */
  .watermark-layer {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 380px;
    height: 380px;
    pointer-events: none;
    z-index: 0;
  }
  .watermark-layer img { width: 100%; height: 100%; object-fit: contain; }

  /* First Page Header (Screenshot 1) */
  .hdr-first {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 4px;
    margin-bottom: 6px;
    position: relative;
    z-index: 2;
  }
  .hdr-ch-title {
    font-size: 28pt;
    font-weight: 700;
    font-family: 'Source Serif 4', Georgia, serif;
    color: #000000;
    letter-spacing: -0.5px;
    line-height: 1.1;
  }
  .ch-badge-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 2px solid #000000;
    background: #E5E7EB;
    width: 88px;
    border-radius: 1px;
  }
  .ch-badge-top {
    background: #000000;
    color: #FFFFFF;
    font-size: 11pt;
    font-weight: 700;
    width: 100%;
    text-align: center;
    padding: 3px 0;
    letter-spacing: 0.5px;
    font-family: system-ui, sans-serif;
  }
  .ch-badge-num {
    font-size: 32pt;
    font-weight: 800;
    color: #000000;
    line-height: 1;
    padding: 4px 0 2px;
    font-family: system-ui, sans-serif;
  }

  /* Middle Page Header (Screenshots 2 & 3) */
  .hdr-middle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    position: relative;
    z-index: 2;
  }
  .hdr-black-pill {
    background: #000000;
    color: #FFFFFF;
    font-weight: 700;
    font-size: 11.5pt;
    padding: 4px 14px;
    border-radius: 4px;
    font-family: 'Source Serif 4', Georgia, serif;
    letter-spacing: 0.2px;
  }
  .hdr-underlined-title {
    font-size: 14pt;
    font-weight: 700;
    font-style: italic;
    color: #000000;
    text-decoration: underline;
    text-underline-offset: 3px;
    font-family: 'Source Serif 4', Georgia, serif;
  }
  .hdr-rule {
    width: 100%;
    height: 1.5px;
    background: #000000;
    margin-bottom: 12px;
    position: relative;
    z-index: 2;
  }

  /* Page Content Body */
  .body {
    flex: 1;
    position: relative;
    z-index: 2;
    font-size: 10.5pt;
    color: #000000;
  }
  .body.cols-2 {
    column-count: 2;
    column-gap: 20px;
  }
  .body.cols-2.with-divider {
    column-rule: 1.2px solid #000000;
  }

  /* Footer & Production Page Tabs */
  .ftr-rule {
    width: 100%;
    height: 1.5px;
    background: #000000;
    margin-top: auto;
    position: relative;
    z-index: 2;
  }
  .ftr-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
    position: relative;
    z-index: 2;
  }
  .ftr-brand-text {
    font-size: 11pt;
    font-weight: 700;
    color: #000000;
    font-family: 'Source Serif 4', Georgia, serif;
  }
  .page-tab-box {
    background: #000000;
    color: #FFFFFF;
    font-weight: 800;
    font-size: 11pt;
    padding: 3px 14px;
    min-width: 36px;
    text-align: center;
    border-radius: 1px;
    font-family: system-ui, sans-serif;
  }
  .ftr-left-tab { flex-direction: row; }
  .ftr-right-tab { flex-direction: row; }

  /* Production Answer Key Grid Table (Screenshot 4) */
  .answer-key-body {
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .ans-key-title {
    font-size: 14pt;
    font-weight: 800;
    letter-spacing: 1px;
    text-align: center;
    margin-bottom: 14px;
    color: #000000;
    font-family: system-ui, sans-serif;
  }
  .ans-key-table {
    border-collapse: collapse;
    width: 96%;
    margin: 0 auto;
    background: transparent;
  }
  .ans-key-table th {
    background: #94A3B8;
    height: 18px;
    border: 1px solid #64748B;
  }
  .ans-key-table td.ans-cell {
    border: 1px solid #94A3B8;
    padding: 4px 6px;
    font-size: 10.5pt;
    font-family: 'Source Serif 4', Georgia, serif;
    width: 16.66%;
    text-align: center;
    background: rgba(255,255,255,0.7);
  }
  .ans-key-table td.ans-cell.highlight-red .q-no {
    color: #DC2626;
    font-weight: 800;
  }
  .ans-key-table td.ans-cell .q-no {
    font-weight: 700;
    margin-right: 4px;
  }
  .ans-key-table td.ans-cell .q-ans {
    font-weight: 800;
  }

  @media print {
    body { background: white; }
    .page { box-shadow: none; margin: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="no-print" style="position:sticky;top:0;z-index:100;background:#0F172A;color:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;font-family:system-ui,sans-serif">
    <div>
      <strong style="font-size:14px">${escapeHtml(book.title)}</strong>
      <span style="opacity:.7;margin-left:10px">${book.pages.length} pages · ${columnsCount} Column Layout · ${book.paperSize}</span>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="window.print()" style="background:#0D9488;color:white;border:0;padding:8px 18px;border-radius:8px;font-weight:700;cursor:pointer">Print / Save PDF</button>
    </div>
  </div>
  ${pagesHtml}${answerKeyPageHtml}
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
    const a = document.createElement('a')
    a.href = url
    a.download = `${book.title.replace(/[^\w\s-]/g, '').trim() || 'question-bank'}-print.html`
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
