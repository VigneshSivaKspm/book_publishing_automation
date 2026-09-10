export type LogCategory = 'ocr' | 'correction' | 'formatting' | 'ai-solver'
export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface LogEntry {
  id: string
  timestamp: string
  category: LogCategory
  level: LogLevel
  title: string
  details: string
  meta?: Record<string, any>
}

let logs: LogEntry[] = [
  {
    id: 'init_1',
    timestamp: new Date().toLocaleTimeString(),
    category: 'ocr',
    level: 'info',
    title: 'Console Engine Initialized',
    details: 'ChatGPT Vision OCR, Text Corrections & Formatting log collector ready.',
  },
]

const listeners = new Set<(logs: LogEntry[]) => void>()

const CATEGORY_STYLES: Record<LogCategory, string> = {
  ocr: 'background: #0E7490; color: #FFFFFF; font-weight: bold; padding: 2px 6px; border-radius: 3px;',
  correction: 'background: #D97706; color: #FFFFFF; font-weight: bold; padding: 2px 6px; border-radius: 3px;',
  formatting: 'background: #059669; color: #FFFFFF; font-weight: bold; padding: 2px 6px; border-radius: 3px;',
  'ai-solver': 'background: #7C3AED; color: #FFFFFF; font-weight: bold; padding: 2px 6px; border-radius: 3px;',
}

export function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
  const newEntry: LogEntry = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
  }

  logs = [newEntry, ...logs].slice(0, 300) // Keep last 300 logs

  // Also output to DevTools Console with rich styling
  const catLabel = entry.category.toUpperCase()
  const badgeStyle = CATEGORY_STYLES[entry.category] || ''

  if (entry.level === 'error') {
    console.error(`%c[${catLabel}]`, badgeStyle, entry.title, entry.details, entry.meta || '')
  } else if (entry.level === 'warn') {
    console.warn(`%c[${catLabel}]`, badgeStyle, entry.title, entry.details, entry.meta || '')
  } else if (entry.level === 'success') {
    console.log(`%c[${catLabel} ✓]`, badgeStyle, entry.title, entry.details, entry.meta || '')
  } else {
    console.log(`%c[${catLabel}]`, badgeStyle, entry.title, entry.details, entry.meta || '')
  }

  listeners.forEach((l) => l(logs))
  return newEntry
}

export function getLogs(): LogEntry[] {
  return logs
}

export function clearLogs(): void {
  logs = []
  listeners.forEach((l) => l(logs))
  console.clear()
  console.log('%c[Console] Logs cleared', 'color: #9CA3AF;')
}

export function subscribeLogs(listener: (logs: LogEntry[]) => void): () => void {
  listeners.add(listener)
  listener(logs)
  return () => {
    listeners.delete(listener)
  }
}
