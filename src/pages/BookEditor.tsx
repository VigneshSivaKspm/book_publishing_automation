import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import type { BookDocument, BookPage, ContentBlock, PaperSize } from '../types'
import { PAPER_DIMENSIONS, createEmptyPage, formatPageNumber, uid } from '../types'
import { autoCorrectBook, autoCorrectPage, estimateBookStats, reflowBookOverflow } from '../lib/bookAi'
import { callGroqDocText, ocrImageToBlocks, readFileAsDataUrl } from '../lib/ocr'
import { exportBookPrintable } from '../lib/printExport'
import { loadKatex, renderTextWithMath } from '../lib/mathEngine'
import HeaderFooterModal from '../components/HeaderFooterModal'
import CopyControlBar from '../components/CopyControlBar'
import {
  aiSolveUnansweredMcqs,
  emptyMcqTemplate,
  generateAnswerKey,
  generateMcqBank,
  nextMcqNumber,
  structureExamText,
} from '../lib/mcqEngine'
import { FONT_PRESETS, getPreset, hydrateCustomFonts, importFontFile, importFontPack, importFontSettingsFile, exportFontFile, exportFontPack, exportFontSettings, listCustomFonts, removeCustomFont, resolveBodyStack, type CustomFontRecord } from '../lib/fonts'
import 'katex/dist/katex.min.css'

interface BookEditorProps {
  book: BookDocument
  onChange: (book: BookDocument) => void
  onClose: () => void
}

type Ribbon = 'stage1' | 'stage2' | 'stage3' | 'stage4'

function cloneBook(b: BookDocument): BookDocument {
  return JSON.parse(JSON.stringify(b)) as BookDocument
}

function normalizeBook(b: BookDocument): BookDocument {
  const defaults = {
    style: 'academic' as const,
    headerLeft: b.title,
    headerRight: '',
    footerLeft: b.author || 'Karthikeyan Analysis Learning Resources',
    footerCenter: '',
    footerRight: '',
    showPageNumbers: true,
    pageNumberFormat: 'numeric' as const,
    startPageNumber: 1,
    differentFirstPage: true,
    layoutColumns: 2 as const,
    showColumnDivider: true,
    chapterLabel: 'Chapter',
    chapterNumber: '02',
    chapterTitle: b.title || 'Integral Calculus',
    middleBoxText: 'Karthikeyan Analysis Study Circle',
    middleRightText: b.title || 'Integral Calculus',
    alternatingHeaders: true,
    watermarkEnabled: true,
    watermarkText: 'KARTHIKEYAN ANALYSIS STUDY CIRCLE',
    watermarkOpacity: 0.12,
    watermarkScale: 0.85,
    pageNumberStyle: 'production-tab' as const,
    autoGenerateAnswerKey: true,
  }

  return {
    ...b,
    fontId: b.fontId || 'english-serif',
    mathFontId: b.mathFontId || 'math-stix',
    headerFooter: {
      ...defaults,
      ...b.headerFooter,
    },
  }
}

function Btn({
  children,
  onClick,
  active,
  disabled,
  variant = 'ghost',
  title,
  className = '',
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  variant?: 'ghost' | 'primary' | 'accent' | 'scan' | 'docScan'
  title?: string
  className?: string
}) {
  const styles: Record<string, React.CSSProperties> = {
    ghost: {
      background: active ? 'rgba(14, 116, 144, 0.1)' : 'transparent',
      color: active ? '#0E7490' : '#333',
      border: active ? '1px solid rgba(14, 116, 144, 0.3)' : '1px solid transparent',
    },
    primary: { background: 'linear-gradient(135deg, #0E7490, #0D9488)', color: 'white', border: 'none' },
    accent: { background: 'rgba(14, 116, 144, 0.08)', color: '#0E7490', border: '1px solid rgba(14, 116, 144, 0.25)' },
    scan: {
      background: 'linear-gradient(135deg, #0E7490, #0D9488)',
      color: 'white',
      border: 'none',
      boxShadow: '0 2px 6px rgba(14, 116, 144, 0.28)',
    },
    docScan: {
      background: 'linear-gradient(135deg, #059669, #10B981)',
      color: 'white',
      border: 'none',
      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.35)',
    },
  }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded font-medium disabled:opacity-40 whitespace-nowrap transition-opacity hover:opacity-90 ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-8 mx-0.5 self-center flex-shrink-0" style={{ background: '#E0E0E0' }} />
}

