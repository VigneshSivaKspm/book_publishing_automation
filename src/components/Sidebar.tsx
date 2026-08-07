import type { Page } from '../types'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  onExport: () => void
  onCommandPalette: () => void
  onNewBook: () => void
}

const navItems: { id: Page; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    hint: 'Book Management',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.55" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.55" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.35" />
      </svg>
    ),
  },
  {
    id: 'editor',
    label: 'Publishing Studio',
    hint: '4-Stage Workflow',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 2l4 4-8 8H2v-4l8-8z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </svg>
    ),
  },
]

export default function Sidebar({ activePage, onNavigate, onExport, onCommandPalette, onNewBook }: SidebarProps) {
  return (
    <aside
      className="flex flex-col h-full flex-shrink-0"
      style={{
        width: '236px',
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      <div
        className="flex items-center h-[56px] px-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #0E7490, #0D9488)' }}
          >
            F
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-bold tracking-tight truncate" style={{ color: 'var(--ink)' }}>
              Figma
            </div>
            <div className="text-[10px] font-medium" style={{ color: 'var(--primary)' }}>
              Automated Publishing Suite
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2 space-y-2">
        <button
          onClick={onNewBook}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-all hover:opacity-95 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #0E7490, #0D9488)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          New Book
        </button>
        <button
          onClick={onCommandPalette}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-colors hover:bg-[var(--muted)]"
          style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          <span className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9 9l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Quick command
          </span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)' }}>
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {navItems.map((item) => {
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-all relative group"
              style={{
                background: isActive ? 'rgba(14, 116, 144, 0.1)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                  style={{ background: 'var(--primary)' }}
                />
              )}
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1 min-w-0">
                <span
                  className="block text-[13px] font-medium group-hover:text-[var(--ink)] transition-colors"
                  style={{ color: isActive ? 'var(--primary)' : undefined }}
                >
                  {item.label}
                </span>
                <span className="block text-[10px] opacity-70">{item.hint}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="px-3 py-3">
        <button
          onClick={onExport}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-emerald-50"
          style={{ color: 'var(--success)', border: '1px solid rgba(5,150,105,0.25)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 1v8M4 6l3 3 3-3M1 10v1a2 2 0 002 2h8a2 2 0 002-2v-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Export A4 · B5 · 8×8
        </button>
      </div>

      <div className="px-2 pb-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <div className="pt-2 space-y-0.5">
          <button
            onClick={() => onNavigate('settings')}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-[var(--muted)] transition-colors"
            style={{ color: activePage === 'settings' ? 'var(--primary)' : 'var(--muted-foreground)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[13px] font-medium">Settings</span>
          </button>
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0E7490, #134E4A)' }}
            >
              K
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                Karthikeyan
              </div>
              <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                Publishing Lead
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
