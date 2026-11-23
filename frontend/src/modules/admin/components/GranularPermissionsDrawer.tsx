import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Crown,
  Database,
  Download,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Network,
  PackageCheck,
  Play,
  RotateCcw,
  Save,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  X,
} from 'lucide-react'
import type { Project, User, UserRole } from '../../../types'
import {
  AREA_PERMISSION_MODULES,
  type AreaPermissionsStore,
  PERM_RISK_META,
  buildOverridesFromEffective,
  exportMemberPermissionsJson,
  getDefaultAreaPermissions,
  resolveEffectiveAreaPermissions,
} from '../areaPermissions'
import { ROLE_AVATAR_GRADIENTS, ROLE_OPTIONS, getInitials } from '../constants'
import { SystemSelect } from '../../../components/SystemSelect'

interface GranularPermissionsDrawerProps {
  project: Project
  user: User
  areaRole: UserRole
  isOwner: boolean
  store: AreaPermissionsStore
  peerMembers: Array<{ userId: string; displayName: string; role: UserRole }>
  onClose: () => void
  onSaveOverrides: (projectId: string, userId: string, overrides: Record<string, boolean>) => void
  onChangeAreaRole?: (projectId: string, userId: string, role: string) => Promise<void>
}

type PermStatusFilter = 'all' | 'granted' | 'denied' | 'modified'

const MODULE_ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  datasets: Database,
  architectures: Network,
  training: Play,
  evaluation: BarChart2,
  models: PackageCheck,
  inference: Cpu,
  visualizer: Sparkles,
  reports: FileText,
  audit: ScrollText,
}

