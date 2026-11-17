import { useState, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import { api } from '../../services/api'
import { Project, User } from '../../types'
import { ProjectCard } from './components/ProjectCard'
import { CreateProjectModal } from './components/CreateProjectModal'
import { ProjectDetailView } from './components/ProjectDetailView'
import { useToast } from '../../components/toast/ToastContext'

export default function ProjectsModule({
  onProjectSelect,
}: {
  onProjectSelect: (p: any) => void
  currentProject?: any
}) {
  const { error: notifyError, success: notifySuccess } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const [ps, us] = await Promise.all([api.getProjects(), api.getUsers()])
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

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null

  function handleOpen(project: Project) {
    onProjectSelect(project)
    setSelectedProjectId(project.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 backdrop-blur-xl"
            placeholder="Buscar por nombre o descripción..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-800 animate-pulse rounded-xl h-52" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Search className="w-10 h-10 text-slate-600" />
          <p className="text-slate-400 text-sm">No hay proyectos que coincidan con la búsqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onSelect={project => setSelectedProjectId(project.id)}
              onOpen={handleOpen}
            />
          ))}
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
        />
      )}

      {showCreateModal && (
        <CreateProjectModal
          users={users}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            loadData()
            notifySuccess('Proyecto creado', 'El espacio de trabajo quedó disponible')
          }}
        />
      )}
    </div>
  )
}
