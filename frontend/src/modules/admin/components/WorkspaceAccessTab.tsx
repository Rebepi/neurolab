import { useMemo, useState } from 'react'
import {
  Building2,
  Check,
  Crown,
  FolderKanban,
  Loader2,
  Plus,
  Search,
  Sliders,
  Trash2,
  Users2,
} from 'lucide-react'
import type { Project, User } from '../../../types'
import {
  type AreaPermissionsStore,
  resolveEffectiveAreaPermissions,
} from '../areaPermissions'
import { ROLE_AVATAR_GRADIENTS, ROLE_COLORS, ROLE_OPTIONS, getInitials } from '../constants'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'

interface WorkspaceAccessTabProps {
  users: User[]
  projects: Project[]
  loading: boolean
  areaPermissions: AreaPermissionsStore
  onAssignMember: (projectId: string, userId: string, role: string) => Promise<void>
  onRevokeMember: (projectId: string, userId: string) => Promise<void>
  onChangeMemberRole: (projectId: string, userId: string, role: string) => Promise<void>
  onInspectUser: (user: User) => void
  onOpenPermissions: (projectId: string, userId: string) => void
}

export function WorkspaceAccessTab({
  users,
  projects,
  loading,
  areaPermissions,
  onAssignMember,
  onRevokeMember,
  onChangeMemberRole,
  onInspectUser,
  onOpenPermissions,
}: WorkspaceAccessTabProps) {
  const [viewMode, setViewMode] = useState<'by_area' | 'matrix'>('by_area')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [candidateUserId, setCandidateUserId] = useState<string>('')
  const [candidateRole, setCandidateRole] = useState<string>('Ingeniero/analista de IA')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [areaPage, setAreaPage] = useState(1)
  const areaPageSize = 5
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(6)
  const [matrixPage, setMatrixPage] = useState(1)
  const [matrixPageSize, setMatrixPageSize] = useState(8)

  const q = searchQuery.trim().toLowerCase()

  const filteredProjects = useMemo(() => {
    if (!q) return projects
    return projects.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        (p.owner_name || '').toLowerCase().includes(q) ||
        (p.members || []).some(m => m.display_name.toLowerCase().includes(q))
    )
  }, [projects, q])

  const filteredUsers = useMemo(() => {
    if (!q) return users
    return users.filter(
      u => u.display_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [users, q])

  const totalAreaPages = Math.max(1, Math.ceil(filteredProjects.length / areaPageSize))
  const safeAreaPage = Math.min(areaPage, totalAreaPages)
  const paginatedProjects = filteredProjects.slice(
    (safeAreaPage - 1) * areaPageSize,
    safeAreaPage * areaPageSize
  )

  const activeProject =
    filteredProjects.find(p => p.id === selectedProjectId) || filteredProjects[0] || projects[0] || null

  const activeMembers = activeProject?.members || []
  const totalMemberPages = Math.max(1, Math.ceil(activeMembers.length / memberPageSize))
  const safeMemberPage = Math.min(memberPage, totalMemberPages)
  const paginatedMembers = activeMembers.slice(
    (safeMemberPage - 1) * memberPageSize,
    safeMemberPage * memberPageSize
  )

  const totalMatrixPages = Math.max(1, Math.ceil(filteredUsers.length / matrixPageSize))
  const safeMatrixPage = Math.min(matrixPage, totalMatrixPages)
  const paginatedMatrixUsers = filteredUsers.slice(
    (safeMatrixPage - 1) * matrixPageSize,
    safeMatrixPage * matrixPageSize
  )

  const memberIds = new Set(activeMembers.map(m => m.user_id))
  const availableUsers = users.filter(u => !memberIds.has(u.id))

  const selectedCandidate =
    availableUsers.find(u => u.id === candidateUserId) || availableUsers[0] || null

  async function handleAssign() {
    if (!activeProject || !selectedCandidate) return
    setBusyKey('assign-inline')
    try {
      await onAssignMember(activeProject.id, selectedCandidate.id, candidateRole)
      setCandidateUserId('')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleRevoke(projectId: string, userId: string) {
    setBusyKey(`${projectId}:${userId}`)
    try {
      await onRevokeMember(projectId, userId)
    } finally {
      setBusyKey(null)
    }
  }

  async function handleRoleChange(projectId: string, userId: string, role: string) {
    setBusyKey(`${projectId}:${userId}`)
    try {
      await onChangeMemberRole(projectId, userId, role)
    } finally {
      setBusyKey(null)
    }
  }

  async function handleMatrixToggle(project: Project, user: User) {
    const members = project.members || []
    const existing = members.find(m => m.user_id === user.id)
    const isOwner = project.owner_id === user.id
    if (isOwner) return

    setBusyKey(`${project.id}:${user.id}`)
    try {
      if (existing) {
        await onRevokeMember(project.id, user.id)
      } else {
        await onAssignMember(project.id, user.id, user.role)
      }
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => setViewMode('by_area')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
              viewMode === 'by_area'
                ? 'bg-cyan-500/20 text-white border border-cyan-400/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Por Área</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
              viewMode === 'matrix'
                ? 'bg-cyan-500/20 text-white border border-cyan-400/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5 text-indigo-400" />
            <span>Matriz Global</span>
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar área o usuario..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value)
              setAreaPage(1)
              setMemberPage(1)
              setMatrixPage(1)
            }}
            className="w-full bg-slate-950/70 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="nl-cyber-panel rounded-2xl p-12 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mx-auto" />
        </div>
      ) : projects.length === 0 ? (
        <div className="nl-cyber-panel rounded-2xl p-10 text-center space-y-2">
          <FolderKanban className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-semibold text-white">Sin áreas o proyectos registrados</p>
          <p className="text-xs text-slate-400">
            Crea un proyecto para comenzar a asignar miembros y permisos por área.
          </p>
        </div>
      ) : viewMode === 'by_area' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="nl-cyber-panel rounded-2xl overflow-hidden">
              {filteredProjects.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-300">
                    Sin áreas que coincidan con la búsqueda
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setAreaPage(1)
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                  >
                    Limpiar búsqueda
                  </button>
                </div>
              ) : (
                <div className="p-2.5 space-y-2">
                  {paginatedProjects.map(p => {
                    const isSelected = activeProject?.id === p.id
                    const membersList = p.members || []
                    const customMembersCount = membersList.filter(
                      m =>
                        resolveEffectiveAreaPermissions(
                          p.id,
                          m.user_id,
                          m.role,
                          areaPermissions
                        ).overridesCount > 0
                    ).length

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(p.id)
                          setCandidateUserId('')
                          setMemberPage(1)
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-400/50 shadow-sm'
                            : 'bg-slate-950/75 hover:bg-slate-900 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-white line-clamp-1">{p.name}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {customMembersCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 text-[9.5px] font-mono text-amber-300 font-bold">
                                {customMembersCount} pers.
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-300">
                              {membersList.length}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-slate-400">
                          <span className="truncate">Resp: {p.owner_name || 'Sistema'}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                              p.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {filteredProjects.length > 0 && (
              <PaginationBar
                variant="card"
                className="mt-auto"
                currentPage={safeAreaPage}
                totalItems={filteredProjects.length}
                pageSize={areaPageSize}
                onPageChange={setAreaPage}
                itemLabel="áreas"
              />
            )}
          </div>

          {activeProject && (
            <div className="lg:col-span-8 flex flex-col gap-3">
              <div className="nl-cyber-panel rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800/80 bg-slate-950/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">{activeProject.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {activeProject.description}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold">
                      <Users2 className="w-3.5 h-3.5" />
                      <span>{activeMembers.length} integrantes</span>
                    </span>
                  </div>

                  {availableUsers.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/70 flex flex-col sm:flex-row sm:items-center gap-2">
                      <SystemSelect
                        value={selectedCandidate?.id || ''}
                        onChange={val => {
                          setCandidateUserId(val)
                          const picked = users.find(u => u.id === val)
                          if (picked) setCandidateRole(picked.role)
                        }}
                        size="xs"
                        searchable
                        className="flex-1"
                        ariaLabel="Seleccionar usuario para agregar al área"
                        options={availableUsers.map(u => ({
                          value: u.id,
                          label: `${u.display_name} · ${u.role}`,
                          keywords: `${u.email} ${u.role}`,
                        }))}
                      />
                      <SystemSelect
                        value={candidateRole}
                        onChange={setCandidateRole}
                        size="xs"
                        className="sm:w-48"
                        ariaLabel="Rol en el área"
                        options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
                      />
                      <button
                        type="button"
                        disabled={busyKey !== null || !selectedCandidate}
                        onClick={handleAssign}
                        className="nl-accent-bg nl-accent-glow inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-bold shrink-0 disabled:opacity-45"
                      >
                        {busyKey === 'assign-inline' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>Asignar Miembro</span>
                      </button>
                    </div>
                  )}
                </div>

                {activeMembers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Esta área no tiene miembros asignados todavía.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-800 bg-slate-950/60">
                        <tr>
                          {['Usuario', 'Rol Global', 'Rol en Área', 'Permisos', 'Acción'].map(
                            (h, i) => (
                              <th
                                key={h}
                                className={`px-4 py-2.5 text-slate-400 text-[10.5px] uppercase tracking-wider font-bold ${
                                  i === 4 ? 'text-right' : 'text-left'
                                }`}
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {paginatedMembers.map(mem => {
                          const globalUser = users.find(u => u.id === mem.user_id)
                          const isOwner = activeProject.owner_id === mem.user_id
                          const grad =
                            ROLE_AVATAR_GRADIENTS[globalUser?.role || mem.role] ||
                            'from-indigo-500 to-violet-600'
                          const rowBusy = busyKey === `${activeProject.id}:${mem.user_id}`
                          const permSummary = resolveEffectiveAreaPermissions(
                            activeProject.id,
                            mem.user_id,
                            mem.role,
                            areaPermissions
                          )

                          return (
                            <tr key={mem.id} className="hover:bg-slate-800/25 transition-colors">
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => globalUser && onInspectUser(globalUser)}
                                  className="flex items-center gap-2.5 text-left group"
                                >
                                  <div
                                    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
                                  >
                                    {getInitials(mem.display_name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                                      {mem.display_name}
                                    </p>
                                    <p className="text-[10.5px] font-mono text-slate-500 truncate">
                                      {mem.email}
                                    </p>
                                  </div>
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-block text-[11px] px-2 py-0.5 rounded-lg font-medium ${
                                    ROLE_COLORS[globalUser?.role || mem.role] ||
                                    'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {globalUser?.role || mem.role}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {isOwner ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[11px] font-bold">
                                    <Crown className="w-3 h-3" />
                                    <span>Propietario</span>
                                  </span>
                                ) : (
                                  <SystemSelect
                                    value={mem.role}
                                    onChange={val =>
                                      handleRoleChange(activeProject.id, mem.user_id, val)
                                    }
                                    disabled={rowBusy}
                                    size="xs"
                                    className="w-40"
                                    ariaLabel={`Rol de ${mem.display_name} en el área`}
                                    options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPermissions(activeProject.id, mem.user_id)
                                  }
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold transition-colors ${
                                    permSummary.overridesCount > 0
                                      ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/40 text-amber-200'
                                      : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-cyan-300'
                                  }`}
                                >
                                  <span>
                                    {permSummary.grantedCount}/{permSummary.totalCount}
                                  </span>
                                  <span className="text-[10px] font-sans font-semibold opacity-85">
                                    {permSummary.overridesCount > 0
                                      ? `· ${permSummary.overridesCount} pers.`
                                      : '· Base'}
                                  </span>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenPermissions(activeProject.id, mem.user_id)
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-cyan-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                                  >
                                    <Sliders className="w-3 h-3" />
                                    <span>Personalizar</span>
                                  </button>

                                  {!isOwner && (
                                    <button
                                      type="button"
                                      disabled={rowBusy}
                                      onClick={() => handleRevoke(activeProject.id, mem.user_id)}
                                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/35 text-slate-300 hover:text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-45"
                                    >
                                      {rowBusy ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3 h-3" />
                                      )}
                                      <span>Revocar</span>
                                    </button>
                                  )}
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

              {activeMembers.length > 0 && (
                <PaginationBar
                  variant="card"
                  className="mt-auto"
                  currentPage={safeMemberPage}
                  totalItems={activeMembers.length}
                  pageSize={memberPageSize}
                  pageSizeOptions={[5, 6, 10, 20]}
                  onPageChange={setMemberPage}
                  onPageSizeChange={size => {
                    setMemberPageSize(size)
                    setMemberPage(1)
                  }}
                  itemLabel="integrantes"
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3">
          <div className="nl-cyber-panel rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-white">
                Matriz de Pertenencia Usuario × Área ({filteredUsers.length} usuarios ×{' '}
                {projects.length} áreas)
              </span>
              <span className="text-slate-400">
                Haz clic en la celda para asignar/revocar o en el icono de ajustes para permisos granulares
              </span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm text-slate-300 font-semibold">
                  No se encontraron usuarios con ese criterio
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setMatrixPage(1)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/70">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-bold text-slate-400 min-w-[210px] sticky left-0 bg-[#071124] z-10">
                        Usuario / Rol Global
                      </th>
                      {projects.map(p => (
                        <th
                          key={p.id}
                          className="px-3 py-3 text-center text-[11px] font-bold text-slate-300 min-w-[165px]"
                          title={p.name}
                        >
                          <span className="line-clamp-1">{p.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paginatedMatrixUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/20">
                        <td className="px-4 py-2.5 sticky left-0 bg-[#061024] z-10 border-r border-slate-800/60">
                          <button
                            type="button"
                            onClick={() => onInspectUser(u)}
                            className="text-left group"
                          >
                            <p className="font-bold text-white group-hover:text-cyan-300 truncate max-w-[180px]">
                              {u.display_name}
                            </p>
                            <p className="text-[10.5px] text-slate-400 truncate max-w-[180px]">
                              {u.role}
                            </p>
                          </button>
                        </td>
                        {projects.map(p => {
                          const mem = (p.members || []).find(m => m.user_id === u.id)
                          const isOwner = p.owner_id === u.id
                          const cellBusy = busyKey === `${p.id}:${u.id}`
                          const permSummary = mem
                            ? resolveEffectiveAreaPermissions(p.id, u.id, mem.role, areaPermissions)
                            : null

                          return (
                            <td key={p.id} className="px-2.5 py-2.5 text-center">
                              {cellBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 mx-auto" />
                              ) : mem && permSummary ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={isOwner}
                                    onClick={() => handleMatrixToggle(p, u)}
                                    title={
                                      isOwner
                                        ? `Propietario · ${permSummary.grantedCount}/${permSummary.totalCount} permisos`
                                        : `Rol: ${mem.role} · ${permSummary.grantedCount}/${permSummary.totalCount} · Clic para revocar`
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all ${
                                      isOwner
                                        ? 'bg-amber-500/15 border border-amber-400/35 text-amber-300 cursor-default'
                                        : permSummary.overridesCount > 0
                                          ? 'bg-amber-500/15 hover:bg-rose-500/20 border border-amber-400/40 hover:border-rose-500/40 text-amber-200 hover:text-rose-300'
                                          : 'bg-emerald-500/15 hover:bg-rose-500/20 border border-emerald-500/30 hover:border-rose-500/40 text-emerald-300 hover:text-rose-300'
                                    }`}
                                  >
                                    {isOwner ? (
                                      <Crown className="w-2.5 h-2.5" />
                                    ) : (
                                      <Check className="w-2.5 h-2.5" />
                                    )}
                                    <span className="font-mono">
                                      {permSummary.grantedCount}/{permSummary.totalCount}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onOpenPermissions(p.id, u.id)}
                                    title="Personalizar permisos granulares en esta área"
                                    className="p-1 rounded-lg bg-slate-900 hover:bg-cyan-500/20 border border-slate-800 hover:border-cyan-400/40 text-cyan-300 transition-colors"
                                  >
                                    <Sliders className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMatrixToggle(p, u)}
                                  className="px-2.5 py-1 rounded-lg border border-dashed border-slate-800 hover:border-cyan-400/50 text-slate-500 hover:text-cyan-300 text-[10.5px] font-semibold transition-colors"
                                >
                                  + Asignar
                                </button>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {filteredUsers.length > 0 && (
            <PaginationBar
              variant="card"
              className="mt-auto"
              currentPage={safeMatrixPage}
              totalItems={filteredUsers.length}
              pageSize={matrixPageSize}
              pageSizeOptions={[5, 8, 15, 30]}
              onPageChange={setMatrixPage}
              onPageSizeChange={size => {
                setMatrixPageSize(size)
                setMatrixPage(1)
              }}
              itemLabel="usuarios"
            />
          )}
        </div>
      )}
    </div>
  )
}