export function GranularPermissionsDrawer({
  project,
  user,
  areaRole,
  isOwner,
  store,
  peerMembers,
  onClose,
  onSaveOverrides,
  onChangeAreaRole,
}: GranularPermissionsDrawerProps) {
  const initialResolved = useMemo(
    () => resolveEffectiveAreaPermissions(project.id, user.id, areaRole, store),
    [areaRole, project.id, store, user.id]
  )

  const [draftEffective, setDraftEffective] = useState<Record<string, boolean>>(
    initialResolved.effective
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PermStatusFilter>('all')
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    AREA_PERMISSION_MODULES.forEach((m, i) => {
      initial[m.id] = i < 4
    })
    return initial
  })
  const [changingRole, setChangingRole] = useState(false)

  useEffect(() => {
    setDraftEffective(initialResolved.effective)
  }, [initialResolved.effective])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const draftOverrides = useMemo(
    () => buildOverridesFromEffective(areaRole, draftEffective),
    [areaRole, draftEffective]
  )

  const grantedCount = useMemo(
    () => Object.values(draftEffective).filter(Boolean).length,
    [draftEffective]
  )
  const overridesCount = Object.keys(draftOverrides).length
  const totalCount = Object.keys(initialResolved.defaults).length

  const hasUnsavedChanges = useMemo(() => {
    const keys = Object.keys(initialResolved.defaults)
    return keys.some(k => Boolean(draftEffective[k]) !== Boolean(initialResolved.effective[k]))
  }, [draftEffective, initialResolved.defaults, initialResolved.effective])

  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return AREA_PERMISSION_MODULES.map(mod => {
      const moduleMatches =
        !q || mod.label.toLowerCase().includes(q) || mod.subtitle.toLowerCase().includes(q)
      const perms = mod.permissions.filter(p => {
        const val = Boolean(draftEffective[p.id])
        const isModified = Object.prototype.hasOwnProperty.call(draftOverrides, p.id)
        if (statusFilter === 'granted' && !val) return false
        if (statusFilter === 'denied' && val) return false
        if (statusFilter === 'modified' && !isModified) return false
        if (!q || moduleMatches) return true
        return p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      })
      return { ...mod, permissions: perms }
    }).filter(mod => mod.permissions.length > 0)
  }, [draftEffective, draftOverrides, searchQuery, statusFilter])

  const allExpanded =
    filteredModules.length > 0 && filteredModules.every(m => Boolean(expandedModules[m.id]))

  function toggleExpandAll() {
    const next: Record<string, boolean> = {}
    const target = !allExpanded
    AREA_PERMISSION_MODULES.forEach(m => {
      next[m.id] = target
    })
    setExpandedModules(next)
  }

  function applyPreset(preset: 'readonly' | 'all' | 'none' | 'reset') {
    if (preset === 'reset') {
      setDraftEffective(getDefaultAreaPermissions(areaRole))
      return
    }
    const next: Record<string, boolean> = {}
    AREA_PERMISSION_MODULES.forEach(m => {
      m.permissions.forEach(p => {
        if (preset === 'all') next[p.id] = true
        else if (preset === 'none') next[p.id] = false
        else next[p.id] = p.risk === 'read'
      })
    })
    setDraftEffective(next)
  }

  function handleCopyFromPeer(peerId: string) {
    const peer = peerMembers.find(pm => pm.userId === peerId)
    if (!peer) return
    const resolvedPeer = resolveEffectiveAreaPermissions(project.id, peer.userId, peer.role, store)
    setDraftEffective({ ...resolvedPeer.effective })
  }

  function toggleModuleAll(moduleId: string, enableAll: boolean) {
    const mod = AREA_PERMISSION_MODULES.find(m => m.id === moduleId)
    if (!mod) return
    setDraftEffective(prev => {
      const next = { ...prev }
      mod.permissions.forEach(p => {
        next[p.id] = enableAll
      })
      return next
    })
  }

  async function handleBaseRoleChange(newRole: string) {
    if (!onChangeAreaRole || newRole === areaRole) return
    setChangingRole(true)
    try {
      await onChangeAreaRole(project.id, user.id, newRole)
    } finally {
      setChangingRole(false)
    }
  }

  function handleSave() {
    onSaveOverrides(project.id, user.id, draftOverrides)
    onClose()
  }

  const avatarGrad = ROLE_AVATAR_GRADIENTS[user.role] || 'from-indigo-500 to-violet-600'

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex justify-end bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="granular-perms-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl h-full bg-[#061024] border-l border-cyan-500/35 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/65 space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow-md`}
              >
                {getInitials(user.display_name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="granular-perms-title" className="text-white font-bold text-base truncate">
                    Permisos Granulares · {user.display_name}
                  </h3>
                  {isOwner && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[10px] font-bold">
                      <Crown className="w-2.5 h-2.5" />
                      <span>Propietario</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-cyan-300 font-medium truncate mt-0.5">
                  {project.name}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar editor de permisos"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-mono font-bold">
                {grantedCount}/{totalCount} permisos activos
              </span>
              {overridesCount > 0 ? (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[11px] font-bold">
                  {overridesCount} {overridesCount === 1 ? 'ajuste personalizado' : 'ajustes personalizados'}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-semibold">
                  Perfil base del rol
                </span>
              )}
            </div>

            {onChangeAreaRole && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold">Rol base en área:</span>
                {changingRole && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
                <SystemSelect
                  value={areaRole}
                  onChange={handleBaseRoleChange}
                  disabled={isOwner || changingRole}
                  size="xs"
                  className="w-44"
                  ariaLabel="Rol base en el área"
                  options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-b border-slate-800/70 bg-slate-950/35 space-y-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar apartado o micro-permiso (ej. SHA-256, PDF, fusionar)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1 shrink-0">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'granted', label: 'Activos' },
                  { id: 'denied', label: 'Denegados' },
                  { id: 'modified', label: 'Modificados' },
                ] as Array<{ id: PermStatusFilter; label: string }>
              ).map(f => {
                const active = statusFilter === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all ${
                      active
                        ? 'bg-cyan-500/20 text-white border border-cyan-400/40'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('readonly')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-cyan-300 transition-colors"
              >
                Solo Lectura
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-emerald-300 transition-colors"
              >
                Permitir Todo
              </button>
              <button
                type="button"
                onClick={() => applyPreset('none')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-rose-300 transition-colors"
              >
                Bloquear Todo
              </button>
              <button
                type="button"
                onClick={() => applyPreset('reset')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-300 inline-flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer al rol</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {peerMembers.length > 0 && (
                <SystemSelect
                  value=""
                  onChange={handleCopyFromPeer}
                  size="xs"
                  className="w-44"
                  placeholder="Copiar permisos de..."
                  ariaLabel="Copiar permisos de otro integrante"
                  options={peerMembers.map(pm => ({
                    value: pm.userId,
                    label: pm.displayName,
                    description: pm.role,
                  }))}
                />
              )}

              <button
                type="button"
                onClick={toggleExpandAll}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-300 transition-colors"
              >
                {allExpanded ? 'Contraer todos' : 'Expandir todos'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {filteredModules.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
              <Shield className="w-7 h-7 text-slate-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-300">
                No hay permisos que coincidan con el filtro aplicado
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
              >
                Ver todos los apartados
              </button>
            </div>
          ) : (
            filteredModules.map(mod => {
              const Icon = MODULE_ICONS[mod.id] || FolderKanban
              const isOpen =
                searchQuery.trim().length > 0 || statusFilter !== 'all'
                  ? true
                  : Boolean(expandedModules[mod.id])
              const fullMod =
                AREA_PERMISSION_MODULES.find(m => m.id === mod.id) || mod
              const modActiveCount = fullMod.permissions.filter(p =>
                Boolean(draftEffective[p.id])
              ).length
              const modAllEnabled = modActiveCount === fullMod.permissions.length
              const modModifiedCount = fullMod.permissions.filter(p =>
                Object.prototype.hasOwnProperty.call(draftOverrides, p.id)
              ).length

              return (
                <div
                  key={mod.id}
                  className="rounded-2xl bg-slate-950/75 border border-slate-800/90 overflow-hidden"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedModules(prev => ({ ...prev, [mod.id]: !isOpen }))
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedModules(prev => ({ ...prev, [mod.id]: !isOpen }))
                      }
                    }}
                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-slate-400 shrink-0">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                      <div
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${mod.colorCls}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{mod.label}</h4>
                          {modModifiedCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[9.5px] font-bold">
                              {modModifiedCount} pers.
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{mod.subtitle}</p>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-3 shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="text-[11px] font-mono text-slate-300">
                        {modActiveCount}/{fullMod.permissions.length}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={modAllEnabled}
                        onClick={() => toggleModuleAll(mod.id, !modAllEnabled)}
                        title={
                          modAllEnabled
                            ? `Desactivar todo en ${mod.label}`
                            : `Activar todo en ${mod.label}`
                        }
                        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                          modAllEnabled
                            ? 'bg-emerald-500/30 border-emerald-400/60'
                            : modActiveCount > 0
                              ? 'bg-cyan-500/25 border-cyan-400/50'
                              : 'bg-slate-900 border-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
                            modAllEnabled
                              ? 'translate-x-4 bg-emerald-400'
                              : modActiveCount > 0
                                ? 'translate-x-2.5 bg-cyan-300'
                                : 'translate-x-0.5 bg-slate-500'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-800/80 divide-y divide-slate-800/60 bg-slate-950/40">
                      {mod.permissions.map(perm => {
                        const enabled = Boolean(draftEffective[perm.id])
                        const defaultVal = Boolean(initialResolved.defaults[perm.id])
                        const isModified = enabled !== defaultVal
                        const riskMeta = PERM_RISK_META[perm.risk]

                        return (
                          <div
                            key={perm.id}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`text-xs font-semibold ${
                                    enabled ? 'text-white' : 'text-slate-400'
                                  }`}
                                >
                                  {perm.label}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${riskMeta.cls}`}
                                >
                                  {riskMeta.label}
                                </span>
                                {isModified && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[9.5px] font-bold">
                                    Modificado
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {perm.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isModified && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftEffective(prev => ({
                                      ...prev,
                                      [perm.id]: defaultVal,
                                    }))
                                  }
                                  title="Restaurar al valor predeterminado del rol"
                                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 hover:text-amber-200 transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}

                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={perm.label}
                                onClick={() =>
                                  setDraftEffective(prev => ({
                                    ...prev,
                                    [perm.id]: !enabled,
                                  }))
                                }
                                className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                                  enabled
                                    ? 'bg-emerald-500/30 border-emerald-400/60'
                                    : 'bg-slate-900 border-slate-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
                                    enabled
                                      ? 'translate-x-4 bg-emerald-400'
                                      : 'translate-x-0.5 bg-slate-500'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/75 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-white">
              {grantedCount}/{totalCount}
            </span>
            <span className="text-slate-400">activos</span>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 text-[10.5px] font-bold">
                Cambios sin guardar
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportMemberPermissionsJson(
                  project.name,
                  user.display_name,
                  areaRole,
                  draftEffective,
                  draftOverrides
                )
              }
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Exportar JSON</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="nl-btn-shimmer nl-accent-bg nl-accent-glow px-4 py-1.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Permisos</span>
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  )
}
