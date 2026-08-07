import { useState } from 'react'
import type { BookDocument, BookPage } from '../types'
import {
  copyTextToClipboard,
  extractActivePageDomText,
  extractBodyContentText,
  extractFooterText,
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

export default function CopyControlBar({ book, activePage, activePageRef, bodyContentRef, onNotify, className = '' }: CopyControlBarProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState(false)

  const executeCopy = async (key: string, text: string, label: string) => {
    if (!text || !text.trim()) {
      onNotify(`No content available for ${label}`)
      return
    }
    const ok = await copyTextToClipboard(text)
    if (ok) {
      setCopiedKey(key)
      onNotify(`${label} copied to clipboard!`)
      setTimeout(() => setCopiedKey(null), 2000)
    } else {
      onNotify(`Failed to copy ${label.toLowerCase()}`)
    }
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
      await executeCopy('header', headerText, 'Header Metadata')
    } catch (err) {
      console.error('Failed to copy header: ', err)
      await executeCopy('header', extractHeaderText(book), 'Header Metadata')
    }
  }

  const handleCopyActivePage = async () => {
    const pageNum = activePage?.number || 1
    try {
      let pageText = extractActivePageDomText(bodyContentRef?.current || activePageRef?.current)
      if (!pageText && activePage) {
        pageText = extractBodyContentText([activePage])
      }
      await executeCopy('body-active', pageText, `Page ${pageNum} Content`)
    } catch (err) {
      console.error('Failed to copy active page content: ', err)
      const fallbackText = activePage ? extractBodyContentText([activePage]) : ''
      await executeCopy('body-active', fallbackText, `Page ${pageNum} Content`)
    }
  }

  const handleCopyBodyContent = async () => {
    try {
      const bodyNode = document.querySelector('.page-body-container') as HTMLElement | null
      let bodyText = ''
      if (bodyNode) {
        const clone = bodyNode.cloneNode(true) as HTMLElement
        clone
          .querySelectorAll('.floating-toolbar, .formatting-bar, .no-copy, .select-none, button, select')
          .forEach((el) => el.remove())
        bodyText = (clone.innerText || clone.textContent || '')
          .replace(/\[\s*[✓✔]?\s*\(?[A-Ea-e1-4?]?\)?\s*\]/gi, '')
          .replace(/\s*Answer\s*[:\-]\s*\(?[A-Ea-e1-4]\)?/gi, '')
          .trim()
      }
      if (!bodyText) {
        bodyText = extractBodyContentText(book.pages, { cleanAnswers: true })
      }
      await executeCopy('body-all', bodyText, 'Body Content')
    } catch (err) {
      console.error('Failed to copy body content: ', err)
      await executeCopy('body-all', extractBodyContentText(book.pages, { cleanAnswers: true }), 'Body Content')
    }
  }

  const handleCopyFullDocument = async () => {
    try {
      const fullText = extractFullDocumentText(book)
      await executeCopy('full', fullText, 'Full Document')
    } catch (err) {
      console.error('Failed to copy full document: ', err)
      onNotify('Failed to copy full document')
    }
  }

  return (
    <div className={`flex items-center gap-1.5 flex-wrap select-none ${className}`}>
      {/* 1. Copy Header Only */}
      <button
        type="button"
        onClick={handleCopyHeader}
        className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-all border ${
          copiedKey === 'header'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
        }`}
        title="Copy only Header Metadata (Title, Chapter No, Institution)"
      >
        <span>📋</span>
        <span>{copiedKey === 'header' ? 'Header Copied!' : 'Copy Header Only'}</span>
      </button>

      {/* 2. Copy Active Page Content */}
      <button
        type="button"
        onClick={handleCopyActivePage}
        className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-all border ${
          copiedKey === 'body-active'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
        }`}
        title={`Copy Page ${activePage?.number || 1} Content Only`}
      >
        <span>📄</span>
        <span>{copiedKey === 'body-active' ? `Page ${activePage?.number || 1} Copied!` : `Copy Page ${activePage?.number || 1}`}</span>
      </button>

      {/* 3. Copy Body Content */}
      <button
        type="button"
        onClick={handleCopyBodyContent}
        className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-all border ${
          copiedKey === 'body-all'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
        }`}
        title="Copy Main Body Content (All Questions & Paragraphs)"
      >
        <span>📝</span>
        <span>{copiedKey === 'body-all' ? 'Body Copied!' : 'Copy Body Content'}</span>
      </button>

      {/* 4. Copy Full Document */}
      <button
        type="button"
        onClick={handleCopyFullDocument}
        className={`px-3 py-1.5 rounded-lg text-[12px] font-bold text-white flex items-center gap-1.5 transition-all shadow-sm ${
          copiedKey === 'full'
            ? 'bg-emerald-600'
            : 'bg-gradient-to-r from-teal-700 to-cyan-700 hover:from-teal-800 hover:to-cyan-800'
        }`}
        title="Copy Entire Document [Header + Body + Footer/Answer Key]"
      >
        <span>📄</span>
        <span>{copiedKey === 'full' ? 'Full Document Copied!' : 'Copy Full Document'}</span>
      </button>

      {/* Dropdown Options for Active Page or Clean Questions */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenDropdown((v) => !v)}
          className="px-2 py-1.5 rounded-lg text-[12px] font-medium text-slate-600 hover:bg-slate-200 border border-slate-300"
          title="More Extraction Options"
        >
          ▼
        </button>

        {openDropdown && (
          <div
            className="absolute right-0 top-full mt-1.5 w-60 rounded-xl bg-white shadow-xl border border-slate-200 z-50 p-1.5 text-[12px] space-y-1"
            onClick={() => setOpenDropdown(false)}
          >
            {activePage && (
              <button
                type="button"
                onClick={() =>
                  executeCopy(
                    'body-active',
                    extractBodyContentText([activePage]),
                    `Page ${activePage.number} Content`,
                  )
                }
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-700 flex items-center justify-between"
              >
                <span>Copy Page {activePage.number} Only</span>
                <span className="text-[10px] text-slate-400">Page {activePage.number}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                executeCopy(
                  'body-clean',
                  extractBodyContentText(book.pages, { cleanAnswers: true }),
                  'Questions (Without Answers)',
                )
              }
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-700 flex items-center justify-between"
            >
              <span>Copy Questions Only</span>
              <span className="text-[10px] text-slate-400">No Answers</span>
            </button>

            <button
              type="button"
              onClick={() =>
                executeCopy('footer', extractFooterText(book), 'Footer & Answer Key')
              }
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-700 flex items-center justify-between"
            >
              <span>Copy Footer &amp; Answer Key</span>
              <span className="text-[10px] text-slate-400">Key Table</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