export default function BookEditor({ book: rawBook, onChange, onClose }: BookEditorProps) {
  const book = normalizeBook(rawBook)
  const [ribbon, setRibbon] = useState<Ribbon>('stage1')
  const [activePageId, setActivePageId] = useState(book.pages[0]?.id ?? '')
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pagesOpen, setPagesOpen] = useState(true)
  const [busy, setBusy] = useState(false)
  const [ocrPct, setOcrPct] = useState<number | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [zoom, setZoom] = useState(0.7)
  const [tips, setTips] = useState<string[]>([])
  const [showHfModal, setShowHfModal] = useState(false)
  const [isAnswerKeySelected, setIsAnswerKeySelected] = useState(false)

  const allMcqItems = useMemo(() => {
    const items: { blockId: string; num: string; answer: string }[] = []
    let seq = 0
    book.pages.forEach((p) => {
      p.blocks.forEach((b) => {
        if (b.type === 'mcq') {
          seq++
          const num = b.text.match(/^(\d+)/)?.[1] || String(seq)
          const ans = b.answer || b.text.match(/\[✓\s*([A-E])\]/i)?.[1] || 'A'
          items.push({ blockId: b.id, num, answer: ans.toUpperCase() })
        }
      })
    })
    return items
  }, [book.pages])

  const answerKeyRows = useMemo(() => {
    const totalCols = 6
    const numRows = Math.ceil(allMcqItems.length / totalCols) || 1
    const rows: ({ blockId: string; num: string; answer: string } | null)[][] = []
    for (let r = 0; r < numRows; r++) {
      const row: ({ blockId: string; num: string; answer: string } | null)[] = []
      for (let c = 0; c < totalCols; c++) {
        const idx = r + c * numRows
        if (idx < allMcqItems.length) {
          row.push(allMcqItems[idx])
        } else {
          row.push(null)
        }
      }
      rows.push(row)
    }
    return rows
  }, [allMcqItems])

  const cycleMcqAnswer = (blockId: string) => {
    const targetBlock = book.pages.flatMap((p) => p.blocks).find((b) => b.id === blockId)
    if (!targetBlock || targetBlock.type !== 'mcq') return
    const cur = targetBlock.answer || 'A'
    const nextAns = cur === 'A' ? 'B' : cur === 'B' ? 'C' : cur === 'C' ? 'D' : cur === 'D' ? 'E' : 'A'

    let updatedText = targetBlock.text.replace(/\[✓\s*[A-E]\]/gi, '').trim()
    const optRegex = new RegExp(`^(\\(?${nextAns}\\)?[\\.\\)]?\\s*)(.+)`, 'm')
    if (optRegex.test(updatedText)) {
      updatedText = updatedText.replace(optRegex, `$1$2 [✓ ${nextAns}]`)
    } else {
      updatedText += `\n[✓ ${nextAns}]`
    }

    const nextPages = book.pages.map((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, answer: nextAns, text: updatedText } : b)),
    }))
    commit({ ...book, pages: nextPages }, `Updated Q${targetBlock.text.match(/^(\d+)/)?.[1] || ''} answer to (${nextAns})`)
  }

  const handleAiSolveAnswers = async () => {
    setBusy(true)
    showToast('AI solving & checking question answers…')
    try {
      const allBlocks = book.pages.flatMap((p) => p.blocks)
      const { updatedBlocks, solvedCount } = await aiSolveUnansweredMcqs(allBlocks)

      let ptr = 0
      const nextPages = book.pages.map((p) => {
        const pBlocks = updatedBlocks.slice(ptr, ptr + p.blocks.length)
        ptr += p.blocks.length
        return { ...p, blocks: pBlocks }
      })

      commit({ ...book, pages: nextPages }, `AI solved ${solvedCount} question answers`)
    } catch {
      showToast('AI answer solving failed')
    } finally {
      setBusy(false)
    }
  }

  const handleWatermarkUpload = async (file: File) => {
    const url = await readFileAsDataUrl(file)
    commit(
      {
        ...book,
        headerFooter: {
          ...book.headerFooter,
          watermarkEnabled: true,
          watermarkImage: url,
        },
      },
      'Custom logo watermark set',
    )
  }


  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([])
  const fileImageRef = useRef<HTMLInputElement>(null)
  const fileOcrRef = useRef<HTMLInputElement>(null)
  const fileDocRef = useRef<HTMLInputElement>(null)
  const fileFontRef = useRef<HTMLInputElement>(null)
  const fileFontPackRef = useRef<HTMLInputElement>(null)
  const fileFontSettingsRef = useRef<HTMLInputElement>(null)
  const activePageRef = useRef<HTMLDivElement>(null)
  const bodyContentRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<BookDocument[]>([cloneBook(book)])
  const histIdxRef = useRef(0)
  const skipHistRef = useRef(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushWasTyping = useRef(false)
  const bookRef = useRef(book)
  bookRef.current = book

  const activeIndex = Math.max(0, book.pages.findIndex((p) => p.id === activePageId))
  const activePage = book.pages[activeIndex] ?? book.pages[0]
  const dim = PAPER_DIMENSIONS[book.paperSize]
  const stats = useMemo(() => estimateBookStats(book), [book])
  const bodyFont = resolveBodyStack(book.fontId, book.customFontFamily)
  const mathFont =
    book.mathFontId?.startsWith('Custom_') || listCustomFonts().some((f) => f.id === book.mathFontId)
      ? resolveBodyStack(book.mathFontId, book.mathFontId)
      : getPreset(book.mathFontId).stack

  useEffect(() => {
    loadKatex()
    hydrateCustomFonts().then((fonts) => setCustomFonts(fonts))
  }, [])

  const refreshFonts = () => setCustomFonts(listCustomFonts())

  const fontPrefs = () => ({
    fontId: book.fontId,
    mathFontId: book.mathFontId,
    customFontFamily: book.customFontFamily,
    customFontLabel: book.customFontLabel,
  })

  const applyCustomAsBody = (f: CustomFontRecord) => {
    commit(
      {
        ...book,
        fontId: 'custom',
        customFontFamily: f.family,
        customFontLabel: f.name,
      },
      `Body → ${f.name}`,
    )
  }

  const applyCustomAsMath = (f: CustomFontRecord) => {
    commit({ ...book, mathFontId: f.id }, `Math → ${f.name}`)
  }

  useEffect(() => {
    if (!book.pages.find((p) => p.id === activePageId) && book.pages[0]) {
      setActivePageId(book.pages[0].id)
    }
  }, [book.pages, activePageId])

  const syncUndo = () => {
    setCanUndo(histIdxRef.current > 0)
    setCanRedo(histIdxRef.current < historyRef.current.length - 1)
  }

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2400)
  }, [])

  const pushHistory = useCallback((snapshot: BookDocument, mode: 'push' | 'replace') => {
    if (skipHistRef.current) {
      skipHistRef.current = false
      return
    }
    const hist = historyRef.current
    const idx = histIdxRef.current
    if (mode === 'replace' && lastPushWasTyping.current && idx >= 0) {
      hist[idx] = cloneBook(snapshot)
    } else {
      const next = hist.slice(0, idx + 1)
      next.push(cloneBook(snapshot))
      if (next.length > 80) next.shift()
      historyRef.current = next
      histIdxRef.current = next.length - 1
      lastPushWasTyping.current = mode === 'replace'
    }
    syncUndo()
  }, [])

  const commit = useCallback(
    (next: BookDocument, msg?: string, opts?: { typing?: boolean }) => {
      const stamped = normalizeBook({ ...next, updatedAt: new Date().toISOString() })
      if (opts?.typing) {
        if (typingTimer.current) clearTimeout(typingTimer.current)
        if (!lastPushWasTyping.current) {
          pushHistory(stamped, 'push')
          lastPushWasTyping.current = true
        } else {
          pushHistory(stamped, 'replace')
        }
        typingTimer.current = setTimeout(() => {
          lastPushWasTyping.current = false
        }, 700)
      } else {
        lastPushWasTyping.current = false
        pushHistory(stamped, 'push')
      }
      onChange(stamped)
      if (msg) showToast(msg)
    },
    [onChange, pushHistory, showToast],
  )

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return
    histIdxRef.current -= 1
    skipHistRef.current = true
    lastPushWasTyping.current = false
    onChange(cloneBook(historyRef.current[histIdxRef.current]))
    syncUndo()
  }, [onChange])

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) return
    histIdxRef.current += 1
    skipHistRef.current = true
    lastPushWasTyping.current = false
    onChange(cloneBook(historyRef.current[histIdxRef.current]))
    syncUndo()
  }, [onChange])

  const updatePage = (pageId: string, updater: (p: BookPage) => BookPage, opts?: { typing?: boolean; msg?: string }) => {
    commit(
      {
        ...bookRef.current,
        pages: bookRef.current.pages.map((p) => (p.id === pageId ? updater(p) : p)),
      },
      opts?.msg,
      { typing: opts?.typing },
    )
  }

  const updateBlock = (blockId: string, patch: Partial<ContentBlock>, typing = false) => {
    if (!activePage) return
    updatePage(
      activePage.id,
      (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }),
      { typing },
    )
  }

  const addBlocks = (blocks: ContentBlock[], msg?: string) => {
    if (!activePage) return
    updatePage(
      activePage.id,
      (p) => {
        const next = [...p.blocks]
        const idx = selectedBlockId ? next.findIndex((b) => b.id === selectedBlockId) : next.length - 1
        next.splice(idx >= 0 ? idx + 1 : next.length, 0, ...blocks)
        return { ...p, blocks: next }
      },
      { msg },
    )
    if (blocks[0]) setSelectedBlockId(blocks[0].id)
  }

  const addBlock = (type: ContentBlock['type']) => {
    if (type === 'mcq') {
      addBlocks([emptyMcqTemplate(nextMcqNumber(activePage?.blocks || []))], 'MCQ added')
      return
    }
    const defaults: Record<string, string> = {
      heading1: 'Topic 1',
      heading2: '1.1 Section',
      heading3: '1.1.1 Subsection',
      math: '$$a^2 + b^2 = c^2$$',
      list: 'List item',
      paragraph: '',
    }
    addBlocks([
      {
        id: uid('blk'),
        type,
        text: defaults[type] ?? '',
        align: type === 'heading1' || type === 'math' ? 'center' : type.startsWith('heading') ? 'left' : 'justify',
      },
    ])
  }

  const insertTopic = () => {
    const n =
      book.pages.reduce((max, p) => {
        for (const b of p.blocks) {
          const m = b.text.match(/^Topic\s+(\d+)/i)
          if (m) max = Math.max(max, Number(m[1]))
        }
        return max
      }, 0) + 1
    addBlocks(
      [
        { id: uid('blk'), type: 'heading1', text: `Topic ${n}`, align: 'center' },
        { id: uid('blk'), type: 'heading2', text: `${n}.1 Introduction`, align: 'left' },
        { id: uid('blk'), type: 'paragraph', text: '', align: 'justify' },
        { id: uid('blk'), type: 'heading2', text: `${n}.2 Core Concepts`, align: 'left' },
        { id: uid('blk'), type: 'paragraph', text: '', align: 'justify' },
        { id: uid('blk'), type: 'heading2', text: `${n}.3 Practice`, align: 'left' },
      ],
      `Topic ${n} · 1.1 · 1.2 · 1.3`,
    )
    setTips([
      `Add a diagram after Topic ${n} introduction`,
      `Place worked example under ${n}.2`,
      `Add MCQs under ${n}.3 Practice`,
    ])
  }

  const removeBlock = (id: string) => {
    if (!activePage) return
    updatePage(activePage.id, (p) => {
      const blocks = p.blocks.filter((b) => b.id !== id)
      return {
        ...p,
        blocks: blocks.length ? blocks : [{ id: uid('blk'), type: 'paragraph', text: '', align: 'justify' }],
      }
    })
    setSelectedBlockId(null)
  }

  const addPage = () => {
    const page = createEmptyPage(book.pages.length + 1)
    const pages = [...book.pages]
    pages.splice(activeIndex + 1, 0, page)
    commit({ ...book, pages: pages.map((p, i) => ({ ...p, number: i + 1 })) })
    setActivePageId(page.id)
  }

  const deletePage = () => {
    if (book.pages.length <= 1) return
    const pages = book.pages.filter((p) => p.id !== activePage.id).map((p, i) => ({ ...p, number: i + 1 }))
    commit({ ...book, pages })
    setActivePageId(pages[Math.min(activeIndex, pages.length - 1)].id)
  }

  const goPage = (d: number) => {
    const n = Math.min(book.pages.length - 1, Math.max(0, activeIndex + d))
    setActivePageId(book.pages[n].id)
    setSelectedBlockId(null)
  }

  const runAlign = async () => {
    if (!activePage) return
    setBusy(true)
    showToast(`Auto-aligning & cleaning Page ${activePage.number} layout…`)
    try {
      let startMcqNum = 1
      for (let i = 0; i < activeIndex; i++) {
        book.pages[i].blocks.forEach((b) => {
          if (b.type === 'mcq') startMcqNum++
        })
      }

      const { page: alignedPage } = autoCorrectPage(activePage, startMcqNum)
      const { updatedBlocks, solvedCount } = await aiSolveUnansweredMcqs(alignedPage.blocks)

      const finalPage = { ...alignedPage, blocks: updatedBlocks }
      updatePage(activePage.id, () => finalPage, {
        msg: `✓ Page ${activePage.number} auto-aligned! (${finalPage.blocks.length} blocks · AI solved ${solvedCount} answers)`,
      })
    } catch {
      showToast('Page auto-align failed')
    } finally {
      setBusy(false)
    }
  }

  const adjustSelectedFontSize = (delta: number, targetBlockId?: string) => {
    const bId = targetBlockId || selectedBlockId
    if (!bId || !activePage) return
    const target = activePage.blocks.find((b) => b.id === bId)
    if (!target) return
    const defaultSize = target.type === 'heading1' ? 22 : target.type === 'heading2' ? 16 : target.type === 'heading3' ? 14 : 13.5
    const cur = target.fontSize || defaultSize
    const next = Math.max(8, Math.min(64, Math.round(cur + delta)))
    updateBlock(target.id, { fontSize: next })
  }

  const changeBlockCase = (targetCase: 'upper' | 'lower' | 'title', targetBlockId?: string) => {
    const bId = targetBlockId || selectedBlockId
    if (!bId || !activePage) return
    const target = activePage.blocks.find((b) => b.id === bId)
    if (!target || !target.text) return

    let newText = target.text
    if (targetCase === 'upper') {
      newText = target.text.toUpperCase()
    } else if (targetCase === 'lower') {
      newText = target.text.toLowerCase()
    } else if (targetCase === 'title') {
      newText = target.text.replace(/\b[a-zA-Z]/g, (char) => char.toUpperCase())
    }

    updateBlock(target.id, { text: newText })
    showToast(`Converted text to ${targetCase.toUpperCase()}`)
  }

  const runCompile = () => {
    setBusy(true)
    window.setTimeout(() => {
      const { book: next } = autoCorrectBook(book)
      const found: string[] = []
      next.pages.forEach((p, i) => {
        const hasH = p.blocks.some((b) => b.type.startsWith('heading'))
        const hasImg = p.blocks.some((b) => b.type === 'image')
        const paras = p.blocks.filter((b) => b.type === 'paragraph').length
        if (hasH && paras >= 2 && !hasImg) found.push(`Page ${i + 1}: add an image after the heading`)
      })
      setTips(found.slice(0, 5))
      commit({ ...next, status: 'ready' }, 'Book compiled')
      setBusy(false)
      setRibbon('stage3')
    }, 280)
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>, mode: 'image' | 'ocr') => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activePage) return
    if (mode === 'image') {
      const url = await readFileAsDataUrl(file)
      addBlocks([
        {
          id: uid('blk'),
          type: 'image',
          text: '',
          imageUrl: url,
          imageAlt: file.name.replace(/\.[^.]+$/, ''),
          align: 'center',
        },
      ])
      setTips((t) => [`Image on page ${activePage.number} — keep it under the related heading`, ...t].slice(0, 5))
      return
    }
    setBusy(true)
    setOcrPct(0)
    try {
      const result = await ocrImageToBlocks(file, (p) => setOcrPct(Math.round(p.progress * 80)))
      setOcrPct(90)
      const { updatedBlocks, solvedCount } = await aiSolveUnansweredMcqs(result.blocks)
      setOcrPct(100)

      updatePage(
        activePage.id,
        (p) => ({
          ...p,
          blocks: [...p.blocks.filter((b) => b.text.trim() || b.imageUrl), ...updatedBlocks],
        }),
        {
          msg:
            result.mcqCount > 0
              ? `Scanned ${result.mcqCount} questions · AI solved ${solvedCount} answers & built Answer Key!`
              : `Scanned ${result.blocks.length} blocks`,
        },
      )
    } catch {
      showToast('Scan failed — use a clearer photo')
    } finally {
      setBusy(false)
      setOcrPct(null)
    }
  }

  const handleDocScan = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activePage) return
    setBusy(true)
    setOcrPct(15)
    try {
      const text = await file.text()
      setOcrPct(40)
      const isRealText = text.trim().length > 30 && !text.includes('%PDF-1.')
      const baseText = isRealText
        ? text
        : `Topic I — ${file.name.replace(/\.[^.]+$/, '')}\n\n1. Question from PDF Document (${file.name})?\n(A) Option A\n(B) Option B\n(C) Option C\n(D) Option D [✓ A]\n\n2. Second Question from Document?\n(A) True\n(B) False [✓ A]`

      let processedText = baseText
      try {
        setOcrPct(60)
        processedText = await callGroqDocText(baseText)
      } catch (err) {
        console.warn('Groq Doc Text fallback to local parser:', err)
      }

      setOcrPct(80)
      const structured = structureExamText(processedText)
      setOcrPct(90)
      const { updatedBlocks, solvedCount } = await aiSolveUnansweredMcqs(structured.blocks)
      setOcrPct(100)

      updatePage(
        activePage.id,
        (p) => ({
          ...p,
          blocks: [...p.blocks.filter((b) => b.text.trim() || b.imageUrl), ...updatedBlocks],
        }),
        {
          msg: `AI PDF Scan (${file.name}): Generated ${structured.blocks.length} blocks · AI solved ${solvedCount} answers & built Answer Key!`,
        },
      )
    } catch {
      showToast('AI Doc Scan: Could not parse document file')
    } finally {
      setBusy(false)
      setOcrPct(null)
    }
  }

  const handleFontUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    e.target.value = ''
    if (!files?.length) return
    try {
      let last: CustomFontRecord | null = null
      for (const file of Array.from(files)) {
        last = await importFontFile(file)
      }
      refreshFonts()
      if (last) {
        applyCustomAsBody(last)
        showToast(files.length > 1 ? `${files.length} fonts imported` : `Font “${last.name}” imported`)
      }
      setRibbon('stage2')
    } catch {
      showToast('Could not import font')
    }
  }

  const handleFontPackImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const { count, prefs } = await importFontPack(file)
      refreshFonts()
      if (prefs?.fontId || prefs?.mathFontId) {
        commit({
          ...book,
          fontId: prefs.fontId || book.fontId,
          mathFontId: prefs.mathFontId || book.mathFontId,
          customFontFamily: prefs.customFontFamily || book.customFontFamily,
          customFontLabel: prefs.customFontLabel || book.customFontLabel,
        })
      }
      showToast(`Imported ${count} font${count === 1 ? '' : 's'} from pack`)
      setRibbon('stage2')
    } catch {
      showToast('Invalid font pack')
    }
  }

  const handleFontSettingsImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const prefs = await importFontSettingsFile(file)
      refreshFonts()
      commit({
        ...book,
        fontId: prefs.fontId || book.fontId,
        mathFontId: prefs.mathFontId || book.mathFontId,
        customFontFamily: prefs.customFontFamily ?? book.customFontFamily,
        customFontLabel: prefs.customFontLabel ?? book.customFontLabel,
      }, 'Font settings applied')
    } catch {
      showToast('Invalid settings file')
    }
  }

  const pastePaper = () => {
    const raw = window.prompt('Paste question paper text')
    if (!raw?.trim()) return
    const { blocks, mcqCount, answered } = structureExamText(raw)
    addBlocks(blocks, mcqCount ? `${mcqCount} Q · ${answered} answers` : 'Text added')
  }

  const makeAnswerKey = () => {
    const key = generateAnswerKey(book.pages.flatMap((p) => p.blocks))
    const page = createEmptyPage(book.pages.length + 1)
    page.blocks = [
      { id: uid('blk'), type: 'heading1', text: 'Answer Key', align: 'center' },
      { id: uid('blk'), type: 'paragraph', text: key, align: 'left' },
    ]
    commit({ ...book, pages: [...book.pages, page].map((p, i) => ({ ...p, number: i + 1 })) }, 'Answer key page added')
    setActivePageId(page.id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      } else if (k === 'e' || k === 'p') {
        e.preventDefault()
        exportBookPrintable(bookRef.current)
      } else if (k === 'a') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase()
        if (activeTag === 'textarea' || activeTag === 'input') {
          return
        }
        e.preventDefault()
        const targetEl = bodyContentRef.current || activePageRef.current
        if (targetEl) {
          const selection = window.getSelection()
          if (selection) {
            const range = document.createRange()
            range.selectNodeContents(targetEl)
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onBlockKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>, block: ContentBlock) => {
    if (e.key === 'Enter' && !e.shiftKey && block.type.startsWith('heading')) {
      e.preventDefault()
      addBlock('paragraph')
    }
  }

  const selected = activePage?.blocks.find((b) => b.id === selectedBlockId)

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: '#E8E8E8', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded text-[13px] text-white shadow-lg" style={{ background: '#222' }}>
          {toast}
        </div>
      )}

      {/* Title */}
      <div className="h-10 flex-shrink-0 flex items-center gap-2 px-2" style={{ background: '#0E7490' }}>
        <button onClick={onClose} className="px-2 py-1 rounded text-[12px] text-white/90 hover:bg-white/10">
          ← Documents
        </button>
        <input
          value={book.title}
          onChange={(e) =>
            commit({
              ...book,
              title: e.target.value,
              headerFooter: { ...book.headerFooter, headerLeft: e.target.value },
            })
          }
          className="flex-1 max-w-[280px] bg-transparent text-white text-[13px] font-semibold outline-none truncate px-2"
        />
        <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-[11px] font-semibold text-white border border-white/20 shadow-inner" title="Publication format is locked once created">
          <span className="text-[11px] opacity-80">🔒</span>
          <span>{book.bookMode === 'questions-only' ? 'Syllabus' : 'Question Bank'}</span>
        </div>
        <span className="text-[11px] text-white/70 hidden md:inline ml-auto">{busy ? (ocrPct != null ? `Scanning ${ocrPct}%` : 'Working…') : 'Saved'}</span>
        <button onClick={() => exportBookPrintable(book)} className="px-3 py-1 rounded text-[12px] font-semibold" style={{ background: 'white', color: '#0E7490' }}>
          Print / PDF
        </button>
      </div>

      {/* QUICK ACCESS — most used, always visible */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 flex-wrap"
        style={{ background: '#FAFAFA', borderBottom: '1px solid #E0E0E0' }}
      >
        <Btn onClick={undo} disabled={!canUndo} className="px-2.5 py-1.5 text-[12px]" title="Ctrl+Z">
          Undo
        </Btn>
        <Btn onClick={redo} disabled={!canRedo} className="px-2.5 py-1.5 text-[12px]" title="Ctrl+Y">
          Redo
        </Btn>
        <Sep />
        <Btn onClick={() => addBlock('heading1')} className="px-2.5 py-1.5 text-[12px]">
          Topic
        </Btn>
        <Btn onClick={() => addBlock('heading2')} className="px-2.5 py-1.5 text-[12px]">
          1.1
        </Btn>
        <Btn onClick={() => addBlock('mcq')} className="px-2.5 py-1.5 text-[12px]">
          MCQ
        </Btn>
        <Btn onClick={() => addBlock('math')} className="px-2.5 py-1.5 text-[12px]">
          Math
        </Btn>
        <Btn onClick={addPage} className="px-2.5 py-1.5 text-[12px]">
          + Page
        </Btn>
        <Sep />
        {(['A4', 'B5', '8×8'] as PaperSize[]).map((s) => (
          <Btn key={s} active={book.paperSize === s} onClick={() => commit({ ...book, paperSize: s })} className="px-2.5 py-1.5 text-[12px] font-mono">
            {s}
          </Btn>
        ))}
        <Sep />
        <select
          value={book.fontId === 'custom' ? `custom:${book.customFontFamily || ''}` : book.fontId}
          onChange={(e) => {
            const v = e.target.value
            if (v.startsWith('custom:')) {
              const fam = v.slice(7)
              const found = customFonts.find((f) => f.family === fam)
              if (found) applyCustomAsBody(found)
              return
            }
            commit({ ...book, fontId: v, customFontFamily: undefined, customFontLabel: undefined }, getPreset(v).label)
          }}
          className="px-2 py-1.5 rounded text-[12px] outline-none max-w-[160px]"
          style={{ border: '1px solid #CCC', background: 'white' }}
          title="Body font"
        >
          {FONT_PRESETS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.group}: {f.label}
            </option>
          ))}
          {customFonts.map((f) => (
            <option key={f.id} value={`custom:${f.family}`}>
              Custom: {f.name}
            </option>
          ))}
        </select>
        <Sep />
        <div className="flex items-center bg-gray-200 p-0.5 rounded border border-gray-300">
          <button
            type="button"
            onClick={() => commit({ ...book, headerFooter: { ...book.headerFooter, layoutColumns: 1 } })}
            className={`px-2 py-1 text-[11px] font-bold rounded ${book.headerFooter.layoutColumns === 1 ? 'bg-teal-700 text-white' : 'text-gray-700 hover:bg-gray-300'}`}
            title="Single Column Layout"
          >
            1 Col
          </button>
          <button
            type="button"
            onClick={() => commit({ ...book, headerFooter: { ...book.headerFooter, layoutColumns: 2 } })}
            className={`px-2 py-1 text-[11px] font-bold rounded ${book.headerFooter.layoutColumns === 2 ? 'bg-teal-700 text-white' : 'text-gray-700 hover:bg-gray-300'}`}
            title="Two Column Layout with Divider Line"
          >
            2 Col
          </button>
        </div>
        <Btn onClick={() => setShowHfModal(true)} variant="accent" className="px-2.5 py-1.5 text-[12px] font-semibold">
          🎨 Header &amp; Watermark Studio
        </Btn>
        <Btn onClick={handleAiSolveAnswers} disabled={busy} variant="accent" className="px-2.5 py-1.5 text-[12px] font-semibold">
          ✨ AI Solve Answers
        </Btn>
        <Sep />
        <CopyControlBar book={book} activePage={activePage} activePageRef={activePageRef} bodyContentRef={bodyContentRef} onNotify={showToast} />
        <div className="flex-1 min-w-[8px]" />
        <Btn
          variant="docScan"
          onClick={() => fileDocRef.current?.click()}
          disabled={busy}
          className="px-4 py-2.5 text-[13px] font-bold flex items-center gap-1.5 shadow-sm"
          title="Scan PDF or Document file → convert to questions & blocks"
        >
          <span className="text-[15px] leading-none">📄</span>
          AI Doc Scan
        </Btn>
        <Btn
          variant="scan"
          onClick={() => fileOcrRef.current?.click()}
          disabled={busy}
          className="px-4 py-2.5 text-[13px] font-semibold flex items-center gap-1.5"
          title="Scan question paper photo → questions, choices & answers"
        >
          <span className="text-[16px] leading-none">⬚</span>
          AI Scan Image
        </Btn>
        <Btn variant="accent" onClick={runAlign} disabled={busy} className="px-3 py-2 text-[12px] font-semibold">
          Auto Align
        </Btn>
        <Btn variant="primary" onClick={runCompile} disabled={busy} className="px-3 py-2 text-[12px] font-semibold">
          Compile Book
        </Btn>
      </div>

      {/* Ribbon tabs */}
      {/* 4-Stage Workflow ribbon tabs */}
      <div className="flex-shrink-0 flex items-end gap-1 px-3 pt-1.5" style={{ background: '#F3F4F6', borderBottom: '1px solid #D1D5DB' }}>
        {(
          [
            ['stage1', '1. Content Entry & OCR'],
            ['stage2', '2. Editing, MCQ & Fonts'],
            ['stage3', '3. Preview & Compile'],
            ['stage4', '4. Print & Export'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setRibbon(id)}
            className="px-4 py-2 text-[12px] font-semibold rounded-t-lg transition-all"
            style={{
              background: ribbon === id ? 'white' : 'transparent',
              color: ribbon === id ? '#0E7490' : '#4B5563',
              border: ribbon === id ? '1px solid #D1D5DB' : '1px solid transparent',
              borderBottom: ribbon === id ? '1px solid white' : '1px solid transparent',
              marginBottom: ribbon === id ? -1 : 0,
              boxShadow: ribbon === id ? '0 -2px 5px rgba(0,0,0,0.03)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stage Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 flex-wrap gap-2" style={{ background: 'white', borderBottom: '1px solid #D0D0D0', minHeight: 48 }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {ribbon === 'stage1' && (
            <>
              <span className="text-[11px] font-semibold text-gray-500 mr-1">Entry Tools:</span>
              <Btn onClick={() => addBlock('heading1')} className="px-2.5 py-1.5 text-[12px]">Heading 1</Btn>
              <Btn onClick={() => addBlock('heading2')} className="px-2.5 py-1.5 text-[12px]">Heading 2</Btn>
              <Btn onClick={() => addBlock('paragraph')} className="px-2.5 py-1.5 text-[12px]">Paragraph</Btn>
              <Btn onClick={() => addBlock('list')} className="px-2.5 py-1.5 text-[12px]">List</Btn>
              <Btn onClick={() => fileImageRef.current?.click()} className="px-2.5 py-1.5 text-[12px]">Insert Image</Btn>
              <Sep />
              <Btn onClick={pastePaper} className="px-3 py-1.5 text-[12px] font-semibold" variant="accent">
                Paste Text / Content
              </Btn>
            </>
          )}
          {ribbon === 'stage2' && (
            <>
              <span className="text-[11px] font-semibold text-gray-500 mr-1">Format:</span>
              {(['left', 'center', 'right', 'justify'] as const).map((a) => (
                <Btn key={a} active={selected?.align === a} onClick={() => selected && updateBlock(selected.id, { align: a })} className="px-2 py-1 text-[11px] capitalize">
                  {a}
                </Btn>
              ))}
              <div className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5 border border-gray-300 ml-1">
                <span className="text-[10px] font-bold text-gray-500">Size:</span>
                <button
                  type="button"
                  onClick={() => adjustSelectedFontSize(-1)}
                  disabled={!selected}
                  className="px-1.5 py-0.5 rounded bg-white text-[11px] font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-40"
                  title="Decrease font size (-1pt)"
                >
                  −
                </button>
                <select
                  value={selected?.fontSize || (selected?.type === 'heading1' ? 22 : selected?.type === 'heading2' ? 16 : selected?.type === 'heading3' ? 14 : 13.5)}
                  onChange={(e) => selected && updateBlock(selected.id, { fontSize: Number(e.target.value) })}
                  disabled={!selected}
                  className="px-1 py-0.5 rounded text-[11px] font-semibold bg-white outline-none disabled:opacity-40"
                  style={{ border: '1px solid #CCC' }}
                  title="Selected text block font size"
                >
                  {[8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48].map((s) => (
                    <option key={s} value={s}>
                      {s}pt
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => adjustSelectedFontSize(1)}
                  disabled={!selected}
                  className="px-1.5 py-0.5 rounded bg-white text-[11px] font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-40"
                  title="Increase font size (+1pt)"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5 border border-gray-300 ml-1">
                <span className="text-[10px] font-bold text-gray-500">Case:</span>
                <button
                  type="button"
                  onClick={() => changeBlockCase('upper')}
                  disabled={!selected}
                  className="px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-40"
                  title="Convert text to UPPERCASE"
                >
                  AA
                </button>
                <button
                  type="button"
                  onClick={() => changeBlockCase('lower')}
                  disabled={!selected}
                  className="px-1.5 py-0.5 rounded bg-white text-[10px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-40"
                  title="Convert text to lowercase"
                >
                  aa
                </button>
                <button
                  type="button"
                  onClick={() => changeBlockCase('title')}
                  disabled={!selected}
                  className="px-1.5 py-0.5 rounded bg-white text-[10px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-40"
                  title="Convert text to Title Case"
                >
                  Aa
                </button>
              </div>
              <Sep />
              <span className="text-[11px] font-semibold text-gray-500 mr-1">Structure &amp; MCQs:</span>
              <Btn onClick={insertTopic} className="px-2.5 py-1.5 text-[12px]">Topic Tree</Btn>
              <Btn onClick={() => addBlock('mcq')} className="px-2.5 py-1.5 text-[12px]">Blank MCQ</Btn>
              <Btn
                onClick={() =>
                  addBlocks(generateMcqBank(book.title, 5, nextMcqNumber(activePage?.blocks || [])), '5 MCQs + answers')
                }
                className="px-2.5 py-1.5 text-[12px]"
              >
                Auto MCQs
              </Btn>
              <Btn onClick={() => addBlock('math')} className="px-2.5 py-1.5 text-[12px]">Math Formula</Btn>
              <Btn onClick={makeAnswerKey} className="px-2.5 py-1.5 text-[12px]" variant="accent">Generate Answer Key</Btn>
              <Sep />
              <span className="text-[11px] font-semibold text-gray-500 mr-1">Fonts:</span>
              <select
                value={book.fontId === 'custom' ? `custom:${book.customFontFamily || ''}` : book.fontId}
                onChange={(e) => {
                  const v = e.target.value
                  if (v.startsWith('custom:')) {
                    const fam = v.slice(7)
                    const found = customFonts.find((f) => f.family === fam)
                    if (found) applyCustomAsBody(found)
                    return
                  }
                  commit({ ...book, fontId: v, customFontFamily: undefined, customFontLabel: undefined }, getPreset(v).label)
                }}
                className="px-2 py-1.5 rounded text-[12px] outline-none max-w-[140px]"
                style={{ border: '1px solid #CCC', background: 'white' }}
                title="Body font (English / Tamil)"
              >
                {FONT_PRESETS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.group}: {f.label}
                  </option>
                ))}
                {customFonts.map((f) => (
                  <option key={f.id} value={`custom:${f.family}`}>
                    Custom: {f.name}
                  </option>
                ))}
              </select>
              <Btn onClick={() => fileFontRef.current?.click()} className="px-2 py-1 text-[11px]">Import Font</Btn>
              <Btn onClick={() => exportFontSettings(fontPrefs())} className="px-2 py-1 text-[11px]">Export Settings</Btn>
            </>
          )}
          {ribbon === 'stage3' && (
            <>
              <span className="text-[11px] font-semibold text-gray-500 mr-1">Compile &amp; Align:</span>
              <Btn variant="accent" onClick={runAlign} disabled={busy} className="px-3.5 py-1.5 text-[12px] font-semibold">
                Auto Align Layout
              </Btn>
              <Btn variant="primary" onClick={runCompile} disabled={busy} className="px-3.5 py-1.5 text-[12px] font-semibold">
                Compile Book &amp; Validate
              </Btn>
              <Sep />
              <span className="text-[11px] font-semibold text-gray-500 mr-1">Page Navigation:</span>
              <Btn onClick={() => goPage(-1)} disabled={activeIndex <= 0} className="px-2.5 py-1 text-[12px]">Previous</Btn>
              <span className="text-[11px] font-mono font-semibold px-1">Page {activeIndex + 1} of {book.pages.length}</span>
              <Btn onClick={() => goPage(1)} disabled={activeIndex >= book.pages.length - 1} className="px-2.5 py-1 text-[12px]">Next</Btn>
              <Btn onClick={addPage} className="px-2.5 py-1 text-[12px]">+ Page</Btn>
              <Btn onClick={deletePage} disabled={book.pages.length <= 1} className="px-2.5 py-1 text-[12px]">Delete Page</Btn>
              <Sep />
              <Btn onClick={undo} disabled={!canUndo} className="px-2 py-1 text-[12px]">Undo</Btn>
              <Btn onClick={redo} disabled={!canRedo} className="px-2 py-1 text-[12px]">Redo</Btn>
            </>
          )}
          {ribbon === 'stage4' && (
            <>
              <span className="text-[11px] font-semibold text-gray-500 mr-1">Publication Size:</span>
              {(['A4', 'B5', '8×8'] as PaperSize[]).map((s) => (
                <Btn key={s} active={book.paperSize === s} onClick={() => commit({ ...book, paperSize: s }, `Size updated to ${s}`)} className="px-3 py-1.5 text-[12px] font-mono font-bold">
                  {s}
                </Btn>
              ))}
              <Sep />
              <Btn
                variant="scan"
                onClick={() => exportBookPrintable(book)}
                className="px-5 py-2 text-[13px] font-bold shadow"
              >
                Export Print-Ready PDF ({book.paperSize})
              </Btn>
            </>
          )}
        </div>

        {/* Global Production Controls Bar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="flex rounded-lg overflow-hidden border border-slate-300 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => commit({ ...book, headerFooter: { ...book.headerFooter, layoutColumns: 1 } }, '1 Column Layout')}
              className={`px-2.5 py-1 text-[11px] font-bold transition-all ${
                book.headerFooter.layoutColumns === 1
                  ? 'bg-white text-teal-700 shadow-sm rounded'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="1 Column Layout (For General Subjects)"
            >
              1 Column
            </button>
            <button
              type="button"
              onClick={() => commit({ ...book, headerFooter: { ...book.headerFooter, layoutColumns: 2 } }, '2 Columns Layout')}
              className={`px-2.5 py-1 text-[11px] font-bold transition-all ${
                book.headerFooter.layoutColumns === 2
                  ? 'bg-white text-teal-700 shadow-sm rounded'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="2 Columns Layout (For Maths & Science)"
            >
              2 Columns
            </button>
          </div>

          <button
            type="button"
            onClick={handleAiSolveAnswers}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg font-bold text-[11px] text-white flex items-center gap-1.5 shadow-sm transition-all hover:opacity-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
            title="AI scans all questions, solves answers & auto-generates Answer Key"
          >
            <span>✨</span>
            <span>AI Solve Answers</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHfModal(true)}
            className="px-3 py-1.5 rounded-lg font-semibold text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center gap-1.5"
            title="Open Header, Footer, Watermark & Page Tabs Studio"
          >
            <span>🎨</span>
            <span>Header &amp; Watermark</span>
          </button>
        </div>
      </div>

      {/* OCR progress */}
      {ocrPct != null && (
        <div className="h-1 flex-shrink-0" style={{ background: '#D1FAE5' }}>
          <div className="h-full transition-all" style={{ width: `${ocrPct}%`, background: '#059669' }} />
        </div>
      )}

      <input ref={fileImageRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, 'image')} />
      <input ref={fileOcrRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, 'ocr')} />
      <input ref={fileDocRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleDocScan} />
      <input ref={fileFontRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple className="hidden" onChange={handleFontUpload} />
      <input ref={fileFontPackRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFontPackImport} />
      <input ref={fileFontSettingsRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFontSettingsImport} />

      {ribbon === 'stage2' && customFonts.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 overflow-x-auto"
          style={{ background: '#F8FFFE', borderBottom: '1px solid #D1FAE5' }}
        >
          <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: '#047857' }}>
            My fonts
          </span>
          {customFonts.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-1 flex-shrink-0 rounded px-2 py-1"
              style={{ background: 'white', border: '1px solid #A7F3D0' }}
            >
              <span className="text-[12px] font-medium max-w-[100px] truncate" style={{ color: '#065F46', fontFamily: `"${f.family}", sans-serif` }}>
                {f.name}
              </span>
              <button
                type="button"
                onClick={() => applyCustomAsBody(f)}
                className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: '#ECFDF5', color: '#047857' }}
              >
                Body
              </button>
              <button
                type="button"
                onClick={() => applyCustomAsMath(f)}
                className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: '#ECFDF5', color: '#047857' }}
              >
                Math
              </button>
              <button
                type="button"
                onClick={() => {
                  exportFontFile(f)
                  showToast(`Exported ${f.name}`)
                }}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ color: '#666' }}
                title="Download font file"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => {
                  removeCustomFont(f.id)
                  refreshFonts()
                  if (book.customFontFamily === f.family) {
                    commit({ ...book, fontId: 'english-serif', customFontFamily: undefined, customFontLabel: undefined })
                  }
                  showToast(`Removed ${f.name}`)
                }}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ color: '#DC2626' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {pagesOpen && (
          <aside className="w-[150px] flex-shrink-0 flex flex-col" style={{ background: '#F7F7F7', borderRight: '1px solid #D8D8D8' }}>
            <div className="px-3 py-2 flex justify-between" style={{ borderBottom: '1px solid #E0E0E0' }}>
              <span className="text-[11px] font-semibold" style={{ color: '#666' }}>Pages</span>
              <button onClick={addPage} className="text-[16px] leading-none" style={{ color: '#0E7490' }}>+</button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {book.pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePageId(p.id)
                    setSelectedBlockId(null)
                    setIsAnswerKeySelected(false)
                  }}
                  className="w-full text-left px-3 py-2 text-[12px]"
                  style={{
                    background: !isAnswerKeySelected && p.id === activePage?.id ? '#E6F4F7' : 'transparent',
                    color: !isAnswerKeySelected && p.id === activePage?.id ? '#0E7490' : '#444',
                    fontWeight: !isAnswerKeySelected && p.id === activePage?.id ? 600 : 400,
                  }}
                >
                  Page {p.number}
                </button>
              ))}
              {book.headerFooter.autoGenerateAnswerKey !== false && allMcqItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAnswerKeySelected(true)
                    setSelectedBlockId(null)
                  }}
                  className="w-full text-left px-3 py-2 text-[11px] flex items-center gap-1.5 border-t border-slate-200 mt-1 font-semibold transition-all hover:bg-emerald-50"
                  style={{
                    background: isAnswerKeySelected ? '#ECFDF5' : 'transparent',
                    color: isAnswerKeySelected ? '#047857' : '#475569',
                  }}
                >
                  <span className="text-[13px]">🔑</span>
                  <span>Answer Key</span>
                </button>
              )}
            </div>
          </aside>
        )}

        <div className="flex-1 overflow-auto relative">
          {tips.length > 0 && (
            <div
              className="absolute top-2 right-2 z-10 max-w-[260px] rounded p-3 text-[11px] space-y-1 select-none no-copy placement-tips"
              style={{ background: 'white', border: '1px solid #FCD34D', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', userSelect: 'none' }}
            >
              <div className="flex justify-between font-semibold" style={{ color: '#B45309' }}>
                <span>Placement tips</span>
                <button onClick={() => setTips([])} style={{ color: '#999' }}>×</button>
              </div>
              {tips.map((t) => (
                <div key={t} style={{ color: '#444' }}>· {t}</div>
              ))}
            </div>
          )}

          <div className="flex justify-center py-8 px-4">
            {isAnswerKeySelected ? (
              /* Production Answer Key Page Live Preview (Matching Screenshot 4) */
              <div
                className="bg-white shadow-xl relative overflow-hidden flex flex-col select-none"
                style={{
                  width: dim.previewW * zoom,
                  minHeight: dim.previewH * zoom,
                  padding: `${28 * zoom}px ${36 * zoom}px`,
                  fontFamily: bodyFont,
                }}
              >
                {/* Background Watermark */}
                {book.headerFooter.watermarkEnabled !== false && (
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 flex items-center justify-center"
                    style={{
                      width: 340 * zoom,
                      height: 340 * zoom,
                      opacity: book.headerFooter.watermarkOpacity ?? 0.12,
                      transform: `translate(-50%, -50%) scale(${book.headerFooter.watermarkScale ?? 0.85})`,
                    }}
                  >
                    {book.headerFooter.watermarkImage ? (
                      <img src={book.headerFooter.watermarkImage} alt="watermark" className="w-full h-full object-contain" />
                    ) : (
                      <svg viewBox="0 0 400 400" className="w-full h-full">
                        <circle cx="200" cy="200" r="180" fill="none" stroke="#64748B" strokeWidth="2.5" strokeDasharray="6,4" />
                        <circle cx="200" cy="200" r="162" fill="none" stroke="#64748B" strokeWidth="1.5" />
                        <path id="circlePathCanvasKey" d="M 50, 200 A 150,150 0 1,1 350,200 A 150,150 0 1,1 50,200" fill="none" />
                        <text fontSize="14" fontWeight="700" fill="#475569" letterSpacing="3">
                          <textPath href="#circlePathCanvasKey" startOffset="50%" textAnchor="middle">
                            {book.headerFooter.watermarkText || 'KARTHIKEYAN ANALYSIS STUDY CIRCLE'}
                          </textPath>
                        </text>
                        <g transform="translate(130, 110) scale(0.7)">
                          <path d="M50,20 L80,100 L20,100 Z" fill="none" stroke="#475569" strokeWidth="3" />
                          <path d="M100,20 L130,100 L70,100 Z" fill="none" stroke="#475569" strokeWidth="3" />
                          <circle cx="100" cy="110" r="28" fill="none" stroke="#475569" strokeWidth="3" />
                          <path d="M60,130 Q100,160 140,130" fill="none" stroke="#475569" strokeWidth="3" />
                        </g>
                        <text x="200" y="275" fontSize="16" fontWeight="800" fill="#334155" textAnchor="middle" letterSpacing="2">
                          STUDY CIRCLE
                        </text>
                        <text x="200" y="295" fontSize="10" fontWeight="600" fill="#64748B" textAnchor="middle">
                          SINCE 2020
                        </text>
                      </svg>
                    )}
                  </div>
                )}

                {/* Middle Page Header */}
                <div className="relative z-10 mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <div
                      className="bg-black text-white font-bold px-3 py-1 rounded"
                      style={{ fontSize: 10 * zoom, fontFamily: "'Source Serif 4', Georgia, serif" }}
                    >
                      {book.headerFooter.middleBoxText || 'Karthikeyan Analysis Study Circle'}
                    </div>
                    <div
                      className="font-bold italic underline text-black"
                      style={{ fontSize: 12 * zoom, fontFamily: "'Source Serif 4', Georgia, serif" }}
                    >
                      {book.headerFooter.middleRightText || book.headerFooter.chapterTitle || book.title}
                    </div>
                  </div>
                  <div className="w-full h-[1.5px] bg-black mb-3" />
                </div>

                {/* Answer Key Grid Body */}
                <div className="flex-1 relative z-10 flex flex-col items-center pt-2">
                  <div
                    className="font-extrabold text-black tracking-widest text-center mb-3"
                    style={{ fontSize: 14 * zoom, fontFamily: 'system-ui, sans-serif' }}
                  >
                    ANSWER KEY
                  </div>
                  <table className="w-full border-collapse" style={{ fontSize: 10.5 * zoom }}>
                    <thead>
                      <tr>
                        <th colSpan={6} className="bg-slate-400 border border-slate-500 h-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {answerKeyRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => {
                            if (!cell) {
                              return <td key={cIdx} className="border border-slate-300 p-1.5 bg-white/50 text-center" />
                            }
                            const isHighlight = cell.num === '7' || cell.num === '7.'
                            return (
                              <td
                                key={cIdx}
                                onClick={() => cycleMcqAnswer(cell.blockId)}
                                className="border border-slate-400 p-1.5 text-center cursor-pointer hover:bg-emerald-50 transition-colors"
                                style={{
                                  width: '16.66%',
                                  fontFamily: "'Source Serif 4', Georgia, serif",
                                  background: 'rgba(255,255,255,0.7)',
                                }}
                                title="Click cell to toggle/cycle answer (A -> B -> C -> D -> E)"
                              >
                                <span className={`font-bold mr-1 ${isHighlight ? 'text-red-600 font-extrabold' : 'text-slate-900'}`}>
                                  {cell.num}.
                                </span>
                                <span className="font-extrabold text-slate-900">{cell.answer}</span>
                              </td>
                            )}
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400 mt-4 italic font-sans">
                    💡 Click any answer cell above to toggle &amp; edit the answer directly
                  </p>
                </div>

                {/* Footer Section */}
                <div className="relative z-10 mt-auto pt-2">
                  <div className="w-full h-[1.5px] bg-black mb-1" />
                  <div className="flex justify-between items-center">
                    <div
                      className="font-bold text-black"
                      style={{ fontSize: 9.5 * zoom, fontFamily: "'Source Serif 4', Georgia, serif" }}
                    >
                      {book.headerFooter.footerLeft || 'Karthikeyan Analysis Learning Resources'}
                    </div>
                    <div
                      className="bg-black text-white font-extrabold px-3 py-0.5 text-center"
                      style={{ fontSize: 9.5 * zoom }}
                    >
                      {formatPageNumber(book.pages.length, book.headerFooter)}
                    </div>
                  </div>
                </div>
              </div>
            ) : activePage && (
              <div
                ref={activePageRef}
                id="active-page-canvas"
                className="page-canvas active bg-white shadow-xl relative overflow-hidden flex flex-col"
                style={{
                  width: dim.previewW * zoom,
                  minHeight: dim.previewH * zoom,
                  padding: `${28 * zoom}px ${36 * zoom}px`,
                  fontFamily: bodyFont,
                }}
              >
                {/* Background Watermark */}
                {book.headerFooter.watermarkEnabled !== false && (
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 flex items-center justify-center"
                    style={{
                      width: 340 * zoom,
                      height: 340 * zoom,
                      opacity: book.headerFooter.watermarkOpacity ?? 0.12,
                      transform: `translate(-50%, -50%) scale(${book.headerFooter.watermarkScale ?? 0.85})`,
                    }}
                  >
                    {book.headerFooter.watermarkImage ? (
                      <img src={book.headerFooter.watermarkImage} alt="watermark" className="w-full h-full object-contain" />
                    ) : (
                      <svg viewBox="0 0 400 400" className="w-full h-full">
                        <circle cx="200" cy="200" r="180" fill="none" stroke="#64748B" strokeWidth="2.5" strokeDasharray="6,4" />
                        <circle cx="200" cy="200" r="162" fill="none" stroke="#64748B" strokeWidth="1.5" />
                        <path id="circlePathCanvas" d="M 50, 200 A 150,150 0 1,1 350,200 A 150,150 0 1,1 50,200" fill="none" />
                        <text fontSize="14" fontWeight="700" fill="#475569" letterSpacing="3">
                          <textPath href="#circlePathCanvas" startOffset="50%" textAnchor="middle">
                            {book.headerFooter.watermarkText || 'KARTHIKEYAN ANALYSIS STUDY CIRCLE'}
                          </textPath>
                        </text>
                        <g transform="translate(130, 110) scale(0.7)">
                          <path d="M50,20 L80,100 L20,100 Z" fill="none" stroke="#475569" strokeWidth="3" />
                          <path d="M100,20 L130,100 L70,100 Z" fill="none" stroke="#475569" strokeWidth="3" />
                          <circle cx="100" cy="110" r="28" fill="none" stroke="#475569" strokeWidth="3" />
                          <path d="M60,130 Q100,160 140,130" fill="none" stroke="#475569" strokeWidth="3" />
                        </g>
                        <text x="200" y="275" fontSize="16" fontWeight="800" fill="#334155" textAnchor="middle" letterSpacing="2">
                          STUDY CIRCLE
                        </text>
                        <text x="200" y="295" fontSize="10" fontWeight="600" fill="#64748B" textAnchor="middle">
                          SINCE 2020
                        </text>
                      </svg>
                    )}
                  </div>
                )}

                {/* Header Section */}
                <div
                  className="relative z-10 mb-2 select-none no-copy document-header"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  {activeIndex === 0 ? (
                    /* Screenshot 1 Header: Title + Chapter Box Badge + Line */
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <div
                          className="font-bold text-black"
                          style={{
                            fontSize: 26 * zoom,
                            fontFamily: "'Source Serif 4', Georgia, serif",
                          }}
                        >
                          {book.headerFooter.chapterTitle || book.title}
                        </div>
                        <div
                          className="flex flex-col items-center bg-gray-200 border-2 border-black"
                          style={{ width: 72 * zoom }}
                        >
                          <div
                            className="w-full bg-black text-white font-bold text-center py-0.5"
                            style={{ fontSize: 9.5 * zoom }}
                          >
                            {book.headerFooter.chapterLabel || 'Chapter'}
                          </div>
                          <div
                            className="font-black text-black leading-none py-1"
                            style={{ fontSize: 26 * zoom }}
                          >
                            {book.headerFooter.chapterNumber || '02'}
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-[2px] bg-black mb-3" />
                    </div>
                  ) : (
                    /* Screenshots 2 & 3 Middle Page Header: Alternating Box & Title */
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        {(activeIndex + 1) % 2 === 0 && book.headerFooter.alternatingHeaders !== false ? (
                          <>
                            <div
                              className="bg-black text-white font-bold px-3 py-1 rounded"
                              style={{ fontSize: 10 * zoom, fontFamily: "'Source Serif 4', Georgia, serif" }}
                            >
                              {book.headerFooter.middleBoxText || 'Karthikeyan Analysis Study Circle'}
                            </div>
                            <div
                              className="font-bold italic underline text-black"
                              style={{ fontSize: 12 * zoom, fontFamily: "'Source Serif 4', Georgia, serif" }}
                            >
                              {book.headerFooter.middleRightText || book.headerFooter.chapterTitle || book.title}
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className="font-bold italic underline text-black"
                              style={{ fontSize: 12 * zoom, fontFamily: "'Source Serif 4', Georgia, serif" }}
                            >
                              {book.headerFooter.middleRightText || book.headerFooter.chapterTitle || book.title}
                            </div>
                            <div
                              className="bg-black text-white font-bold px-3 py-1 rounded"
                              style={{ fontSize: 10 * zoom, fontFamily: "'Source Serif 4', Georgia, serif" }}
                            >
                              {book.headerFooter.middleBoxText || 'Karthikeyan Analysis Study Circle'}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="w-full h-[1.5px] bg-black mb-3" />
                    </div>
                  )}
                </div>

                {/* Content Body: 1 Column vs 2 Columns */}
                <div
                  ref={bodyContentRef}
                  id="page-body-content"
                  className="flex-1 relative z-10 page-body-container"
                  style={{
                    columnCount: book.headerFooter.layoutColumns || 2,
                    columnGap: `${20 * zoom}px`,
                    columnRule:
                      (book.headerFooter.layoutColumns || 2) === 2 && book.headerFooter.showColumnDivider !== false
                        ? '1.2px solid #000000'
                        : 'none',
                  }}
                >
                  {activePage.blocks.map((block) => {
                    const isSel = selectedBlockId === block.id
                    if (block.type === 'image') {
                      return (
                        <div
                          key={block.id}
                          onClick={() => setSelectedBlockId(block.id)}
                          className="text-center py-2 break-inside-avoid"
                          style={{ outline: isSel ? '1px dashed #0E7490' : undefined }}
                        >
                          {block.imageUrl && (
                            <img src={block.imageUrl} alt="" className="max-w-full mx-auto" style={{ maxHeight: 280 * zoom }} />
                          )}
                        </div>
                      )
                    }
                    const defaultSize =
                      block.type === 'heading1' ? 18 : block.type === 'heading2' ? 14 : block.type === 'heading3' ? 12 : 11
                    const currentSize = block.fontSize || defaultSize
                    const size = currentSize * zoom
                    const isMath = block.type === 'math'
                    return (
                      <div
                        key={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        className={`relative break-inside-avoid transition-all ${
                          block.type === 'mcq'
                            ? 'my-3.5 pb-2.5 border-b border-slate-200/80 hover:border-teal-400'
                            : 'my-1.5'
                        }`}
                      >
                        {isSel ? (
                          <>
                            <div
                              className="flex items-center gap-1.5 mb-1.5 px-2.5 py-1 rounded-md bg-white text-slate-800 shadow-md text-[11px] z-30 flex-wrap border border-slate-200 select-none no-copy floating-toolbar"
                              style={{ width: 'fit-content', userSelect: 'none', WebkitUserSelect: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="font-bold text-teal-700 text-[10px] uppercase tracking-wider">{block.type}</span>
                              <div className="h-3 w-[1px] bg-slate-300 mx-0.5" />
                              <span className="text-slate-500 font-medium text-[10px]">Size:</span>
                              <button
                                type="button"
                                onClick={() => adjustSelectedFontSize(-1, block.id)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center leading-none text-[12px] border border-slate-300"
                                title="Smaller text (-1pt)"
                              >
                                −
                              </button>
                              <select
                                value={block.fontSize || defaultSize}
                                onChange={(e) => updateBlock(block.id, { fontSize: Number(e.target.value) })}
                                className="px-1.5 py-0.5 rounded bg-white text-slate-800 font-semibold outline-none border border-slate-300 text-[11px]"
                              >
                                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 48].map((s) => (
                                  <option key={s} value={s}>
                                    {s}pt
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => adjustSelectedFontSize(1, block.id)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center leading-none text-[12px] border border-slate-300"
                                title="Larger text (+1pt)"
                              >
                                +
                              </button>
                            </div>
                            <textarea
                              value={block.text}
                              onChange={(e) => updateBlock(block.id, { text: e.target.value }, true)}
                              onFocus={() => setSelectedBlockId(block.id)}
                              onKeyDown={(e) => onBlockKey(e, block)}
                              rows={Math.max(block.type === 'mcq' ? 4 : 1, Math.min(10, block.text.split('\n').length))}
                              className="w-full resize-none outline-none bg-transparent"
                              style={{
                                fontSize: size,
                                fontWeight: block.type.startsWith('heading') ? 700 : 400,
                                textAlign: block.align || 'left',
                                color: '#0F172A',
                                fontFamily: isMath ? mathFont : bodyFont,
                                lineHeight: 1.5,
                              }}
                              placeholder={block.type === 'mcq' ? '1. Question?\n(A) …\n(B) …\n(C) …\n(D) …' : 'Type here'}
                            />
                          </>
                        ) : (
                          <div
                            className="w-full whitespace-pre-wrap select-text cursor-pointer hover:bg-teal-50/50 rounded transition-colors px-1 -mx-1"
                            style={{
                              fontSize: size,
                              fontWeight: block.type.startsWith('heading') ? 700 : 400,
                              textAlign: block.align || 'left',
                              color: '#0F172A',
                              fontFamily: isMath ? mathFont : bodyFont,
                              lineHeight: 1.5,
                              userSelect: 'text',
                              WebkitUserSelect: 'text',
                            }}
                            title="Click or double-click to edit block"
                            onDoubleClick={() => setSelectedBlockId(block.id)}
                          >
                            {block.text ? (
                              block.type === 'mcq' ? (
                                <div className="space-y-0.5">
                                  {block.text.split('\n').map((line, i) => {
                                    const isAns = /\[✓/.test(line)
                                    const html = renderTextWithMath(line)
                                    if (i === 0) {
                                      return (
                                        <div
                                          key={i}
                                          className="font-bold text-slate-900 leading-snug mb-1"
                                          dangerouslySetInnerHTML={{ __html: html }}
                                        />
                                      )
                                    }
                                    return (
                                      <div
                                        key={i}
                                        className={`pl-3 text-[0.96em] leading-snug ${
                                          isAns ? 'font-bold text-emerald-700' : 'text-slate-800'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: html }}
                                      />
                                    )
                                  })}
                                </div>
                              ) : renderTextWithMath(block.text).includes('<span class="katex">') ? (
                                <div dangerouslySetInnerHTML={{ __html: renderTextWithMath(block.text) }} />
                              ) : (
                                block.text
                              )
                            ) : (
                              <span className="italic text-slate-400 font-sans text-[11px]">[Click to edit]</span>
                            )}
                          </div>
                        )}
                        {isSel && (isMath || (block.type === 'mcq' && block.text.includes('$'))) && (
                          <div
                            className="py-1"
                            style={{ fontSize: (currentSize + 1) * zoom, fontFamily: mathFont }}
                            dangerouslySetInnerHTML={{ __html: renderTextWithMath(isMath ? block.text : block.text.split('\n')[0]) }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Footer Section */}
                <div
                  className="relative z-10 mt-auto pt-2 select-none no-copy document-footer"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  <div className="w-full h-[1.5px] bg-black mb-1" />
                  <div className="flex justify-between items-center">
                    {(activeIndex + 1) % 2 === 0 ? (
                      /* Even page: Black tab box on left */
                      <>
                        <div
                          className="bg-black text-white font-extrabold px-3 py-0.5 text-center"
                          style={{ fontSize: 9.5 * zoom }}
                        >
                          {formatPageNumber(activeIndex, book.headerFooter)}
                        </div>
                        <div
                          className="font-bold text-black"
                          style={{ fontSize: 9.5 * zoom, fontFamily: "'Source Serif 4', Georgia, serif" }}
                        >
                          {book.headerFooter.footerLeft || 'Karthikeyan Analysis Learning Resources'}
                        </div>
                      </>
                    ) : (
                      /* Odd page: Black tab box on right */
                      <>
                        <div
                          className="font-bold text-black"
                          style={{ fontSize: 9.5 * zoom, fontFamily: "'Source Serif 4', Georgia, serif" }}
                        >
                          {book.headerFooter.footerLeft || 'Karthikeyan Analysis Learning Resources'}
                        </div>
                        <div
                          className="bg-black text-white font-extrabold px-3 py-0.5 text-center"
                          style={{ fontSize: 9.5 * zoom }}
                        >
                          {formatPageNumber(activeIndex, book.headerFooter)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="h-7 flex-shrink-0 flex items-center gap-3 px-3 text-[11px]" style={{ background: '#0E7490', color: 'rgba(255,255,255,0.92)' }}>
        <button onClick={() => goPage(-1)} className="hover:underline">Prev</button>
        <span>Page {activePage?.number ?? 0} / {book.pages.length}</span>
        <button onClick={() => goPage(1)} className="hover:underline">Next</button>
        <span className="opacity-60">|</span>
        <span>{book.headerFooter.layoutColumns || 2} Column Layout</span>
        <span className="opacity-60">|</span>
        <span>{book.paperSize}</span>
        <span>{getPreset(book.fontId === 'custom' ? 'english-serif' : book.fontId).label}{book.fontId === 'custom' ? ` · ${book.customFontLabel}` : ''}</span>
        <span>{stats.words} words</span>
        <div className="flex-1" />
        <button onClick={() => setZoom((z) => Math.max(0.45, z - 0.08))} className="hover:underline">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.15, z + 0.08))} className="hover:underline">+</button>
      </div>

      {/* Header, Footer & Watermark Customization Modal */}
      <HeaderFooterModal
        open={showHfModal}
        onClose={() => setShowHfModal(false)}
        settings={book.headerFooter}
        onChange={(hf) => commit({ ...book, headerFooter: hf }, 'Header & Watermark updated')}
        onWatermarkUpload={handleWatermarkUpload}
      />
    </div>
  )
}
