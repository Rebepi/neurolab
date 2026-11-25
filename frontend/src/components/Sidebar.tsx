import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Layers, FileText, Settings,
  Sparkles, PanelLeftClose, PanelLeftOpen, ChevronDown, Check,
  Shield, ScrollText, BookOpen, Wand2
} from 'lucide-react'
import { api } from '../services/api'
import type { Project } from '../types'
import { useTheme } from '../context/ThemeContext'
import { SystemTooltip } from './InfoTip'
import { SystemSelect } from './SystemSelect'

const PIPELINE_MODULE_IDS = [
  'projects',
  'datasets',
  'architectures',
  'training',
  'evaluation',
  'models',
  'inference',
] as const

interface NavItem {
  id: string
  label: string
  Icon: typeof LayoutDashboard
  badge?: string
  isPipelineEntry?: boolean
  iconBoxCls: string
  activeBoxCls: string
  activeBtnCls: string
  hoverBtnCls: string
}

interface NavGroup {
  id: string
  title: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    title: 'Centro Corporativo',
    items: [
      {
        id: 'dashboard',
        label: 'Centro de Mando',
        Icon: LayoutDashboard,
        iconBoxCls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/35 shadow-[0_0_10px_rgba(34,211,238,0.18)]',
        activeBoxCls: 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-[0_0_14px_rgba(34,211,238,0.4)]',
        activeBtnCls: 'bg-gradient-to-r from-cyan-500/25 via-cyan-500/10 to-slate-900/60 border-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.22)]',
        hoverBtnCls: 'hover:border-cyan-500/40',
      },
      {
        id: 'predict',
        label: 'Usar Modelos IA',
        Icon: Wand2,
        badge: 'LIVE',
        iconBoxCls: 'bg-teal-500/15 text-teal-400 border-teal-500/35 shadow-[0_0_10px_rgba(20,184,166,0.18)]',
        activeBoxCls: 'bg-teal-500/25 text-teal-200 border-teal-400/60 shadow-[0_0_14px_rgba(20,184,166,0.4)]',
        activeBtnCls: 'bg-gradient-to-r from-teal-500/25 via-cyan-500/10 to-slate-900/60 border-teal-400/60 shadow-[0_0_20px_rgba(20,184,166,0.22)]',
        hoverBtnCls: 'hover:border-teal-500/40',
      },
      {
        id: 'pipeline',
        label: 'Pipeline IA',
        Icon: Layers,
        isPipelineEntry: true,
        iconBoxCls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35 shadow-[0_0_10px_rgba(16,185,129,0.18)]',
        activeBoxCls: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60 shadow-[0_0_14px_rgba(16,185,129,0.4)]',
        activeBtnCls: 'bg-gradient-to-r from-emerald-500/25 via-teal-500/10 to-slate-900/60 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.22)]',
        hoverBtnCls: 'hover:border-emerald-500/40',
      },
      {
        id: 'visualizer',
        label: 'Motor Sináptico',
        Icon: Sparkles,
        badge: 'KERAS',
        iconBoxCls: 'bg-violet-500/15 text-violet-400 border-violet-500/35 shadow-[0_0_10px_rgba(168,85,247,0.18)]',
        activeBoxCls: 'bg-violet-500/25 text-violet-200 border-violet-400/60 shadow-[0_0_14px_rgba(168,85,247,0.4)]',
        activeBtnCls: 'bg-gradient-to-r from-violet-500/25 via-purple-500/10 to-slate-900/60 border-violet-400/60 shadow-[0_0_20px_rgba(168,85,247,0.22)]',
        hoverBtnCls: 'hover:border-violet-500/40',
      },
      {
        id: 'fundamentals',
        label: 'Fundamentos IA',
        Icon: BookOpen,
        iconBoxCls: 'bg-sky-500/15 text-sky-400 border-sky-500/35 shadow-[0_0_10px_rgba(56,189,248,0.18)]',
        activeBoxCls: 'bg-sky-500/25 text-sky-200 border-sky-400/60 shadow-[0_0_14px_rgba(56,189,248,0.4)]',
        activeBtnCls: 'bg-gradient-to-r from-sky-500/25 via-blue-500/10 to-slate-900/60 border-sky-400/60 shadow-[0_0_20px_rgba(56,189,248,0.22)]',
        hoverBtnCls: 'hover:border-sky-500/40',
      },
    ]
  },
  {
    id: 'governance',
    title: 'Gobernanza',
    items: [
      {
        id: 'reports',
        label: 'Reportes & PDF',
        Icon: FileText,
        iconBoxCls: 'bg-amber-500/15 text-amber-400 border-amber-500/35 shadow-[0_0_10px_rgba(245,158,11,0.18)]',
        activeBoxCls: 'bg-amber-500/25 text-amber-200 border-amber-400/60 shadow-[0_0_14px_rgba(245,158,11,0.4)]',
        activeBtnCls: 'bg-gradient-to-r from-amber-500/25 via-amber-500/10 to-slate-900/60 border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.22)]',
        hoverBtnCls: 'hover:border-amber-500/40',
      },
      {
        id: 'admin',
        label: 'Usuarios & RBAC',
        Icon: Shield,
        iconBoxCls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/35 shadow-[0_0_10px_rgba(99,102,241,0.18)]',
        activeBoxCls: 'bg-indigo-500/25 text-indigo-200 border-indigo-400/60 shadow-[0_0_14px_rgba(99,102,241,0.4)]',
        activeBtnCls: 'bg-gradient-to-r from-indigo-500/25 via-indigo-500/10 to-slate-900/60 border-indigo-400/60 shadow-[0_0_20px_rgba(99,102,241,0.22)]',
        hoverBtnCls: 'hover:border-indigo-500/40',
      },
      {
        id: 'audit',
        label: 'Auditoría',
        Icon: ScrollText,
        iconBoxCls: 'bg-rose-500/15 text-rose-400 border-rose-500/35 shadow-[0_0_10px_rgba(244,63,94,0.18)]',
        activeBoxCls: 'bg-rose-500/25 text-rose-200 border-rose-400/60 shadow-[0_0_14px_rgba(244,63,94,0.4)]',
        activeBtnCls: 'bg-gradient-to-r from-rose-500/25 via-rose-500/10 to-slate-900/60 border-rose-400/60 shadow-[0_0_20px_rgba(244,63,94,0.22)]',
        hoverBtnCls: 'hover:border-rose-500/40',
      },
      {
        id: 'settings',
        label: 'Configuración',
        Icon: Settings,
        iconBoxCls: 'bg-teal-500/15 text-teal-400 border-teal-500/35 shadow-[0_0_10px_rgba(20,184,166,0.18)]',
        activeBoxCls: 'bg-teal-500/25 text-teal-200 border-teal-400/60 shadow-[0_0_14px_rgba(20,184,166,0.4)]',
        activeBtnCls: 'bg-gradient-to-r from-teal-500/25 via-teal-500/10 to-slate-900/60 border-teal-400/60 shadow-[0_0_20px_rgba(20,184,166,0.22)]',
        hoverBtnCls: 'hover:border-teal-500/40',
      },
    ]
  }
]

