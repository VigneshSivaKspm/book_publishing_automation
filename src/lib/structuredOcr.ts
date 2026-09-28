import type { BlockType } from "../types";

export interface DetectedOption { label: string; text: string }
export interface DetectedBlock {
  sourcePage: number;
  blockType: BlockType;
  text: string;
  mathLatex?: string;
  questionNumber?: number;
  options?: DetectedOption[];
  correctAnswer?: string;
  yearTag?: string;
  confidence: number;
  warnings: string[];
  order: number;
  bounds?: { x: number; y: number; width: number; height: number };
}
export interface DetectedPage { sourcePage: number; blocks: DetectedBlock[]; warnings: string[] }
export interface StructuredOcrDocument { pages: DetectedPage[] }

export const STRUCTURED_OCR_SCHEMA = {
  type: "object", additionalProperties: false, required: ["pages"], properties: {
    pages: { type: "array", items: { type: "object", additionalProperties: false, required: ["sourcePage", "blocks", "warnings"], properties: {
      sourcePage: { type: "integer", minimum: 1 }, warnings: { type: "array", items: { type: "string" } }, blocks: { type: "array", items: { type: "object", additionalProperties: false, required: ["sourcePage", "blockType", "text", "confidence", "warnings", "order"], properties: {
        sourcePage: { type: "integer", minimum: 1 }, blockType: { type: "string" }, text: { type: "string" }, mathLatex: { type: "string" }, questionNumber: { type: "integer" }, options: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "text"], properties: { label: { type: "string" }, text: { type: "string" } } } }, correctAnswer: { type: "string" }, yearTag: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 }, warnings: { type: "array", items: { type: "string" } }, order: { type: "integer", minimum: 0 }, bounds: { type: "object", additionalProperties: false, required: ["x", "y", "width", "height"], properties: { x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" } } }
      } } }
    } } }
  }
} as const;

const BLOCK_TYPES = new Set(["chapter-title", "heading1", "heading2", "heading3", "paragraph", "image", "math", "list", "table", "spacer", "mcq", "definition", "theorem", "example", "solution", "note", "exercise", "page-break"]);

export function validateStructuredOcrResponse(value: unknown): StructuredOcrDocument | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as { pages?: unknown }).pages)) return null;
  const pages = (value as { pages: unknown[] }).pages;
  for (const page of pages) {
    if (!page || typeof page !== "object") return null;
    const candidate = page as Partial<DetectedPage>;
    if (!Number.isInteger(candidate.sourcePage) || !Array.isArray(candidate.blocks) || !Array.isArray(candidate.warnings)) return null;
    for (const block of candidate.blocks) {
      if (!block || typeof block !== "object" || !BLOCK_TYPES.has(String(block.blockType)) || typeof block.text !== "string" || typeof block.confidence !== "number" || block.confidence < 0 || block.confidence > 1 || !Array.isArray(block.warnings) || !Number.isInteger(block.order)) return null;
    }
  }
  return value as StructuredOcrDocument;
}
