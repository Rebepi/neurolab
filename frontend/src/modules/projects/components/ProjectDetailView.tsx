import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  ArrowRight,
  Box,
  Database,
  FolderKanban,
  Layers,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../../../services/api'
import type { AuditEvent, Project, ProjectMember, User } from '../../../types'
import { AuditBadge, StatusDot, TagChip } from './ProjectBadges'
import { ProjectMembersTab, ROLE_OPTIONS } from './ProjectMembersTab'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'
import { useToast } from '../../../components/toast/ToastContext'

type DetailTab = 'info' | 'members' | 'audit'

interface ProjectDetailViewProps {
  project: Project
  users: User[]
  onBack: () => void
  onDeleted: () => void
  onOpen?: (project: Project) => void
}

function formatAuditMetadata(metadata: Record<string, any> | null | undefined): string {
  if (!metadata || typeof metadata !== 'object') return '—'
  const entries = Object.entries(metadata)
  if (entries.length === 0) return '—'
  return entries
    .map(([key, value]) => {
      if (value === null || value === undefined) return `${key}: —`
      if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`
      return `${key}: ${String(value)}`
    })
    .join(' · ')
}

export function ProjectDetailView({
  project,
  users,
  onBack,
  onDeleted,
  onOpen,
}: ProjectDetailViewProps) {
  const toast = useToast()
  const [tab, setTab] = useState<DetailTab>('info')
  const [detail, setDetail] = useState<Project>(project)
  const [members, setMembers] = useState<ProjectMember[]>(project.members ?? [])
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [auditLoaded, setAuditLoaded] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')
  const [auditActionFilter, setAuditActionFilter] = useState('ALL')
  const [auditPage, setAuditPage] = useState(1)
  const [auditPageSize, setAuditPageSize] = useState(5)

  useEffect(() => {
    setDetail(project)
    setMembers(project.members ?? [])
    setAuditEvents([])
    setAuditLoaded(false)
    setShowAddMembers(false)
    setConfirmDelete(false)
  }, [project])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (document.querySelector('[role="listbox"]')) return
      if (showAddMembers) {
        setShowAddMembers(false)
        return
      }
      if (confirmDelete) {
        setConfirmDelete(false)
        return
      }
      onBack()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onBack, showAddMembers, confirmDelete])

  useEffect(() => {
    let active = true
    api.getProject(project.id)
      .then(p => {
        if (!active) return
        setDetail(p)
        if (p.members) setMembers(p.members)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [project.id])

  useEffect(() => {
    if (tab === 'audit' && !auditLoaded) {
      setLoadingAudit(true)
      api.getAuditEvents(project.id, 100)
        .then(events => {
          setAuditEvents(events)
          setAuditLoaded(true)
        })
        .catch(() => {
          setAuditLoaded(true)
        })
        .finally(() => setLoadingAudit(false))
    }
  }, [tab, project.id, auditLoaded])

  const distinctAuditActions = useMemo(
    () => Array.from(new Set(auditEvents.map(ev => ev.action))),
    [auditEvents]
  )

  const filteredAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase()
    return auditEvents.filter(ev => {
      if (auditActionFilter !== 'ALL' && ev.action !== auditActionFilter) return false
      if (!q) return true
      const metaSummary = formatAuditMetadata(ev.metadata).toLowerCase()
      return (
        ev.actor_name.toLowerCase().includes(q) ||
        ev.action.toLowerCase().includes(q) ||
        metaSummary.includes(q)
      )
    })
  }, [auditEvents, auditSearch, auditActionFilter])

  const auditTotalPages = Math.max(1, Math.ceil(filteredAudit.length / auditPageSize))
  const safeAuditPage = Math.min(auditPage, auditTotalPages)
  const paginatedAudit = filteredAudit.slice(
    (safeAuditPage - 1) * auditPageSize,
    safeAuditPage * auditPageSize
  )

  const roleSummary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of ROLE_OPTIONS) counts[r] = 0
    for (const m of members) counts[m.role] = (counts[m.role] ?? 0) + 1
    return ROLE_OPTIONS.map(r => ({ role: r, count: counts[r] ?? 0 }))
  }, [members])

  function handleTabChange(nextTab: DetailTab) {
    setTab(nextTab)
    setShowAddMembers(false)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.deleteProject(detail.id)
      toast.success('Proyecto eliminado', detail.name)
      onDeleted()
    } catch (e: unknown) {
      toast.error(
        'Error al eliminar proyecto',
        e instanceof Error ? e.message : 'No se pudo eliminar el proyecto'
      )
    } finally {
      setDeleting(false)
    }
  }

  const tabs: { id: DetailTab; label: string; badge?: number }[] = [
    { id: 'info', label: 'Información' },
    { id: 'members', label: 'Miembros', badge: members.length },
    { id: 'audit', label: 'Auditoría', badge: auditLoaded ? auditEvents.length : undefined },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-backdrop-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-detail-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget) onBack()
      }}
    >
      <div className="relative nl-cyber-panel rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-pop-in">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/80 via-teal-400/70 to-violet-500/80" />

        <div className="shrink-0 px-6 py-4 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/35 flex items-center justify-center shrink-0">
              <FolderKanban className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2
                  id="project-detail-modal-title"
                  className="text-lg sm:text-xl font-bold text-white leading-tight"
                >
                  {detail.name}
                </h2>
                <StatusDot status={detail.status} />
              </div>
              <p className="text-xs text-slate-400 truncate">
                Propietario:{' '}
                <span className="text-slate-200">{detail.owner_name ?? detail.owner_id}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            aria-label="Cerrar detalles"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-700 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="shrink-0 px-6 pt-2 flex gap-1 border-b border-slate-800/80">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{t.label}</span>
              {typeof t.badge === 'number' && (
                <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-800/90 text-slate-300 border border-slate-700/70">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === 'info' && (
            <div className="space-y-5">
              <p className="text-slate-300 text-sm leading-relaxed">{detail.description}</p>

              {detail.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.tags.map(t => <TagChip key={t} tag={t} />)}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Datasets',
                    value: detail.datasets_count ?? 0,
                    color: 'text-cyan-400',
                    icon: Database,
                  },
                  {
                    label: 'Arquitecturas',
                    value: detail.architectures_count ?? 0,
                    color: 'text-violet-400',
                    icon: Layers,
                  },
                  {
                    label: 'Ejecuciones',
                    value: detail.jobs_count ?? 0,
                    color: 'text-indigo-400',
                    icon: Activity,
                  },
                  {
                    label: 'Modelos',
                    value: detail.models_count ?? 0,
                    color: 'text-emerald-400',
                    icon: Box,
                  },
                ].map(s => {
                  const Icon = s.icon
                  return (
                    <div
                      key={s.label}
                      className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3.5 text-center space-y-1"
                    >
                      <Icon className={`w-4 h-4 mx-auto ${s.color}`} />
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate-400">{s.label}</p>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-400">
                <span>
                  Creado:{' '}
                  <span className="text-slate-200">
                    {new Date(detail.created_at).toLocaleDateString('es-PE')}
                  </span>
                </span>
                <span>
                  Actualizado:{' '}
                  <span className="text-slate-200">
                    {new Date(detail.updated_at).toLocaleDateString('es-PE')}
                  </span>
                </span>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-900/45 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Distribución del equipo</h3>
                    <p className="text-xs text-slate-400">
                      {members.length} {members.length === 1 ? 'miembro asignado' : 'miembros asignados'} al área
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabChange('members')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <span>Gestionar miembros</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {roleSummary.map(item => (
                    <div
                      key={item.role}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800/70 text-xs"
                    >
                      <span className="text-slate-300 truncate">{item.role}</span>
                      <span className="px-2 py-0.5 rounded-full font-mono font-semibold bg-slate-800 text-cyan-300 shrink-0">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'members' && (
            <ProjectMembersTab
              projectId={detail.id}
              ownerId={detail.owner_id}
              members={members}
              users={users}
              showAddView={showAddMembers}
              onToggleAddView={setShowAddMembers}
              onMembersUpdated={setMembers}
            />
          )}

          {tab === 'audit' && (
            <div className="space-y-3">
              {loadingAudit ? (
                <div className="text-center py-8 text-slate-400 text-sm">Cargando eventos...</div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="relative flex-1 min-w-44">
                      <Search className="w-3.5 h-3.5 text-cyan-400/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={e => {
                          setAuditSearch(e.target.value)
                          setAuditPage(1)
                        }}
                        placeholder="Buscar por actor, acción o detalle..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                      {auditSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuditSearch('')
                            setAuditPage(1)
                          }}
                          aria-label="Limpiar búsqueda de auditoría"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <SystemSelect
                      value={auditActionFilter}
                      onChange={val => {
                        setAuditActionFilter(val)
                        setAuditPage(1)
                      }}
                      size="sm"
                      className="w-full sm:w-56"
                      searchable
                      searchPlaceholder="Buscar acción de auditoría..."
                      maxVisibleOptions={25}
                      ariaLabel="Filtrar por acción"
                      options={[
                        {
                          value: 'ALL',
                          label: 'Todas las acciones',
                          badge: String(auditEvents.length),
                        },
                        ...distinctAuditActions.map(action => ({
                          value: action,
                          label: action,
                        })),
                      ]}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/35 overflow-hidden">
                    {filteredAudit.length === 0 ? (
                      <p className="text-center py-8 text-slate-500 text-sm">
                        {auditEvents.length === 0
                          ? 'Sin eventos de auditoría'
                          : 'No hay eventos que coincidan con el filtro'}
                      </p>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-slate-400 border-b border-slate-800/80 bg-slate-900/50">
                                <th className="py-2.5 px-4 font-medium">Fecha</th>
                                <th className="py-2.5 px-4 font-medium">Actor</th>
                                <th className="py-2.5 px-4 font-medium">Acción</th>
                                <th className="py-2.5 px-4 font-medium">Detalles</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/70">
                              {paginatedAudit.map(ev => {
                                const summary = formatAuditMetadata(ev.metadata)
                                return (
                                  <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="py-2.5 px-4 text-slate-400 text-xs whitespace-nowrap">
                                      {new Date(ev.created_at).toLocaleString('es-PE')}
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-200">{ev.actor_name}</td>
                                    <td className="py-2.5 px-4">
                                      <AuditBadge action={ev.action} />
                                    </td>
                                    <td
                                      title={summary}
                                      className="py-2.5 px-4 text-xs text-slate-400 font-mono max-w-xs truncate"
                                    >
                                      {summary}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        <PaginationBar
                          currentPage={safeAuditPage}
                          totalItems={filteredAudit.length}
                          pageSize={auditPageSize}
                          pageSizeOptions={[5, 10, 25, 50]}
                          onPageChange={setAuditPage}
                          onPageSizeChange={size => {
                            setAuditPageSize(size)
                            setAuditPage(1)
                          }}
                          itemLabel="eventos"
                        />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-red-300">¿Eliminar proyecto?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-700/50 text-red-400 text-xs sm:text-sm hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar proyecto</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
            {onOpen && (
              <button
                type="button"
                onClick={() => onOpen(detail)}
                className="nl-btn-shimmer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md"
              >
                <span>Abrir Proyecto</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
