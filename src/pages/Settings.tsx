import { useState } from 'react'
import UserManagementPanel from '../components/UserManagementPanel'
import RoleDefinitionsPanel from '../components/RoleDefinitionsPanel'
import AuditLogsPanel from '../components/AuditLogsPanel'

export default function Settings({ onBack, defaultTab = 'user-management' }: { onBack?: () => void; defaultTab?: string }) {
  const [activeTab, setActiveTab] = useState<'user-management' | 'role-definitions' | 'audit-logs' | 'config'>(
    defaultTab as any || 'user-management'
  )
  const [pageSize, setPageSize] = useState('A4')
  const [defaultLanguage, setDefaultLanguage] = useState('English')
  const [saved, setSaved] = useState(false)

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-8 pt-5 pb-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              SYSTEM ADMINISTRATION
            </div>
            <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">
              Settings & Organization Governance
            </h1>
          </div>

          {onBack && (
            <button
              onClick={onBack}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold uppercase tracking-wider transition-colors border border-slate-300"
            >
              BACK TO DOCUMENTS
            </button>
          )}
        </div>

        {/* Text-based Tabs */}
        <div className="flex items-center gap-2 border-b border-transparent text-[13px] font-bold">
          <button
            onClick={() => setActiveTab('user-management')}
            className={`pb-3 px-3 border-b-2 transition-all uppercase tracking-wider ${
              activeTab === 'user-management'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            USER MANAGEMENT
          </button>
          <button
            onClick={() => setActiveTab('role-definitions')}
            className={`pb-3 px-3 border-b-2 transition-all uppercase tracking-wider ${
              activeTab === 'role-definitions'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ROLE DEFINITIONS
          </button>
          <button
            onClick={() => setActiveTab('audit-logs')}
            className={`pb-3 px-3 border-b-2 transition-all uppercase tracking-wider ${
              activeTab === 'audit-logs'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            AUDIT LOGS
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-3 px-3 border-b-2 transition-all uppercase tracking-wider ${
              activeTab === 'config'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            SYSTEM CONFIGURATION
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'user-management' && <UserManagementPanel />}
        {activeTab === 'role-definitions' && <RoleDefinitionsPanel />}
        {activeTab === 'audit-logs' && <AuditLogsPanel />}
        {activeTab === 'config' && (
          <div className="p-8 max-w-[640px] mx-auto space-y-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
              <h2 className="text-[16px] font-bold text-slate-900 border-b border-slate-200 pb-3">
                Global Document & System Standards
              </h2>

              <div>
                <label className="block text-[12px] font-bold uppercase text-slate-700 mb-1.5">
                  Default Publication Page Size
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                >
                  <option value="A4">A4 (210 × 297 mm) — Standard Academic</option>
                  <option value="B5">B5 (176 × 250 mm) — Exam Test Booklet</option>
                  <option value="8×8">8×8 Inches (203 × 203 mm) — Square Guide</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase text-slate-700 mb-1.5">
                  Default OCR Language Engine
                </label>
                <select
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                >
                  <option value="English">English (eng)</option>
                  <option value="Tamil">Tamil (tam)</option>
                  <option value="English+Tamil">English + Tamil Combined (eng+tam)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end">
                <button
                  onClick={() => {
                    setSaved(true)
                    window.setTimeout(() => setSaved(false), 2000)
                  }}
                  className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold uppercase tracking-wider shadow-sm transition-colors"
                >
                  {saved ? 'CONFIGURATION SAVED' : 'SAVE CONFIGURATION'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
