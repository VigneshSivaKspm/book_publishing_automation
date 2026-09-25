import type { BookPage, ContentBlock, PaperSize } from "../types";
import { uid } from "../types";
import { cleanText, packBlocksIntoPages } from "./bookAi";
import { addLog } from "./logger";

/**
 * Syllabus / study-material structurer.
 *
 * Unlike `structureExamText` (which assumes an MCQ question paper) this keeps the
 * original document shape: chapter titles, numbered section headings, paragraphs,
 * bullet / lettered / roman / numbered lists, display formulas and tables.
 * It never invents questions or answers.
 */

const H1 = /^#\s+(.+)$/;
const H2 = /^##\s+(.+)$/;
const H3 = /^###\s+(.+)$/;
const H4PLUS = /^#{4,}\s+(.+)$/;
const CHAPTER_TITLE = /^(chapter|topic|unit)\s+[\dIVXLC]+\b/i;
// "2.1 Importance of Micro Economics"
const SEC_2 = /^(\d+\.\d+)\.?\s+([A-Za-z].{2,90})$/;
// "2.6.1 Characteristics of Human Wants" / "2.6.1. Classification of Goods"
const SEC_3 = /^(\d+\.\d+\.\d+)\.?\s+(.+)$/;
// "1. Quadratic Equations (Highest power is two)" — a short, title-like numbered line
const SEC_1 = /^(\d+)\.\s+([A-Z][A-Za-z].{3,80})$/;
const isTitleLike = (t: string) =>
  t.split(/\s+/).length <= 9 && !/[.?:;,]$/.test(t);

// Run-in labels printed in bold on their own line: "Example 1", "Solution",
// "Theorem 2 (Factor Theorem).", "Note:". Text after a ":" / "." separator
// becomes the following paragraph.
const LABEL =
  /^(?:\*\*)?((?:Worked\s+|Illustrative\s+)?(?:Example|Solution|Sol|Theorem|Proof|Note|Notes|Definition|Remark|Corollary|Lemma|Illustration|Problem|Answer|Hint|Result|Property|Properties|Formulae?|Observation|Aliter|Alternative\s+Method))\b(\s*\d+(?:\.\d+)*)?(\s*\([^)]{1,80}\))?(?:\*\*)?\s*([:.\-–])?\s*(?:\*\*)?\s*(.*)$/i;

// Exercise box openers ("Let us Workout", "Exercise 1.2", "Try Yourself" …)
const WORKOUT_HEAD =
  /^(?:#+\s*)?(?:let\s+us\s+work\s*out|exercises?(?:\s+\d+(?:\.\d+)*)?|practice\s+(?:problems|questions)|try\s+(?:these|yourself)|self[-\s]?assessment)\s*:?$/i;
const IMPERATIVE =
  /^\s*\d{1,2}[.)]\s+(show|prove|find|solve|evaluate|determine|calculate|obtain|verify|if|form|compute|express|reduce|discuss|test|diminish|increase|transform|remove|using|use|sum|expand)\b/i;

/** Split a "Example 1: Prove that…" line into a label + remaining text. */
function matchLabel(t: string): { label: string; rest: string } | null {
  const m = t.match(LABEL);
  if (!m) return null;
  const [, word, num = "", paren = "", sep, rest = ""] = m;
  const label = `${word}${num}${paren}`.replace(/\s+/g, " ").trim();
  // "Solution of the equation…" / "Note that…" are ordinary sentences.
  if (rest && !sep) return null;
  return { label: sep === ":" ? `${label}:` : label, rest: rest.trim() };
}

/** Join wrapped lines of one paragraph, keeping deliberate line breaks
 *  (worked-solution steps, equations) and re-flowing soft wraps. */
function joinParagraphLines(lines: string[]): string {
  let out = "";
  lines.forEach((line, i) => {
    if (i === 0) {
      out = line;
      return;
    }
    const prev = lines[i - 1];
    const hardBreak =
      /[.:;!?)\]]$|\$$/.test(prev) ||
      /^[=∴∵⇒→]|^\$/.test(line) ||
      (prev.length < 60 && /^[A-Z(=∴]/.test(line));
    if (!hardBreak && /-$/.test(prev) && /^[a-z]/.test(line)) {
      out = out.slice(0, -1) + line; // re-join a hyphenated word
      return;
    }
    out += (hardBreak ? "\n" : " ") + line;
  });
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

