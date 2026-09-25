/** Document fonts — English, Tamil, Math + custom library (import / export). */

export type FontPresetId =
  | 'english-serif'
  | 'english-sans'
  | 'tamil-noto'
  | 'tamil-latha'
  | 'math-stix'
  | 'math-latin'
  | 'mixed-en-ta'
  | 'custom'

export interface FontPreset {
  id: FontPresetId | string
  label: string
  group: 'English' | 'Tamil' | 'Math' | 'Mixed' | 'Custom'
  family: string
  stack: string
  sample: string
}

export interface CustomFontRecord {
  id: string
  name: string
  family: string
  /** base64 (no data: prefix) for persistence / export */
  dataBase64: string
  format: string
  addedAt: string
  fileName: string
}

export interface FontPack {
  version: 1
  exportedAt: string
  fonts: CustomFontRecord[]
  /** optional book font prefs */
  prefs?: {
    fontId?: string
    mathFontId?: string
    customFontFamily?: string
    customFontLabel?: string
  }
}

const loadedGoogleFonts = new Set<string>()

export function ensureFontLoaded(fontIdOrFamily: string) {
  if (typeof document === 'undefined') return
  const preset = FONT_PRESETS.find((f) => f.id === fontIdOrFamily || f.family === fontIdOrFamily)
  const family = preset ? preset.family : fontIdOrFamily
  if (
    !family ||
    loadedGoogleFonts.has(family) ||
    family.startsWith('Custom_') ||
    SYSTEM_ONLY.test(family)
  ) {
    return
  }

  loadedGoogleFonts.add(family)
  googleFontUrls(family).forEach((href, i) => {
    const linkId = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}-${i}`
    if (document.getElementById(linkId)) return
    const link = document.createElement('link')
    link.id = linkId
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  })
}

/** Google rejects a whole request if any asked-for style is missing (e.g. a font
 *  with no bold), so load the regular face on its own and try bold separately. */
function googleFontUrls(family: string): string[] {
  const f = encodeURIComponent(family).replace(/%20/g, '+')
  return [
    `https://fonts.googleapis.com/css2?family=${f}&display=swap`,
    `https://fonts.googleapis.com/css2?family=${f}:wght@700&display=swap`,
  ]
}

