import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Renders text containing $...$ / $$...$$ LaTeX. Parse errors show in red. */
export function renderMathHtml(text: string, display = false): string {
  if (display) return katex.renderToString(text, { displayMode: true, throwOnError: false, strict: "ignore" });
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out += escapeHtml(text.slice(last, m.index)).replace(/\n/g, "<br>");
    out += katex.renderToString(m[1] ?? m[2], { displayMode: m[1] !== undefined, throwOnError: false, strict: "ignore" });
    last = m.index + m[0].length;
  }
  return out + escapeHtml(text.slice(last)).replace(/\n/g, "<br>");
}

export default function MathText({ text, display = false, className = "" }: { text: string; display?: boolean; className?: string }) {
  const html = useMemo(() => renderMathHtml(text, display), [text, display]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
