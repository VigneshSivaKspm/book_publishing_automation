import { useEffect, useState } from 'react'
import CommandPalette from './components/CommandPalette'
import ExportModal from './components/ExportModal'
import NewBookModal from './components/NewBookModal'
import Sidebar from './components/Sidebar'
import BookEditor from './pages/BookEditor'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'
import Login from './pages/Login'
import Settings from './pages/Settings'
import type { BookDocument, Page } from './types'
import { createNewBook } from './types'

const LIBRARY_KEY = 'figma.library.v1'

function createDefaultSeed(): BookDocument[] {
  const b1 = createNewBook('Integral Calculus', {
    paperSize: 'A4',
    author: 'Karthikeyan Analysis Learning Resources',
    subtitle: 'Chapter 02 · Multiple Integrals & Calculus Practice',
  })
  b1.headerFooter.chapterTitle = 'Integral Calculus'
  b1.headerFooter.chapterNumber = '02'
  b1.headerFooter.middleBoxText = 'Karthikeyan Analysis Study Circle'
  b1.headerFooter.middleRightText = 'Integral Calculus'
  b1.headerFooter.footerLeft = 'Karthikeyan Analysis Learning Resources'
  b1.headerFooter.watermarkText = 'KARTHIKEYAN ANALYSIS STUDY CIRCLE'
  b1.headerFooter.layoutColumns = 2
  b1.headerFooter.showColumnDivider = true

  b1.pages = [
    {
      id: 'p1',
      number: 1,
      blocks: [
        {
          id: 'b1',
          type: 'mcq',
          text: '1. Evaluate: $\\int_{0}^{1} \\int_{0}^{1} \\int_{0}^{1} e^{x+y+z} \\, dx \\, dy \\, dz$ **(2025)**\n(A) $e^3 - 1$\n(B) $(e - 1)^3$ [✓ B]\n(C) $3(e - 1)$\n(D) $3e - 1$',
          options: ['$e^3 - 1$', '$(e - 1)^3$', '$3(e - 1)$', '$3e - 1$'],
          answer: 'B',
        },
        {
          id: 'b2',
          type: 'mcq',
          text: '2. $\\int_{0}^{-a} \\int_{0}^{\\sqrt{ay}} -xy \\, dx \\, dy =$ **(2025)**\n(A) $\\frac{a^4}{6}$ [✓ A]\n(B) $-\\frac{a^4}{6}$\n(C) $\\frac{a^3}{3}$\n(D) $-\\frac{a^3}{3}$',
          options: ['$\\frac{a^4}{6}$', '$-\\frac{a^4}{6}$', '$\\frac{a^3}{3}$', '$-\\frac{a^3}{3}$'],
          answer: 'A',
        },
        {
          id: 'b3',
          type: 'mcq',
          text: '3. Evaluate: $\\int_{-\\frac{\\pi}{2}}^{\\frac{\\pi}{2}} (x \\cos x + x^3 \\sec x) \\, dx$ **(2025)**\n(A) $1$\n(B) $\\frac{\\pi}{2}$\n(C) $\\pi$\n(D) $0$ [✓ D]',
          options: ['$1$', '$\\frac{\\pi}{2}$', '$\\pi$', '$0$'],
          answer: 'D',
        },
        {
          id: 'b4',
          type: 'mcq',
          text: '4. $\\int_{0}^{\\infty} \\int_{x}^{\\infty} \\frac{e^{-y}}{y} \\, dy \\, dx =$ **(2025)**\n(A) $0$\n(B) $1$ [✓ B]\n(C) $\\infty$\n(D) $-1$',
          options: ['$0$', '$1$', '$\\infty$', '$-1$'],
          answer: 'B',
        },
        {
          id: 'b5',
          type: 'mcq',
          text: '5. The change of order of integration in the integral $\\int_{0}^{\\infty} \\int_{x}^{\\infty} \\frac{e^{-y}}{y} \\, dy \\, dx$ is **(2025)**\n(A) $\\int_{0}^{\\infty} \\int_{0}^{y} \\frac{e^{-y}}{y} \\, dx \\, dy$ [✓ A]\n(B) $\\int_{0}^{\\infty} \\int_{y}^{\\infty} \\frac{e^{-y}}{y} \\, dx \\, dy$\n(C) $\\int_{0}^{\\infty} \\int_{0}^{y} \\frac{e^{-y}}{x} \\, dy \\, dx$\n(D) $\\int_{0}^{\\infty} \\int_{y}^{\\infty} \\frac{e^{-y}}{y} \\, dy \\, dx$',
          options: ['$\\int_{0}^{\\infty} \\int_{0}^{y} \\frac{e^{-y}}{y} \\, dx \\, dy$', '$\\int_{0}^{\\infty} \\int_{y}^{\\infty} \\frac{e^{-y}}{y} \\, dx \\, dy$', '$\\int_{0}^{\\infty} \\int_{0}^{y} \\frac{e^{-y}}{x} \\, dy \\, dx$', '$\\int_{0}^{\\infty} \\int_{y}^{\\infty} \\frac{e^{-y}}{y} \\, dy \\, dx$'],
          answer: 'A',
        },
        {
          id: 'b6',
          type: 'mcq',
          text: '6. The value of $\\int_{0}^{1} \\int_{x^2}^{2-x} xy \\, dx \\, dy$ is **(2025)**\n(A) $5/8$\n(B) $3/8$ [✓ B]\n(C) $1/8$\n(D) $11/8$',
          options: ['$5/8$', '$3/8$', '$1/8$', '$11/8$'],
          answer: 'B',
        },
        {
          id: 'b7',
          type: 'mcq',
          text: '7. The solution of $\\int_{0}^{\\pi} \\theta \\sin^3 \\theta \\, d\\theta$ **(2025)**\n(A) $2\\pi$\n(B) $3\\pi$\n(C) $\\frac{2\\pi}{3}$ [✓ C]\n(D) $\\frac{3\\pi}{2}$',
          options: ['$2\\pi$', '$3\\pi$', '$\\frac{2\\pi}{3}$', '$\\frac{3\\pi}{2}$'],
          answer: 'C',
        },
        {
          id: 'b8',
          type: 'mcq',
          text: '8. When $n$ is a positive integer, the reduction formula for $\\int \\frac{dx}{(x^2+a^2)^n}$ is **(2025)**\n(A) $\\frac{x}{a^2(2n-2)(x^2+a^2)^{n-1}} - \\frac{2n-3}{2(n-1)a^2} I_{n-1}$\n(B) $\\frac{x}{a^2(2n-2)(x^2+a^2)^{n-1}} + \\frac{2n-3}{2(n-1)a^2} I_{n-1}$ [✓ B]',
          options: ['$\\frac{x}{a^2(2n-2)(x^2+a^2)^{n-1}} - \\frac{2n-3}{2(n-1)a^2} I_{n-1}$', '$\\frac{x}{a^2(2n-2)(x^2+a^2)^{n-1}} + \\frac{2n-3}{2(n-1)a^2} I_{n-1}$'],
          answer: 'B',
        },
      ],
    },
    {
      id: 'p2',
      number: 2,
      blocks: [
        {
          id: 'b9',
          type: 'mcq',
          text: '9. The value of $\\int \\frac{dx}{(e^x+e^{-x})^2}$ **(2025)**\n(A) $\\frac{1}{2(e^{2x}+3)} + c$\n(B) $-\\frac{1}{2(e^{2x}+1)} + c$ [✓ B]\n(C) $\\frac{1}{e^{2x}}$\n(D) $0$',
          options: ['$\\frac{1}{2(e^{2x}+3)} + c$', '$-\\frac{1}{2(e^{2x}+1)} + c$', '$\\frac{1}{e^{2x}}$', '$0$'],
          answer: 'B',
        },
        {
          id: 'b10',
          type: 'mcq',
          text: '10. $\\int_{0}^{1} x(1 - x^2)^{1/2} \\, dx = $ **(2025)**\n(A) $0$\n(B) $\\frac{\\pi}{2}$\n(C) $\\frac{\\pi}{3}$\n(D) $\\frac{1}{3}$ [✓ D]',
          options: ['$0$', '$\\frac{\\pi}{2}$', '$\\frac{\\pi}{3}$', '$\\frac{1}{3}$'],
          answer: 'D',
        },
        {
          id: 'b11',
          type: 'mcq',
          text: '11. The value of $\\int_{0}^{1} \\int_{0}^{2} (x^2 + y^2) \\, dy \\, dx$ is **(2025)**\n(A) $\\frac{8}{3}$\n(B) $\\frac{2}{3}$\n(C) $\\frac{10}{3}$ [✓ C]\n(D) $\\frac{4}{3}$',
          options: ['$\\frac{8}{3}$', '$\\frac{2}{3}$', '$\\frac{10}{3}$', '$\\frac{4}{3}$'],
          answer: 'C',
        },
        {
          id: 'b12',
          type: 'mcq',
          text: '12. $\\int e^x [f(x) + f\'(x)] \\, dx = $ **(2025)**\n(A) $e^x f(x)$ [✓ A]\n(B) $e^{ax} f(x)$\n(C) $\\frac{e^{ax} f(x)}{a}$\n(D) $e^x f\'(x)$',
          options: ['$e^x f(x)$', '$e^{ax} f(x)$', '$\\frac{e^{ax} f(x)}{a}$', '$e^x f\'(x)$'],
          answer: 'A',
        },
        {
          id: 'b13',
          type: 'mcq',
          text: '13. Evaluate $\\int_{0}^{a} \\int_{0}^{b} \\int_{0}^{c} (x + y + z) \\, dz \\, dy \\, dx$ **(2025)**\n(A) $\\frac{abc}{3}(a+b+c)$\n(B) $abc$\n(C) $a+b+c$\n(D) $\\frac{abc}{2}(a+b+c)$ [✓ D]',
          options: ['$\\frac{abc}{3}(a+b+c)$', '$abc$', '$a+b+c$', '$\\frac{abc}{2}(a+b+c)$'],
          answer: 'D',
        },
        {
          id: 'b14',
          type: 'mcq',
          text: '14. $\\int_{0}^{1} \\int_{y^2}^{1} \\int_{0}^{1-x} x \\, dz \\, dx \\, dy = $ **(2025)**\n(A) $35/4$\n(B) $4/35$ [✓ B]\n(C) $5/35$\n(D) $6/35$',
          options: ['$35/4$', '$4/35$', '$5/35$', '$6/35$'],
          answer: 'B',
        },
        {
          id: 'b15',
          type: 'mcq',
          text: '15. $\\int \\frac{1}{1+\\cos x} \\, dx = $ **(2025)**\n(A) $\\cot x - \\csc x + c$\n(B) $\\csc x - \\cot x + c$ [✓ B]\n(C) $\\tan x - \\cot x + c$\n(D) $\\cot x - \\tan x + c$',
          options: ['$\\cot x - \\csc x + c$', '$\\csc x - \\cot x + c$', '$\\tan x - \\cot x + c$', '$\\cot x - \\tan x + c$'],
          answer: 'B',
        },
      ],
    },
  ]

  const b2 = createNewBook('Class 12 Physics & Math Workbook', {
    paperSize: 'B5',
    author: 'Publishing Team',
    subtitle: 'Competitive Exam Fast Track',
  })

  return [b1, b2]
}

