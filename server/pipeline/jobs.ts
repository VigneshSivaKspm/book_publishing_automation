import fs from "node:fs";
import { config } from "../config.ts";
import { log } from "../log.ts";
import { listDocumentIds, loadJob, loadModel, newId, saveJob, saveModel, saveVersion } from "../storage.ts";
import { normalizeSources, loadPageRecords, type PageRecord } from "../ingest/index.ts";
import { ApiFailure, classifyError } from "../openai/client.ts";
import type { PageExtraction } from "../openai/schemas.ts";
import { extractOne, extractionPath, loadExtraction, sectionStateOf, tailOf } from "./extract.ts";
import { assemble } from "./assemble.ts";
import { defaultSettings, type BookSettings, type BookTypeChoice, type JobStatus } from "../../shared/model.ts";
import { readJson, docDir, writeJson } from "../storage.ts";

const running = new Map<string, { cancelled: boolean }>();

interface JobRequest {
  choice: BookTypeChoice;
  settings: BookSettings;
  /** Re-extract these pages even if cached results exist. */
  forcePages?: number[];
}

function requestPath(documentId: string) {
  return docDir(documentId, "job-request.json");
}

function event(job: JobStatus, level: "info" | "warn" | "error", message: string) {
  job.events.push({ at: new Date().toISOString(), level, message });
  if (job.events.length > 200) job.events.splice(0, job.events.length - 200);
  job.message = message;
  saveJob(job);
}

export function isRunning(documentId: string): boolean {
  return running.has(documentId);
}

export function startJob(documentId: string, req: JobRequest): JobStatus {
  if (running.has(documentId)) {
    const existing = loadJob(documentId);
    if (existing) return existing;
  }
  writeJson(requestPath(documentId), req);
  const now = new Date().toISOString();
  const job: JobStatus = {
    jobId: newId("job"),
    documentId,
    state: "queued",
    stage: "uploading",
    message: "Queued",
    pagesTotal: 0,
    pagesDone: 0,
    pagesFailed: 0,
    createdAt: now,
    updatedAt: now,
    error: null,
    events: [],
  };
  saveJob(job);
  void run(job, req);
  return job;
}

export function cancelJob(documentId: string): boolean {
  const r = running.get(documentId);
  if (!r) return false;
  r.cancelled = true;
  return true;
}

/** Called on server start: continue any job interrupted by a crash/restart. */
export function resumeInterruptedJobs(): void {
  for (const id of listDocumentIds()) {
    const job = loadJob(id);
    const req = readJson<JobRequest>(requestPath(id));
    if (job && req && (job.state === "processing" || job.state === "queued")) {
      log("info", "job.resume", { documentId: id, jobId: job.jobId, pagesDone: job.pagesDone });
      event(job, "info", `Resuming after restart (${job.pagesDone} pages already done).`);
      void run(job, req);
    }
  }
}

