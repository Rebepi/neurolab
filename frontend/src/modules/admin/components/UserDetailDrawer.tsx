import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  Shield,
  ShieldAlert,
  Sliders,
  Trash2,
  X,
} from 'lucide-react'
import type { AuditEvent, Project, User } from '../../../types'
import {
  type AreaPermissionsStore,
  resolveEffectiveAreaPermissions,
} from '../areaPermissions'
import {
  ACCESS_BADGE_META,
  RBAC_CAPABILITIES,
  ROLE_AVATAR_GRADIENTS,
  ROLE_COLORS,
  ROLE_META,
  ROLE_OPTIONS,
  ROLE_PERMISSIONS,
  type UserWorkspaceMembership,
  formatAuditAction,
  getInitials,
} from '../constants'
import { SystemSelect } from '../../../components/SystemSelect'

interface UserDetailDrawerProps {
  user: User
  isSelf: boolean
  isLastActiveAdmin: boolean
  projects: Project[]
  memberships: UserWorkspaceMembership[]
  recentEvents: AuditEvent[]
  areaPermissions: AreaPermissionsStore
  onClose: () => void
  onOpenEdit: (user: User) => void
  onOpenPermissions: (projectId: string, userId: string) => void
  onToggleStatus: (user: User) => Promise<void>
  onAssignMember: (projectId: string, userId: string, role: string) => Promise<void>
  onRevokeMember: (projectId: string, userId: string) => Promise<void>
  onChangeMemberRole: (projectId: string, userId: string, role: string) => Promise<void>
}

