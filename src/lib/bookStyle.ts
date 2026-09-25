import type { ContentBlock } from "../types";

/**
 * Shared typography for the book editor preview and the print export, so the
 * page you edit is the page that prints. Sizes are in points (print units);
 * the editor converts with `ptToPx` (A4 preview is 794px wide = 96 dpi).
 */
export const BOOK_TYPE = {
  body: 12,
  lineHeight: 1.38,
  title: 30,
  section: 12.5,
  subsection: 12,
  label: 12,
  table: 11,
} as const;

export const ptToPx = (pt: number) => (pt * 96) / 72;

/** Default point size for a block type (used when a block has no explicit fontSize). */
export function defaultBlockPt(type: ContentBlock["type"]): number {
  if (type === "heading1") return 18;
  if (type === "heading2") return BOOK_TYPE.section;
  if (type === "heading3") return BOOK_TYPE.subsection;
  if (type === "table") return BOOK_TYPE.table;
  return BOOK_TYPE.body;
}

export type HeadingKind =
  /** "1.1 Theory of Equations" — black number box + grey bar */
  | { kind: "section"; num: string; title: string }
  /** "1.2.1. Descartes Rule…" — light grey bar with number box */
  | { kind: "subsection"; num: string; title: string }
  /** "Example 1", "Solution", "Theorem 2 (Factor Theorem)" — bold run-in label */
  | { kind: "label"; title: string }
  /** Chapter-level title inside the body */
  | { kind: "title"; title: string };

/**
 * Decide how a heading prints from its text, not just its block type, so the
 * same look comes out whether it was scanned from a PDF, image or Word file.
 * Only dotted section numbers ("1.1", "2.3.4") get the shaded bars.
 */
export function classifyHeading(block: Pick<ContentBlock, "type" | "text">): HeadingKind {
  const text = block.text.trim();
  if (block.type === "heading1") return { kind: "title", title: text };
  const m = text.match(/^(\d+(?:\.\d+)+)\.?\s+(.+)$/);
  if (m) {
    const depth = m[1].split(".").length;
    return depth >= 3
      ? { kind: "subsection", num: m[1], title: m[2] }
      : { kind: "section", num: m[1], title: m[2] };
  }
  return { kind: "label", title: text };
}

/** Split a list line into its marker and body (•, ➢, 1., a), (i), …). */
export function splitListMarker(line: string): { marker: string; body: string } {
  const t = line.trim();
  const m = t.match(
    /^([-•➢➤►▪◦]|\(?[a-zA-Z]\)|[a-zA-Z][.)]|\(?(?:i{1,3}|iv|v|vi{1,3}|ix|x)\)|(?:i{1,3}|iv|v|vi{1,3}|ix|x)[.)]|\d{1,2}[.)])\s+(.*)$/i,
  );
  if (!m) return { marker: "•", body: t };
  return { marker: m[1] === "-" ? "•" : m[1], body: m[2] };
}
