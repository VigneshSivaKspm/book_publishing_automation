import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookDocument, HeaderFooterStyle, NavHandler } from '../types'
import { createNewBook, uid } from '../types'
import {
  HF_STYLES,
  PAPER_META,
  applyOptionFormat,
  formatPageNumber,
  nextQuestionNumber,
  paginateQuestions,
  parseQuestions,
  renumberContent,
  structurePaste,
  templatesFor,
  type OptionCols,
  type PaperSize,
} from '../lib/editorEngine'
import { MATH_SNIPPETS, loadKatex, renderTextWithMath } from '../lib/mathEngine'
import { aiSolveUnansweredMcqs } from '../lib/mcqEngine'
import 'katex/dist/katex.min.css'

interface EditorProps {
  onNavigate: NavHandler
  onExport: () => void
  onOpenBook?: (book: BookDocument) => void
  pendingAction?: string | null
  onActionConsumed?: () => void
}

const initialContent = `# Topic 1 — Quadratic Equations
## 1.1 Standard Form

The general quadratic equation is given by
$$ax^2 + bx + c = 0 \\quad (a \\neq 0)$$

1. The discriminant of $ax^2 + bx + c = 0$ is
(A) $b^2 - 4ac$
(B) $b^2 + 4ac$
(C) $2b - 4ac$
(D) $b - 4ac$

2. If the roots are real and equal, then
(A) $D > 0$
(B) $D = 0$
(C) $D < 0$
(D) $D = 1$

## 1.2 Quadratic Formula

$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$

3. Solve $x^2 - 5x + 6 = 0$. The roots are
(A) 2 and 3
(B) −2 and −3
(C) 1 and 6
(D) 0 and 5

4. $$\int_0^1 (2x+1)\,dx =$$
(A) 1
(B) 2
(C) 3
(D) 4
`

