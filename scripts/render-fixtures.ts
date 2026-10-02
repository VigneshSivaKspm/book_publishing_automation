/**
 * Renderer regression: writes the reference fixtures as documents, exports
 * them through the running API server, prints the preflight report and
 * rasterizes chosen pages for visual comparison with the golden PDFs.
 *
 *   node server/index.ts            (in another terminal)
 *   node scripts/render-fixtures.ts [outDir]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as mupdf from "mupdf";
import { config } from "../server/config.ts";
import { docDir, ensureDir, writeJson } from "../server/storage.ts";
import { questionBankFixture, syllabusFixture } from "./fixtures/referenceModels.ts";

const outDir = path.resolve(process.argv[2] ?? path.join(config.dataDir, "regression"));
ensureDir(outDir);
const api = `http://127.0.0.1:${config.port}`;
const auth: Record<string, string> = config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {};

async function ppcFigure(): Promise<Buffer> {
  // Simple PPC-style graph (stand-in for an extracted source figure).
  const pts = [[0, 25], [100, 23], [200, 20], [300, 15], [400, 8], [500, 0]];
  const X = (v: number) => 60 + v * 0.9;
  const Y = (v: number) => 290 - v * 10;
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${X(x)},${Y(y)}`).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="330" viewBox="0 0 560 330"><rect width="560" height="330" fill="#fff"/>
  <line x1="60" y1="290" x2="530" y2="290" stroke="#000" stroke-width="1.5"/><line x1="60" y1="290" x2="60" y2="20" stroke="#000" stroke-width="1.5"/>
  <path d="${path}" fill="none" stroke="#000" stroke-width="2"/>
  ${pts.map(([x, y], i) => `<circle cx="${X(x)}" cy="${Y(y)}" r="4"/><text x="${X(x) + 6}" y="${Y(y) - 6}" font-family="Arial" font-size="13">P${i + 1}</text>`).join("")}
  <text x="250" y="320" font-family="Arial" font-size="14">Food Production</text><text x="18" y="160" font-family="Arial" font-size="14" transform="rotate(-90 18 160)">No of Cars</text></svg>`;
  return sharp(Buffer.from(svg), { density: 300 }).png().toBuffer();
}

async function exportDoc(id: string) {
  const res = await fetch(`${api}/api/documents/${id}/export`, { method: "POST", headers: auth });
  const body = (await res.json()) as { preflight?: { checks: { name: string; status: string; detail: string }[]; readyForPrint: boolean; pageCount: number }; error?: { message: string } };
  if (!res.ok) throw new Error(`export ${id} failed: ${body.error?.message}`);
  return body.preflight!;
}

function rasterize(id: string, pages: number[], tag: string) {
  const pdf = fs.readFileSync(docDir(id, "output", "book.pdf"));
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  for (const n of pages) {
    if (n > doc.countPages()) continue;
    const pix = doc.loadPage(n - 1).toPixmap(mupdf.Matrix.scale(110 / 72, 110 / 72), mupdf.ColorSpace.DeviceRGB, false, true);
    fs.writeFileSync(path.join(outDir, `${tag}-p${n}.png`), pix.asPNG());
  }
  fs.copyFileSync(docDir(id, "output", "book.pdf"), path.join(outDir, `${tag}.pdf`));
}

const qbId = "doc-fixture-qb";
const syId = "doc-fixture-syllabus";
ensureDir(docDir(qbId));
writeJson(docDir(qbId, "model.json"), questionBankFixture(qbId));

ensureDir(docDir(syId, "assets"));
fs.writeFileSync(docDir(syId, "assets", "asset_fxppc.png"), await ppcFigure());
const sy = syllabusFixture(syId, "asset_fxppc");
sy.assets.push({ id: "asset_fxppc", kind: "figure", file: "asset_fxppc.png", widthPx: 2333, heightPx: 1375, dpi: 600, sourcePage: 4, bbox: null });
writeJson(docDir(syId, "model.json"), sy);

let failed = false;
for (const [id, tag] of [[qbId, "qb"], [syId, "syllabus"]] as const) {
  const started = Date.now();
  const pf = await exportDoc(id);
  console.log(`\n=== ${tag}: ${pf.pageCount} pages in ${Date.now() - started} ms — ${pf.readyForPrint ? "READY FOR PRINT" : "NOT READY"}`);
  for (const c of pf.checks) console.log(`  ${c.status.toUpperCase().padEnd(5)} ${c.name.padEnd(26)} ${c.detail}`);
  if (!pf.readyForPrint) failed = true;
  rasterize(id, [1, 2, 3, pf.pageCount], tag);
}
console.log(`\nPage images and PDFs written to ${outDir}`);
process.exit(failed ? 1 : 0);
