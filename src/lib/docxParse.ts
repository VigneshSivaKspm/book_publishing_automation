import mammoth from "mammoth";
import { addLog } from "./logger";

/**
 * Native Word (.docx) reader for Doc Scan.
 *
 * Word files are read directly from their XML content via `mammoth` — no
 * image rendering / vision OCR is needed (or possible, since .docx has no
 * fixed page images), so this is both faster and far more accurate than
 * routing the file through the OCR pipeline.
 *
 * `mode: 'document'` (syllabus) converts to HTML first so headings, lists
 * and tables survive, then flattens that HTML into the same lightweight
 * markdown-ish shape `structureDocumentText` already parses (#, ##, •, |...|).
 * `mode: 'qa'` (question bank) extracts plain text and splits it into
 * page-sized batches of questions so downstream pagination behaves like a
 * real scanned paper instead of dumping everything onto one page.
 *
 * Legacy binary `.doc` files are not OOXML zips, so mammoth cannot read
 * them; that failure is surfaced as an empty result (caller shows "nothing
 * readable was extracted") rather than silently emitting garbled bytes.
 */

function cleanInline(el: Element): string {
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

function htmlToStructuredText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];

  const pushBlank = () => {
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
  };

  const walk = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case "h1": {
        const t = cleanInline(el);
        if (t) {
          pushBlank();
          lines.push(`# ${t}`);
          pushBlank();
        }
        return;
      }
      case "h2": {
        const t = cleanInline(el);
        if (t) {
          pushBlank();
          lines.push(`## ${t}`);
          pushBlank();
        }
        return;
      }
      case "h3": {
        const t = cleanInline(el);
        if (t) {
          pushBlank();
          lines.push(`### ${t}`);
          pushBlank();
        }
        return;
      }
      case "h4":
      case "h5":
      case "h6": {
        const t = cleanInline(el);
        if (t) {
          pushBlank();
          lines.push(`#### ${t}`);
          pushBlank();
        }
        return;
      }
      case "p": {
        const t = cleanInline(el);
        if (!t) return;
        // A short paragraph that is entirely bold is a heading / run-in label
        // ("1.1 Theory of Equations", "Example 1", "Solution").
        const boldText = Array.from(el.querySelectorAll("strong, b"))
          .map((b) => b.textContent || "")
          .join("")
          .replace(/\s+/g, " ")
          .trim();
        if (boldText && boldText === t && t.length <= 90) {
          pushBlank();
          const depth = t.match(/^(\d+(?:\.\d+)+)\.?\s/)?.[1].split(".").length ?? 0;
          lines.push(`${depth >= 3 ? "###" : depth === 2 ? "##" : "####"} ${t}`);
          pushBlank();
          return;
        }
        // Keep manual line breaks (<br>) as separate lines.
        const parts = (el.innerHTML || "")
          .split(/<br\s*\/?>/i)
          .map((h) => {
            const d = document.createElement("div");
            d.innerHTML = h;
            return (d.textContent || "").replace(/\s+/g, " ").trim();
          })
          .filter(Boolean);
        lines.push(...(parts.length ? parts : [t]));
        // Short lines are usually solution steps: keep them in one block.
        if (t.length > 90) pushBlank();
        return;
      }
      case "ul": {
        for (const li of Array.from(el.children)) {
          if (li.tagName.toLowerCase() !== "li") continue;
          const t = cleanInline(li);
          if (t) lines.push(`• ${t}`);
        }
        pushBlank();
        return;
      }
      case "ol": {
        let n = 1;
        for (const li of Array.from(el.children)) {
          if (li.tagName.toLowerCase() !== "li") continue;
          const t = cleanInline(li);
          if (t) lines.push(`${n}. ${t}`);
          n++;
        }
        pushBlank();
        return;
      }
      case "table": {
        const rows = Array.from(el.querySelectorAll("tr"));
        rows.forEach((tr, i) => {
          const cells = Array.from(tr.children).map((c) =>
            cleanInline(c).replace(/\|/g, "/") || " ",
          );
          if (cells.length === 0) return;
          lines.push(`| ${cells.join(" | ")} |`);
          if (i === 0) lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
        });
        pushBlank();
        return;
      }
      case "img":
        return;
      default:
        for (const child of Array.from(el.childNodes)) walk(child);
    }
  };

  walk(doc.body);
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split raw question-bank text into page-sized batches (~14 questions each). */
function chunkQuestionText(raw: string, perPage = 14): string[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const qStart = /^\s*\d{1,3}[.)]\s+\S/;
  const pages: string[] = [];
  let cur: string[] = [];
  let count = 0;

  for (const line of lines) {
    if (qStart.test(line)) {
      if (count >= perPage) {
        const chunk = cur.join("\n").trim();
        if (chunk) pages.push(chunk);
        cur = [];
        count = 0;
      }
      count++;
    }
    cur.push(line);
  }
  const last = cur.join("\n").trim();
  if (last) pages.push(last);

  return pages.length ? pages : [raw];
}

/** Read a .docx file directly into page-text strings for Doc Scan. Returns [] on failure. */
export async function parseDocxToPages(
  file: File,
  mode: "qa" | "document",
): Promise<string[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    if (mode === "document") {
      const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer });
      if (messages?.length) {
        addLog({
          category: "ocr",
          level: "warn",
          title: "Word Conversion Notes",
          details: messages
            .slice(0, 5)
            .map((m) => m.message)
            .join(" | "),
        });
      }
      const structuredText = htmlToStructuredText(html);
      if (!structuredText.trim()) return [];
      addLog({
        category: "ocr",
        level: "success",
        title: "Word Document Parsed",
        details: `Extracted structured content directly from ${file.name} (headings, lists & tables preserved, no OCR needed).`,
      });
      return [structuredText];
    }

    const { value: rawText, messages } = await mammoth.extractRawText({ arrayBuffer });
    if (messages?.length) {
      addLog({
        category: "ocr",
        level: "warn",
        title: "Word Conversion Notes",
        details: messages
          .slice(0, 5)
          .map((m) => m.message)
          .join(" | "),
      });
    }
    if (!rawText.trim()) return [];
    const chunks = chunkQuestionText(rawText).filter((c) => c.trim());
    addLog({
      category: "ocr",
      level: "success",
      title: "Word Document Parsed",
      details: `Extracted ${chunks.length} page(s) of question text directly from ${file.name} (no OCR needed).`,
    });
    return chunks;
  } catch (err) {
    addLog({
      category: "ocr",
      level: "error",
      title: "Word Document Parse Failed",
      details: `${file.name}: ${err instanceof Error ? err.message : String(err)}. If this is a legacy .doc file, re-save it as .docx and try again.`,
    });
    console.warn("DOCX parsing error:", err);
    return [];
  }
}
