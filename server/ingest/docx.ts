import mammoth from "mammoth";
import { getBrowser } from "../render/browser.ts";

/**
 * DOCX → semantic HTML (mammoth keeps headings, lists, tables, bold/italic and
 * embedded images) → laid out by Chromium into a digital PDF. The result then
 * flows through the same hybrid digital-PDF path as any other document, so
 * layout analysis, figure handling and OCR fallbacks behave identically.
 *
 * Limitation: Word equations (OMML) are not exported by mammoth; pages that
 * lose equations are flagged by the OCR stage via `notes`/low confidence.
 */
export async function docxToPdf(buf: Buffer): Promise<{ pdf: Buffer; warnings: string[] }> {
  const result = await mammoth.convertToHtml({ buffer: buf });
  const warnings = result.messages.filter((m) => m.type === "warning").map((m) => m.message).slice(0, 20);
  if (buf.includes(Buffer.from("<m:oMath"))) {
    warnings.push("This Word file contains equations (OMML). They cannot be read from the file structure and must be verified in the review screen.");
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "Times New Roman", "Noto Serif", serif; font-size: 11pt; line-height: 1.35; }
    table { border-collapse: collapse; } td, th { border: 1px solid #000; padding: 2pt 4pt; vertical-align: top; }
    img { max-width: 100%; }
  </style></head><body>${result.value}</body></html>`;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdf = Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
    return { pdf, warnings };
  } finally {
    await page.close();
  }
}
