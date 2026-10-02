import type { BookType } from "../../shared/model.ts";

/**
 * Centralized design tokens. Values were tuned against the two reference
 * books (180 × 240 mm). All lengths in mm unless suffixed pt.
 */
export interface BookTheme {
  margins: { top: number; bottom: number; inner: number; outer: number };
  /** Distance from page top to running-header baseline area. */
  headerTop: number;
  headerHeight: number;
  footerBottom: number;
  footerHeight: number;
  columns: 1 | 2;
  columnGap: number;
  bodyFont: string;
  headingFont: string;
  sansFont: string;
  bodySizePt: number;
  lineHeight: number;
  paragraphGapPt: number;
  chapterTitlePt: number;
  sectionPt: number;
  subsectionPt: number;
  runInPt: number;
  bulletIndentMm: number;
  questionGapPt: number;
  optionIndentMm: number;
  tableSizePt: number;
  answerKeyCols: number;
}

const SERIF = `"Noto Serif", "Noto Serif Tamil", "Noto Sans Devanagari", serif`;
const SANS = `"Noto Sans", "Noto Sans Tamil", "Noto Sans Devanagari", sans-serif`;

export function themeFor(type: BookType): BookTheme {
  const base = {
    margins: { top: 25, bottom: 19, inner: 13, outer: 12 },
    headerTop: 10,
    headerHeight: 9,
    footerBottom: 6,
    footerHeight: 8,
    columnGap: 7,
    bodyFont: SERIF,
    headingFont: SERIF,
    sansFont: SANS,
    chapterTitlePt: 30,
    sectionPt: 11,
    subsectionPt: 10.5,
    runInPt: 10.5,
    bulletIndentMm: 5,
    optionIndentMm: 4.2,
    tableSizePt: 9.5,
    answerKeyCols: 6,
  };
  if (type === "question_bank") {
    return { ...base, columns: 2, bodySizePt: 9.6, lineHeight: 1.32, paragraphGapPt: 3, questionGapPt: 7.5 };
  }
  return { ...base, columns: 1, bodySizePt: 10.5, lineHeight: 1.36, paragraphGapPt: 4, questionGapPt: 7 };
}