export default function Editor({ onNavigate, onExport, onOpenBook, pendingAction, onActionConsumed }: EditorProps) {
  const [content, setContent] = useState(initialContent)
  const [history, setHistory] = useState<string[]>([initialContent])
  const [histIdx, setHistIdx] = useState(0)
  const [saveStatus, setSaveStatus] = useState('Auto-saved')
  const [activeSize, setActiveSize] = useState<PaperSize>('A4')
  const [hfStyle, setHfStyle] = useState<HeaderFooterStyle>('academic')
  const [activeLib, setActiveLib] = useState<'structure' | 'math' | 'options'>('structure')
  const [cols, setCols] = useState<OptionCols>('2')
  const [toast, setToast] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [bookTitle] = useState('Class 12 Mathematics — Course Manual')
  const [chapterTitle] = useState('Topic 1 · Quadratic Equations')
  const textRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipHistRef = useRef(false)

  const paper = PAPER_META[activeSize]
  const hf = HF_STYLES[hfStyle]

  useEffect(() => {
    loadKatex()
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const commit = useCallback(
    (next: string, opts?: { toast?: string }) => {
      setContent(next)
      setSaveStatus('Saving…')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => setSaveStatus('Auto-saved'), 700)

      if (!skipHistRef.current) {
        setHistory((h) => {
          const clipped = h.slice(0, histIdx + 1)
          const updated = [...clipped, next].slice(-80)
          setHistIdx(updated.length - 1)
          return updated
        })
      }
      skipHistRef.current = false
      if (opts?.toast) showToast(opts.toast)
    },
    [histIdx, showToast],
  )

  const undo = () => {
    if (histIdx <= 0) return
    const i = histIdx - 1
    skipHistRef.current = true
    setHistIdx(i)
    setContent(history[i])
    showToast('Undo')
  }

  const redo = () => {
    if (histIdx >= history.length - 1) return
    const i = histIdx + 1
    skipHistRef.current = true
    setHistIdx(i)
    setContent(history[i])
    showToast('Redo')
  }

  const insertAtCursor = (snippet: string, toastMsg: string) => {
    const el = textRef.current
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = content.slice(0, start) + snippet + content.slice(end)
      commit(next, { toast: toastMsg })
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + snippet.length
        el.setSelectionRange(pos, pos)
      })
    } else {
      commit(content + (content.endsWith('\n') ? '' : '\n') + snippet, { toast: toastMsg })
    }
  }

  const insertBlock = useCallback(
    (id: string) => {
      const n = nextQuestionNumber(content)
      commit(content + templatesFor(id, n), { toast: 'Block inserted' })
      requestAnimationFrame(() => {
        textRef.current?.focus()
        const el = textRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    },
    [content, commit],
  )

  const renumber = useCallback(() => {
    commit(renumberContent(content, 1), { toast: 'Questions renumbered' })
  }, [content, commit])

  const applyImport = () => {
    if (!importText.trim()) return
    const cleaned = structurePaste(importText)
    commit(content + (content.endsWith('\n') ? '' : '\n') + cleaned + '\n', {
      toast: 'Imported with formatting preserved',
    })
    setShowImport(false)
    setImportText('')
  }

  const parsed = useMemo(() => parseQuestions(content), [content])
  const previewPages = useMemo(() => paginateQuestions(parsed, activeSize, cols), [parsed, activeSize, cols])
  const qCount = parsed.filter((q) => q.kind === 'mcq' || q.kind === 'fill').length

  useEffect(() => {
    if (!pendingAction) return
    if (pendingAction === 'insert-mcq4') insertBlock('mcq4')
    if (pendingAction === 'renumber' || pendingAction === 'fix-seq') renumber()
    if (pendingAction === 'import') setShowImport(true)
    if (pendingAction === 'insert-math') insertBlock('math')
    onActionConsumed?.()
  }, [pendingAction, insertBlock, renumber, onActionConsumed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === '4') {
        e.preventDefault()
        insertBlock('mcq4')
      }
      if (e.key.toLowerCase() === 'r' && !e.shiftKey) {
        e.preventDefault()
        renumber()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {toast && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-[12px] font-semibold text-white shadow-lg animate-slide-up"
          style={{ background: 'var(--ink)' }}
        >
          {toast}
        </div>
      )}

      <div
        className="flex items-center gap-2 px-4 h-[56px] flex-shrink-0"
        style={{ background: 'white', borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--primary)' }}>
            Layout Studio
          </div>
          <div className="text-[12px] font-semibold truncate max-w-[200px]" style={{ color: 'var(--ink)' }}>
            {bookTitle}
          </div>
        </div>

        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['A4', 'B5', '8×8'] as PaperSize[]).map((size) => (
            <button
              key={size}
              onClick={() => {
                setActiveSize(size)
                showToast(`Layout aligned to ${size} (${PAPER_META[size].dims})`)
              }}
              className="px-2.5 py-1.5 text-[11px] font-mono font-medium transition-colors"
              style={{
                background: activeSize === size ? 'var(--primary)' : 'white',
                color: activeSize === size ? 'white' : 'var(--muted-foreground)',
              }}
              title={PAPER_META[size].dims}
            >
              {size}
            </button>
          ))}
        </div>

        <select
          value={hfStyle}
          onChange={(e) => {
            setHfStyle(e.target.value as HeaderFooterStyle)
            showToast(`Header & footer → ${HF_STYLES[e.target.value as HeaderFooterStyle].label}`)
          }}
          className="text-[11px] font-medium px-2 py-1.5 rounded-xl outline-none"
          style={{ border: '1px solid var(--border)', color: 'var(--ink)', background: 'white' }}
        >
          {(Object.keys(HF_STYLES) as HeaderFooterStyle[]).map((k) => (
            <option key={k} value={k}>
              HF: {HF_STYLES[k].label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={histIdx <= 0}
            className="px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[12px] font-semibold hover:bg-[var(--muted)] disabled:opacity-30 border border-slate-200 shadow-sm transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
            </svg>
            <span>Undo</span>
          </button>
          <button
            onClick={redo}
            disabled={histIdx >= history.length - 1}
            className="px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[12px] font-semibold hover:bg-[var(--muted)] disabled:opacity-30 border border-slate-200 shadow-sm transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            title="Redo (Ctrl+Y)"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22l2.37.78c1.05-3.19 4.06-5.5 7.59-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
            </svg>
            <span>Redo</span>
          </button>
        </div>

        <div className="flex rounded-xl overflow-hidden border border-slate-300 bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => {
              setCols('1')
              showToast('1 Column Layout (General Subjects)')
            }}
            className={`px-2.5 py-1 text-[11px] font-bold transition-all ${
              cols === '1' ? 'bg-white text-teal-700 shadow-sm rounded' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="1 Column Layout"
          >
            1 Col
          </button>
          <button
            type="button"
            onClick={() => {
              setCols('2')
              showToast('2 Columns Layout (Maths & Science)')
            }}
            className={`px-2.5 py-1 text-[11px] font-bold transition-all ${
              cols === '2' ? 'bg-white text-teal-700 shadow-sm rounded' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="2 Columns Layout"
          >
            2 Cols
          </button>
        </div>

        <button
          onClick={renumber}
          className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold"
          style={{ background: 'rgba(14,116,144,0.08)', color: 'var(--primary)' }}
        >
          Auto-number
        </button>
        <button
          onClick={async () => {
            showToast('AI solving question answers…')
            const parsed = parseQuestions(content)
            const blocks = parsed.map((q) => ({
              id: uid('blk'),
              type: q.kind === 'mcq' ? ('mcq' as const) : ('paragraph' as const),
              text: `${q.num ? q.num + '. ' : ''}${q.question}\n${(q.options || []).map((o, i) => `(${String.fromCharCode(65 + i)}) ${o}`).join('\n')}${q.answer ? `\n[✓ ${q.answer}]` : ''}`,
              options: q.options,
              answer: q.answer,
            }))
            const { updatedBlocks, solvedCount } = await aiSolveUnansweredMcqs(blocks)
            const newText = updatedBlocks.map((b: { text: string }) => b.text).join('\n\n')
            commit(newText, { toast: `AI solved ${solvedCount} question answers!` })
          }}
          className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
          title="AI guesses and solves all unanswered questions automatically"
        >
          <span>✨</span>
          <span>AI Solve Answers</span>
        </button>

        <button
          onClick={() => setShowImport(true)}
          className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold"
          style={{ background: 'var(--muted)', color: 'var(--secondary-foreground)' }}
        >
          Paste import
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: saveStatus.includes('Saving') ? '#D97706' : 'var(--success)' }}
          />
          {saveStatus}
        </div>

        {onOpenBook && (
          <button
            onClick={() => {
              const parsed = parseQuestions(content)
              const newBook = createNewBook(bookTitle, { paperSize: activeSize, author: 'Karthikeyan' })
              newBook.pages = [
                {
                  id: uid('page'),
                  number: 1,
                  blocks: parsed.map((q) => {
                    if (q.kind === 'mcq') {
                      return {
                        id: uid('blk'),
                        type: 'mcq',
                        text: `${q.num ? q.num + '. ' : ''}${q.question}`,
                        options: q.options,
                        answer: q.answer,
                      }
                    }
                    return {
                      id: uid('blk'),
                      type: 'paragraph',
                      text: q.question,
                    }
                  }),
                },
              ]
              showToast('Converted! Opening in Book Editor…')
              onOpenBook(newBook)
            }}
            className="px-3 py-1.5 rounded-xl text-[12px] font-semibold"
            style={{ background: 'rgba(14,116,144,0.1)', color: 'var(--primary)' }}
          >
            Open in Full Editor
          </button>
        )}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #0E7490, #0D9488)' }}
        >
          Export {activeSize}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          className="w-[220px] flex-shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid var(--border)', background: 'white' }}
        >
          <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
            {(
              [
                ['structure', 'Structure'],
                ['math', 'Math'],
                ['options', 'Options'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveLib(id)}
                className="flex-1 py-2.5 text-[11px] font-semibold"
                style={{
                  color: activeLib === id ? 'var(--primary)' : 'var(--muted-foreground)',
                  borderBottom: activeLib === id ? '2px solid var(--primary)' : '2px solid transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {activeLib === 'structure' && (
              <>
                {[
                  { id: 'topic', label: 'Topic + subheadings', hint: '1 · 1.1 · 1.2' },
                  { id: 'mcq4', label: 'MCQ A–D', hint: 'Ctrl+4' },
                  { id: 'math', label: 'Math MCQ', hint: 'Formula + options' },
                  { id: 'fill', label: 'Fill blank', hint: 'Stem with blank' },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => insertBlock(b.id)}
                    className="w-full text-left p-2.5 rounded-xl transition-all hover:bg-[var(--muted)]"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
                      {b.label}
                    </div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--primary)' }}>
                      {b.hint}
                    </div>
                  </button>
                ))}
              </>
            )}
            {activeLib === 'math' &&
              MATH_SNIPPETS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => insertAtCursor(`\n${s.tex}\n`, `${s.label} formula inserted`)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[var(--muted)]"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="flex justify-between gap-1">
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
                      {s.label}
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                      {s.group}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono mt-1 truncate" style={{ color: 'var(--muted-foreground)' }}>
                    Insert ready-to-render TeX
                  </div>
                </button>
              ))}
            {activeLib === 'options' &&
              (
                [
                  { id: 'abcd' as const, label: 'A, B, C, D' },
                  { id: 'abcde' as const, label: 'A–E' },
                  { id: 'roman' as const, label: 'i, ii, iii, iv' },
                  { id: 'numeric' as const, label: '1, 2, 3, 4' },
                  { id: 'inline' as const, label: 'ABCD inline' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    commit(applyOptionFormat(content, t.id), { toast: `Options → ${t.label}` })
                    if (t.id === 'inline') setCols('1')
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[var(--muted)]"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {t.label}
                  </div>
                </button>
              ))}
            {activeLib === 'options' && (
              <button
                onClick={() => {
                  const next = cols === '2' ? '1' : '2'
                  setCols(next)
                  showToast(`${next}-column option layout`)
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-semibold"
                style={{ background: 'rgba(14,116,144,0.08)', color: 'var(--primary)' }}
              >
                Toggle {cols === '2' ? '1-column' : '2-column'}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--surface-soft)' }}>
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{ borderBottom: '1px solid var(--border)', background: 'white' }}
          >
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(14,116,144,0.1)', color: 'var(--primary)' }}
            >
              {chapterTitle}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              Use # Topic · ## 1.1 · $inline$ · $$display$$
            </span>
            <div className="flex-1" />
            <span className="text-[11px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
              {qCount} Q · {previewPages.length} pages · {paper.dims}
            </span>
          </div>
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => commit(e.target.value)}
            className="flex-1 w-full resize-none outline-none p-5 text-[13px] leading-7 font-mono"
            style={{ background: 'var(--surface-soft)', color: 'var(--ink)', caretColor: 'var(--primary)' }}
            spellCheck={false}
          />
        </div>

        <div
          className="w-[360px] flex-shrink-0 flex flex-col overflow-hidden"
          style={{ borderLeft: '1px solid var(--border)', background: 'white' }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <span className="text-[12px] font-bold block" style={{ color: 'var(--ink)' }}>
                Print preview
              </span>
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                {hf.label} · margins {paper.marginMm}mm
              </span>
            </div>
            <span
              className="text-[10px] font-mono px-2 py-1 rounded-md font-semibold"
              style={{ background: 'rgba(14,116,144,0.12)', color: 'var(--primary)' }}
            >
              {activeSize}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: 'var(--muted)' }}>
            <div className="flex items-end justify-center gap-3 pb-1">
              {(['A4', 'B5', '8×8'] as PaperSize[]).map((s) => {
                const m = PAPER_META[s]
                const scale = 36 / m.height
                return (
                  <button key={s} onClick={() => setActiveSize(s)} className="flex flex-col items-center gap-1">
                    <div
                      className="rounded-[2px] transition-all"
                      style={{
                        width: m.width * scale,
                        height: m.height * scale,
                        background: activeSize === s ? 'var(--primary)' : 'white',
                        border: activeSize === s ? 'none' : '1px solid var(--border)',
                      }}
                    />
                    <span
                      className="text-[9px] font-mono font-semibold"
                      style={{ color: activeSize === s ? 'var(--primary)' : 'var(--muted-foreground)' }}
                    >
                      {s}
                    </span>
                  </button>
                )
              })}
            </div>

            {previewPages.map((page) => (
              <div key={`${activeSize}-${hfStyle}-${page.pageNum}`}>
                <div className="text-[10px] font-mono mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Page {page.pageNum}
                </div>
                <div
                  className="mx-auto rounded-lg overflow-hidden paper-grain shadow-md transition-all duration-300"
                  style={{
                    width: paper.width,
                    minHeight: paper.height,
                    maxWidth: '100%',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--paper)',
                  }}
                >
                  <div
                    className="flex justify-between px-3 py-1.5 flex-shrink-0"
                    style={{
                      borderBottom: hf.headerRule ? '1px solid #CBD5E1' : 'none',
                      background: hfStyle === 'modern' ? '#F8FAFC' : '#F7F4EC',
                    }}
                  >
                    <span className="text-[8px] font-medium truncate" style={{ color: '#64748B' }}>
                      {hfStyle === 'minimal' ? chapterTitle : bookTitle}
                    </span>
                    <span className="text-[8px] font-mono flex-shrink-0" style={{ color: '#94A3B8' }}>
                      {activeSize}
                    </span>
                  </div>

                    <div className="flex-1 p-3 space-y-2 font-serif overflow-hidden" style={{ fontSize: paper.fontPx, lineHeight: 1.2 }}>
                      {page.questions.map((q, qi) => (
                        <div key={`${q.num}-${qi}`} style={{ lineHeight: 1.2 }}>
                          {q.kind === 'heading' ? (
                            <div
                              className="font-bold mb-1"
                              style={{
                                color: '#0F172A',
                                fontSize: q.num === 'T' ? paper.fontPx + 2 : paper.fontPx + 0.5,
                                borderBottom: q.num === 'T' ? '1px solid #E2E8F0' : undefined,
                                paddingBottom: q.num === 'T' ? 2 : undefined,
                                lineHeight: 1.2,
                              }}
                            >
                              {typeof q.num === 'string' && /^\d/.test(q.num) ? `${q.num} ` : ''}
                              {q.question}
                            </div>
                          ) : q.kind === 'math' || q.question.includes('$') ? (
                            <div
                              style={{ color: '#1A2332', lineHeight: 1.2 }}
                              dangerouslySetInnerHTML={{
                                __html:
                                  (typeof q.num === 'number' ? `<strong>${q.num}. </strong>` : '') +
                                  renderTextWithMath(q.question),
                              }}
                            />
                          ) : q.kind === 'marker' ? (
                            <div style={{ color: '#0E7490', fontWeight: 600, lineHeight: 1.2 }}>{q.question}</div>
                          ) : (
                            <>
                              <div
                                className="font-semibold mb-1"
                                style={{ color: '#1A2332', lineHeight: 1.2 }}
                                dangerouslySetInnerHTML={{
                                  __html: `${q.num}. ${renderTextWithMath(q.question)}`,
                                }}
                              />
                              {q.options.length > 0 && (
                                <div
                                  className="gap-x-2 gap-y-0.5 pl-1.5"
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: cols === '2' && q.options.length > 1 ? '1fr 1fr' : '1fr',
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {q.options.map((opt, i) => {
                                    const letter = String.fromCharCode(65 + i)
                                    const cleanOpt = opt.replace(/\[\s*[✓✔]?\s*\(?[A-Ea-e1-4?]?\)?\s*\]/gi, '').trim()
                                    const alreadyLabeled = cleanOpt.startsWith('(')
                                    return (
                                      <div
                                        key={i}
                                        style={{ color: '#475569', lineHeight: 1.2 }}
                                        dangerouslySetInnerHTML={{
                                          __html: alreadyLabeled
                                            ? renderTextWithMath(cleanOpt)
                                            : `(${letter}) ${renderTextWithMath(cleanOpt)}`,
                                        }}
                                      />
                                    )
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                  <div
                    className="flex px-3 py-1 flex-shrink-0 mt-auto"
                    style={{
                      borderTop: hf.headerRule ? '1px solid #E8E4DC' : '1px solid #F1F5F9',
                      background: '#FFFEF9',
                      justifyContent: hf.footerCenter ? 'center' : 'space-between',
                    }}
                  >
                    {!hf.footerCenter && (
                      <span className="text-[8px]" style={{ color: '#94A3B8' }}>
                        Figma
                      </span>
                    )}
                    <span className="text-[8px] font-mono" style={{ color: '#94A3B8' }}>
                      {formatPageNumber(hfStyle, page.pageNum)}
                    </span>
                    {!hf.footerCenter && (
                      <span className="text-[8px]" style={{ color: '#94A3B8' }}>
                        {chapterTitle.split('·')[0].trim()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showImport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowImport(false)}
        >
          <div className="w-[520px] rounded-2xl bg-white p-5 animate-slide-up" style={{ border: '1px solid var(--border)' }}>
            <h3 className="text-[16px] font-bold mb-1" style={{ color: 'var(--ink)' }}>
              Paste content
            </h3>
            <p className="text-[12px] mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Original option letters and math delimiters are retained.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full h-40 rounded-xl p-3 text-[12px] font-mono outline-none resize-none"
              style={{ border: '1px solid var(--border)', background: 'var(--surface-soft)' }}
              placeholder="Paste question paper or chapter text…"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-xl text-[12px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Cancel
              </button>
              <button onClick={applyImport} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white" style={{ background: 'var(--primary)' }}>
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
