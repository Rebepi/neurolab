import { useState, useEffect } from 'react'
import { Plus, Search, GitMerge, FolderKanban, X } from 'lucide-react'
import { api } from '../../services/api'
import { Project, User } from '../../types'
import { ProjectCard } from './components/ProjectCard'
import { CreateProjectModal } from './components/CreateProjectModal'
import { ProjectDetailView } from './components/ProjectDetailView'
import { CrossAreaFusionModal } from '../../components/CrossAreaFusionModal'
import { ModuleStudioHero } from '../../components/ModuleStudioHero'
import { SystemTooltip } from '../../components/InfoTip'
import { PaginationBar } from '../../components/PaginationBar'
import { useToast } from '../../components/toast/ToastContext'

export default function ProjectsModule({
  onProjectSelect,
  currentProject,
  onNavigate,
}: {
  onProjectSelect: (p: any) => void
  currentProject?: any
  onNavigate?: (module: string) => void
}) {
  const { error: notifyError, success: notifySuccess } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCrossFusionModal, setShowCrossFusionModal] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const [ps, us] = await Promise.all([
        api.getProjects(),
        api.getUsers().catch(() => [] as User[]),
      ])
      setProjects(ps)
      setUsers(us)
    } catch (e: any) {
      notifyError('Error al cargar proyectos', e.message ?? 'No se pudieron obtener los proyectos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const query = search.trim().toLowerCase()
  const filtered = projects.filter(p => {
    if (!query) return true
    return (
      p.name.toLowerCase().includes(query) ||
      (p.description ?? '').toLowerCase().includes(query) ||
      (p.owner_name ?? '').toLowerCase().includes(query) ||
      (p.tags ?? []).some(t => t.toLowerCase().includes(query))
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedProjects = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )

  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null

  function handleOpen(project: Project) {
    onProjectSelect(project)
    notifySuccess('Workspace activado', `Pasando a Datasets de ${project.name}`)
    if (onNavigate) {
      onNavigate('datasets')
    } else {
      setSelectedProjectId(project.id)
    }
  }

  const totalModels = projects.reduce((acc, p) => acc + (p.models_count ?? 0), 0)
  const totalJobs = projects.reduce((acc, p) => acc + (p.jobs_count ?? 0), 0)

  return (
    <div className="flex-1 flex flex-col gap-5">
      <ModuleStudioHero
        variant="constellation"
        eyebrow="ORQUESTACIÓN DE WORKSPACES · MULTI-ÁREA"
        title="Áreas"
        highlight="Corporativas IA"
        subtitle="Organiza dominios de Deep Learning por área de telecomunicaciones o sintetiza un Modelo General 360°."
        icon={FolderKanban}
        tipTitle="Workspaces Corporativos"
        tipText="Cada proyecto aísla sus propios CSVs, arquitecturas Keras, corridas de entrenamiento y versiones registradas."
        metrics={[
          { label: 'Áreas', value: projects.length, tone: 'cyan' },
          { label: 'Modelos', value: totalModels, tone: 'emerald' },
          { label: 'Corridas', value: totalJobs, tone: 'violet' },
          { label: 'Usuarios', value: users.length, tone: 'teal' },
        ]}
        center={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400" />
            <input
              type="text"
              className="w-full pl-9 pr-24 py-1.5 rounded-xl bg-slate-950/75 border border-slate-800 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              placeholder="Buscar área o proyecto..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setCurrentPage(1)
                  }}
                  aria-label="Limpiar búsqueda"
                  className="p-0.5 rounded text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="px-2 py-0.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-nowrap">
                {filtered.length} visibles
              </span>
            </div>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SystemTooltip
              title="Fusión Cross-Área"
              label="Combina varias áreas corporativas de Aura Telecom en un único Modelo General 360° entrenado con TensorFlow/Keras."
              side="bottom"
            >
              <button
                onClick={() => setShowCrossFusionModal(true)}
                className="nl-btn-shimmer flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-semibold whitespace-nowrap transition-all shadow-md"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Unir Áreas · Modelo General 360°</span>
              </button>
            </SystemTooltip>
            <button
              onClick={() => setShowCreateModal(true)}
              className="nl-btn-shimmer flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold whitespace-nowrap transition-colors shadow-md shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Proyecto</span>
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="nl-skeleton rounded-2xl h-[256px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="nl-cyber-panel rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
          <Search className="w-10 h-10 text-slate-600" />
          <p className="text-slate-400 text-sm">No hay proyectos que coincidan con la búsqueda</p>
          {search.trim() && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setCurrentPage(1)
              }}
              className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-medium text-cyan-300 hover:bg-slate-800 transition-colors"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paginatedProjects.map((p, idx) => (
              <ProjectCard
                key={p.id}
                index={idx}
                project={p}
                isActive={currentProject?.id === p.id}
                onSelect={project => setSelectedProjectId(project.id)}
                onOpen={handleOpen}
              />
            ))}
          </div>

          <div className="nl-cyber-panel rounded-2xl overflow-hidden mt-auto">
            <PaginationBar
              currentPage={safePage}
              totalItems={filtered.length}
              pageSize={pageSize}
              pageSizeOptions={[3, 6, 9, 12, 24]}
              onPageChange={setCurrentPage}
              onPageSizeChange={size => {
                setPageSize(size)
                setCurrentPage(1)
              }}
              itemLabel="áreas"
            />
          </div>
        </div>
      )}

      {selectedProjectId && selectedProject && (
        <ProjectDetailView
          project={selectedProject}
          users={users}
          onBack={() => setSelectedProjectId(null)}
          onDeleted={() => {
            setSelectedProjectId(null)
            loadData()
          }}
          onOpen={project => {
            setSelectedProjectId(null)
            handleOpen(project)
          }}
        />
      )}

      {showCreateModal && (
        <CreateProjectModal
          users={users}
          onClose={() => setShowCreateModal(false)}
          onCreated={(createdProject) => {
            setShowCreateModal(false)
            onProjectSelect(createdProject)
            notifySuccess('Proyecto creado', `Avanzando al Paso 02: Cargar Dataset en "${createdProject.name}"`)
            if (onNavigate) {
              onNavigate('datasets')
            } else {
              loadData()
            }
          }}
        />
      )}
      {showCrossFusionModal && (
        <CrossAreaFusionModal
          onClose={() => setShowCrossFusionModal(false)}
          onSuccess={async res => {
            setShowCrossFusionModal(false)
            await loadData()
            const master = await api.getProject(res.project.id).catch(() => ({
              id: res.project.id,
              name: res.project.name,
            }))
            onProjectSelect(master)
            if (onNavigate) {
              onNavigate(res.job_id ? 'training' : 'datasets')
            }
          }}
        />
      )}
    </div>
  )
}
