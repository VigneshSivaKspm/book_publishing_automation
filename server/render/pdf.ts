import fs from "node:fs";
import { PDFDocument, PDFName, PDFArray, PDFNumber } from "pdf-lib";
import { getBrowser } from "./browser.ts";
import { docDir, ensureDir, writeJson } from "../storage.ts";
import { trimSizeMm, type BookModel } from "../../shared/model.ts";

export interface PaginationReport {
  pages: number;
  overflows: { page: number; node: string | null }[];
  clipped: { page: number; node: string | null }[];
  lowRes: { page: number; dpi: number; node: string | null }[];
  katexErrors: number;
  emptyPages: number[];
  fontsOk: boolean;
  missingImages: { page: number; src: string | null }[];
  placedNodes: string[];
  error?: string;
}

const PT_PER_MM = 72 / 25.4;

/**
 * Render the book HTML in headless Chromium and print it to PDF at the exact
 * trim size. Chromium rounds page sizes to whole CSS pixels, so the page
 * boxes are corrected afterwards to the exact millimetre trim (content is
 * top-left anchored and the correction is < 1 pt, inside the margins).
 */
export async function renderPdf(model: BookModel, bookUrl: string): Promise<{ pdf: Buffer; report: PaginationReport }> {
  const { widthMm, heightMm } = trimSizeMm(model.settings);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.emulateMediaType("print");
    await page.goto(bookUrl, { waitUntil: "load", timeout: 120_000 });
    await page.waitForFunction("window.__PAGINATION !== undefined", { timeout: 300_000, polling: 250 });
    const report = (await page.evaluate(`(() => {
      const r = window.__PAGINATION;
      r.placedNodes = Array.from(new Set(Array.from(document.querySelectorAll('#pages .blk[data-node]')).map(e => e.getAttribute('data-node'))));
      return r;
    })()`)) as PaginationReport;
    if (report.error) throw new Error(`Pagination failed: ${report.error}`);
    const raw = await page.pdf({
      width: `${widthMm}mm`,
      height: `${heightMm}mm`,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      timeout: 600_000,
    });
    const pdf = await fixBoxes(Buffer.from(raw), widthMm, heightMm, model);
    return { pdf, report };
  } finally {
    await page.close();
  }
}

async function fixBoxes(raw: Buffer, widthMm: number, heightMm: number, model: BookModel): Promise<Buffer> {
  const doc = await PDFDocument.load(raw);
  const W = widthMm * PT_PER_MM;
  const H = heightMm * PT_PER_MM;
  for (const p of doc.getPages()) {
    const { height: h0 } = p.getMediaBox();
    const box = PDFArray.withContext(doc.context);
    [0, h0 - H, W, h0].forEach((v) => box.push(PDFNumber.of(Number(v.toFixed(4)))));
    for (const key of ["MediaBox", "CropBox", "TrimBox", "BleedBox"]) p.node.set(PDFName.of(key), box);
  }
  const s = model.settings;
  doc.setTitle(s.bookName || s.chapterName || "Book");
  if (s.organisationName) doc.setAuthor(s.organisationName);
  doc.setSubject(s.subjectName || "");
  doc.setProducer("Publication Studio print engine");
  doc.setCreator("Publication Studio");
  return Buffer.from(await doc.save({ useObjectStreams: true }));
}

export function saveOutput(documentId: string, pdf: Buffer, report: PaginationReport): string {
  const dir = ensureDir(docDir(documentId, "output"));
  fs.writeFileSync(`${dir}/book.pdf`, pdf);
  writeJson(`${dir}/pagination.json`, report);
  return `${dir}/book.pdf`;
}
