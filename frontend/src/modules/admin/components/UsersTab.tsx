import { useMemo, useState } from 'react'
import {
  Activity,
  Check,
  CheckCircle2,
  CheckSquare,
  Copy,
  Eye,
  FolderKanban,
  Loader2,
  Pencil,
  Power,
  Search,
  Square,
  X,
} from 'lucide-react'
import type { User, UserRole } from '../../../types'
import {
  ROLE_AVATAR_GRADIENTS,
  ROLE_COLORS,
  ROLE_META,
  ROLE_OPTIONS,
  type UserActivityStats,
  type UserWorkspaceMembership,
  getInitials,
} from '../constants'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'

interface UsersTabProps {
  users: User[]
  currentUserId?: string
  loading: boolean
  membershipsByUser: Record<string, UserWorkspaceMembership[]>
  activityByUser: Record<string, UserActivityStats>
  activeAdminCount: number
  onInspectUser: (user: User) => void
  onEditUser: (user: User) => void
  onToggleStatus: (user: User) => Promise<void>
  onBulkUpdateRole: (userIds: string[], role: UserRole) => Promise<void>
  onBulkUpdateStatus: (userIds: string[], status: 'ACTIVE' | 'INACTIVE') => Promise<void>
}

type SortKey = 'hierarchy' | 'name' | 'activity' | 'recent'
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

