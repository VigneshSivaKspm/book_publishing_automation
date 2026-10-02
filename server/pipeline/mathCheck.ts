import katex from "katex";

/** Extract LaTeX fragments from text with $...$ / $$...$$ delimiters. */
export function mathFragments(text: string): string[] {
  const out: string[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push((m[1] ?? m[2]).trim());
  return out;
}

/** Heuristic + parser checks for one LaTeX expression. Returns problems found. */
export function checkTex(tex: string): string[] {
  const problems: string[] = [];
  try {
    katex.renderToString(tex, { throwOnError: true, strict: "ignore" });
  } catch (err) {
    problems.push(`LaTeX does not parse: ${(err as Error).message.replace(/^KaTeX parse error:\s*/, "").slice(0, 120)}`);
  }
  const pairs: [string, string][] = [["(", ")"], ["[", "]"]];
  for (const [o, c] of pairs) {
    const stripped = tex.replace(/\\left|\\right|\\[a-zA-Z]+/g, " ");
    const opens = stripped.split(o).length - 1;
    const closes = stripped.split(c).length - 1;
    // Half-open intervals like [0, 1) are legitimate; only flag large imbalance.
    if (Math.abs(opens - closes) > 1) problems.push(`unbalanced ${o}${c}`);
  }
  if (/\\int_\{\s*\}|\\int\^\{\s*\}/.test(tex)) problems.push("empty integral bound");
  if (/(^|[^\\a-zA-Z])f_\{?[-\w]+\}?\^\{?[-\w]+\}?/.test(tex) && !/\bf\s*\(/.test(tex)) problems.push("possible integral sign read as 'f'");
  if (/\\frac\s*\{[^}]*\}\s*($|[^{\s])/.test(tex)) problems.push("fraction missing denominator");
  if (/\\sqrt\s*($|[^{[\s\\a-zA-Z0-9])/.test(tex)) problems.push("broken radical");
  if (/[\^_]\s*$/.test(tex)) problems.push("dangling superscript/subscript");
  return problems;
}

/** Check display LaTeX or text containing $...$ math. */
export function checkLatex(textOrTex: string, display = false): string[] {
  if (display) return checkTex(textOrTex);
  const dollarCount = (textOrTex.replace(/\\\$/g, "").match(/\$/g) ?? []).length;
  const problems = dollarCount % 2 === 1 ? ["unpaired $ math delimiter"] : [];
  for (const f of mathFragments(textOrTex)) problems.push(...checkTex(f));
  return problems;
}
