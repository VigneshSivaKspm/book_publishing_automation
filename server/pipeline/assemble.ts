import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
import { docDir, ensureDir } from "../storage.ts";
import { cropNormalized } from "../ingest/image.ts";
import { pageImagePath, type PageRecord } from "../ingest/index.ts";
import type { ExtractedBlock, PageExtraction } from "../openai/schemas.ts";
import { normNum, refreshIssues } from "./validate.ts";
import {
  type AnswerKeyEntry,
  type Asset,
  type BBox,
  type BookModel,
  type BookSettings,
  type BookType,
  type BookTypeChoice,
  type Chapter,
  type ContentNode,
  type QuestionNode,
  type ReviewIssue,
} from "../../shared/model.ts";

const rid = (p: string) => `${p}_${crypto.randomBytes(5).toString("hex")}`;

export function detectBookType(pages: (PageExtraction | null)[]): BookModel["detection"] & { type: BookType } {
  let q = 0;
  let akPages = 0;
  let twoCol = 0;
  let para = 0;
  let heads = 0;
  let lists = 0;
  let tables = 0;
  let figs = 0;
  for (const p of pages) {
    if (!p) continue;
    if (p.answer_key.length > 5 || p.page_kind === "answer_key") akPages++;
    if (p.layout === "two_column") twoCol++;
    for (const b of p.blocks) {
      if (b.type === "question") q++;
      else if (b.type === "paragraph" || b.type === "definition") para++;
      else if (b.type === "heading") heads++;
      else if (b.type === "bullet_list" || b.type === "numbered_list") lists++;
      else if (b.type === "table") tables++;
      else if (b.type === "figure") figs++;
    }
  }
  const questionScore = q * 3 + akPages * 25 + twoCol * 2;
  const syllabusScore = para * 2 + heads * 3 + lists * 2 + tables * 2 + figs;
  const reasons = [
    `${q} questions with options detected`,
    `${akPages} answer-key page(s)`,
    `${twoCol} two-column page(s)`,
    `${para} paragraphs, ${heads} headings, ${lists} lists, ${tables} tables, ${figs} figures`,
  ];
  const type: BookType = questionScore === 0 && syllabusScore === 0 ? "unknown" : questionScore > syllabusScore ? "question_bank" : "syllabus";
  return { type, questionScore, syllabusScore, reasons };
}

function overlap(a: BBox, b: BBox): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}

interface AssembleInput {
  documentId: string;
  settings: BookSettings;
  choice: BookTypeChoice;
  pages: PageRecord[];
  extractions: Map<number, PageExtraction>;
  failedPages: Map<number, string>;
  ingestWarnings: string[];
}

