import { useState } from 'react'
import type { BookDocument, BookPage } from '../types'
import {
  copyTextToClipboard,
  extractActivePageDomText,
  extractBodyContentText,
  extractFullDocumentText,
  extractHeaderText,
} from '../lib/documentCopy'

interface CopyControlBarProps {
  book: BookDocument
  activePage?: BookPage
  activePageRef?: React.RefObject<HTMLDivElement | null>
  bodyContentRef?: React.RefObject<HTMLDivElement | null>
  onNotify: (msg: string) => void
  className?: string
}

export default function CopyControlBar({
  book,
  activePage,
  activePageRef,
  bodyContentRef,
  onNotify,
  className = '',
}: CopyControlBarProps) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState(false)

  const executeCopy = async (text: string, label: string) => {
    if (!text || !text.trim()) {
      onNotify(`No content available for ${label}`)
      return
    }
    const ok = await copyTextToClipboard(text)
    if (ok) {
      setCopiedLabel(label)
      onNotify(`${label} copied!`)
      setTimeout(() => setCopiedLabel(null), 2000)
    } else {
      onNotify(`Failed to copy ${label.toLowerCase()}`)
    }
    setOpenDropdown(false)
  }

  const handleCopyHeader = async () => {
    try {
      const headerNode = document.querySelector('.document-header') as HTMLElement | null
      let headerText = ''
      if (headerNode) {
        const clone = headerNode.cloneNode(true) as HTMLElement
        clone.querySelectorAll('.no-copy, .select-none, button').forEach((el) => el.remove())
        headerText = (clone.innerText || clone.textContent || '').trim()
      }
      if (!headerText) {
        headerText = extractHeaderText(book)
      }
      await executeCopy(headerText, 'Header Metadata')
    } catch {
      await executeCopy(extractHeaderText(book), 'Header Metadata')
    }
  }

  const handleCopyActivePage = async () => {
    const pageNum = activePage?.number || 1
    try {
      let pageText = extractActivePageDomText(bodyContentRef?.current || activePageRef?.current)
      if (!pageText && activePage) {
        pageText = extractBodyContentText([activePage])
      }
      await executeCopy(pageText, `Page ${pageNum} Content`)
    } catch {
      const fallbackText = activePage ? extractBodyContentText([activePage]) : ''
      await executeCopy(fallbackText, `Page ${pageNum} Content`)
    }
  }

  const handleCopyBodyContent = async () => {
    try {
      const bodyText = extractBodyContentText(book.pages, { cleanAnswers: true })
      await executeCopy(bodyText, 'Body Content')
    } catch {
      await executeCopy(extractBodyContentText(book.pages, { cleanAnswers: true }), 'Body Content')
    }
  }

  const handleCopyFullDocument = async () => {
    try {
      const fullText = extractFullDocumentText(book)
      await executeCopy(fullText, 'Full Document')
    } catch {
      onNotify('Failed to copy full document')
    }
  }

  return (
    <div className={`relative inline-block text-left select-none ${className}`}>
      <button
        type="button"
        onClick={() => setOpenDropdown((v) => !v)}
        className={`px-3 py-1 rounded-none text-[11.5px] font-bold flex items-center gap-1.5 transition-all border ${
          copiedLabel
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-800 hover:bg-slate-50 border-slate-300'
        }`}
        title="Copy Document Text Options"
      >
        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>{copiedLabel ? `${copiedLabel} Copied!` : 'Copy Content'}</span>
        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {openDropdown && (
        <div
          className="absolute left-0 top-full mt-1 w-56 rounded-none bg-white shadow-xl border border-slate-300 z-50 p-1 text-[12px] space-y-0.5"
          onClick={() => setOpenDropdown(false)}
        >
          <button
            type="button"
            onClick={handleCopyFullDocument}
            className="w-full text-left px-3 py-1.5 rounded-none hover:bg-slate-100 font-bold text-slate-900 flex items-center justify-between border-b border-slate-100"
          >
            <span>Copy Full Document</span>
            <span className="text-[9.5px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-none font-extrabold border border-slate-200">All</span>
          </button>

          <button
            type="button"
            onClick={handleCopyActivePage}
            className="w-full text-left px-3 py-1.5 rounded-none hover:bg-slate-100 font-medium text-slate-800 flex items-center justify-between"
          >
            <span>Copy Page {activePage?.number || 1} Only</span>
            <span className="text-[10px] text-slate-400">Current</span>
          </button>

          <button
            type="button"
            onClick={handleCopyBodyContent}
            className="w-full text-left px-3 py-1.5 rounded-none hover:bg-slate-100 font-medium text-slate-800 flex items-center justify-between"
          >
            <span>Copy Body Text</span>
            <span className="text-[10px] text-slate-400">No Key</span>
          </button>

          <button
            type="button"
            onClick={handleCopyHeader}
            className="w-full text-left px-3 py-1.5 rounded-none hover:bg-slate-100 font-medium text-slate-800 flex items-center justify-between"
          >
            <span>Copy Header Info</span>
            <span className="text-[10px] text-slate-400">Meta</span>
          </button>
        </div>
      )}
    </div>
  )
}