function SidebarAuroraCanvas({ isLight }: { isLight: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const bokeh = Array.from({ length: 16 }, (_, idx) => ({
      x: (idx * 0.13 + 0.04) % 1,
      y: 0.28 + ((idx * 0.17) % 0.5),
      r: 1.0 + (idx % 3) * 0.65,
      speed: 0.00045 + (idx % 4) * 0.00022,
      color: idx % 2 === 0 ? (isLight ? '#0284c7' : '#22d3ee') : (isLight ? '#7c3aed' : '#a855f7'),
      phase: idx * 0.85,
    }))

    let animId = 0
    const render = (now: number) => {
      const t = reducedMotion ? 0 : now * 0.001
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const W = Math.max(64, rect.width)
      const H = Math.max(120, rect.height)
      if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
        canvas.width = Math.floor(W * dpr)
        canvas.height = Math.floor(H * dpr)
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, W, H)

      const filaments = [
        { amp: 18, freq: 0.02, speed: 1.05, yBase: 0.52, lw: 2.5, c0: isLight ? 'rgba(2,132,199,0.78)' : 'rgba(34,211,238,0.8)', c1: isLight ? 'rgba(79,70,229,0.7)' : 'rgba(129,140,248,0.72)', c2: isLight ? 'rgba(192,38,211,0.72)' : 'rgba(232,121,249,0.76)' },
        { amp: 15, freq: 0.024, speed: 0.88, yBase: 0.56, lw: 2.0, c0: isLight ? 'rgba(8,145,178,0.68)' : 'rgba(56,189,248,0.72)', c1: isLight ? 'rgba(124,58,237,0.68)' : 'rgba(168,85,247,0.7)', c2: isLight ? 'rgba(192,38,211,0.62)' : 'rgba(232,121,249,0.64)' },
        { amp: 16, freq: 0.018, speed: 1.24, yBase: 0.49, lw: 1.7, c0: isLight ? 'rgba(2,132,199,0.58)' : 'rgba(34,211,238,0.62)', c1: isLight ? 'rgba(79,70,229,0.64)' : 'rgba(129,140,248,0.66)', c2: isLight ? 'rgba(124,58,237,0.6)' : 'rgba(168,85,247,0.62)' },
        { amp: 13, freq: 0.028, speed: 0.78, yBase: 0.6, lw: 1.5, c0: isLight ? 'rgba(8,145,178,0.55)' : 'rgba(56,189,248,0.56)', c1: isLight ? 'rgba(79,70,229,0.58)' : 'rgba(129,140,248,0.58)', c2: isLight ? 'rgba(192,38,211,0.55)' : 'rgba(232,121,249,0.56)' },
        { amp: 12, freq: 0.032, speed: 1.38, yBase: 0.48, lw: 1.3, c0: isLight ? 'rgba(2,132,199,0.55)' : 'rgba(34,211,238,0.52)', c1: isLight ? 'rgba(124,58,237,0.58)' : 'rgba(168,85,247,0.58)', c2: isLight ? 'rgba(192,38,211,0.56)' : 'rgba(232,121,249,0.54)' },
        { amp: 19, freq: 0.021, speed: 0.96, yBase: 0.62, lw: 1.2, c0: isLight ? 'rgba(8,145,178,0.6)' : 'rgba(56,189,248,0.54)', c1: isLight ? 'rgba(79,70,229,0.65)' : 'rgba(129,140,248,0.6)', c2: isLight ? 'rgba(124,58,237,0.62)' : 'rgba(168,85,247,0.58)' },
      ]

      filaments.forEach((rb, rIdx) => {
        const grad = ctx.createLinearGradient(0, H * 0.75, W, H * 0.25)
        grad.addColorStop(0, rb.c0)
        grad.addColorStop(0.5, rb.c1)
        grad.addColorStop(1, rb.c2)

        ctx.beginPath()
        for (let x = 0; x <= W; x += 4) {
          const diag = (0.45 - x / W) * H * 0.22
          const wave = Math.sin(x * rb.freq + t * rb.speed + rIdx * 0.85) * rb.amp
          const harmonic = Math.cos(x * rb.freq * 0.5 - t * rb.speed * 0.68 + rIdx * 0.4) * (rb.amp * 0.45)
          const y = H * rb.yBase + diag + wave + harmonic
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = grad
        ctx.lineWidth = rb.lw
        ctx.shadowColor = rIdx % 2 === 0 ? (isLight ? 'rgba(2,132,199,0.35)' : 'rgba(34,211,238,0.55)') : (isLight ? 'rgba(124,58,237,0.3)' : 'rgba(168,85,247,0.5)')
        ctx.shadowBlur = isLight ? 4 : 10
        ctx.stroke()
      })

      ctx.shadowBlur = 0
      bokeh.forEach(p => {
        if (!reducedMotion) {
          p.x = (p.x + p.speed) % 1
        }
        const px = p.x * W
        const py = p.y * H + Math.sin(t * 1.4 + p.phase) * 6
        const a = (isLight ? 0.24 : 0.34) + (isLight ? 0.12 : 0.18) * Math.sin(t * 2.1 + p.phase)
        const rg = ctx.createRadialGradient(px, py, 0.2, px, py, p.r * 3)
        rg.addColorStop(0, p.color)
        rg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = Math.max(0.08, Math.min(isLight ? 0.36 : 0.48, a))
        ctx.fillStyle = rg
        ctx.beginPath()
        ctx.arc(px, py, p.r * 3, 0, Math.PI * 2)
        ctx.fill()
      })

      ctx.restore()
      if (!reducedMotion) {
        animId = requestAnimationFrame(render)
      }
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [isLight])

  return (
    <canvas
      ref={canvasRef}
      style={{
        maskImage: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,1) 24%, rgba(0,0,0,0.92) 60%, rgba(0,0,0,0.3) 84%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,1) 24%, rgba(0,0,0,0.92) 60%, rgba(0,0,0,0.3) 84%, transparent 100%)',
      }}
      className="pointer-events-none absolute inset-x-0 bottom-[54px] w-full h-52 z-0"
    />
  )
}