export async function assemble(input: AssembleInput): Promise<BookModel> {
  const ordered = input.pages.map((p) => input.extractions.get(p.index) ?? null);
  const detection = detectBookType(ordered);
  const bookType: BookType = input.choice === "auto" ? detection.type : input.choice;
  const issues: ReviewIssue[] = [];
  const assets: Asset[] = [];
  const answerKey: AnswerKeyEntry[] = [];
  const chapters: Chapter[] = [];
  const settings = { ...input.settings };

  const issue = (i: Omit<ReviewIssue, "id" | "resolved">) => issues.push({ ...i, id: rid("iss"), resolved: false });

  for (const w of input.ingestWarnings) issue({ category: "page", severity: "info", sourcePage: null, nodeId: null, message: w });

  let chapter: Chapter = { id: rid("ch"), number: settings.chapterNumber || null, title: settings.chapterName || "", nodes: [] };
  chapters.push(chapter);
  const answerKeyByChapter = new Map<string, AnswerKeyEntry[]>();

  for (const page of input.pages) {
    const ex = input.extractions.get(page.index);
    if (!ex) {
      issue({
        category: "missing_content",
        severity: "blocking",
        sourcePage: page.index,
        nodeId: null,
        message: `Page ${page.index} was not extracted: ${input.failedPages.get(page.index) ?? "unknown error"}. Retry the page or enter its content manually.`,
      });
      continue;
    }
    for (const note of ex.notes) issue({ category: "page", severity: "warning", sourcePage: page.index, nodeId: null, message: `Page ${page.index}: ${note}` });

    // Chapter boundaries.
    const chapterBlock = ex.blocks.find((b) => b.type === "chapter_title");
    const opener = ex.chapter ?? (chapterBlock ? { number: null, title: chapterBlock.text ?? "" } : null);
    if (opener && opener.title.trim()) {
      if (chapter.nodes.length === 0 && !chapter.title) {
        chapter.title = opener.title.trim();
        chapter.number = opener.number ?? chapter.number;
      } else if (opener.title.trim() !== chapter.title) {
        chapter = { id: rid("ch"), number: opener.number ?? null, title: opener.title.trim(), nodes: [] };
        chapters.push(chapter);
      }
    }

    if (ex.answer_key.length) {
      const list = answerKeyByChapter.get(chapter.id) ?? [];
      for (const a of ex.answer_key) {
        const entry = { question: a.question.trim(), answer: a.answer.trim(), sourcePage: page.index };
        list.push(entry);
        answerKey.push(entry);
      }
      answerKeyByChapter.set(chapter.id, list);
    }

    let pagePng: Buffer | null = null;
    const blocks = ex.blocks;
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      if (b.type === "chapter_title") continue;
      const node = toNode(b, page.index);
      if (!node) continue;

      // Figures → cropped assets from the 300 DPI render, snapped to embedded image regions when possible.
      if (b.type === "figure" || (b.type === "question" && b.question?.has_figure)) {
        let figBlock: ExtractedBlock | null = b.type === "figure" ? b : null;
        if (!figBlock && blocks[bi + 1]?.type === "figure") {
          figBlock = blocks[bi + 1];
          bi++;
        }
        if (figBlock?.bbox) {
          pagePng ??= fs.readFileSync(pageImagePath(input.documentId, page.index));
          let box = figBlock.bbox;
          const snapped = page.imageRegions.find((r) => overlap(r, box) > 0.3);
          if (snapped) box = snapped;
          const asset = await saveCrop(input.documentId, pagePng, box, page.index, page.dpi);
          assets.push(asset);
          if (node.kind === "figure") node.assetId = asset.id;
          if (node.kind === "question") node.figureAssetId = asset.id;
          if (!snapped) {
            node.needsReview = true;
            node.reviewReasons.push("Figure crop estimated from the page image — confirm it is complete.");
          }
        } else if (node.kind === "figure" || (node.kind === "question" && b.question?.has_figure)) {
          node.needsReview = true;
          node.reviewReasons.push("A figure was detected but its position could not be determined.");
        }
      }

      // Continuation across pages.
      if (bi === 0 && b.continued_from_previous_page && mergeContinuation(chapter.nodes.at(-1), node)) continue;
      chapter.nodes.push(node);
    }
  }

  // Attach answers by chapter; answer keys apply to the chapter they close.
  for (const ch of chapters) {
    const keys = answerKeyByChapter.get(ch.id);
    if (!keys) continue;
    const byNum = new Map(keys.map((k) => [normNum(k.question), k]));
    const qs = ch.nodes.filter((n): n is QuestionNode => n.kind === "question");
    for (const q of qs) {
      const k = byNum.get(normNum(q.number));
      if (k) q.answer = k.answer;
    }
    const qNums = new Set(qs.map((q) => normNum(q.number)));
    const orphan = keys.filter((k) => !qNums.has(normNum(k.question))).map((k) => k.question);
    if (orphan.length) {
      issue({ category: "question", severity: "warning", sourcePage: keys[0].sourcePage, nodeId: null, message: `Answer key lists question(s) not found in the chapter: ${orphan.slice(0, 20).join(", ")}${orphan.length > 20 ? "…" : ""}` });
    }
    const missing = qs.filter((q) => !byNum.has(normNum(q.number))).map((q) => q.number);
    if (missing.length && qs.length) {
      issue({ category: "question", severity: "warning", sourcePage: keys[0].sourcePage, nodeId: null, message: `No answer-key entry for question(s): ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? "…" : ""}` });
    }
  }

  if (!settings.chapterName && chapters[0]?.title) settings.chapterName = chapters[0].title;
  if (!settings.chapterNumber && chapters[0]?.number) settings.chapterNumber = chapters[0].number;
  if (!settings.bookName) settings.bookName = settings.chapterName;
  if (!settings.subjectName) settings.subjectName = settings.chapterName;

  const model: BookModel = {
    schemaVersion: 1,
    documentId: input.documentId,
    bookType,
    detectedBookType: detection.type,
    detection: { questionScore: detection.questionScore, syllabusScore: detection.syllabusScore, reasons: detection.reasons },
    settings,
    chapters: chapters.filter((c) => c.nodes.length || c.title),
    answerKey,
    assets,
    sourcePages: input.pages.map((p) => ({
      index: p.index,
      sourceFile: p.sourceFile,
      filePage: p.filePage,
      method: p.method,
      widthPt: p.widthPt,
      heightPt: p.heightPt,
      hash: p.hash,
      thumbnail: p.thumbnail,
      ocrConfidence: input.extractions.get(p.index)?.page_confidence ?? null,
      status: input.extractions.has(p.index) ? "done" : "failed",
      error: input.failedPages.get(p.index) ?? null,
    })),
    issues,
    updatedAt: new Date().toISOString(),
  };
  refreshIssues(model);
  return model;
}


function base(b: ExtractedBlock, page: number) {
  return {
    id: rid("n"),
    sourcePage: page,
    bbox: b.bbox,
    confidence: Math.max(0, Math.min(1, b.confidence)),
    needsReview: false,
    reviewReasons: [] as string[],
    uncertain: b.uncertain_spans,
  };
}

