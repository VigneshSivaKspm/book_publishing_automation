import crypto from "node:crypto";
import { checkLatex } from "./mathCheck.ts";
import { confidenceBand, type BookModel, type Chapter, type ContentNode, type QuestionNode, type ReviewIssue } from "../../shared/model.ts";

const rid = (p: string) => `${p}_${crypto.randomBytes(5).toString("hex")}`;

export function normNum(n: string): string {
  return n.replace(/[^\dA-Za-z]/g, "").replace(/^0+(?=\d)/, "");
}

export function mathProblemsOf(n: ContentNode): string[] {
  const texts: [string, boolean][] = [];
  switch (n.kind) {
    case "equation":
      texts.push([n.latex, true]);
      break;
    case "heading":
    case "paragraph":
      texts.push([n.text, false]);
      break;
    case "list":
      n.items.forEach((i) => texts.push([i.text, false]));
      break;
    case "table":
      n.rows.flat().forEach((c) => texts.push([c.text, false]));
      break;
    case "question":
      texts.push([n.stem, false], ...n.options.map((o): [string, boolean] => [o.text, false]));
      if (n.assertion) texts.push([n.assertion, false]);
      if (n.reason) texts.push([n.reason, false]);
      n.statements.forEach((s) => texts.push([s, false]));
      n.match?.left.items.forEach((i) => texts.push([i.text, false]));
      n.match?.right.items.forEach((i) => texts.push([i.text, false]));
      break;
    case "figure":
      if (n.caption) texts.push([n.caption, false]);
      break;
  }
  return [...new Set(texts.flatMap(([t, d]) => checkLatex(t, d)))];
}

/**
 * Recompute node-level review state and issues. Page-level issues (nodeId
 * null) are kept. Nodes a person verified are not re-flagged for OCR
 * confidence, but content defects (unparseable math, missing options,
 * numbering) are always re-checked.
 */
export function refreshIssues(model: BookModel): void {
  const keep = model.issues.filter((i) => i.nodeId === null);
  const resolvedBefore = new Map(model.issues.filter((i) => i.resolved && i.nodeId).map((i) => [`${i.nodeId}|${i.message}`, true]));
  const issues: ReviewIssue[] = [...keep];
  const push = (i: Omit<ReviewIssue, "id" | "resolved">) =>
    issues.push({ ...i, id: rid("iss"), resolved: resolvedBefore.has(`${i.nodeId}|${i.message}`) });

  for (const ch of model.chapters) {
    for (const n of ch.nodes) {
      const ocrReasons: string[] = [];
      if (!n.verified) {
        if (confidenceBand(n.confidence) === "low" || n.uncertain.length) {
          ocrReasons.push(n.uncertain.length ? `Uncertain text: ${n.uncertain.slice(0, 4).map((s) => `“${s}”`).join(", ")}` : `Low OCR confidence (${Math.round(n.confidence * 100)}%)`);
        }
        ocrReasons.push(...n.reviewReasons.filter((r) => /^Figure|^A figure|^Duplicate/.test(r)));
      }
      const math = mathProblemsOf(n);
      const structural: string[] = [];
      if (n.kind === "question" && n.questionKind === "mcq" && n.options.length < 2) structural.push("MCQ has fewer than two options — options may be missing.");
      if (n.kind === "figure" && !n.assetId) structural.push("Figure has no image.");
      const reasons = [...new Set([...ocrReasons, ...math.map((p) => `Math: ${p}`), ...structural])];
      n.needsReview = reasons.length > 0;
      n.reviewReasons = reasons;
      if (n.needsReview) {
        const unparseable = math.some((p) => p.startsWith("LaTeX does not parse") || p.startsWith("unpaired $"));
        const category = math.length ? "equation" : n.kind === "table" ? "table" : n.kind === "question" ? "question" : n.kind === "figure" ? "figure" : "low_confidence";
        push({ category, severity: unparseable || (n.kind === "figure" && !n.assetId) ? "blocking" : "warning", sourcePage: n.sourcePage, nodeId: n.id, message: reasons.join(" · ") });
      }
    }
    validateQuestionNumbers(ch, push);
  }
  model.issues = issues;
}

function validateQuestionNumbers(ch: Chapter, issue: (i: Omit<ReviewIssue, "id" | "resolved">) => void): void {
  const qs = ch.nodes.filter((n): n is QuestionNode => n.kind === "question");
  const seen = new Map<string, QuestionNode>();
  let prev: number | null = null;
  for (const q of qs) {
    const key = normNum(q.number);
    if (!key) issue({ category: "question", severity: "blocking", sourcePage: q.sourcePage, nodeId: q.id, message: "Question has no number." });
    const dup = seen.get(key);
    if (dup && key) issue({ category: "question", severity: "warning", sourcePage: q.sourcePage, nodeId: q.id, message: `Duplicate question number ${q.number} (also on source page ${dup.sourcePage}).` });
    seen.set(key, q);
    const n = Number.parseInt(key, 10);
    if (Number.isFinite(n) && prev !== null) {
      if (n === 1 && prev > 1) {
        issue({ category: "question", severity: "info", sourcePage: q.sourcePage, nodeId: q.id, message: `Question numbering restarts at 1 after ${prev}.` });
      } else if (n > prev + 1) {
        const gap = n - prev - 1;
        const missing = Array.from({ length: Math.min(gap, 30) }, (_, i) => prev! + i + 1);
        issue({ category: "missing_content", severity: "warning", sourcePage: q.sourcePage, nodeId: q.id, message: `Missing question number(s) ${missing.join(", ")}${gap > 30 ? "…" : ""} before question ${n}.` });
      } else if (n < prev && n !== 1) {
        issue({ category: "question", severity: "warning", sourcePage: q.sourcePage, nodeId: q.id, message: `Question ${n} appears after ${prev} — possible reading-order error.` });
      }
    }
    if (Number.isFinite(n)) prev = n;
  }
}

/** Summary metrics used by the UI and the regression harness. */
export function documentMetrics(model: BookModel) {
  const nodes = model.chapters.flatMap((c) => c.nodes);
  const qs = nodes.filter((n): n is QuestionNode => n.kind === "question");
  const nums = qs.map((q) => Number.parseInt(normNum(q.number), 10)).filter(Number.isFinite);
  const dupes = nums.filter((n, i) => nums.indexOf(n) !== i);
  const missing: number[] = [];
  if (nums.length) {
    const set = new Set(nums);
    for (let i = 1; i <= Math.max(...nums); i++) if (!set.has(i)) missing.push(i);
  }
  const confs = nodes.map((n) => n.confidence);
  return {
    sourcePages: model.sourcePages.length,
    failedPages: model.sourcePages.filter((p) => p.status === "failed").length,
    chapters: model.chapters.length,
    blocks: nodes.length,
    questions: qs.length,
    questionNumbersMissing: missing,
    questionNumbersDuplicated: [...new Set(dupes)],
    answerKeyEntries: model.answerKey.length,
    questionsWithAnswers: qs.filter((q) => q.answer).length,
    equations: nodes.filter((n) => n.kind === "equation").length,
    equationIssues: model.issues.filter((i) => i.category === "equation" && !i.resolved).length,
    tables: nodes.filter((n) => n.kind === "table").length,
    figures: nodes.filter((n) => n.kind === "figure").length,
    meanConfidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
    openIssues: model.issues.filter((i) => !i.resolved).length,
    blockingIssues: model.issues.filter((i) => !i.resolved && i.severity === "blocking").length,
  };
}