export const FONT_PRESETS: FontPreset[] = [
  // ── TAMIL FONTS (25+) ──
  { id: 'tamil-noto', label: 'Noto Sans Tamil', group: 'Tamil', family: 'Noto Sans Tamil', stack: '"Noto Sans Tamil", "Latha", "Tamil MN", sans-serif', sample: 'தமிழ் ஆஆஈ 123' },
  { id: 'tamil-noto-serif', label: 'Noto Serif Tamil', group: 'Tamil', family: 'Noto Serif Tamil', stack: '"Noto Serif Tamil", "Vijaya", Georgia, serif', sample: 'தமிழ் இலக்கியம்' },
  { id: 'tamil-catamaran', label: 'Catamaran', group: 'Tamil', family: 'Catamaran', stack: '"Catamaran", "Noto Sans Tamil", sans-serif', sample: 'தமிழ் மொழி' },
  { id: 'tamil-mukta', label: 'Mukta Malalar', group: 'Tamil', family: 'Mukta Malalar', stack: '"Mukta Malalar", "Noto Sans Tamil", sans-serif', sample: 'தமிழ் பாடநூல்' },
  { id: 'tamil-hind', label: 'Hind Madurai', group: 'Tamil', family: 'Hind Madurai', stack: '"Hind Madurai", "Noto Sans Tamil", sans-serif', sample: 'தமிழ் வினா விடை' },
  { id: 'tamil-baloo', label: 'Baloo Thambi 2', group: 'Tamil', family: 'Baloo Thambi 2', stack: '"Baloo Thambi 2", "Noto Sans Tamil", cursive', sample: 'தமிழ் தலைப்பு' },
  { id: 'tamil-pavanam', label: 'Pavanam', group: 'Tamil', family: 'Pavanam', stack: '"Pavanam", "Noto Sans Tamil", sans-serif', sample: 'தமிழ் அச்சகம்' },
  { id: 'tamil-arima', label: 'Arima', group: 'Tamil', family: 'Arima', stack: '"Arima", "Noto Serif Tamil", cursive', sample: 'தமிழ் கவிதை' },
  { id: 'tamil-meera', label: 'Meera Inimai', group: 'Tamil', family: 'Meera Inimai', stack: '"Meera Inimai", "Noto Sans Tamil", sans-serif', sample: 'தமிழ் இனிமை' },
  { id: 'tamil-coiny', label: 'Coiny', group: 'Tamil', family: 'Coiny', stack: '"Coiny", "Noto Sans Tamil", display', sample: 'தமிழ் முகப்பு' },
  { id: 'tamil-anek', label: 'Anek Tamil', group: 'Tamil', family: 'Anek Tamil', stack: '"Anek Tamil", "Noto Sans Tamil", sans-serif', sample: 'தமிழ் தேர்வு' },
  { id: 'tamil-tiro', label: 'Tiro Tamil', group: 'Tamil', family: 'Tiro Tamil', stack: '"Tiro Tamil", "Noto Serif Tamil", serif', sample: 'தமிழ் புத்தகம்' },
  { id: 'tamil-kavivanar', label: 'Kavivanar', group: 'Tamil', family: 'Kavivanar', stack: '"Kavivanar", "Noto Sans Tamil", handwriting', sample: 'தமிழ் கையெழுத்து' },
  { id: 'tamil-grantha', label: 'Grantha (Noto)', group: 'Tamil', family: 'Noto Sans Grantha', stack: '"Noto Sans Grantha", "Noto Sans Tamil", sans-serif', sample: '𑌗𑌿𑌰𑌨𑍍𑌥 𑌤𑌮𑌿𑌴𑍍' },
  { id: 'tamil-latha', label: 'Latha System', group: 'Tamil', family: 'Latha', stack: '"Latha", "Tamil MN", "Noto Sans Tamil", sans-serif', sample: 'தமிழ் Latha' },
  { id: 'tamil-inaimathi', label: 'InaiMathi', group: 'Tamil', family: 'InaiMathi', stack: '"InaiMathi", "Noto Sans Tamil", sans-serif', sample: 'இணைமதி தமிழ்' },
  { id: 'tamil-vijaya', label: 'Vijaya Serif', group: 'Tamil', family: 'Vijaya', stack: '"Vijaya", "Noto Serif Tamil", serif', sample: 'விஜயா தமிழ்' },
  { id: 'tamil-bamini', label: 'Bamini', group: 'Tamil', family: 'Bamini', stack: '"Bamini", "Noto Sans Tamil", sans-serif', sample: 'பாமிணி தமிழ்' },
  { id: 'tamil-sentinel', label: 'Sentinel Tamil', group: 'Tamil', family: 'Sentinel Tamil', stack: '"Sentinel Tamil", "Noto Serif Tamil", serif', sample: 'சென்டினல் தமிழ்' },
  { id: 'tamil-vani', label: 'Vani', group: 'Tamil', family: 'Vani', stack: '"Vani", "Noto Sans Tamil", sans-serif', sample: 'வாணி தமிழ்' },
  { id: 'tamil-baamini-classic', label: 'Baamini Classic', group: 'Tamil', family: 'Baamini', stack: '"Baamini", "Noto Serif Tamil", serif', sample: 'பாமிணி கிளாசிக்' },
  { id: 'tamil-sangam', label: 'Sangam MN', group: 'Tamil', family: 'Tamil Sangam MN', stack: '"Tamil Sangam MN", "Noto Serif Tamil", serif', sample: 'தமிழ் சங்கம்' },
  { id: 'tamil-kalyani', label: 'Kalyani', group: 'Tamil', family: 'Kalyani', stack: '"Kalyani", "Noto Sans Tamil", sans-serif', sample: 'கல்யாணி தமிழ்' },
  { id: 'tamil-shree', label: 'Shree Tamil', group: 'Tamil', family: 'Shree Tamil', stack: '"Shree Tamil", "Noto Serif Tamil", serif', sample: 'ஸ்ரீ தமிழ்' },
  { id: 'tamil-noto-supp', label: 'Noto Tamil Supp', group: 'Tamil', family: 'Noto Sans Tamil Supplement', stack: '"Noto Sans Tamil Supplement", "Noto Sans Tamil", sans-serif', sample: 'தமிழ் பிராமி' },

  // ── ENGLISH FONTS (45+) ──
  // Serif & Book Publishing
  { id: 'english-serif', label: 'Source Serif 4', group: 'English', family: 'Source Serif 4', stack: '"Source Serif 4", Georgia, serif', sample: 'Aa Bb Cc 123' },
  { id: 'en-noto-serif', label: 'Noto Serif', group: 'English', family: 'Noto Serif', stack: '"Noto Serif", serif', sample: 'The quick brown fox' },
  { id: 'en-merriweather', label: 'Merriweather', group: 'English', family: 'Merriweather', stack: '"Merriweather", Georgia, serif', sample: 'Editorial Publishing' },
  { id: 'en-lora', label: 'Lora', group: 'English', family: 'Lora', stack: '"Lora", Georgia, serif', sample: 'Calligraphic Elegance' },
  { id: 'en-playfair', label: 'Playfair Display', group: 'English', family: 'Playfair Display', stack: '"Playfair Display", Georgia, serif', sample: 'Luxury Headline' },
  { id: 'en-pt-serif', label: 'PT Serif', group: 'English', family: 'PT Serif', stack: '"PT Serif", Georgia, serif', sample: 'Academic Textbook' },
  { id: 'en-cormorant', label: 'Cormorant Garamond', group: 'English', family: 'Cormorant Garamond', stack: '"Cormorant Garamond", Garamond, serif', sample: 'Garamond Classic' },
  { id: 'en-crimson', label: 'Crimson Pro', group: 'English', family: 'Crimson Pro', stack: '"Crimson Pro", Georgia, serif', sample: 'Classic Literature' },
  { id: 'en-eb-garamond', label: 'EB Garamond', group: 'English', family: 'EB Garamond', stack: '"EB Garamond", Garamond, serif', sample: 'Renaissance Book' },
  { id: 'en-libre-baskerville', label: 'Libre Baskerville', group: 'English', family: 'Libre Baskerville', stack: '"Libre Baskerville", Baskerville, serif', sample: 'Traditional Printing' },
  { id: 'en-cinzel', label: 'Cinzel', group: 'English', family: 'Cinzel', stack: '"Cinzel", Trajan, serif', sample: 'ROMAN INSCRIPTION' },
  { id: 'en-bodoni', label: 'Bodoni Moda', group: 'English', family: 'Bodoni Moda', stack: '"Bodoni Moda", Bodoni, serif', sample: 'High Contrast Serif' },
  { id: 'en-spectral', label: 'Spectral', group: 'English', family: 'Spectral', stack: '"Spectral", Georgia, serif', sample: 'Screen & Print Design' },
  { id: 'en-frank-ruhl', label: 'Frank Ruhl Libre', group: 'English', family: 'Frank Ruhl Libre', stack: '"Frank Ruhl Libre", serif', sample: 'Literary Typesetting' },
  { id: 'en-vollkorn', label: 'Vollkorn', group: 'English', family: 'Vollkorn', stack: '"Vollkorn", Georgia, serif', sample: 'Quiet Body Font' },

  // Sans-Serif & Modern UI
  { id: 'english-sans', label: 'Noto Sans', group: 'English', family: 'Noto Sans', stack: '"Noto Sans", Arial, sans-serif', sample: 'Aa Bb Cc 123' },
  { id: 'en-inter', label: 'Inter', group: 'English', family: 'Inter', stack: '"Inter", system-ui, sans-serif', sample: 'Modern Interface' },
  { id: 'en-roboto', label: 'Roboto', group: 'English', family: 'Roboto', stack: '"Roboto", Arial, sans-serif', sample: 'Clean Geometric' },
  { id: 'en-outfit', label: 'Outfit', group: 'English', family: 'Outfit', stack: '"Outfit", sans-serif', sample: 'Modern Premium UI' },
  { id: 'en-open-sans', label: 'Open Sans', group: 'English', family: 'Open Sans', stack: '"Open Sans", sans-serif', sample: 'Neutral Legibility' },
  { id: 'en-montserrat', label: 'Montserrat', group: 'English', family: 'Montserrat', stack: '"Montserrat", sans-serif', sample: 'Geometric Banners' },
  { id: 'en-poppins', label: 'Poppins', group: 'English', family: 'Poppins', stack: '"Poppins", sans-serif', sample: 'Warm Geometric' },
  { id: 'en-lato', label: 'Lato', group: 'English', family: 'Lato', stack: '"Lato", sans-serif', sample: 'Friendly Warm Sans' },
  { id: 'en-oswald', label: 'Oswald', group: 'English', family: 'Oswald', stack: '"Oswald", sans-serif', sample: 'CONDENSED TITLE' },
  { id: 'en-raleway', label: 'Raleway', group: 'English', family: 'Raleway', stack: '"Raleway", sans-serif', sample: 'Thin & Bold Stylish' },
  { id: 'en-nunito', label: 'Nunito', group: 'English', family: 'Nunito', stack: '"Nunito", sans-serif', sample: 'Rounded Friendly' },
  { id: 'en-work-sans', label: 'Work Sans', group: 'English', family: 'Work Sans', stack: '"Work Sans", sans-serif', sample: 'Print & Screen UI' },
  { id: 'en-plus-jakarta', label: 'Plus Jakarta Sans', group: 'English', family: 'Plus Jakarta Sans', stack: '"Plus Jakarta Sans", sans-serif', sample: 'Tech Product Sans' },
  { id: 'en-rubik', label: 'Rubik', group: 'English', family: 'Rubik', stack: '"Rubik", sans-serif', sample: 'Slightly Rounded' },
  { id: 'en-dm-sans', label: 'DM Sans', group: 'English', family: 'DM Sans', stack: '"DM Sans", sans-serif', sample: 'Low Contrast Sans' },
  { id: 'en-quicksand', label: 'Quicksand', group: 'English', family: 'Quicksand', stack: '"Quicksand", sans-serif', sample: 'Soft Display Sans' },
  { id: 'en-barlow', label: 'Barlow', group: 'English', family: 'Barlow', stack: '"Barlow", sans-serif', sample: 'Slightly Condensed' },
  { id: 'en-manrope', label: 'Manrope', group: 'English', family: 'Manrope', stack: '"Manrope", sans-serif', sample: 'Semi-Geometric' },
  { id: 'en-lexend', label: 'Lexend', group: 'English', family: 'Lexend', stack: '"Lexend", sans-serif', sample: 'Enhanced Fluency' },

  // Monospace & Technical
  { id: 'en-fira-code', label: 'Fira Code', group: 'English', family: 'Fira Code', stack: '"Fira Code", monospace', sample: 'function() => { x = 1 }' },
  { id: 'en-jetbrains-mono', label: 'JetBrains Mono', group: 'English', family: 'JetBrains Mono', stack: '"JetBrains Mono", monospace', sample: 'Developer Code' },
  { id: 'en-ibm-plex-mono', label: 'IBM Plex Mono', group: 'English', family: 'IBM Plex Mono', stack: '"IBM Plex Mono", monospace', sample: 'Academic Monospace' },
  { id: 'en-source-code', label: 'Source Code Pro', group: 'English', family: 'Source Code Pro', stack: '"Source Code Pro", monospace', sample: 'Adobe Monospace' },
  { id: 'en-space-mono', label: 'Space Mono', group: 'English', family: 'Space Mono', stack: '"Space Mono", monospace', sample: 'Retro Technical' },
  { id: 'en-courier-prime', label: 'Courier Prime', group: 'English', family: 'Courier Prime', stack: '"Courier Prime", monospace', sample: 'Typewriter Style' },

  // Display & Handwriting
  { id: 'en-caveat', label: 'Caveat', group: 'English', family: 'Caveat', stack: '"Caveat", cursive', sample: 'Handwritten Notes' },
  { id: 'en-pacifico', label: 'Pacifico', group: 'English', family: 'Pacifico', stack: '"Pacifico", cursive', sample: 'Fun Brush Script' },
  { id: 'en-dancing-script', label: 'Dancing Script', group: 'English', family: 'Dancing Script', stack: '"Dancing Script", cursive', sample: 'Flowing Calligraphy' },
  { id: 'en-bebas-neue', label: 'Bebas Neue', group: 'English', family: 'Bebas Neue', stack: '"Bebas Neue", sans-serif', sample: 'BIG HEADLINE' },
  { id: 'en-lobster', label: 'Lobster', group: 'English', family: 'Lobster', stack: '"Lobster", cursive', sample: 'Bold Vintage Script' },

  // ── MATHS & SCIENTIFIC FONTS (20+) ──
  { id: 'math-stix', label: 'STIX Two Text', group: 'Math', family: 'STIX Two Text', stack: '"STIX Two Text", "STIX Two Math", "Times New Roman", serif', sample: '∑ ∫ √ π θ α β' },
  { id: 'math-latin', label: 'Latin Modern Roman', group: 'Math', family: 'Latin Modern Roman', stack: '"Latin Modern Roman", "Computer Modern", "Times New Roman", serif', sample: 'x² + y² = z²' },
  { id: 'math-computer-modern', label: 'Computer Modern', group: 'Math', family: 'Computer Modern', stack: '"Computer Modern", "Latin Modern Roman", serif', sample: 'E = mc²' },
  { id: 'math-asana', label: 'Asana Math', group: 'Math', family: 'Asana Math', stack: '"Asana Math", "STIX Two Text", serif', sample: '∬ f(x,y) dx dy' },
  { id: 'math-cambria', label: 'Cambria Math', group: 'Math', family: 'Cambria Math', stack: '"Cambria Math", "Cambria", serif', sample: 'lim_{x→∞} f(x)' },
  { id: 'math-dejavu', label: 'DejaVu Math TeX Gyre', group: 'Math', family: 'DejaVu Math TeX Gyre', stack: '"DejaVu Math TeX Gyre", "DejaVu Serif", serif', sample: '∀x ∈ ℝ : x² ≥ 0' },
  { id: 'math-termes', label: 'TeX Gyre Termes', group: 'Math', family: 'TeX Gyre Termes', stack: '"TeX Gyre Termes", "Times New Roman", serif', sample: '∇ × E = -∂B/∂t' },
  { id: 'math-pagella', label: 'TeX Gyre Pagella', group: 'Math', family: 'TeX Gyre Pagella', stack: '"TeX Gyre Pagella", Georgia, serif', sample: '∮ B · dl = μ₀I' },
  { id: 'math-bonum', label: 'TeX Gyre Bonum', group: 'Math', family: 'TeX Gyre Bonum', stack: '"TeX Gyre Bonum", serif', sample: 'HΨ = EΨ' },
  { id: 'math-schola', label: 'TeX Gyre Schola', group: 'Math', family: 'TeX Gyre Schola', stack: '"TeX Gyre Schola", serif', sample: 'F = G(m₁m₂)/r²' },
  { id: 'math-fira', label: 'Fira Math', group: 'Math', family: 'Fira Math', stack: '"Fira Math", "Fira Code", monospace', sample: 'f(x) := ∫_0^x t dt' },
  { id: 'math-euler', label: 'Euler Math', group: 'Math', family: 'Euler Math', stack: '"Euler Math", "AMS Euler", serif', sample: 'e^{iπ} + 1 = 0' },
  { id: 'math-katex-main', label: 'KaTeX Main Serif', group: 'Math', family: 'KaTeX_Main', stack: '"KaTeX_Main", "Latin Modern Roman", serif', sample: 'a² + b² = c²' },
  { id: 'math-katex-math', label: 'KaTeX Math Italic', group: 'Math', family: 'KaTeX_Math', stack: '"KaTeX_Math", "STIX Two Text", serif', sample: 'sin(x) + cos(x)' },
  { id: 'math-katex-ams', label: 'KaTeX AMS Symbols', group: 'Math', family: 'KaTeX_AMS', stack: '"KaTeX_AMS", "STIX Two Text", serif', sample: '∴ ∵ ℵ₀ ℘ ∇' },
  { id: 'math-noto-sans', label: 'Noto Sans Math', group: 'Math', family: 'Noto Sans Math', stack: '"Noto Sans Math", sans-serif', sample: '∀x ∃y (x + y = 0)' },
  { id: 'math-libertinus', label: 'Libertinus Math', group: 'Math', family: 'Libertinus Math', stack: '"Libertinus Math", serif', sample: '∯ F · dA = Q/ε₀' },
  { id: 'math-baskervald', label: 'Baskervaldx Math', group: 'Math', family: 'Baskervaldx', stack: '"Baskervaldx", serif', sample: '∑_{n=1}^∞ 1/n²' },
  { id: 'math-garamond', label: 'Garamond Math', group: 'Math', family: 'EB Garamond', stack: '"EB Garamond", serif', sample: 'Matrix & Vectors' },
  { id: 'math-xits', label: 'XITS Math', group: 'Math', family: 'XITS Math', stack: '"XITS Math", "STIX Two Text", serif', sample: 'STIX Publication Math' },

  // ── MIXED & MULTILINGUAL FONTS (12+) ──
  { id: 'mixed-en-ta', label: 'Noto Serif (En + Ta)', group: 'Mixed', family: 'Noto Serif', stack: '"Noto Serif", "Noto Serif Tamil", serif', sample: 'Book · புத்தகம்' },
  { id: 'mixed-sans', label: 'Noto Sans (En + Ta)', group: 'Mixed', family: 'Noto Sans', stack: '"Noto Sans", "Noto Sans Tamil", sans-serif', sample: 'Question · வினா' },
  { id: 'mixed-source-sans', label: 'Source Sans 3 + Tamil', group: 'Mixed', family: 'Source Sans 3', stack: '"Source Sans 3", "Noto Sans Tamil", sans-serif', sample: 'Science · அறிவியல்' },
  { id: 'mixed-roboto-slab', label: 'Roboto Slab + Tamil', group: 'Mixed', family: 'Roboto Slab', stack: '"Roboto Slab", "Noto Serif Tamil", serif', sample: 'Physics · இயற்பியல்' },
  { id: 'mixed-mukta', label: 'Mukta Multilingual', group: 'Mixed', family: 'Mukta', stack: '"Mukta", "Mukta Malalar", sans-serif', sample: 'Maths · கணிதம்' },
  { id: 'mixed-ibm-plex', label: 'IBM Plex + Tamil', group: 'Mixed', family: 'IBM Plex Serif', stack: '"IBM Plex Serif", "Noto Serif Tamil", serif', sample: 'Exam Paper · தேர்வுத் தாள்' },
  { id: 'mixed-fira', label: 'Fira Sans + Tamil', group: 'Mixed', family: 'Fira Sans', stack: '"Fira Sans", "Noto Sans Tamil", sans-serif', sample: 'Chemistry · வேதியியல்' },
  { id: 'mixed-outfit-catamaran', label: 'Outfit + Catamaran', group: 'Mixed', family: 'Outfit', stack: '"Outfit", "Catamaran", sans-serif', sample: 'Guide · வழிகாட்டி' },
  { id: 'mixed-inter-noto', label: 'Inter + Noto Tamil', group: 'Mixed', family: 'Inter', stack: '"Inter", "Noto Sans Tamil", sans-serif', sample: 'Study Material · பாடக்குறிப்பு' },
  { id: 'mixed-playfair-noto', label: 'Playfair + Noto Tamil', group: 'Mixed', family: 'Playfair Display', stack: '"Playfair Display", "Noto Serif Tamil", serif', sample: 'Literature · இலக்கியம்' },
  { id: 'mixed-merriweather-catamaran', label: 'Merriweather + Catamaran', group: 'Mixed', family: 'Merriweather', stack: '"Merriweather", "Catamaran", serif', sample: 'Chapter · அத்தியாயம்' },
  { id: 'mixed-bebas-baloo', label: 'Bebas + Baloo Thambi', group: 'Mixed', family: 'Bebas Neue', stack: '"Bebas Neue", "Baloo Thambi 2", display', sample: 'TOP TITLE · முக்கிய தலைப்பு' },
]

