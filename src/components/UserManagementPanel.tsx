import { useMemo, useState } from 'react'
import type { UserAccount, UserRole } from '../types'
import { INITIAL_USERS } from '../lib/mockAdminData'

export default function UserManagementPanel() {
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem('figma.users.v1')
      return saved ? (JSON.parse(saved) as UserAccount[]) : INITIAL_USERS
    } catch {
      return INITIAL_USERS
    }
  })

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  const [resetPassUser, setResetPassUser] = useState<UserAccount | null>(null)
  const [generatedTempPass, setGeneratedTempPass] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Form inputs for Add/Edit
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('Editor')
  const [formDepartment, setFormDepartment] = useState('Publishing Operations')
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active')

  const showToast = (msg: string) => {
    setToastMessage(msg)
    window.setTimeout(() => setToastMessage(null), 3000)
  }

  const persistUsers = (newUsers: UserAccount[]) => {
    setUsers(newUsers)
    try {
      localStorage.setItem('figma.users.v1', JSON.stringify(newUsers))
    } catch {
      /* ignore */
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchQuery =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.department.toLowerCase().includes(search.toLowerCase())
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter
      return matchQuery && matchRole && matchStatus
    })
  }, [users, search, roleFilter, statusFilter])

  const openAddModal = () => {
    setFormName('')
    setFormEmail('')
    setFormRole('Editor')
    setFormDepartment('Publishing Operations')
    setFormStatus('Active')
    setShowAddModal(true)
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formEmail.trim()) {
      showToast('Error: Name and Email are required.')
      return
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now().toString(36)}`,
      name: formName.trim(),
      email: formEmail.trim(),
      role: formRole,
      department: formDepartment.trim() || 'General',
      status: formStatus,
      lastActive: 'Just now',
      createdDate: new Date().toISOString().split('T')[0],
      permissions: ['doc:read', 'doc:edit', 'doc:export'],
    }

    const next = [newUser, ...users]
    persistUsers(next)
    setShowAddModal(false)
    showToast(`User "${newUser.name}" added successfully as ${newUser.role}.`)
  }

  const openEditModal = (u: UserAccount) => {
    setEditingUser(u)
    setFormName(u.name)
    setFormEmail(u.email)
    setFormRole(u.role)
    setFormDepartment(u.department)
    setFormStatus(u.status)
  }

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    const updated = users.map((u) => {
      if (u.id === editingUser.id) {
        return {
          ...u,
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          department: formDepartment.trim(),
          status: formStatus,
        }
      }
      return u
    })

    persistUsers(updated)
    setEditingUser(null)
    showToast(`User account "${formName}" updated successfully.`)
  }

  const handleToggleStatus = (u: UserAccount) => {
    const nextStatus = u.status === 'Active' ? 'Inactive' : 'Active'
    const updated = users.map((user) => (user.id === u.id ? { ...user, status: nextStatus } : user))
    persistUsers(updated)
    showToast(`User "${u.name}" is now ${nextStatus}.`)
  }

  const handleOpenResetPassword = (u: UserAccount) => {
    setResetPassUser(u)
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    setGeneratedTempPass(`PAS-${randomCode}-2026`)
  }

  const handleConfirmPasswordReset = () => {
    if (resetPassUser) {
      showToast(`Password reset link & temporary key sent to ${resetPassUser.email}.`)
      setResetPassUser(null)
      setGeneratedTempPass(null)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-lg bg-slate-900 text-white text-[13px] font-medium shadow-xl border border-slate-700 animate-slide-up">
          {toastMessage}
        </div>
      )}

      {/* Header bar */}
      <div className="px-8 py-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 tracking-wider uppercase mb-1">
            <span>SYSTEM SETTINGS</span>
            <span>/</span>
            <span className="text-slate-900 font-bold">USER MANAGEMENT</span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            User Accounts & Client Governance
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            View, add, modify, deactivate, and manage client user accounts and assigned roles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold tracking-wide transition-all shadow-sm active:scale-[0.98]"
          >
            ADD NEW USER
          </button>
        </div>
      </div>

      {/* Filter and Stats Bar */}
      <div className="px-8 py-4 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-[340px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, email, or department..."
              className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-500">ROLE:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-[12px] font-medium text-slate-800 focus:outline-none focus:border-slate-800"
            >
              <option value="ALL">All Roles</option>
              <option value="Administrator">Administrator</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
              <option value="Document Specialist">Document Specialist</option>
              <option value="Audit Manager">Audit Manager</option>
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
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="text-[12px] font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200">
          SHOWING {filteredUsers.length} OF {users.length} USERS
        </div>
      </div>

      {/* Main Content Area - Users Data Table */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-5">User Name</th>
                <th className="py-3.5 px-5">Email</th>
                <th className="py-3.5 px-5">Role</th>
                <th className="py-3.5 px-5">Department</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Last Active</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[13px]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-[14px] text-slate-700">No users match your filter criteria</p>
                    <p className="text-[12px] mt-1">Try adjusting search term or role filter</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-[12px] flex items-center justify-center flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">ID: {u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-700 font-mono text-[12px]">{u.email}</td>
                    <td className="py-3.5 px-5">
                      <span className="inline-block px-2.5 py-1 rounded text-[11px] font-bold tracking-wide uppercase bg-slate-100 text-slate-800 border border-slate-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600">{u.department}</td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          u.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 text-[12px]">{u.lastActive}</td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold uppercase tracking-wider transition-colors border border-slate-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-colors border ${
                            u.status === 'Active'
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}
                        >
                          {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleOpenResetPassword(u)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider transition-colors border border-slate-300"
                        >
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD NEW USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[500px] overflow-hidden animate-slide-up">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold">ADD NEW USER ACCOUNT</h3>
                <p className="text-[11px] text-slate-300">Create a new client account and assign user permissions.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-[12px] font-bold px-2 py-1 uppercase"
              >
                CLOSE
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. rajesh@studycircle.org"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Assigned Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Editor">Editor</option>
                    <option value="Viewer">Viewer</option>
                    <option value="Document Specialist">Document Specialist</option>
                    <option value="Audit Manager">Audit Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Department</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Initial Status</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-[13px] font-medium text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={formStatus === 'Active'}
                      onChange={() => setFormStatus('Active')}
                      className="accent-slate-900"
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-[13px] font-medium text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={formStatus === 'Inactive'}
                      onChange={() => setFormStatus('Inactive')}
                      className="accent-slate-900"
                    />
                    Inactive
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-bold uppercase tracking-wider"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold uppercase tracking-wider shadow-sm"
                >
                  CREATE USER ACCOUNT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[500px] overflow-hidden animate-slide-up">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold">EDIT USER ACCOUNT</h3>
                <p className="text-[11px] text-slate-300">Modify details and permissions for {editingUser.name}.</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white text-[12px] font-bold px-2 py-1 uppercase"
              >
                CLOSE
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Assigned Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Editor">Editor</option>
                    <option value="Viewer">Viewer</option>
                    <option value="Document Specialist">Document Specialist</option>
                    <option value="Audit Manager">Audit Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Department</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 uppercase mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'Active' | 'Inactive')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] text-slate-900 focus:outline-none focus:border-slate-800"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-bold uppercase tracking-wider"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold uppercase tracking-wider shadow-sm"
                >
                  SAVE CHANGES
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD DIALOG */}
      {resetPassUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[460px] overflow-hidden animate-slide-up">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-[16px] font-bold">RESET PASSWORD</h3>
              <button
                onClick={() => setResetPassUser(null)}
                className="text-slate-400 hover:text-white text-[12px] font-bold px-2 py-1 uppercase"
              >
                CLOSE
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[13px] text-slate-700 leading-relaxed">
                Generate a temporary reset key and email password reset instructions to{' '}
                <strong className="font-mono text-slate-900">{resetPassUser.email}</strong>.
              </p>

              <div className="p-4 rounded-lg bg-slate-100 border border-slate-300 space-y-1">
                <div className="text-[11px] font-bold uppercase text-slate-500">Temporary Access Key</div>
                <div className="font-mono text-[16px] font-bold text-slate-900 select-all">
                  {generatedTempPass}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  onClick={() => setResetPassUser(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-bold uppercase tracking-wider"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleConfirmPasswordReset}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold uppercase tracking-wider shadow-sm"
                >
                  SEND RESET LINK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
