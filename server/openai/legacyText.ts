import type { ExtractedBlock, PageExtraction } from "./schemas.ts";

/**
 * Converts a structured page extraction into the canonical text format the
 * legacy in-editor importers parse (mcqEngine / docStructure / chapterMeta):
 *   <<<CHAPTER>>> Title | Number
 *   N. stem (year) / A) option …        (question mode)
 *   # / ## / ### headings, lists, pipe tables, $$display$$ math (document mode)
 *   ANSWER KEY / N. X                   (answer-key pages)
 */
export function extractionToLegacyText(p: PageExtraction, mode: "qa" | "document"): string {
  const out: string[] = [];
  if (p.chapter?.title) out.push(`<<<CHAPTER>>> ${p.chapter.title}${p.chapter.number ? ` | ${p.chapter.number}` : ""}`);
  if (p.answer_key.length) {
    out.push("ANSWER KEY", ...p.answer_key.map((a) => `${a.question}. ${a.answer}`));
    return out.join("\n");
  }
  for (const b of p.blocks) {
    const t = block(b, mode);
    if (t) out.push(t);
  }
  return out.join("\n\n");
}

function block(b: ExtractedBlock, mode: "qa" | "document"): string {
  switch (b.type) {
    case "chapter_title":
      return mode === "document" ? `# ${b.text ?? ""}` : "";
    case "heading": {
      const title = `${b.section_number ? `${b.section_number} ` : ""}${b.text ?? ""}`.trim();
      const level = b.heading_level ?? 4;
      return level === 1 ? `## ${title}` : level === 2 || level === 3 ? `### ${title}` : `#### ${title}`;
    }
    case "bullet_list":
    case "numbered_list":
      return (b.list_items ?? []).map((i) => `${"  ".repeat(Math.max(0, i.level - 1))}${b.type === "bullet_list" && !/^[➢o•]$/.test(i.marker) ? "-" : i.marker} ${i.text}`).join("\n");
    case "display_equation":
      return `$$${b.latex ?? ""}$$`;
    case "table": {
      const rows = b.table?.rows ?? [];
      if (!rows.length) return "";
      const line = (r: { text: string }[]) => `| ${r.map((c) => c.text.replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`;
      return [line(rows[0]), `|${rows[0].map(() => " --- ").join("|")}|`, ...rows.slice(1).map(line)].join("\n");
    }
    case "figure":
      return b.figure?.caption ? `[Figure: ${b.figure.caption}]` : "";
    case "question": {
      const q = b.question!;
      const lines = [`${q.number}. ${q.stem}${q.year ? ` (${q.year})` : ""}`];
      if (q.assertion) lines.push(`Assertion (A): ${q.assertion}`);
      if (q.reason) lines.push(`Reason (R): ${q.reason}`);
      lines.push(...q.statements);
      if (q.match) {
        const n = Math.max(q.match.left.items.length, q.match.right.items.length);
        for (let i = 0; i < n; i++) {
          const l = q.match.left.items[i];
          const r = q.match.right.items[i];
          lines.push(`${l ? `(${l.label}) ${l.text}` : ""}${r ? ` — (${r.label}) ${r.text}` : ""}`.trim());
        }
      }
      lines.push(...q.options.map((o) => `${o.label}) ${o.text}`));
      return lines.join("\n");
    }
    default:
      return b.text ?? "";
  }
}