async function run(job: JobStatus, req: JobRequest): Promise<void> {
  const { documentId } = job;
  const control = { cancelled: false };
  running.set(documentId, control);
  const settings = defaultSettings(req.settings);
  try {
    job.state = "processing";
    job.stage = "analyzing";
    event(job, "info", "Analyzing document");

    const { pages, warnings } = await normalizeSources(documentId, (msg, done, total) => {
      job.stage = "rendering_pages";
      job.pagesTotal = total;
      job.message = msg;
      if (done % 5 === 0 || done === total) saveJob(job);
    });
    for (const w of warnings) event(job, "warn", w);
    job.pagesTotal = pages.length;
    event(job, "info", `Rendered ${pages.length} page(s): ${summarizeMethods(pages)}`);

    if (control.cancelled) return finishCancelled(job);

    // Extraction (resumable: pages with a stored extraction are skipped).
    job.stage = "extracting";
    const force = new Set(req.forcePages ?? []);
    for (const p of force) fs.rmSync(extractionPath(documentId, p), { force: true });
    const results = new Map<number, PageExtraction>();
    const failed = new Map<number, string>();
    for (const p of pages) {
      const prior = force.has(p.index) ? null : loadExtraction(documentId, p.index);
      if (prior) results.set(p.index, prior.extraction);
    }
    job.pagesDone = results.size;
    job.pagesFailed = 0;
    event(job, "info", results.size ? `Extracting text & structure (${results.size} page(s) reused from earlier run)` : "Extracting text & structure");

    const hint = req.choice === "auto" ? "unknown" : req.choice;
    const todo = pages.filter((p) => !results.has(p.index));
    let fatal: ApiFailure | null = null;
    let cursor = 0;
    const worker = async () => {
      while (cursor < todo.length && !control.cancelled && !fatal) {
        const page = todo[cursor++];
        const prevExtraction = results.get(page.index - 1) ?? null;
        const prevPage = pages.find((p) => p.index === page.index - 1);
        try {
          const stored = await extractOne(page, {
            documentId,
            jobId: job.jobId,
            totalPages: pages.length,
            bookTypeHint: hint,
            twoPass: settings.twoPass,
            correctionMode: settings.aiCorrectionMode,
            previousTail: tailOf(prevExtraction) ?? (prevPage?.textLayer ? prevPage.textLayer.slice(-240) : null),
            sectionState: sectionStateOf(prevExtraction, null),
            onRetry: (msg) => event(job, "warn", msg),
          });
          results.set(page.index, stored.extraction);
          job.pagesDone++;
          if (stored.precisionApplied.length) job.stage = "precision_pass";
          event(job, "info", `Page ${page.index} of ${pages.length} extracted (${stored.extraction.blocks.length} blocks${stored.precisionApplied.length ? `, ${stored.precisionApplied.length} re-read at high zoom` : ""})`);
        } catch (err) {
          const f = classifyError(err);
          if (["not_configured", "auth", "quota", "model_not_found"].includes(f.code)) {
            fatal = f;
            return;
          }
          failed.set(page.index, f.message);
          job.pagesFailed++;
          event(job, "error", `Page ${page.index} OCR failed after ${config.ocrMaxAttempts} attempts: ${f.message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(config.ocrConcurrency, todo.length || 1) }, worker));

    if (fatal) throw fatal;
    if (control.cancelled) return finishCancelled(job);

    job.stage = "building_book";
    event(job, "info", "Building book structure");
    const model = await assemble({
      documentId,
      settings,
      choice: req.choice,
      pages: loadPageRecords(documentId),
      extractions: results,
      failedPages: failed,
      ingestWarnings: warnings,
    });

    job.stage = "validating";
    const prior = loadModel(documentId);
    if (prior) saveVersion(prior, "draft", "Before re-extraction");
    saveModel(model);
    saveVersion(model, "draft", "Initial extraction");

    const blocking = model.issues.filter((i) => i.severity === "blocking").length;
    const warningsCount = model.issues.filter((i) => i.severity === "warning").length;
    job.stage = "done";
    job.state = blocking || warningsCount ? "needs_review" : "completed";
    event(
      job,
      blocking ? "warn" : "info",
      `Book built: ${model.bookType === "question_bank" ? "question bank" : model.bookType === "syllabus" ? "syllabus" : "unknown type"}, ` +
        `${model.chapters.reduce((n, c) => n + c.nodes.length, 0)} content blocks, ${blocking} blocking and ${warningsCount} review issue(s).`,
    );
  } catch (err) {
    const f = err instanceof ApiFailure ? err : classifyError(err);
    job.state = "failed";
    job.error = (err as { status?: number }).status ? (err as Error).message : f.message;
    log("error", "job.failed", { documentId, jobId: job.jobId, code: f.code, error: job.error });
    event(job, "error", job.error);
  } finally {
    running.delete(documentId);
  }
}

function finishCancelled(job: JobStatus) {
  job.state = "cancelled";
  event(job, "warn", "Processing cancelled. Completed pages are kept and will be reused if you start again.");
}

function summarizeMethods(pages: PageRecord[]): string {
  const counts: Record<string, number> = {};
  for (const p of pages) counts[p.method] = (counts[p.method] ?? 0) + 1;
  return Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
}