interface SidebarProps {
  activeModule: string
  onNavigate: (module: string) => void
  currentProject?: { id: string; name: string } | null
  onSelectProject?: (proj: { id: string; name: string }) => void
}

export default function Sidebar({
  activeModule,
  onNavigate,
  currentProject,
  onSelectProject
}: SidebarProps) {
  const { mode } = useTheme()
  const isLight = mode === 'light'
  const [collapsed, setCollapsed] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [lastPipelineModule, setLastPipelineModule] = useState<string>('projects')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    core: true,
    governance: true
  })
  const [counts, setCounts] = useState({ datasets: 0, architectures: 0, jobs: 0, models: 0 })

  useEffect(() => {
    if (PIPELINE_MODULE_IDS.includes(activeModule as (typeof PIPELINE_MODULE_IDS)[number])) {
      setLastPipelineModule(activeModule)
    }
  }, [activeModule])

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {})
  }, [currentProject?.id, activeModule])

  useEffect(() => {
    if (!currentProject) return
    Promise.all([
      api.getProjectDatasets(currentProject.id).then(r => r.length).catch(() => 0),
      api.getProjectArchitectures(currentProject.id).then(r => r.length).catch(() => 0),
      api.getProjectJobs(currentProject.id).then(r => r.length).catch(() => 0),
      api.getProjectModels(currentProject.id).then(r => r.length).catch(() => 0),
    ]).then(([d, a, j, m]) => {
      setCounts({ datasets: d, architectures: a, jobs: j, models: m })
    })
  }, [currentProject?.id, activeModule])

  function isPipelineDone(id: string): boolean {
    if (id === 'projects') return Boolean(currentProject)
    if (id === 'datasets') return counts.datasets > 0
    if (id === 'architectures') return counts.architectures > 0
    if (id === 'training') return counts.jobs > 0
    if (id === 'evaluation') return counts.jobs > 0
    if (id === 'models') return counts.models > 0
    if (id === 'inference') return counts.models > 0
    return false
  }

  const completedPipelineSteps = PIPELINE_MODULE_IDS.filter(isPipelineDone).length
  const inPipeline = PIPELINE_MODULE_IDS.includes(activeModule as (typeof PIPELINE_MODULE_IDS)[number])

  function toggleGroup(id: string) {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <aside
      className={`relative flex flex-col bg-[#040b19]/95 backdrop-blur-2xl border-r border-cyan-500/20 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] select-none z-30 ${
        collapsed ? 'w-[70px]' : 'w-[254px]'
      }`}
    >
      <SidebarAuroraCanvas isLight={isLight} />

      <div className={`relative z-10 flex items-center h-16 shrink-0 border-b border-cyan-500/15 ${collapsed ? 'justify-center px-2' : 'justify-between px-3.5'}`}>
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex items-center group focus:outline-none p-1 rounded-xl ${collapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}
        >
          <div className="relative shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 via-indigo-500/25 to-violet-500/25 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_18px_rgba(34,211,238,0.28)] transition-transform duration-300 group-hover:scale-105">
            <svg viewBox="0 0 32 32" className="w-6 h-6">
              <defs>
                <linearGradient id="auraPrismGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="55%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <path
                d="M16 4L27 26H21.2L16 14.8L10.8 26H5L16 4Z"
                fill="url(#auraPrismGrad)"
              />
              <path
                d="M11.5 21.5H20.5L18.6 17.8H13.4L11.5 21.5Z"
                fill="#a5f3fc"
              />
            </svg>
          </div>

          {!collapsed && (
            <div className="text-left min-w-0 overflow-hidden">
              <span className="text-white font-extrabold text-sm tracking-tight leading-none block">
                Aura Telecom
              </span>
              <p className="nl-brand-gradient bg-clip-text text-transparent text-xs font-extrabold tracking-tight mt-0.5 leading-none">
                AI Studio
              </p>
            </div>
          )}
        </button>
      </div>

      {!collapsed && currentProject && projects.length > 0 && (
        <div className="relative z-10 px-3 pt-2.5 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
            Workspace / Área Activa
          </p>
          <SystemSelect
            value={currentProject.id}
            onChange={id => {
              const found = projects.find(p => p.id === id)
              if (found) onSelectProject?.({ id: found.id, name: found.name })
            }}
            size="xs"
            menuMinWidth={270}
            searchable
            searchPlaceholder="Buscar área o workspace..."
            maxVisibleOptions={25}
            options={projects.map(p => ({
              value: p.id,
              label: p.name,
              description: p.description,
            }))}
          />
        </div>
      )}

      <nav className="relative z-10 flex-1 py-2 px-2.5 space-y-2.5 overflow-y-auto overflow-x-hidden">
        {NAV_GROUPS.map(group => {
          const isOpen = openGroups[group.id] ?? true

          return (
            <div key={group.id} className="space-y-0.5">
              {!collapsed && (
                <div className="w-full flex items-center justify-between px-2 py-0.5">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors group"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-slate-500 group-hover:text-white transition-transform duration-200 ${
                        isOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>
                </div>
              )}

              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isOpen || collapsed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <ul className="relative z-10 space-y-1.5">
                    {group.items.map(({ id, label, Icon, badge, isPipelineEntry, iconBoxCls, activeBoxCls, activeBtnCls, hoverBtnCls }) => {
                      const isActive = isPipelineEntry ? inPipeline : activeModule === id
                      const stepCompleted = isPipelineEntry && completedPipelineSteps === PIPELINE_MODULE_IDS.length
                      const targetModule = isPipelineEntry ? (inPipeline ? activeModule : lastPipelineModule) : id
                      const tooltipLabel = isPipelineEntry ? `Pipeline IA (${completedPipelineSteps}/7 etapas)` : label

                      const navButton = (
                        <button
                          onClick={() => onNavigate(targetModule)}
                          className={`relative w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left border transition-all duration-200 group ${
                            collapsed ? 'justify-center' : ''
                          } ${
                            isActive
                              ? `${activeBtnCls} text-white`
                              : `bg-slate-900/45 hover:bg-slate-800/75 text-slate-300 hover:text-white border-slate-800/90 ${hoverBtnCls}`
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`relative w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-105 ${
                                isActive ? activeBoxCls : iconBoxCls
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {stepCompleted && !isActive && (
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ${
                                    isLight ? 'ring-white' : 'ring-slate-950'
                                  }`}
                                >
                                  <Check className="w-1.5 h-1.5 stroke-[3]" />
                                </span>
                              )}
                            </div>

                            {!collapsed && (
                              <span
                                className={`text-xs font-semibold truncate transition-transform duration-200 ${
                                  isActive
                                    ? 'text-white font-bold'
                                    : 'text-slate-300 group-hover:text-white group-hover:translate-x-0.5'
                                }`}
                              >
                                {label}
                              </span>
                            )}
                          </div>

                          {!collapsed && (badge || isPipelineEntry) && (
                            <div className="flex items-center gap-1 shrink-0">
                              {badge && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-extrabold rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  {badge}
                                </span>
                              )}
                              {isPipelineEntry && (
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md border ${
                                    stepCompleted
                                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                      : 'bg-slate-950/90 border-slate-800 text-cyan-300'
                                  }`}
                                >
                                  {completedPipelineSteps}/7
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      )

                      return (
                        <li key={id} className="relative">
                          {collapsed ? (
                            <SystemTooltip
                              label={tooltipLabel}
                              side="right"
                              className="w-full flex"
                            >
                              {navButton}
                            </SystemTooltip>
                          ) : (
                            navButton
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="relative z-10 px-3.5 py-1.5 flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400">v2.6.0</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            Online
          </span>
        </div>
      )}

      <div className="relative z-10 p-2.5 border-t border-cyan-500/15 bg-[#040b19]/55 backdrop-blur-md">
        <SystemTooltip
          label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          className="w-full flex"
          side="top"
        >
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-cyan-500/20 hover:border-cyan-400/45 text-slate-300 hover:text-white transition-all duration-200 group ${
              collapsed ? 'justify-center' : 'justify-start'
            }`}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
            )}
            {!collapsed && (
              <span className="text-xs font-semibold">Colapsar panel</span>
            )}
          </button>
        </SystemTooltip>
      </div>
    </aside>
  )
}
