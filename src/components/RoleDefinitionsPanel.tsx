import { useState } from 'react'
import type { SystemRole } from '../types'
import { ALL_PERMISSIONS_LIST, INITIAL_ROLES } from '../lib/mockAdminData'

export default function RoleDefinitionsPanel() {
  const [roles, setRoles] = useState<SystemRole[]>(() => {
    try {
      const saved = localStorage.getItem('figma.roles.v1')
      return saved ? (JSON.parse(saved) as SystemRole[]) : INITIAL_ROLES
    } catch {
      return INITIAL_ROLES
    }
  })

  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || 'role_admin')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [baseCloneId, setBaseCloneId] = useState('role_editor')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    window.setTimeout(() => setToastMessage(null), 3000)
  }

  const persistRoles = (nextRoles: SystemRole[]) => {
    setRoles(nextRoles)
    try {
      localStorage.setItem('figma.roles.v1', JSON.stringify(nextRoles))
    } catch {
      /* ignore */
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0]

  const handleTogglePermission = (permId: string) => {
    if (!selectedRole) return
    const currentPerms = selectedRole.permissions || []
    const hasPerm = currentPerms.includes(permId)
    const updatedPerms = hasPerm
      ? currentPerms.filter((id) => id !== permId)
      : [...currentPerms, permId]

    const nextRoles = roles.map((r) =>
      r.id === selectedRole.id ? { ...r, permissions: updatedPerms } : r
    )
    persistRoles(nextRoles)
  }

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) {
      showToast('Error: Role Name is required.')
      return
    }

    const base = roles.find((r) => r.id === baseCloneId)
    const clonedPerms = base ? [...base.permissions] : ['doc:read']

    const newRole: SystemRole = {
      id: `role_${Date.now().toString(36)}`,
      name: newRoleName.trim(),
      description: newRoleDesc.trim() || 'Custom role with defined administrative permissions.',
      userCount: 0,
      isSystem: false,
      permissions: clonedPerms,
    }

    const next = [...roles, newRole]
    persistRoles(next)
    setSelectedRoleId(newRole.id)
    setShowCreateModal(false)
    setNewRoleName('')
    setNewRoleDesc('')
    showToast(`Role "${newRole.name}" created successfully.`)
  }

  const handleDeleteRole = (roleId: string) => {
    const target = roles.find((r) => r.id === roleId)
    if (!target) return
    if (target.isSystem) {
      showToast('System roles cannot be deleted.')
      return
    }

    const next = roles.filter((r) => r.id !== roleId)
    persistRoles(next)
    if (selectedRoleId === roleId) {
      setSelectedRoleId(next[0]?.id || 'role_admin')
    }
    showToast(`Custom role "${target.name}" removed.`)
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
            <span className="text-slate-900 font-bold">ROLE DEFINITIONS & PERMISSIONS</span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            Role Definitions & Security Matrix
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Configure permissions for Administrator, Editor, Viewer, Document Specialist, and Custom Roles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold tracking-wide transition-all shadow-sm active:scale-[0.98]"
          >
            CREATE NEW ROLE
          </button>
        </div>
      </div>

      {/* Main Grid: Left Roles List, Right Permission Matrix */}
      <div className="flex-1 overflow-hidden p-8 flex flex-col md:flex-row gap-6">
        {/* Left Side: Role List */}
        <div className="w-full md:w-[320px] flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">
              System & Custom Roles ({roles.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {roles.map((r) => {
              const isSelected = r.id === selectedRoleId
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[14px]">{r.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        isSelected
                          ? 'bg-slate-800 text-slate-200 border border-slate-700'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {r.isSystem ? 'SYSTEM' : 'CUSTOM'}
                    </span>
                  </div>
                  <p
                    className={`text-[12px] line-clamp-2 leading-relaxed mb-2 ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {r.description}
                  </p>
                  <div className="flex items-center justify-between text-[11px] font-semibold pt-1 border-t border-slate-200/20">
                    <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                      USERS ASSIGNED: {r.userCount}
                    </span>
                    <span className={isSelected ? 'text-slate-200' : 'text-slate-700'}>
                      PERMISSIONS: {r.permissions?.length || 0}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Side: Permission Matrix Details */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {selectedRole ? (
            <>
              <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[18px] font-bold tracking-tight">{selectedRole.name}</h2>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {selectedRole.isSystem ? 'SYSTEM DEFAULT ROLE' : 'CUSTOM CLIENT ROLE'}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-300 mt-1 max-w-[600px]">
                    {selectedRole.description}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {!selectedRole.isSystem && (
                    <button
                      onClick={() => handleDeleteRole(selectedRole.id)}
                      className="px-3 py-1.5 rounded bg-rose-900/80 hover:bg-rose-900 text-rose-100 text-[11px] font-bold uppercase tracking-wider border border-rose-700"
                    >
                      DELETE ROLE
                    </button>
                  )}
                  <button
                    onClick={() => showToast(`Permissions updated and saved for ${selectedRole.name}.`)}
                    className="px-4 py-2 rounded bg-white hover:bg-slate-100 text-slate-900 text-[12px] font-bold uppercase tracking-wider shadow-sm"
                  >
                    SAVE PERMISSIONS
                  </button>
                </div>
              </div>

              {/* Matrix Categories */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {ALL_PERMISSIONS_LIST.map((cat) => (
                  <div key={cat.category} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 font-bold text-[13px] text-slate-800 uppercase tracking-wider">
                      {cat.category}
                    </div>

                    <div className="divide-y divide-slate-200 bg-white">
                      {cat.items.map((item) => {
                        const isChecked = selectedRole.permissions?.includes(item.id) || false
                        return (
                          <label
                            key={item.id}
                            className="p-4 flex items-start gap-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermission(item.id)}
                              className="mt-1 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[13px] text-slate-900">{item.name}</span>
                                <span className="text-[11px] font-mono text-slate-400">({item.id})</span>
                              </div>
                              <p className="text-[12px] text-slate-500 mt-0.5">{item.desc}</p>
                            </div>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase ${
                                isChecked
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {isChecked ? 'GRANTED' : 'DENIED'}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500">Select a role to view permissions</div>
          )}
        </div>
      </div>

      {/* CREATE NEW ROLE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[480px] overflow-hidden animate-slide-up">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold">CREATE CUSTOM ROLE</h3>
                <p className="text-[11px] text-slate-300">Define new client user role and permissions base.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-[12px] font-bold px-2 py-1 uppercase"
              >
                CLOSE
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Role Title</label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Senior Curriculum Reviewer"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Describe scope of responsibilities and authorization..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">
                  Clone Base Permissions From
                </label>
                <select
                  value={baseCloneId}
                  onChange={(e) => setBaseCloneId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.permissions.length} perms)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-bold uppercase tracking-wider"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold uppercase tracking-wider shadow-sm"
                >
                  CREATE ROLE DEFINITION
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
