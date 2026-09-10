import { useState } from 'react'
import type { BookDocument, BookMode, NavHandler } from '../types'
import { estimateBookStats } from '../lib/bookAi'

interface DashboardProps {
  onNavigate: NavHandler
  onExport: () => void
  onCommand: () => void
  onNewBook: (mode?: BookMode) => void
  library: BookDocument[]
  onOpenBook: (book: BookDocument) => void
  onDeleteBook: (id: string) => void
}

export default function Dashboard({
  library,
  onNewBook,
  onOpenBook,
  onDeleteBook,
}: DashboardProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'qa' | 'questions-only'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLibrary = library.filter((book) => {
    if (filterMode !== 'all') {
      const mode = book.bookMode || 'qa'
      if (mode !== filterMode) return false
    }
    if (searchQuery.trim()) {
      return book.title.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  return (
    <div className="h-full overflow-y-auto bg-slate-50 font-sans">
      {/* Header Bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">
              Publishing Workspace
            </h1>
            <p className="text-[12px] text-slate-500 font-medium mt-0.5">
              Create and edit Question Paper Books and Course Syllabus Books
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-8 py-7 max-w-[1400px] mx-auto space-y-7">
        {/* 2 Primary Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Question Bank Creation Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-slate-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 tracking-wider">
                  Question Bank Mode
                </span>
              </div>
              <h2 className="text-[17px] font-bold text-slate-900 mb-1.5">
                Question Paper & Question Bank Book
              </h2>
              <p className="text-[13px] text-slate-600 leading-relaxed mb-5">
                Build exam question papers with multiple choice questions (A–E), auto-generating answer keys, AI answer solver, and 2-column layout.
              </p>
            </div>
            <button
              onClick={() => onNewBook('qa')}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-bold transition-all shadow-xs"
            >
              + Create Question Bank Book
            </button>
          </div>

          {/* Syllabus Book Creation Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-slate-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 tracking-wider">
                  Syllabus Mode
                </span>
              </div>
              <h2 className="text-[17px] font-bold text-slate-900 mb-1.5">
                Syllabus & Course Study Book
              </h2>
              <p className="text-[13px] text-slate-600 leading-relaxed mb-5">
                Build course manuals and study materials with chapter trees, sub-headings (1.1, 1.2), theory prose, bullet points, and LaTeX math formulas.
              </p>
            </div>
            <button
              onClick={() => onNewBook('questions-only')}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-bold transition-all shadow-xs"
            >
              + Create Syllabus Book
            </button>
          </div>
        </div>

        {/* Document Library */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
          {/* Header & Filters */}
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">
                Your Document Library ({library.length})
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Click any book below to open the editor
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg border border-slate-300">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                    filterMode === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Books
                </button>
                <button
                  onClick={() => setFilterMode('qa')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                    filterMode === 'qa'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Question Banks
                </button>
                <button
                  onClick={() => setFilterMode('questions-only')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                    filterMode === 'questions-only'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Syllabus Books
                </button>
              </div>

              {/* Search Box */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents…"
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-[12px] text-slate-900 placeholder-slate-400 outline-none focus:border-slate-500 w-44"
              />
            </div>
          </div>

          {/* Book Items */}
          {filteredLibrary.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-[15px] font-bold text-slate-800 mb-1">
                No documents found
              </h4>
              <p className="text-[12px] text-slate-500 max-w-sm mx-auto mb-5">
                {searchQuery || filterMode !== 'all'
                  ? 'No documents match your filter or search criteria.'
                  : 'Start by creating your first Question Bank or Syllabus Book.'}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => onNewBook('qa')}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all"
                >
                  + Question Bank
                </button>
                <button
                  onClick={() => onNewBook('questions-only')}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all"
                >
                  + Syllabus Book
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredLibrary.map((book) => {
                const stats = estimateBookStats(book)
                const isSyllabus = book.bookMode === 'questions-only'

                return (
                  <div
                    key={book.id}
                    onClick={() => onOpenBook(book)}
                    className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isSyllabus ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          )}
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[14px] font-bold text-slate-900 group-hover:text-slate-700 transition-colors truncate">
                            {book.title}
                          </h4>
                          <span className="text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded flex-shrink-0 bg-slate-100 text-slate-700 border border-slate-200">
                            {isSyllabus ? 'Syllabus Book' : 'Question Bank'}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500 font-medium mt-0.5">
                          Paper Size: <span className="font-semibold text-slate-700">{book.paperSize}</span> ·{' '}
                          <span className="font-semibold text-slate-700">{stats.pages}</span> pages ·{' '}
                          <span className="font-semibold text-slate-700">{stats.words.toLocaleString()}</span> words
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`Are you sure you want to delete "${book.title}"?`)) {
                            onDeleteBook(book.id)
                          }
                        }}
                        className="px-3 py-1.5 text-[11.5px] font-bold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all"
                        title="Delete book"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenBook(book)
                        }}
                        className="px-4 py-1.5 text-[12px] font-bold rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs"
                      >
                        Open Editor →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
