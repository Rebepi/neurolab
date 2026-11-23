import { useEffect, useRef, useState } from 'react'
import { Radio, Users, ShieldAlert, TrendingUp } from 'lucide-react'
import { useTheme } from '../../../context/ThemeContext'
import { InfoTip } from '../../../components/InfoTip'

interface DashboardHero3DProps {
  activeProjectName?: string
  totalModels: number
  totalDatasets: number
  totalRowsCorpus: number
  onNavigate?: (module: string) => void
  onOpenCrossFusion?: () => void
  onSelectAreaByKeyword: (keyword: string) => void
}

interface PhotonParticle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
  alpha: number
  phase: number
}

export function DashboardHero3D({
  activeProjectName,
  totalModels,
  totalDatasets,
  totalRowsCorpus,
  onSelectAreaByKeyword,
}: DashboardHero3DProps) {
  const { mode } = useTheme()
  const isLight = mode === 'light'
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const mouseRef = useRef({ x: 0.65, y: 0.5, active: false })
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const colors = isLight
      ? ['#0284c7', '#0d9488', '#4f46e5', '#7c3aed', '#d97706']
      : ['#22d3ee', '#5eead4', '#818cf8', '#c084fc', '#fb923c']
    const particles: PhotonParticle[] = Array.from({ length: 30 }, (_, i) => ({
      x: 0.38 + Math.random() * 0.58,
      y: 0.14 + Math.random() * 0.74,
      vx: (Math.random() - 0.5) * 0.00045,
      vy: (Math.random() - 0.5) * 0.00035,
      r: 1.4 + (i % 3) * 0.8,
      color: colors[i % colors.length],
      alpha: isLight ? 0.25 + (i % 5) * 0.08 : 0.35 + (i % 5) * 0.12,
      phase: i * 0.6,
    }))

    let animId = 0
    const render = (now: number) => {
      const t = now * 0.001
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const W = Math.max(320, rect.width)
      const H = Math.max(240, rect.height)
      if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
        canvas.width = Math.floor(W * dpr)
        canvas.height = Math.floor(H * dpr)
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, W, H)

      if (!reducedMotionRef.current) {
        let towerX = W * 0.83
        let towerY = H * 0.24
        let ringBaseW = W * 0.5
        const mastU = isLight ? 0.7442 : 0.7375
        const mastV = isLight ? 0.2086 : 0.2647
        const imgEl = imgRef.current
        if (imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
          const imgRect = imgEl.getBoundingClientRect()
          const scale = Math.min(imgRect.width / imgEl.naturalWidth, imgRect.height / imgEl.naturalHeight)
          const drawW = imgEl.naturalWidth * scale
          const drawH = imgEl.naturalHeight * scale
          const drawX = imgRect.right - rect.left - drawW
          const drawY = imgRect.bottom - rect.top - drawH
          towerX = drawX + drawW * mastU
          towerY = drawY + drawH * mastV
          ringBaseW = drawW
        }
        for (let rIdx = 0; rIdx < 3; rIdx++) {
          const ph = (t * 0.48 + rIdx * 0.33) % 1
          const rad = ringBaseW * (0.03 + ph * 0.145)
          ctx.beginPath()
          ctx.ellipse(towerX, towerY, rad, rad * 0.34, 0, 0, Math.PI * 2)
          ctx.strokeStyle = isLight
            ? rIdx % 2 === 0
              ? `rgba(2, 132, 199, ${(1 - ph) * 0.55})`
              : `rgba(124, 58, 237, ${(1 - ph) * 0.45})`
            : rIdx % 2 === 0
              ? `rgba(34, 211, 238, ${(1 - ph) * 0.46})`
              : `rgba(168, 85, 247, ${(1 - ph) * 0.42})`
          ctx.lineWidth = 1.6
          ctx.stroke()
        }

        for (const p of particles) {
          p.x += p.vx
          p.y += p.vy
          if (p.x < 0.37 || p.x > 0.97) p.vx *= -1
          if (p.y < 0.08 || p.y > 0.92) p.vy *= -1

          const px = p.x * W
          const py = p.y * H
          const glow = 0.55 + 0.45 * Math.sin(t * 2.4 + p.phase)
          const grad = ctx.createRadialGradient(px, py, 0.2, px, py, p.r * 3.8)
          grad.addColorStop(0, p.color)
          grad.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.globalAlpha = p.alpha * glow
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(px, py, p.r * 3.8, 0, Math.PI * 2)
          ctx.fill()

          ctx.globalAlpha = 0.9 * glow
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(px, py, p.r * 0.55, 0, Math.PI * 2)
          ctx.fill()
        }

        if (mouseRef.current.active) {
          const mx = mouseRef.current.x * W
          const my = mouseRef.current.y * H
          const mGrad = ctx.createRadialGradient(mx, my, 2, mx, my, 90)
          mGrad.addColorStop(0, 'rgba(34, 211, 238, 0.14)')
          mGrad.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.globalAlpha = 1
          ctx.fillStyle = mGrad
          ctx.beginPath()
          ctx.arc(mx, my, 90, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [isLight])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotionRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / Math.max(1, rect.width)
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height)
    mouseRef.current = { x: nx, y: ny, active: true }
    setTilt({
      rx: (ny - 0.5) * -2.2,
      ry: (nx - 0.5) * 3.2,
    })
  }

  function handleMouseLeave() {
    mouseRef.current.active = false
    setTilt({ rx: 0, ry: 0 })
  }

  const activeLower = (activeProjectName || '').toLowerCase()
  const domainPills = [
    { label: 'Retención 15K+5K', key: 'retencion', icon: Users, match: activeLower.includes('retenci'), cls: 'border-emerald-400/50 bg-emerald-950/55 text-emerald-200 hover:bg-emerald-900/60 shadow-[0_0_14px_rgba(16,185,129,0.18)]' },
    { label: 'Telemetría NOC 5G', key: 'noc', icon: Radio, match: activeLower.includes('noc'), cls: 'border-cyan-400/50 bg-cyan-950/55 text-cyan-200 hover:bg-cyan-900/60 shadow-[0_0_14px_rgba(34,211,238,0.18)]' },
    { label: 'Escudo Antifraude', key: 'antifraude', icon: ShieldAlert, match: activeLower.includes('antifraude'), cls: 'border-violet-400/50 bg-violet-950/55 text-violet-200 hover:bg-violet-900/60 shadow-[0_0_14px_rgba(167,139,250,0.18)]' },
    { label: 'Proyección LTV', key: 'comercial', icon: TrendingUp, match: activeLower.includes('comercial'), cls: 'border-amber-400/50 bg-amber-950/55 text-amber-200 hover:bg-amber-900/60 shadow-[0_0_14px_rgba(251,191,36,0.18)]' },
  ]

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="nl-cyber-panel rounded-2xl overflow-hidden min-h-[260px] sm:min-h-[282px] relative flex items-center animate-card-reveal"
    >
      <div
        className="pointer-events-none absolute inset-y-1 right-2 left-[36%] transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.0)`,
        }}
      >
        <img
          ref={imgRef}
          src={isLight ? '/studio/hero-telecom-ai-light.png?v=2' : '/studio/hero-telecom-ai.png'}
          alt="Aura Telecom AI Studio 3D"
          className={`w-full h-full object-contain object-right-bottom select-none ${
            isLight ? 'saturate-110' : 'brightness-110 saturate-125'
          }`}
        />
      </div>

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 w-full h-full"
      />

      <span
        className={`pointer-events-none hidden md:block absolute right-[1.8%] top-[20%] font-extrabold text-xl tracking-wider select-none ${
          isLight
            ? 'text-sky-600 drop-shadow-[0_0_10px_rgba(2,132,199,0.4)]'
            : 'text-cyan-300/95 drop-shadow-[0_0_14px_rgba(34,211,238,0.9)]'
        }`}
      >
        5G
      </span>

      <div className="relative z-10 w-full p-5 sm:p-6 flex flex-col justify-center space-y-2.5">
        <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-cyan-300 truncate">
            PLATAFORMA DE DEEP LEARNING PARA TELECOMUNICACIONES
          </span>
          <InfoTip
            title="Aura Telecom AI Studio 3D"
            text="Estudio integral con modelos reales TensorFlow/Keras, fusión intra-área y cross-área 360° y Gemelos Digitales 3D."
            size="xs"
          />
        </div>

        <div className="max-w-[430px]">
          <h1 className="text-2xl sm:text-[34px] font-extrabold text-white tracking-tight leading-tight sm:whitespace-nowrap">
            Aura Telecom{' '}
            <span className="nl-brand-gradient bg-clip-text text-transparent">
              AI Studio
            </span>
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-300 mt-1.5 leading-relaxed max-w-[345px]">
            Entrena, evalúa y despliega modelos reales de IA para redes 5G, fibra óptica y servicios de telecomunicaciones.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 max-w-[380px] pt-0.5">
          {domainPills.map(pill => {
            const Icon = pill.icon
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => onSelectAreaByKeyword(pill.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-semibold text-left transition-all ${pill.cls} ${
                  pill.match ? 'ring-1 ring-white/45 shadow-[0_0_16px_rgba(34,211,238,0.3)]' : ''
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{pill.label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center pt-0.5">
          <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-slate-950/65 border border-cyan-500/25 text-[10px] font-mono text-slate-300">
            <span className="text-cyan-300">{totalDatasets} CSVs</span>
            <span className="text-slate-600">·</span>
            <span className="text-white">{totalRowsCorpus.toLocaleString()} filas</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-300">{totalModels} modelos .keras</span>
          </span>
        </div>
      </div>
    </div>
  )
}
