import fs from "node:fs";
import { cachePath, docDir, readJson, sha256, writeJson } from "../storage.ts";
import { config } from "../config.ts";
import { extractPage, precisionPass, PROMPT_VERSION } from "../openai/pageOcr.ts";
import type { ExtractedBlock, PageExtraction } from "../openai/schemas.ts";
import { cropNormalized, horizontalBands, toDataUrl } from "../ingest/image.ts";
import { pageImagePath, type PageRecord } from "../ingest/index.ts";
import { checkLatex } from "./mathCheck.ts";

export interface StoredExtraction {
  pageIndex: number;
  cacheKey: string;
  promptVersion: string;
  model: string;
  attempts: number;
  precisionApplied: number[];
  problems: string[];
  extraction: PageExtraction;
}

export function extractionPath(documentId: string, index: number): string {
  return docDir(documentId, "pages", `${index}.extract.json`);
}

export function loadExtraction(documentId: string, index: number): StoredExtraction | null {
  return readJson<StoredExtraction>(extractionPath(documentId, index));
}

function cacheKeyFor(page: PageRecord, bookTypeHint: string, twoPass: boolean, correction: boolean): string {
  return sha256([page.hash, sha256(page.textLayer || ""), config.ocrModel, config.structureModel, PROMPT_VERSION, bookTypeHint, twoPass ? "2p" : "1p", correction ? "fix" : "src"].join("|")).slice(0, 48);
}

/** Blocks that deserve a zoomed second read in two-pass mode. */
function needsPrecision(b: ExtractedBlock): boolean {
  if (b.confidence < 0.9 || b.uncertain_spans.length > 0) return true;
  if (b.type === "table" || b.type === "display_equation") return true;
  const text = JSON.stringify([b.text, b.latex, b.question]);
  if (/\\(int|iint|iiint|frac|sqrt|sum|lim)/.test(text)) return true;
  const latexes = [b.latex, b.text, b.question?.stem, ...(b.question?.options.map((o) => o.text) ?? [])].filter(Boolean) as string[];
  return latexes.some((t) => checkLatex(t).length > 0);
}

export interface ExtractContext {
  documentId: string;
  jobId: string;
  totalPages: number;
  bookTypeHint: "syllabus" | "question_bank" | "unknown";
  twoPass: boolean;
  correctionMode: boolean;
  previousTail: string | null;
  sectionState: string | null;
  onRetry: (msg: string) => void;
}

/**
 * Extract one page: cache lookup → vision OCR (+ text layer hint, + zoom bands
 * for raster pages) → optional precision pass → store.
 */
export async function extractOne(page: PageRecord, ctx: ExtractContext): Promise<StoredExtraction> {
  const key = cacheKeyFor(page, ctx.bookTypeHint, ctx.twoPass, ctx.correctionMode);
  const cached = readJson<StoredExtraction>(cachePath(key));
  if (cached) {
    const stored = { ...cached, pageIndex: page.index };
    writeJson(extractionPath(ctx.documentId, page.index), stored);
    return stored;
  }

  const png = fs.readFileSync(pageImagePath(ctx.documentId, page.index));
  const raster = page.method === "scanned" || page.method === "image" || page.method === "mixed";
  const fullPage = await toDataUrl(png, { maxWidth: 2000 });
  // Digital pages carry an exact text layer, so zoom bands are only needed for rasters.
  const bands = raster ? await horizontalBands(png) : [];

  const retryCtx = {
    jobId: ctx.jobId,
    documentId: ctx.documentId,
    page: page.index,
    onRetry: ({ attempt, waitMs, failure }: { attempt: number; waitMs: number; failure: { code: string; message: string } }) =>
      ctx.onRetry(
        failure.code === "rate_limit"
          ? `OpenAI rate limit reached on page ${page.index}. Retrying in ${Math.ceil(waitMs / 1000)} seconds.`
          : `Page ${page.index}: ${failure.message} Retrying (attempt ${attempt + 1}) in ${Math.ceil(waitMs / 1000)}s.`,
      ),
  };

  const { page: extraction, meta } = await extractPage(
    {
      fullPage,
      bands,
      textLayer: page.textLayer || null,
      pageNumber: page.index,
      totalPages: ctx.totalPages,
      bookTypeHint: ctx.bookTypeHint,
      previousTail: ctx.previousTail,
      sectionState: ctx.sectionState,
      correctionMode: ctx.correctionMode,
    },
    retryCtx,
  );

  const precisionApplied: number[] = [];
  if (ctx.twoPass) {
    const targets = extraction.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.bbox && needsPrecision(block))
      .slice(0, 12);
    if (targets.length) {
      const items = [];
      for (const t of targets) {
        const crop = await cropNormalized(png, t.block.bbox!, 0.015);
        items.push({ index: t.index, block: t.block, crop: await toDataUrl(crop.png, { maxWidth: 2000, quality: 92 }) });
      }
      try {
        const corrected = await precisionPass(items, await toDataUrl(png, { maxWidth: 1000 }), retryCtx);
        for (const [i, block] of corrected) {
          // Keep the full-page bbox; the crop's coordinates are local.
          extraction.blocks[i] = { ...block, bbox: extraction.blocks[i].bbox };
          precisionApplied.push(i);
        }
      } catch (err) {
        meta.problems.push(`precision pass skipped: ${(err as Error).message}`);
      }
    }
  }

  const stored: StoredExtraction = {
    pageIndex: page.index,
    cacheKey: key,
    promptVersion: PROMPT_VERSION,
    model: meta.model,
    attempts: meta.attempts,
    precisionApplied,
    problems: meta.problems,
    extraction,
  };
  writeJson(cachePath(key), stored);
  writeJson(extractionPath(ctx.documentId, page.index), stored);
  return stored;
}

/** Short text summary of where page N ended, for continuity on page N+1. */
export function tailOf(e: PageExtraction | null): string | null {
  if (!e) return null;
  const last = e.blocks.at(-1);
  if (!last) return null;
  if (last.question) return `question ${last.question.number}: ${last.question.stem.slice(-120)}`;
  if (last.text) return last.text.slice(-200);
  if (last.list_items?.length) return last.list_items.at(-1)!.text.slice(-200);
  if (last.table) return "a table";
  return null;
}

export function sectionStateOf(e: PageExtraction | null, prev: string | null): string | null {
  if (!e) return prev;
  let state = prev?.replace(/\s*\(last question number [^)]*\)$/, "") ?? null;
  if (e.chapter) state = `Chapter ${e.chapter.number ?? ""} ${e.chapter.title}`.trim();
  for (const b of e.blocks) {
    if (b.type === "heading" && b.heading_level && b.heading_level <= 2) state = `${state?.split(" › ")[0] ?? ""} › ${b.section_number ?? ""} ${b.text ?? ""}`.trim();
  }
  const lastQ = [...e.blocks].reverse().find((b) => b.question);
  if (lastQ) state = `${state ?? ""} (last question number ${lastQ.question!.number})`.trim();
  return state;
}
