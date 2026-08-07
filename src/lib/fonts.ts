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

export const FONT_PRESETS: FontPreset[] = [
  {
    id: 'english-serif',
    label: 'English Serif',
    group: 'English',
    family: 'Source Serif 4',
    stack: '"Source Serif 4", "Times New Roman", Georgia, serif',
    sample: 'Aa Bb Cc 123',
  },
  {
    id: 'english-sans',
    label: 'English Sans',
    group: 'English',
    family: 'Noto Sans',
    stack: '"Noto Sans", Arial, Helvetica, sans-serif',
    sample: 'Aa Bb Cc 123',
  },
  {
    id: 'tamil-noto',
    label: 'Tamil (Noto)',
    group: 'Tamil',
    family: 'Noto Sans Tamil',
    stack: '"Noto Sans Tamil", "Latha", "Tamil MN", sans-serif',
    sample: 'தமிழ் ஆஆஈ',
  },
  {
    id: 'tamil-latha',
    label: 'Tamil (Catamaran)',
    group: 'Tamil',
    family: 'Catamaran',
    stack: '"Catamaran", "Noto Sans Tamil", "Latha", sans-serif',
    sample: 'தமிழ் மொழி',
  },
  {
    id: 'math-stix',
    label: 'Math (STIX Two)',
    group: 'Math',
    family: 'STIX Two Text',
    stack: '"STIX Two Text", "STIX Two Math", "Times New Roman", serif',
    sample: '∑ ∫ √ π θ',
  },
  {
    id: 'math-latin',
    label: 'Math (Latin Modern)',
    group: 'Math',
    family: 'Latin Modern Roman',
    stack: '"Latin Modern Roman", "Computer Modern", "Times New Roman", serif',
    sample: 'x² + y² = z²',
  },
  {
    id: 'mixed-en-ta',
    label: 'English + Tamil',
    group: 'Mixed',
    family: 'Noto Serif',
    stack: '"Noto Serif", "Noto Sans Tamil", "Source Serif 4", serif',
    sample: 'Book · புத்தகம்',
  },
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
  if ((fontId === 'custom' || fontId.startsWith('Custom_')) && customFamily) {
    return `"${customFamily}", "Noto Sans Tamil", "Source Serif 4", sans-serif`
  }
  // custom library id may be the family itself
  const lib = listCustomFonts().find((f) => f.id === fontId || f.family === fontId)
  if (lib) return `"${lib.family}", "Noto Sans Tamil", sans-serif`
  return getPreset(fontId).stack
}
