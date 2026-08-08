import { useMemo, useState } from 'react'
import type { AuditLogEntry } from '../types'
import { INITIAL_AUDIT_LOGS } from '../lib/mockAdminData'

export default function AuditLogsPanel() {
  const [logs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [inspectLog, setInspectLog] = useState<AuditLogEntry | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    window.setTimeout(() => setToastMessage(null), 3000)
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const q = search.toLowerCase()
      const matchSearch =
        l.user.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.ipAddress.includes(q)
      const matchCategory = categoryFilter === 'ALL' || l.category === categoryFilter
      const matchStatus = statusFilter === 'ALL' || l.status === statusFilter
      return matchSearch && matchCategory && matchStatus
    })
  }, [logs, search, categoryFilter, statusFilter])

  const handleExportCsv = () => {
    const header = 'ID,Timestamp,User,Email,Role,Action,Category,IPAddress,Status,Details\n'
    const rows = filteredLogs
      .map(
        (l) =>
          `"${l.id}","${l.timestamp}","${l.user}","${l.userEmail}","${l.role}","${l.action}","${l.category}","${l.ipAddress}","${l.status}","${l.details.replace(
            /"/g,
            '""'
          )}"`
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Audit log report exported as CSV file.')
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-lg bg-slate-900 text-white text-[13px] font-medium shadow-xl border border-slate-700 animate-slide-up">
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <div className="px-8 py-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 tracking-wider uppercase mb-1">
            <span>SYSTEM SETTINGS</span>
            <span>/</span>
            <span className="text-slate-900 font-bold">SECURITY AUDIT LOGS</span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            System Activity & Compliance Audit Stream
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Track real-time security events, role modifications, document scans, authentication attempts, and system actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold tracking-wide transition-all shadow-sm active:scale-[0.98]"
          >
            EXPORT AUDIT LOGS (CSV)
          </button>
        </div>
      </div>

      {/* Filter and Controls */}
      <div className="px-8 py-4 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-[340px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, action, IP, or log details..."
              className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-500">CATEGORY:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-[12px] font-medium text-slate-800 focus:outline-none focus:border-slate-800"
            >
              <option value="ALL">All Categories</option>
              <option value="User Management">User Management</option>
              <option value="Role Modified">Role Modified</option>
              <option value="Document Processing">Document Processing</option>
              <option value="System Security">System Security</option>
              <option value="Workflow Execution">Workflow Execution</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-500">STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-[12px] font-medium text-slate-800 focus:outline-none focus:border-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="WARNING">WARNING</option>
              <option value="FAILURE">FAILURE</option>
            </select>
          </div>
        </div>

        <div className="text-[12px] font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200">
          LOG ENTRIES: {filteredLogs.length} OF {logs.length}
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-5">Timestamp</th>
                <th className="py-3.5 px-5">User Account</th>
                <th className="py-3.5 px-5">Action Type</th>
                <th className="py-3.5 px-5">Category</th>
                <th className="py-3.5 px-5">Event Details</th>
                <th className="py-3.5 px-5">IP Address</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[13px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-[14px] text-slate-700">No audit log records match search filter</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[12px] text-slate-600 whitespace-nowrap">
                      {l.timestamp}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{l.user}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{l.role}</div>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-800 text-[12px]">{l.action}</td>
                    <td className="py-3.5 px-5">
                      <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {l.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 max-w-[320px] truncate">{l.details}</td>
                    <td className="py-3.5 px-5 font-mono text-[12px] text-slate-500">{l.ipAddress}</td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                          l.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : l.status === 'WARNING'
                            ? 'bg-amber-50 text-amber-900 border border-amber-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => setInspectLog(l)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold uppercase tracking-wider border border-slate-300"
                      >
                        DETAILS
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT LOG MODAL */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[550px] overflow-hidden animate-slide-up">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold">AUDIT LOG EVENT DETAILS</h3>
                <p className="text-[11px] text-slate-300">Log Reference ID: {inspectLog.id}</p>
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="text-slate-400 hover:text-white text-[12px] font-bold px-2 py-1 uppercase"
              >
                CLOSE
              </button>
            </div>

            <div className="p-6 space-y-4 text-[13px]">
              <div className="grid grid-cols-2 gap-4 bg-slate-100 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">User Account</span>
                  <span className="font-bold text-slate-900">{inspectLog.user}</span>
                  <span className="block text-[11px] font-mono text-slate-600">{inspectLog.userEmail}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">User Role</span>
                  <span className="font-bold text-slate-900">{inspectLog.role}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Timestamp</span>
                  <span className="font-mono text-slate-800">{inspectLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">IP Address</span>
                  <span className="font-mono text-slate-800">{inspectLog.ipAddress}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Event Action</span>
                <span className="text-[14px] font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded border border-slate-300 block">
                  {inspectLog.action} ({inspectLog.category})
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Full Description</span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 font-mono text-[12px] leading-relaxed">
                  {inspectLog.details}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end">
                <button
                  onClick={() => setInspectLog(null)}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold uppercase tracking-wider shadow-sm"
                >
                  DISMISS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
