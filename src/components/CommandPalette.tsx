import { useEffect, useMemo, useState } from 'react'
import type { Page } from '../types'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate: (page: Page) => void
  onExport: () => void
  onAction?: (action: string) => void
}

const commands: {
  id: string
  label: string
  hint: string
  group: string
  page?: Page
  action?: string
}[] = [
  { id: 'dash', label: 'Go to Dashboard', hint: 'G D', group: 'Navigate', page: 'dashboard' },
  { id: 'edit', label: 'Open Publishing Studio', hint: 'G E', group: 'Navigate', page: 'editor' },
  { id: 'set', label: 'Settings', hint: 'G S', group: 'Navigate', page: 'settings' },
  { id: 'newbook', label: 'Create new book', hint: 'Ctrl+N', group: 'Actions', action: 'new-book' },
  { id: 'export', label: 'Export A4 · B5 · 8×8', hint: 'Ctrl+P', group: 'Actions', action: 'export' },
  { id: 'newq', label: 'Insert MCQ (4 options)', hint: 'Ctrl+4', group: 'Actions', action: 'insert-mcq4' },
  { id: 'math', label: 'Insert math question', hint: '', group: 'Actions', action: 'insert-math' },
  { id: 'renum', label: 'Auto-renumber questions', hint: 'Ctrl+R', group: 'Actions', action: 'renumber' },
  { id: 'import', label: 'Paste import', hint: 'Ctrl+Shift+V', group: 'Actions', action: 'import' },
]

export default function CommandPalette({
  open,
  onClose,
  onNavigate,
  onExport,
  onAction,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    )
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  const run = (cmd: (typeof commands)[0]) => {
    if (cmd.page) onNavigate(cmd.page)
    if (cmd.action === 'export') onExport()
    else if (cmd.action) onAction?.(cmd.action)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && filtered[active]) {
        e.preventDefault()
        run(filtered[active])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
      style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-[520px] rounded-2xl overflow-hidden animate-slide-up bg-white"
        style={{ border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(15,23,42,0.2)' }}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search commands, open Publishing Studio, create book…"
          className="w-full px-5 py-4 text-[14px] outline-none"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--ink)' }}
        />
        <div className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-5 py-6 text-[13px] text-center" style={{ color: 'var(--muted-foreground)' }}>
              No matching commands
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => run(cmd)}
              onMouseEnter={() => setActive(i)}
              className="w-full flex items-center justify-between px-5 py-2.5 text-left"
              style={{
                background: i === active ? 'rgba(14,116,144,0.08)' : 'transparent',
              }}
            >
              <div>
                <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                  {cmd.label}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {cmd.group}
                </div>
              </div>
              {cmd.hint && (
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)' }}>
                  {cmd.hint}
                </kbd>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
