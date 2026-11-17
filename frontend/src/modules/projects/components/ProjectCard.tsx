import type { Project } from '../../../types'
import { InfoTip } from '../../../components/InfoTip'
import { StatusDot, TagChip } from './ProjectBadges'

interface ProjectCardProps {
  project: Project
  onSelect: (p: Project) => void
  onOpen: (p: Project) => void
}

export function ProjectCard({ project, onSelect, onOpen }: ProjectCardProps) {
  return (
    <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-5 flex flex-col gap-3 hover:border-slate-600/50 transition-colors">
      <div className="absolute top-4 right-4">
        <StatusDot status={project.status} />
      </div>
      <div className="pr-24">
        <h3 className="font-semibold text-lg text-white leading-tight">{project.name}</h3>
      </div>
      <p className="text-slate-400 text-sm line-clamp-2">{project.description}</p>
      {project.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.tags.map(t => <TagChip key={t} tag={t} />)}
        </div>
      )}
      <p className="text-xs text-slate-400">
        <span className="text-slate-500">Propietario: </span>
        {project.owner_name ?? project.owner_id}
      </p>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span>{project.jobs_count ?? 0} Ejecuciones</span>
          <InfoTip text="Total de corridas de entrenamiento lanzadas dentro de este proyecto." size="xs" />
        </span>
        <span className="text-slate-600">|</span>
        <span className="inline-flex items-center gap-1">
          <span>{project.models_count ?? 0} Modelos</span>
          <InfoTip text="Versiones de modelos .keras guardadas en el Model Registry de este proyecto." size="xs" />
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {new Date(project.created_at).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' })}
      </p>
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onSelect(project)}
          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition-colors"
        >
          Detalles
        </button>
        <button
          onClick={() => onOpen(project)}
          className="flex-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-medium hover:from-indigo-500 hover:to-indigo-400 transition-all"
        >
          Abrir Proyecto
        </button>
      </div>
    </div>
  )
}

