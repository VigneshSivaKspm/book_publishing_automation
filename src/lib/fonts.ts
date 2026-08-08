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
    family.includes('Latha') ||
    family.includes('Bamini') ||
    family.includes('Vijaya') ||
    family.includes('Vani') ||
    family.includes('InaiMathi')
  ) {
    return
  }

  loadedGoogleFonts.add(family)
  const linkId = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`
  if (document.getElementById(linkId)) return

  const link = document.createElement('link')
  link.id = linkId
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,600;0,700;1,400&display=swap`
  document.head.appendChild(link)
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
const loadedFamilies = new Set<string>()

export function getPreset(id: string): FontPreset {
  return FONT_PRESETS.find((f) => f.id === id) || FONT_PRESETS[0]
}

export function listCustomFonts(): CustomFontRecord[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomFontRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLibrary(fonts: CustomFontRecord[]) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(fonts))
}

function extToFormat(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'ttf') return 'truetype'
  if (ext === 'otf') return 'opentype'
  if (ext === 'woff') return 'woff'
  if (ext === 'woff2') return 'woff2'
  return 'truetype'
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

export async function registerFontFace(family: string, dataBase64: string, format: string): Promise<void> {
  if (loadedFamilies.has(family)) return
  const buffer = base64ToBuffer(dataBase64)
  const face = new FontFace(family, buffer, { style: 'normal', weight: '400' })
  // Also hint format via CSS descriptor when possible
  void format
  await face.load()
  document.fonts.add(face)
  loadedFamilies.add(family)
}

/** Load all saved custom fonts into the document (call on app/editor start). */
export async function hydrateCustomFonts(): Promise<CustomFontRecord[]> {
  const fonts = listCustomFonts()
  for (const f of fonts) {
    try {
      await registerFontFace(f.family, f.dataBase64, f.format)
    } catch {
      /* skip broken */
    }
  }
  return fonts
}

export async function importFontFile(file: File): Promise<CustomFontRecord> {
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\s-]/g, '').trim() || 'CustomFont'
  const family = `Custom_${name.replace(/\s+/g, '_')}_${Date.now().toString(36)}`
  const buffer = await file.arrayBuffer()
  const dataBase64 = bufferToBase64(buffer)
  const format = extToFormat(file.name)
  await registerFontFace(family, dataBase64, format)

  const record: CustomFontRecord = {
    id: family,
    name,
    family,
    dataBase64,
    format,
    addedAt: new Date().toISOString(),
    fileName: file.name,
  }
  const next = [...listCustomFonts().filter((f) => f.name.toLowerCase() !== name.toLowerCase()), record]
  saveLibrary(next)
  return record
}

/** @deprecated use importFontFile */
export async function loadCustomFont(file: File): Promise<{ name: string; family: string }> {
  const r = await importFontFile(file)
  return { name: r.name, family: r.family }
}

export function removeCustomFont(id: string) {
  saveLibrary(listCustomFonts().filter((f) => f.id !== id))
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
  const text = await file.text()
  const pack = JSON.parse(text) as FontPack
  if (!pack || !Array.isArray(pack.fonts)) throw new Error('Invalid font pack')

  const existing = listCustomFonts()
  const byName = new Map(existing.map((f) => [f.name.toLowerCase(), f]))
  let count = 0
  for (const f of pack.fonts) {
    if (!f.dataBase64 || !f.family || !f.name) continue
    try {
      await registerFontFace(f.family, f.dataBase64, f.format || 'truetype')
      byName.set(f.name.toLowerCase(), {
        ...f,
        id: f.id || f.family,
        addedAt: f.addedAt || new Date().toISOString(),
      })
      count++
    } catch {
      /* skip */
    }
  }
  saveLibrary([...byName.values()])
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
  ensureFontLoaded(fontId)
  if ((fontId === 'custom' || fontId.startsWith('Custom_')) && customFamily) {
    return `"${customFamily}", "Noto Sans Tamil", "Source Serif 4", sans-serif`
  }
  // custom library id may be the family itself
  const lib = listCustomFonts().find((f) => f.id === fontId || f.family === fontId)
  if (lib) return `"${lib.family}", "Noto Sans Tamil", sans-serif`
  return getPreset(fontId).stack
}
