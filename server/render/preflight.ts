import * as mupdf from "mupdf";
import crypto from "node:crypto";
import { allNodes, trimSizeMm, type BookModel, type PreflightCheck, type PreflightReport } from "../../shared/model.ts";
import type { PaginationReport } from "./pdf.ts";

const PT_PER_MM = 72 / 25.4;

interface FontInfo {
  name: string;
  embedded: boolean;
}

/** Walk page + form XObject resources and report every font and whether it is embedded. */
function collectFonts(doc: mupdf.PDFDocument): FontInfo[] {
  const fonts = new Map<string, FontInfo>();
  const seenRes = new Set<string>();
  const visitResources = (res: mupdf.PDFObject) => {
    if (!res || res.isNull()) return;
    const key = res.isIndirect() ? `r${res.asIndirect()}` : null;
    if (key) {
      if (seenRes.has(key)) return;
      seenRes.add(key);
    }
    const fontDict = res.get("Font");
    if (fontDict && !fontDict.isNull()) {
      fontDict.forEach((f) => {
        const font = f.resolve();
        const subtype = font.get("Subtype").isName() ? font.get("Subtype").asName() : "";
        const base = font.get("BaseFont").isName() ? font.get("BaseFont").asName() : subtype;
        let embedded = subtype === "Type3";
        let desc = font.get("FontDescriptor");
        if (subtype === "Type0") {
          const d = font.get("DescendantFonts");
          if (d.isArray() && d.length) desc = d.get(0).resolve().get("FontDescriptor");
        }
        if (!embedded && desc && !desc.isNull()) {
          const dd = desc.resolve();
          embedded = ["FontFile", "FontFile2", "FontFile3"].some((k) => !dd.get(k).isNull());
        }
        const id = f.isIndirect() ? `f${f.asIndirect()}` : base;
        if (!fonts.has(id)) fonts.set(id, { name: base, embedded });
      });
    }
    const xo = res.get("XObject");
    if (xo && !xo.isNull()) {
      xo.forEach((x) => {
        const obj = x.resolve();
        if (obj.get("Subtype").isName() && obj.get("Subtype").asName() === "Form") visitResources(obj.get("Resources").resolve());
      });
    }
  };
  for (let i = 0; i < doc.countPages(); i++) visitResources(doc.findPage(i).getInheritable("Resources").resolve());
  return [...fonts.values()];
}

