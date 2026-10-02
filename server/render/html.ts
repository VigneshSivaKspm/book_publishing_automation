import fs from "node:fs";
import path from "node:path";
import katex from "katex";
import { themeFor, type BookTheme } from "./theme.ts";

const inlineText = (t: string, d: boolean) => inline(t, d);
import {
  trimSizeMm,
  type BookModel,
  type Chapter,
  type ContentNode,
  type QuestionNode,
  type TableNode,
} from "../../shared/model.ts";

/**
 * Deterministic book HTML. The same document is used for the live preview
 * (iframe) and for the print PDF (headless Chromium), so what the user
 * proofs is exactly what gets printed. Math is rendered to HTML on the
 * server with KaTeX; fonts are self-hosted; pagination is done by
 * paginator.js which measures real layout and emits a report.
 */

const PAGINATOR = fs.readFileSync(path.join(import.meta.dirname, "paginator.js"), "utf8");

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tex(src: string, display: boolean): string {
  return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: "ignore", output: "html", trust: false });
}

/**
 * Question-bank convention (reference book): short stand-alone fractions such
 * as option "a^4/6" are set at full size; long expressions and integrals stay
 * in text style so lines do not explode.
 */
function isSimpleFraction(src: string): boolean {
  return /\\frac/.test(src) && src.length <= 34 && !/\\(int|iint|iiint|sum|prod|lim)/.test(src) && (src.match(/\\frac/g) ?? []).length === 1;
}

/** Text with $...$ / $$...$$ math and newlines → HTML. Never alters wording. */
export function inline(text: string, displayFractions = false): string {
  const parts: string[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    parts.push(esc(text.slice(last, m.index)).replace(/\n/g, "<br>"));
    parts.push(m[1] !== undefined ? `<span class="dmath">${tex(m[1], true)}</span>` : displayFractions && isSimpleFraction(m[2]) ? `<span class="tall">${tex(`\\displaystyle ${m[2]}`, false)}</span>` : tex(m[2], false));
    last = m.index + m[0].length;
  }
  parts.push(esc(text.slice(last)).replace(/\n/g, "<br>"));
  return parts.join("");
}

interface RenderOptions {
  /** Base URL for assets/static files (preview: relative; PDF: absolute http). */
  assetBase: string;
  staticBase: string;
  token: string | null;
  interactive: boolean;
}

function withToken(url: string, token: string | null): string {
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}

function assetUrl(model: BookModel, id: string | null, o: RenderOptions): string | null {
  if (!id) return null;
  const a = model.assets.find((x) => x.id === id);
  return a ? withToken(`${o.assetBase}/assets/${encodeURIComponent(a.id)}`, o.token) : null;
}

function blk(node: ContentNode, attrs: { split?: string; keepNext?: boolean; cls?: string }, inner: string): string {
  const flags = [
    `class="blk ${attrs.cls ?? ""}${node.needsReview ? " review" : ""}"`,
    `data-node="${esc(node.id)}"`,
    `data-split="${attrs.split ?? "none"}"`,
    attrs.keepNext ? 'data-keepnext="1"' : "",
  ];
  return `<div ${flags.filter(Boolean).join(" ")}>${inner}</div>`;
}

function renderTable(n: TableNode): string {
  const isHeaderRow = (r: TableNode["rows"][number]) => r.length > 0 && r.every((c) => c.header);
  let headCount = 0;
  while (headCount < n.rows.length && isHeaderRow(n.rows[headCount])) headCount++;
  const cell = (c: TableNode["rows"][number][number], tag: string) =>
    `<${tag}${c.colSpan > 1 ? ` colspan="${c.colSpan}"` : ""}${c.rowSpan > 1 ? ` rowspan="${c.rowSpan}"` : ""}>${inline(c.text)}</${tag}>`;
  const thead = n.rows.slice(0, headCount).map((r) => `<tr>${r.map((c) => cell(c, "th")).join("")}</tr>`).join("");
  const tbody = n.rows
    .slice(headCount)
    .map((r) => `<tr>${r.map((c) => cell(c, c.header ? "th" : "td")).join("")}</tr>`)
    .join("");
  return `${n.caption ? `<div class="tcap">${inline(n.caption)}</div>` : ""}<table class="tbl">${thead ? `<thead>${thead}</thead>` : ""}<tbody>${tbody}</tbody></table>`;
}