const LIBRARY_KEY = 'figma.fonts.v1'
const DB_NAME = 'figma-fonts'
const STORE = 'fonts'
const MAX_FONT_BYTES = 25 * 1024 * 1024
const SYSTEM_ONLY = /Latha|Bamini|Baamini|Vijaya|Vani|InaiMathi|Kalyani|Shree Tamil|Sentinel|Sangam|Cambria|KaTeX_|Computer Modern|Latin Modern|TeX Gyre|Euler|Asana|Baskervaldx|XITS|Libertinus|DejaVu|Fira Math/

/** In-memory copy of the library so render code can read it synchronously.
 *  Seeded from the legacy localStorage copy, then replaced by IndexedDB in `hydrateCustomFonts`. */
let cache: CustomFontRecord[] = readLegacyLibrary()
const faces = new Map<string, FontFace>()
const listeners = new Set<() => void>()

export function getPreset(id: string): FontPreset {
  return FONT_PRESETS.find((f) => f.id === id) || FONT_PRESETS[0]
}

export function listCustomFonts(): CustomFontRecord[] {
  return cache
}

/** Subscribe to library changes (upload / remove / hydrate). Returns an unsubscribe fn. */
export function onFontsChanged(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function setCache(next: CustomFontRecord[]) {
  cache = next
  listeners.forEach((fn) => fn())
}

function readLegacyLibrary(): CustomFontRecord[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LIBRARY_KEY) : null
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomFontRecord[]
    return Array.isArray(parsed) ? parsed.filter((f) => f && f.family && f.dataBase64) : []
  } catch {
    return []
  }
}