export function UsersTab({
  users,
  currentUserId,
  loading,
  membershipsByUser,
  activityByUser,
  activeAdminCount,
  onInspectUser,
  onEditUser,
  onToggleStatus,
  onBulkUpdateRole,
  onBulkUpdateStatus,
}: UsersTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('hierarchy')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkRole, setBulkRole] = useState<UserRole>('Lector')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    users.forEach(u => {
      counts[u.role] = (counts[u.role] || 0) + 1
    })
    return counts
  }, [users])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = users.filter(u => {
      const matchesSearch =
        !q ||
        u.display_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      const matchesRole = !roleFilter || u.role === roleFilter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? u.status === 'ACTIVE' : u.status !== 'ACTIVE')
      return matchesSearch && matchesRole && matchesStatus
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'hierarchy') {
        const diff = (ROLE_META[b.role]?.level ?? 0) - (ROLE_META[a.role]?.level ?? 0)
        return diff !== 0 ? diff : a.display_name.localeCompare(b.display_name, 'es')
      }
      if (sortBy === 'name') {
        return a.display_name.localeCompare(b.display_name, 'es')
      }
      if (sortBy === 'activity') {
        return (activityByUser[b.id]?.count ?? 0) - (activityByUser[a.id]?.count ?? 0)
      }
      return (b.created_at || '').localeCompare(a.created_at || '')
    })
  }, [activityByUser, roleFilter, searchQuery, sortBy, statusFilter, users])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize)

  const selectablePageUsers = paginatedUsers.filter(u => u.id !== currentUserId)
  const allPageSelected =
    selectablePageUsers.length > 0 &&
    selectablePageUsers.every(u => selectedIds.includes(u.id))

  const validSelectedIds = selectedIds.filter(
    id => id !== currentUserId && users.some(u => u.id === id)
  )

  function toggleRowSelect(id: string) {
    if (id === currentUserId) return
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function toggleSelectAllPage() {
    const pageIds = selectablePageUsers.map(u => u.id)
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  async function handleCopyEmail(u: User) {
    await navigator.clipboard.writeText(u.email).catch(() => {})
    setCopiedId(u.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function handleQuickToggleStatus(u: User) {
    setTogglingId(u.id)
    try {
      await onToggleStatus(u)
    } finally {
      setTogglingId(null)
    }
  }

  async function handleApplyBulkRole() {
    if (validSelectedIds.length === 0) return
    setBulkBusy(true)
    try {
      await onBulkUpdateRole(validSelectedIds, bulkRole)
      setSelectedIds([])
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleApplyBulkStatus(status: 'ACTIVE' | 'INACTIVE') {
    if (validSelectedIds.length === 0) return
    setBulkBusy(true)
    try {
      await onBulkUpdateStatus(validSelectedIds, status)
      setSelectedIds([])
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[210px] max-w-xs">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar nombre, correo o ID..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
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
              ...ROLE_OPTIONS.map(r => ({
                value: r,
                label: `${r} (${roleCounts[r] || 0})`,
              })),
            ]}
          />

          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1">
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'ACTIVE', label: 'Activos' },
                { id: 'INACTIVE', label: 'Inactivos' },
              ] as Array<{ id: StatusFilter; label: string }>
            ).map(st => {
              const active = statusFilter === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st.id)
                    setCurrentPage(1)
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    active
                      ? 'bg-cyan-500/20 text-white border border-cyan-400/40'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {st.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">Orden:</span>
          <SystemSelect
            value={sortBy}
            onChange={val => setSortBy(val as SortKey)}
            size="sm"
            className="w-44"
            ariaLabel="Ordenar tabla de usuarios"
            options={[
              { value: 'hierarchy', label: 'Jerarquía RBAC' },
              { value: 'name', label: 'Nombre (A-Z)' },
              { value: 'activity', label: 'Mayor actividad' },
              { value: 'recent', label: 'Más recientes' },
            ]}
          />
        </div>
      </div>

      {validSelectedIds.length > 0 && (
        <div className="nl-cyber-panel rounded-2xl px-4 py-2.5 border border-cyan-400/40 bg-cyan-500/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 font-bold">
              {validSelectedIds.length} seleccionadas
            </span>
            <span className="text-slate-300 font-medium">Acciones en lote:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SystemSelect
              value={bulkRole}
              onChange={val => setBulkRole(val as UserRole)}
              size="xs"
              className="w-48"
              ariaLabel="Rol para aplicar en lote"
              options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
            />
            <button
              type="button"
              disabled={bulkBusy}
              onClick={handleApplyBulkRole}
              className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold disabled:opacity-45"
            >
              Aplicar rol
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleApplyBulkStatus('ACTIVE')}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-45"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Activar</span>
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleApplyBulkStatus('INACTIVE')}
              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-bold disabled:opacity-45"
            >
              Suspender
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setSelectedIds([])}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70"
              title="Limpiar selección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="nl-cyber-panel animate-card-reveal nl-stagger-1 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm text-slate-300 font-semibold">
              No se encontraron usuarios con esos filtros
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setRoleFilter('')
                setStatusFilter('ALL')
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/60">
                  <tr>
                    <th className="pl-4 pr-2 py-3 text-left w-9">
                      <button
                        type="button"
                        onClick={toggleSelectAllPage}
                        aria-label="Seleccionar página"
                        className="text-slate-400 hover:text-cyan-300 transition-colors"
                      >
                        {allPageSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    {['Usuario', 'Rol RBAC', 'Áreas Asignadas', 'Actividad', 'Estado', 'Acciones'].map(
                      h => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-slate-400 text-[11px] uppercase tracking-wider font-bold ${
                            h === 'Acciones' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedUsers.map(u => {
                    const isActive = u.status === 'ACTIVE'
                    const isSelf = u.id === currentUserId
                    const isSelected = validSelectedIds.includes(u.id)
                    const isLastActiveAdmin =
                      u.role === 'Administrador' && isActive && activeAdminCount <= 1
                    const cannotToggleStatus = isSelf || isLastActiveAdmin
                    const avatarGrad =
                      ROLE_AVATAR_GRADIENTS[u.role] || 'from-indigo-500 to-violet-600'
                    const memberships = membershipsByUser[u.id] || []
                    const act = activityByUser[u.id]
                    const roleMeta = ROLE_META[u.role]

                    return (
                      <tr
                        key={u.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="pl-4 pr-2 py-3.5">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => toggleRowSelect(u.id)}
                            title={isSelf ? 'Tu sesión activa está protegida' : 'Seleccionar'}
                            className="text-slate-500 hover:text-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div
                                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                              >
                                {getInitials(u.display_name)}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#071226] ${
                                  isActive ? 'bg-emerald-400' : 'bg-rose-400'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onInspectUser(u)}
                                  className="text-white font-semibold hover:text-cyan-300 transition-colors truncate max-w-[190px] text-left"
                                >
                                  {u.display_name}
                                </button>
                                {isSelf && (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 text-[9.5px] font-bold">
                                    Tú
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-slate-400">
                                <button
                                  type="button"
                                  onClick={() => handleCopyEmail(u)}
                                  className="inline-flex items-center gap-1 hover:text-cyan-300 transition-colors"
                                  title="Copiar correo"
                                >
                                  <span className="truncate max-w-[165px]">{u.email}</span>
                                  {copiedId === u.id ? (
                                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-slate-600 shrink-0" />
                                  )}
                                </button>
                                <span className="text-slate-600 hidden xl:inline">· {u.id}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <span
                              className={`inline-block text-xs px-2.5 py-0.5 rounded-lg font-medium ${
                                ROLE_COLORS[u.role] || 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {u.role}
                            </span>
                            <p className="text-[10.5px] font-mono text-slate-500">
                              Nivel {roleMeta?.level ?? 1}/5
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => onInspectUser(u)}
                            className="flex flex-wrap items-center gap-1 text-left group"
                            title="Gestionar áreas asignadas"
                          >
                            {memberships.length === 0 ? (
                              <span className="text-[11px] text-slate-500 group-hover:text-cyan-300 transition-colors inline-flex items-center gap-1">
                                <FolderKanban className="w-3 h-3" />
                                <span>Sin áreas</span>
                              </span>
                            ) : (
                              <>
                                {memberships.slice(0, 2).map(m => (
                                  <span
                                    key={m.projectId}
                                    className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 group-hover:border-cyan-500/40 text-slate-300 text-[10.5px] max-w-[130px] truncate"
                                  >
                                    {m.projectName}
                                  </span>
                                ))}
                                {memberships.length > 2 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 text-[10px] font-mono font-bold">
                                    +{memberships.length - 2}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            <p className="text-xs font-mono text-white flex items-center gap-1.5">
                              <Activity className="w-3 h-3 text-emerald-400" />
                              <span>{act?.count ?? 0} ev.</span>
                            </p>
                            <p className="text-[10.5px] font-mono text-slate-500">
                              {act?.lastAt
                                ? new Date(act.lastAt).toLocaleDateString('es')
                                : u.created_at
                                  ? `Alta ${new Date(u.created_at).toLocaleDateString('es')}`
                                  : '—'}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                isActive
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive ? 'bg-emerald-400' : 'bg-rose-400'
                                }`}
                              />
                              {isActive ? 'Activo' : 'Inactivo'}
                            </span>

                            <button
                              type="button"
                              disabled={cannotToggleStatus || togglingId === u.id}
                              onClick={() => handleQuickToggleStatus(u)}
                              title={
                                cannotToggleStatus
                                  ? 'No se puede suspender esta cuenta protegida'
                                  : isActive
                                    ? 'Suspender cuenta'
                                    : 'Reactivar cuenta'
                              }
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                            >
                              {togglingId === u.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Power className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onInspectUser(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Perfil</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditUser(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <Pencil className="w-3 h-3 text-indigo-400" />
                              <span>Editar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
        )}
      </div>

      {!loading && filteredUsers.length > 0 && (
        <PaginationBar
          variant="card"
          className="mt-auto"
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
      )}
    </div>
  )
}