function renderQuestion(q: QuestionNode, model: BookModel, o: RenderOptions): string {
  const inline = (t: string) => inlineText(t, true);
  const year = q.year ? ` <span class="q-year">(${esc(q.year)})</span>` : "";
  const parts: string[] = [`<div class="q-stem">${inline(q.stem)}${q.assertion || q.statements.length || q.match ? "" : year}</div>`];
  if (q.statements.length) {
    parts.push(`<div class="q-stmts">${q.statements.map((s) => `<div class="q-stmt">${inline(s)}</div>`).join("")}</div>`);
  }
  if (q.assertion) parts.push(`<div class="q-ar"><b>Assertion (A):</b> ${inline(q.assertion)}</div>`);
  if (q.reason) parts.push(`<div class="q-ar"><b>Reason (R):</b> ${inline(q.reason)}</div>`);
  if (q.match) {
    const rows = Math.max(q.match.left.items.length, q.match.right.items.length);
    const head =
      q.match.left.title || q.match.right.title
        ? `<tr><th colspan="2">${inline(q.match.left.title ?? "")}</th><th colspan="2">${inline(q.match.right.title ?? "")}</th></tr>`
        : "";
    const body = Array.from({ length: rows }, (_, i) => {
      const l = q.match!.left.items[i];
      const r = q.match!.right.items[i];
      return `<tr><td class="ml">${l ? `(${esc(l.label)})` : ""}</td><td>${l ? inline(l.text) : ""}</td><td class="ml">${r ? `${esc(r.label)}.` : ""}</td><td>${r ? inline(r.text) : ""}</td></tr>`;
    }).join("");
    parts.push(`<table class="q-match">${head}${body}</table>`);
  }
  if (q.assertion || q.statements.length || q.match) parts.push(year ? `<div class="q-yearline">${year.trim()}</div>` : "");
  const fig = assetUrl(model, q.figureAssetId, o);
  if (fig) parts.push(`<div class="q-fig"><img src="${esc(fig)}" alt="Figure for question ${esc(q.number)}"></div>`);

  // Match-the-following code rows ("2 3 4 1") render as an aligned grid.
  const leftLabels = q.match?.left.items.map((i) => i.label) ?? [];
  const isCodeGrid =
    !!q.match && leftLabels.length > 1 && q.options.length > 0 && q.options.every((op) => op.text.trim().split(/\s+/).length === leftLabels.length && !/\$/.test(op.text));
  if (isCodeGrid) {
    const head = `<tr><td></td>${leftLabels.map((l) => `<td>(${esc(l)})</td>`).join("")}</tr>`;
    const rows = q.options
      .map((op) => `<tr><td class="q-ol">${esc(op.label)})</td>${op.text.trim().split(/\s+/).map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`)
      .join("");
    parts.push(`<table class="q-codes">${head}${rows}</table>`);
  } else if (q.options.length) {
    parts.push(
      `<div class="q-opts">${q.options.map((op) => `<div class="q-opt"><span class="q-ol">${esc(op.label)})</span><span class="q-ot">${inline(op.text)}</span></div>`).join("")}</div>`,
    );
  }
  return `<div class="q"><span class="q-num">${esc(q.number)}.</span><div class="q-body">${parts.join("")}</div></div>`;
}

