/** Lightweight math helpers — KaTeX when available, precise Unicode otherwise. */

const SUPER: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', 'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ',
}

const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', 'a': 'ₐ', 'e': 'ₑ', 'i': 'ᵢ',
  'o': 'ₒ', 'u': 'ᵤ', 'x': 'ₓ', 'n': 'ₙ',
}

const SYMBOLS: [RegExp, string][] = [
  [/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)'],
  [/\\sqrt\{([^}]+)\}/g, '√($1)'],
  [/\\sum/g, '∑'],
  [/\\int/g, '∫'],
  [/\\prod/g, '∏'],
  [/\\infty/g, '∞'],
  [/\\pm/g, '±'],
  [/\\times/g, '×'],
  [/\\div/g, '÷'],
  [/\\cdot/g, '·'],
  [/\\leq/g, '≤'],
  [/\\geq/g, '≥'],
  [/\\neq/g, '≠'],
  [/\\approx/g, '≈'],
  [/\\alpha/g, 'α'],
  [/\\beta/g, 'β'],
  [/\\gamma/g, 'γ'],
  [/\\delta/g, 'δ'],
  [/\\theta/g, 'θ'],
  [/\\lambda/g, 'λ'],
  [/\\mu/g, 'μ'],
  [/\\pi/g, 'π'],
  [/\\sigma/g, 'σ'],
  [/\\phi/g, 'φ'],
  [/\\omega/g, 'ω'],
  [/\\Delta/g, 'Δ'],
  [/\\Sigma/g, 'Σ'],
  [/\\Omega/g, 'Ω'],
  [/\\rightarrow/g, '→'],
  [/\\leftarrow/g, '←'],
  [/\\Rightarrow/g, '⇒'],
  [/\\partial/g, '∂'],
  [/\\nabla/g, '∇'],
  [/\\in/g, '∈'],
  [/\\notin/g, '∉'],
  [/\\subset/g, '⊂'],
  [/\\cup/g, '∪'],
  [/\\cap/g, '∩'],
  [/\\forall/g, '∀'],
  [/\\exists/g, '∃'],
  [/\\ldots/g, '…'],
  [/\\,/g, ' '],
  [/\\;/g, ' '],
  [/\\ /g, ' '],
]

function mapChars(s: string, map: Record<string, string>): string {
  return [...s].map((c) => map[c] ?? c).join('')
}

/** Convert simple TeX-like expression to readable Unicode math. */
export function texToReadable(tex: string): string {
  let s = tex.trim()
  for (const [re, rep] of SYMBOLS) s = s.replace(re, rep)
  s = s.replace(/\^(\{([^}]+)\}|([A-Za-z0-9+\-=nxi]))/g, (_, _a, braced, single) =>
    mapChars(braced ?? single, SUPER),
  )
  s = s.replace(/_(\{([^}]+)\}|([A-Za-z0-9+\-=aeiouxn]))/g, (_, _a, braced, single) =>
    mapChars(braced ?? single, SUB),
  )
  s = s.replace(/[{}]/g, '')
  return s
}

export function extractMathSegments(text: string): { type: 'text' | 'math' | 'display'; value: string }[] {
  const parts: { type: 'text' | 'math' | 'display'; value: string }[] = []
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    const raw = m[0]
    if (raw.startsWith('$$')) {
      parts.push({ type: 'display', value: raw.slice(2, -2).trim() })
    } else {
      parts.push({ type: 'math', value: raw.slice(1, -1).trim() })
    }
    last = m.index + raw.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  if (parts.length === 0) parts.push({ type: 'text', value: text })
  return parts
}

export const MATH_SNIPPETS: { id: string; label: string; tex: string; group: string }[] = [
  { id: 'quad', label: 'Quadratic', tex: '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$', group: 'Algebra' },
  { id: 'pythag', label: 'Pythagoras', tex: '$$a^2 + b^2 = c^2$$', group: 'Geometry' },
  { id: 'deriv', label: 'Derivative', tex: '$$\\frac{d}{dx}[f(x)] = \\lim_{h \\to 0}\\frac{f(x+h)-f(x)}{h}$$', group: 'Calculus' },
  { id: 'integ', label: 'Integral', tex: '$$\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)$$', group: 'Calculus' },
  { id: 'sum', label: 'Summation', tex: '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$', group: 'Series' },
  { id: 'matrix', label: '2×2 Matrix', tex: '$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$', group: 'Linear' },
  { id: 'euler', label: 'Euler', tex: '$$e^{i\\pi} + 1 = 0$$', group: 'Complex' },
  { id: 'binom', label: 'Binomial', tex: '$$(x+y)^n = \\sum_{k=0}^{n}\\binom{n}{k}x^{n-k}y^k$$', group: 'Algebra' },
  { id: 'inline', label: 'Inline π', tex: '$\\pi \\approx 3.14159$', group: 'Constants' },
  { id: 'ineq', label: 'Inequality', tex: '$$|x - \\mu| \\leq 3\\sigma$$', group: 'Stats' },
]

let katexTried = false

type KatexApi = { renderToString: (tex: string, opts: Record<string, unknown>) => string }

let katexApi: KatexApi | null = null

export async function loadKatex(): Promise<KatexApi | null> {
  if (katexApi) return katexApi
  if (katexTried) return null
  katexTried = true
  try {
    const mod = await import('katex')
    katexApi = (mod.default ?? mod) as KatexApi
    return katexApi
  } catch {
    return null
  }
}

export function renderMathHtml(tex: string, displayMode: boolean): string {
  if (katexApi) {
    try {
      return katexApi.renderToString(tex, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: false,
      })
    } catch {
      /* use readable */
    }
  }
  // Fallback: readable Unicode now, but keep the raw TeX so an export/print page
  // can upgrade it to real KaTeX once the library loads in the browser.
  const readable = texToReadable(tex)
  const cls = displayMode ? 'math-display' : 'math-inline'
  return `<span class="${cls}" data-tex="${escapeHtml(tex)}">${escapeHtml(readable)}</span>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderTextWithMath(text: string): string {
  return extractMathSegments(text)
    .map((seg) => {
      if (seg.type === 'text') return escapeHtml(seg.value)
      return renderMathHtml(seg.value, seg.type === 'display')
    })
    .join('')
}
