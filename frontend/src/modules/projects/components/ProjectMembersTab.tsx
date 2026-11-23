import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Crown,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { api } from '../../../services/api'
import type { ProjectMember, User, UserRole } from '../../../types'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'
import { SystemTooltip } from '../../../components/InfoTip'
import { useToast } from '../../../components/toast/ToastContext'
import { RoleBadge } from './ProjectBadges'

export const ROLE_OPTIONS = [
  'Administrador',
  'Responsable de proyecto',
  'Ingeniero/analista de IA',
  'Revisor',
  'Lector',
] as const

const ROLE_META: Record<
  UserRole,
  { description: string; avatarClass: string }
> = {
  Administrador: {
    description: 'Control total de configuración, accesos, modelos y gobernanza.',
    avatarClass: 'bg-red-500/15 text-red-300 border-red-500/35',
  },
  'Responsable de proyecto': {
    description: 'Coordina el workspace, miembros, entregas y ciclo completo.',
    avatarClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35',
  },
  'Ingeniero/analista de IA': {
    description: 'Diseña arquitecturas, carga datasets y entrena redes Keras.',
    avatarClass: 'bg-violet-500/15 text-violet-300 border-violet-500/35',
  },
  Revisor: {
    description: 'Evalúa métricas, audita modelos y aprueba versiones.',
    avatarClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
  },
  Lector: {
    description: 'Consulta resultados, reportes y métricas en solo lectura.',
    avatarClass: 'bg-slate-700/40 text-slate-300 border-slate-600/50',
  },
}

const ACADEMIC_PREFIXES = new Set(['dr.', 'dra.', 'ing.', 'msc.', 'lic.', 'dr', 'dra', 'ing', 'msc', 'lic'])

function getInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 0 && !ACADEMIC_PREFIXES.has(token.toLowerCase()))
  const source = parts.length > 0 ? parts : displayName.trim().split(/\s+/).filter(Boolean)
  if (source.length === 0) return 'US'
  if (source.length === 1) return source[0].slice(0, 2).toUpperCase()
  return `${source[0][0] ?? ''}${source[1][0] ?? ''}`.toUpperCase()
}

type SortKey = 'recent' | 'name' | 'role'

interface ProjectMembersTabProps {
  projectId: string
  ownerId: string
  members: ProjectMember[]
  users: User[]
  showAddView: boolean
  onToggleAddView: (open: boolean) => void
  onMembersUpdated: (members: ProjectMember[]) => void
}

