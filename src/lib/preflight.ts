import type { BookDocument, ContentBlock } from "../types";
import { PAPER_DIMENSIONS } from "../types";

export type PreflightSeverity = "error" | "warning" | "info";
export type PreflightCode =
  | "empty-page"
  | "overflow"
  | "question-number"
  | "duplicate-question"
  | "missing-answer"
  | "invalid-math"
  | "missing-alt"
  | "low-confidence"
  | "placeholder"
  | "chapter-metadata"
  | "header-footer";

export interface PreflightIssue {
  id: string;
  code: PreflightCode;
  severity: PreflightSeverity;
  page: number;
  blockId?: string;
  title: string;
  description: string;
  suggestion: string;
}

function issue(code: PreflightCode, severity: PreflightSeverity, page: number, title: string, description: string, suggestion: string, blockId?: string): PreflightIssue {
  return { id: `${code}-${page}-${blockId || title}`, code, severity, page, blockId, title, description, suggestion };
}

function questionNumber(block: ContentBlock): number | null {
  if (block.type !== "mcq") return null;
  const match = block.text.match(/^\s*(\d+)\s*[.)]/);
  return match ? Number(match[1]) : null;
}

function mathFragments(text: string): string[] {
  const matches = text.match(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g) || [];
  return matches.map((value) => value.startsWith("$$") ? value.slice(2, -2) : value.slice(1, -1));
}

function hasInvalidMathSyntax(fragment: string): boolean {
  let braces = 0;
  for (const char of fragment) {
    if (char === "{") braces++;
    if (char === "}") braces--;
    if (braces < 0) return true;
  }
  return braces !== 0 || /\\(?:frac|sqrt|begin|end)\s*(?:$|[^\s{])/.test(fragment);
}

export function runPreflight(book: BookDocument): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const seenQuestions = new Map<number, { page: number; blockId: string }>();
  const orderedQuestions: number[] = [];
  const pageCapacity = PAPER_DIMENSIONS[book.paperSize].charsPerPage * (book.headerFooter.layoutColumns === 2 ? 1.08 : 1);

  book.pages.forEach((page, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const meaningful = page.blocks.filter((block) => block.text.trim() || block.imageUrl);
    if (!meaningful.length) {
      issues.push(issue("empty-page", "warning", pageNumber, "Empty page", "This page contains no printable content.", "Delete the page or add content."));
    }
    const charCount = meaningful.reduce((total, block) => total + block.text.length, 0);
    if (charCount > pageCapacity) {
      issues.push(issue("overflow", "error", pageNumber, "Possible page overflow", `This page contains about ${charCount.toLocaleString()} characters, above the safe capacity for this layout.`, "Reflow the page or reduce typography carefully."));
    }
    meaningful.forEach((block) => {
      const num = questionNumber(block);
      if (block.type === "mcq") {
        if (num === null) {
          issues.push(issue("question-number", "error", pageNumber, "Question number missing", "This MCQ has no recognizable source question number.", "Enter the original number; do not renumber automatically.", block.id));
        } else {
          orderedQuestions.push(num);
          const prior = seenQuestions.get(num);
          if (prior) issues.push(issue("duplicate-question", "error", pageNumber, `Duplicate question ${num}`, `Question ${num} also appears on page ${prior.page}.`, "Compare with the source and correct the duplicate safely.", block.id));
          else seenQuestions.set(num, { page: pageNumber, blockId: block.id });
        }
        if (!block.answer) issues.push(issue("missing-answer", "warning", pageNumber, `Answer missing${num ? ` for question ${num}` : ""}`, "The answer-key cell will be blank.", "Choose a verified answer or leave it explicitly unresolved.", block.id));
      }
      if (block.type === "image" && !block.imageAlt?.trim()) {
        issues.push(issue("missing-alt", "warning", pageNumber, "Image alt text missing", "The image has no accessible description.", "Add concise alt text in the inspector.", block.id));
      }
      if (typeof block.confidence === "number" && block.confidence < 0.75) {
        issues.push(issue("low-confidence", "warning", pageNumber, "Low-confidence OCR", `OCR confidence is ${Math.round(block.confidence * 100)}%.`, "Compare this block with the source page before export.", block.id));
      }
      if (/\[(?:type|enter|placeholder)|lorem ipsum/i.test(block.text)) {
        issues.push(issue("placeholder", "warning", pageNumber, "Placeholder content", "This block appears to contain unfinished placeholder text.", "Replace or remove the placeholder.", block.id));
      }
      mathFragments(block.text).forEach((fragment) => {
        if (hasInvalidMathSyntax(fragment)) issues.push(issue("invalid-math", "error", pageNumber, "Invalid mathematical expression", `The expression has unbalanced or incomplete LaTeX near “${fragment.slice(0, 48)}${fragment.length > 48 ? "…" : ""}”.`, "Open the block and correct the LaTeX source.", block.id));
      });
    });
  });

  for (let index = 1; index < orderedQuestions.length; index++) {
    if (orderedQuestions[index] !== orderedQuestions[index - 1] + 1) {
      const current = seenQuestions.get(orderedQuestions[index]);
      issues.push(issue("question-number", "warning", current?.page || 1, "Broken question sequence", `Question ${orderedQuestions[index - 1]} is followed by ${orderedQuestions[index]}.`, "Check the source for a missing or intentionally skipped number.", current?.blockId));
    }
  }
  if (!book.headerFooter.chapterTitle?.trim() || !book.headerFooter.chapterNumber?.trim()) {
    issues.push(issue("chapter-metadata", "warning", 1, "Chapter metadata incomplete", "The chapter opener is missing a title or chapter number.", "Complete the chapter fields in Document settings."));
  }
  if (!book.headerFooter.footerLeft?.trim()) {
    issues.push(issue("header-footer", "info", 1, "Footer branding is empty", "Running footers have no publication name.", "Add publisher or series text, or intentionally keep it blank."));
  }
  const weight: Record<PreflightSeverity, number> = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => weight[a.severity] - weight[b.severity] || a.page - b.page);
}

export function preflightSummary(issues: PreflightIssue[]): { errors: number; warnings: number; info: number } {
  return {
    errors: issues.filter((item) => item.severity === "error").length,
    warnings: issues.filter((item) => item.severity === "warning").length,
    info: issues.filter((item) => item.severity === "info").length,
  };
}
