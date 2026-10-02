import * as mupdf from "mupdf";
import { HttpError } from "../http.ts";

/** Per-page analysis of a PDF using MuPDF (native text + geometry first). */

export interface PdfPageAnalysis {
  filePage: number;
  widthPt: number;
  heightPt: number;
  method: "digital" | "scanned" | "mixed";
  textChars: number;
  imageCoverage: number;
  medianFontPt: number | null;
  /** Native text in block/line order; reliable characters, unreliable math layout. */
  textLayer: string;
  /** Embedded raster image regions (normalized), used to snap figure crops. */
  imageRegions: { x: number; y: number; w: number; h: number }[];
}

interface StextLine {
  text: string;
  font?: { size?: number };
}
interface StextBlock {
  type: "text" | "image";
  bbox: { x: number; y: number; w: number; h: number };
  lines?: StextLine[];
}

export function openPdf(buf: Buffer): mupdf.Document {
  let doc: mupdf.Document;
  try {
    doc = mupdf.Document.openDocument(buf, "application/pdf");
  } catch (err) {
    throw new HttpError(422, "pdf_unreadable", `The PDF could not be opened: ${String(err).slice(0, 160)}`);
  }
  if (doc.needsPassword()) {
    throw new HttpError(422, "pdf_encrypted", "The PDF is password-protected/encrypted. Remove the password and upload again.");
  }
  return doc;
}

export function analyzePdf(doc: mupdf.Document): PdfPageAnalysis[] {
  const pages: PdfPageAnalysis[] = [];
  const n = doc.countPages();
  for (let i = 0; i < n; i++) {
    const page = doc.loadPage(i);
    const [x0, y0, x1, y1] = page.getBounds();
    const W = x1 - x0;
    const H = y1 - y0;
    const st = JSON.parse(page.toStructuredText("preserve-images,preserve-whitespace").asJSON()) as { blocks: StextBlock[] };
    let textChars = 0;
    let imageArea = 0;
    const sizes: number[] = [];
    const lines: string[] = [];
    const imageRegions: PdfPageAnalysis["imageRegions"] = [];
    for (const b of st.blocks) {
      if (b.type === "image") {
        imageArea += b.bbox.w * b.bbox.h;
        imageRegions.push({ x: (b.bbox.x - x0) / W, y: (b.bbox.y - y0) / H, w: b.bbox.w / W, h: b.bbox.h / H });
        continue;
      }
      for (const l of b.lines ?? []) {
        const t = l.text.replace(/\s+/g, " ").trim();
        if (!t) continue;
        textChars += t.length;
        if (l.font?.size) sizes.push(l.font.size);
        lines.push(t);
      }
      lines.push("");
    }
    const imageCoverage = Math.min(1, imageArea / (W * H));
    const largestImage = imageRegions.reduce((m, r) => Math.max(m, r.w * r.h), 0);
    sizes.sort((a, b) => a - b);
    const medianFontPt = sizes.length ? sizes[Math.floor(sizes.length / 2)] : null;
    // Watermarks, logos and figures do not make a page "scanned": only a
    // near-full-page raster does (a scan, possibly with an invisible OCR layer).
    let method: PdfPageAnalysis["method"];
    if (textChars < 40) method = "scanned";
    else if (largestImage > 0.8) method = "mixed";
    else method = "digital";
    pages.push({
      filePage: i + 1,
      widthPt: W,
      heightPt: H,
      method,
      textChars,
      imageCoverage,
      medianFontPt,
      textLayer: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
      imageRegions,
    });
  }
  return pages;
}

export function renderPdfPage(doc: mupdf.Document, index: number, dpi: number): Buffer {
  const page = doc.loadPage(index);
  const pix = page.toPixmap(mupdf.Matrix.scale(dpi / 72, dpi / 72), mupdf.ColorSpace.DeviceRGB, false, true);
  return Buffer.from(pix.asPNG());
}
