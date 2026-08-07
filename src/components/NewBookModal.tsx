import { useEffect, useState, type FormEvent } from 'react'
import { createNewBook, type BookDocument, type BookMode, type PaperSize } from '../types'

interface NewBookModalProps {
  open: boolean
  onClose: () => void
  onCreate: (book: BookDocument) => void
}

export default function NewBookModal({ open, onClose, onCreate }: NewBookModalProps) {
  const [title, setTitle] = useState('')
  const [paperSize, setPaperSize] = useState<PaperSize>('A4')
  const [bookMode, setBookMode] = useState<BookMode>('qa')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setTitle('')
      setPaperSize('A4')
      setBookMode('qa')
      setError('')
    }
  }, [open])

  if (!open) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      setError('Enter a name')
      return
    }
    onCreate(createNewBook(t, { paperSize, bookMode }))
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="w-[460px] max-w-[92vw] rounded-xl bg-white overflow-hidden shadow-2xl animate-slide-up"
        style={{ border: '1px solid #E5E7EB' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <h2 className="text-[16px] font-bold" style={{ color: '#111827' }}>
            Create New Book / Question Bank
          </h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: '#374151' }}>
              Book Name / Title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError('')
              }}
              placeholder="e.g. TNPSC General Studies Bank"
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
              style={{
                border: error ? '1.5px solid #DC2626' : '1px solid #D1D5DB',
                color: '#111827',
              }}
            />
            {error && (
              <p className="text-[12px] mt-1" style={{ color: '#DC2626' }}>
                {error}
              </p>
            )}
          </div>

          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: '#374151' }}>
              Publication Format / Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBookMode('qa')}
                className="p-3 rounded-lg text-left transition-all"
                style={{
                  border: bookMode === 'qa' ? '1.5px solid #0E7490' : '1px solid #E5E7EB',
                  background: bookMode === 'qa' ? 'rgba(14, 116, 144, 0.08)' : 'white',
                }}
              >
                <div className="text-[12px] font-bold" style={{ color: bookMode === 'qa' ? '#0E7490' : '#111827' }}>
                  Question Bank
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#6B7280' }}>
                  Questions, Answers & Explanations
                </div>
              </button>
              <button
                type="button"
                onClick={() => setBookMode('questions-only')}
                className="p-3 rounded-lg text-left transition-all"
                style={{
                  border: bookMode === 'questions-only' ? '1.5px solid #0E7490' : '1px solid #E5E7EB',
                  background: bookMode === 'questions-only' ? 'rgba(14, 116, 144, 0.08)' : 'white',
                }}
              >
                <div className="text-[12px] font-bold" style={{ color: bookMode === 'questions-only' ? '#0E7490' : '#111827' }}>
                  Syllabus
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#6B7280' }}>
                  Course syllabus & Study material
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold block mb-1.5" style={{ color: '#374151' }}>
              Page Size
            </label>
            <div className="flex gap-2">
              {(['A4', 'B5', '8×8'] as PaperSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPaperSize(s)}
                  className="flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all"
                  style={{
                    border: paperSize === s ? '1.5px solid #0E7490' : '1px solid #E5E7EB',
                    background: paperSize === s ? 'rgba(14, 116, 144, 0.08)' : 'white',
                    color: paperSize === s ? '#0E7490' : '#4B5563',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 flex justify-end gap-2" style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium" style={{ color: '#4B5563' }}>
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #0E7490, #0D9488)' }}>
            Create Book
          </button>
        </div>
      </form>
    </div>
  )
}
