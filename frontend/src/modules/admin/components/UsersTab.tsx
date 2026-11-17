import { useState } from 'react'
import { Loader2, Pencil, Search, Shield, UserPlus } from 'lucide-react'
import type { User } from '../../../types'
import { ROLE_COLORS, ROLE_OPTIONS } from '../constants'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'
import { CreateUserModal } from './CreateUserModal'
import { EditUserModal } from './EditUserModal'
import { RbacMatrixModal } from './RbacMatrixModal'

interface UsersTabProps {
  users: User[]
  currentUserId?: string
  loading: boolean
  onUpdateUser: (userId: string, updates: { role: string; status: string }) => Promise<void>
  onCreateUser: (payload: { email: string; display_name: string; password: string; role: string }) => Promise<void>
}

export function UsersTab({ users, currentUserId, loading, onUpdateUser, onCreateUser }: UsersTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRbacModal, setShowRbacModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)

  const filteredUsers = users.filter(u => {
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !q ||
      u.display_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    const matchesRole = !roleFilter || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar usuario o correo..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <SystemSelect
            value={roleFilter}
            onChange={val => {
              setRoleFilter(val)
              setCurrentPage(1)
            }}
            size="sm"
            className="w-full sm:w-56"
            ariaLabel="Filtrar usuarios por rol RBAC"
            options={[
              { value: '', label: `Todos los roles (${users.length})` },
              ...ROLE_OPTIONS.map(r => ({ value: r, label: r })),
            ]}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowRbacModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-950/75 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Permisos RBAC</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="nl-btn-shimmer nl-accent-bg nl-accent-glow flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {showRbacModal && (
        <RbacMatrixModal onClose={() => setShowRbacModal(false)} />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          isSelf={editingUser.id === currentUserId}
          onClose={() => setEditingUser(null)}
          onSave={onUpdateUser}
        />
      )}

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreate={onCreateUser}
        />
      )}

      <div className="nl-surface rounded-2xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm text-slate-300 font-semibold">No se encontraron usuarios con esos filtros</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setRoleFilter('') }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60">
                <tr>
                  {['Usuario', 'Email', 'Rol RBAC', 'Estado', 'Registrado', 'Acciones'].map(h => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-slate-400 text-[11px] uppercase tracking-wider font-bold ${
                        h === 'Acciones' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedUsers.map(u => {
                  const isActive = u.status === 'ACTIVE'
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                            {u.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-white font-semibold">{u.display_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block text-xs px-2.5 py-1 rounded-lg font-medium ${ROLE_COLORS[u.role] || 'bg-slate-700 text-slate-300'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          {isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('es') : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Pencil className="w-3 h-3 text-indigo-400" />
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            currentPage={safePage}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            pageSizeOptions={[5, 8, 15, 30]}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            itemLabel="usuarios"
          />
        </>
        )}
      </div>
    </div>
  )
}
