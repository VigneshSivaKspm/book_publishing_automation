/**
 * Canonical structured document model shared by the server pipeline and the
 * browser UI. This is the editable source of truth:
 *
 *   source file → normalized pages → PageExtraction (per page, cached)
 *   → BookModel (assembled, user-corrected) → layout engine → print PDF
 *
 * Only erasable TypeScript syntax is used so Node can run it without a build.
 */

export type BookType = "syllabus" | "question_bank" | "unknown";
export type BookTypeChoice = "auto" | "syllabus" | "question_bank";

export interface BBox {
  /** Normalized 0..1 page coordinates (top-left origin). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ConfidenceBand = "high" | "medium" | "low";

export const CONFIDENCE_THRESHOLDS = { high: 0.95, medium: 0.8 } as const;

export function confidenceBand(c: number | null | undefined): ConfidenceBand {
  if (typeof c !== "number") return "low";
  if (c >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (c >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

/* ------------------------------------------------------------------ */
/* Content nodes                                                       */
/* ------------------------------------------------------------------ */

interface NodeBase {
  id: string;
  /** 1-based source page index (in the uploaded file sequence). */
  sourcePage: number;
  bbox: BBox | null;
  confidence: number;
  needsReview: boolean;
  /** Human-readable reasons this node was flagged. */
  reviewReasons: string[];
  /** Text fragments the OCR engine reported as uncertain. */
  uncertain: string[];
  /** Set once a person has edited or approved the node. */
  verified?: boolean;
}

export interface HeadingNode extends NodeBase {
  kind: "heading";
  level: 1 | 2 | 3 | 4;
  /** Printed number exactly as in the source, e.g. "2.6.1". */
  number: string | null;
  /** Inline math is written as $...$ (LaTeX). */
  text: string;
}

export interface ParagraphNode extends NodeBase {
  kind: "paragraph";
  role: "body" | "definition" | "quote" | "note";
  text: string;
}

export interface ListItem {
  marker: string;
  text: string;
  level: number;
}

export interface ListNode extends NodeBase {
  kind: "list";
  ordered: boolean;
  items: ListItem[];
}

export interface EquationNode extends NodeBase {
  kind: "equation";
  latex: string;
  sourceText: string;
}

export interface TableCell {
  text: string;
  header: boolean;
  colSpan: number;
  rowSpan: number;
}

export interface TableNode extends NodeBase {
  kind: "table";
  caption: string | null;
  rows: TableCell[][];
}

export interface FigureNode extends NodeBase {
  kind: "figure";
  assetId: string | null;
  caption: string | null;
  label: string | null;
}

export type QuestionKind =
  | "mcq"
  | "assertion_reason"
  | "match_following"
  | "statement"
  | "fill_blank"
  | "true_false"
  | "other";

export interface QuestionOption {
  label: string;
  text: string;
}

export interface MatchColumn {
  title: string | null;
  items: QuestionOption[];
}

export interface QuestionNode extends NodeBase {
  kind: "question";
  /** Printed number exactly as in the source ("57"). */
  number: string;
  questionKind: QuestionKind;
  stem: string;
  year: string | null;
  options: QuestionOption[];
  /** Match-the-following columns (List I / List II). */
  match: { left: MatchColumn; right: MatchColumn } | null;
  assertion: string | null;
  reason: string | null;
  statements: string[];
  /** Figure asset attached to the question, if any. */
  figureAssetId: string | null;
  /** Answer exactly as given by the source answer key, or null. */
  answer: string | null;
}

export type ContentNode =
  | HeadingNode
  | ParagraphNode
  | ListNode
  | EquationNode
  | TableNode
  | FigureNode
  | QuestionNode;

export interface AnswerKeyEntry {
  question: string;
  answer: string;
  sourcePage: number;
}

export interface Chapter {
  id: string;
  number: string | null;
  title: string;
  nodes: ContentNode[];
}

/* ------------------------------------------------------------------ */
/* Assets, issues, settings                                            */
/* ------------------------------------------------------------------ */

export interface Asset {
  id: string;
  kind: "figure" | "logo" | "page-thumbnail";
  /** Path relative to the document's asset directory. */
  file: string;
  widthPx: number;
  heightPx: number;
  /** DPI the crop was rendered at (used for print-resolution checks). */
  dpi: number;
  sourcePage: number | null;
  bbox: BBox | null;
}

export type IssueCategory =
  | "low_confidence"
  | "equation"
  | "table"
  | "question"
  | "missing_content"
  | "figure"
  | "page";

export interface ReviewIssue {
  id: string;
  category: IssueCategory;
  severity: "blocking" | "warning" | "info";
  sourcePage: number | null;
  nodeId: string | null;
  message: string;
  resolved: boolean;
}

export type TrimPreset = "REFERENCE_180_240" | "A4" | "A5" | "CUSTOM";

export const TRIM_PRESETS: Record<Exclude<TrimPreset, "CUSTOM">, { widthMm: number; heightMm: number; label: string }> = {
  REFERENCE_180_240: { widthMm: 180, heightMm: 240, label: "Reference Book – 180 × 240 mm" },
  A4: { widthMm: 210, heightMm: 297, label: "A4 – 210 × 297 mm" },
  A5: { widthMm: 148, heightMm: 210, label: "A5 – 148 × 210 mm" },
};

export interface BookSettings {
  bookName: string;
  subjectName: string;
  chapterNumber: string;
  chapterName: string;
  organisationName: string;
  footerText: string;
  trim: TrimPreset;
  customWidthMm: number;
  customHeightMm: number;
  watermarkEnabled: boolean;
  watermarkText: string;
  /** Asset id of an uploaded logo used as watermark. */
  watermarkAssetId: string | null;
  watermarkOpacity: number;
  /** Mirror headers/page numbers on odd/even pages. */
  mirrored: boolean;
  languages: string[];
  /** Off by default: source fidelity mode. */
  aiCorrectionMode: boolean;
  /** Two-pass OCR (precision pass for math/tables/low confidence). */
  twoPass: boolean;
}

export function defaultSettings(partial?: Partial<BookSettings>): BookSettings {
  return {
    bookName: "",
    subjectName: "",
    chapterNumber: "",
    chapterName: "",
    organisationName: "",
    footerText: "",
    trim: "REFERENCE_180_240",
    customWidthMm: 180,
    customHeightMm: 240,
    watermarkEnabled: false,
    watermarkText: "",
    watermarkAssetId: null,
    watermarkOpacity: 0.08,
    mirrored: true,
    languages: ["en"],
    aiCorrectionMode: false,
    twoPass: true,
    ...partial,
  };
}

export function trimSizeMm(s: Pick<BookSettings, "trim" | "customWidthMm" | "customHeightMm">): { widthMm: number; heightMm: number } {
  if (s.trim === "CUSTOM") return { widthMm: s.customWidthMm, heightMm: s.customHeightMm };
  return TRIM_PRESETS[s.trim];
}

/* ------------------------------------------------------------------ */
/* Book model + versions                                               */
/* ------------------------------------------------------------------ */

export interface SourcePageInfo {
  index: number;
  sourceFile: string;
  /** Page within its own source file (1-based). */
  filePage: number;
  method: "digital" | "scanned" | "mixed" | "docx" | "image";
  widthPt: number;
  heightPt: number;
  hash: string;
  thumbnail: string | null;
  ocrConfidence: number | null;
  status: "pending" | "done" | "failed";
  error: string | null;
}

export interface BookModel {
  schemaVersion: 1;
  documentId: string;
  bookType: BookType;
  detectedBookType: BookType;
  detection: { questionScore: number; syllabusScore: number; reasons: string[] };
  settings: BookSettings;
  chapters: Chapter[];
  answerKey: AnswerKeyEntry[];
  assets: Asset[];
  sourcePages: SourcePageInfo[];
  issues: ReviewIssue[];
  updatedAt: string;
}

export type VersionLabel = "draft" | "approved" | "final";

export interface VersionInfo {
  version: number;
  label: VersionLabel;
  note: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

export type JobState = "queued" | "processing" | "needs_review" | "rendering" | "completed" | "failed" | "cancelled";

export type JobStage =
  | "uploading"
  | "analyzing"
  | "rendering_pages"
  | "extracting"
  | "precision_pass"
  | "building_book"
  | "validating"
  | "done";

export interface JobStatus {
  jobId: string;
  documentId: string;
  state: JobState;
  stage: JobStage;
  message: string;
  pagesTotal: number;
  pagesDone: number;
  pagesFailed: number;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  /** Latest human-readable events (newest last, bounded). */
  events: { at: string; level: "info" | "warn" | "error"; message: string }[];
}

export interface PreflightCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface PreflightReport {
  checks: PreflightCheck[];
  pageCount: number;
  readyForPrint: boolean;
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function allNodes(model: Pick<BookModel, "chapters">): ContentNode[] {
  return model.chapters.flatMap((c) => c.nodes);
}

export function questionNodes(model: Pick<BookModel, "chapters">): QuestionNode[] {
  return allNodes(model).filter((n): n is QuestionNode => n.kind === "question");
}

export function nodePlainText(n: ContentNode): string {
  switch (n.kind) {
    case "heading":
    case "paragraph":
      return n.text;
    case "list":
      return n.items.map((i) => `${i.marker} ${i.text}`).join("\n");
    case "equation":
      return n.latex;
    case "table":
      return n.rows.map((r) => r.map((c) => c.text).join(" | ")).join("\n");
    case "figure":
      return n.caption || "";
    case "question":
      return [`${n.number}. ${n.stem}`, ...n.options.map((o) => `${o.label}) ${o.text}`)].join("\n");
  }
}
