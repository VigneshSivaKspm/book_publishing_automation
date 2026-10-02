import fs from "node:fs";
import path from "node:path";
import { config } from "../config.ts";
import { HttpError } from "../http.ts";
import { docDir, ensureDir, readJson, sha256, writeJson } from "../storage.ts";
import { detectKind, type SourceKind } from "./detect.ts";
import { normalizeScan, thumbnail } from "./image.ts";
import { analyzePdf, openPdf, renderPdfPage, type PdfPageAnalysis } from "./pdf.ts";
import { docxToPdf } from "./docx.ts";
import type { SourcePageInfo } from "../../shared/model.ts";

export interface SourceFileRecord {
  file: string;
  originalName: string;
  kind: SourceKind;
  bytes: number;
  sha256: string;
  order: number;
}

export interface PageRecord extends SourcePageInfo {
  dpi: number;
  textLayer: string;
  imageRegions: PdfPageAnalysis["imageRegions"];
  medianFontPt: number | null;
  /** Present for scans: the image before deskew/contrast normalization. */
  originalImage: string | null;
}

export function listSources(documentId: string): SourceFileRecord[] {
  return readJson<SourceFileRecord[]>(docDir(documentId, "sources", "index.json")) ?? [];
}

export function addSource(documentId: string, originalName: string, safeName: string, buf: Buffer): SourceFileRecord {
  const kind = detectKind(buf, originalName);
  const sources = listSources(documentId);
  const order = sources.length + 1;
  const file = `${String(order).padStart(3, "0")}-${safeName}`;
  ensureDir(docDir(documentId, "sources"));
  fs.writeFileSync(docDir(documentId, "sources", file), buf);
  const rec: SourceFileRecord = { file, originalName: safeName, kind, bytes: buf.length, sha256: sha256(buf), order };
  writeJson(docDir(documentId, "sources", "index.json"), [...sources, rec]);
  return rec;
}

export function pageRecordPath(documentId: string, index: number): string {
  return docDir(documentId, "pages", `${index}.meta.json`);
}

export function loadPageRecords(documentId: string): PageRecord[] {
  const dir = docDir(documentId, "pages");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+\.meta\.json$/.test(f))
    .map((f) => readJson<PageRecord>(path.join(dir, f))!)
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
}

export function pageImagePath(documentId: string, index: number): string {
  return docDir(documentId, "pages", `${index}.png`);
}

/**
 * Normalize every uploaded source into numbered page images + page records.
 * Idempotent and resumable: pages already normalized from the same source
 * hash are skipped.
 */
export async function normalizeSources(
  documentId: string,
  onProgress: (msg: string, done: number, total: number) => void,
): Promise<{ pages: PageRecord[]; warnings: string[] }> {
  const sources = listSources(documentId);
  if (!sources.length) throw new HttpError(400, "no_files", "No files were uploaded for this document.");
  ensureDir(docDir(documentId, "pages"));
  const warnings: string[] = [];
  const pages: PageRecord[] = [];
  let index = 0;

  // First pass: count pages so progress and the page limit are known up front.
  type Plan = { src: SourceFileRecord; pdf?: ReturnType<typeof openPdf>; analysis?: PdfPageAnalysis[] };
  const plans: Plan[] = [];
  let total = 0;
  for (const src of sources) {
    const buf = fs.readFileSync(docDir(documentId, "sources", src.file));
    if (src.kind === "pdf" || src.kind === "docx") {
      let pdfBuf: Buffer = buf;
      if (src.kind === "docx") {
        const converted = await docxToPdf(buf);
        pdfBuf = converted.pdf;
        warnings.push(...converted.warnings.map((w) => `${src.originalName}: ${w}`));
      }
      const pdf = openPdf(pdfBuf);
      const analysis = analyzePdf(pdf);
      plans.push({ src, pdf, analysis });
      total += analysis.length;
    } else {
      plans.push({ src });
      total += 1;
    }
  }
  if (total > config.maxPages) {
    throw new HttpError(413, "too_many_pages", `The upload has ${total} pages; the configured maximum is ${config.maxPages}.`);
  }

  for (const plan of plans) {
    const { src } = plan;
    if (plan.pdf && plan.analysis) {
      for (const a of plan.analysis) {
        index++;
        const existing = readJson<PageRecord>(pageRecordPath(documentId, index));
        if (existing && existing.sourceFile === src.file && existing.filePage === a.filePage && fs.existsSync(pageImagePath(documentId, index))) {
          pages.push(existing);
          onProgress(`Page ${index} already rendered`, index, total);
          continue;
        }
        const dense = a.medianFontPt !== null && a.medianFontPt < 8.5;
        const dpi = dense ? config.ocrDpiDense : config.ocrDpi;
        onProgress(`Rendering page ${index} of ${total} at ${dpi} DPI (${a.method})`, index - 1, total);
        let png = renderPdfPage(plan.pdf, a.filePage - 1, dpi);
        let originalImage: string | null = null;
        if (a.method === "scanned") {
          fs.writeFileSync(docDir(documentId, "pages", `${index}.orig.png`), png);
          originalImage = `${index}.orig.png`;
          png = (await normalizeScan(png)).png;
        }
        pages.push(await writePage(documentId, index, png, {
          sourceFile: src.file,
          filePage: a.filePage,
          method: src.kind === "docx" ? "docx" : a.method,
          widthPt: a.widthPt,
          heightPt: a.heightPt,
          dpi,
          textLayer: a.method === "scanned" ? "" : a.textLayer,
          imageRegions: a.imageRegions,
          medianFontPt: a.medianFontPt,
          originalImage,
        }));
      }
    } else {
      index++;
      const existing = readJson<PageRecord>(pageRecordPath(documentId, index));
      if (existing && existing.sourceFile === src.file && fs.existsSync(pageImagePath(documentId, index))) {
        pages.push(existing);
        continue;
      }
      onProgress(`Normalizing image ${src.originalName}`, index - 1, total);
      const buf = fs.readFileSync(docDir(documentId, "sources", src.file));
      fs.writeFileSync(docDir(documentId, "pages", `${index}.orig.png`), await (await import("sharp")).default(buf).rotate().png().toBuffer());
      const norm = await normalizeScan(buf);
      if (norm.skewDeg) warnings.push(`${src.originalName}: corrected ${norm.skewDeg.toFixed(2)}° skew`);
      // Assume the photo spans an A4-like page for physical sizing.
      const dpi = Math.round(norm.height / (297 / 25.4));
      pages.push(await writePage(documentId, index, norm.png, {
        sourceFile: src.file,
        filePage: 1,
        method: "image",
        widthPt: (norm.width / dpi) * 72,
        heightPt: (norm.height / dpi) * 72,
        dpi,
        textLayer: "",
        imageRegions: [],
        medianFontPt: null,
        originalImage: `${index}.orig.png`,
      }));
    }
    onProgress(`Normalized ${src.originalName}`, index, total);
  }
  return { pages, warnings };
}

async function writePage(
  documentId: string,
  index: number,
  png: Buffer,
  info: Omit<PageRecord, "index" | "hash" | "thumbnail" | "ocrConfidence" | "status" | "error">,
): Promise<PageRecord> {
  fs.writeFileSync(pageImagePath(documentId, index), png);
  fs.writeFileSync(docDir(documentId, "pages", `${index}.thumb.jpg`), await thumbnail(png));
  const rec: PageRecord = {
    ...info,
    index,
    hash: sha256(png),
    thumbnail: `${index}.thumb.jpg`,
    ocrConfidence: null,
    status: "pending",
    error: null,
  };
  writeJson(pageRecordPath(documentId, index), rec);
  return rec;
}