// ---- IndexedDB persistence (fonts are often several MB — far beyond localStorage's quota) ----
let dbPromise: Promise<IDBDatabase | null> | null = null
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function idbRequest<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        if (!db) return reject(new Error('Font storage is unavailable in this browser'))
        const tx = db.transaction(STORE, mode)
        const req = run(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error || new Error('Font storage error'))
      }),
  )
}

async function persistFont(rec: CustomFontRecord): Promise<void> {
  try {
    await idbRequest('readwrite', (st) => st.put(rec))
  } catch {
    // Last resort: localStorage (small fonts only).
    const legacy = readLegacyLibrary().filter((f) => f.id !== rec.id)
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify([...legacy, rec]))
    } catch {
      throw new Error('Not enough browser storage to save this font')
    }
  }
}

async function deletePersistedFont(id: string): Promise<void> {
  try {
    await idbRequest('readwrite', (st) => st.delete(id))
  } catch {
    /* ignore */
  }
  const legacy = readLegacyLibrary()
  if (legacy.some((f) => f.id === id)) {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(legacy.filter((f) => f.id !== id)))
    } catch {
      /* ignore */
    }
  }
}

function extToFormat(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'ttf') return 'truetype'
  if (ext === 'otf') return 'opentype'
  if (ext === 'woff') return 'woff'
  if (ext === 'woff2') return 'woff2'
  return null
}

