import { useState } from 'react'

interface PresetTemplate {
  id: string
  title: string
  category: string
  paperSize: string
  columns: string
  typography: string
  description: string
}

const TEMPLATES: PresetTemplate[] = [
  {
    id: 'tmpl_1',
    title: 'Standard Academic Question Bank Manual',
    category: 'Mathematics & Science',
    paperSize: 'A4 (210 x 297 mm)',
    columns: '2 Columns with Center Divider',
    typography: 'Outfit + STIX Two Math TeX',
    description: 'Pre-configured layout with header/footer tabs, 2-column question alignment, answer key table, and watermark seal.',
  },
  {
    id: 'tmpl_2',
    title: 'Executive Practice Test Booklet',
    category: 'Competitive Exams',
    paperSize: 'B5 (176 x 250 mm)',
    columns: '2 Columns',
    typography: 'Source Serif 4 + IBM Plex Mono',
    description: 'Compact publication standard for coaching manuals, test papers, and formula quick-reference sheets.',
  },
  {
    id: 'tmpl_3',
    title: 'Square Study Circle Guide',
    category: 'Study Guide & Revision',
    paperSize: '8x8 Inches (203 x 203 mm)',
    columns: 'Single Column Wide Margin',
    typography: 'Catamaran + Noto Sans Tamil',
    description: 'Modern square booklet layout optimized for clear reading, side-by-side diagrams, and formula proofs.',
  },
]

export default function TemplatesPanel({ onSelectTemplate }: { onSelectTemplate?: (tmpl: PresetTemplate) => void }) {
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-lg bg-slate-900 text-white text-[13px] font-medium shadow-xl border border-slate-700 animate-slide-up">
          {toast}
        </div>
      )}

      <div className="px-8 py-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 tracking-wider uppercase mb-1">
            <span>DOCUMENT PROCESSING</span>
            <span>/</span>
            <span className="text-slate-900 font-bold">PUBLICATION TEMPLATES</span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            Publication Design & Layout Templates
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Select press-ready design templates for A4, B5, and 8x8 publication documents.
          </p>
        </div>

        <div>
          <button
            onClick={() => showToast('Custom template builder opened.')}
            className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold tracking-wide transition-all shadow-sm active:scale-[0.98]"
          >
            CREATE CUSTOM TEMPLATE
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {TEMPLATES.map((tmpl) => (
          <div key={tmpl.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider border border-slate-200">
                {tmpl.category}
              </span>
              <h2 className="text-[17px] font-bold text-slate-900 mt-3 mb-2">{tmpl.title}</h2>
              <p className="text-[13px] text-slate-600 leading-relaxed mb-4">{tmpl.description}</p>

              <div className="space-y-1.5 text-[12px] font-mono text-slate-600 border-t border-b border-slate-200 py-3 mb-4">
                <div>SIZE: <strong className="text-slate-900">{tmpl.paperSize}</strong></div>
                <div>LAYOUT: <strong className="text-slate-900">{tmpl.columns}</strong></div>
                <div>FONTS: <strong className="text-slate-900">{tmpl.typography}</strong></div>
              </div>
            </div>

            <button
              onClick={() => {
                showToast(`Applied template "${tmpl.title}".`)
                if (onSelectTemplate) onSelectTemplate(tmpl)
              }}
              className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
              USE TEMPLATE
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
