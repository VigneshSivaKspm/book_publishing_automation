import { useState } from 'react'
import type { Page } from '../types'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  onExport: () => void
  onCommandPalette: () => void
  onNewBook: () => void
}

export default function Sidebar({
  activePage,
  onNavigate,
  onExport,
  onCommandPalette,
  onNewBook,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const isSettingsActive =
    activePage === 'user-management' ||
    activePage === 'role-definitions' ||
    activePage === 'audit-logs' ||
    activePage === 'settings'

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? '68px' : '256px',
        background: '#F8FAFC',
        borderRight: '1px solid #E2E8F0',
      }}
    >
      {/* Brand Header & Sidebar Collapse Toggle */}
      <div className="h-[60px] px-4 flex items-center justify-between border-b border-slate-200 flex-shrink-0 bg-white">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-[13px] flex items-center justify-center flex-shrink-0">
              DP
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold tracking-tight text-slate-900 truncate">
                DOC PROCESSOR
              </div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                ADMINISTRATION
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-[12px] flex items-center justify-center">
              DP
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[10px] font-bold text-slate-600 hover:text-slate-900 px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors uppercase tracking-wider"
          title={collapsed ? 'EXPAND SIDEBAR' : 'COLLAPSE SIDEBAR'}
        >
          {collapsed ? 'EXP' : 'HIDE'}
        </button>
      </div>

      {/* Primary Action Buttons (Text Only) */}
      {!collapsed && (
        <div className="p-3 space-y-2 border-b border-slate-200 bg-slate-100/50">
          <button
            onClick={onNewBook}
            className="w-full py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold tracking-wider uppercase transition-all shadow-sm active:scale-[0.98] text-center"
          >
            CREATE NEW DOCUMENT
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCommandPalette}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold tracking-wider uppercase transition-colors border border-slate-300 text-center"
            >
              QUICK COMMAND (⌘K)
            </button>
            <button
              onClick={onExport}
              className="py-1.5 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold tracking-wider uppercase transition-colors shadow-sm text-center"
            >
              EXPORT PDF
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Core Documents & Workflows Section */}
        <div>
          {!collapsed && (
            <div className="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              MAIN WORKSPACE
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activePage === 'dashboard' || activePage === 'documents'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {collapsed ? 'DOCS' : 'Documents'}
            </button>

            <button
              onClick={onNewBook}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activePage === 'create-new'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {collapsed ? 'NEW' : 'Create New'}
            </button>

            <button
              onClick={() => onNavigate('workflows')}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activePage === 'workflows'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {collapsed ? 'WORK' : 'Workflows'}
            </button>

            <button
              onClick={() => onNavigate('automation')}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activePage === 'automation'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {collapsed ? 'AUTO' : 'Automation Rules'}
            </button>

            <button
              onClick={() => onNavigate('templates')}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activePage === 'templates'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {collapsed ? 'TMPL' : 'Templates'}
            </button>
          </div>
        </div>

        {/* SYSTEM SETTINGS Section */}
        <div>
          {!collapsed && (
            <div className="px-2 mb-2 text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center justify-between">
              <span>SYSTEM SETTINGS</span>
              <span className="text-[9px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">ADMIN</span>
            </div>
          )}
          <div className="space-y-1 pl-1">
            <button
              onClick={() => onNavigate('user-management')}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activePage === 'user-management'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {collapsed ? 'USERS' : 'User Management'}
            </button>

            <button
              onClick={() => onNavigate('role-definitions')}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activePage === 'role-definitions'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {collapsed ? 'ROLES' : 'Role Definitions'}
            </button>

            <button
              onClick={() => onNavigate('audit-logs')}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activePage === 'audit-logs'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {collapsed ? 'LOGS' : 'Audit Logs'}
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className={`w-full text-left py-2 px-3 rounded-lg text-[13px] font-semibold transition-all ${
                activePage === 'settings'
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {collapsed ? 'CONF' : 'System Configuration'}
            </button>
          </div>
        </div>
      </nav>

      {/* Footer Profile & Admin Client Info */}
      <div className="p-3 border-t border-slate-200 bg-white">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-[12px] flex items-center justify-center flex-shrink-0">
              K
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-slate-900 truncate">
                Karthikeyan Admin
              </div>
              <div className="text-[10px] text-slate-500 font-semibold truncate">
                Administrator Client
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center">
              K
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