export function ProjectMembersTab({
  projectId,
  ownerId,
  members,
  users,
  showAddView,
  onToggleAddView,
  onMembersUpdated,
}: ProjectMembersTabProps) {
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('recent')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  const [candidateSearch, setCandidateSearch] = useState('')
  const [candidatePage, setCandidatePage] = useState(1)
  const [candidatePageSize, setCandidatePageSize] = useState(5)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [assignedRole, setAssignedRole] = useState<UserRole>('Ingeniero/analista de IA')
  const [submittingAdd, setSubmittingAdd] = useState(false)

  const memberIds = useMemo(() => new Set(members.map(m => m.user_id)), [members])
  const availableUsers = useMemo(() => users.filter(u => !memberIds.has(u.id)), [users, memberIds])

  useEffect(() => {
    setSelectedUserIds(prev => prev.filter(id => availableUsers.some(u => u.id === id)))
  }, [availableUsers])

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of ROLE_OPTIONS) counts[r] = 0
    for (const m of members) counts[m.role] = (counts[m.role] ?? 0) + 1
    return counts
  }, [members])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = members.filter(m => {
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false
      if (!q) return true
      return (
        m.display_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      )
    })

    const roleOrder = new Map<string, number>(ROLE_OPTIONS.map((r, i) => [r, i]))
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.display_name.localeCompare(b.display_name, 'es')
      }
      if (sortBy === 'role') {
        const diff = (roleOrder.get(a.role) ?? 99) - (roleOrder.get(b.role) ?? 99)
        return diff !== 0 ? diff : a.display_name.localeCompare(b.display_name, 'es')
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [members, search, roleFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedMembers = filteredMembers.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )

  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase()
    if (!q) return availableUsers
    return availableUsers.filter(
      u =>
        u.display_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    )
  }, [availableUsers, candidateSearch])

  const candidateTotalPages = Math.max(1, Math.ceil(filteredCandidates.length / candidatePageSize))
  const safeCandidatePage = Math.min(candidatePage, candidateTotalPages)
  const paginatedCandidates = filteredCandidates.slice(
    (safeCandidatePage - 1) * candidatePageSize,
    safeCandidatePage * candidatePageSize
  )

  const selectedUsers = useMemo(
    () => availableUsers.filter(u => selectedUserIds.includes(u.id)),
    [availableUsers, selectedUserIds]
  )

  const allPageSelected =
    paginatedCandidates.length > 0 &&
    paginatedCandidates.every(u => selectedUserIds.includes(u.id))

  function clearMemberFilters() {
    setSearch('')
    setRoleFilter('ALL')
    setPage(1)
  }

  function closeAddView() {
    setSelectedUserIds([])
    setCandidateSearch('')
    setCandidatePage(1)
    onToggleAddView(false)
  }

  function toggleCandidate(userId: string) {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  function toggleSelectCurrentPage() {
    const pageIds = paginatedCandidates.map(u => u.id)
    if (allPageSelected) {
      setSelectedUserIds(prev => prev.filter(id => !pageIds.includes(id)))
    } else {
      setSelectedUserIds(prev => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  async function handleConfirmRemove(member: ProjectMember) {
    setRemovingUserId(member.user_id)
    try {
      await api.removeProjectMember(projectId, member.user_id)
      onMembersUpdated(members.filter(m => m.user_id !== member.user_id))
      setConfirmRemoveUserId(null)
      toast.info('Miembro removido', `${member.display_name} ya no forma parte del proyecto`)
    } catch (e: unknown) {
      toast.error(
        'Error al remover miembro',
        e instanceof Error ? e.message : 'No se pudo remover del proyecto'
      )
    } finally {
      setRemovingUserId(null)
    }
  }

  async function handleAssignMembers() {
    if (selectedUserIds.length === 0) return
    setSubmittingAdd(true)
    try {
      const results = await Promise.allSettled(
        selectedUserIds.map(userId =>
          api.addProjectMember(projectId, { user_id: userId, role: assignedRole })
        )
      )
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - succeeded
      const updated = await api.getProject(projectId).catch(() => null)
      if (updated?.members) {
        onMembersUpdated(updated.members)
      }
      if (succeeded > 0) {
        toast.success(
          succeeded === 1 ? 'Miembro agregado' : 'Miembros agregados',
          `${succeeded} ${succeeded === 1 ? 'usuario asignado' : 'usuarios asignados'} como ${assignedRole}`
        )
      }
      if (failed > 0) {
        toast.warning(
          'Asignación parcial',
          `${failed} ${failed === 1 ? 'usuario no pudo asignarse' : 'usuarios no pudieron asignarse'}`
        )
      }
      if (succeeded > 0) {
        closeAddView()
      }
    } catch (e: unknown) {
      toast.error(
        'Error al agregar miembros',
        e instanceof Error ? e.message : 'No se pudieron asignar los usuarios'
      )
    } finally {
      setSubmittingAdd(false)
    }
  }

  if (showAddView) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeAddView}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900/70 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a miembros</span>
            </button>
            <div>
              <h3 className="text-sm font-semibold text-white">Asignar miembros al proyecto</h3>
              <p className="text-xs text-slate-400">
                Selecciona uno o varios usuarios disponibles y define su rol operativo.
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
            {availableUsers.length} disponibles
          </span>
        </div>

        {availableUsers.length === 0 ? (
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/35 px-6 py-10 text-center space-y-3">
            <Users className="w-8 h-8 text-cyan-400/70 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Todos los usuarios ya están asignados</p>
              <p className="text-xs text-slate-400">
                No quedan usuarios disponibles fuera de este workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={closeAddView}
              className="px-4 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Regresar a la lista
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-52">
                  <Search className="w-3.5 h-3.5 text-cyan-400/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={e => {
                      setCandidateSearch(e.target.value)
                      setCandidatePage(1)
                    }}
                    placeholder="Buscar usuario disponible por nombre, email o rol..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                  {candidateSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setCandidateSearch('')
                        setCandidatePage(1)
                      }}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={paginatedCandidates.length === 0}
                  onClick={toggleSelectCurrentPage}
                  className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/75 hover:bg-slate-800 text-xs font-medium text-slate-300 disabled:opacity-40 transition-colors shrink-0"
                >
                  {allPageSelected ? 'Deseleccionar página' : 'Seleccionar página'}
                </button>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/35 overflow-hidden">
                {filteredCandidates.length === 0 ? (
                  <div className="px-4 py-8 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No hay usuarios disponibles que coincidan con "{candidateSearch}".
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCandidateSearch('')
                        setCandidatePage(1)
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70">
                    {paginatedCandidates.map(u => {
                      const isSelected = selectedUserIds.includes(u.id)
                      const meta = ROLE_META[u.role] ?? ROLE_META.Lector
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleCandidate(u.id)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-cyan-500/10 hover:bg-cyan-500/15'
                              : 'hover:bg-slate-800/35'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 shrink-0" />
                            )}
                            <span
                              className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${meta.avatarClass}`}
                            >
                              {getInitials(u.display_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                                {u.display_name}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                            </div>
                          </div>
                          <span className="shrink-0">
                            <RoleBadge role={u.role} />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                <PaginationBar
                  currentPage={safeCandidatePage}
                  totalItems={filteredCandidates.length}
                  pageSize={candidatePageSize}
                  pageSizeOptions={[5, 10, 25]}
                  onPageChange={setCandidatePage}
                  onPageSizeChange={size => {
                    setCandidatePageSize(size)
                    setCandidatePage(1)
                  }}
                  itemLabel="disponibles"
                />
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl border border-slate-800/80 bg-slate-900/45 p-4 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Rol asignado en el proyecto
                  </label>
                  <SystemSelect
                    value={assignedRole}
                    onChange={val => setAssignedRole(val as UserRole)}
                    size="sm"
                    ariaLabel="Rol del miembro"
                    options={ROLE_OPTIONS.map(r => ({
                      value: r,
                      label: r,
                      description: ROLE_META[r].description,
                    }))}
                  />
                </div>

                <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                    Permisos del rol
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {ROLE_META[assignedRole].description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">
                      Seleccionados ({selectedUsers.length})
                    </span>
                    {selectedUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds([])}
                        className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Limpiar selección
                      </button>
                    )}
                  </div>

                  {selectedUsers.length === 0 ? (
                    <p className="text-xs text-slate-500 rounded-xl border border-dashed border-slate-800 px-3 py-3 text-center">
                      Selecciona uno o más usuarios de la lista
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUsers.slice(0, 6).map(u => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs bg-cyan-500/15 border border-cyan-500/35 text-cyan-200"
                        >
                          <span className="max-w-32 truncate">{u.display_name}</span>
                          <button
                            type="button"
                            onClick={() => toggleCandidate(u.id)}
                            aria-label={`Quitar a ${u.display_name}`}
                            className="p-0.5 rounded-full hover:bg-cyan-500/25 text-cyan-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {selectedUsers.length > 6 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          +{selectedUsers.length - 6} más
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={closeAddView}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={selectedUserIds.length === 0 || submittingAdd}
                  onClick={handleAssignMembers}
                  className="nl-btn-shimmer flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-md disabled:opacity-45 disabled:cursor-not-allowed transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {submittingAdd
                      ? 'Asignando...'
                      : `Asignar ${selectedUserIds.length} ${
                          selectedUserIds.length === 1 ? 'miembro' : 'miembros'
                        }`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const addButton = (
    <button
      type="button"
      disabled={availableUsers.length === 0}
      onClick={() => onToggleAddView(true)}
      className="nl-btn-shimmer inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-md disabled:opacity-45 disabled:cursor-not-allowed transition-all shrink-0"
    >
      <UserPlus className="w-3.5 h-3.5" />
      <span>Añadir miembros</span>
      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-950/40 text-white">
        {availableUsers.length}
      </span>
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-44">
          <Search className="w-3.5 h-3.5 text-cyan-400/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar miembro por nombre o email..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setPage(1)
              }}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SystemSelect
            value={roleFilter}
            onChange={val => {
              setRoleFilter(val as 'ALL' | UserRole)
              setPage(1)
            }}
            size="sm"
            className="w-48"
            menuMinWidth={240}
            ariaLabel="Filtrar por rol"
            options={[
              { value: 'ALL', label: 'Todos los roles', badge: String(members.length) },
              ...ROLE_OPTIONS.map(r => ({
                value: r,
                label: r,
                badge: String(roleCounts[r] ?? 0),
              })),
            ]}
          />

          <SystemSelect
            value={sortBy}
            onChange={val => setSortBy(val as SortKey)}
            size="sm"
            className="w-40"
            ariaLabel="Ordenar miembros"
            options={[
              { value: 'recent', label: 'Más recientes' },
              { value: 'name', label: 'Nombre (A–Z)' },
              { value: 'role', label: 'Por rol' },
            ]}
          />

          {availableUsers.length === 0 ? (
            <SystemTooltip
              title="Equipo completo"
              label="Todos los usuarios registrados ya forman parte de este proyecto."
              side="bottom"
            >
              {addButton}
            </SystemTooltip>
          ) : (
            addButton
          )}
        </div>
      </div>

      {(search.trim() || roleFilter !== 'ALL') && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
          <span className="text-slate-400">
            Mostrando <span className="text-white font-mono font-semibold">{filteredMembers.length}</span> de{' '}
            <span className="text-white font-mono font-semibold">{members.length}</span> miembros
          </span>
          <button
            type="button"
            onClick={clearMemberFilters}
            className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-800/80 bg-slate-950/35 overflow-hidden">
        {members.length === 0 ? (
          <div className="px-6 py-10 text-center space-y-3">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">Este proyecto aún no tiene miembros asignados.</p>
            {availableUsers.length > 0 && (
              <button
                type="button"
                onClick={() => onToggleAddView(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Añadir primer miembro</span>
              </button>
            )}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="px-6 py-10 text-center space-y-2">
            <p className="text-sm text-slate-400">No hay miembros que coincidan con el filtro.</p>
            <button
              type="button"
              onClick={clearMemberFilters}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-800/80 bg-slate-900/50">
                    <th className="py-2.5 px-4 font-medium">Miembro</th>
                    <th className="py-2.5 px-4 font-medium">Email</th>
                    <th className="py-2.5 px-4 font-medium">Rol</th>
                    <th className="py-2.5 px-4 font-medium">Unido</th>
                    <th className="py-2.5 px-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {paginatedMembers.map(m => {
                    const isOwner = m.user_id === ownerId
                    const isConfirming = confirmRemoveUserId === m.user_id
                    const isRemoving = removingUserId === m.user_id
                    const meta = ROLE_META[m.role] ?? ROLE_META.Lector

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${meta.avatarClass}`}
                            >
                              {getInitials(m.display_name)}
                            </span>
                            <div className="min-w-0 flex flex-wrap items-center gap-2">
                              <span className="text-slate-100 font-medium truncate">
                                {m.display_name}
                              </span>
                              {isOwner && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Crown className="w-2.5 h-2.5" />
                                  Propietario
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 text-xs">{m.email}</td>
                        <td className="py-2.5 px-4">
                          <RoleBadge role={m.role} />
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(m.created_at).toLocaleDateString('es-PE')}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {isOwner ? (
                            <SystemTooltip
                              title="Propietario del proyecto"
                              label="El propietario principal no puede removerse desde esta lista."
                              side="left"
                            >
                              <span className="inline-flex p-1.5 rounded-lg text-slate-500">
                                <ShieldCheck className="w-4 h-4" />
                              </span>
                            </SystemTooltip>
                          ) : isConfirming ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isRemoving}
                                onClick={() => handleConfirmRemove(m)}
                                className="px-2.5 py-1 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                              >
                                {isRemoving ? '...' : 'Quitar'}
                              </button>
                              <button
                                type="button"
                                disabled={isRemoving}
                                onClick={() => setConfirmRemoveUserId(null)}
                                aria-label="Cancelar eliminación"
                                className="p-1 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveUserId(m.user_id)}
                              aria-label={`Remover a ${m.display_name}`}
                              className="p-1.5 rounded-lg hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <PaginationBar
              currentPage={safePage}
              totalItems={filteredMembers.length}
              pageSize={pageSize}
              pageSizeOptions={[5, 10, 25, 50]}
              onPageChange={setPage}
              onPageSizeChange={size => {
                setPageSize(size)
                setPage(1)
              }}
              itemLabel="miembros"
            />
          </>
        )}
      </div>
    </div>
  )
}
