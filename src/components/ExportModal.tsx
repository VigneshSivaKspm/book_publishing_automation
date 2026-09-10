import { useState } from 'react'

interface ExportModalProps {
  open?: boolean
  onClose: () => void
}

type FormatKey = 'a4' | 'b5' | '8x8'
type OutputKey = 'pdf-x' | 'press' | 'digital'

const formats: { id: FormatKey; label: string; sub: string; dims: string }[] = [
  { id: 'a4', label: 'A4 Standard', sub: 'Most compatible', dims: '210 × 297 mm' },
  { id: 'b5', label: 'B5 Academic', sub: 'Compact edition', dims: '176 × 250 mm' },
  { id: '8x8', label: '8×8 Square', sub: 'Workbook format', dims: '203 × 203 mm' },
]

const outputs: { id: OutputKey; label: string; sub: string }[] = [
  { id: 'pdf-x', label: 'High-Quality PDF/X', sub: 'ISO 15930 · press standard' },
  { id: 'press', label: 'Press-Ready Package', sub: 'Crop, bleed & ICC included' },
  { id: 'digital', label: 'Digital distribution PDF', sub: 'Optimized for screen & email' },
]

const printSettings = [
  { id: 'bleed', label: 'Bleed marks', desc: '3mm bleed extension' },
  { id: 'crop', label: 'Crop marks', desc: 'Printer trim guides' },
  { id: 'gutter', label: 'Printer gutter', desc: 'Extra inner margin (+5mm)' },
  { id: 'colorprofile', label: 'Embed ICC profile', desc: 'CMYK Fogra39' },
  { id: 'answerkey', label: 'Include answer key', desc: 'Separate key sheet at end' },
  { id: 'batch', label: 'Batch all 3 sizes', desc: 'A4 + B5 + 8×8 in one go' },
]

export default function ExportModal({ open = true, onClose }: ExportModalProps) {
  if (!open) return null
  const [selectedFormat, setSelectedFormat] = useState<FormatKey>('a4')
  const [selectedOutput, setSelectedOutput] = useState<OutputKey>('pdf-x')
  const [printToggles, setPrintToggles] = useState<Record<string, boolean>>({
    bleed: true,
    crop: true,
    gutter: false,
    colorprofile: true,
    answerkey: true,
    batch: false,
  })
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setDone(true)
    }, 2200)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-[640px] max-h-[90vh] overflow-y-auto rounded-2xl animate-slide-up bg-white"
        style={{ border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(15,23,42,0.18)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--ink)' }}>
              Print export — A4 · B5 · 8×8
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Matching headers &amp; footers · math preserved · answer key optional
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--muted)]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {!done ? (
          <div className="p-6 space-y-5">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--muted-foreground)' }}>
                Paper format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {formats.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    className="p-3 rounded-xl text-left transition-all"
                    style={{
                      background: selectedFormat === fmt.id ? 'rgba(14,116,144,0.08)' : 'var(--surface-soft)',
                      border:
                        selectedFormat === fmt.id ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="text-[13px] font-semibold"
                      style={{ color: selectedFormat === fmt.id ? 'var(--primary)' : 'var(--ink)' }}
                    >
                      {fmt.label}
                    </div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {fmt.dims}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      {fmt.sub}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--muted-foreground)' }}>
                Output
              </label>
              <div className="space-y-2">
                {outputs.map((out) => (
                  <button
                    key={out.id}
                    onClick={() => setSelectedOutput(out.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl text-left"
                    style={{
                      background: selectedOutput === out.id ? 'rgba(14,116,144,0.06)' : 'white',
                      border:
                        selectedOutput === out.id ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                        {out.label}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                        {out.sub}
                      </div>
                    </div>
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                      style={{
                        borderColor: selectedOutput === out.id ? 'var(--primary)' : 'var(--border)',
                        background: selectedOutput === out.id ? 'var(--primary)' : 'transparent',
                      }}
                    >
                      {selectedOutput === out.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--muted-foreground)' }}>
                Print settings
              </label>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {printSettings.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      borderBottom: i < printSettings.length - 1 ? '1px solid var(--border)' : 'none',
                      background: 'white',
                    }}
                  >
                    <div>
                      <div className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
                        {s.label}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                        {s.desc}
                      </div>
                    </div>
                    <button
                      onClick={() => setPrintToggles((p) => ({ ...p, [s.id]: !p[s.id] }))}
                      className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                      style={{ background: printToggles[s.id] ? 'var(--primary)' : '#CBD5E1' }}
                    >
                      <div
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm"
                        style={{ left: printToggles[s.id] ? '22px' : '2px' }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 text-[13px] font-bold text-white rounded-none bg-slate-900 hover:bg-slate-800 border border-slate-900 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scaling layout & generating…
                </>
              ) : (
                <>Generate press-ready files</>
              )}
            </button>
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(5,150,105,0.12)', color: 'var(--success)' }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M7 14l5 5 9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-[18px] font-bold mb-2" style={{ color: 'var(--ink)' }}>
              Files ready
            </h3>
            <p className="text-[13px] mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {printToggles.batch
                ? '3 sizes packaged · PDF/X · 312 pages · ~52 MB'
                : `${formats.find((f) => f.id === selectedFormat)?.label} · 312 pages · 48.2 MB`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print()
                }}
                className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: 'var(--success)' }}
              >
                Download package / Print PDF
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-[13px] font-semibold"
                style={{ border: '1px solid var(--border)', color: 'var(--secondary-foreground)' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
