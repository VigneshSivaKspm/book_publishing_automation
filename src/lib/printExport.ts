import type { BookDocument } from '../types'
import { PAPER_DIMENSIONS } from '../types'
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
    <text font-size="13" font-weight="700" fill="#475569" letter-spacing="2.5">
      <textPath href="#circlePath" startOffset="50%" text-anchor="middle">${clean}</textPath>
    </text>
    <g transform="translate(130, 105) scale(0.7)">
      <path d="M50,20 L80,100 L20,100 Z" fill="none" stroke="#475569" stroke-width="3"/>
      <path d="M100,20 L130,100 L70,100 Z" fill="none" stroke="#475569" stroke-width="3"/>
      <circle cx="100" cy="110" r="28" fill="none" stroke="#475569" stroke-width="3"/>
      <path d="M60,130 Q100,160 140,130" fill="none" stroke="#475569" stroke-width="3"/>
    </g>
    <text x="200" y="255" font-size="11" font-weight="700" fill="#475569" text-anchor="middle" font-family="'Noto Sans Tamil', sans-serif">உள்ளுவதெல்லாம் உயர்வுள்ளல்</text>
    <text x="200" y="278" font-size="15" font-weight="800" fill="#334155" text-anchor="middle" letter-spacing="2">STUDY CIRCLE</text>
    <text x="200" y="298" font-size="10" font-weight="600" fill="#64748B" text-anchor="middle">SINCE 2020</text>
  </svg>`
}

function watermarkLayer(hf: BookDocument['headerFooter']): string {
  if (hf.watermarkEnabled === false) return ''
  const opacity = hf.watermarkOpacity ?? 0.12
  const scale = hf.watermarkScale ?? 0.85
  const inner = hf.watermarkImage
    ? `<img src="${hf.watermarkImage}" alt="watermark"/>`
    : renderWatermarkSvg(hf.watermarkText)
  return `<div class="watermark-layer" style="opacity:${opacity};"><div class="watermark-inner" style="transform:scale(${scale});">${inner}</div></div>`
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
  const effSize = fontSize || 13.5
  const lineHeightPt = (effSize * 1.2).toFixed(1)
  const sizeStyle = `font-size:${effSize}pt;line-height:${lineHeightPt}pt;`

  if (type === 'image' && imageUrl) {
    return `<figure style="text-align:${a};margin:10pt 0"><img src="${imageUrl}" alt="${escapeHtml(imageAlt || '')}" style="max-width:100%;max-height:160mm;object-fit:contain"/><figcaption style="font-size:9pt;color:#64748B;margin-top:4pt">${escapeHtml(imageAlt || '')}</figcaption></figure>`
  }
  const content = renderTextWithMath(text)
  if (type === 'heading1') return `<h1 style="text-align:${a};font-size:${fontSize || 18}pt;line-height:${((fontSize || 18) * 1.2).toFixed(1)}pt;margin:12pt 0 6pt;page-break-after:avoid;break-after:avoid;font-weight:700">${content}</h1>`
  
  if (type === 'heading2') {
    const secMatch = text.match(/^\s*(\d+(\.\d+)*)\.?\s+(.+)$/)
    if (secMatch) {
      const badge = secMatch[1]
      const title = renderTextWithMath(secMatch[3])
      return `<div class="sec-hdr-wrap" style="page-break-inside:avoid;break-inside:avoid;margin:12pt 0 6pt;">
        <div class="sec-hdr-box" style="display:flex;align-items:stretch;">
          <div class="sec-badge-num" style="background:#000000;color:#FFFFFF;font-weight:800;font-size:11pt;padding:4px 10px;border-radius:1px;display:flex;align-items:center;font-family:system-ui,sans-serif;flex-shrink:0">${badge}</div>
          <div class="sec-title-bg" style="background:#E5E7EB;color:#000000;font-weight:700;font-size:11.5pt;padding:4px 12px;flex:1;display:flex;align-items:center;font-family:'Source Serif 4',Georgia,serif;border-radius:1px">${title}</div>
        </div>
      </div>`
    }
    return `<h2 style="text-align:${a};font-size:${fontSize || 14}pt;line-height:${((fontSize || 14) * 1.2).toFixed(1)}pt;margin:10pt 0 4pt;page-break-after:avoid;break-after:avoid;font-weight:700">${content}</h2>`
  }

  if (type === 'heading3') {
    const secMatch = text.match(/^\s*(\d+(\.\d+)+)\.?\s+(.+)$/)
    if (secMatch) {
      const badge = secMatch[1]
      const title = renderTextWithMath(secMatch[3])
      return `<div class="subsec-hdr-wrap" style="page-break-inside:avoid;break-inside:avoid;margin:9pt 0 4pt;">
        <div class="subsec-hdr-box" style="display:flex;align-items:center;border-bottom:1.5px solid #000000;padding-bottom:2px;">
          <span class="subsec-badge" style="font-weight:800;font-size:10.5pt;color:#000000;margin-right:6px;font-family:system-ui,sans-serif">${badge}</span>
          <span class="subsec-title" style="font-weight:700;font-size:10.5pt;color:#000000;font-family:'Source Serif 4',Georgia,serif">${title}</span>
        </div>
      </div>`
    }
    return `<h3 style="text-align:${a};font-size:${fontSize || 12}pt;line-height:${((fontSize || 12) * 1.2).toFixed(1)}pt;margin:8pt 0 4pt;page-break-after:avoid;break-after:avoid;font-weight:700">${content}</h3>`
  }

  if (type === 'list') {
    const items = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^([-•]|\(?[a-zA-Z]\)|[a-zA-Z][.)]|\(?(?:i{1,3}|iv|v|vi{1,3}|ix|x)\)|(?:i{1,3}|iv|v|vi{1,3}|ix|x)[.)]|\d{1,2}[.)])\s+(.*)$/i)
        const marker = m ? (m[1] === '-' ? '•' : m[1]) : '•'
        const body = m ? m[2] : l
        return `<div style="display:flex;gap:6pt;margin:2pt 0;text-align:left;${sizeStyle}"><span style="flex-shrink:0;font-weight:600;color:#334155">${escapeHtml(marker)}</span><span>${renderTextWithMath(body)}</span></div>`
      })
      .join('')
    return `<div style="margin:4pt 0 4pt 8pt">${items}</div>`
  }
  if (type === 'table') {
    const rows = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.includes('|'))
    const isSep = (l: string) => /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(l)
    const splitRow = (row: string) =>
      row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())
    const dataRows = rows.filter((l) => !isSep(l))
    if (dataRows.length === 0) return `<p style="text-align:${a};margin:5pt 0;${sizeStyle}">${content}</p>`
    const header = splitRow(dataRows[0])
    const bodyRows = dataRows.slice(1).map(splitRow)
    const th = header
      .map((h) => `<th style="border:1px solid #64748B;background:#E5E7EB;color:#000;font-weight:700;padding:3pt 5pt;text-align:left;vertical-align:top">${renderTextWithMath(h)}</th>`)
      .join('')
    const trs = bodyRows
      .map(
        (r) =>
          `<tr>${header
            .map((_, ci) => `<td style="border:1px solid #94A3B8;padding:3pt 5pt;vertical-align:top">${renderTextWithMath(r[ci] ?? '')}</td>`)
            .join('')}</tr>`,
      )
      .join('')
    return `<table style="border-collapse:collapse;width:100%;margin:8pt 0;page-break-inside:avoid;break-inside:avoid;font-size:${Math.max(8, effSize - 1.5)}pt;line-height:1.25"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
  }
  if (type === 'math') return `<div class="math-font" style="text-align:center;margin:6pt 0;${sizeStyle}">${renderTextWithMath(text).replace(/\n+/g, ' ')}</div>`
  if (type === 'spacer') return `<div style="height:10pt"></div>`
  if (type === 'mcq') {
    const isOptLine = (l: string) => /^\s*(?:\([A-E]\)|[A-E][.)])\s+\S/.test(l)
    const lines = text.split('\n')
    let optStarted = false
    const body = lines
      .map((line, i) => {
        const cleanLine = line
          .replace(/\[\s*[✓✔]?\s*\(?[A-Ea-e1-4?]?\)?\s*\]/gi, '')
          .replace(/\s*Answer\s*[:\-]\s*\(?[A-Ea-e1-4]\)?\s*$/gi, '')
          .trim()
        if (!cleanLine) return ''
        if (i > 0 && !optStarted && isOptLine(cleanLine)) optStarted = true
        const isOpt = i > 0 && optStarted
        // year tag bold, e.g. (2025)
        const html = renderTextWithMath(cleanLine).replace(/\(((?:19|20)\d{2})\)/g, '<strong>($1)</strong>')
        if (!isOpt) {
          return `<div class="q-stem" style="font-weight:${i === 0 ? 700 : 500};margin:${i === 0 ? '0 0 2pt' : '1pt 0'};line-height:${lineHeightPt}pt;color:#0F172A">${html}</div>`
        }
        return `<div class="q-opt" style="margin:1.5pt 0 1.5pt 13pt;color:#0F172A;font-weight:400;line-height:${lineHeightPt}pt">${html}</div>`
      })
      .join('')
    return `<div class="mcq-block" style="margin:0 0 6pt;break-inside:avoid;${sizeStyle}">${body}</div>`
  }
  return `<p style="text-align:${a};margin:0 0 5pt;${sizeStyle}">${renderTextWithMath(text).replace(/\n+/g, '<br/>')}</p>`
}