function renderNode(n: ContentNode, model: BookModel, o: RenderOptions): string {
  switch (n.kind) {
    case "heading": {
      if (n.level === 1)
        return blk(n, { keepNext: true, cls: "h1" }, n.number ? `<div class="sec"><span class="sec-num">${esc(n.number)}</span><span class="sec-title">${inline(n.text)}</span></div>` : `<div class="sec sec-nonum"><span class="sec-title">${inline(n.text)}</span></div>`);
      if (n.level === 2)
        return blk(n, { keepNext: true, cls: "h2" }, `<div class="sub">${n.number ? `<span class="sub-num">${esc(n.number)}.</span>` : ""}<span class="sub-title">${inline(n.text)}</span></div>`);
      if (n.level === 3) return blk(n, { keepNext: true, cls: "h3" }, `<div class="h3t">${n.number ? `${esc(n.number)} ` : ""}${inline(n.text)}</div>`);
      return blk(n, { keepNext: true, cls: "h4" }, `<div class="runin">${n.number ? `${esc(n.number)} ` : ""}${inline(n.text)}</div>`);
    }
    case "paragraph":
      return blk(n, { split: "para", cls: `p-${n.role}` }, `<p class="para">${inline(n.text)}</p>`);
    case "list":
      return blk(
        n,
        { split: "list", cls: n.ordered ? "ol" : "ul" },
        `<div class="list">${n.items.map((i) => `<div class="li lvl-${i.level}"><span class="mk">${esc(i.marker || "•")}</span><span class="lt">${inline(i.text)}</span></div>`).join("")}</div>`,
      );
    case "equation":
      return blk(n, { cls: "eqb" }, `<div class="eq">${tex(n.latex, true)}</div>`);
    case "table":
      return blk(n, { split: "table", cls: "tblb" }, renderTable(n));
    case "figure": {
      const src = assetUrl(model, n.assetId, o);
      const asset = model.assets.find((a) => a.id === n.assetId);
      // Reproduce the figure at its physical size in the source (never upscaled past the text width).
      const widthMm = asset && asset.dpi > 0 ? (asset.widthPx / asset.dpi) * 25.4 : null;
      const img = src ? `<img src="${esc(src)}" alt="${esc(n.caption || n.label || "Figure")}"${widthMm ? ` style="width:${widthMm.toFixed(1)}mm"` : ""}>` : `<div class="fig-missing">Figure missing — see source page ${n.sourcePage}</div>`;
      const cap = n.caption || n.label ? `<figcaption>${n.label ? `<b>${esc(n.label)}</b> ` : ""}${n.caption ? inline(n.caption) : ""}</figcaption>` : "";
      return blk(n, { cls: "figb" }, `<figure class="fig">${img}${cap}</figure>`);
    }
    case "question":
      return blk(n, { cls: "qb" }, renderQuestion(n, model, o));
  }
}

function answerKeyPages(chapter: Chapter, theme: BookTheme, bodyHeightMm: number): string[] {
  const qs = chapter.nodes.filter((n): n is QuestionNode => n.kind === "question");
  if (!qs.length || !qs.some((q) => q.answer)) return [];
  const rowMm = 5.6;
  const titleMm = 12;
  const rowsPerPage = Math.max(5, Math.floor((bodyHeightMm - titleMm) / rowMm) - 1);
  const cols = theme.answerKeyCols;
  const perPage = rowsPerPage * cols;
  const pages: string[] = [];
  for (let start = 0; start < qs.length; start += perPage) {
    const slice = qs.slice(start, start + perPage);
    const rows = Math.ceil(slice.length / cols);
    let body = "";
    for (let r = 0; r < rows; r++) {
      body += "<tr>";
      for (let c = 0; c < cols; c++) {
        const q = slice[r + c * rows];
        body += q ? `<td class="ak-n">${esc(q.number)}.</td><td class="ak-a">${esc(q.answer ?? "-")}</td>` : `<td class="ak-n"></td><td class="ak-a"></td>`;
      }
      body += "</tr>";
    }
    const head = `<tr class="ak-head"><td colspan="${cols * 2}"></td></tr>`;
    pages.push(
      `<div class="blk fullpage answer-key" data-split="none"><div class="ak-title">ANSWER KEY${start ? " (contd.)" : ""}</div><table class="ak">${head}${body}</table></div>`,
    );
  }
  return pages;
}

