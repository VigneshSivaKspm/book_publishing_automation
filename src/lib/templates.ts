import { createNewBook, type BookDocument, type BookMode, type PaperSize } from "../types";

export interface PublicationTemplate {
  id: string;
  title: string;
  mode: BookMode;
  paperSize: PaperSize;
  columns: 1 | 2;
  description: string;
  features: string[];
}

export const PUBLICATION_TEMPLATES: PublicationTemplate[] = [
  { id: "reference-question-bank", title: "Reference Question Bank", mode: "qa", paperSize: "REFERENCE_180_240", columns: 2, description: "Dense mathematical question-bank composition matched to the supplied reference format.", features: ["Alternating headers", "Watermark", "Branded footer", "Six-column answer key"] },
  { id: "reference-study-book", title: "Reference Study Book", mode: "questions-only", paperSize: "REFERENCE_180_240", columns: 1, description: "Scholarly single-column chapter layout for syllabus books and worked examples.", features: ["Chapter opener", "Section hierarchy", "Theorem and exercise styles", "Bracketed folios"] },
  { id: "clean-academic-a4", title: "Clean Academic A4", mode: "questions-only", paperSize: "A4", columns: 1, description: "Spacious academic document for notes, handouts and course materials.", features: ["A4 output", "Single column", "Accessible type scale", "Minimal running furniture"] },
  { id: "compact-b5-workbook", title: "Compact B5 Workbook", mode: "qa", paperSize: "B5", columns: 2, description: "Compact practice workbook with efficient question density.", features: ["B5 output", "Two columns", "Answer key", "Exercise-ready"] },
];

export function createFromTemplate(template: PublicationTemplate, title = "Untitled publication"): BookDocument {
  const book = createNewBook(title, { paperSize: template.paperSize, bookMode: template.mode });
  book.templateId = template.id;
  book.headerFooter.layoutColumns = template.columns;
  book.headerFooter.showColumnDivider = template.columns === 2;
  book.headerFooter.pageNumberStyle = template.mode === "questions-only" ? "bracket" : "production-tab";
  book.headerFooter.autoGenerateAnswerKey = template.mode === "qa";
  book.headerFooter.watermarkEnabled = template.id.startsWith("reference");
  if (template.id === "clean-academic-a4") {
    book.headerFooter.alternatingHeaders = false;
    book.headerFooter.watermarkEnabled = false;
  }
  return book;
}