function formatMime(format: string): string {
  if (format === 'opentype') return 'font/otf'
  if (format === 'woff') return 'font/woff'
  if (format === 'woff2') return 'font/woff2'
  return 'font/ttf'
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/** Load a font into the page. Re-registering a family swaps in the new file. */
export async function registerFontFace(family: string, dataBase64: string, format: string): Promise<void> {
  void format
  const face = new FontFace(family, base64ToBuffer(dataBase64), { style: 'normal', weight: '400' })
  await face.load() // rejects for corrupt / non-font files
  const old = faces.get(family)
  if (old) document.fonts.delete(old)
  document.fonts.add(face)
  faces.set(family, face)
}

let hydratePromise: Promise<CustomFontRecord[]> | null = null

/** Load the saved library (IndexedDB + legacy localStorage) and register every font. Safe to call repeatedly. */
export function hydrateCustomFonts(): Promise<CustomFontRecord[]> {
  if (hydratePromise) return hydratePromise
  hydratePromise = (async () => {
    let stored: CustomFontRecord[] = []
    try {
      stored = await idbRequest('readonly', (st) => st.getAll() as IDBRequest<CustomFontRecord[]>)
    } catch {
      stored = []
    }
    const byId = new Map(stored.map((f) => [f.id, f]))
    // Migrate fonts saved by older versions in localStorage.
    const legacy = readLegacyLibrary()
    for (const f of legacy) {
      if (byId.has(f.id)) continue
      byId.set(f.id, f)
      try {
        await idbRequest('readwrite', (st) => st.put(f))
      } catch {
        /* stays in localStorage */
      }
    }
    if (legacy.length && (await openDb())) {
      try {
        localStorage.removeItem(LIBRARY_KEY)
      } catch {
        /* ignore */
      }
    }
    const all = [...byId.values()].sort((a, b) => a.addedAt.localeCompare(b.addedAt))
    const ok: CustomFontRecord[] = []
    for (const f of all) {
      try {
        if (!faces.has(f.family)) await registerFontFace(f.family, f.dataBase64, f.format)
        ok.push(f)
      } catch {
        /* skip broken */
      }
    }
    setCache(ok)
    return ok
  })()
  return hydratePromise
}

function familyFor(name: string): string {
  const existing = cache.find((f) => f.name.toLowerCase() === name.toLowerCase())
  if (existing) return existing.family
  return `Custom_${name.replace(/\s+/g, '_')}_${Date.now().toString(36)}`
}

/** Validate, load and save an uploaded .ttf / .otf / .woff / .woff2 file.
 *  Uploading a font with the same name again replaces it in place, so books using it keep working. */
export async function importFontFile(file: File): Promise<CustomFontRecord> {
  await hydrateCustomFonts()
  const format = extToFormat(file.name)
  if (!format) throw new Error(`“${file.name}” is not a font file (use .ttf, .otf, .woff or .woff2)`)
  if (file.size === 0) throw new Error(`“${file.name}” is empty`)
  if (file.size > MAX_FONT_BYTES) throw new Error(`“${file.name}” is larger than 25 MB`)

  const name = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim() || 'Custom Font'
  const family = familyFor(name)
  const dataBase64 = bufferToBase64(await file.arrayBuffer())
  try {
    await registerFontFace(family, dataBase64, format)
  } catch {
    throw new Error(`“${file.name}” could not be read as a font`)
  }

  const record: CustomFontRecord = {
    id: family,
    name,
    family,
    dataBase64,
    format,
    addedAt: new Date().toISOString(),
    fileName: file.name,
  }
  await persistFont(record)
  setCache([...cache.filter((f) => f.id !== record.id), record])
  return record
}

/** @deprecated use importFontFile */
export async function loadCustomFont(file: File): Promise<{ name: string; family: string }> {
  const r = await importFontFile(file)
  return { name: r.name, family: r.family }
}

export async function removeCustomFont(id: string): Promise<void> {
  const rec = cache.find((f) => f.id === id)
  if (rec) {
    const face = faces.get(rec.family)
    if (face) document.fonts.delete(face)
    faces.delete(rec.family)
  }
  setCache(cache.filter((f) => f.id !== id))
  await deletePersistedFont(id)
}

export function isCustomFamily(family?: string): boolean {
  return !!family && cache.some((f) => f.family === family || f.id === family)
}

/** @font-face rules (fonts embedded as data URLs) so a separate print window can use uploaded fonts. */
export function customFontFaceCss(familiesOrIds: (string | undefined)[]): string {
  const wanted = new Set(familiesOrIds.filter(Boolean) as string[])
  return cache
    .filter((f) => wanted.has(f.family) || wanted.has(f.id))
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";src:url(data:${formatMime(f.format)};base64,${f.dataBase64}) format("${f.format}");font-weight:400;font-style:normal;font-display:block;}`,
    )
    .join('\n')
}

