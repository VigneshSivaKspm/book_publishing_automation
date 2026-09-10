import { useEffect, useState, type FormEvent } from 'react'
import { createNewBook, type BookDocument, type BookMode, type PaperSize } from '../types'

interface NewBookModalProps {
  open: boolean
  onClose: () => void
  onCreate: (book: BookDocument) => void
  initialMode?: BookMode
}

export default function NewBookModal({ open, onClose, onCreate, initialMode = 'qa' }: NewBookModalProps) {
  const [title, setTitle] = useState('')
  const [paperSize, setPaperSize] = useState<PaperSize>('A4')
  const [bookMode, setBookMode] = useState<BookMode>(initialMode)
  const [showModeSwitch, setShowModeSwitch] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setTitle('')
      setPaperSize('A4')
      setBookMode(initialMode)
      setShowModeSwitch(false)
      setError('')
    }
  }, [open, initialMode])

  if (!open) return null

  const isSyllabus = bookMode === 'questions-only'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      setError('Please enter a document title')
      return
    }
    onCreate(createNewBook(t, { paperSize, bookMode }))
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="w-[440px] max-w-[92vw] rounded-2xl bg-white overflow-hidden shadow-2xl border border-slate-200 animate-slide-up"
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {isSyllabus ? 'Syllabus Mode' : 'Question Bank Mode'}
            </span>
            <h2 className="text-[16px] font-bold text-slate-900 mt-1">
              {isSyllabus ? 'Create Syllabus Book' : 'Create Question Bank Book'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors font-mono"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Title Input */}
          <div>
            <label className="text-[12px] font-bold text-slate-700 block mb-1.5">
              Book Name / Title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError('')
              }}
              placeholder={
                isSyllabus
                  ? 'e.g. TNPSC Micro Economics Syllabus & Study Guide'
                  : 'e.g. TNPSC General Studies Question Bank 2026'
              }
              className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-slate-900 border border-slate-300 outline-none transition-all focus:border-slate-600 focus:ring-2 focus:ring-slate-500/20"
              style={{
                borderColor: error ? '#EF4444' : undefined,
              }}
            />
            {error && (
              <p className="text-[11.5px] font-semibold text-rose-600 mt-1">
                {error}
              </p>
            )}
          </div>

          {/* Page Size Selection */}
          <div>
            <label className="text-[12px] font-bold text-slate-700 block mb-1.5">
              Paper Size
            </label>
            <div className="flex gap-2">
              {(['A4', 'B5', '8×8'] as PaperSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPaperSize(s)}
                  className={`flex-1 py-2 rounded-xl text-[12.5px] font-bold transition-all border ${
                    paperSize === s
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Format Switcher Toggle */}
          <div className="pt-1 border-t border-slate-100">
            {!showModeSwitch ? (
              <button
                type="button"
                onClick={() => setShowModeSwitch(true)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Need to change format mode? <span className="underline">Switch mode</span>
              </button>
            ) : (
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wider">
                  Switch Format Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBookMode('qa')}
                    className={`p-2.5 rounded-xl text-left transition-all border ${
                      bookMode === 'qa'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[12px] font-bold">Question Bank</div>
                    <div className="text-[10px] opacity-80">MCQs & Answer Keys</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookMode('questions-only')}
                    className={`p-2.5 rounded-xl text-left transition-all border ${
                      bookMode === 'questions-only'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[12px] font-bold">Syllabus</div>
                    <div className="text-[10px] opacity-80">Theory & Study Guide</div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[12.5px] font-bold text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-[12.5px] font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs"
          >
            {isSyllabus ? 'Create Syllabus Book' : 'Create Question Bank'}
          </button>
        </div>
      </form>
    </div>
  )
}