function loadLibrary(): BookDocument[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return createDefaultSeed()
    const parsed = JSON.parse(raw) as BookDocument[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createDefaultSeed()
  } catch {
    return createDefaultSeed()
  }
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [showNewBook, setShowNewBook] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [activeBook, setActiveBook] = useState<BookDocument | null>(null)
  const [library, setLibrary] = useState<BookDocument[]>(() => loadLibrary())

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
    } catch {
      /* ignore */
    }
  }, [library])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCommandPalette((v) => !v)
      }
      if (!activeBook && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setShowNewBook(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setShowExport(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeBook])

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />
  }

  const handleCreate = (book: BookDocument) => {
    setLibrary((prev) => [book, ...prev.filter((b) => b.id !== book.id)])
    setActiveBook(book)
    setShowNewBook(false)
  }

  const handleBookChange = (book: BookDocument) => {
    setActiveBook(book)
    setLibrary((prev) => {
      if (!prev.some((b) => b.id === book.id)) return [book, ...prev]
      return prev.map((b) => (b.id === book.id ? book : b))
    })
  }

  if (activeBook) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-900">
        <BookEditor
          book={activeBook}
          onChange={handleBookChange}
          onClose={() => {
            setActiveBook(null)
            setActivePage('dashboard')
          }}
        />
        <ExportModal open={showExport} onClose={() => setShowExport(false)} />
        <CommandPalette
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNavigate={(page) => {
            if (page !== 'book-editor') {
              setActiveBook(null)
              setActivePage(page)
            }
          }}
          onExport={() => setShowExport(true)}
          onAction={(action) => {
            if (action === 'new-book') setShowNewBook(true)
          }}
        />
      </div>
    )
  }

  const handleDeleteBook = (id: string) => {
    setLibrary((prev) => prev.filter((b) => b.id !== id))
    setActiveBook((curr) => (curr && curr.id === id ? null : curr))
  }

  const renderCurrentPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard
            library={library}
            onNavigate={setActivePage}
            onExport={() => setShowExport(true)}
            onCommand={() => setShowCommandPalette(true)}
            onNewBook={() => setShowNewBook(true)}
            onOpenBook={(book) => setActiveBook(book)}
            onDeleteBook={handleDeleteBook}
          />
        )
      case 'editor':
        return (
          <Editor
            onNavigate={setActivePage}
            onExport={() => setShowExport(true)}
            onOpenBook={(book) => setActiveBook(book)}
          />
        )
      case 'settings':
        return (
          <Settings
            onBack={() => setActivePage('dashboard')}
          />
        )
      default:
        return (
          <Dashboard
            library={library}
            onNavigate={setActivePage}
            onExport={() => setShowExport(true)}
            onCommand={() => setShowCommandPalette(true)}
            onNewBook={() => setShowNewBook(true)}
            onOpenBook={(book) => setActiveBook(book)}
            onDeleteBook={handleDeleteBook}
          />
        )
    }
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden app-mesh">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onExport={() => setShowExport(true)}
        onCommandPalette={() => setShowCommandPalette(true)}
        onNewBook={() => setShowNewBook(true)}
      />
      <main className="flex-1 h-full overflow-hidden relative">
        {renderCurrentPage()}
      </main>

      <NewBookModal
        open={showNewBook}
        onClose={() => setShowNewBook(false)}
        onCreate={handleCreate}
      />
      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
      />
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={setActivePage}
        onExport={() => setShowExport(true)}
        onAction={(action) => {
          if (action === 'new-book') setShowNewBook(true)
        }}
      />
    </div>
  )
}
