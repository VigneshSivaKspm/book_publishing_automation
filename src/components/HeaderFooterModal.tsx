import { useRef, type ChangeEvent } from 'react'
import type { HeaderFooterSettings } from '../types'

interface HeaderFooterModalProps {
  open: boolean
  onClose: () => void
  settings: HeaderFooterSettings
  onChange: (next: HeaderFooterSettings) => void
  onWatermarkUpload: (file: File) => void
}

export default function HeaderFooterModal({
  open,
  onClose,
  settings,
  onChange,
  onWatermarkUpload,
}: HeaderFooterModalProps) {
  const fileWatermarkRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const update = (patch: Partial<HeaderFooterSettings>) => {
    onChange({ ...settings, ...patch })
  }

  const handleLogoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      onWatermarkUpload(file)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-[660px] max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl flex flex-col"
        style={{ border: '1px solid #CBD5E1' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[17px] font-bold text-slate-800">
              Question Bank Header, Footer &amp; Watermark Studio
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Customize layout columns, first page header, middle page headers, logo watermark &amp; page tabs
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto text-[13px] text-slate-700">
          {/* Section 1: Column Layout */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              1. Column Layout &amp; Dividers
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => update({ layoutColumns: 1 })}
                className={`p-3 rounded-xl text-left border flex items-center gap-3 transition-all ${
                  settings.layoutColumns === 1
                    ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-sm font-semibold'
                    : 'bg-white border-slate-300 hover:bg-slate-100'
                }`}
              >
                <div className="w-8 h-10 border-2 border-dashed border-slate-400 rounded bg-white flex flex-col p-1 gap-1">
                  <div className="h-1 bg-slate-400 rounded w-full" />
                  <div className="h-1 bg-slate-300 rounded w-full" />
                  <div className="h-1 bg-slate-300 rounded w-full" />
                </div>
                <div>
                  <div className="font-bold text-[13px]">1 Column Layout</div>
                  <div className="text-[11px] text-slate-500">For General Subjects (English, History)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => update({ layoutColumns: 2 })}
                className={`p-3 rounded-xl text-left border flex items-center gap-3 transition-all ${
                  settings.layoutColumns === 2
                    ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-sm font-semibold'
                    : 'bg-white border-slate-300 hover:bg-slate-100'
                }`}
              >
                <div className="w-8 h-10 border-2 border-dashed border-slate-400 rounded bg-white flex p-1 gap-1 relative">
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="h-1 bg-slate-400 rounded w-full" />
                    <div className="h-1 bg-slate-300 rounded w-full" />
                  </div>
                  <div className="w-[1px] bg-slate-400 h-full" />
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="h-1 bg-slate-400 rounded w-full" />
                    <div className="h-1 bg-slate-300 rounded w-full" />
                  </div>
                </div>
                <div>
                  <div className="font-bold text-[13px]">2 Columns Layout</div>
                  <div className="text-[11px] text-slate-500">For Maths, Physics, Chemistry</div>
                </div>
              </button>
            </div>

            {settings.layoutColumns === 2 && (
              <label className="flex items-center gap-2 pt-1 text-[12px] font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showColumnDivider !== false}
                  onChange={(e) => update({ showColumnDivider: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                Show vertical dividing line down center between columns
              </label>
            )}
          </div>

          {/* Section 2: First Page Header */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              2. First Page Header (Matching Production Sample 1)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">Chapter Title</span>
                <input
                  type="text"
                  value={settings.chapterTitle || ''}
                  onChange={(e) => update({ chapterTitle: e.target.value })}
                  placeholder="e.g. Integral Calculus"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] bg-white outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">Chapter Label</span>
                <input
                  type="text"
                  value={settings.chapterLabel || ''}
                  onChange={(e) => update({ chapterLabel: e.target.value })}
                  placeholder="e.g. Chapter"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] bg-white outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">Chapter Number</span>
                <input
                  type="text"
                  value={settings.chapterNumber || ''}
                  onChange={(e) => update({ chapterNumber: e.target.value })}
                  placeholder="e.g. 02"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] bg-white font-mono font-bold outline-none focus:border-teal-600"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Middle Pages Headers */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              3. Middle Pages Header (Matching Production Samples 2 &amp; 3)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">Black Box Tag Text</span>
                <input
                  type="text"
                  value={settings.middleBoxText || ''}
                  onChange={(e) => update({ middleBoxText: e.target.value })}
                  placeholder="e.g. Karthikeyan Analysis Study Circle"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] bg-white outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">Right / Underlined Title</span>
                <input
                  type="text"
                  value={settings.middleRightText || ''}
                  onChange={(e) => update({ middleRightText: e.target.value })}
                  placeholder="e.g. Integral Calculus"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] bg-white outline-none focus:border-teal-600"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 pt-1 text-[12px] font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.alternatingHeaders !== false}
                onChange={(e) => update({ alternatingHeaders: e.target.checked })}
                className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              Alternate left &amp; right box positions on even / odd pages
            </label>
          </div>

          {/* Section 4: Background Logo Watermark */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                4. Background Logo Watermark
              </label>
              <label className="flex items-center gap-2 text-[12px] font-bold text-teal-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.watermarkEnabled !== false}
                  onChange={(e) => update({ watermarkEnabled: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                Enable Watermark
              </label>
            </div>

            {settings.watermarkEnabled !== false && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileWatermarkRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 text-white font-semibold text-[12px] hover:bg-teal-700 shadow-sm"
                  >
                    Upload Custom Logo Image
                  </button>
                  <input
                    ref={fileWatermarkRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFile}
                  />
                  {settings.watermarkImage ? (
                    <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded text-[11px] font-semibold">
                      <span>✓ Custom Logo Active</span>
                      <button
                        type="button"
                        onClick={() => update({ watermarkImage: undefined })}
                        className="text-red-600 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500">Using default Study Circle Emblem Seal</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                      Watermark Text (Fallback)
                    </span>
                    <input
                      type="text"
                      value={settings.watermarkText || ''}
                      onChange={(e) => update({ watermarkText: e.target.value })}
                      placeholder="e.g. KARTHIKEYAN ANALYSIS STUDY CIRCLE"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] bg-white outline-none focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 font-semibold mb-1">
                      <span>Opacity</span>
                      <span>{Math.round((settings.watermarkOpacity ?? 0.12) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.04"
                      max="0.45"
                      step="0.02"
                      value={settings.watermarkOpacity ?? 0.12}
                      onChange={(e) => update({ watermarkOpacity: Number(e.target.value) })}
                      className="w-full accent-teal-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-semibold mb-1">
                    <span>Watermark Scale Size</span>
                    <span>{Math.round((settings.watermarkScale ?? 0.85) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="1.5"
                    step="0.05"
                    value={settings.watermarkScale ?? 0.85}
                    onChange={(e) => update({ watermarkScale: Number(e.target.value) })}
                    className="w-full accent-teal-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Footer, Page Numbers & Answer Key */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              5. Footer Brand Text, Page Numbers &amp; Answer Key
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">Footer Brand Name</span>
                <input
                  type="text"
                  value={settings.footerLeft || ''}
                  onChange={(e) => update({ footerLeft: e.target.value })}
                  placeholder="e.g. Karthikeyan Analysis Learning Resources"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] bg-white outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">Page Number Style</span>
                <select
                  value={settings.pageNumberStyle || 'bracket'}
                  onChange={(e) => update({ pageNumberStyle: e.target.value as any })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] bg-white outline-none focus:border-teal-600"
                >
                  <option value="bracket">Centered Bracketed Line (e.g. &#123; 1 &#125;) — Textbook Sample Style</option>
                  <option value="production-tab">Black Corner Tab Box (e.g. 1)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">Start Page Number</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={settings.startPageNumber ?? 1}
                  onChange={(e) => update({ startPageNumber: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] bg-white outline-none focus:border-teal-600 font-mono"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 text-[12px] font-medium text-slate-700 cursor-pointer py-1.5">
                  <input
                    type="checkbox"
                    checked={settings.showPageNumbers !== false}
                    onChange={(e) => update({ showPageNumbers: e.target.checked })}
                    className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                  Show Page Numbers
                </label>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 text-[12px] font-bold text-teal-800 cursor-pointer py-1.5">
                  <input
                    type="checkbox"
                    checked={settings.autoGenerateAnswerKey !== false}
                    onChange={(e) => update({ autoGenerateAnswerKey: e.target.checked })}
                    className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                  Auto Answer Key at end
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-teal-600 text-white font-bold text-[13px] hover:bg-teal-700 transition-colors shadow-sm"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  )
}