/** Block types that must span the full page width (break the 2-column flow). */
function isSpanBlock(type: string): boolean {
  return type === 'table' || type === 'heading1' || type === 'heading2' || type === 'heading3'
}

/** Build the full standalone printable HTML document (no DOM side-effects). */
export function buildPrintableHtml(book: BookDocument): string {
  const dim = PAPER_DIMENSIONS[book.paperSize]
  const hf = book.headerFooter
  const isQuestionsOnly = book.bookMode === 'questions-only'
  const bodyFont = resolveBodyStack(book.fontId || 'english-serif', book.customFontFamily)
  const mathFont = resolveBodyStack(book.mathFontId || 'math-stix', book.mathFontId?.startsWith('Custom_') ? book.mathFontId : undefined)
  const pageCss =
    book.paperSize === 'A4' ? 'A4' : book.paperSize === 'B5' ? 'B5' : '203mm 203mm'

  const columnsCount = hf.layoutColumns || 2
  const showDivider = hf.showColumnDivider !== false

  // ---- Every block, flattened into one continuous flow (paginated in the browser) ----
  const allBlocks = book.pages.flatMap((p) => p.blocks)
  const srcHtml = allBlocks
    .map((b) => {
      const inner = blockHtml(b.text, b.type, b.align || 'left', b.imageUrl, b.imageAlt, isQuestionsOnly, b.fontSize)
      if (!inner.trim()) return ''
      return `<div class="blk${isSpanBlock(b.type) ? ' blk-span' : ''}">${inner}</div>`
    })
    .join('\n')

  // ---- Auto answer-key grid (Screenshot 4): 6 columns, filled column-by-column ----
  const allMcqs: { num: string; answer: string }[] = []
  let mcqSeq = 0
  allBlocks.forEach((b) => {
    if (b.type !== 'mcq') return
    mcqSeq++
    const num = b.text.match(/^\s*(\d+)/)?.[1] || String(mcqSeq)
    const ans = (b.answer || b.text.match(/\[✓\s*([A-E])\]/i)?.[1] || '').toUpperCase()
    allMcqs.push({ num, answer: ans || '–' })
  })

  let answerKeyGrid = ''
  if (allMcqs.length > 0 && hf.autoGenerateAnswerKey !== false && !isQuestionsOnly) {
    const totalCols = 6
    const numRows = Math.ceil(allMcqs.length / totalCols)
    const rows: string[] = []
    for (let r = 0; r < numRows; r++) {
      const cells: string[] = []
      for (let c = 0; c < totalCols; c++) {
        const i = r + c * numRows
        if (i < allMcqs.length) {
          const it = allMcqs[i]
          cells.push(
            `<td class="ans-cell ${it.answer === '–' ? 'highlight-red' : ''}"><span class="q-no">${it.num}.</span> <span class="q-ans">${it.answer}</span></td>`,
          )
        } else {
          cells.push('<td class="ans-cell empty"></td>')
        }
      }
      rows.push(`<tr>${cells.join('')}</tr>`)
    }
    answerKeyGrid = `<table class="ans-key-table"><tbody>${rows.join('')}</tbody></table>`
  }

  // ---- Config handed to the in-page paginator ----
  const cfg = {
    chapterLabel: hf.chapterLabel || 'Chapter',
    chapterNumber: hf.chapterNumber || '',
    chapterTitle: hf.chapterTitle || book.title,
    middleBoxText: hf.middleBoxText || 'Karthikeyan Analysis Study Circle',
    middleRightText: hf.middleRightText || hf.chapterTitle || book.title,
    footerLeft: hf.footerLeft || 'Karthikeyan Analysis Learning Resources',
    pageNumberStyle: hf.pageNumberStyle || 'production-tab',
    alt: hf.alternatingHeaders !== false,
    divider: showDivider,
    oneCol: columnsCount === 1,
    watermark: watermarkLayer(hf),
    answerKey: answerKeyGrid || null,
    firstBadge: !!(hf.chapterNumber && String(hf.chapterNumber).trim()),
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(book.title)} — ${isQuestionsOnly ? 'Syllabus' : 'Question Bank'}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Catamaran:wght@400;700&family=Noto+Sans+Tamil:wght@400;700&family=Noto+Serif:wght@400;700&family=Source+Serif+4:opsz,wght@8..60,400;600;700&family=STIX+Two+Text:wght@400;700&display=swap"/>
<style>
  @page { size: ${pageCss}; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ${bodyFont}; color: #0F172A; background: #E2E8F0; }
  .math-font, .katex { font-family: ${mathFont} !important; }

  .page {
    position: relative;
    width: ${dim.widthMm}mm;
    height: ${dim.heightMm}mm;
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
  #src { display: none; }
  #out:empty::before {
    content: 'Laying out pages…';
    display: block;
    text-align: center;
    padding: 40px;
    color: #64748B;
    font-family: system-ui, sans-serif;
  }

  /* Watermark background */
  .watermark-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }
  .watermark-inner {
    width: 380px;
    height: 380px;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center center;
  }
  .watermark-inner img { max-width: 100%; max-height: 100%; object-fit: contain; margin: auto; }

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

  /* Page Content Body — continuous 2-column flow, filled by the paginator */
  .body {
    flex: 1 1 0;
    min-height: 0;
    position: relative;
    z-index: 2;
    font-size: 10.5pt;
    color: #000000;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
    max-width: 100%;
  }
  .body.flow {
    column-count: 2;
    column-gap: 22px;
    column-fill: auto;
    overflow: hidden;
    orphans: 2;
    widows: 2;
  }
  .body.flow.one-col { column-count: 1; }
  .body.flow.with-divider { column-rule: 1.2px solid #000000; }
  .body.flow > .blk { break-inside: avoid; }
  .body.flow > .blk-span { column-span: all; }
  .body.flow > .blk:first-child,
  .body.flow > .blk:first-child > *,
  .body.flow > .blk:first-child .q-stem:first-child { margin-top: 0 !important; padding-top: 0 !important; }

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
      <span style="opacity:.7;margin-left:10px"><span id="pc">…</span> · ${columnsCount === 1 ? '1' : '2'} column · ${book.paperSize}</span>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="window.__paginate&&window.__paginate();window.print()" style="background:#0D9488;color:white;border:0;padding:8px 18px;border-radius:8px;font-weight:700;cursor:pointer">Print / Save PDF</button>
    </div>
  </div>
  <div id="src">${srcHtml}</div>
  <div id="out"></div>
<script>
${paginatorScript(cfg)}
</script>
</body>
</html>`

  return html
}

/** In-page script: flows all .blk elements into as many .page sections as needed, filling each. */
function paginatorScript(cfg: Record<string, unknown>): string {
  const CFG = JSON.stringify(cfg).replace(/</g, '\\u003c')
  return [
    '(function(){',
    'var CFG=' + CFG + ';',
    'function esc(s){var d=document.createElement("div");d.textContent=(s==null?"":String(s));return d.innerHTML;}',
    'function headerHtml(i){',
    '  if(i===0&&CFG.firstBadge){',
    '    return "<div class=\\"hdr-first\\"><div class=\\"hdr-ch-title\\">"+esc(CFG.chapterTitle)+"</div>"',
    '      +"<div class=\\"ch-badge-box\\"><div class=\\"ch-badge-top\\">"+esc(CFG.chapterLabel)+"</div>"',
    '      +"<div class=\\"ch-badge-num\\">"+esc(CFG.chapterNumber)+"</div></div></div><div class=\\"hdr-rule\\"></div>";',
    '  }',
    '  var pill="<div class=\\"hdr-black-pill\\">"+esc(CFG.middleBoxText)+"</div>";',
    '  var title="<div class=\\"hdr-underlined-title\\">"+esc(CFG.middleRightText)+"</div>";',
    '  var even=(((i+1)%2)===0);',
    '  var inner=(CFG.alt&&even)?(pill+title):(title+pill);',
    '  return "<div class=\\"hdr-middle\\">"+inner+"</div><div class=\\"hdr-rule\\"></div>";',
    '}',
    'function footerHtml(i){',
    '  var no=i+1;var rule="<div class=\\"ftr-rule\\"></div>";',
    '  if(CFG.pageNumberStyle==="bracket"){',
    '    return rule+"<div class=\\"ftr-content\\" style=\\"justify-content:center\\"><div class=\\"page-tab-box\\">{ "+no+" }</div></div>";',
    '  }',
    '  var brand="<span class=\\"ftr-brand-text\\">"+esc(CFG.footerLeft)+"</span>";',
    '  var tab="<div class=\\"page-tab-box\\">"+no+"</div>";',
    '  var even=((no%2)===0);',
    '  return rule+"<div class=\\"ftr-content \\"+(even?\\"ftr-left-tab\\":\\"ftr-right-tab\\")+\\"\\">"+(even?(tab+brand):(brand+tab))+"</div>";',
    '}',
    'var out=document.getElementById("out"),src=document.getElementById("src");',
    'function makePage(i,extra){',
    '  var sec=document.createElement("section");sec.className="page";',
    '  sec.innerHTML=CFG.watermark+headerHtml(i)+"<div class=\\"body flow"+(CFG.oneCol?" one-col":"")+(CFG.divider?" with-divider":"")+(extra?(" "+extra):"")+"\\"></div>"+footerHtml(i);',
    '  out.appendChild(sec);return sec.querySelector(".body");',
    '}',
    'function fits(b){return b.scrollWidth<=b.clientWidth+3&&b.scrollHeight<=b.clientHeight+3;}',
    'function renderMath(root){',
    '  if(!window.katex)return;',
    '  var ns=root.querySelectorAll("span[data-tex]:not([data-done])");',
    '  for(var j=0;j<ns.length;j++){var el=ns[j];try{window.katex.render(el.getAttribute("data-tex"),el,{displayMode:el.classList.contains("math-display"),throwOnError:false,strict:false});}catch(e){}el.setAttribute("data-done","1");}',
    '}',
    'function paginate(){',
    '  renderMath(src);out.innerHTML="";',
    '  var blocks=src.querySelectorAll(".blk");',
    '  var i=0,body=makePage(0),guard=0;',
    '  for(var k=0;k<blocks.length;k++){',
    '    var el=blocks[k].cloneNode(true);body.appendChild(el);',
    '    if(!fits(body)&&body.children.length>1){',
    '      body.removeChild(el);i++;body=makePage(i);body.appendChild(el);',
    '      if(++guard>3000)break;',
    '    }',
    '  }',
    '  if(CFG.answerKey){i++;var ak=makePage(i,"answer-key-body");ak.classList.remove("flow");ak.innerHTML="<div class=\\"ans-key-title\\">ANSWER KEY</div>"+CFG.answerKey;}',
    '  var pc=document.getElementById("pc");if(pc)pc.textContent=out.children.length+" pages";',
    '}',
    'var t;function schedule(){clearTimeout(t);t=setTimeout(paginate,50);}',
    'window.__paginate=paginate;',
    'if(document.readyState==="complete"){paginate();}else{window.addEventListener("load",paginate);}',
    'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(schedule);}',
    'setTimeout(schedule,600);setTimeout(schedule,1800);',
    '})();',
  ].join('\n')
}

export function exportBookPrintable(book: BookDocument): void {
  const html = buildPrintableHtml(book)
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
