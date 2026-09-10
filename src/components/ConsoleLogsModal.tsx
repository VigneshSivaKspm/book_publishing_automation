import { useEffect, useState } from 'react'
import { clearLogs, getLogs, subscribeLogs, type LogCategory, type LogEntry } from '../lib/logger'

interface ConsoleLogsModalProps {
  open: boolean
  onClose: () => void
}

export default function ConsoleLogsModal({ open, onClose }: ConsoleLogsModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>(() => getLogs())
  const [filterCategory, setFilterCategory] = useState<LogCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const unsubscribe = subscribeLogs((nextLogs) => setLogs([...nextLogs]))
    return unsubscribe
  }, [open])

  if (!open) return null

  const filteredLogs = logs.filter((log) => {
    if (filterCategory !== 'all' && log.category !== filterCategory) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        log.title.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.category.toLowerCase().includes(q)
      )
    }
    return true
  })

  const copyToClipboard = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.category.toUpperCase()}] [${l.level.toUpperCase()}] ${l.title}: ${l.details}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-[850px] max-w-[96vw] h-[650px] max-h-[92vh] bg-slate-900 text-slate-100 rounded-xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden font-sans"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
            <div>
              <h2 className="text-[14px] font-bold tracking-wide text-white uppercase">
                AI & ChatGPT Console Logs
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Live output for OCR Vision, Text Corrections, AI Solver & Layout Formatting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-all border border-slate-700"
            >
              {copied ? '✓ Copied!' : 'Copy Logs'}
            </button>
            <button
              onClick={() => clearLogs()}
              className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 text-[11px] font-bold transition-all border border-red-800/60"
            >
              Clear Logs
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[14px] font-bold flex items-center justify-center transition-all ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase transition-all ${
                filterCategory === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setFilterCategory('ocr')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase transition-all ${
                filterCategory === 'ocr'
                  ? 'bg-cyan-700 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              ChatGPT OCR ({logs.filter((l) => l.category === 'ocr').length})
            </button>
            <button
              onClick={() => setFilterCategory('correction')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase transition-all ${
                filterCategory === 'correction'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              Text Corrections ({logs.filter((l) => l.category === 'correction').length})
            </button>
            <button
              onClick={() => setFilterCategory('formatting')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase transition-all ${
                filterCategory === 'formatting'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              Formatting ({logs.filter((l) => l.category === 'formatting').length})
            </button>
            <button
              onClick={() => setFilterCategory('ai-solver')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase transition-all ${
                filterCategory === 'ai-solver'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              AI Solver ({logs.filter((l) => l.category === 'ai-solver').length})
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs…"
            className="px-3 py-1 rounded-md bg-slate-950 border border-slate-700 text-slate-200 text-[12px] placeholder-slate-500 outline-none focus:border-cyan-500 w-44"
          />
        </div>

        {/* Log Stream Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-mono text-[12px]">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-[13px]">
              No log entries match the current filter.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const categoryBadges: Record<LogCategory, { label: string; style: string }> = {
                ocr: { label: 'CHATGPT OCR', style: 'bg-cyan-900/80 text-cyan-300 border-cyan-700/60' },
                correction: { label: 'CORRECTION', style: 'bg-amber-900/80 text-amber-300 border-amber-700/60' },
                formatting: { label: 'FORMATTING', style: 'bg-emerald-900/80 text-emerald-300 border-emerald-700/60' },
                'ai-solver': { label: 'AI SOLVER', style: 'bg-purple-900/80 text-purple-300 border-purple-700/60' },
              }

              const levelIndicator: Record<string, string> = {
                info: 'text-slate-400',
                warn: 'text-amber-400 font-bold',
                error: 'text-red-400 font-bold',
                success: 'text-emerald-400 font-bold',
              }

              const badge = categoryBadges[log.category] || categoryBadges.ocr

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.style}`}>
                        {badge.label}
                      </span>
                      <span className={`text-[12px] font-bold ${levelIndicator[log.level]}`}>
                        {log.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                    {log.details}
                  </p>
                  {log.meta && (
                    <div className="pt-1">
                      <details className="text-[10px] text-slate-400 cursor-pointer">
                        <summary className="hover:text-cyan-400 font-semibold">
                          View JSON Metadata
                        </summary>
                        <pre className="mt-1 p-2 rounded bg-black/60 text-slate-300 overflow-x-auto border border-slate-800">
                          {JSON.stringify(log.meta, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Console Footer Status */}
        <div className="px-5 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-sans">
          <div>
            Showing <span className="font-bold text-white">{filteredLogs.length}</span> of{' '}
            <span className="font-bold text-white">{logs.length}</span> recorded logs
          </div>
          <div>DevTools Console Sync: Active</div>
        </div>
      </div>
    </div>
  )
}
