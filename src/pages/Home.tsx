import type { BookDocument } from '../types'
import { estimateBookStats } from '../lib/bookAi'

interface HomeProps {
  library: BookDocument[]
  onNewBook: () => void
  onOpenBook: (book: BookDocument) => void
  onOpenSettings: () => void
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function Home({ library, onNewBook, onOpenBook, onOpenSettings }: HomeProps) {
  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F3F3F3' }}>
      <header
        className="h-14 flex items-center justify-between px-8"
        style={{ background: 'white', borderBottom: '1px solid #E5E5E5' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-white text-[13px] font-bold"
            style={{ background: '#0E7490' }}
          >
            F
          </div>
          <span className="text-[16px] font-semibold" style={{ color: '#1A1A1A' }}>
            Figma
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 rounded text-[13px]"
            style={{ color: '#666' }}
          >
            Settings
          </button>
          <button
            onClick={onNewBook}
            className="px-4 py-1.5 rounded text-[13px] font-semibold text-white"
            style={{ background: '#0E7490' }}
          >
            New
          </button>
        </div>
      </header>

      <div className="max-w-[960px] mx-auto px-8 py-10">
        <h1 className="text-[28px] font-semibold mb-1" style={{ color: '#1A1A1A' }}>
          Documents
        </h1>
        <p className="text-[14px] mb-8" style={{ color: '#666' }}>
          Open a book or create a new one.
        </p>

        <button
          onClick={onNewBook}
          className="w-full sm:w-auto flex items-center gap-4 p-4 rounded-lg mb-8 text-left transition-shadow hover:shadow-md"
          style={{ background: 'white', border: '1px solid #E5E5E5' }}
        >
          <div
            className="w-14 h-16 rounded flex items-center justify-center text-[22px] font-light"
            style={{ background: '#E6F4F7', color: '#0E7490', border: '1px solid #B6E0EA' }}
          >
            +
          </div>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: '#1A1A1A' }}>
              Blank book
            </div>
            <div className="text-[12px]" style={{ color: '#888' }}>
              A4 · B5 · 8×8
            </div>
          </div>
        </button>

        {library.length === 0 ? (
          <div className="py-16 text-center rounded-lg" style={{ background: 'white', border: '1px solid #E5E5E5' }}>
            <p className="text-[15px]" style={{ color: '#666' }}>
              No documents yet. Click <strong>New</strong> to start.
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#888' }}>
              Recent
            </h2>
            <div className="rounded-lg overflow-hidden" style={{ background: 'white', border: '1px solid #E5E5E5' }}>
              {library.map((book, i) => {
                const s = estimateBookStats(book)
                return (
                  <button
                    key={book.id}
                    onClick={() => onOpenBook(book)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-[#F8F8F8] transition-colors"
                    style={{ borderTop: i === 0 ? undefined : '1px solid #F0F0F0' }}
                  >
                    <div
                      className="w-10 h-12 rounded flex-shrink-0 flex items-center justify-center text-[11px] font-mono font-semibold"
                      style={{ background: '#F5F5F5', color: '#0E7490', border: '1px solid #E8E8E8' }}
                    >
                      {book.paperSize === '8×8' ? '8²' : book.paperSize}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium truncate" style={{ color: '#1A1A1A' }}>
                        {book.title}
                      </div>
                      <div className="text-[12px]" style={{ color: '#888' }}>
                        {s.pages} pages · {formatDate(book.updatedAt)}
                      </div>
                    </div>
                    <span className="text-[12px] font-medium" style={{ color: '#0E7490' }}>
                      Open
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
