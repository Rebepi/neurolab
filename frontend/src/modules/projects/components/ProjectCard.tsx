import { useState } from 'react'
import {
  ArrowRight,
  Box,
  FolderKanban,
  Layers,
  Play,
  Radio,
  RotateCw,
  ShieldAlert,
  TrendingUp,
  User,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Project } from '../../../types'
import { StatusDot, TagChip } from './ProjectBadges'

interface ProjectCardProps {
  project: Project
  index?: number
  isActive?: boolean
  onSelect: (p: Project) => void
  onOpen: (p: Project) => void
}

export function splitProjectTitle(name: string): { code: string; title: string } {
  const dotIdx = name.indexOf('·')
  if (dotIdx > 0) {
    const code = name.slice(0, dotIdx).trim()
    const title = name.slice(dotIdx + 1).trim()
    return { code, title: title || name }
  }
  return { code: 'Proyecto IA', title: name }
}

export function getAreaVisual(project: Pick<Project, 'id' | 'name'>): {
  icon: LucideIcon
  boxClass: string
  glowClass: string
} {
  const key = `${project.id} ${project.name}`.toLowerCase()
  if (key.includes('retencion') || key.includes('retención')) {
    return {
      icon: Users,
      boxClass: 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300',
      glowClass: 'bg-cyan-500/15',
    }
  }
  if (key.includes('noc') || key.includes('5g') || key.includes('fibra')) {
    return {
      icon: Radio,
      boxClass: 'bg-sky-500/15 border-sky-500/35 text-sky-300',
      glowClass: 'bg-sky-500/15',
    }
  }
  if (key.includes('antifraude') || key.includes('seguridad') || key.includes('sim-swap')) {
    return {
      icon: ShieldAlert,
      boxClass: 'bg-violet-500/15 border-violet-500/35 text-violet-300',
      glowClass: 'bg-violet-500/15',
    }
  }
  if (key.includes('comercial') || key.includes('ltv')) {
    return {
      icon: TrendingUp,
      boxClass: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
      glowClass: 'bg-emerald-500/15',
    }
  }
  if (key.includes('general') || key.includes('360')) {
    return {
      icon: Layers,
      boxClass: 'bg-teal-500/15 border-teal-500/35 text-teal-300',
      glowClass: 'bg-teal-500/15',
    }
  }
  return {
    icon: FolderKanban,
    boxClass: 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300',
    glowClass: 'bg-indigo-500/15',
  }
}

export function ProjectCard({
  project,
  index = 0,
  isActive = false,
  onSelect,
  onOpen,
}: ProjectCardProps) {
  const [flipped, setFlipped] = useState(false)
  const { code, title } = splitProjectTitle(project.name)
  const visual = getAreaVisual(project)
  const AreaIcon = visual.icon
  const ownerLabel = project.owner_name ?? project.owner_id
  const formattedDate = new Date(project.created_at).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      style={{ animationDelay: `${Math.min(index * 55, 330)}ms` }}
      onMouseLeave={() => setFlipped(false)}
      className={`nl-flip-scene animate-card-reveal h-[256px] ${flipped ? 'is-flipped' : ''}`}
    >
      <div className="nl-flip-inner">
        <div
          onClick={() => setFlipped(true)}
          className={`nl-flip-face nl-flip-front nl-cyber-panel rounded-2xl p-5 flex flex-col justify-between overflow-hidden cursor-pointer ${
            isActive ? 'ring-1 ring-cyan-400/55 border-cyan-400/55' : ''
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${
              isActive
                ? 'from-cyan-400 via-teal-400 to-cyan-400'
                : 'from-cyan-400/75 via-teal-400/65 to-violet-500/75'
            }`}
          />
          <div
            className={`pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl ${visual.glowClass}`}
          />

          <div className="space-y-3.5 relative">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${visual.boxClass}`}
                >
                  <AreaIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 truncate">
                    {code}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-400/40 shrink-0">
                      Activa
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <StatusDot status={project.status} />
              </div>
            </div>

            <h3 className="font-bold text-base sm:text-[17px] text-white leading-snug line-clamp-2">
              {title}
            </h3>

            {project.tags?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {project.tags.slice(0, 3).map(t => (
                  <TagChip key={t} tag={t} />
                ))}
                {project.tags.length > 3 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800/80 border border-slate-700/70 text-slate-300">
                    +{project.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-3 border-t border-slate-800/75 relative">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs min-w-0">
                <Play className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-mono font-semibold text-white">{project.jobs_count ?? 0}</span>
                <span className="text-slate-400 truncate">ejecuciones</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs min-w-0">
                <Box className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono font-semibold text-white">{project.models_count ?? 0}</span>
                <span className="text-slate-400 truncate">modelos</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-400 min-w-0">
                <User className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{ownerLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-300/80 font-medium shrink-0">
                <span>Ver descripción</span>
                <RotateCw className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        <div className="nl-flip-face nl-flip-back nl-cyber-panel rounded-2xl p-5 flex flex-col justify-between overflow-hidden border-cyan-400/45">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-teal-400 to-violet-500" />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 shrink-0">
                  {code}
                </span>
                <span className="text-xs font-semibold text-white truncate">{title}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 shrink-0">{formattedDate}</span>
            </div>

            <p className="text-[13px] text-slate-200 leading-relaxed line-clamp-4">
              {project.description || 'Sin descripción registrada para este workspace.'}
            </p>

            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="truncate">
                Propietario: <span className="text-slate-200 font-medium">{ownerLabel}</span>
              </span>
              <span className="font-mono text-cyan-300 shrink-0">
                {project.jobs_count ?? 0} ejec. · {project.models_count ?? 0} mod.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-800/75">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                e.currentTarget.blur()
                setFlipped(false)
                onSelect(project)
              }}
              className="px-3 py-2 rounded-xl border border-slate-700/90 text-slate-200 text-xs font-medium hover:bg-slate-800 hover:text-white transition-colors"
            >
              Detalles
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                e.currentTarget.blur()
                setFlipped(false)
                onOpen(project)
              }}
              className="nl-btn-shimmer inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold transition-all shadow-md"
            >
              <span>Abrir Proyecto</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