/** Google Fonts stylesheet URLs for the given preset ids (skips system-only and custom fonts). */
export function googleFontLinks(presetIds: (string | undefined)[]): string[] {
  const fams = new Set<string>()
  for (const id of presetIds) {
    if (!id) continue
    const preset = FONT_PRESETS.find((f) => f.id === id)
    if (!preset || SYSTEM_ONLY.test(preset.family)) continue
    fams.add(preset.family)
  }
  return [...fams].flatMap(googleFontUrls)
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Export one custom font back as a binary font file. */
export function exportFontFile(font: CustomFontRecord) {
  const buffer = base64ToBuffer(font.dataBase64)
  const ext =
    font.format === 'woff2' ? 'woff2' : font.format === 'woff' ? 'woff' : font.format === 'opentype' ? 'otf' : 'ttf'
  downloadBlob(`${font.name}.${ext}`, new Blob([buffer], { type: `font/${ext}` }))
}

/** Export all custom fonts (+ optional prefs) as a JSON pack for sharing. */
export function exportFontPack(prefs?: FontPack['prefs']): FontPack {
  const pack: FontPack = {
    version: 1,
    exportedAt: new Date().toISOString(),
    fonts: listCustomFonts(),
    prefs,
  }
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
  downloadBlob(`figma-fonts-${Date.now()}.json`, blob)
  return pack
}

/** Import a Figma font pack JSON. Returns imported count + prefs. */
export async function importFontPack(file: File): Promise<{ count: number; prefs?: FontPack['prefs'] }> {
  await hydrateCustomFonts()
  let pack: FontPack
  try {
    pack = JSON.parse(await file.text()) as FontPack
  } catch {
    throw new Error('This file is not a font pack')
  }
  if (!pack || !Array.isArray(pack.fonts)) throw new Error('This file is not a font pack')

  let count = 0
  const next = new Map(cache.map((f) => [f.id, f]))
  for (const f of pack.fonts) {
    if (!f?.dataBase64 || !f.family || !f.name) continue
    const rec: CustomFontRecord = {
      ...f,
      id: f.id || f.family,
      format: f.format || 'truetype',
      addedAt: f.addedAt || new Date().toISOString(),
      fileName: f.fileName || `${f.name}.ttf`,
    }
    try {
      await registerFontFace(rec.family, rec.dataBase64, rec.format)
      await persistFont(rec)
      next.set(rec.id, rec)
      count++
    } catch {
      /* skip broken entries */
    }
  }
  setCache([...next.values()])
  return { count, prefs: pack.prefs }
}

export function exportFontSettings(prefs: NonNullable<FontPack['prefs']>) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 1,
          type: 'figma-font-settings',
          exportedAt: new Date().toISOString(),
          prefs,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  )
  downloadBlob(`figma-font-settings.json`, blob)
}

export async function importFontSettingsFile(
  file: File,
): Promise<NonNullable<FontPack['prefs']>> {
  const text = await file.text()
  const data = JSON.parse(text) as { prefs?: FontPack['prefs']; fontId?: string }
  if (data.prefs) return data.prefs
  // Allow a full pack as settings source
  if ((data as FontPack).fonts) {
    const pack = data as FontPack
    await importFontPack(file)
    return pack.prefs || {}
  }
  throw new Error('Invalid settings file')
}

export function resolveBodyStack(
  fontId: string,
  customFamily?: string,
): string {
  fontId = fontId || 'english-serif'
  ensureFontLoaded(fontId)
  if ((fontId === 'custom' || fontId.startsWith('Custom_')) && customFamily) {
    return `"${customFamily}", "Noto Sans Tamil", "Source Serif 4", sans-serif`
  }
  // custom library id may be the family itself
  const lib = listCustomFonts().find((f) => f.id === fontId || f.family === fontId)
  if (lib) return `"${lib.family}", "Noto Sans Tamil", sans-serif`
  return getPreset(fontId).stack
}
