import { useState } from 'react'
import type { BookMode, Page } from '../types'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  onExport?: () => void
  onCommandPalette?: () => void
  onNewBook: (mode?: BookMode) => void
}

export default function Sidebar({
  activePage,
  onNavigate,
  onNewBook,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 transition-all duration-200 select-none"
      style={{
        width: collapsed ? '68px' : '240px',
        background: '#F8FAFC',
        borderRight: '1px solid #E2E8F0',
      }}
    >
      {/* Brand Header & Collapse Toggle */}
      <div className="h-[60px] px-3.5 flex items-center justify-between border-b border-slate-200 flex-shrink-0 bg-white">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.jpeg"
              alt="Publisher Logo"
              className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-xs flex-shrink-0"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = '/icons/android-icon-96x96.png'
              }}
            />
            <div className="min-w-0">
              <div className="text-[13px] font-bold tracking-tight text-slate-900 truncate">
                DOC PROCESSOR
              </div>
              <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate">
                PUBLISHING SUITE
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <img
              src="/logo.jpeg"
              alt="Publisher Logo"
              className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-xs"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = '/icons/android-icon-96x96.png'
              }}
            />
          </div>
        )}

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Collapse Sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Collapsed Re-expand Button */}
      {collapsed && (
        <div className="py-2 border-b border-slate-200 flex justify-center bg-slate-100/60">
          <button
            onClick={() => setCollapsed(false)}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            title="Expand Sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Quick Action Creation Buttons */}
      <div className="p-3 space-y-2 border-b border-slate-200 bg-slate-100/40">
        {!collapsed ? (
          <>
            <button
              onClick={() => onNewBook('qa')}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold transition-all shadow-xs text-left flex items-center gap-2"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              + Question Bank
            </button>
            <button
              onClick={() => onNewBook('questions-only')}
              className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-[12px] font-bold transition-all border border-slate-300 text-left flex items-center gap-2"
            >
              <svg className="w-4 h-4 flex-shrink-0 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              + Syllabus Book
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => onNewBook('qa')}
              className="w-10 h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center transition-all shadow-xs"
              title="Create Question Bank"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={() => onNewBook('questions-only')}
              className="w-10 h-10 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center justify-center transition-all border border-slate-300"
              title="Create Syllabus Book"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-2.5 space-y-4">
        <div>
          {!collapsed && (
            <div className="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              WORKSPACE
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={() => onNavigate('dashboard')}
              title={collapsed ? 'Documents Library' : undefined}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-2.5 ${
                activePage === 'dashboard' || activePage === 'documents'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              } ${collapsed ? 'justify-center px-0 py-2.5' : ''}`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {!collapsed && <span>Documents Library</span>}
            </button>

            <button
              onClick={() => onNavigate('templates')}
              title={collapsed ? 'Document Templates' : undefined}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-2.5 ${
                activePage === 'templates'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              } ${collapsed ? 'justify-center px-0 py-2.5' : ''}`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v-2" />
              </svg>
              {!collapsed && <span>Document Templates</span>}
            </button>
          </div>
        </div>
      </nav>

      {/* Footer Client Info */}
      <div className="p-3 border-t border-slate-200 bg-white">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.jpeg"
              alt="Karthikeyan Publishing"
              className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = '/icons/apple-icon-60x60.png'
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-slate-900 truncate">
                Karthikeyan Publishing
              </div>
              <div className="text-[10px] text-slate-500 font-semibold truncate">
                Study Circle Workspace
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Karthikeyan Publishing">
            <img
              src="/logo.jpeg"
              alt="Karthikeyan Publishing"
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = '/icons/apple-icon-60x60.png'
              }}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
