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
  const [openAiApiKey, setOpenAiApiKey] = useState(() => {
    return localStorage.getItem('OPENAI_API_KEY') || import.meta.env.VITE_OPENAI_API_KEY || ''
  })
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (openAiApiKey.trim()) {
      localStorage.setItem('OPENAI_API_KEY', openAiApiKey.trim())
    } else {
      localStorage.removeItem('OPENAI_API_KEY')
    }
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

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
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'user-management' && <UserManagementPanel />}
        {activeTab === 'role-definitions' && <RoleDefinitionsPanel />}
        {activeTab === 'audit-logs' && <AuditLogsPanel />}
        {activeTab === 'config' && (
          <div className="p-8 max-w-[680px] mx-auto space-y-6">
            {/* OpenAI ChatGPT API Key & Cloud Credentials */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-[16px] font-bold text-slate-900">
                    OpenAI ChatGPT Paid API Key & AI Integration
                  </h2>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    Powered by OpenAI gpt-4o for OCR document scanning and MCQ auto-solving
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Paid API Ready
                </span>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase text-slate-700 mb-1.5">
                  OpenAI Secret API Key (sk-...)
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={openAiApiKey}
                    onChange={(e) => setOpenAiApiKey(e.target.value)}
                    placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-3.5 pr-20 py-2.5 rounded-lg border border-slate-300 text-[13px] text-slate-900 font-mono focus:outline-none focus:border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded border border-slate-200 uppercase"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Stored securely in your local environment / browser session. You can also paste this into your <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">.env</code> file under <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">VITE_OPENAI_API_KEY</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[12px] font-bold text-slate-800">
                  Google Service Account Key Status
                </div>
                <p className="text-[11px] text-slate-600">
                  Google Drive / Service account keys are configured in your root <code className="bg-white px-1 py-0.5 rounded text-slate-800 border border-slate-200 font-mono">.env</code> file (<code className="bg-white px-1 py-0.5 rounded text-slate-800 border border-slate-200 font-mono">VITE_GOOGLE_SERVICE_ACCOUNT_KEY</code>).
                </p>
              </div>
            </div>

            {/* Global Standards */}
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
                  onClick={handleSave}
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
