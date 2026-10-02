/**
 * End-to-end pipeline test (no OpenAI account needed).
 *
 * Starts a local stand-in for the OpenAI Responses API (wire-compatible,
 * test-only) and the real API server against a temporary data directory, then
 * drives the full workflow over HTTP: upload → normalize → extract → assemble
 * → review issues → export PDF → preflight. It verifies retry/backoff on 429,
 * schema handling, caching, digital vs scanned detection, auto book-type
 * detection and answer-key attachment.
 *
 * The stand-in derives page content from the text layer the pipeline sends
 * (digital pages) — it is a protocol double, not an OCR engine.
 *
 *   node scripts/test-pipeline.ts <fixture-question-bank.pdf>
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import * as mupdf from "mupdf";
import { startFakeOpenAI } from "./fake-openai.ts";

const fixture = process.argv[2];
if (!fixture || !fs.existsSync(fixture)) {
  console.error("usage: node scripts/test-pipeline.ts <question-bank.pdf>");
  process.exit(2);
}

/* ---------------- OpenAI Responses API stand-in ---------------- */
const fake = await startFakeOpenAI(8899);
const stats = fake.stats;

/* ---------------- start the real API server ---------------- */
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-test-"));
const port = 8790;
let serverLog = "";
function startServer() {
  const child = spawn(process.execPath, ["server/index.ts"], {
    env: { ...process.env, OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: "http://127.0.0.1:8899/v1", DATA_DIR: dataDir, API_PORT: String(port), OCR_CONCURRENCY: "3", APP_ACCESS_TOKEN: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => (serverLog += d));
  child.stderr.on("data", (d) => (serverLog += d));
  return child;
}
const api = `http://127.0.0.1:${port}`;
async function waitHealthy() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${api}/api/health`)).ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error("server did not start");
}
let server = startServer();
await waitHealthy();

async function call<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${api}${url}`, {
    method,
    headers: { ...(body && !(body instanceof Buffer) ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${json.error?.message}`);
  return json;
}

async function waitJob(id: string) {
  for (let i = 0; i < 600; i++) {
    const { job, running } = await call<{ job: { state: string; message: string; events: { message: string }[] }; running: boolean }>("GET", `/api/documents/${id}/job`);
    if (!running && ["completed", "needs_review", "failed", "cancelled"].includes(job.state)) return job;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("job timeout");
}

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => results.push([name, ok, detail]);

try {
  // 1. Signature validation.
  const { documentId: badId } = await call<{ documentId: string }>("POST", "/api/documents", { settings: {} });
  const bad = await fetch(`${api}/api/documents/${badId}/files`, { method: "POST", headers: { "X-Filename": "evil.pdf" }, body: Buffer.from("MZ\x90\x00 not a pdf") });
  check("Rejects files whose bytes are not a supported type", bad.status === 415, `status ${bad.status}`);

  // 2. Digital PDF, auto-detect.
  const { documentId } = await call<{ documentId: string }>("POST", "/api/documents", {
    settings: { organisationName: "Karthikeyan Analysis Study Circle", footerText: "Karthikeyan Analysis Learning Resources" },
  });
  await call("POST", `/api/documents/${documentId}/files`, fs.readFileSync(fixture), { "X-Filename": encodeURIComponent(path.basename(fixture)) });
  await call("POST", `/api/documents/${documentId}/process`, { bookType: "auto" });
  const job = await waitJob(documentId);
  check("Job finishes", ["completed", "needs_review"].includes(job.state), `${job.state}: ${job.message}`);
  check("429 handled with backoff and retried", job.events.some((e) => /rate limit/i.test(e.message)), "");
  const doc = await call<{ model: { bookType: string; sourcePages: { method: string }[]; chapters: { nodes: { kind: string; answer?: string }[] }[] }; metrics: Record<string, unknown> }>("GET", `/api/documents/${documentId}`);
  const srcPages = mupdf.Document.openDocument(fs.readFileSync(fixture), "application/pdf").countPages();
  check("All source pages recognized", doc.model.sourcePages.length === srcPages, `${doc.model.sourcePages.length}/${srcPages}`);
  check("Digital pages use the native text layer", doc.model.sourcePages.every((p) => p.method === "digital"), doc.model.sourcePages.map((p) => p.method).join(","));
  check("Auto-detected question bank", doc.model.bookType === "question_bank", doc.model.bookType);
  const m = doc.metrics as { questions: number; questionNumbersMissing: number[]; questionNumbersDuplicated: number[]; questionsWithAnswers: number; answerKeyEntries: number };
  check("Question numbers: none duplicated", m.questionNumbersDuplicated.length === 0, JSON.stringify(m.questionNumbersDuplicated));
  check("Answer key detected and attached", m.answerKeyEntries > 0 && m.questionsWithAnswers === m.questions, `${m.questionsWithAnswers}/${m.questions} answered, ${m.answerKeyEntries} key entries`);
  check("Missing-number gap is reported (fixture jumps 60→112)", (m.questionNumbersMissing as number[]).includes(61), `missing ${m.questionNumbersMissing.length}`);
  check("Digital pages send 1 image (no zoom bands)", stats.imagesSeen.every((n) => n === 1), stats.imagesSeen.join(","));

  // 3. Cache: re-process without changes performs no new OCR calls.
  const before = stats.requests;
  await call("POST", `/api/documents/${documentId}/process`, { bookType: "auto" });
  await waitJob(documentId);
  check("Re-processing reuses stored extraction (no API cost)", stats.requests === before, `${stats.requests - before} new request(s)`);

  // 4. Edit persists and re-validates.
  const full = await call<{ model: { chapters: { nodes: { kind: string; stem?: string; id: string }[] }[] } }>("GET", `/api/documents/${documentId}`);
  const q1 = full.model.chapters[0].nodes.find((n) => n.kind === "question")!;
  q1.stem = "Edited stem with broken math $\\frac{1}{$";
  const saved = await call<{ model: { issues: { nodeId: string; severity: string }[] } }>("PUT", `/api/documents/${documentId}/model`, { model: full.model });
  check("Correction persists and invalid LaTeX becomes a blocking issue", saved.model.issues.some((i) => i.nodeId === q1.id && i.severity === "blocking"), "");
  const reread = await call<{ model: { chapters: { nodes: { id: string; stem?: string }[] }[] } }>("GET", `/api/documents/${documentId}`);
  check("Corrections persist on reload", reread.model.chapters[0].nodes.find((n) => n.id === q1.id)?.stem === q1.stem, "");

  // 5. Export with a blocking issue must NOT be ready for print.
  const exp1 = await call<{ preflight: { readyForPrint: boolean; checks: { name: string; status: string }[] } }>("POST", `/api/documents/${documentId}/export`);
  check("Preflight refuses READY FOR PRINT with unresolved blocking issues", !exp1.preflight.readyForPrint, exp1.preflight.checks.filter((c) => c.status === "fail").map((c) => c.name).join(", "));
  q1.stem = "Evaluate $\\frac{1}{2}$";
  await call("PUT", `/api/documents/${documentId}/model`, { model: full.model });
  const exp2 = await call<{ preflight: { readyForPrint: boolean; pageCount: number; checks: { name: string; status: string; detail: string }[] } }>("POST", `/api/documents/${documentId}/export`);
  const fails = exp2.preflight.checks.filter((c) => c.status === "fail");
  check("After correction, export passes preflight", exp2.preflight.readyForPrint, fails.map((c) => `${c.name}: ${c.detail}`).join("; "));
  const pdfRes = await fetch(`${api}/api/documents/${documentId}/output/book.pdf`);
  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
  check("PDF downloads", pdfRes.ok && pdfBytes.subarray(0, 5).toString() === "%PDF-", `${pdfBytes.length} bytes`);

  // 6. Scanned input: image-only PDF built from two rasterized pages.
  const src = mupdf.Document.openDocument(fs.readFileSync(fixture), "application/pdf");
  const scan = await PDFDocument.create();
  for (let i = 0; i < 2; i++) {
    const png = src.loadPage(i).toPixmap(mupdf.Matrix.scale(200 / 72, 200 / 72), mupdf.ColorSpace.DeviceRGB, false, true).asPNG();
    const img = await scan.embedPng(png);
    const pg = scan.addPage([510.24, 680.31]);
    pg.drawImage(img, { x: 0, y: 0, width: 510.24, height: 680.31 });
  }
  const { documentId: scanId } = await call<{ documentId: string }>("POST", "/api/documents", { settings: {} });
  await call("POST", `/api/documents/${scanId}/files`, Buffer.from(await scan.save()), { "X-Filename": "scan.pdf" });
  stats.imagesSeen = [];
  await call("POST", `/api/documents/${scanId}/process`, { bookType: "question_bank" });
  const scanJob = await waitJob(scanId);
  const scanDoc = await call<{ model: { sourcePages: { method: string }[]; bookType: string } }>("GET", `/api/documents/${scanId}`);
  check("Scanned pages detected as raster", scanDoc.model.sourcePages.every((p) => p.method === "scanned"), scanDoc.model.sourcePages.map((p) => p.method).join(","));
  check("Scanned pages sent with zoom bands", stats.imagesSeen.length > 0 && stats.imagesSeen.every((n) => n > 1), stats.imagesSeen.join(","));
  check("User override of book type respected", scanDoc.model.bookType === "question_bank", scanDoc.model.bookType);
  const orig = await fetch(`${api}/api/documents/${scanId}/pages/1/original`);
  check("Original (pre-cleanup) scan kept for comparison", orig.ok, String(orig.status));


  // 8. Combination upload: page image + DOCX in one book.
  const docx = process.argv[3];
  if (docx && fs.existsSync(docx)) {
    const { documentId: mixId } = await call<{ documentId: string }>("POST", "/api/documents", { settings: {} });
    const pagePng = Buffer.from(src.loadPage(0).toPixmap(mupdf.Matrix.scale(150 / 72, 150 / 72), mupdf.ColorSpace.DeviceRGB, false, true).asPNG());
    await call("POST", `/api/documents/${mixId}/files`, pagePng, { "X-Filename": "photo-page.png" });
    await call("POST", `/api/documents/${mixId}/files`, fs.readFileSync(docx), { "X-Filename": "notes.docx" });
    await call("POST", `/api/documents/${mixId}/process`, { bookType: "auto" });
    await waitJob(mixId);
    const mix = await call<{ model: { sourcePages: { method: string; sourceFile: string }[] } }>("GET", `/api/documents/${mixId}`);
    const methods = mix.model.sourcePages.map((p) => p.method);
    check("Image upload normalized as a page", methods[0] === "image", methods.join(","));
    check("DOCX converted and read through its text layer", methods.slice(1).length > 0 && methods.slice(1).every((m) => m === "docx"), methods.join(","));
  }

  // 9. Crash/restart resume: kill the server mid-job, restart, finish without redoing pages.
  stats.delayMs = 700;
  const { documentId: resId } = await call<{ documentId: string }>("POST", "/api/documents", { settings: {} });
  const noisy = Buffer.from(fs.readFileSync(fixture));
  await call("POST", `/api/documents/${resId}/files`, noisy, { "X-Filename": "resume.pdf" });
  // Different book-type hint → different cache key, so these pages really hit the API.
  await call("POST", `/api/documents/${resId}/process`, { bookType: "syllabus" });
  for (let i = 0; i < 200; i++) {
    const { job } = await call<{ job: { pagesDone: number } }>("GET", `/api/documents/${resId}/job`);
    if (job.pagesDone >= 3) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  server.kill();
  await new Promise((r) => setTimeout(r, 800));
  const reqBefore = stats.requests;
  server = startServer();
  await waitHealthy();
  const resumed = await waitJob(resId);
  const newCalls = stats.requests - reqBefore;
  check("Interrupted job resumes after restart", ["completed", "needs_review"].includes(resumed.state) && resumed.events.some((e) => /Resuming after restart/.test(e.message)), resumed.state);
  check("Resume does not redo finished pages", newCalls <= srcPages - 3, `${newCalls} page call(s) after restart for ${srcPages} pages`);
  stats.delayMs = 0;

  // 7. Diagnostics never leak the key.
  const diag = await (await fetch(`${api}/api/diagnostics?test=1`)).text();
  check("Diagnostics connection test passes and hides the key", diag.includes('"reachable":true') && !diag.includes("test-key"), "");
  check("Server logs never contain the key", !serverLog.includes("test-key"), "");
} catch (err) {
  check("Unexpected error", false, String(err));
} finally {
  server.kill();
  fake.server.close();
}

let failed = 0;
for (const [name, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed. Data dir: ${dataDir}`);
if (failed) console.log(serverLog.split("\n").filter((l) => /"level":"(warn|error)"/.test(l)).slice(-10).join("\n"));
else fs.rmSync(dataDir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