export function runPreflight(pdf: Buffer, report: PaginationReport, model: BookModel): PreflightReport {
  const checks: PreflightCheck[] = [];
  const add = (name: string, status: PreflightCheck["status"], detail: string) => checks.push({ name, status, detail });
  const doc = mupdf.Document.openDocument(pdf, "application/pdf").asPDF()!;
  const n = doc.countPages();
  const { widthMm, heightMm } = trimSizeMm(model.settings);
  const W = widthMm * PT_PER_MM;
  const H = heightMm * PT_PER_MM;

  // 1-2. Page dimensions & uniform trim.
  const bad: number[] = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0, x1, y1] = doc.loadPage(i).getBounds();
    if (Math.abs(x1 - x0 - W) > 0.15 || Math.abs(y1 - y0 - H) > 0.15) bad.push(i + 1);
  }
  add("Page Size", bad.length ? "fail" : "pass", bad.length ? `Pages ${bad.slice(0, 10).join(", ")} are not ${widthMm} × ${heightMm} mm.` : `All ${n} pages are ${widthMm} × ${heightMm} mm.`);

  // 3. Fonts embedded.
  const fonts = collectFonts(doc);
  const notEmbedded = fonts.filter((f) => !f.embedded);
  add("Fonts Embedded", notEmbedded.length ? "fail" : "pass", notEmbedded.length ? `Not embedded: ${notEmbedded.map((f) => f.name).join(", ")}` : `${fonts.length} font(s), all embedded.`);

  // 4. Page count consistency.
  add("Page Count", n === report.pages && n > 0 ? "pass" : "fail", `PDF has ${n} pages; layout produced ${report.pages}.`);

  // Text extraction per page (searchability, glyphs, blanks, duplicates, page numbers).
  const texts: string[] = [];
  for (let i = 0; i < n; i++) texts.push(doc.loadPage(i).toStructuredText("preserve-whitespace").asText());
  const totalChars = texts.reduce((s, t) => s + t.replace(/\s/g, "").length, 0);
  add("Searchable Text", totalChars > 50 * n * 0.2 ? "pass" : "fail", `${totalChars.toLocaleString()} characters of selectable vector text.`);

  const replacement = texts.map((t, i) => (t.includes("�") ? i + 1 : 0)).filter(Boolean);
  const glyphOk = replacement.length === 0 && report.fontsOk;
  add("Missing Glyphs", glyphOk ? "pass" : "fail", glyphOk ? "No replacement glyphs; book fonts loaded." : replacement.length ? `Replacement characters on pages ${replacement.join(", ")}.` : "A book font failed to load.");

  // 5. Page numbers present in footers.
  const missingNums = texts.map((t, i) => (new RegExp(`(^|\\D)${i + 1}(\\D|$)`).test(t) ? 0 : i + 1)).filter(Boolean);
  add("Page Numbers", missingNums.length ? "fail" : "pass", missingNums.length ? `Page number not found on pages ${missingNums.slice(0, 10).join(", ")}.` : "Every page carries its page number.");

  // 6-7. Images.
  const expectedImages = model.assets.filter((a) => a.kind === "figure").length;
  add("Images Present", report.missingImages.length ? "fail" : "pass", report.missingImages.length ? `${report.missingImages.length} image(s) failed to load (pages ${[...new Set(report.missingImages.map((m) => m.page))].join(", ")}).` : `${expectedImages} figure asset(s), all loaded.`);
  add("Image Resolution", report.lowRes.length ? "warn" : "pass", report.lowRes.length ? `${report.lowRes.length} image(s) below 200 DPI at print size (lowest ${Math.min(...report.lowRes.map((l) => l.dpi))} DPI).` : "All images ≥ 200 DPI at final size.");

  // 8-10. Overflow / clipping / equations.
  add("Overflow", report.overflows.length ? "fail" : "pass", report.overflows.length ? `${report.overflows.length} block(s) taller than a full column (pages ${report.overflows.map((o) => o.page).join(", ")}).` : "No content exceeds its column.");
  add("Clipping / Out of Bounds", report.clipped.length ? "fail" : "pass", report.clipped.length ? `${report.clipped.length} block(s) extend beyond the text area (pages ${[...new Set(report.clipped.map((c) => c.page))].join(", ")}).` : "All content inside printable bounds.");
  add("Equation Validation", report.katexErrors ? "fail" : "pass", report.katexErrors ? `${report.katexErrors} equation(s) failed to render.` : "All equations rendered.");

  // 11-12. Blank and duplicate pages.
  const blanks = [...new Set([...report.emptyPages, ...texts.map((t, i) => (t.replace(/\s/g, "").length < 3 ? i + 1 : 0)).filter(Boolean)])];
  add("Blank Pages", blanks.length ? "fail" : "pass", blanks.length ? `Blank pages: ${blanks.join(", ")}.` : "No unintended blank pages.");
  const hashes = texts.map((t) => crypto.createHash("sha1").update(t.replace(/\d+/g, "#").replace(/\s+/g, " ")).digest("hex"));
  const dups = hashes.map((h, i) => (i > 0 && h === hashes[i - 1] && texts[i].replace(/\s/g, "").length > 40 ? i + 1 : 0)).filter(Boolean);
  add("Duplicate Pages", dups.length ? "fail" : "pass", dups.length ? `Pages ${dups.join(", ")} repeat the previous page.` : "No duplicated pages.");

  // 13. Nothing dropped by layout.
  const nodeIds = new Set(allNodes(model).map((x) => x.id));
  const placed = new Set(report.placedNodes);
  const dropped = [...nodeIds].filter((id) => !placed.has(id));
  add("Content Completeness", dropped.length ? "fail" : "pass", dropped.length ? `${dropped.length} content block(s) missing from the layout.` : `All ${nodeIds.size} content blocks placed.`);

  // 14. Unresolved review issues.
  const blocking = model.issues.filter((i) => !i.resolved && i.severity === "blocking");
  const warnings = model.issues.filter((i) => !i.resolved && i.severity === "warning");
  add("Review Issues", blocking.length ? "fail" : warnings.length ? "warn" : "pass", blocking.length ? `${blocking.length} blocking review issue(s) unresolved.` : warnings.length ? `${warnings.length} review warning(s) not yet resolved.` : "All review issues resolved.");

  // 15. Question bank integrity.
  if (model.bookType === "question_bank") {
    const qs = allNodes(model).filter((x) => x.kind === "question");
    const unplaced = qs.filter((q) => !placed.has(q.id)).length;
    add("Questions", unplaced ? "fail" : "pass", `${qs.length} question(s) in the book${unplaced ? `, ${unplaced} not placed` : ", all placed"}.`);
  }

  return { checks, pageCount: n, readyForPrint: !checks.some((c) => c.status === "fail"), generatedAt: new Date().toISOString() };
}