export function UserDetailDrawer({
  user,
  isSelf,
  isLastActiveAdmin,
  projects,
  memberships,
  recentEvents,
  areaPermissions,
  onClose,
  onOpenEdit,
  onOpenPermissions,
  onToggleStatus,
  onAssignMember,
  onRevokeMember,
  onChangeMemberRole,
}: UserDetailDrawerProps) {
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [assignRole, setAssignRole] = useState<string>(user.role)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  useEffect(() => {
    setAssignRole(user.role)
    setSelectedProjectId('')
  }, [user.id, user.role])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const assignedIds = new Set(memberships.map(m => m.projectId))
  const unassignedProjects = projects.filter(p => !assignedIds.has(p.id))
  const projectMap = new Map(projects.map(p => [p.id, p.name]))

  const roleMeta = ROLE_META[user.role]
  const avatarGrad = ROLE_AVATAR_GRADIENTS[user.role] || 'from-indigo-500 to-violet-600'
  const isActive = user.status === 'ACTIVE'
  const cannotDeactivate = isSelf || (isActive && isLastActiveAdmin)

  async function handleCopyEmail() {
    await navigator.clipboard.writeText(user.email).catch(() => {})
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 1600)
  }

  async function handleAssign() {
    const targetProject = selectedProjectId || unassignedProjects[0]?.id
    if (!targetProject) return
    setBusyAction('assign')
    try {
      await onAssignMember(targetProject, user.id, assignRole)
      setSelectedProjectId('')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRevoke(projectId: string) {
    setBusyAction(`revoke-${projectId}`)
    try {
      await onRevokeMember(projectId, user.id)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleMemberRoleChange(projectId: string, newRole: string) {
    setBusyAction(`role-${projectId}`)
    try {
      await onChangeMemberRole(projectId, user.id, newRole)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleStatusToggle() {
    if (cannotDeactivate) return
    setBusyAction('status')
    try {
      await onToggleStatus(user)
    } finally {
      setBusyAction(null)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-drawer-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl h-full bg-[#061024] border-l border-cyan-500/30 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-sm font-extrabold shrink-0 shadow-lg`}
            >
              {getInitials(user.display_name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="user-drawer-title" className="text-white font-bold text-base truncate">
                  {user.display_name}
                </h3>
                {isSelf && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-400/35">
                    Sesión actual
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  {isActive ? 'Activo' : 'Suspendido'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-1 text-xs font-mono text-slate-300 hover:text-cyan-300 transition-colors"
                  title="Copiar correo electrónico"
                >
                  <span>{user.email}</span>
                  {copiedEmail ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-500" />
                  )}
                </button>
                <span className="text-slate-600">·</span>
                <span className="text-[11px] font-mono text-slate-500">{user.id}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`text-[11px] px-2.5 py-0.5 rounded-lg font-semibold ${ROLE_COLORS[user.role] || ''}`}>
                  {user.role}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {roleMeta?.tierLabel}
                </span>
                {user.created_at && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    · Alta {new Date(user.created_at).toLocaleDateString('es')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de detalle"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!isActive && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/35 text-rose-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Cuenta suspendida — acceso bloqueado</p>
                <p className="text-rose-300/80 mt-0.5">
                  Todos los permisos efectivos están suspendidos hasta que un Administrador reactive esta cuenta.
                </p>
              </div>
            </div>
          )}

          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-cyan-400" />
                <span>Áreas / Workspaces Asignados ({memberships.length})</span>
              </h4>
            </div>

            {memberships.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
                Este usuario aún no forma parte de ninguna área o proyecto específico.
              </div>
            ) : (
              <div className="space-y-2">
                {memberships.map(mem => {
                  const permSummary = resolveEffectiveAreaPermissions(
                    mem.projectId,
                    user.id,
                    mem.areaRole,
                    areaPermissions
                  )
                  return (
                    <div
                      key={mem.projectId}
                      className="p-3 rounded-xl bg-slate-950/75 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{mem.projectName}</span>
                          {mem.isOwner && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[10px] font-bold shrink-0">
                              <Crown className="w-2.5 h-2.5" />
                              <span>Propietario</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono">
                          <span className="text-cyan-300">
                            {permSummary.grantedCount}/{permSummary.totalCount} permisos
                          </span>
                          {permSummary.overridesCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[9.5px] font-sans font-bold">
                              +{permSummary.overridesCount} pers.
                            </span>
                          )}
                          <span className="text-slate-500">
                            · {mem.joinedAt ? new Date(mem.joinedAt).toLocaleDateString('es') : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenPermissions(mem.projectId, user.id)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-cyan-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Permisos</span>
                        </button>

                        {!mem.isOwner && (
                          <>
                            <SystemSelect
                              value={mem.areaRole}
                              onChange={val => handleMemberRoleChange(mem.projectId, val)}
                              disabled={busyAction !== null}
                              size="xs"
                              className="w-40"
                              ariaLabel={`Rol en ${mem.projectName}`}
                              options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
                            />
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() => handleRevoke(mem.projectId)}
                              title="Revocar acceso al área"
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition-colors disabled:opacity-45"
                            >
                              {busyAction === `revoke-${mem.projectId}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {unassignedProjects.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
                <p className="text-[11px] font-semibold text-slate-300">+ Asignar a un área adicional</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <SystemSelect
                    value={selectedProjectId || unassignedProjects[0].id}
                    onChange={setSelectedProjectId}
                    size="xs"
                    searchable
                    className="flex-1"
                    ariaLabel="Seleccionar área para asignar"
                    options={unassignedProjects.map(p => ({ value: p.id, label: p.name }))}
                  />
                  <SystemSelect
                    value={assignRole}
                    onChange={setAssignRole}
                    size="xs"
                    className="sm:w-44"
                    ariaLabel="Rol inicial en el área"
                    options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
                  />
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={handleAssign}
                    className="nl-accent-bg inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-white text-xs font-bold shrink-0 disabled:opacity-45"
                  >
                    {busyAction === 'assign' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Asignar</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Permisos Globales del Rol</span>
              </h4>
              <span className="text-[11px] font-mono text-cyan-300">
                Nivel {roleMeta?.level ?? 1}/5
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${avatarGrad} transition-all`}
                style={{ width: `${((roleMeta?.level ?? 1) / 5) * 100}%` }}
              />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {ROLE_PERMISSIONS[user.role]}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {RBAC_CAPABILITIES.map(cap => {
                const access = isActive ? cap.matrix[user.role] : 'deny'
                const meta = ACCESS_BADGE_META[access]
                return (
                  <div
                    key={cap.key}
                    className="px-2.5 py-2 rounded-xl bg-slate-950/65 border border-slate-800/80 flex items-center justify-between gap-2"
                  >
                    <span className="text-[11px] text-slate-300 truncate" title={cap.description}>
                      {cap.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Actividad Reciente en Auditoría ({recentEvents.length})</span>
            </h4>

            {recentEvents.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
                Sin eventos registrados para esta cuenta en el historial reciente.
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentEvents.slice(0, 8).map(ev => {
                  const pName = ev.project_id ? projectMap.get(ev.project_id) : undefined
                  return (
                    <div
                      key={ev.id}
                      className="px-3 py-2 rounded-xl bg-slate-950/65 border border-slate-800/80 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {formatAuditAction(ev.action)}
                        </p>
                        {pName && (
                          <p className="text-[11px] text-cyan-300/80 truncate">{pName}</p>
                        )}
                      </div>
                      <span className="text-[10.5px] font-mono text-slate-500 shrink-0">
                        {new Date(ev.created_at).toLocaleString('es', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            disabled={cannotDeactivate || busyAction !== null}
            onClick={handleStatusToggle}
            title={
              cannotDeactivate
                ? 'No puedes suspender tu sesión activa ni al último Administrador activo'
                : undefined
            }
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
              isActive
                ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/35 text-rose-300'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/35 text-emerald-300'
            }`}
          >
            {busyAction === 'status' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isActive ? (
              <ShieldAlert className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{isActive ? 'Suspender cuenta' : 'Reactivar cuenta'}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenEdit(user)}
            className="nl-accent-bg nl-accent-glow px-4 py-2 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Editar Rol / Estado</span>
          </button>
        </div>
      </aside>
    </div>,
    document.body
  )
}
