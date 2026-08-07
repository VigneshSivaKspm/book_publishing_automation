import { useEffect, useState } from 'react'
import type { BookDocument, NavHandler } from '../types'
import { estimateBookStats } from '../lib/bookAi'

interface DashboardProps {
  onNavigate: NavHandler
  onExport: () => void
  onCommand: () => void
  onNewBook: () => void
  library: BookDocument[]
  onOpenBook: (book: BookDocument) => void
  onDeleteBook: (id: string) => void
}

const pillars = [
  {
    id: 'stage1',
    stage: '1. Book Creation & Content Entry',
    title: 'Content Entry & AI OCR',
    desc: 'Create new books in A4, B5, or 8×8 format. Enter content manually, paste raw text, or run AI OCR on scanned pages.',
    action: 'new' as const,
    accent: '#0E7490',
  },
  {
    id: 'stage2',
    stage: '2. Content Editing & Layout',
    title: 'Layout & Typography Engine',
    desc: 'Word-style editor with Chapter & Topic management, MCQ creation tools, answer key generation, English/Tamil/Math fonts.',
    action: 'new' as const,
    accent: '#0D9488',
  },
  {
    id: 'stage3',
    stage: '3. Preview & Compilation',
    title: 'Live Preview & Auto Align',
    desc: 'Real-time multi-page document rendering, automatic question & layout alignment, auto compile, and page validation.',
    action: 'new' as const,
    accent: '#059669',
  },
  {
    id: 'stage4',
    stage: '4. Print & Export',
    title: 'Multi-Size PDF Export',
    desc: 'Generate print-ready outputs with automatic page numbering and dynamic headers/footers for A4, B5, and 8×8 inches.',
    action: 'export' as const,
    accent: '#0284C7',
  },
]

export default function Dashboard({
  onNavigate,
  onExport,
  onCommand,
  onNewBook,
  library,
  onOpenBook,
  onDeleteBook,
}: DashboardProps) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 8000)
    return () => clearInterval(t)
  }, [])

  const tip = [
    'Stage 1: Choose A4, B5, or 8×8 inches publication size when creating your book.',
    'Stage 2: Use the MCQ Builder or Paste Import to convert raw text into formatted question blocks instantly.',
    'Stage 3: One-click Auto Align & Compile keeps layout, headings, and margins perfectly structured.',
    'Stage 4: Export Print PDF generates press-ready output with dynamic headers, footers, and page numbers.',
  ][tick % 4]

  return (
    <div className="h-full overflow-y-auto animate-fade-in">
      <div
        className="sticky top-0 z-10 h-[56px] px-8"
        style={{
          background: 'rgba(247,250,252,0.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="max-w-[1600px] mx-auto h-full flex items-center justify-between">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
            Automated Book & Question Bank Publishing Suite
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCommand}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-mono"
              style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
            >
              Jump
              <kbd className="px-1 rounded" style={{ background: 'var(--muted)' }}>
                ⌘K
              </kbd>
            </button>
            <button
              onClick={onNewBook}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #0E7490, #0D9488)' }}
            >
              + New Book
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-7 w-full max-w-[1600px] mx-auto">
        <div className="mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--primary)' }}>
            End-to-End Publishing Suite Workflow
          </p>
          <h1 className="text-[28px] font-bold tracking-tight mb-2" style={{ color: 'var(--ink)' }}>
            Creation → Editing & Layout → Live Compilation → Multi-Size Export
          </h1>
          <p className="text-[14px] max-w-[720px]" style={{ color: 'var(--muted-foreground)' }}>
            Streamline creation, layout management, typography, math formulas, question formatting, and print-ready export for A4, B5, and 8×8 educational publications.
          </p>
          <button
            onClick={onNewBook}
            className="mt-5 px-5 py-3 rounded-xl text-[14px] font-semibold text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #0E7490, #0D9488)' }}
          >
            Create new book
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {pillars.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => (p.action === 'new' ? onNewBook() : onExport())}
              className="text-left p-5 rounded-2xl transition-all hover:shadow-md"
              style={{ background: 'white', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[13px] font-bold"
                  style={{ background: p.accent }}
                >
                  {idx + 1}
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-teal-50 text-teal-800">
                  Stage {idx + 1}
                </span>
              </div>
              <h2 className="text-[16px] font-bold mb-1.5" style={{ color: 'var(--ink)' }}>
                {p.title}
              </h2>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                {p.desc}
              </p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>
                Your Book & Question Bank Library
              </h3>
              <button onClick={onNewBook} className="text-[11px] font-semibold" style={{ color: 'var(--primary)' }}>
                + New Book
              </button>
            </div>
            {library.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                  No books in library
                </p>
                <p className="text-[12px] mb-4" style={{ color: 'var(--muted-foreground)' }}>
                  Create your first book or question bank to start the 4-stage publishing workflow.
                </p>
                <button
                  onClick={onNewBook}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  Create book
                </button>
              </div>
            ) : (
              <div>
                {library.map((book) => {
                  const s = estimateBookStats(book)
                  return (
                    <div
                      key={book.id}
                      onClick={() => onOpenBook(book)}
                      className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                            {book.title}
                          </div>
                          <span
                            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                              background: book.bookMode === 'questions-only' ? '#FEF3C7' : '#E0F2FE',
                              color: book.bookMode === 'questions-only' ? '#92400E' : '#0369A1',
                            }}
                          >
                            {book.bookMode === 'questions-only' ? 'Syllabus' : 'Question Bank'}
                          </span>
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          Size: {book.paperSize} · {s.pages} pages · {s.words.toLocaleString()} words
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm(`Are you sure you want to remove "${book.title}" from library?`)) {
                              onDeleteBook(book.id)
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all hover:bg-red-100"
                          style={{
                            background: '#FEE2E2',
                            color: '#DC2626',
                            border: '1px solid #FCA5A5',
                          }}
                          title="Remove book"
                        >
                          🗑 Remove
                        </button>
                        <span
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-md flex-shrink-0"
                          style={{ background: 'rgba(14,116,144,0.1)', color: '#0E7490' }}
                        >
                          Open Studio
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div
            className="rounded-2xl p-5 flex flex-col justify-between"
            style={{
              background: 'linear-gradient(160deg, #0F766E 0%, #0E7490 55%, #134E4A 100%)',
              color: 'white',
            }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-100/80 mb-2">Publishing Workflow Guide</p>
              <p className="text-[15px] font-medium leading-relaxed text-white/95">{tip}</p>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={onNewBook}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.18)' }}
              >
                + New Book
              </button>
              <button
                onClick={() => onNavigate('editor')}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                Publishing Studio
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
