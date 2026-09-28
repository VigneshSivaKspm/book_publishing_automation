import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const types = await server.ssrLoadModule("/src/types.ts");
  const persistence = await server.ssrLoadModule("/src/lib/persistence.ts");
  const mcq = await server.ssrLoadModule("/src/lib/mcqEngine.ts");
  const preflight = await server.ssrLoadModule("/src/lib/preflight.ts");
  const structured = await server.ssrLoadModule("/src/lib/structuredOcr.ts");
  const print = await server.ssrLoadModule("/src/lib/printExport.ts");

  const book = types.createNewBook("Calculus", { paperSize: "REFERENCE_180_240", bookMode: "qa" });
  assert.equal(types.PAPER_DIMENSIONS.REFERENCE_180_240.widthMm, 180);
  assert.equal(types.PAPER_DIMENSIONS.REFERENCE_180_240.heightMm, 240);

  const migrated = persistence.migrateBook({ ...book, schemaVersion: undefined, assets: undefined });
  assert.equal(migrated.schemaVersion, persistence.CURRENT_SCHEMA_VERSION);
  assert.ok(Array.isArray(migrated.assets));

  const parsed = mcq.structureExamText("7. Evaluate $x^2$ (2024)\nA) 1\nB) 2\nC) 3\nD) 4\n\n8. Next question\nA) A\nB) B\nC) C\nD) D");
  assert.equal(parsed.mcqCount, 2);
  assert.match(parsed.blocks[0].text, /^7\./);

  const invalidBook = structuredClone(book);
  invalidBook.pages[0].blocks = [
    { id: "q1", type: "mcq", text: "1. First\nA) One\nB) Two" },
    { id: "q2", type: "mcq", text: "1. Duplicate\nA) One\nB) Two", answer: "A" },
  ];
  const issues = preflight.runPreflight(invalidBook);
  assert.ok(issues.some((item) => item.code === "duplicate-question"));
  assert.ok(issues.some((item) => item.code === "missing-answer"));

  const response = { pages: [{ sourcePage: 1, warnings: [], blocks: [{ sourcePage: 1, blockType: "paragraph", text: "Source text", confidence: 0.9, warnings: [], order: 0 }] }] };
  assert.ok(structured.validateStructuredOcrResponse(response));
  assert.equal(structured.validateStructuredOcrResponse({ pages: [{ blocks: [] }] }), null);

  const html = print.buildPrintableHtml(book);
  assert.match(html, /@page \{ size: 180mm 240mm; margin: 0; \}/);
  assert.match(html, /break-inside: avoid/);
  assert.doesNotMatch(html, /VITE_OPENAI_API_KEY|OPENAI_API_KEY|sk-proj-/);

  console.log("Smoke tests passed: migration, MCQ parsing, preflight, structured OCR validation, and print HTML.");
} finally {
  await server.close();
}
