import { z } from "zod";

/**
 * Strict structured-output schema for one page. Every field is required and
 * optional data is expressed as `nullable` so the schema is valid for
 * OpenAI strict mode. Numeric ranges are validated after parsing
 * (see validatePageExtraction) rather than in the schema.
 */

const BBox = z
  .object({
    x: z.number().describe("left edge, fraction of page width 0..1"),
    y: z.number().describe("top edge, fraction of page height 0..1"),
    w: z.number().describe("width, fraction of page width"),
    h: z.number().describe("height, fraction of page height"),
  })
  .describe("Normalized region on the FULL page image, top-left origin.");

const ListItem = z.object({
  marker: z.string().describe('Bullet or number exactly as printed, e.g. "•", "o", "➢", "1.", "a)", "(ii)"'),
  text: z.string(),
  level: z.number().int().describe("Nesting level starting at 1"),
});

const Cell = z.object({
  text: z.string().describe("Cell text, inline math as $...$"),
  is_header: z.boolean(),
  col_span: z.number().int(),
  row_span: z.number().int(),
});

const Option = z.object({
  label: z.string().describe('Option label without punctuation, e.g. "A"'),
  text: z.string().describe("Option text, math as $...$"),
});

const MatchCol = z.object({
  title: z.string().nullable().describe('e.g. "List I"'),
  items: z.array(Option).describe('Rows, label like "a" or "1"'),
});

const Question = z.object({
  number: z.string().describe("Question number exactly as printed, digits only"),
  kind: z.enum(["mcq", "assertion_reason", "match_following", "statement", "fill_blank", "true_false", "other"]),
  stem: z
    .string()
    .describe("Question stem without its number, year tag, options, match lists, assertion or reason. Math as $...$"),
  year: z.string().nullable().describe('Year/exam tag exactly as printed without parentheses, e.g. "2025"'),
  options: z.array(Option).describe("Answer choices in printed order"),
  match: z.object({ left: MatchCol, right: MatchCol }).nullable(),
  assertion: z.string().nullable(),
  reason: z.string().nullable(),
  statements: z.array(z.string()).describe("Numbered statements (I, II, ...) for statement-based questions"),
  has_figure: z.boolean(),
});

const Table = z.object({
  caption: z.string().nullable(),
  rows: z.array(z.array(Cell)),
});

const Figure = z.object({
  kind: z.enum(["diagram", "graph", "chart", "photo", "logo", "other"]),
  caption: z.string().nullable(),
  label: z.string().nullable().describe('Figure number as printed, e.g. "Fig 2.3"'),
});

export const BLOCK_TYPES = [
  "chapter_title",
  "heading",
  "paragraph",
  "bullet_list",
  "numbered_list",
  "definition",
  "quote",
  "note",
  "display_equation",
  "table",
  "figure",
  "question",
  "other",
] as const;

const Block = z.object({
  type: z.enum(BLOCK_TYPES),
  heading_level: z
    .number()
    .int()
    .nullable()
    .describe("1 = numbered section (2.1), 2 = sub-section (2.6.1), 3 = sub-sub (2.6.1.1), 4 = un-numbered bold run-in heading"),
  section_number: z.string().nullable().describe('Printed section number for headings, e.g. "2.6.1"'),
  text: z.string().nullable().describe("Text for headings/paragraphs/definitions/quotes/notes/other. Inline math as $...$"),
  latex: z.string().nullable().describe("LaTeX (without $ delimiters) for display_equation blocks"),
  list_items: z.array(ListItem).nullable(),
  table: Table.nullable(),
  figure: Figure.nullable(),
  question: Question.nullable(),
  bbox: BBox.nullable(),
  confidence: z.number().describe("0..1 transcription confidence for this block"),
  uncertain_spans: z.array(z.string()).describe("Exact substrings you could not read with certainty"),
  continued_from_previous_page: z.boolean().describe("True only for the FIRST block when it is clearly the continuation of content from the previous page"),
});

export const PageExtractionSchema = z.object({
  page_kind: z.enum(["content", "chapter_opener", "answer_key", "cover", "contents", "blank", "other"]),
  layout: z.enum(["single_column", "two_column", "mixed"]),
  languages: z.array(z.string()).describe('ISO codes present, e.g. ["en"], ["en","ta"]'),
  chapter: z
    .object({ number: z.string().nullable(), title: z.string() })
    .nullable()
    .describe("Chapter title/number when this page opens a chapter"),
  running_header: z.string().nullable(),
  running_footer: z.string().nullable(),
  printed_page_number: z.string().nullable(),
  blocks: z.array(Block).describe("Content blocks in true reading order"),
  answer_key: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .describe('Answer-key pairs if this page contains an answer key. Blank answers as "-"'),
  continues_to_next_page: z.boolean().describe("True if the last block is cut off and continues on the next page"),
  page_confidence: z.number(),
  notes: z.array(z.string()).describe("Problems: unreadable areas, cut-off text, damaged scan"),
});

export type PageExtraction = z.infer<typeof PageExtractionSchema>;
export type ExtractedBlock = z.infer<typeof Block>;

/** Precision pass: re-read only specific blocks against a zoomed crop. */
export const PrecisionSchema = z.object({
  blocks: z.array(
    z.object({
      index: z.number().int().describe("Index of the block being corrected (as given)"),
      block: Block,
    }),
  ),
});
export type PrecisionResult = z.infer<typeof PrecisionSchema>;

/**
 * Post-parse validation. Returns a list of problems; an empty list means the
 * extraction is structurally sound. Problems marked `retry` justify asking
 * the model again for this page.
 */
export function validatePageExtraction(p: PageExtraction): { problems: string[]; retry: boolean } {
  const problems: string[] = [];
  let retry = false;
  const inRange = (v: number) => Number.isFinite(v) && v >= -0.01 && v <= 1.01;
  if (!inRange(p.page_confidence)) problems.push("page_confidence out of range");

  p.blocks.forEach((b, i) => {
    const where = `block ${i} (${b.type})`;
    if (!inRange(b.confidence)) problems.push(`${where}: confidence out of range`);
    if (b.bbox) {
      const { x, y, w, h } = b.bbox;
      if (![x, y, w, h].every(inRange) || w <= 0 || h <= 0 || x + w > 1.02 || y + h > 1.02) problems.push(`${where}: impossible bounding box`);
    }
    const needs: Record<string, boolean> = {
      chapter_title: !!b.text,
      heading: !!b.text,
      paragraph: !!b.text,
      definition: !!b.text,
      quote: !!b.text,
      note: !!b.text,
      other: true,
      bullet_list: !!b.list_items?.length,
      numbered_list: !!b.list_items?.length,
      display_equation: !!b.latex,
      table: !!b.table?.rows.length,
      figure: !!b.figure,
      question: !!b.question,
    };
    if (!needs[b.type]) {
      problems.push(`${where}: missing payload`);
      retry = true;
    }
  });

  if (p.page_kind !== "blank" && p.blocks.length === 0 && p.answer_key.length === 0) {
    problems.push("non-blank page returned no content");
    retry = true;
  }

  // Duplicate question numbers on one page are almost always a reading-order error.
  const nums = p.blocks.filter((b) => b.question).map((b) => b.question!.number.trim());
  const dup = nums.find((n, i) => nums.indexOf(n) !== i);
  if (dup) {
    problems.push(`question ${dup} appears twice on this page`);
    retry = true;
  }
  return { problems, retry };
}