function watermarkHtml(model: BookModel, o: RenderOptions): string {
  const s = model.settings;
  if (!s.watermarkEnabled) return "";
  const logo = assetUrl(model, s.watermarkAssetId, o);
  if (logo) return `<img src="${esc(logo)}" alt="">`;
  const text = esc((s.watermarkText || s.organisationName || "").toUpperCase());
  if (!text) return "";
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><circle cx="200" cy="200" r="186" fill="none" stroke="#000" stroke-width="5"/><circle cx="200" cy="200" r="168" fill="none" stroke="#000" stroke-width="2"/><path id="wmArc" d="M 62,200 A 138,138 0 1,1 338,200 A 138,138 0 1,1 62,200" fill="none"/><text font-family="Noto Sans, sans-serif" font-size="26" font-weight="700" letter-spacing="3"><textPath href="#wmArc" startOffset="25%" text-anchor="middle">${text}</textPath></text></svg>`;
}

export function buildBookHtml(model: BookModel, o: RenderOptions): string {
  const type = model.bookType === "question_bank" ? "question_bank" : "syllabus";
  const theme = themeFor(type);
  const { widthMm, heightMm } = trimSizeMm(model.settings);
  const s = model.settings;
  const bodyHeightMm = heightMm - theme.margins.top - theme.margins.bottom;

  const flow: string[] = [];
  model.chapters.forEach((ch, ci) => {
    const title = ch.title || s.chapterName || s.bookName || "";
    const number = ch.number ?? (ci === 0 ? s.chapterNumber : "") ?? "";
    flow.push(`<div class="chapter-start" data-title="${esc(title)}" data-number="${esc(number || "")}"></div>`);
    for (const n of ch.nodes) flow.push(renderNode(n, model, o));
    if (type === "question_bank") flow.push(...answerKeyPages(ch, theme, bodyHeightMm));
  });

  const cfg = {
    type,
    widthMm,
    heightMm,
    columns: theme.columns,
    mirrored: s.mirrored,
    organisation: s.organisationName,
    subject: s.subjectName || s.chapterName || s.bookName,
    footerText: s.footerText || s.organisationName,
    interactive: o.interactive,
  };
  const st = o.staticBase;
  const m = theme.margins;
  const fontCss = ["noto-serif/400.css", "noto-serif/700.css", "noto-serif/400-italic.css", "noto-serif/700-italic.css", "noto-sans/400.css", "noto-sans/700.css", "noto-sans-tamil/400.css", "noto-sans-tamil/700.css", "noto-serif-tamil/400.css", "noto-serif-tamil/700.css", "noto-sans-devanagari/400.css", "noto-sans-devanagari/700.css"]
    .map((f) => `<link rel="stylesheet" href="${st}/fontsource/${f}">`)
    .join("");

  return `<!doctype html>
<html lang="${esc(s.languages[0] || "en")}">
<head>
<meta charset="utf-8">
<title>${esc(s.bookName || "Book")}</title>
${fontCss}
<link rel="stylesheet" href="${st}/katex/katex.min.css">
<style>
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
:root { --pw: ${widthMm}mm; --ph: ${heightMm}mm; --body: ${theme.bodySizePt}pt; --lh: ${theme.lineHeight}; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; }
body { background: #9aa0a6; font-family: ${theme.bodyFont}; color: #000; font-size: var(--body); line-height: var(--lh); font-kerning: normal; text-rendering: geometricPrecision; hyphens: manual; }
#src { position: absolute; left: -10000px; top: 0; width: ${widthMm - m.inner - m.outer}mm; visibility: hidden; }
#pages { display: flex; flex-direction: column; align-items: center; gap: 8mm; padding: 8mm 0; }
.page { position: relative; width: var(--pw); height: var(--ph); background: #fff; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.35); page-break-after: always; break-after: page; }
@media print { body { background: #fff; } #pages { display: block; padding: 0; gap: 0; } .page { box-shadow: none; margin: 0; } .page:last-child { page-break-after: auto; break-after: auto; } .review { outline: none !important; } }

/* watermark */
.wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; opacity: ${s.watermarkOpacity}; }
.wm img, .wm svg { width: ${Math.round(widthMm * 0.62)}mm; height: auto; max-height: ${Math.round(heightMm * 0.5)}mm; object-fit: contain; filter: grayscale(1); }

/* running header */
.rh { position: absolute; left: 0; right: 0; top: ${theme.headerTop}mm; height: ${theme.headerHeight}mm; display: flex; align-items: center; justify-content: space-between; border-bottom: 0.8pt solid #000; z-index: 2; }
.rh .org { background: #000; color: #fff; font-family: ${theme.headingFont}; font-weight: 700; font-size: 10.5pt; padding: 0.9mm 3.2mm; line-height: 1.2; margin-bottom: 1.2mm; }
.rh .subj { font-family: ${theme.headingFont}; font-style: italic; font-weight: 700; font-size: 11pt; margin-bottom: 1.2mm; }

/* chapter opener */
.opener { position: absolute; left: 0; right: 0; top: 9mm; height: 26mm; display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 1pt solid #000; z-index: 2; }
.opener .ct { font-family: ${theme.headingFont}; font-weight: 700; font-size: ${theme.chapterTitlePt}pt; line-height: 1.05; padding-bottom: 3mm; max-width: 78%; }
.opener .cb { display: flex; flex-direction: column; align-items: stretch; width: 25mm; margin-bottom: 2.4mm; }
.opener .cb .lbl { background: #000; color: #fff; font-family: ${theme.sansFont}; font-weight: 700; font-size: 13pt; text-align: center; padding: 0.8mm 0; letter-spacing: .3pt; }
.opener .cb .num { background: #d9d9d9; color: #000; font-family: ${theme.sansFont}; font-weight: 800; font-size: 34pt; line-height: 1; text-align: center; padding: 1.2mm 0 1.4mm; }

/* body frame */
.body { position: absolute; z-index: 1; display: flex; gap: ${theme.columnGap}mm; }
.col { position: relative; flex: 1 1 0; min-width: 0; height: 100%; overflow: hidden; }
.flow { display: flow-root; }
.divider { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.6pt solid #000; left: 50%; }

/* footer */
.rf { position: absolute; left: 0; right: 0; bottom: ${theme.footerBottom}mm; height: ${theme.footerHeight}mm; z-index: 2; }
.rf.syl { display: flex; align-items: center; gap: 2.5mm; }
.rf.syl .rule { flex: 1; border-top: 0.8pt solid #000; }
.rf.syl .pn { font-family: ${theme.headingFont}; font-size: 11pt; font-weight: 700; }
.rf.qb { border-top: 0.8pt solid #000; display: flex; align-items: flex-start; justify-content: space-between; }
.rf.qb .brand { font-family: ${theme.headingFont}; font-weight: 700; font-size: 11pt; padding-top: 1.4mm; }
.rf.qb .tab { background: #000; color: #fff; font-family: ${theme.sansFont}; font-weight: 700; font-size: 10.5pt; min-width: 9mm; text-align: center; padding: 0.6mm 2.4mm; margin-top: -0.2mm; }

/* blocks */
.blk { position: relative; }
.para { margin: 0 0 ${theme.paragraphGapPt}pt; text-align: justify; text-justify: inter-word; }
.p-definition .para { padding-left: 3mm; border-left: 1.2pt solid #555; }
.p-quote .para { font-style: italic; padding: 0 5mm; }
.p-note .para { background: #ececec; padding: 1.5mm 2.5mm; }
.para.cont { text-indent: 0; }
.sec { display: flex; align-items: stretch; margin: 6pt 0 5pt; font-family: ${theme.headingFont}; font-size: ${theme.sectionPt}pt; line-height: 1.25; }
.sec-num { background: #000; color: #fff; font-weight: 700; padding: 0.8mm 3.4mm; display: flex; align-items: center; }
.sec-title { background: #d9d9d9; font-weight: 700; padding: 0.8mm 2.6mm; flex: 1; display: flex; align-items: center; }
.sub { display: flex; align-items: stretch; margin: 6pt 0 4pt; font-family: ${theme.headingFont}; font-size: ${theme.subsectionPt}pt; line-height: 1.25; background: #f2f2f2; border-bottom: 0.6pt dotted #555; }
.sub-num { background: #d9d9d9; font-weight: 700; padding: 0.6mm 2.4mm; }
.sub-title { font-weight: 700; padding: 0.6mm 2.4mm; flex: 1; }
.h3t { font-weight: 700; font-size: ${theme.runInPt}pt; margin: 5pt 0 2pt; }
.runin { font-weight: 700; font-size: ${theme.runInPt}pt; margin: 5pt 0 2pt; }
.list { margin: 0 0 ${theme.paragraphGapPt}pt; }
.li { display: flex; gap: 2.2mm; margin: 0 0 1.2pt; padding-left: ${theme.bulletIndentMm}mm; }
.li.lvl-2 { padding-left: ${theme.bulletIndentMm * 2.2}mm; }
.li.lvl-3 { padding-left: ${theme.bulletIndentMm * 3.4}mm; }
.li.lvl-4 { padding-left: ${theme.bulletIndentMm * 4.6}mm; }
.li .mk { flex: 0 0 auto; min-width: 3mm; }
.ol .li .mk { min-width: 5mm; font-weight: 700; }
.li .lt { flex: 1; text-align: justify; }
.eq { margin: 4pt 0 6pt; text-align: center; overflow: hidden; }
.eq .katex-display { margin: 0; }
.dmath .katex-display { margin: 3pt 0; }
.tcap { font-weight: 700; text-align: center; margin: 4pt 0 2pt; }
.tbl { width: 100%; border-collapse: collapse; margin: 4pt 0 7pt; font-size: ${theme.tableSizePt}pt; line-height: 1.25; }
.tbl th { background: #8c8c8c; color: #fff; font-weight: 700; text-align: left; }
.tbl th, .tbl td { border: 0.5pt solid #bfbfbf; padding: 0.7mm 1.6mm; vertical-align: top; }
.tbl tbody tr:nth-child(odd) td { background: #ededed; }
.fig { margin: 4pt 0 7pt; text-align: center; break-inside: avoid; }
.fig img { max-width: 100%; max-height: ${Math.round(bodyHeightMm * 0.8)}mm; }
.fig figcaption { font-size: ${theme.bodySizePt - 1}pt; margin-top: 2pt; }
.fig-missing { border: 0.8pt dashed #c00; color: #c00; padding: 6mm; font-family: ${theme.sansFont}; font-size: 9pt; }

/* questions */
.qb { margin: 0 0 ${theme.questionGapPt}pt; }
.q { display: flex; align-items: baseline; gap: 1.4mm; }
.q-num { flex: 0 0 auto; font-weight: 700; min-width: 6.2mm; }
.q-body { flex: 1; min-width: 0; }
.q-stem { text-align: left; }
.q-year, .q-yearline { font-weight: 700; }
.q-ar, .q-stmt { margin-top: 1.2pt; }
.q-opts { margin-top: 1.2pt; }
.q-opt { display: flex; align-items: baseline; gap: 1.6mm; padding-left: ${theme.optionIndentMm * 0.4}mm; }
.q-ol { flex: 0 0 auto; min-width: 4.6mm; }
.q-ot { flex: 1; min-width: 0; }
.q-match, .q-codes { border-collapse: collapse; margin: 2pt 0; }
.q-match td, .q-match th { padding: 0.4mm 1.4mm 0.4mm 0; vertical-align: top; text-align: left; }
.q-match .ml { font-weight: 700; white-space: nowrap; }
.q-codes td { padding: 0.2mm 2.2mm 0.2mm 0; text-align: center; }
.q-codes td.q-ol { text-align: left; }
.q-fig { margin: 2pt 0; text-align: center; }
.q-fig img { max-width: 100%; max-height: 55mm; }
.katex { font-size: 1.06em; }
.tall { display: inline-block; vertical-align: middle; padding: 1.5pt 0; line-height: 1; }
.q .katex-display, .li .katex-display { margin: 1pt 0; text-align: left; }

/* answer key */
.answer-key { width: 100%; }
.ak-title { text-align: center; font-family: ${theme.sansFont}; font-weight: 800; font-size: 13pt; letter-spacing: 1pt; margin: 2mm 0 4mm; }
.ak { width: 100%; border-collapse: collapse; font-family: ${theme.headingFont}; font-size: 10pt; }
.ak td { height: 5.6mm; border: 0.5pt solid #bfbfbf; text-align: center; padding: 0 1mm; }
.ak .ak-head td { background: #a6a6a6; height: 4.2mm; border-color: #a6a6a6; }
.ak tr:nth-child(even) td { background: #ededed; }
.ak td.ak-n { font-weight: 700; text-align: right; width: ${(100 / theme.answerKeyCols) * 0.55}%; }
.ak td.ak-a { font-weight: 700; width: ${(100 / theme.answerKeyCols) * 0.45}%; }

/* proofing aids (screen only) */
.interactive .blk.review { outline: 1.4pt dashed rgba(220, 38, 38, .8); outline-offset: 1pt; }
.interactive .blk:hover { background: rgba(13, 148, 136, .07); cursor: pointer; }
.interactive .blk.sel { outline: 1.6pt solid #0d9488; outline-offset: 1pt; }
</style>
</head>
<body class="${o.interactive ? "interactive" : ""}">
<div id="wm-template" hidden>${watermarkHtml(model, o)}</div>
<div id="src">${flow.join("\n")}</div>
<div id="pages"></div>
<script>window.__BOOK_CFG = ${JSON.stringify({ ...cfg, margins: m, header: { top: theme.headerTop } }).replace(/</g, "\\u003c")};</script>
<script>${PAGINATOR}</script>
</body>
</html>`;
}