function toNode(b: ExtractedBlock, page: number): ContentNode | null {
  const common = base(b, page);
  switch (b.type) {
    case "heading": {
      const lvl = Math.min(4, Math.max(1, b.heading_level ?? 4)) as 1 | 2 | 3 | 4;
      return { ...common, kind: "heading", level: lvl, number: b.section_number?.trim() || null, text: (b.text ?? "").trim() };
    }
    case "paragraph":
    case "other":
      return b.text?.trim() ? { ...common, kind: "paragraph", role: "body", text: b.text.trim() } : null;
    case "definition":
    case "quote":
    case "note":
      return { ...common, kind: "paragraph", role: b.type, text: (b.text ?? "").trim() };
    case "bullet_list":
    case "numbered_list":
      return {
        ...common,
        kind: "list",
        ordered: b.type === "numbered_list",
        items: (b.list_items ?? []).map((i) => ({ marker: i.marker.trim(), text: i.text.trim(), level: Math.max(1, Math.min(4, i.level || 1)) })),
      };
    case "display_equation":
      return { ...common, kind: "equation", latex: (b.latex ?? "").trim(), sourceText: b.text ?? "" };
    case "table":
      return {
        ...common,
        kind: "table",
        caption: b.table?.caption ?? null,
        rows: (b.table?.rows ?? []).map((r) => r.map((c) => ({ text: c.text, header: c.is_header, colSpan: Math.max(1, c.col_span || 1), rowSpan: Math.max(1, c.row_span || 1) }))),
      };
    case "figure":
      return { ...common, kind: "figure", assetId: null, caption: b.figure?.caption ?? null, label: b.figure?.label ?? null };
    case "question": {
      const q = b.question!;
      return {
        ...common,
        kind: "question",
        number: q.number.trim().replace(/[.)]$/, ""),
        questionKind: q.kind,
        stem: q.stem.trim(),
        year: q.year?.replace(/[()]/g, "").trim() || null,
        options: q.options.map((o) => ({ label: o.label.replace(/[().\s]/g, ""), text: o.text.trim() })),
        match: q.match
          ? {
              left: { title: q.match.left.title, items: q.match.left.items },
              right: { title: q.match.right.title, items: q.match.right.items },
            }
          : null,
        assertion: q.assertion,
        reason: q.reason,
        statements: q.statements,
        figureAssetId: null,
        answer: null,
      };
    }
    default:
      return null;
  }
}

/** Merge a page-start continuation into the previous node. Returns true when merged. */
function mergeContinuation(prev: ContentNode | undefined, next: ContentNode): boolean {
  if (!prev) return false;
  if (prev.kind === "paragraph" && next.kind === "paragraph") {
    prev.text = `${prev.text} ${next.text}`.replace(/\s+/g, " ");
  } else if (prev.kind === "list" && next.kind === "list") {
    prev.items.push(...next.items);
  } else if (prev.kind === "table" && next.kind === "table") {
    const header = prev.rows[0]?.map((c) => c.text).join("|");
    const rows = next.rows[0]?.map((c) => c.text).join("|") === header ? next.rows.slice(1) : next.rows;
    prev.rows.push(...rows);
  } else if (prev.kind === "question" && next.kind === "question" && normNum(prev.number) === normNum(next.number)) {
    const have = new Set(prev.options.map((o) => o.label));
    prev.options.push(...next.options.filter((o) => !have.has(o.label)));
    if (next.stem && !prev.stem.includes(next.stem)) prev.stem = `${prev.stem} ${next.stem}`.trim();
    prev.statements.push(...next.statements);
  } else if (prev.kind === "question" && next.kind === "paragraph") {
    prev.stem = `${prev.stem} ${next.text}`.trim();
  } else {
    return false;
  }
  prev.confidence = Math.min(prev.confidence, next.confidence);
  prev.uncertain.push(...next.uncertain);
  return true;
}



async function saveCrop(documentId: string, png: Buffer, box: BBox, sourcePage: number, dpi: number): Promise<Asset> {
  const crop = await cropNormalized(png, box, 0.006);
  // Trim surrounding white space but keep a hair of margin.
  let out = crop.png;
  let width = crop.width;
  let height = crop.height;
  try {
    const t = await sharp(crop.png).trim({ background: "#ffffff", threshold: 12 }).extend({ top: 6, bottom: 6, left: 6, right: 6, background: "#ffffff" }).png().toBuffer({ resolveWithObject: true });
    out = t.data;
    width = t.info.width;
    height = t.info.height;
  } catch {
    // uniform crop; keep as is
  }
  const id = rid("asset");
  ensureDir(docDir(documentId, "assets"));
  fs.writeFileSync(docDir(documentId, "assets", `${id}.png`), out);
  return { id, kind: "figure", file: `${id}.png`, widthPx: width, heightPx: height, dpi, sourcePage, bbox: box };
}
