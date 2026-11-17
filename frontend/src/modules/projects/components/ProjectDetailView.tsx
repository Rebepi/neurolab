import { useEffect, useState } from 'react'
import { ChevronLeft, Trash2, UserPlus } from 'lucide-react'
import { api } from '../../../services/api'
import type { AuditEvent, Project, ProjectMember, User } from '../../../types'
import { AuditBadge, RoleBadge, StatusDot, TagChip } from './ProjectBadges'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'
import { useToast } from '../../../components/toast/ToastContext'

type DetailTab = 'info' | 'members' | 'audit'

interface ProjectDetailViewProps {
  project: Project
  users: User[]
  onBack: () => void
  onDeleted: () => void
}

const ROLE_OPTIONS = [
  'Administrador',
  'Responsable de proyecto',
  'Ingeniero/analista de IA',
  'Revisor',
  'Lector',
] as const

export function ProjectDetailView({ project, users, onBack, onDeleted }: ProjectDetailViewProps) {
  const toast = useToast()
  const [tab, setTab] = useState<DetailTab>('info')
  const [members, setMembers] = useState<ProjectMember[]>(project.members ?? [])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [addUserId, setAddUserId] = useState(users[0]?.id ?? '')
  const [addRole, setAddRole] = useState('Lector')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const [auditPageSize, setAuditPageSize] = useState(10)

  const auditTotalPages = Math.max(1, Math.ceil(auditEvents.length / auditPageSize))
  const safeAuditPage = Math.min(auditPage, auditTotalPages)
  const paginatedAudit = auditEvents.slice(
    (safeAuditPage - 1) * auditPageSize,
    safeAuditPage * auditPageSize
  )

  useEffect(() => {
    if (tab === 'audit' && auditEvents.length === 0) {
      setLoadingAudit(true)
      api.getAuditEvents(project.id, 10)
        .then(setAuditEvents)
        .finally(() => setLoadingAudit(false))
    }
  }, [tab, project.id, auditEvents.length])

  useEffect(() => {
    api.getProject(project.id).then(p => {
      if (p.members) setMembers(p.members)
    })
  }, [project.id])

  async function handleAddMember() {
    setAdding(true)
    try {
      await api.addProjectMember(project.id, { user_id: addUserId, role: addRole })
      const updated = await api.getProject(project.id)
      if (updated.members) setMembers(updated.members)
      const targetUser = users.find(u => u.id === addUserId)
      toast.success('Miembro agregado', `${targetUser?.display_name ?? 'Usuario'} · ${addRole}`)
    } catch (e: unknown) {
      toast.error('Error al agregar miembro', e instanceof Error ? e.message : 'No se pudo asignar al proyecto')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await api.removeProjectMember(project.id, userId)
      setMembers(prev => prev.filter(m => m.user_id !== userId))
      toast.info('Miembro removido del proyecto')
    } catch (e: unknown) {
      toast.error('Error al remover miembro', e instanceof Error ? e.message : 'No se pudo remover del proyecto')
    }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar el proyecto "${project.name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      await api.deleteProject(project.id)
      toast.success('Proyecto eliminado', project.name)
      onDeleted()
    } catch (e: unknown) {
      toast.error('Error al eliminar proyecto', e instanceof Error ? e.message : 'No se pudo eliminar el proyecto')
    } finally {
      setDeleting(false)
    }
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'info', label: 'Información' },
    { id: 'members', label: 'Miembros' },
    { id: 'audit', label: 'Auditoría' },
  ]

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-white">{project.name}</h2>
      </div>

      <div className="flex gap-1 border-b border-slate-700/50">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">{project.description}</p>
          {project.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {project.tags.map(t => <TagChip key={t} tag={t} />)}
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            <span>Estado: <StatusDot status={project.status} /></span>
            <span>Creado: {new Date(project.created_at).toLocaleDateString('es-PE')}</span>
            <span>Actualizado: {new Date(project.updated_at).toLocaleDateString('es-PE')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Datasets', value: project.datasets_count ?? 0, color: 'text-cyan-400' },
              { label: 'Arquitecturas', value: project.architectures_count ?? 0, color: 'text-violet-400' },
              { label: 'Empleos', value: project.jobs_count ?? 0, color: 'text-indigo-400' },
              { label: 'Modelos', value: project.models_count ?? 0, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-700/50">
                  <th className="pb-2 pr-4 font-medium">Nombre</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Rol</th>
                  <th className="pb-2 pr-4 font-medium">Unido</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {members.map(m => (
                  <tr key={m.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 pr-4 text-slate-200">{m.display_name}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{m.email}</td>
                    <td className="py-2.5 pr-4"><RoleBadge role={m.role} /></td>
                    <td className="py-2.5 pr-4 text-slate-400 text-xs">
                      {new Date(m.created_at).toLocaleDateString('es-PE')}
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="p-1 rounded hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-800/40 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Agregar miembro
            </p>
            <div className="flex gap-2 flex-wrap">
              <SystemSelect
                value={addUserId}
                onChange={setAddUserId}
                size="sm"
                className="flex-1 min-w-44"
                ariaLabel="Seleccionar usuario para agregar"
                options={users.map(u => ({
                  value: u.id,
                  label: u.display_name,
                  description: u.email,
                }))}
              />
              <SystemSelect
                value={addRole}
                onChange={setAddRole}
                size="sm"
                className="w-52"
                ariaLabel="Rol del miembro"
                options={ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
              />
              <button
                onClick={handleAddMember}
                disabled={adding}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {adding ? '...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div>
          {loadingAudit ? (
            <div className="text-center py-8 text-slate-400 text-sm">Cargando eventos...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-700/50">
                    <th className="pb-2 pr-4 font-medium">Fecha</th>
                    <th className="pb-2 pr-4 font-medium">Actor</th>
                    <th className="pb-2 pr-4 font-medium">Acción</th>
                    <th className="pb-2 font-medium">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {paginatedAudit.map(ev => (
                    <tr key={ev.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 pr-4 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleString('es-PE')}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-200">{ev.actor_name}</td>
                      <td className="py-2.5 pr-4"><AuditBadge action={ev.action} /></td>
                      <td className="py-2.5 text-xs text-slate-500 font-mono max-w-xs truncate">
                        {JSON.stringify(ev.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditEvents.length === 0 ? (
                <p className="text-center py-6 text-slate-500 text-sm">Sin eventos de auditoría</p>
              ) : (
                <div className="mt-3 rounded-xl overflow-hidden border border-slate-800/80">
                  <PaginationBar
                    currentPage={safeAuditPage}
                    totalItems={auditEvents.length}
                    pageSize={auditPageSize}
                    pageSizeOptions={[5, 10, 25, 50]}
                    onPageChange={setAuditPage}
                    onPageSizeChange={size => {
                      setAuditPageSize(size)
                      setAuditPage(1)
                    }}
                    itemLabel="eventos"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-slate-700/50">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 rounded-lg border border-red-700/50 text-red-400 text-sm hover:bg-red-900/20 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Eliminando...' : 'Eliminar proyecto'}
        </button>
      </div>
    </div>
  )
}

