import { createNewBook, uid, type BookDocument, type ContentBlock } from "../types";
import { trimSizeMm, type BookModel, type ContentNode } from "../../shared/model.ts";
import { api } from "./api";

/**
 * Convert a reconstructed BookModel into the legacy editor's BookDocument so
 * existing editing tools keep working. One-way copy: the structured model
 * stays the source of truth for the print pipeline.
 */
export function modelToBookDocument(model: BookModel): BookDocument {
  const s = model.settings;
  const book = createNewBook(s.bookName || s.chapterName || "Untitled", {
    paperSize: s.trim === "A4" ? "A4" : s.trim === "REFERENCE_180_240" ? "REFERENCE_180_240" : "CUSTOM",
    bookMode: model.bookType === "question_bank" ? "qa" : "questions-only",
    author: s.organisationName,
  });
  const size = trimSizeMm(s);
  book.customWidthMm = size.widthMm;
  book.customHeightMm = size.heightMm;
  Object.assign(book.headerFooter, {
    chapterNumber: s.chapterNumber,
    chapterTitle: s.chapterName,
    middleBoxText: s.organisationName,
    middleRightText: s.subjectName,
    footerLeft: s.footerText || s.organisationName,
    watermarkEnabled: s.watermarkEnabled,
    watermarkText: s.watermarkText || s.organisationName,
    layoutColumns: model.bookType === "question_bank" ? 2 : 1,
    showColumnDivider: model.bookType === "question_bank",
  });
  const toBlocks = (n: ContentNode): ContentBlock[] => {
    const common = { sourcePage: n.sourcePage, confidence: n.confidence, warnings: n.reviewReasons };
    switch (n.kind) {
      case "heading":
        return [{ id: uid("blk"), type: n.level === 1 ? "heading2" : n.level === 2 ? "heading3" : "heading3", text: `${n.number ? `${n.number} ` : ""}${n.text}`, align: "left", ...common }];
      case "paragraph":
        return [{ id: uid("blk"), type: "paragraph", text: n.text, align: "justify", ...common }];
      case "list":
        return [{ id: uid("blk"), type: "list", text: n.items.map((i) => `${"  ".repeat(i.level - 1)}${i.marker} ${i.text}`).join("\n"), align: "left", ...common }];
      case "equation":
        return [{ id: uid("blk"), type: "math", text: `$$${n.latex}$$`, align: "center", ...common }];
      case "table":
        return [{
          id: uid("blk"),
          type: "table",
          text: n.rows.map((r, i) => `| ${r.map((c) => c.text.replace(/\|/g, "\\|")).join(" | ")} |${i === 0 ? `\n|${r.map(() => " --- ").join("|")}|` : ""}`).join("\n"),
          align: "left",
          ...common,
        }];
      case "figure":
        return [{ id: uid("blk"), type: "image", text: n.caption ?? "", imageUrl: n.assetId ? api.assetUrl(model.documentId, n.assetId) : undefined, imageAlt: n.caption ?? n.label ?? "Figure", align: "center", ...common }];
      case "question": {
        const lines = [`${n.number}. ${n.stem}${n.year ? ` (${n.year})` : ""}`];
        if (n.assertion) lines.push(`Assertion (A): ${n.assertion}`);
        if (n.reason) lines.push(`Reason (R): ${n.reason}`);
        n.statements.forEach((st) => lines.push(st));
        n.match?.left.items.forEach((l, i) => {
          const r = n.match!.right.items[i];
          lines.push(`(${l.label}) ${l.text}${r ? ` — ${r.label}. ${r.text}` : ""}`);
        });
        n.options.forEach((o) => lines.push(`${o.label}) ${o.text}`));
        return [{ id: uid("blk"), type: "mcq", text: lines.join("\n"), answer: n.answer ?? undefined, yearTag: n.year ?? undefined, answerSource: n.answer ? "scanned-key" : undefined, ...common }];
      }
    }
  };
  const blocks = model.chapters.flatMap((c) => c.nodes.flatMap(toBlocks));
  book.pages = [{ id: uid("page"), number: 1, blocks }];
  return book;
}
