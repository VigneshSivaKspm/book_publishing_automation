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
import { structureDocumentText, parseMarkdownTable } from '../lib/docStructure'
import { extractChapterMeta } from '../lib/chapterMeta'
import { callOpenAiDocText, ocrImageToBlocks, parsePdfFile, parseMultiPageDocument, readFileAsDataUrl } from '../lib/ocr'
import { exportBookPrintable } from '../lib/printExport'
import { loadKatex, renderTextWithMath } from '../lib/mathEngine'
import HeaderFooterModal from '../components/HeaderFooterModal'
import CopyControlBar from '../components/CopyControlBar'
import ConsoleLogsModal from '../components/ConsoleLogsModal'
import {
  aiSolveUnansweredMcqs,
  applyAnswerKeyToBlocks,
  emptyMcqTemplate,
  generateAnswerKey,
  generateMcqBank,
  isMcqOptionLine,
  nextMcqNumber,
  structureExamText,
  stripInlineAnswerTags,
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

  const cleanedPages = b.pages.map((p) => ({
    ...p,
    blocks: p.blocks.map((blk) => {
      if (blk.type === 'mcq') {
        const extractedAns = (blk.answer || blk.text.match(/\[✓\s*([A-E])\]/i)?.[1] || '').toUpperCase()
        const cleanText = stripInlineAnswerTags(blk.text)
        return { ...blk, answer: extractedAns, text: cleanText }
      }
      return blk
    }),
  }))

  return {
    ...b,
    pages: cleanedPages,
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
      background: active ? '#F1F5F9' : 'transparent',
      color: active ? '#0F172A' : '#334155',
      border: active ? '1px solid #94A3B8' : '1px solid #CBD5E1',
    },
    primary: { background: '#0F172A', color: 'white', border: '1px solid #0F172A' },
    accent: { background: '#F8FAFC', color: '#0F172A', border: '1px solid #CBD5E1' },
    scan: {
      background: '#0F172A',
      color: 'white',
      border: '1px solid #0F172A',
    },
    docScan: {
      background: '#1E293B',
      color: 'white',
      border: '1px solid #1E293B',
    },
  }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-none font-medium disabled:opacity-40 whitespace-nowrap transition-colors hover:bg-slate-100 ${className}`}
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
  const [ocrStatusText, setOcrStatusText] = useState<string>('Processing document...')
  const [ocrFileName, setOcrFileName] = useState<string>('')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [zoom, setZoom] = useState(0.7)
  const [tips, setTips] = useState<string[]>([])
  const [showHfModal, setShowHfModal] = useState(false)
  const [showConsoleModal, setShowConsoleModal] = useState(false)
  const [isAnswerKeySelected, setIsAnswerKeySelected] = useState(false)
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null)
  const savedSelectionBlocksRef = useRef<string[]>([])
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  })

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
      const canvasEl = document.getElementById('active-page-canvas') || document.querySelector('.page-canvas.active')
      if (!canvasEl) return

      const range = selection.getRangeAt(0)
      const blockEls = canvasEl.querySelectorAll('[data-block-id]')
      const ids: string[] = []

      blockEls.forEach((el) => {
        const id = el.getAttribute('data-block-id')
        if (id) {
          try {
            if (selection.containsNode(el, true) || (range.intersectsNode && range.intersectsNode(el))) {
              ids.push(id)
            }
          } catch {
            /* ignore fallback */
          }
        }
      })

      if (ids.length > 0) {
        savedSelectionBlocksRef.current = ids
      } else if (selection.toString().trim().length > 15) {
        const allCanvasBlockIds = Array.from(blockEls)
          .map((el) => el.getAttribute('data-block-id'))
          .filter(Boolean) as string[]
        if (allCanvasBlockIds.length > 0) {
          savedSelectionBlocksRef.current = allCanvasBlockIds
        }
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [activePageId])

  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const activeEl = document.activeElement
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        const activeTa = activeEl as HTMLTextAreaElement | HTMLInputElement
        if (activeTa.selectionStart !== null && activeTa.selectionEnd !== null) {
          const selectedText = activeTa.value.substring(activeTa.selectionStart, activeTa.selectionEnd)
          if (selectedText) {
            const cleanText = stripInlineAnswerTags(selectedText)
            if (e.clipboardData) {
              e.clipboardData.setData('text/plain', cleanText)
              e.preventDefault()
            }
            return
          }
        }
      }

      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return

      const canvasEl = document.getElementById('active-page-canvas') || document.querySelector('.page-canvas.active')
      if (!canvasEl) return

      try {
        const range = selection.getRangeAt(0)
        const clonedFrag = range.cloneContents()
        const tempDiv = document.createElement('div')
        tempDiv.appendChild(clonedFrag)

        const removeSelectors = [
          '.floating-toolbar',
          '.formatting-bar',
          '.no-copy',
          '.select-none',
          'button',
          'select',
          'input',
          'textarea',
          '[data-no-copy]',
          '.document-header',
          '.document-footer',
        ]
        tempDiv.querySelectorAll(removeSelectors.join(',')).forEach((el) => el.remove())

        let cleanText = tempDiv.innerText || tempDiv.textContent || ''
        cleanText = stripInlineAnswerTags(cleanText)

        if (cleanText && e.clipboardData) {
          e.clipboardData.setData('text/plain', cleanText)
          e.preventDefault()
        }
      } catch {
        /* fallback to default copy */
      }
    }

    document.addEventListener('copy', handleCopy)
    return () => {
      document.removeEventListener('copy', handleCopy)
    }
  }, [])

  const handleToolbarDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = true
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: toolbarPos?.x || 0,
      initialY: toolbarPos?.y || 0,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      const deltaX = moveEvent.clientX - dragStartRef.current.startX
      const deltaY = moveEvent.clientY - dragStartRef.current.startY
      setToolbarPos({
        x: dragStartRef.current.initialX + deltaX,
        y: dragStartRef.current.initialY + deltaY,
      })
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const allMcqItems = useMemo(() => {
    const items: { blockId: string; num: string; answer: string }[] = []
    let seq = 0
    book.pages.forEach((p) => {
      p.blocks.forEach((b) => {
        if (b.type === 'mcq') {
          seq++
          const num = b.text.match(/^\s*(\d+)/)?.[1] || String(seq)
          const ans = (b.answer || b.text.match(/\[✓\s*([A-E])\]/i)?.[1] || '').toUpperCase()
          items.push({ blockId: b.id, num, answer: ans || '–' })
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

    const updatedText = stripInlineAnswerTags(targetBlock.text)

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const activeEl = document.activeElement
        const isInput = activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')
        if (!isInput) {
          // Intercept global Ctrl+A so it selects ONLY document body text, NOT website UI!
          e.preventDefault()
          const bodyNode = document.querySelector('#page-body-content') || document.querySelector('.page-body-container')
          if (bodyNode) {
            const range = document.createRange()
            range.selectNodeContents(bodyNode)
            const sel = window.getSelection()
            if (sel) {
              sel.removeAllRanges()
              sel.addRange(range)
            }
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
      list: '- List item',
      table: '| Column 1 | Column 2 |\n| --- | --- |\n| Cell A | Cell B |',
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

      const isSyllabus = book.bookMode === 'questions-only'
      const { page: alignedPage } = autoCorrectPage(activePage, startMcqNum, isSyllabus ? 'document' : 'qa')

      if (isSyllabus) {
        updatePage(activePage.id, () => alignedPage, {
          msg: `✓ Page ${activePage.number} auto-aligned & cleaned (${alignedPage.blocks.length} blocks)`,
        })
      } else {
        const { updatedBlocks, solvedCount } = await aiSolveUnansweredMcqs(alignedPage.blocks)
        const finalPage = { ...alignedPage, blocks: updatedBlocks }
        updatePage(activePage.id, () => finalPage, {
          msg: `✓ Page ${activePage.number} auto-aligned! (${finalPage.blocks.length} blocks · AI solved ${solvedCount} answers)`,
        })
      }
    } catch {
      showToast('Page auto-align failed')
    } finally {
      setBusy(false)
    }
  }

  const getSelectedBlockIds = (targetBlockId?: string): string[] => {
    if (!activePage) return []
    const blockIds = new Set<string>()

    const selection = window.getSelection()
    const canvasEl = document.getElementById('active-page-canvas') || document.querySelector('.page-canvas.active')
    const allCanvasBlockIds = canvasEl
      ? (Array.from(canvasEl.querySelectorAll('[data-block-id]'))
          .map((el) => el.getAttribute('data-block-id'))
          .filter(Boolean) as string[])
      : []

    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const selText = selection.toString().trim()
      const range = selection.getRangeAt(0)

      if (canvasEl) {
        const blockEls = canvasEl.querySelectorAll('[data-block-id]')
        blockEls.forEach((el) => {
          const id = el.getAttribute('data-block-id')
          if (id) {
            try {
              if (selection.containsNode(el, true) || (range.intersectsNode && range.intersectsNode(el))) {
                blockIds.add(id)
              }
            } catch {
              /* ignore fallback */
            }
          }
        })
      }

      // Select-All fallback: if selection text covers most or all canvas blocks
      if (blockIds.size === 0 || selText.length > 50) {
        if (allCanvasBlockIds.length > 0) {
          allCanvasBlockIds.forEach((id) => blockIds.add(id))
        }
      }
    }

    // Fall back to savedSelectionBlocksRef if active selection was cleared by click
    if (blockIds.size === 0 && savedSelectionBlocksRef.current.length > 0) {
      savedSelectionBlocksRef.current.forEach((id) => blockIds.add(id))
    }

    if (targetBlockId && !blockIds.has(targetBlockId)) {
      blockIds.add(targetBlockId)
    }
    if (blockIds.size === 0 && selectedBlockId) {
      blockIds.add(selectedBlockId)
    }

    return Array.from(blockIds)
  }

  const setBatchFontSize = (newSize: number, targetBlockId?: string) => {
    if (!activePage) return
    const ids = getSelectedBlockIds(targetBlockId)
    if (ids.length === 0) return

    const nextPages = book.pages.map((p) => {
      if (p.id !== activePage.id) return p
      return {
        ...p,
        blocks: p.blocks.map((b) => (ids.includes(b.id) ? { ...b, fontSize: newSize } : b)),
      }
    })
    commit({ ...book, pages: nextPages }, `Updated font size to ${newSize}pt for ${ids.length} block(s)`)
  }

  const adjustSelectedFontSize = (delta: number, targetBlockId?: string) => {
    if (!activePage) return
    const ids = getSelectedBlockIds(targetBlockId)
    if (ids.length === 0) return

    const nextPages = book.pages.map((p) => {
      if (p.id !== activePage.id) return p
      return {
        ...p,
        blocks: p.blocks.map((b) => {
          if (!ids.includes(b.id)) return b
          const defaultSize = b.type === 'heading1' ? 22 : b.type === 'heading2' ? 16 : b.type === 'heading3' ? 14 : 13.5
          const cur = b.fontSize || defaultSize
          const next = Math.max(8, Math.min(64, Math.round(cur + delta)))
          return { ...b, fontSize: next }
        }),
      }
    })
    commit({ ...book, pages: nextPages }, `Adjusted font size for ${ids.length} block(s)`)
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

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    if (!activePage) return
    const blocks = [...activePage.blocks]
    const idx = blocks.findIndex((b) => b.id === blockId)
    if (idx < 0) return

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= blocks.length) return

    const temp = blocks[idx]
    blocks[idx] = blocks[targetIdx]
    blocks[targetIdx] = temp

    updatePage(activePage.id, (p) => ({ ...p, blocks }), {
      msg: `Moved block ${direction === 'up' ? 'up ▲' : 'down ▼'}`,
    })
  }

  const deleteBlock = (blockId: string) => {
    if (!activePage) return
    const nextBlocks = activePage.blocks.filter((b) => b.id !== blockId)
    updatePage(activePage.id, (p) => ({ ...p, blocks: nextBlocks }), {
      msg: 'Deleted block',
    })
    setSelectedBlockId(null)
    showToast('Block deleted')
  }

  const fitContentToPage = (pageId?: string) => {
    const targetPage = pageId ? book.pages.find((p) => p.id === pageId) : activePage
    if (!targetPage) return

    const canvasEl = document.getElementById('active-page-canvas') || document.querySelector('.page-canvas.active')

    if (canvasEl) {
      const scrollH = canvasEl.scrollHeight
      const clientH = canvasEl.clientHeight

      // Check if page content fills less than 82% of canvas height
      if (scrollH < clientH * 0.82) {
        const updatedBlocks = targetPage.blocks.map((b) => {
          const defaultSize = b.type === 'heading1' ? 22 : b.type === 'heading2' ? 16 : b.type === 'heading3' ? 14 : 13.5
          const curSize = b.fontSize || defaultSize
          const nextSize = Math.min(24, Math.round(curSize * 1.1))
          return { ...b, fontSize: nextSize }
        })

        const nextPages = book.pages.map((p) => (p.id === targetPage.id ? { ...p, blocks: updatedBlocks } : p))
        commit({ ...book, pages: nextPages }, `✨ Auto-fit vertical page layout for Page ${targetPage.number}`)
        showToast(`✨ Scaled line spacing and font size to fill Page ${targetPage.number}`)
        return
      }
    }

    const { book: reflowedBook, blocksShifted } = reflowBookOverflow(book)
    commit(reflowedBook, blocksShifted > 0 ? `Reflowed ${blocksShifted} block(s) across pages` : `Page layout optimized`)
    showToast(blocksShifted > 0 ? `✨ Shifted ${blocksShifted} overflowing block(s) to next page` : `✨ Page layout already optimal!`)
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
    const isSyllabus = book.bookMode === 'questions-only'
    setBusy(true)
    setOcrFileName(file.name)
    setOcrStatusText('Scanning image with ChatGPT Vision (gpt-4o)...')
    setOcrPct(10)
    try {
      const result = await ocrImageToBlocks(
        file,
        (p) => {
          const pct = Math.round(p.progress * 65)
          setOcrPct(pct)
          if (pct > 25) setOcrStatusText(isSyllabus ? 'Extracting headings, lists, tables & formulas...' : 'Extracting questions, Tamil text & math formulas...')
        },
        { mode: isSyllabus ? 'document' : 'qa' },
      )
      setOcrPct(75)

      // Case A: the scanned image is an ANSWER KEY grid — apply it across the whole book.
      if (!isSyllabus && result.answerKey && Object.keys(result.answerKey).length > 0) {
        const key = result.answerKey
        let applied = 0
        const nextPages = book.pages.map((pg) => {
          const r = applyAnswerKeyToBlocks(pg.blocks, key)
          applied += r.applied
          return { ...pg, blocks: r.blocks }
        })
        setOcrPct(100)
        commit({ ...book, pages: nextPages }, `Applied ${applied} answers from the scanned answer key`)
        return
      }

      let outBlocks = result.blocks
      let solvedCount = 0
      if (!isSyllabus) {
        const unanswered = outBlocks.filter((b) => b.type === 'mcq' && !b.answer).length
        if (unanswered > 0) {
          setOcrStatusText('AI solving unanswered questions…')
          const solved = await aiSolveUnansweredMcqs(result.blocks)
          outBlocks = solved.updatedBlocks
          solvedCount = solved.solvedCount
        }
      }
      // Header badge from the scanned page header.
      const cm = result.chapterMeta
      if (isSyllabus && cm && !cm.title && outBlocks[0]?.type === 'heading1') {
        cm.title = outBlocks[0].text
        outBlocks = outBlocks.slice(1)
      }
      const nextHf = { ...book.headerFooter }
      if (cm?.title) {
        nextHf.chapterTitle = cm.title
        nextHf.middleRightText = cm.title
        if (!book.headerFooter.headerLeft || book.headerFooter.headerLeft === book.title) nextHf.headerLeft = cm.title
      }
      if (cm?.number) nextHf.chapterNumber = cm.number

      setOcrPct(95)
      setOcrStatusText('Finalizing page layout...')

      const finalBlocks = [...activePage.blocks.filter((b) => b.text.trim() || b.imageUrl), ...outBlocks]
      commit(
        {
          ...book,
          headerFooter: nextHf,
          pages: book.pages.map((p) => (p.id === activePage.id ? { ...p, blocks: finalBlocks } : p)),
        },
        isSyllabus
          ? `Scanned ${outBlocks.length} blocks (headings, lists & tables preserved)`
          : result.mcqCount > 0
            ? `Scanned ${result.mcqCount} questions${solvedCount ? ` · AI solved ${solvedCount}` : ''}`
            : `Scanned ${result.blocks.length} blocks`,
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
    setOcrFileName(file.name)
    setOcrStatusText('Reading document & rendering page images...')
    setOcrPct(10)

    const isSyllabus = book.bookMode === 'questions-only'

    try {
      const slideTexts = await parseMultiPageDocument(
        file,
        (info) => {
          setOcrStatusText(info.status)
          setOcrPct(Math.round(info.progress * 100))
        },
        { mode: isSyllabus ? 'document' : 'qa' },
      )

      const totalPages = slideTexts.length
      setOcrPct(85)
      setOcrStatusText(
        isSyllabus
          ? `Found ${totalPages} page(s). Structuring headings, paragraphs, lists & tables...`
          : `Found ${totalPages} page(s). Structuring MCQs & solving answers...`,
      )

      // 1. Structure each page (never AI-solve yet — the doc's own answer key wins).
      const contentPages: ContentBlock[][] = []
      const scannedKey: Record<number, string> = {}
      const chapterMeta: { title?: string; number?: string } = {}

      for (let i = 0; i < slideTexts.length; i++) {
        const stepPct = Math.min(94, 85 + Math.round(((i + 1) / slideTexts.length) * 9))
        setOcrPct(stepPct)
        setOcrStatusText(
          isSyllabus
            ? `Page ${i + 1} of ${totalPages}: Rebuilding page layout…`
            : `Page ${i + 1} of ${totalPages}: Structuring questions…`,
        )

        const { meta, text: slideText } = extractChapterMeta(slideTexts[i])
        if (meta.title && !chapterMeta.title) chapterMeta.title = meta.title
        if (meta.number && !chapterMeta.number) chapterMeta.number = meta.number

        if (isSyllabus) {
          contentPages.push(structureDocumentText(slideText))
          continue
        }
        const structured = structureExamText(slideText)
        if (structured.answerKey && Object.keys(structured.answerKey).length > 0) {
          Object.assign(scannedKey, structured.answerKey)
        }
        if (structured.blocks.length > 0) contentPages.push(structured.blocks)
      }

      // Syllabus: the leading "# Chapter Title" belongs in the header badge, not the body.
      if (isSyllabus && contentPages[0]?.[0]?.type === 'heading1') {
        if (!chapterMeta.title) chapterMeta.title = contentPages[0][0].text
        contentPages[0] = contentPages[0].slice(1)
      }

      // 2. Question Bank: apply the scanned answer key, then AI-solve only the leftovers.
      let totalSolvedCount = 0
      let appliedFromKey = 0
      if (!isSyllabus) {
        const hasKey = Object.keys(scannedKey).length > 0
        for (let p = 0; p < contentPages.length; p++) {
          if (hasKey) {
            const { blocks, applied } = applyAnswerKeyToBlocks(contentPages[p], scannedKey)
            contentPages[p] = blocks
            appliedFromKey += applied
          } else {
            setOcrStatusText(`Page ${p + 1}: AI solving question answers…`)
            const solved = await aiSolveUnansweredMcqs(contentPages[p])
            contentPages[p] = solved.updatedBlocks
            totalSolvedCount += solved.solvedCount
          }
        }
      }

      const totalBlocksCount = contentPages.reduce((n, pg) => n + pg.length, 0)
      const nonEmpty = contentPages.filter((pg) => pg.length > 0)
      if (nonEmpty.length === 0) {
        showToast('Doc Scan: nothing readable was extracted from this file')
        return
      }

      // 3. Build the whole pages array in ONE commit (avoids losing page 1 on multi-page docs).
      const isFreshBook =
        book.pages.length === 1 &&
        activePage.blocks.every((b) => !b.text.trim() || b.type === 'heading1' || b.type === 'paragraph')

      const basePages: BookPage[] = [...book.pages]
      const firstBlocks = isFreshBook
        ? nonEmpty[0]
        : [...activePage.blocks.filter((b) => b.text.trim() || b.imageUrl), ...nonEmpty[0]]
      basePages[activeIndex] = { ...activePage, blocks: firstBlocks.length ? firstBlocks : activePage.blocks }

      nonEmpty.slice(1).forEach((blocks, i) => {
        basePages.splice(activeIndex + 1 + i, 0, { id: uid('pg'), number: 0, blocks })
      })
      const renumbered = basePages.map((p, i) => ({ ...p, number: i + 1 }))

      // Fill the header badge / running title from the real document.
      const nextHeaderFooter = { ...book.headerFooter }
      if (chapterMeta.title) {
        nextHeaderFooter.chapterTitle = chapterMeta.title
        nextHeaderFooter.middleRightText = chapterMeta.title
        if (!book.headerFooter.headerLeft || book.headerFooter.headerLeft === book.title) {
          nextHeaderFooter.headerLeft = chapterMeta.title
        }
      }
      if (chapterMeta.number) nextHeaderFooter.chapterNumber = chapterMeta.number

      setOcrPct(100)
      setOcrStatusText('Document processing complete!')
      const suffix = isSyllabus
        ? ''
        : appliedFromKey > 0
          ? ` · ${appliedFromKey} answers from the answer key`
          : totalSolvedCount > 0
            ? ` · AI solved ${totalSolvedCount} answers`
            : ''
      commit(
        {
          ...book,
          title: isFreshBook && chapterMeta.title ? chapterMeta.title : book.title,
          headerFooter: nextHeaderFooter,
          pages: renumbered,
        },
        `Extracted ${nonEmpty.length} page(s) · ${totalBlocksCount} blocks${suffix}`,
      )
      showToast(`Doc Scan: ${nonEmpty.length} page(s) from ${file.name}${chapterMeta.number ? ` — Chapter ${chapterMeta.number}` : ''}`)
    } catch {
      showToast('Doc Scan: Could not parse document file')
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
    if (book.bookMode === 'questions-only') {
      const raw = window.prompt('Paste study material / chapter text')
      if (!raw?.trim()) return
      const blocks = structureDocumentText(raw)
      addBlocks(blocks, `${blocks.length} blocks added`)
      return
    }
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
      const activeEl = document.activeElement
      const activeTag = (activeEl?.tagName || '').toLowerCase()
      const isModalOpen = Boolean(document.querySelector('.fixed.z-\\[60\\], .fixed.z-\\[70\\], .fixed.z-\\[100\\]'))
      if (isModalOpen) return

      const isEditingText = activeTag === 'textarea' || activeTag === 'input' || activeEl?.getAttribute('contenteditable') === 'true'
      const meta = e.metaKey || e.ctrlKey

      // 1. Ctrl+A / Cmd+A Select All
      if (meta && e.key.toLowerCase() === 'a') {
        if (isEditingText) {
          // Native Ctrl+A inside input/textarea works naturally
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
        if (activePage) {
          savedSelectionBlocksRef.current = activePage.blocks.map((b) => b.id)
        }
        return
      }

      // 2. Backspace or Delete Key Handling
      if (!meta && (e.key === 'Backspace' || e.key === 'Delete')) {
        const curPage = bookRef.current.pages.find((p) => p.id === activePageId)
        if (!curPage) return

        if (isEditingText) {
          const targetInput = activeEl as HTMLInputElement | HTMLTextAreaElement
          const isAllTextSelected =
            targetInput.selectionStart === 0 &&
            targetInput.selectionEnd === targetInput.value.length &&
            targetInput.value.length > 0
          const isEmpty = targetInput.value.trim() === ''

          if (isAllTextSelected || isEmpty) {
            const blockEl = targetInput.closest('[data-block-id]')
            const bId = blockEl?.getAttribute('data-block-id')
            if (bId) {
              e.preventDefault()
              if (curPage.blocks.length > 1) {
                deleteBlock(bId)
              } else {
                updateBlock(bId, { text: '' })
              }
              showToast('Deleted block')
            }
          }
          return
        }

        // Deletion outside focused input (selection on page canvas or block cards)
        const selection = window.getSelection()
        const selText = selection ? selection.toString().trim() : ''
        const targetBlockIds = getSelectedBlockIds()

        if (targetBlockIds.length > 0 || selText.length > 0 || savedSelectionBlocksRef.current.length > 0) {
          e.preventDefault()
          const deleteSet = new Set(targetBlockIds.length > 0 ? targetBlockIds : savedSelectionBlocksRef.current)
          const remaining = curPage.blocks.filter((b) => !deleteSet.has(b.id))
          const finalBlocks: ContentBlock[] =
            remaining.length > 0
              ? remaining
              : [{ id: uid('blk'), type: 'paragraph', text: '', align: 'justify' }]

          updatePage(
            curPage.id,
            (p) => ({ ...p, blocks: finalBlocks }),
            { msg: `Deleted ${deleteSet.size} block(s)` }
          )

          savedSelectionBlocksRef.current = []
          setSelectedBlockId(null)
          if (selection) selection.removeAllRanges()
          showToast('Deleted selected content')
        }
        return
      }

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
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activePageId, activePage, undo, redo, showToast])

  const onBlockKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>, block: ContentBlock) => {
    if (e.key === 'Enter' && !e.shiftKey && block.type.startsWith('heading')) {
      e.preventDefault()
      addBlock('paragraph')
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const target = e.currentTarget
      const isAllSelected =
        target.selectionStart === 0 &&
        target.selectionEnd === target.value.length &&
        target.value.length > 0
      const isEmpty = target.value.trim() === ''

      if (isAllSelected || isEmpty) {
        e.preventDefault()
        if (activePage && activePage.blocks.length > 1) {
          deleteBlock(block.id)
        } else {
          updateBlock(block.id, { text: '' })
        }
        showToast('Deleted block')
      }
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

      {/* Top Header Bar */}
      <div className="h-10 flex-shrink-0 flex items-center gap-2 px-3 bg-slate-900 border-b border-slate-800">
        <button onClick={onClose} className="px-2.5 py-1 rounded-none text-[12px] font-semibold text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors">
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
          className="flex-1 max-w-[280px] bg-transparent text-white text-[13px] font-semibold outline-none truncate px-2 border-b border-transparent focus:border-slate-600 transition-all"
        />
        {/* Mode Badge Tag */}
        <span className="text-[10.5px] font-extrabold uppercase px-2.5 py-0.5 rounded-none bg-slate-800 text-slate-300 border border-slate-700 tracking-wider">
          {book.bookMode === 'questions-only' ? 'Syllabus Mode' : 'Question Bank Mode'}
        </span>

        <span className="text-[11px] text-slate-400 hidden md:inline ml-auto">
          {busy ? (ocrPct != null ? `Scanning ${ocrPct}%` : 'Working…') : 'Saved'}
        </span>

        <button
          type="button"
          onClick={() => setShowConsoleModal(true)}
          className="px-2.5 py-1 rounded-none text-[11.5px] font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-all"
          title="Open AI Debug Console"
        >
          <span className="w-1.5 h-1.5 bg-emerald-400" />
          AI Logs
        </button>

        <button
          type="button"
          onClick={() => setShowHfModal(true)}
          className="px-2.5 py-1 rounded-none text-[11.5px] font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-all"
          title="Open Header, Footer & Watermark Settings"
        >
          Header &amp; Watermark
        </button>

        <button
          type="button"
          onClick={() => exportBookPrintable(book)}
          className="px-3.5 py-1 rounded-none text-[12px] font-bold text-slate-900 bg-white hover:bg-slate-100 border border-white transition-all shadow-xs"
        >
          Print / PDF
        </button>
      </div>

      {/* SINGLE SLEEK UNIFIED CONTROL TOOLBAR (MS Word Ribbon Box Style) */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-3.5 py-2 flex-wrap gap-2 bg-slate-100 border-b border-slate-300 shadow-xs"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1. Undo / Redo & AI Smart Ingestion */}
          <div className="flex items-center gap-1">
            {/* Undo / Redo Buttons (Sharp Box Style) */}
            <div className="flex items-center border border-slate-300 bg-white">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="p-1 rounded-none text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors border-r border-slate-300"
                title="Undo (Ctrl+Z)"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="p-1 rounded-none text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={() => fileDocRef.current?.click()}
              disabled={busy}
              className="px-3 py-1 rounded-none text-[11.5px] font-bold text-white bg-slate-900 hover:bg-slate-800 border border-slate-900 transition-all shadow-xs"
              title="Scan PDF or Document file"
            >
              Doc Scan
            </button>
            <button
              type="button"
              onClick={() => fileOcrRef.current?.click()}
              disabled={busy}
              className="px-3 py-1 rounded-none text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition-colors"
              title="Scan image photo with OCR"
            >
              Image Scan
            </button>
            <button
              type="button"
              onClick={pastePaper}
              className="px-2.5 py-1 rounded-none text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition-colors"
              title="Paste raw text or question paper"
            >
              Smart Paste
            </button>
            {book.bookMode !== 'questions-only' ? (
              <button
                type="button"
                onClick={handleAiSolveAnswers}
                disabled={busy}
                className="px-3 py-1 rounded-none font-bold text-[11.5px] text-white bg-slate-800 hover:bg-slate-700 transition-all shadow-xs border border-slate-700 disabled:opacity-50"
                title="AI solves answers & auto-generates Answer Key"
              >
                AI Solve Answers
              </button>
            ) : (
              <button
                type="button"
                onClick={() => autoCorrectBook(book)}
                disabled={busy}
                className="px-3 py-1 rounded-none font-bold text-[11.5px] text-white bg-slate-800 hover:bg-slate-700 transition-all shadow-xs border border-slate-700 disabled:opacity-50"
                title="Auto-correct typos, letter spaces and formatting"
              >
                Auto-Fix &amp; Format
              </button>
            )}
          </div>

          <Sep />

          {/* 2. Layout Columns & Paper Size */}
          <div className="flex items-center gap-1.5">
            <div className="flex border border-slate-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => commit({ ...book, headerFooter: { ...book.headerFooter, layoutColumns: 1 } }, '1 Column Layout')}
                className={`px-2.5 py-0.5 text-[11px] font-bold transition-all rounded-none ${
                  book.headerFooter.layoutColumns === 1
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                1 Col
              </button>
              <button
                type="button"
                onClick={() => commit({ ...book, headerFooter: { ...book.headerFooter, layoutColumns: 2 } }, '2 Columns Layout')}
                className={`px-2.5 py-0.5 text-[11px] font-bold transition-all rounded-none ${
                  book.headerFooter.layoutColumns === 2
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                2 Col
              </button>
            </div>

            <div className="flex border border-slate-300 bg-white p-0.5">
              {(['A4', 'B5', '8×8'] as PaperSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => commit({ ...book, paperSize: s }, `Size updated to ${s}`)}
                  className={`px-2 py-0.5 text-[11px] font-bold transition-all rounded-none ${
                    book.paperSize === s
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Sep />

          {/* 3. Content Additions (Mode-Specific) */}
          <div className="flex items-center gap-1">
            {book.bookMode === 'questions-only' ? (
              <>
                <Btn onClick={insertTopic} className="px-2.5 py-1 text-[11.5px] font-bold text-slate-800" title="Insert Chapter / Topic">
                  + Topic
                </Btn>
                <Btn onClick={() => addBlock('heading2')} className="px-2.5 py-1 text-[11.5px]" title="Insert 1.1 Sub-heading">
                  + Sub-topic (1.1)
                </Btn>
                <Btn onClick={() => addBlock('paragraph')} className="px-2.5 py-1 text-[11.5px]" title="Insert Paragraph">
                  + Paragraph
                </Btn>
                <Btn onClick={() => addBlock('list')} className="px-2.5 py-1 text-[11.5px]" title="Insert Bullet List">
                  + List
                </Btn>
                <Btn onClick={() => addBlock('table')} className="px-2.5 py-1 text-[11.5px]" title="Insert Table">
                  + Table
                </Btn>
                <Btn onClick={() => addBlock('math')} className="px-2.5 py-1 text-[11.5px]" title="Insert Math Formula">
                  + Math
                </Btn>
              </>
            ) : (
              <>
                <Btn onClick={() => addBlock('mcq')} className="px-2.5 py-1 text-[11.5px] font-bold text-slate-800" title="Insert MCQ Question">
                  + MCQ Question
                </Btn>
                <Btn onClick={() => addBlock('heading1')} className="px-2.5 py-1 text-[11.5px]" title="Insert Topic Header">
                  + Topic
                </Btn>
                <Btn onClick={() => addBlock('math')} className="px-2.5 py-1 text-[11.5px]" title="Insert Math Formula">
                  + Math
                </Btn>
              </>
            )}
            <Btn onClick={addPage} className="px-2.5 py-1 text-[11.5px]" title="Add new blank page">
              + Page
            </Btn>
          </div>
        </div>

        {/* Right Utility Group */}
        <div className="flex items-center gap-2">
          {/* Copy Dropdown */}
          <CopyControlBar book={book} activePage={activePage} activePageRef={activePageRef} bodyContentRef={bodyContentRef} onNotify={showToast} />

          {/* Align & Compile */}
          <button
            type="button"
            onClick={runAlign}
            disabled={busy}
            className="px-2.5 py-1 rounded-none text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition-colors"
            title="Auto-align line spacing and reflow overflow text"
          >
            Align
          </button>

          <button
            type="button"
            onClick={runCompile}
            disabled={busy}
            className="px-3 py-1 rounded-none text-[11.5px] font-bold text-white bg-slate-900 hover:bg-slate-800 border border-slate-900 transition-colors shadow-xs"
            title="Compile book & validate layout structure"
          >
            Compile
          </button>
        </div>
      </div>

      {/* Professional OCR & Document Ingestion Progress Modal Overlay */}
      {ocrPct != null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-fade-in select-none">
          <div className="w-[440px] max-w-[92vw] bg-white border border-slate-300 shadow-2xl p-6 rounded-none space-y-4 animate-scale-in">
            {/* Top Bar with Animated Spinner and Percentage */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-none bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-bold text-slate-900 leading-tight">
                    AI Document Scanning & Processing
                  </h3>
                  {ocrFileName && (
                    <p className="text-[11.5px] font-semibold text-slate-500 truncate max-w-[240px] mt-0.5">
                      {ocrFileName}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-[22px] font-extrabold text-slate-900 font-mono tracking-tight ml-2">
                {ocrPct}%
              </div>
            </div>

            {/* High Contrast Progress Bar */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-100 border border-slate-300 p-0.5 overflow-hidden">
                <div
                  className="h-full bg-slate-900 transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(4, ocrPct)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11.5px] font-medium text-slate-700">
                <span className="truncate max-w-[300px]">{ocrStatusText}</span>
                <span className="font-mono text-slate-500 font-bold">{ocrPct} / 100</span>
              </div>
            </div>
          </div>
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
                    className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden"
                    style={{
                      opacity: book.headerFooter.watermarkOpacity ?? 0.12,
                    }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 340 * zoom,
                        height: 340 * zoom,
                        transform: `scale(${book.headerFooter.watermarkScale ?? 0.85})`,
                        transformOrigin: 'center center',
                      }}
                    >
                      {book.headerFooter.watermarkImage ? (
                        <img src={book.headerFooter.watermarkImage} alt="watermark" className="max-w-full max-h-full object-contain mx-auto my-auto" />
                      ) : (
                        <img src="/logo.jpeg" alt="watermark" className="max-w-full max-h-full object-contain mx-auto my-auto" />
                      )}
                    </div>
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
                    className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden"
                    style={{
                      opacity: book.headerFooter.watermarkOpacity ?? 0.12,
                    }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 340 * zoom,
                        height: 340 * zoom,
                        transform: `scale(${book.headerFooter.watermarkScale ?? 0.85})`,
                        transformOrigin: 'center center',
                      }}
                    >
                      {book.headerFooter.watermarkImage ? (
                        <img src={book.headerFooter.watermarkImage} alt="watermark" className="max-w-full max-h-full object-contain mx-auto my-auto" />
                      ) : (
                        <img src="/logo.jpeg" alt="watermark" className="max-w-full max-h-full object-contain mx-auto my-auto" />
                      )}
                    </div>
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
                      const currentHeight = block.fontSize || 280
                      const size = currentHeight * zoom
                      const alignment = block.align || 'center'
                      const alignClass = alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center'
                      const imgMarginClass = alignment === 'left' ? 'mr-auto' : alignment === 'right' ? 'ml-auto' : 'mx-auto'

                      return (
                        <div
                          key={block.id}
                          data-block-id={block.id}
                          onClick={() => setSelectedBlockId(block.id)}
                          className={`relative break-inside-avoid my-2.5 transition-all ${alignClass}`}
                          style={{ outline: isSel ? '2px dashed #0E7490' : undefined, outlineOffset: '4px' }}
                        >
                          {isSel && (
                            <div
                              data-no-copy="true"
                              className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-md bg-white text-slate-800 shadow-sm text-[11px] flex-wrap border border-slate-300 select-none no-copy"
                              style={{
                                width: 'fit-content',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                margin: alignment === 'left' ? '0 auto 8px 0' : alignment === 'right' ? '0 0 8px auto' : '0 auto 8px auto',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="font-bold text-teal-700 text-[10px] uppercase tracking-wider">🖼 Image</span>
                              <div className="h-3 w-[1px] bg-slate-300 mx-0.5" />

                              {/* Alignment Controls */}
                              <span className="text-slate-500 font-medium text-[10px]">Align:</span>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => updateBlock(block.id, { align: 'left' })}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${alignment === 'left' ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}`}
                                title="Align image to Left"
                              >
                                Left
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => updateBlock(block.id, { align: 'center' })}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${alignment === 'center' ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}`}
                                title="Center align image"
                              >
                                Center
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => updateBlock(block.id, { align: 'right' })}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${alignment === 'right' ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}`}
                                title="Align image to Right"
                              >
                                Right
                              </button>

                              <div className="h-3 w-[1px] bg-slate-300 mx-0.5" />

                              {/* Size / Height Steppers */}
                              <span className="text-slate-500 font-medium text-[10px]">Size:</span>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => updateBlock(block.id, { fontSize: Math.max(60, currentHeight - 30) })}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center leading-none text-[12px] border border-slate-300 transition-colors"
                                title="Decrease image size (-30px)"
                              >
                                −
                              </button>
                              <select
                                value={currentHeight}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => updateBlock(block.id, { fontSize: Number(e.target.value) })}
                                className="px-1.5 py-0.5 rounded bg-white text-slate-800 font-semibold outline-none border border-slate-300 text-[11px] cursor-pointer"
                              >
                                {[100, 140, 180, 220, 280, 340, 400, 480, 560].map((h) => (
                                  <option key={h} value={h}>
                                    {h}px
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => updateBlock(block.id, { fontSize: Math.min(600, currentHeight + 30) })}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center leading-none text-[12px] border border-slate-300 transition-colors"
                                title="Increase image size (+30px)"
                              >
                                +
                              </button>

                              <div className="h-3 w-[1px] bg-slate-300 mx-0.5" />

                              {/* Move Up / Move Down */}
                              <span className="text-slate-500 font-medium text-[10px]">Position:</span>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => moveBlock(block.id, 'up')}
                                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] border border-slate-300 transition-colors flex items-center gap-0.5"
                                title="Move image block up ▲"
                              >
                                ▲ Up
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => moveBlock(block.id, 'down')}
                                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] border border-slate-300 transition-colors flex items-center gap-0.5"
                                title="Move image block down ▼"
                              >
                                ▼ Down
                              </button>

                              <div className="h-3 w-[1px] bg-slate-300 mx-0.5" />

                              {/* Delete Button */}
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => deleteBlock(block.id)}
                                className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] border border-rose-300 transition-colors flex items-center gap-1"
                                title="Delete image block"
                              >
                                🗑 Delete
                              </button>
                            </div>
                          )}

                          {block.imageUrl && (
                            <div className={`relative inline-block max-w-full ${imgMarginClass}`}>
                              <img
                                src={block.imageUrl}
                                alt={block.imageAlt || 'document image'}
                                className="max-w-full rounded shadow-sm transition-all"
                                style={{ maxHeight: size }}
                              />
                            </div>
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
                        data-block-id={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        className={`relative break-inside-avoid transition-all max-w-full group/blk ${
                          block.type === 'mcq' ? 'my-2' : 'my-1.5'
                        }`}
                        style={{
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        {isSel ? (
                          <>
                            <button
                              type="button"
                              data-no-copy="true"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteBlock(block.id)
                              }}
                              className="no-copy select-none absolute -top-2 -right-2 z-30 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center justify-center shadow opacity-0 group-hover/blk:opacity-100 transition-opacity"
                              title="Delete this block"
                            >
                              ×
                            </button>
                            <textarea
                              value={block.type === 'mcq' ? stripInlineAnswerTags(block.text) : block.text}
                              onChange={(e) => {
                                if (block.type === 'mcq') {
                                  const textVal = e.target.value
                                  const extracted = textVal.match(/\[✓\s*([A-E])\]/i)?.[1]
                                  const cleanVal = stripInlineAnswerTags(textVal)
                                  const patch: Partial<ContentBlock> = { text: cleanVal }
                                  if (extracted) patch.answer = extracted.toUpperCase()
                                  updateBlock(block.id, patch, true)
                                } else {
                                  updateBlock(block.id, { text: e.target.value }, true)
                                }
                              }}
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
                                lineHeight: 1.2,
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                maxWidth: '100%',
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
                              lineHeight: 1.2,
                              userSelect: 'text',
                              WebkitUserSelect: 'text',
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              maxWidth: '100%',
                            }}
                            title="Click or double-click to edit block"
                            onDoubleClick={() => setSelectedBlockId(block.id)}
                          >
                            {block.text ? (
                              block.type === 'table' ? (
                                (() => {
                                  const { header, rows } = parseMarkdownTable(block.text)
                                  if (header.length === 0) return <span>{block.text}</span>
                                  return (
                                    <div className="my-2 overflow-x-auto">
                                      <table className="border-collapse w-full" style={{ fontSize: '0.92em' }}>
                                        <thead>
                                          <tr>
                                            {header.map((h, hi) => (
                                              <th
                                                key={hi}
                                                className="border border-slate-400 bg-slate-200 text-black font-bold px-2 py-1 text-left align-top"
                                                dangerouslySetInnerHTML={{ __html: renderTextWithMath(h) }}
                                              />
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rows.map((r, ri) => (
                                            <tr key={ri}>
                                              {header.map((_, ci) => (
                                                <td
                                                  key={ci}
                                                  className="border border-slate-400 px-2 py-1 align-top"
                                                  dangerouslySetInnerHTML={{ __html: renderTextWithMath(r[ci] ?? '') }}
                                                />
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )
                                })()
                              ) : block.type === 'list' ? (
                                <div className="my-1.5 space-y-0.5">
                                  {block.text.split('\n').map((line, li) => {
                                    const t = line.trim()
                                    if (!t) return null
                                    const m = t.match(/^([-•]|\(?[a-zA-Z]\)|[a-zA-Z][.)]|\(?(?:i{1,3}|iv|v|vi{1,3}|ix|x)\)|(?:i{1,3}|iv|v|vi{1,3}|ix|x)[.)]|\d{1,2}[.)])\s+(.*)$/i)
                                    const marker = m ? (m[1] === '-' ? '•' : m[1]) : '•'
                                    const body = m ? m[2] : t
                                    return (
                                      <div key={li} className="flex gap-1.5" style={{ lineHeight: 1.25 }}>
                                        <span className="shrink-0 text-slate-500 font-semibold">{marker}</span>
                                        <span dangerouslySetInnerHTML={{ __html: renderTextWithMath(body) }} />
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : block.type === 'heading2' ? (
                                (() => {
                                  const secM = block.text.match(/^\s*(\d+(\.\d+)*)\.?\s+(.+)$/)
                                  const secNum = secM ? secM[1] : ''
                                  const secTitle = secM ? secM[3] : block.text
                                  return (
                                    <div className="flex items-stretch my-2 group/sec relative">
                                      {secNum ? (
                                        <div className="bg-black text-white font-extrabold px-2.5 py-1 text-[11px] rounded-l flex items-center shrink-0 font-sans">
                                          {secNum}
                                        </div>
                                      ) : null}
                                      <div
                                        className={`bg-gray-200 text-black font-bold px-3 py-1 text-[12px] ${secNum ? 'rounded-r' : 'rounded'} flex-1 flex items-center justify-between gap-2 pr-2`}
                                        style={{ fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1.2 }}
                                      >
                                        <span dangerouslySetInnerHTML={{ __html: renderTextWithMath(secTitle) }} />
                                        <button
                                          type="button"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            deleteBlock(block.id)
                                          }}
                                          className="opacity-70 group-hover/sec:opacity-100 hover:opacity-100 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1 cursor-pointer transition-all shrink-0"
                                          title="Click to remove this Section column/pill"
                                        >
                                          🗑 Remove
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })()
                              ) : block.type === 'heading3' ? (
                                (() => {
                                  const secM = block.text.match(/^\s*(\d+(\.\d+)+)\.?\s+(.+)$/)
                                  const secNum = secM ? secM[1] : ''
                                  const secTitle = secM ? secM[3] : block.text
                                  return (
                                    <div className="flex items-center justify-between border-b-2 border-black pb-0.5 my-2 group/subsec relative">
                                      <div className="flex items-center">
                                        {secNum && <span className="font-extrabold text-[11px] text-black mr-2 font-sans">{secNum}</span>}
                                        <span
                                          className="font-bold text-[11px] text-black"
                                          style={{ fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1.2 }}
                                          dangerouslySetInnerHTML={{ __html: renderTextWithMath(secTitle) }}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          deleteBlock(block.id)
                                        }}
                                        className="opacity-70 group-hover/subsec:opacity-100 hover:opacity-100 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5 cursor-pointer transition-all ml-2"
                                        title="Remove Subsection"
                                      >
                                        🗑 Remove
                                      </button>
                                    </div>
                                  )
                                })()
                              ) : block.type === 'mcq' ? (
                                <div className="space-y-0.5" style={{ lineHeight: 1.2 }}>
                                  {(() => {
                                    const rawLines = block.text.split('\n')
                                    let optStarted = false
                                    return rawLines.map((line, i) => {
                                      const cleanLine = stripInlineAnswerTags(line)
                                      if (!cleanLine) return null
                                      if (i > 0 && !optStarted && isMcqOptionLine(cleanLine)) optStarted = true
                                      const isOpt = i > 0 && optStarted
                                      const answered =
                                        isOpt && block.answer && new RegExp(`^\\s*(?:\\(${block.answer}\\)|${block.answer}[.)])\\s`).test(cleanLine)
                                      const html = renderTextWithMath(cleanLine)
                                      if (!isOpt) {
                                        return (
                                          <div
                                            key={i}
                                            className={i === 0 ? 'font-bold text-slate-900 mb-1' : 'text-slate-800'}
                                            style={{ lineHeight: 1.25 }}
                                            dangerouslySetInnerHTML={{ __html: html }}
                                          />
                                        )
                                      }
                                      return (
                                        <div
                                          key={i}
                                          className={`pl-3 text-[0.96em] ${answered ? 'font-semibold text-emerald-700' : 'text-slate-800'}`}
                                          style={{ lineHeight: 1.25 }}
                                          dangerouslySetInnerHTML={{ __html: html }}
                                        />
                                      )
                                    })
                                  })()}
                                </div>
                              ) : renderTextWithMath(block.text).includes('<span class="katex">') ? (
                                <div style={{ lineHeight: 1.2 }} dangerouslySetInnerHTML={{ __html: renderTextWithMath(block.text) }} />
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
                  {book.headerFooter.pageNumberStyle === 'bracket' ? (
                    <div className="flex items-center w-full mt-auto pt-2">
                      <div className="flex-1 h-[1.5px] bg-black" />
                      <div
                        className="px-3 font-extrabold text-black tracking-widest text-center"
                        style={{ fontSize: 10 * zoom, fontFamily: 'system-ui, sans-serif' }}
                      >
                        {`{ ${activeIndex + 1} }`}
                      </div>
                      <div className="flex-1 h-[1.5px] bg-black" />
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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

      {/* ChatGPT OCR & Formatting Debug Console Modal */}
      <ConsoleLogsModal open={showConsoleModal} onClose={() => setShowConsoleModal(false)} />
    </div>
  )
}