const SYMBOL_BULLET = /^\s*([-*•▪◦‣∙·]|[➢➤►▶‣]|o)\s+\S/;
const LETTER_BULLET = /^\s*(\([a-zA-Z]\)|[a-zA-Z][.)])\s+\S/;
const ROMAN_BULLET =
  /^\s*(\((?:i{1,3}|iv|v|vi{1,3}|ix|x)\)|(?:i{1,3}|iv|v|vi{1,3}|ix|x)[.)])\s+\S/i;
const NUM_BULLET = /^\s*\d{1,2}[.)]\s+\S/;

const DISPLAY_MATH = /^\$\$[\s\S]+\$\$$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

function headingBlock(level: 1 | 2 | 3, text: string): ContentBlock {
  const clean = text
    .replace(/^#+\s*/, "")
    .replace(/\s+$/, "")
    .trim();
  return {
    id: uid("blk"),
    type: level === 1 ? "heading1" : level === 2 ? "heading2" : "heading3",
    text: clean,
    align: level === 1 ? "center" : "left",
    level,
  };
}

/** Normalise a bullet line: symbol bullets become "• ", ordered markers stay. */
function normalizeBullet(line: string): string {
  const t = line.trim();
  if (SYMBOL_BULLET.test(line)) {
    const sym = t.match(/^([-*•▪◦‣∙·]|[➢➤►▶‣]|o)\s+/)?.[1] ?? "•";
    const marker = /[➢➤►▶]/.test(sym) ? "➢" : "•";
    return `${marker} ${t.replace(/^\s*([-*•▪◦‣∙·]|[➢➤►▶‣]|o)\s+/, "")}`;
  }
  return t;
}

function isBulletLine(rawLine: string): boolean {
  return (
    SYMBOL_BULLET.test(rawLine) ||
    LETTER_BULLET.test(rawLine) ||
    ROMAN_BULLET.test(rawLine) ||
    NUM_BULLET.test(rawLine)
  );
}

export function structureDocumentText(raw: string): ContentBlock[] {
  // Math-italic letters (𝑥, 𝛼 from Word / PDF text layers) -> plain letters,
  // which every body font can draw; superscripts like ² are left intact.
  const text = cleanText(raw || "")
    .text.replace(/\r\n/g, "\n")
    .replace(/[\u{1D400}-\u{1D7FF}]/gu, (c) => c.normalize("NFKC"));
  const lines = text.split("\n");
  const blocks: ContentBlock[] = [];

  let para: string[] = [];
  let list: string[] = [];
  let table: string[] = [];

  let inWorkout = false;
  let workoutPending = false;

  const flushPara = () => {
    if (para.length) {
      const joined = joinParagraphLines(para);
      if (joined)
        blocks.push({
          id: uid("blk"),
          type: "paragraph",
          text: joined,
          align: "justify",
        });
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const numbered = list.filter((l) => /^\s*\d{1,2}[.)]\s/.test(l));
      const exercise =
        numbered.length >= 2 &&
        numbered.filter((l) => IMPERATIVE.test(l)).length >=
          Math.ceil(numbered.length * 0.6);
      const block: ContentBlock = {
        id: uid("blk"),
        type: "list",
        text: list.join("\n"),
        align: "left",
      };
      if (inWorkout || workoutPending || exercise) block.variant = "workout";
      blocks.push(block);
      workoutPending = false;
      list = [];
    }
  };
  const flushTable = () => {
    if (table.length) {
      // keep a table only if it has at least a header + one data row
      const rows = table.filter((r) => !TABLE_SEP.test(r));
      if (rows.length >= 1) {
        blocks.push({
          id: uid("blk"),
          type: "table",
          text: table.join("\n"),
          align: "left",
        });
      } else {
        para.push(table.join(" "));
        flushPara();
      }
      table = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const t = line.trim();

    if (!t) {
      flushPara();
      flushList();
      flushTable();
      continue;
    }

    // --- exercise ("Let us Workout") boxes ----------------------------------
    if (/^:::\s*workout\b/i.test(t)) {
      flushAll();
      inWorkout = true;
      continue;
    }
    if (/^:::\s*$/.test(t)) {
      flushAll();
      inWorkout = false;
      continue;
    }
    if (WORKOUT_HEAD.test(t)) {
      flushAll();
      workoutPending = true;
      continue;
    }

    // --- tables -------------------------------------------------------------
    if (TABLE_ROW.test(t)) {
      flushPara();
      flushList();
      table.push(t);
      continue;
    }
    flushTable();

    // --- headings ----------------------------------------------------------
    let m: RegExpMatchArray | null;
    if ((m = t.match(H1))) {
      flushAll();
      blocks.push(headingBlock(1, m[1]));
      continue;
    }
    if ((m = t.match(H2))) {
      flushAll();
      blocks.push(headingBlock(2, m[1].replace(/\*\*/g, "")));
      continue;
    }
    if ((m = t.match(H3)) || (m = t.match(H4PLUS))) {
      flushAll();
      blocks.push(headingBlock(3, m[1].replace(/\*\*/g, "")));
      continue;
    }
    const lab = !inWorkout && !isBulletLine(line) ? matchLabel(t) : null;
    if (lab) {
      flushAll();
      blocks.push(headingBlock(3, lab.label));
      if (lab.rest) para.push(lab.rest);
      continue;
    }
    if ((m = t.match(SEC_3))) {
      flushAll();
      blocks.push(headingBlock(3, `${m[1]} ${m[2].trim()}`));
      continue;
    }
    if ((m = t.match(SEC_2))) {
      flushAll();
      blocks.push(headingBlock(2, `${m[1]} ${m[2].trim()}`));
      continue;
    }
    if ((m = t.match(SEC_1)) && !list.length && !inWorkout && isTitleLike(t)) {
      flushAll();
      blocks.push(headingBlock(3, `${m[1]}. ${m[2].trim()}`));
      continue;
    }
    if (CHAPTER_TITLE.test(t) && t.length < 42) {
      flushAll();
      blocks.push(headingBlock(1, t));
      continue;
    }

    // --- display math ----------------------------------------------------
    if (DISPLAY_MATH.test(t)) {
      flushAll();
      blocks.push({ id: uid("blk"), type: "math", text: t, align: "center" });
      continue;
    }

    // --- lists -----------------------------------------------------------
    if (isBulletLine(line)) {
      flushPara();
      list.push(normalizeBullet(line));
      continue;
    }
    // indented wrap of the previous bullet
    if (list.length && /^\s{2,}\S/.test(rawLine)) {
      list[list.length - 1] += ` ${t}`;
      continue;
    }

    // --- paragraph -----------------------------------------------------
    flushList();
    para.push(t);
  }

  flushAll();

  if (blocks.length === 0) {
    blocks.push({
      id: uid("blk"),
      type: "paragraph",
      text: text.trim() || "(No text detected)",
      align: "justify",
    });
  }

  return blocks;
}

/**
 * Flatten per-source-page blocks into one flow, re-joining a paragraph (or
 * list) that the source page break cut in half.
 */
export function joinPageBlocks(pages: ContentBlock[][]): ContentBlock[] {
  const out: ContentBlock[] = [];
  for (const page of pages) {
    page.forEach((b, i) => {
      const prev = out[out.length - 1];
      if (i === 0 && prev && prev.type === b.type) {
        if (
          b.type === "paragraph" &&
          !/[.!?:]$/.test(prev.text.trim()) &&
          /^[a-z(,;$]/.test(b.text.trim())
        ) {
          out[out.length - 1] = { ...prev, text: `${prev.text} ${b.text}` };
          return;
        }
        if (b.type === "list" && prev.variant === b.variant) {
          out[out.length - 1] = { ...prev, text: `${prev.text}\n${b.text}` };
          return;
        }
      }
      out.push(b);
    });
  }
  return out;
}

/** Convert an array of transcribed page texts into structured book pages filled to capacity. */
export function structureDocumentPages(
  pageTexts: string[],
  startNumber = 1,
  paperSize: PaperSize = "A4",
  cols: number = 2,
): BookPage[] {
  const allBlocks = joinPageBlocks(
    pageTexts.map((txt) => structureDocumentText(txt)),
  );

  const pages = packBlocksIntoPages(
    allBlocks,
    paperSize,
    cols,
    startNumber,
    true,
  );

  const headings = pages.reduce(
    (n, p) => n + p.blocks.filter((b) => b.type.startsWith("heading")).length,
    0,
  );
  const tables = pages.reduce(
    (n, p) => n + p.blocks.filter((b) => b.type === "table").length,
    0,
  );
  addLog({
    category: "formatting",
    level: "success",
    title: "Syllabus Document Structured",
    details: `Built ${pages.length} page(s) · ${headings} headings · ${tables} tables · packed to fill pages completely.`,
  });

  return pages;
}

/** Parse a GitHub-style markdown pipe table into header + rows. */
export function parseMarkdownTable(md: string): {
  header: string[];
  rows: string[][];
} {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.includes("|"));
  const splitRow = (row: string) =>
    row
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => c.trim());

  const isSep = (l: string) => /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(l);
  const dataLines = lines.filter((l) => !isSep(l));
  if (dataLines.length === 0) return { header: [], rows: [] };

  const header = splitRow(dataLines[0]);
  const rows = dataLines.slice(1).map(splitRow);
  return { header, rows };
}
