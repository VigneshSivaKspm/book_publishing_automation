/**
 * Pulls the chapter/unit title + number out of a transcribed page so the export
 * header badge ("Chapter 02" + "Micro Economics") is filled from the real
 * uploaded document instead of hard-coded defaults.
 */

export interface ChapterMeta {
  title?: string
  number?: string
}

const TAG = /^\s*<<<\s*CHAPTER\s*>>>\s*(.+?)\s*$/im
const ROMAN: Record<string, string> = {
  I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9', X: '10',
  XI: '11', XII: '12', XIII: '13', XIV: '14', XV: '15',
}

function normNumber(raw: string): string {
  const t = String(raw).trim().replace(/[.)]+$/, '')
  const fromRoman = ROMAN[t.toUpperCase()]
  const digits = fromRoman || t.replace(/[^\d]/g, '')
  if (!digits) return t
  return digits.length === 1 ? `0${digits}` : digits
}

/** Extract chapter metadata and return the page text with the marker line removed. */
export function extractChapterMeta(text: string): { meta: ChapterMeta; text: string } {
  const meta: ChapterMeta = {}
  let rest = text || ''

  const tagged = rest.match(TAG)
  if (tagged) {
    const [rawTitle, rawNum] = tagged[1].split('|').map((s) => s.trim())
    if (rawTitle && !/^n\/?a$/i.test(rawTitle)) meta.title = rawTitle
    if (rawNum) meta.number = normNumber(rawNum)
    rest = rest.replace(tagged[0], '').replace(/^\s*\n/, '')
  }

  if (!meta.title) {
    const h1 = rest.match(/^#\s+(.+)$/m)
    if (h1) meta.title = h1[1].trim()
  }

  if (!meta.number) {
    const named = rest.match(/\b(?:chapter|unit|lesson)\s+([0-9]{1,2}|[IVXLC]{1,4})\b/i)
    if (named) meta.number = normNumber(named[1])
    else {
      const sec = rest.match(/^\s*(\d{1,2})\.\d+\.?\s+[A-Za-z]/m)
      if (sec) meta.number = normNumber(sec[1])
    }
  }

  return { meta, text: rest }
}
