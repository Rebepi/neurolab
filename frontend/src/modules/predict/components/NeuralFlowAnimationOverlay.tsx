import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  EyeOff,
  FastForward,
  GripVertical,
  Layers,
  LayoutGrid,
  Maximize2,
  Minus,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { LayerTrace, PredictionResponse } from '../../../types/index'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import type { InterpretedVerdict } from '../fieldDictionary'

export interface AnimatedInputItem {
  key: string
  label: string
  displayValue: string
  scaledValue: number
}

interface NeuralFlowAnimationOverlayProps {
  open: boolean
  areaName: string
  goalTitle: string
  modelName: string
  inputItems: AnimatedInputItem[]
  result: PredictionResponse | null
  verdict: InterpretedVerdict | null
  onSkip: () => void
  onDisableAutoAnimation: () => void
}

interface HoverNodeInfo {
  x: number
  y: number
  containerWidth: number
  containerHeight: number
  kind: 'input' | 'converter' | 'neuron' | 'output'
  layerIdx?: number
  neuronIdx?: number
  inputIdx?: number
  title: string
  subtitle: string
  valueText: string
  extraNote?: string
}

interface SparkParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  radius: number
  color: string
}

interface AmbientStar {
  x: number
  y: number
  r: number
  speedX: number
  speedY: number
  phase: number
  hue: 'cyan' | 'violet' | 'teal'
}

const TOTAL_DURATION_MS = 6800

const STAGE_BOUNDS = [
  { id: 0, short: 'Datos', label: '1. Captura de Datos', start: 0.0, end: 0.22 },
  { id: 1, short: 'Tensores', label: '2. Conversión Tensorial', start: 0.22, end: 0.44 },
  { id: 2, short: 'Red IA', label: '3. Propagación Neuronal', start: 0.44, end: 0.85 },
  { id: 3, short: 'Veredicto', label: '4. Convergencia Final', start: 0.85, end: 1.0 },
] as const

const SPEED_CYCLE: Array<0.6 | 1 | 1.6> = [1, 1.6, 0.6]

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function easeOutCubic(t: number): number {
  const c = clamp01(t)
  return 1 - Math.pow(1 - c, 3)
}

function easeOutQuart(t: number): number {
  const c = clamp01(t)
  return 1 - Math.pow(1 - c, 4)
}

function easeInOutCubic(t: number): number {
  const c = clamp01(t)
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}

function cubicBezier(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const inv = 1 - t
  return (
    inv * inv * inv * p0 +
    3 * inv * inv * t * p1 +
    3 * inv * t * t * p2 +
    t * t * t * p3
  )
}

function getTonePalette(tone?: InterpretedVerdict['tone']) {
  if (tone === 'danger') {
    return {
      primary: '#fb7185',
      secondary: '#f43f5e',
      bright: '#fecdd3',
      rgb: '251, 113, 133',
      glow: 'rgba(244, 63, 94, 0.52)',
      soft: 'rgba(244, 63, 94, 0.22)',
    }
  }
  if (tone === 'warn') {
    return {
      primary: '#fbbf24',
      secondary: '#f59e0b',
      bright: '#fef3c7',
      rgb: '251, 191, 36',
      glow: 'rgba(245, 158, 11, 0.52)',
      soft: 'rgba(245, 158, 11, 0.22)',
    }
  }
  if (tone === 'safe') {
    return {
      primary: '#34d399',
      secondary: '#10b981',
      bright: '#d1fae5',
      rgb: '52, 211, 153',
      glow: 'rgba(16, 185, 129, 0.52)',
      soft: 'rgba(16, 185, 129, 0.22)',
    }
  }
  return {
    primary: '#22d3ee',
    secondary: '#06b6d4',
    bright: '#cffafe',
    rgb: '34, 211, 238',
    glow: 'rgba(34, 211, 238, 0.52)',
    soft: 'rgba(6, 182, 212, 0.22)',
  }
}

const LAYER_THEME = [
  { hex: '#2dd4bf', bright: '#ccfbf1', rgb: '45, 212, 191', formula: 'z = (x − μ) / σ' },
  { hex: '#38bdf8', bright: '#e0f2fe', rgb: '56, 189, 248', formula: 'h = ReLU(W·x + b)' },
  { hex: '#818cf8', bright: '#e0e7ff', rgb: '129, 140, 248', formula: 'h = φ(W·h + b)' },
  { hex: '#a78bfa', bright: '#ede9fe', rgb: '167, 139, 250', formula: 'h = φ(W·h + b)' },
  { hex: '#c084fc', bright: '#f3e8ff', rgb: '192, 132, 252', formula: 'h = φ(W·h + b)' },
  { hex: '#22d3ee', bright: '#cffafe', rgb: '34, 211, 238', formula: 'ŷ = σ(W·h + b)' },
]

function buildFallbackTraces(inputCount: number): LayerTrace[] {
  const inUnits = Math.max(4, inputCount || 8)
  return [
    {
      name: 'Capa de Entrada',
      type: 'Input',
      units: inputCount || 8,
      activation: 'z-score',
      neurons: Array.from({ length: inUnits }, (_, i) => 0.4 + ((i * 17) % 45) / 100),
      mean_activation: 0.52,
      max_activation: 0.88,
      active_ratio: 1,
    },
    {
      name: 'Capa Oculta 1 (Dense)',
      type: 'Dense',
      units: 64,
      activation: 'relu',
      neurons: Array.from({ length: 8 }, (_, i) => 0.35 + ((i * 23) % 55) / 100),
      mean_activation: 0.55,
      max_activation: 0.91,
      active_ratio: 0.82,
    },
    {
      name: 'Capa Oculta 2 (Dense)',
      type: 'Dense',
      units: 32,
      activation: 'relu',
      neurons: Array.from({ length: 6 }, (_, i) => 0.3 + ((i * 29) % 60) / 100),
      mean_activation: 0.48,
      max_activation: 0.85,
      active_ratio: 0.78,
    },
    {
      name: 'Capa de Salida',
      type: 'Output',
      units: 1,
      activation: 'sigmoid',
      neurons: [0.75],
      mean_activation: 0.75,
      max_activation: 0.75,
      active_ratio: 1,
    },
  ]
}

// Sintetizador WebAudio minimalista (cero archivos externos, tono cristalino sutil)
function playSynapseTone(
  ctxRef: React.MutableRefObject<AudioContext | null>,
  freq: number,
  duration = 0.22,
  gainPeak = 0.038,
  type: OscillatorType = 'sine'
) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    if (!ctxRef.current) {
      ctxRef.current = new AudioCtx()
    }
    const audio = ctxRef.current
    if (audio.state === 'suspended') {
      audio.resume().catch(() => { })
    }
    const now = audio.currentTime
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.015, now + duration)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  } catch {
    // Silencioso si el navegador bloquea autoplay
  }
}

export function NeuralFlowAnimationOverlay({
  open,
  areaName,
  goalTitle,
  modelName,
  inputItems,
  result,
  verdict,
  onSkip,
  onDisableAutoAnimation,
}: NeuralFlowAnimationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const progressRef = useRef<number>(0)
  const pausedRef = useRef<boolean>(false)
  const speedRef = useRef<number>(1)
  const soundRef = useRef<boolean>(true)
  const hoverNodeRef = useRef<HoverNodeInfo | null>(null)
  const draggingTimelineRef = useRef<boolean>(false)
  const cameraRef = useRef<{ zoom: number; panX: number; panY: number }>({
    zoom: 1,
    panX: 0,
    panY: 0,
  })
  const panDragRef = useRef<{
    active: boolean
    startX: number
    startY: number
    origPanX: number
    origPanY: number
  }>({ active: false, startX: 0, startY: 0, origPanX: 0, origPanY: 0 })
  const hoverTargetsRef = useRef<
    Array<{
      x: number
      y: number
      r: number
      box?: { x: number; y: number; w: number; h: number }
      info: HoverNodeInfo
    }>
  >([])

  const [progressUi, setProgressUi] = useState(0)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState<0.6 | 1 | 1.6>(1)
  const [zoomPct, setZoomPct] = useState(100)
  const [isPanningCanvas, setIsPanningCanvas] = useState(false)
  const [showAllNeurons, setShowAllNeurons] = useState(true)
  const showAllNeuronsRef = useRef<boolean>(true)
  const [compactMatrix, setCompactMatrix] = useState(false)
  const compactMatrixRef = useRef<boolean>(false)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nl_predict_anim_sound') !== '0'
    } catch {
      return true
    }
  })
  const [hoverNode, setHoverNode] = useState<HoverNodeInfo | null>(null)
  const [cardMinimized, setCardMinimized] = useState(false)
  const [cardPos, setCardPos] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingCard, setIsDraggingCard] = useState(false)
  const isDraggingCardRef = useRef<boolean>(false)
  const verdictCardRef = useRef<HTMLDivElement | null>(null)
  const cardDragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })

  useEffect(() => {
    soundRef.current = soundEnabled
  }, [soundEnabled])

  useEffect(() => {
    showAllNeuronsRef.current = showAllNeurons
  }, [showAllNeurons])

  useEffect(() => {
    compactMatrixRef.current = compactMatrix
  }, [compactMatrix])

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const visibleInputs = useMemo(() => inputItems, [inputItems])

  const displayLayers = useMemo<LayerTrace[]>(() => {
    const raw =
      result?.layer_traces && result.layer_traces.length >= 2
        ? result.layer_traces
        : buildFallbackTraces(visibleInputs.length)

    if (raw.length <= 6) return raw
    return raw.filter((layer, idx) => {
      if (idx === 0 || idx === raw.length - 1) return true
      const low = layer.type.toLowerCase()
      return low !== 'dropout' && low !== 'reshape' && low !== 'flatten'
    })
  }, [result, visibleInputs.length])

  const totalModelNeurons = useMemo(
    () => displayLayers.reduce((acc, l) => acc + (l.units || 0), 0),
    [displayLayers]
  )

  const hasExpandableHiddenLayers = useMemo(
    () =>
      displayLayers.some(
        (l, idx) =>
          idx > 0 &&
          idx < displayLayers.length - 1 &&
          ((l.neurons?.length || 0) > 8 || (l.units || 0) > 8)
      ),
    [displayLayers]
  )

  const hasCompactableLayers = useMemo(
    () =>
      showAllNeurons &&
      displayLayers.some(l => (l.neurons?.length || l.units || 0) > 24),
    [displayLayers, showAllNeurons]
  )

  const topMiniDrivers = useMemo(() => {
    const mapByKey = new Map(inputItems.map(it => [it.key, it]))
    return (result?.feature_contributions || [])
      .filter(f => !f.name.startsWith('indice_') && f.name !== 'area_corporativa')
      .slice(0, 3)
      .map(f => {
        const clean = f.name.includes('__') ? f.name.split('__').slice(1).join('__') : f.name
        const match =
          mapByKey.get(clean) ||
          inputItems.find(it => clean.startsWith(`${it.key}_`))
        return {
          key: f.name,
          label: match?.label || clean.replace(/_/g, ' '),
          val: match?.displayValue || f.raw_value,
          pct: f.importance_pct,
        }
      })
  }, [inputItems, result?.feature_contributions])

  // Bloqueo de scroll y atajos de teclado (Esc, Espacio, Flechas)
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onSkip()
      } else if (e.key === ' ') {
        e.preventDefault()
        if (progressRef.current >= 0.995) {
          onSkip()
        } else {
          pausedRef.current = !pausedRef.current
          setPaused(pausedRef.current)
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        progressRef.current = clamp01(progressRef.current + 0.08)
        setProgressUi(progressRef.current)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        progressRef.current = clamp01(progressRef.current - 0.08)
        setProgressUi(progressRef.current)
      } else if (e.key === '0') {
        e.preventDefault()
        cameraRef.current = { zoom: 1, panX: 0, panY: 0 }
        setZoomPct(100)
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        showAllNeuronsRef.current = !showAllNeuronsRef.current
        setShowAllNeurons(showAllNeuronsRef.current)
        hoverNodeRef.current = null
        setHoverNode(null)
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        compactMatrixRef.current = !compactMatrixRef.current
        setCompactMatrix(compactMatrixRef.current)
        hoverNodeRef.current = null
        setHoverNode(null)
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        const cont = containerRef.current
        const cx = cont ? cont.clientWidth / 2 : 600
        const cy = cont ? cont.clientHeight / 2 : 300
        const prev = cameraRef.current
        const nextZoom = Math.min(6.0, Number((prev.zoom * 1.2).toFixed(3)))
        const wx = (cx - prev.panX) / prev.zoom
        const wy = (cy - prev.panY) / prev.zoom
        cameraRef.current = {
          zoom: nextZoom,
          panX: cx - wx * nextZoom,
          panY: cy - wy * nextZoom,
        }
        setZoomPct(Math.round(nextZoom * 100))
      } else if (e.key === '-') {
        e.preventDefault()
        const cont = containerRef.current
        const cx = cont ? cont.clientWidth / 2 : 600
        const cy = cont ? cont.clientHeight / 2 : 300
        const prev = cameraRef.current
        const nextZoom = Math.max(0.22, Number((prev.zoom / 1.2).toFixed(3)))
        const wx = (cx - prev.panX) / prev.zoom
        const wy = (cy - prev.panY) / prev.zoom
        cameraRef.current = {
          zoom: nextZoom,
          panX: cx - wx * nextZoom,
          panY: cy - wy * nextZoom,
        }
        setZoomPct(Math.round(nextZoom * 100))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onSkip, open])

  // Reiniciar al abrir
  useEffect(() => {
    if (!open) return
    progressRef.current = reducedMotion ? 1 : 0
    pausedRef.current = false
    hoverNodeRef.current = null
    cameraRef.current = { zoom: 1, panX: 0, panY: 0 }
    panDragRef.current.active = false
    const raf = window.requestAnimationFrame(() => {
      setProgressUi(reducedMotion ? 1 : 0)
      setPaused(false)
      setHoverNode(null)
      setCardMinimized(false)
      setCardPos(null)
      setIsDraggingCard(false)
      setZoomPct(100)
      setIsPanningCanvas(false)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [open, reducedMotion])

  // Zoom suave con rueda del ratón anclado al cursor
  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const prev = cameraRef.current
      const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14
      const nextZoom = Math.max(0.22, Math.min(5.0, Number((prev.zoom * factor).toFixed(4))))
      if (Math.abs(nextZoom - prev.zoom) < 0.0005) return

      const wx = (mx - prev.panX) / prev.zoom
      const wy = (my - prev.panY) / prev.zoom
      cameraRef.current = {
        zoom: nextZoom,
        panX: mx - wx * nextZoom,
        panY: my - wy * nextZoom,
      }
      setZoomPct(Math.round(nextZoom * 100))
      hoverNodeRef.current = null
      setHoverNode(null)
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [open])

  // Motor Cinemático Canvas 60fps
  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let lastTs = performance.now()
    let lastUiSync = 0

    const palette = getTonePalette(verdict?.tone)
    const sparks: SparkParticle[] = []
    const triggeredMilestones = new Set<string>()
    let prevProgressForReset = 0

    // Campo ambiental de partículas neuronales con profundidad
    const stars: AmbientStar[] = Array.from({ length: 54 }, (_, i) => ({
      x: ((i * 73) % 100) / 100,
      y: ((i * 41 + 17) % 100) / 100,
      r: 0.9 + (i % 3) * 0.75,
      speedX: (i % 2 === 0 ? 1 : -1) * (0.004 + (i % 5) * 0.002),
      speedY: (i % 3 === 0 ? -1 : 1) * (0.003 + (i % 4) * 0.0018),
      phase: i * 0.65,
      hue: i % 3 === 0 ? 'cyan' : i % 3 === 1 ? 'violet' : 'teal',
    }))

    const spawnBurst = (
      x: number,
      y: number,
      color: string,
      count: number,
      speedScale = 1,
      startOffset = 16
    ) => {
      for (let i = 0; i < count; i++) {
        if (sparks.length > 260) sparks.shift()
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45
        const spd = (0.7 + Math.random() * 2.1) * speedScale
        sparks.push({
          x: x + Math.cos(angle) * startOffset,
          y: y + Math.sin(angle) * startOffset,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 0,
          maxLife: 420 + Math.random() * 380,
          radius: 1.4 + Math.random() * 2.1,
          color,
        })
      }
    }

    const drawRoundedRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      const radius = Math.min(r, w / 2, h / 2)
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.arcTo(x + w, y, x + w, y + h, radius)
      ctx.arcTo(x + w, y + h, x, y + h, radius)
      ctx.arcTo(x, y + h, x, y, radius)
      ctx.arcTo(x, y, x + w, y, radius)
      ctx.closePath()
    }

    const drawCometTrail = (
      samplePos: (t: number) => { x: number; y: number },
      tHead: number,
      tailLen: number,
      headColor: string,
      rgb: string,
      headRadius = 3.8
    ) => {
      const steps = 10
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let s = 0; s < steps; s++) {
        const f0 = clamp01(tHead - (tailLen * (s + 1)) / steps)
        const f1 = clamp01(tHead - (tailLen * s) / steps)
        if (f1 <= f0) continue
        const p0 = samplePos(f0)
        const p1 = samplePos(f1)
        const ratio = 1 - s / steps
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.strokeStyle = `rgba(${rgb}, ${(0.12 + ratio * 0.72).toFixed(3)})`
        ctx.lineWidth = Math.max(1, headRadius * 1.15 * ratio)
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      const head = samplePos(clamp01(tHead))
      const g = ctx.createRadialGradient(head.x, head.y, 0.4, head.x, head.y, headRadius * 3.2)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.32, headColor)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(head.x, head.y, headRadius * 3.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(head.x, head.y, headRadius * 0.65, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const render = (now: number) => {
      const dt = Math.min(50, now - lastTs)
      lastTs = now

      if (!pausedRef.current && !draggingTimelineRef.current && progressRef.current < 1) {
        const cap = result ? 1 : 0.21
        const next = progressRef.current + (dt / TOTAL_DURATION_MS) * speedRef.current
        progressRef.current = Math.min(cap, next)
      }

      // Resetear hitos si el usuario retrocedió o repitió
      if (progressRef.current < prevProgressForReset - 0.05) {
        triggeredMilestones.clear()
      }
      prevProgressForReset = progressRef.current

      if (now - lastUiSync > 45 || progressRef.current >= 1) {
        lastUiSync = now
        setProgressUi(progressRef.current)
      }

      const rect = container.getBoundingClientRect()
      const W = Math.max(640, rect.width)
      const H = Math.max(380, rect.height)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
        canvas.width = Math.floor(W * dpr)
        canvas.height = Math.floor(H * dpr)
      }

      const p = progressRef.current
      const tSec = now * 0.001
      const pulse = Math.sin(now * 0.0045) * 0.5 + 0.5
      const activeHover = hoverNodeRef.current
      const targets: Array<{
        x: number
        y: number
        r: number
        box?: { x: number; y: number; w: number; h: number }
        info: HoverNodeInfo
      }> = []

      const s1 = clamp01((p - 0.0) / 0.22)
      const s2 = clamp01((p - 0.22) / 0.22)
      const s3 = clamp01((p - 0.44) / 0.41)
      const s4 = clamp01((p - 0.85) / 0.15)

      ctx.save()
      ctx.scale(dpr, dpr)

      // =====================================================
      // FONDO CINEMÁTICO: Nebulosa profunda + Horizonte + Estrellas
      // =====================================================
      const bgGrad = ctx.createRadialGradient(W * 0.52, H * 0.48, 40, W * 0.52, H * 0.48, Math.max(W, H) * 0.78)
      bgGrad.addColorStop(0, '#091936')
      bgGrad.addColorStop(0.52, '#040c1f')
      bgGrad.addColorStop(1, '#020612')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)

      // Nebulosas atmosféricas suaves que respiran con el veredicto
      const neb1 = ctx.createRadialGradient(W * 0.16, H * 0.48, 20, W * 0.16, H * 0.48, W * 0.28)
      neb1.addColorStop(0, `rgba(20, 184, 166, ${0.11 + 0.05 * s1})`)
      neb1.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = neb1
      ctx.fillRect(0, 0, W, H)

      const neb2 = ctx.createRadialGradient(W * 0.56, H * 0.5, 20, W * 0.56, H * 0.5, W * 0.34)
      neb2.addColorStop(0, `rgba(99, 102, 241, ${0.09 + 0.08 * s3})`)
      neb2.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = neb2
      ctx.fillRect(0, 0, W, H)

      const neb3 = ctx.createRadialGradient(W * 0.9, H * 0.5, 16, W * 0.9, H * 0.5, W * 0.24)
      neb3.addColorStop(0, `rgba(${palette.rgb}, ${0.05 + 0.22 * easeOutCubic(s4)})`)
      neb3.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = neb3
      ctx.fillRect(0, 0, W, H)

      // Cuadrícula sutil técnica + puntos
      ctx.save()
      const gridStep = 44
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.032)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let gx = 22; gx < W; gx += gridStep) {
        ctx.moveTo(gx, 0)
        ctx.lineTo(gx, H)
      }
      for (let gy = 22; gy < H; gy += gridStep) {
        ctx.moveTo(0, gy)
        ctx.lineTo(W, gy)
      }
      ctx.stroke()

      // Partículas bokeh flotantes
      stars.forEach(st => {
        const sx = ((st.x + tSec * st.speedX) % 1 + 1) % 1
        const sy = ((st.y + tSec * st.speedY) % 1 + 1) % 1
        const alpha = 0.15 + 0.22 * (0.5 + 0.5 * Math.sin(tSec * 1.8 + st.phase))
        ctx.fillStyle =
          st.hue === 'cyan'
            ? `rgba(56, 189, 248, ${alpha})`
            : st.hue === 'violet'
              ? `rgba(167, 139, 250, ${alpha})`
              : `rgba(45, 212, 191, ${alpha})`
        ctx.beginPath()
        ctx.arc(sx * W, sy * H, st.r, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.restore()

      // Aplicar cámara interactiva (Zoom con rueda + Pan con arrastre)
      const cam = cameraRef.current
      ctx.save()
      ctx.translate(cam.panX, cam.panY)
      ctx.scale(cam.zoom, cam.zoom)

      // =====================================================
      // LAYOUT RESPONSIVO DE LAS 4 ZONAS DEL ESCENARIO
      // =====================================================
      const padTop = 64
      const padBottom = 60
      const usableH = Math.max(240, H - padTop - padBottom)
      const centerY = padTop + usableH / 2

      const inputCount = Math.max(1, visibleInputs.length)
      const inputGap = inputCount > 10 ? 4 : 9
      const inputCardW =
        inputCount > 10
          ? Math.min(226, Math.max(178, W * 0.165))
          : Math.min(184, Math.max(136, W * 0.14))
      const inputCardH = Math.min(
        46,
        Math.max(22, (usableH - 12 - Math.max(0, inputCount - 1) * inputGap) / inputCount)
      )
      const compactInputCard = inputCardH < 34
      const inputX = Math.max(20, W * 0.02)

      const totalInputsH =
        inputCount * inputCardH + Math.max(0, inputCount - 1) * inputGap
      const convW = Math.min(118, Math.max(92, W * 0.088))
      const convH = Math.min(usableH * 0.94, Math.max(340, totalInputsH))
      const convX = inputX + inputCardW + Math.max(42, W * 0.044)
      const convY = centerY - convH / 2

      const netStartX = convX + convW + Math.max(54, W * 0.055)
      const netEndX = W - Math.max(198, W * 0.165)
      const outNodeX = W - Math.max(94, W * 0.078)

      const layerCount = displayLayers.length
      const layerSpacing = layerCount > 1 ? (netEndX - netStartX) / (layerCount - 1) : 0

      // Haz de luz volumétrico (Spotlight) que sigue el frente de onda en vivo
      const beamX =
        p < 0.22
          ? inputX + inputCardW * 0.5 + (convX - inputX - inputCardW * 0.5) * easeInOutCubic(s1)
          : p < 0.44
            ? convX + convW * 0.5 + (netStartX - convX - convW * 0.5) * easeInOutCubic(s2)
            : p < 0.85
              ? netStartX + (netEndX - netStartX) * s3
              : netEndX + (outNodeX - netEndX) * easeOutCubic(s4)

      ctx.save()
      const beamGrad = ctx.createLinearGradient(beamX - 90, 0, beamX + 90, 0)
      beamGrad.addColorStop(0, 'rgba(34, 211, 238, 0)')
      beamGrad.addColorStop(
        0.5,
        s4 > 0 ? `rgba(${palette.rgb}, 0.095)` : 'rgba(56, 189, 248, 0.085)'
      )
      beamGrad.addColorStop(1, 'rgba(34, 211, 238, 0)')
      ctx.fillStyle = beamGrad
      ctx.fillRect(beamX - 90, padTop - 20, 180, usableH + 40)
      ctx.restore()

      // Posiciones de todas las neuronas (Entrada siempre 100%; en modo 1 columna las neuronas mantienen tamaño legible y las columnas crecen verticalmente para explorarlas con zoom/arrastre)
      const showAll = showAllNeuronsRef.current
      const layerMeta: Array<{
        cx: number
        colW: number
        subCols: number
        rowsPerCol: number
        stepY: number
        colGap: number
        topY: number
        bottomY: number
      }> = []

      const layerNodeCoords: Array<
        Array<{ x: number; y: number; act: number; rawAct: number; idx: number }>
      > = displayLayers.map((layer, lIdx) => {
        const lx = netStartX + lIdx * layerSpacing
        const isFirst = lIdx === 0
        const isLast = lIdx === layerCount - 1
        const rawArr =
          layer.neurons && layer.neurons.length > 0
            ? layer.neurons
            : Array.from(
              { length: isFirst ? Math.max(1, layer.units || visibleInputs.length) : isLast ? Math.max(1, layer.units || 1) : showAll ? Math.min(64, layer.units || 8) : 8 },
              () => 0.45
            )

        let picked: Array<{ v: number; origIdx: number }>
        if (isFirst || isLast || showAll || rawArr.length <= 8) {
          picked = rawArr.map((v, idx) => ({ v, origIdx: idx }))
        } else {
          // Vista resumida inteligente: 8 estratos cubriendo toda la capa eligiendo la neurona más activa de cada bloque
          const targetCount = 8
          picked = []
          for (let b = 0; b < targetCount; b++) {
            const sIdx = Math.floor((b * rawArr.length) / targetCount)
            const eIdx = Math.max(sIdx + 1, Math.floor(((b + 1) * rawArr.length) / targetCount))
            let bestIdx = sIdx
            let bestMag = Math.abs(rawArr[sIdx])
            for (let k = sIdx + 1; k < eIdx; k++) {
              const mag = Math.abs(rawArr[k])
              if (mag > bestMag) {
                bestMag = mag
                bestIdx = k
              }
            }
            picked.push({ v: rawArr[bestIdx], origIdx: bestIdx })
          }
        }

        const nCount = picked.length
        const useCompactMatrix = compactMatrixRef.current
        const subCols =
          !useCompactMatrix || nCount <= 24
            ? 1
            : nCount <= 40
              ? 2
              : nCount <= 80
                ? 4
                : Math.min(6, Math.ceil(nCount / 22))
        const rowsPerCol = Math.ceil(nCount / subCols)
        const minReadableStepY = 26
        const fitSpanH = Math.min(usableH * (rowsPerCol > 10 ? 0.92 : 0.84), Math.max(96, (rowsPerCol - 1) * 46))
        const minReadableSpanH = rowsPerCol > 1 ? (rowsPerCol - 1) * minReadableStepY : 0
        const spanH = Math.max(fitSpanH, minReadableSpanH)
        const stepY = rowsPerCol > 1 ? spanH / (rowsPerCol - 1) : 0
        const maxRackW = Math.max(20, layerSpacing - 26)
        const idealColGap = subCols <= 2 ? 25 : subCols <= 4 ? 23 : 18
        const colGap = subCols > 1 ? Math.min(idealColGap, maxRackW / (subCols - 1)) : 0
        const rackW = (subCols - 1) * colGap
        const startX = lx - rackW / 2
        const colW = isLast ? 64 : Math.max(56, Math.min(layerSpacing - 14, rackW + 30))
        const topY = rowsPerCol > 1 ? centerY - spanH / 2 : centerY
        const bottomY = rowsPerCol > 1 ? centerY + spanH / 2 : centerY

        layerMeta.push({ cx: lx, colW, subCols, rowsPerCol, stepY, colGap, topY, bottomY })

        return picked.map((item, k) => {
          const col = Math.floor(k / rowsPerCol)
          const row = k % rowsPerCol
          const colItems = Math.min(rowsPerCol, nCount - col * rowsPerCol)
          const colSpanH = colItems > 1 ? (colItems - 1) * stepY : 0
          const colStartY = centerY - colSpanH / 2
          const nx = subCols === 1 ? lx : startX + col * colGap
          const ny = colItems === 1 ? centerY : colStartY + row * stepY
          const absAct = Math.max(0.1, Math.min(1, Math.abs(item.v)))
          return {
            x: nx,
            y: ny,
            act: absAct,
            rawAct: item.v,
            idx: item.origIdx,
          }
        })
      })

      // Posiciones de tarjetas de entrada (TODAS las variables del formulario)
      const inputStartY = centerY - totalInputsH / 2
      const inputCoords = visibleInputs.map((item, idx) => {
        const y = inputStartY + idx * (inputCardH + inputGap)
        return {
          item,
          idx,
          x: inputX,
          y,
          cx: inputX + inputCardW,
          cy: y + inputCardH / 2,
        }
      })

      // Sonido y chispas en hitos clave
      if (s1 > 0.12 && !triggeredMilestones.has('stage1')) {
        triggeredMilestones.add('stage1')
        if (soundRef.current) playSynapseTone(audioCtxRef, 329.63, 0.24, 0.03)
      }
      if (s2 > 0.08 && !triggeredMilestones.has('stage2')) {
        triggeredMilestones.add('stage2')
        spawnBurst(convX + convW / 2, centerY, '#2dd4bf', 18, 1.15)
        if (soundRef.current) playSynapseTone(audioCtxRef, 440, 0.26, 0.034)
      }

      // =====================================================
      // FASE 1: Tarjetas de Datos Reales -> Prism Conversor
      // =====================================================
      // Etiqueta superior de Zona 1
      ctx.save()
      ctx.textAlign = 'left'
      ctx.fillStyle = s1 > 0 ? '#67e8f9' : '#64748b'
      ctx.font = '800 9.5px "JetBrains Mono", monospace'
      ctx.fillText('01 · TUS DATOS REALES', inputX + 2, padTop - 22)
      ctx.fillStyle = '#64748b'
      ctx.font = '600 9px "Plus Jakarta Sans", system-ui, sans-serif'
      ctx.fillText(`${inputItems.length} variables de entrada`, inputX + 2, padTop - 8)
      ctx.restore()

      inputCoords.forEach((ic, idx) => {
        const idxNorm = idx / Math.max(1, inputCoords.length - 1)
        const appear = easeOutQuart(clamp01(s1 * 2.2 - idxNorm * 0.65))
        const travel = easeInOutCubic(clamp01((s1 - 0.16 - idxNorm * 0.24) / 0.64))
        const convTargetY =
          convY + 32 + ((convH - 52) * idx) / Math.max(1, inputCoords.length - 1)
        const midX = (ic.cx + convX) / 2
        const isHovered = activeHover?.kind === 'input' && activeHover.inputIdx === idx
        const dimmed = activeHover && activeHover.kind === 'input' && !isHovered

        // Conducto óptico Bézier
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(ic.cx, ic.cy)
        ctx.bezierCurveTo(midX, ic.cy, midX, convTargetY, convX, convTargetY)
        ctx.strokeStyle = isHovered
          ? 'rgba(103, 232, 249, 0.92)'
          : s1 > 0.18
            ? `rgba(34, 211, 238, ${dimmed ? 0.08 : 0.16 + 0.42 * travel})`
            : 'rgba(148, 163, 184, 0.12)'
        ctx.lineWidth = isHovered ? 2.4 : s1 > 0.18 ? 1.55 : 1
        ctx.stroke()
        ctx.restore()

        // Cometa luminoso + píldora flotante del dato humano viajando hacia el conversor
        const inSteadyInput = s4 > 0.5 && idx % 2 === 0
        if (s1 > 0.16 && (s2 < 0.7 || isHovered || inSteadyInput)) {
          const tPart = s1 < 1 ? travel : (tSec * (inSteadyInput && !isHovered ? 0.38 : 0.52) + idx * 0.17) % 1
          const sample = (t: number) => ({
            x: cubicBezier(t, ic.cx, midX, midX, convX),
            y: cubicBezier(t, ic.cy, ic.cy, convTargetY, convTargetY),
          })
          drawCometTrail(
            sample,
            tPart,
            inSteadyInput && !isHovered ? 0.18 : 0.24,
            '#67e8f9',
            '34, 211, 238',
            isHovered ? 4.4 : inSteadyInput ? 2.5 : 3.5
          )

          if (s1 < 0.96 && travel > 0.08 && travel < 0.92 && idx < 5) {
            const pt = sample(tPart)
            const pillTxt =
              ic.item.displayValue.length > 10
                ? `${ic.item.displayValue.slice(0, 9)}…`
                : ic.item.displayValue
            ctx.save()
            ctx.font = '700 9px "JetBrains Mono", monospace'
            const tw = ctx.measureText(pillTxt).width + 12
            drawRoundedRect(pt.x - tw / 2, pt.y - 22, tw, 16, 6)
            ctx.fillStyle = 'rgba(6, 20, 44, 0.92)'
            ctx.fill()
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.fillStyle = '#e0f2fe'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(pillTxt, pt.x, pt.y - 14)
            ctx.restore()
          }
        }

        // Tarjeta glassmórfica del dato ingresado
        ctx.save()
        ctx.globalAlpha = dimmed ? 0.35 : Math.max(0.12, appear)
        const slideX = (1 - appear) * -28
        const cardX = ic.x + slideX

        drawRoundedRect(cardX, ic.y, inputCardW, inputCardH, 11)
        const cardBg = ctx.createLinearGradient(cardX, ic.y, cardX + inputCardW, ic.y + inputCardH)
        cardBg.addColorStop(0, isHovered ? 'rgba(14, 48, 86, 0.96)' : 'rgba(9, 24, 52, 0.92)')
        cardBg.addColorStop(1, 'rgba(6, 15, 34, 0.95)')
        ctx.fillStyle = cardBg
        if (isHovered || (s1 > 0.15 && s1 < 0.98)) {
          ctx.shadowColor = isHovered ? 'rgba(34, 211, 238, 0.55)' : 'rgba(34, 211, 238, 0.25)'
          ctx.shadowBlur = isHovered ? 18 : 10
        }
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = isHovered
          ? '#67e8f9'
          : s1 > 0.15
            ? 'rgba(34, 211, 238, 0.52)'
            : 'rgba(51, 65, 85, 0.8)'
        ctx.lineWidth = isHovered ? 1.7 : 1.15
        ctx.stroke()

        // Barra lateral luminosa de intensidad Z-Score
        const zMag = clamp01(Math.abs(ic.item.scaledValue) / 2.5)
        drawRoundedRect(cardX + 3, ic.y + (compactInputCard ? 4 : 6), 3, Math.max(8, inputCardH - (compactInputCard ? 8 : 12)), 2)
        ctx.fillStyle = ic.item.scaledValue >= 0 ? '#2dd4bf' : '#60a5fa'
        ctx.globalAlpha *= 0.45 + 0.55 * zMag
        ctx.fill()
        ctx.globalAlpha = dimmed ? 0.35 : Math.max(0.12, appear)

        // Etiqueta y valor real (1 fila horizontal compacta si hay >10 variables, 2 filas si caben)
        if (compactInputCard) {
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#cbd5e1'
          ctx.font = '600 9px "Plus Jakarta Sans", system-ui, sans-serif'
          ctx.textAlign = 'left'
          const lbl = ic.item.label.length > 18 ? `${ic.item.label.slice(0, 17)}…` : ic.item.label
          ctx.fillText(lbl, cardX + 10, ic.cy + 0.5)

          ctx.fillStyle = '#f8fafc'
          ctx.font = '700 9.5px "JetBrains Mono", monospace'
          ctx.textAlign = 'right'
          const vStr =
            ic.item.displayValue.length > 13
              ? `${ic.item.displayValue.slice(0, 12)}…`
              : ic.item.displayValue
          ctx.fillText(vStr, cardX + inputCardW - 9, ic.cy + 0.5)
        } else {
          ctx.fillStyle = '#94a3b8'
          ctx.font = '600 9.5px "Plus Jakarta Sans", system-ui, sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'alphabetic'
          const lbl = ic.item.label.length > 20 ? `${ic.item.label.slice(0, 19)}…` : ic.item.label
          ctx.fillText(lbl, cardX + 12, ic.y + 15)

          ctx.fillStyle = '#f8fafc'
          ctx.font = '700 11.5px "JetBrains Mono", monospace'
          const vStr =
            ic.item.displayValue.length > 17
              ? `${ic.item.displayValue.slice(0, 16)}…`
              : ic.item.displayValue
          ctx.fillText(vStr, cardX + 12, ic.y + inputCardH - 9)
        }

        // Puerto de salida brillante a la derecha de la tarjeta
        ctx.beginPath()
        ctx.arc(cardX + inputCardW, ic.cy, isHovered ? 3.8 : 2.6, 0, Math.PI * 2)
        ctx.fillStyle = s1 > 0.15 ? '#67e8f9' : '#475569'
        ctx.fill()
        ctx.restore()

        targets.push({
          x: ic.x + inputCardW / 2,
          y: ic.cy,
          r: Math.max(11, inputCardH / 2),
          box: { x: ic.x, y: ic.y, w: inputCardW, h: inputCardH },
          info: {
            x: ic.cx,
            y: ic.cy,
            containerWidth: W,
            containerHeight: H,
            kind: 'input',
            inputIdx: idx,
            title: ic.item.label,
            subtitle: 'Variable real ingresada en el formulario',
            valueText: `${ic.item.displayValue} → Tensor ${ic.item.scaledValue >= 0 ? '+' : ''}${ic.item.scaledValue.toFixed(2)}`,
            extraNote: 'Normalizada por Z-Score / One-Hot antes de entrar a la red',
          },
        })
      })

      // =====================================================
      // FASE 2: PRISMA CONVERSOR TENSORIAL (Z-Score + One-Hot)
      // =====================================================
      const convActive = s2 > 0
      const convPulse = s2 > 0 && s2 < 1 ? 0.5 + 0.5 * Math.sin(now * 0.016) : 0.25

      ctx.save()
      ctx.textAlign = 'center'
      ctx.fillStyle = convActive ? '#5eead4' : '#64748b'
      ctx.font = '800 9.5px "JetBrains Mono", monospace'
      ctx.fillText('02 · CONVERSOR IA', convX + convW / 2, padTop - 22)
      ctx.fillStyle = '#64748b'
      ctx.font = '600 9px "Plus Jakarta Sans", system-ui, sans-serif'
      ctx.fillText('Z-Score · One-Hot', convX + convW / 2, padTop - 8)
      ctx.restore()

      // Halo exterior del Prisma Conversor
      if (convActive) {
        ctx.save()
        const prismGlow = ctx.createRadialGradient(
          convX + convW / 2,
          centerY,
          10,
          convX + convW / 2,
          centerY,
          convH * 0.65
        )
        prismGlow.addColorStop(0, `rgba(45, 212, 191, ${0.14 + convPulse * 0.12})`)
        prismGlow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = prismGlow
        ctx.fillRect(convX - 60, convY - 60, convW + 120, convH + 120)
        ctx.restore()
      }

      // Cuerpo del Prisma Conversor
      ctx.save()
      drawRoundedRect(convX, convY, convW, convH, 18)
      const convGrad = ctx.createLinearGradient(convX, convY, convX + convW, convY + convH)
      convGrad.addColorStop(0, convActive ? 'rgba(13, 148, 136, 0.30)' : 'rgba(11, 22, 46, 0.85)')
      convGrad.addColorStop(0.5, convActive ? 'rgba(8, 36, 68, 0.92)' : 'rgba(8, 17, 36, 0.92)')
      convGrad.addColorStop(1, convActive ? 'rgba(99, 102, 241, 0.30)' : 'rgba(11, 22, 46, 0.85)')
      ctx.fillStyle = convGrad
      if (convActive) {
        ctx.shadowColor = 'rgba(45, 212, 191, 0.45)'
        ctx.shadowBlur = 16 + convPulse * 14
      }
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.lineWidth = convActive ? 1.8 : 1.1
      ctx.strokeStyle = convActive ? 'rgba(45, 212, 191, 0.82)' : 'rgba(71, 85, 105, 0.65)'
      ctx.stroke()

      // Clip interior del prisma para el haz escáner y anillos orbitales
      ctx.clip()

      // Anillo giroscópico sutil dentro del conversor
      ctx.save()
      ctx.translate(convX + convW / 2, centerY)
      ctx.rotate(tSec * (convActive ? 1.2 : 0.25))
      ctx.strokeStyle = convActive ? 'rgba(45, 212, 191, 0.24)' : 'rgba(100, 116, 139, 0.12)'
      ctx.lineWidth = 1.2
      ctx.setLineDash([8, 6])
      ctx.beginPath()
      ctx.arc(0, 0, convW * 0.42, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      // Haz láser escáner vertical durante Fase 2
      if (s2 > 0 && s2 < 1) {
        const scanY = convY + ((tSec * 1.4) % 1) * convH
        const scanGrad = ctx.createLinearGradient(0, scanY - 26, 0, scanY + 26)
        scanGrad.addColorStop(0, 'rgba(45, 212, 191, 0)')
        scanGrad.addColorStop(0.5, 'rgba(94, 234, 212, 0.45)')
        scanGrad.addColorStop(1, 'rgba(45, 212, 191, 0)')
        ctx.fillStyle = scanGrad
        ctx.fillRect(convX, scanY - 26, convW, 52)
      }

      // Valores tensoriales convertidos en filas vivas
      ctx.textAlign = 'center'
      ctx.fillStyle = convActive ? '#99f6e4' : '#64748b'
      ctx.font = '800 9px "JetBrains Mono", monospace'
      ctx.fillText('TENSOR ENGINE', convX + convW / 2, convY + 22)

      const previewConverted = visibleInputs
      const convTopPad = 32
      const convStep = (convH - convTopPad - 14) / Math.max(1, previewConverted.length)
      previewConverted.forEach((it, idx) => {
        const yRow = convY + convTopPad + convStep * (idx + 0.5)
        const idxNorm = idx / Math.max(1, previewConverted.length - 1)
        const rowProgress = clamp01(s2 * 2.2 - idxNorm * 0.65)
        const zStr = `${it.scaledValue >= 0 ? '+' : ''}${it.scaledValue.toFixed(2)}`
        const rowH = Math.min(16, Math.max(11, convStep - 3))

        // Mini barra de magnitud
        const barW = (convW - 22) * clamp01(Math.abs(it.scaledValue) / 3) * (s2 > 0 ? easeOutCubic(rowProgress) : 0.25)
        ctx.fillStyle =
          it.scaledValue >= 0
            ? `rgba(45, 212, 191, ${s2 > 0 ? 0.24 : 0.08})`
            : `rgba(96, 165, 250, ${s2 > 0 ? 0.24 : 0.08})`
        drawRoundedRect(convX + 11, yRow - rowH / 2, Math.max(6, barW), rowH, 4)
        ctx.fill()

        ctx.fillStyle =
          rowProgress > 0.1
            ? it.scaledValue >= 0
              ? '#5eead4'
              : '#93c5fd'
            : 'rgba(148, 163, 184, 0.4)'
        ctx.font = `700 ${compactInputCard ? 8.8 : 10.2}px "JetBrains Mono", monospace`
        ctx.textBaseline = 'middle'
        ctx.fillText(rowProgress > 0.05 ? zStr : '····', convX + convW / 2, yRow + 0.5)
      })
      ctx.restore()

      targets.push({
        x: convX + convW / 2,
        y: centerY,
        r: convW * 0.55,
        info: {
          x: convX + convW,
          y: centerY,
          containerWidth: W,
          containerHeight: H,
          kind: 'converter',
          title: 'Conversor Tensorial (Preprocesador)',
          subtitle: 'Estandarización Z-Score + Codificación One-Hot',
          valueText: `${inputItems.length} datos → ${displayLayers[0]?.units ?? visibleInputs.length} entradas numéricas`,
          extraNote: 'Traduce textos, categorías y escalas humanas a vectores normalizados que entiende TensorFlow/Keras',
        },
      })

      // Conductos Conversor -> Capa 0 (Entrada) con chips numéricos volando y encajando
      const l0Nodes = layerNodeCoords[0] || []
      const l0Dense = l0Nodes.length > 10
      l0Nodes.forEach((node, idx) => {
        const srcY = convY + 30 + ((convH - 56) * idx) / Math.max(1, l0Nodes.length - 1)
        const srcX = convX + convW
        const midX = (srcX + node.x) / 2
        const stagger = l0Dense ? idx * (0.28 / Math.max(1, l0Nodes.length)) : idx * 0.045
        const localT = easeInOutCubic(clamp01((s2 - stagger) / 0.72))
        const isActiveInput = Math.abs(node.rawAct) > 0.12

        const isInputNodeHovered =
          activeHover?.kind === 'neuron' &&
          activeHover.layerIdx === 0 &&
          activeHover.neuronIdx === node.idx

        ctx.save()
        ctx.beginPath()
        ctx.moveTo(srcX, srcY)
        ctx.bezierCurveTo(midX, srcY, midX, node.y, node.x, node.y)
        if (isInputNodeHovered) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.strokeStyle = 'rgba(94, 234, 212, 0.92)'
          ctx.lineWidth = 2.4
        } else {
          ctx.strokeStyle =
            s2 > 0
              ? `rgba(45, 212, 191, ${(l0Dense && !isActiveInput ? 0.1 : 0.14) + (l0Dense && !isActiveInput ? 0.28 : 0.52) * localT})`
              : 'rgba(148, 163, 184, 0.10)'
          ctx.lineWidth = s2 > 0 ? (l0Dense ? (isActiveInput ? 1.45 : 0.95) : 1.7) : 0.9
        }
        ctx.stroke()
        ctx.restore()

        const inSteadyConv = s4 > 0.5 && (l0Dense ? isActiveInput || idx % 4 === 0 : idx % 2 === 0)
        const showPhase2Comet = !l0Dense || isActiveInput || idx % 2 === 0
        if (isInputNodeHovered || (s2 > 0.04 && ((s3 < 0.75 && showPhase2Comet) || inSteadyConv))) {
          const tPart = isInputNodeHovered
            ? (tSec * 0.95) % 1
            : s2 < 1
              ? localT
              : (tSec * (inSteadyConv ? 0.4 : 0.58) + idx * 0.14) % 1
          const sample = (t: number) => ({
            x: cubicBezier(t, srcX, midX, midX, node.x),
            y: cubicBezier(t, srcY, srcY, node.y, node.y),
          })
          drawCometTrail(
            sample,
            tPart,
            isInputNodeHovered ? 0.34 : inSteadyConv ? 0.2 : 0.28,
            '#5eead4',
            '45, 212, 191',
            isInputNodeHovered ? 3.8 : inSteadyConv ? (l0Dense ? 2.2 : 2.6) : l0Dense ? 2.9 : 3.7
          )

          // Chip tensor flotando hacia su neurona de entrada
          if (s2 < 0.96 && localT > 0.1 && localT < 0.92 && (l0Dense ? idx % 4 === 0 : idx < 5)) {
            const pt = sample(tPart)
            const zTxt = `${node.rawAct >= 0 ? '+' : ''}${node.rawAct.toFixed(2)}`
            ctx.save()
            ctx.font = '700 9px "JetBrains Mono", monospace'
            const tw = ctx.measureText(zTxt).width + 10
            drawRoundedRect(pt.x - tw / 2, pt.y - 21, tw, 15, 5)
            ctx.fillStyle = 'rgba(4, 32, 42, 0.92)'
            ctx.fill()
            ctx.strokeStyle = 'rgba(45, 212, 191, 0.75)'
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.fillStyle = '#ccfbf1'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(zTxt, pt.x, pt.y - 13.5)
            ctx.restore()
          }
        }

        // Chispazo al encajar en la Capa de Entrada
        if (s2 >= 0.78 && !triggeredMilestones.has(`l0-${idx}`)) {
          triggeredMilestones.add(`l0-${idx}`)
          if (!l0Dense || isActiveInput || idx % 3 === 0) {
            spawnBurst(node.x, node.y, '#5eead4', l0Dense ? 4 : 7, l0Dense ? 0.65 : 0.8)
          }
        }
      })

      // =====================================================
      // FASE 3: RED NEURONAL — SINAPSIS CURVAS + ONDA REAL
      // =====================================================
      const transitionsCount = Math.max(1, layerCount - 1)
      const wavePos = s3 * transitionsCount

      // 3A. Paneles columnares sutiles detrás de cada capa
      layerNodeCoords.forEach((_nodes, lIdx) => {
        const meta = layerMeta[lIdx]
        const lx = meta?.cx ?? netStartX
        const isFirst = lIdx === 0
        const isLast = lIdx === layerCount - 1
        const layerLit = isFirst ? s2 >= 0.72 : s3 > 0 && wavePos >= lIdx - 0.15
        const isCurrentWave = !isFirst && s3 > 0 && s3 < 1 && Math.abs(wavePos - lIdx) < 0.55
        const colW = meta?.colW ?? (isLast ? 64 : 56)
        const theme = isLast
          ? { hex: palette.primary, rgb: palette.rgb }
          : LAYER_THEME[lIdx % LAYER_THEME.length]

        const panelTopY = Math.min(padTop + 4, (meta?.topY ?? padTop + 20) - 20)
        const panelBottomY = Math.max(padTop + usableH - 4, (meta?.bottomY ?? padTop + usableH - 20) + 20)
        ctx.save()
        drawRoundedRect(lx - colW / 2, panelTopY, colW, panelBottomY - panelTopY, 16)
        ctx.fillStyle = isCurrentWave
          ? `rgba(${theme.rgb}, 0.09)`
          : layerLit
            ? `rgba(${theme.rgb}, 0.04)`
            : 'rgba(15, 23, 42, 0.25)'
        ctx.fill()
        ctx.strokeStyle = isCurrentWave
          ? `rgba(${theme.rgb}, 0.45)`
          : layerLit
            ? `rgba(${theme.rgb}, 0.18)`
            : 'rgba(51, 65, 85, 0.28)'
        ctx.lineWidth = isCurrentWave ? 1.4 : 1
        ctx.stroke()
        ctx.restore()
      })

      // 3B. Conexiones Sinápticas Bézier con brillo aditivo + cometas de impulso
      for (let l = 0; l < layerCount - 1; l++) {
        const srcLayer = layerNodeCoords[l]
        const dstLayer = layerNodeCoords[l + 1]
        const segProgress = clamp01(wavePos - l)
        const isLit = segProgress > 0
        const isOutputSeg = l === layerCount - 2
        const dstTheme = isOutputSeg
          ? { hex: palette.primary, rgb: palette.rgb }
          : LAYER_THEME[(l + 1) % LAYER_THEME.length]

        // Disparar sonido y chispas cuando la onda llega a la capa destino
        if (segProgress >= 0.92 && !triggeredMilestones.has(`layer-hit-${l + 1}`)) {
          triggeredMilestones.add(`layer-hit-${l + 1}`)
          const burstStep = dstLayer.length > 16 ? Math.ceil(dstLayer.length / 8) : 1
          dstLayer.forEach((dn, dIdx) => {
            if (dIdx % burstStep === 0) {
              spawnBurst(dn.x, dn.y, dstTheme.hex, isOutputSeg ? 12 : 5, isOutputSeg ? 1.15 : 0.8)
            }
          })
          if (soundRef.current) {
            const notes = [493.88, 554.37, 659.25, 739.99, 880]
            playSynapseTone(
              audioCtxRef,
              notes[Math.min(notes.length - 1, l)],
              0.24,
              0.032
            )
          }
        }

        const totalPairs = srcLayer.length * dstLayer.length
        const isHyperDense = totalPairs > 220
        const inActiveWave = segProgress < 1
        const hoverTouchesSeg =
          activeHover?.kind === 'neuron' &&
          (activeHover.layerIdx === l || activeHover.layerIdx === l + 1)

        if (isHyperDense) {
          // Modo 60 FPS para redes completas (64×64, 128×64, etc.): batch en 2 trazos + rutas hover exactas + cometas activos
          const kOut = Math.max(1, Math.min(3, Math.floor(210 / Math.max(1, srcLayer.length))))
          const strongEdges: Array<{ a: (typeof srcLayer)[number]; b: (typeof dstLayer)[number]; w: number; i: number; j: number }> = []
          const weakEdges: Array<{ a: (typeof srcLayer)[number]; b: (typeof dstLayer)[number] }> = []
          const hoverEdges: Array<{ a: (typeof srcLayer)[number]; b: (typeof dstLayer)[number]; w: number; i: number; j: number }> = []

          // Top destinos más activos para dirigir sinapsis fuertes hacia neuronas encendidas
          const topDstIndices = dstLayer
            .map((dn, j) => ({ j, act: dn.act }))
            .sort((u, v) => v.act - u.act)
            .slice(0, Math.min(12, dstLayer.length))
            .map(item => item.j)

          for (let i = 0; i < srcLayer.length; i++) {
            const a = srcLayer[i]
            const isSrcHovered =
              activeHover?.kind === 'neuron' &&
              activeHover.layerIdx === l &&
              activeHover.neuronIdx === a.idx

            if (isSrcHovered) {
              // Mostrar el 100% de las conexiones salientes reales de la neurona bajo hover
              for (let j = 0; j < dstLayer.length; j++) {
                const b = dstLayer[j]
                hoverEdges.push({ a, b, w: (a.act + b.act) * 0.5, i, j })
              }
              continue
            }

            for (let k = 0; k < kOut; k++) {
              const j =
                k === 0 && topDstIndices.length > 0
                  ? topDstIndices[i % topDstIndices.length]
                  : (Math.floor((i * dstLayer.length) / srcLayer.length) + k * 7) % dstLayer.length
              const b = dstLayer[j]
              const isDstHovered =
                activeHover?.kind === 'neuron' &&
                activeHover.layerIdx === l + 1 &&
                activeHover.neuronIdx === b.idx
              if (isDstHovered) continue
              const w = (a.act + b.act) * 0.5
              if (w > 0.34) {
                strongEdges.push({ a, b, w, i, j })
              } else {
                weakEdges.push({ a, b })
              }
            }
          }

          // Si el usuario hace hover sobre una neurona destino, mostrar el 100% de sus sinapsis entrantes reales
          if (activeHover?.kind === 'neuron' && activeHover.layerIdx === l + 1) {
            const bIdx = dstLayer.findIndex(dn => dn.idx === activeHover.neuronIdx)
            if (bIdx >= 0) {
              const b = dstLayer[bIdx]
              for (let i = 0; i < srcLayer.length; i++) {
                const a = srcLayer[i]
                hoverEdges.push({ a, b, w: (a.act + b.act) * 0.5, i, j: bIdx })
              }
            }
          }

          const dimFactor = activeHover?.kind === 'neuron' ? 0.12 : 1

          // Batch 1: sinapsis base (1 sola llamada stroke)
          if (weakEdges.length > 0) {
            ctx.save()
            ctx.beginPath()
            for (let e = 0; e < weakEdges.length; e++) {
              const { a, b } = weakEdges[e]
              const dx = b.x - a.x
              ctx.moveTo(a.x, a.y)
              ctx.bezierCurveTo(a.x + dx * 0.45, a.y, a.x + dx * 0.55, b.y, b.x, b.y)
            }
            ctx.strokeStyle = isLit
              ? `rgba(${dstTheme.rgb}, ${0.09 * easeOutCubic(segProgress) * dimFactor})`
              : 'rgba(71, 85, 105, 0.06)'
            ctx.lineWidth = 0.55
            ctx.stroke()
            ctx.restore()
          }

          // Batch 2: sinapsis activas (1 sola llamada stroke)
          if (strongEdges.length > 0) {
            ctx.save()
            ctx.beginPath()
            for (let e = 0; e < strongEdges.length; e++) {
              const { a, b } = strongEdges[e]
              const dx = b.x - a.x
              ctx.moveTo(a.x, a.y)
              ctx.bezierCurveTo(a.x + dx * 0.45, a.y, a.x + dx * 0.55, b.y, b.x, b.y)
            }
            ctx.strokeStyle = isLit
              ? `rgba(${dstTheme.rgb}, ${0.26 * easeOutCubic(segProgress) * dimFactor})`
              : 'rgba(71, 85, 105, 0.08)'
            ctx.lineWidth = 0.85
            ctx.stroke()
            ctx.restore()
          }

          // Batch 3: 100% de las sinapsis reales de la neurona bajo hover
          if (hoverEdges.length > 0) {
            ctx.save()
            ctx.globalCompositeOperation = 'lighter'
            ctx.beginPath()
            for (let e = 0; e < hoverEdges.length; e++) {
              const { a, b } = hoverEdges[e]
              const dx = b.x - a.x
              ctx.moveTo(a.x, a.y)
              ctx.bezierCurveTo(a.x + dx * 0.45, a.y, a.x + dx * 0.55, b.y, b.x, b.y)
            }
            ctx.strokeStyle = `rgba(${dstTheme.rgb}, 0.84)`
            ctx.lineWidth = 1.65
            ctx.stroke()
            ctx.restore()
          }

          // Cometas de plasma: en hover viajan por TODAS las conexiones de la neurona (de arriba a abajo); sin hover, por las rutas más fuertes
          if (hoverTouchesSeg && hoverEdges.length > 0) {
            const hoverCometStep = hoverEdges.length > 64 ? Math.ceil(hoverEdges.length / 64) : 1
            for (let c = 0; c < hoverEdges.length; c += hoverCometStep) {
              const edge = hoverEdges[c]
              const dx = edge.b.x - edge.a.x
              const c1x = edge.a.x + dx * 0.45
              const c2x = edge.a.x + dx * 0.55
              const tP = (tSec * 0.92 + (c * 0.13) % 1) % 1
              const sample = (t: number) => ({
                x: cubicBezier(t, edge.a.x, c1x, c2x, edge.b.x),
                y: cubicBezier(t, edge.a.y, edge.a.y, edge.b.y, edge.b.y),
              })
              drawCometTrail(
                sample,
                tP,
                0.26,
                dstTheme.hex,
                dstTheme.rgb,
                3.1
              )
            }
          } else if (isLit && (inActiveWave || s4 > 0) && strongEdges.length > 0) {
            const cometStep = Math.max(1, Math.ceil(strongEdges.length / 12))
            for (let c = 0; c < strongEdges.length; c += cometStep) {
              const edge = strongEdges[c]
              const dx = edge.b.x - edge.a.x
              const c1x = edge.a.x + dx * 0.45
              const c2x = edge.a.x + dx * 0.55
              const tP = inActiveWave
                ? easeInOutCubic(segProgress)
                : (tSec * 0.44 + edge.i * 0.19 + edge.j * 0.27 + l * 0.17) % 1
              const sample = (t: number) => ({
                x: cubicBezier(t, edge.a.x, c1x, c2x, edge.b.x),
                y: cubicBezier(t, edge.a.y, edge.a.y, edge.b.y, edge.b.y),
              })
              drawCometTrail(
                sample,
                tP,
                inActiveWave ? 0.2 : 0.16,
                dstTheme.hex,
                dstTheme.rgb,
                inActiveWave ? 2.4 : 2.0
              )
            }
          }
        } else {
          for (let i = 0; i < srcLayer.length; i++) {
            const a = srcLayer[i]
            for (let j = 0; j < dstLayer.length; j++) {
              const b = dstLayer[j]
              const weightStrength = (a.act + b.act) * 0.5
              const dx = b.x - a.x
              const c1x = a.x + dx * 0.45
              const c2x = a.x + dx * 0.55

              // Trazado interactivo cuando el usuario hace hover sobre una neurona
              const connectedToHover =
                activeHover?.kind === 'neuron' &&
                ((activeHover.layerIdx === l && activeHover.neuronIdx === a.idx) ||
                  (activeHover.layerIdx === l + 1 && activeHover.neuronIdx === b.idx))
              const dimByHover = activeHover?.kind === 'neuron' && !connectedToHover

              ctx.save()
              ctx.beginPath()
              ctx.moveTo(a.x, a.y)
              ctx.bezierCurveTo(c1x, a.y, c2x, b.y, b.x, b.y)

              const denseSrc = srcLayer.length > 10
              if (connectedToHover) {
                ctx.globalCompositeOperation = 'lighter'
                ctx.strokeStyle = `rgba(${dstTheme.rgb}, 0.88)`
                ctx.lineWidth = 2.2
              } else if (isLit) {
                const rawBaseAlpha = (0.11 + weightStrength * 0.42) * easeOutCubic(segProgress)
                const baseAlpha = denseSrc ? rawBaseAlpha * 0.58 : rawBaseAlpha
                ctx.strokeStyle = `rgba(${dstTheme.rgb}, ${dimByHover ? baseAlpha * 0.16 : baseAlpha})`
                ctx.lineWidth = denseSrc ? 0.55 + weightStrength * 0.9 : 0.8 + weightStrength * 1.4
              } else {
                ctx.strokeStyle = denseSrc ? 'rgba(71, 85, 105, 0.08)' : 'rgba(71, 85, 105, 0.14)'
                ctx.lineWidth = denseSrc ? 0.5 : 0.7
              }
              ctx.stroke()
              ctx.restore()

              // Impulsos tipo cometa viajando por las conexiones más fuertes (y rutas continuas garantizadas entre todas las capas, incluida Entrada → Capa 1)
              const steadyGuaranteed = denseSrc
                ? (Math.abs(a.rawAct) > 0.15 && j === i % dstLayer.length) ||
                (i % 4 === 0 && j === Math.floor(i / 4) % dstLayer.length)
                : (i === j && i % 2 === 0) ||
                (dstLayer.length <= 2 && i % 2 === 0) ||
                ((i + j) % 4 === 0 && weightStrength > 0.35)
              const shouldFirePulse =
                connectedToHover ||
                (isLit &&
                  !dimByHover &&
                  (inActiveWave
                    ? denseSrc
                      ? (Math.abs(a.rawAct) > 0.15 && j === i % dstLayer.length) ||
                      (i % 3 === 0 && j === (i + 1) % dstLayer.length)
                      : weightStrength > 0.42 || (i + j) % 2 === 0 || dstLayer.length <= 2
                    : steadyGuaranteed))

              if (shouldFirePulse && (inActiveWave || s4 > 0 || connectedToHover)) {
                const tP =
                  inActiveWave && !connectedToHover
                    ? easeInOutCubic(segProgress)
                    : (tSec * (connectedToHover ? 0.95 : 0.42) + i * 0.23 + j * 0.31 + l * 0.17) % 1
                const sample = (t: number) => ({
                  x: cubicBezier(t, a.x, c1x, c2x, b.x),
                  y: cubicBezier(t, a.y, a.y, b.y, b.y),
                })
                drawCometTrail(
                  sample,
                  tP,
                  connectedToHover ? 0.32 : inActiveWave ? 0.22 : 0.17,
                  dstTheme.hex,
                  dstTheme.rgb,
                  connectedToHover ? 3.8 : inActiveWave ? 2.1 + weightStrength * 1.5 : 1.9 + weightStrength * 1.1
                )
              }
            }
          }
        }
      }

      // =====================================================
      // CHISPAS DE ENERGÍA (detrás de las neuronas para nunca tapar números)
      // =====================================================
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i]
        sp.life += dt
        if (sp.life >= sp.maxLife) {
          sparks.splice(i, 1)
          continue
        }
        sp.x += sp.vx * (dt / 16)
        sp.y += sp.vy * (dt / 16)
        sp.vx *= 0.965
        sp.vy *= 0.965
        const a = 1 - sp.life / sp.maxLife
        ctx.globalAlpha = a * 0.85
        ctx.fillStyle = sp.color
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, sp.radius * (0.4 + 0.6 * a), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // 3C. Dibujar Neuronas Holográficas + Encabezados (sticky en columnas largas) + Telemetría Real
      layerNodeCoords.forEach((nodes, lIdx) => {
        const layer = displayLayers[lIdx]
        const meta = layerMeta[lIdx]
        const isFirst = lIdx === 0
        const isLast = lIdx === layerCount - 1
        const layerLit = isFirst ? s2 >= 0.72 : s3 > 0 && wavePos >= lIdx - 0.18
        const layerIntensity = isFirst
          ? easeOutCubic(clamp01((s2 - 0.55) / 0.45))
          : easeOutCubic(clamp01(wavePos - (lIdx - 0.32)))
        const lx = meta?.cx ?? nodes[0]?.x ?? netStartX
        const theme = isLast
          ? { hex: palette.primary, bright: palette.bright, rgb: palette.rgb, formula: `ŷ = ${layer.activation}` }
          : LAYER_THEME[lIdx % LAYER_THEME.length]

        // Cada neurona con efecto cristal 3D + arco de activación (siempre a tamaño legible con su número visible)
        const denseLayer = nodes.length > 8
        const stepYLayer = meta && meta.rowsPerCol > 1 ? meta.stepY : 48
        const maxRByY = meta && meta.rowsPerCol > 1 ? meta.stepY * 0.41 : 14
        const maxRByX = meta && meta.subCols > 1 ? meta.colGap * 0.42 : 14
        const adaptiveBaseR = isLast
          ? 18.5
          : denseLayer
            ? Math.max(7.6, Math.min(11.2, maxRByY, maxRByX))
            : 14
        const microOrb = adaptiveBaseR < 8.6

        nodes.forEach(node => {
          const isHovered =
            activeHover?.kind === 'neuron' &&
            activeHover.layerIdx === lIdx &&
            activeHover.neuronIdx === node.idx
          const r =
            adaptiveBaseR +
            (layerLit ? node.act * (microOrb ? 0.55 : denseLayer ? 0.95 : 3.2) * layerIntensity : 0) +
            (isHovered ? (microOrb ? 1.8 : denseLayer ? 2.2 : 3.5) : 0)

          ctx.save()
          if (layerLit) {
            // Onda expansiva sutil al encenderse la neurona (solo en capas compactas o neuronas activas)
            if (layerIntensity > 0.15 && layerIntensity < 0.95 && (!microOrb || node.act > 0.35)) {
              ctx.beginPath()
              ctx.arc(node.x, node.y, r + layerIntensity * (denseLayer ? 7 : 16), 0, Math.PI * 2)
              ctx.strokeStyle = `rgba(${theme.rgb}, ${(1 - layerIntensity) * 0.5})`
              ctx.lineWidth = denseLayer ? 1.0 : 1.6
              ctx.stroke()
            }

            // Resplandor radial aditivo exterior (optimizado a 60 FPS en capas de 64–128 neuronas)
            if (!microOrb || node.act > 0.25 || isHovered) {
              ctx.globalCompositeOperation = 'lighter'
              const glowScale = isHovered ? 2.5 : microOrb ? 1.65 : denseLayer ? 1.75 : 2.15
              const glowGrad = ctx.createRadialGradient(
                node.x,
                node.y,
                r * 0.45,
                node.x,
                node.y,
                r * glowScale
              )
              glowGrad.addColorStop(0, `rgba(${theme.rgb}, ${isHovered ? 0.58 : denseLayer ? 0.28 : 0.36})`)
              glowGrad.addColorStop(1, 'rgba(0,0,0,0)')
              ctx.fillStyle = glowGrad
              ctx.beginPath()
              ctx.arc(node.x, node.y, r * glowScale, 0, Math.PI * 2)
              ctx.fill()
              ctx.globalCompositeOperation = 'source-over'
            }
          }

          // Cuerpo oscuro de alto contraste con borde luminoso interno (garantiza lectura nítida del número)
          ctx.beginPath()
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
          if (microOrb && !isHovered) {
            ctx.fillStyle = layerLit ? (node.act > 0.25 ? '#07152e' : '#040b1c') : '#0b1426'
          } else {
            const sphereGrad = ctx.createRadialGradient(
              node.x,
              node.y,
              r * 0.12,
              node.x,
              node.y,
              r
            )
            if (layerLit) {
              sphereGrad.addColorStop(0, '#040b1c')
              sphereGrad.addColorStop(0.62, '#081630')
              sphereGrad.addColorStop(1, `rgba(${theme.rgb}, 0.42)`)
            } else {
              sphereGrad.addColorStop(0, '#0b1426')
              sphereGrad.addColorStop(1, '#16233d')
            }
            ctx.fillStyle = sphereGrad
          }
          ctx.fill()

          ctx.lineWidth = isHovered ? 2.2 : layerLit ? (microOrb ? 1.15 : denseLayer ? 1.35 : 1.8) : 0.95
          ctx.strokeStyle = isHovered
            ? '#ffffff'
            : layerLit
              ? node.act > 0.18 || !microOrb
                ? theme.hex
                : `rgba(${theme.rgb}, 0.48)`
              : '#334155'
          ctx.stroke()

          // Arco radial exterior proporcional a la activación real de esta neurona
          if (layerLit && layerIntensity > 0.3 && (!microOrb || node.act > 0.18 || isHovered)) {
            ctx.beginPath()
            ctx.arc(
              node.x,
              node.y,
              r + (microOrb ? 1.25 : denseLayer ? 1.7 : 3.6),
              -Math.PI / 2,
              -Math.PI / 2 + Math.PI * 2 * node.act * layerIntensity
            )
            ctx.strokeStyle = theme.bright
            ctx.lineWidth = microOrb ? 1.05 : denseLayer ? 1.25 : 1.9
            ctx.lineCap = 'round'
            ctx.stroke()
          }

          // Valor numérico real nítido y de alto contraste dentro de la neurona (siempre visible en vista normal y zoom)
          if (layerLit && layerIntensity > 0.38 && r * cam.zoom >= 4.2) {
            const cleanNum = Math.abs(node.rawAct) < 0.05 ? '0.0' : node.rawAct.toFixed(1)
            ctx.fillStyle = '#f8fafc'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const fontPx = isLast ? 11 : denseLayer ? Math.max(6.8, Math.min(8.5, r * 0.78)) : 9.5
            ctx.font = `700 ${fontPx}px "JetBrains Mono", monospace`
            ctx.fillText(cleanNum, node.x, node.y + 0.35)
          }
          ctx.restore()

          const rawFeatName = layer.neuron_names?.[node.idx]
          const prettyFeatName = rawFeatName
            ? rawFeatName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            : null

          targets.push({
            x: node.x,
            y: node.y,
            r: denseLayer ? Math.max(5.5, Math.min(r + 2.5, stepYLayer * 0.47, (meta?.subCols ?? 1) > 1 ? (meta?.colGap ?? 20) * 0.47 : 99)) : r + 7,
            info: {
              x: node.x,
              y: node.y,
              containerWidth: W,
              containerHeight: H,
              kind: 'neuron',
              layerIdx: lIdx,
              neuronIdx: node.idx,
              title: prettyFeatName
                ? `Entrada #${node.idx + 1} · ${prettyFeatName}`
                : `${layer.name} · Neurona #${node.idx + 1}`,
              subtitle: `Activación: ${layer.activation} · ${layer.units} neuronas en capa`,
              valueText: isFirst
                ? `Tensor Z-Score / One-Hot: ${node.rawAct >= 0 ? '+' : ''}${node.rawAct.toFixed(4)}`
                : `Salida real: ${node.rawAct.toFixed(4)}`,
              extraNote: `Capa activa al ${Math.round((layer.active_ratio ?? 0) * 100)}% · Media μ = ${layer.mean_activation.toFixed(3)}`,
            },
          })
        })

        // Encabezado superior (se mantiene legible arriba aunque la columna larga se extienda fuera del encuadre)
        ctx.save()
        const naturalHeaderY = Math.min(padTop - 22, (meta?.topY ?? padTop) - 34)
        const topVisibleWorldY = (padTop - 22 - cam.panY) / cam.zoom
        const headerY = Math.max(naturalHeaderY, Math.min((meta?.bottomY ?? H) - 18, topVisibleWorldY))
        const isHeaderSticky = headerY > naturalHeaderY + 4

        if (isHeaderSticky) {
          const hdrW = Math.max(92, (meta?.colW ?? 64) + 16)
          drawRoundedRect(lx - hdrW / 2, headerY - 12, hdrW, 30, 8)
          ctx.fillStyle = 'rgba(2, 6, 18, 0.90)'
          ctx.fill()
          ctx.strokeStyle = `rgba(${theme.rgb}, 0.36)`
          ctx.lineWidth = 1
          ctx.stroke()
        }

        ctx.textAlign = 'center'
        ctx.fillStyle = layerLit ? theme.bright : '#64748b'
        ctx.font = '800 10px "Plus Jakarta Sans", system-ui, sans-serif'
        const shortType =
          layer.type === 'BatchNormalization'
            ? 'BATCH NORM'
            : layer.type === 'MaxPooling1D'
              ? 'POOL 1D'
              : layer.type.toUpperCase()
        const shortLayerName = isFirst
          ? 'ENTRADA'
          : isLast
            ? 'SALIDA'
            : `CAPA ${lIdx} · ${shortType}`
        ctx.fillText(shortLayerName, lx, headerY)

        ctx.fillStyle = layerLit ? theme.hex : '#475569'
        ctx.font = '600 9px "JetBrains Mono", monospace'
        ctx.fillText(`${layer.units}u · ${layer.activation}`, lx, headerY + 14)

        // Pie inferior con telemetría real (anclado al fondo visible si la columna se extiende más abajo)
        const naturalPillY = Math.max(H - padBottom + 10, (meta?.bottomY ?? H - padBottom) + 26)
        const bottomVisibleWorldY = (H - padBottom + 10 - cam.panY) / cam.zoom
        const pillY = Math.min(naturalPillY, Math.max((meta?.topY ?? padTop) + 28, bottomVisibleWorldY))

        if (layer.units > nodes.length) {
          ctx.fillStyle = layerLit ? theme.hex : '#475569'
          ctx.font = '700 8.5px "JetBrains Mono", monospace'
          ctx.fillText(`+${layer.units - nodes.length} más`, lx, pillY - 8)
        }

        if (layerLit) {
          const activePct = Math.round((layer.active_ratio ?? 0) * 100)
          const pillW = 84
          drawRoundedRect(lx - pillW / 2, pillY, pillW, 28, 8)
          ctx.fillStyle = 'rgba(7, 18, 38, 0.92)'
          ctx.fill()
          ctx.strokeStyle = `rgba(${theme.rgb}, 0.42)`
          ctx.lineWidth = 1
          ctx.stroke()

          ctx.fillStyle = theme.bright
          ctx.font = '700 9px "JetBrains Mono", monospace'
          ctx.fillText(`${activePct}% act · μ ${layer.mean_activation.toFixed(2)}`, lx, pillY + 11)

          // Mini barra de carga de activación
          const barMax = pillW - 14
          ctx.fillStyle = 'rgba(51, 65, 85, 0.65)'
          drawRoundedRect(lx - barMax / 2, pillY + 18, barMax, 3.5, 2)
          ctx.fill()
          ctx.fillStyle = theme.hex
          drawRoundedRect(
            lx - barMax / 2,
            pillY + 18,
            Math.max(4, barMax * clamp01(layer.active_ratio ?? 0.5) * layerIntensity),
            3.5,
            2
          )
          ctx.fill()
        }
        ctx.restore()
      })

      // =====================================================
      // FASE 4: CONVERGENCIA FINAL -> NÚCLEO DE VEREDICTO
      // =====================================================
      const outLayerNodes = layerNodeCoords[layerCount - 1] || []
      const outLit = s4 > 0
      const outEase = easeOutQuart(s4)
      const outNodeY = Math.min(centerY, padTop + 106)

      ctx.save()
      ctx.textAlign = 'center'
      ctx.fillStyle = outLit ? palette.bright : '#64748b'
      ctx.font = '800 9.5px "JetBrains Mono", monospace'
      ctx.fillText('04 · VEREDICTO IA', outNodeX, padTop - 22)
      ctx.fillStyle = outLit ? palette.primary : '#475569'
      ctx.font = '600 9px "Plus Jakarta Sans", system-ui, sans-serif'
      ctx.fillText(
        outLit && result ? `${result.latency_ms} ms reales` : 'Esperando salida',
        outNodeX,
        padTop - 8
      )
      ctx.restore()

      // Haces curvos desde la capa de salida al Núcleo Final
      outLayerNodes.forEach((node, idx) => {
        const startX = node.x + 18
        const endX = outNodeX - 48
        const midX = (startX + endX) / 2
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(startX, node.y)
        ctx.bezierCurveTo(midX, node.y, midX, outNodeY, endX, outNodeY)
        ctx.strokeStyle = outLit
          ? `rgba(${palette.rgb}, ${0.35 + 0.65 * outEase})`
          : 'rgba(71, 85, 105, 0.25)'
        ctx.lineWidth = outLit ? 2.8 : 1.1
        if (outLit) {
          ctx.shadowColor = palette.primary
          ctx.shadowBlur = 16
        }
        ctx.stroke()
        ctx.restore()

        if (outLit) {
          const sample = (t: number) => ({
            x: cubicBezier(t, startX, midX, midX, endX),
            y: cubicBezier(t, node.y, node.y, outNodeY, outNodeY),
          })
          const tFlow = s4 < 0.75 ? easeInOutCubic(s4 / 0.75) : (tSec * 0.85 + idx * 0.3) % 1
          drawCometTrail(sample, tFlow, 0.35, palette.primary, palette.rgb, 4.2)
        }
      })

      // Explosión armónica al completar Fase 4
      if (s4 >= 0.45 && !triggeredMilestones.has('verdict-boom')) {
        triggeredMilestones.add('verdict-boom')
        spawnBurst(outNodeX, outNodeY, palette.primary, 32, 1.55, 48)
        spawnBurst(outNodeX, outNodeY, '#ffffff', 14, 1.1, 48)
        if (soundRef.current) {
          // Acorde cristalino final según veredicto
          const chord =
            verdict?.tone === 'danger'
              ? [523.25, 622.25, 783.99]
              : [523.25, 659.25, 783.99, 1046.5]
          chord.forEach((f, idx) => {
            window.setTimeout(() => {
              if (soundRef.current) playSynapseTone(audioCtxRef, f, 0.42, 0.032)
            }, idx * 55)
          })
        }
      }

      // Núcleo Orbital de Veredicto
      ctx.save()
      const finalR = 44 + (outLit ? outEase * 6 + pulse * 1.8 : 0)

      if (outLit) {
        // Doble onda expansiva
        for (let w = 0; w < 2; w++) {
          const waveP = clamp01(s4 * 1.4 - w * 0.25)
          if (waveP > 0 && waveP < 1) {
            ctx.beginPath()
            ctx.arc(outNodeX, outNodeY, finalR + waveP * 48, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(${palette.rgb}, ${(1 - waveP) * 0.6})`
            ctx.lineWidth = 2.2 * (1 - waveP * 0.5)
            ctx.stroke()
          }
        }

        // Bloom aditivo exterior
        ctx.globalCompositeOperation = 'lighter'
        const bloom = ctx.createRadialGradient(
          outNodeX,
          outNodeY,
          10,
          outNodeX,
          outNodeY,
          finalR * 2.5
        )
        bloom.addColorStop(0, palette.glow)
        bloom.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = bloom
        ctx.beginPath()
        ctx.arc(outNodeX, outNodeY, finalR * 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'

        // Anillos giroscópicos giratorios
        ctx.save()
        ctx.translate(outNodeX, outNodeY)
        ctx.rotate(tSec * 0.9)
        ctx.strokeStyle = `rgba(${palette.rgb}, 0.55)`
        ctx.lineWidth = 1.5
        ctx.setLineDash([12, 8])
        ctx.beginPath()
        ctx.arc(0, 0, finalR + 12, 0, Math.PI * 2)
        ctx.stroke()

        ctx.rotate(-tSec * 1.65)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
        ctx.lineWidth = 1.1
        ctx.setLineDash([4, 10])
        ctx.beginPath()
        ctx.arc(0, 0, finalR + 19, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      }

      // Esfera interior del núcleo (centro oscuro para máximo contraste del porcentaje)
      const coreBg = ctx.createRadialGradient(
        outNodeX,
        outNodeY,
        6,
        outNodeX,
        outNodeY,
        finalR
      )
      if (outLit) {
        coreBg.addColorStop(0, '#040a1a')
        coreBg.addColorStop(0.68, '#091632')
        coreBg.addColorStop(1, `rgba(${palette.rgb}, 0.42)`)
      } else {
        coreBg.addColorStop(0, '#0b1426')
        coreBg.addColorStop(1, '#132242')
      }
      ctx.beginPath()
      ctx.arc(outNodeX, outNodeY, finalR, 0, Math.PI * 2)
      ctx.fillStyle = coreBg
      ctx.fill()
      ctx.lineWidth = outLit ? 2.4 : 1.4
      ctx.strokeStyle = outLit ? palette.primary : '#334155'
      ctx.stroke()

      // Arco de progreso de confianza animado (0% -> confianza real)
      if (outLit && verdict) {
        const confRatio =
          verdict.confidencePct !== null ? clamp01(verdict.confidencePct / 100) : 0.92
        ctx.beginPath()
        ctx.arc(
          outNodeX,
          outNodeY,
          finalR + 4.5,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * confRatio * outEase
        )
        ctx.strokeStyle = palette.primary
        ctx.lineWidth = 3.2
        ctx.lineCap = 'round'
        ctx.shadowColor = palette.primary
        ctx.shadowBlur = 12
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Texto dentro del núcleo de veredicto (contador animado)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (outLit && verdict) {
        ctx.fillStyle = '#ffffff'
        ctx.font = '800 18px "JetBrains Mono", monospace'
        const mainChip =
          verdict.confidencePct !== null
            ? `${Math.round(verdict.confidencePct * outEase)}%`
            : verdict.formattedValue
              ? verdict.formattedValue.split(' ')[0]
              : 'OK'
        ctx.fillText(mainChip, outNodeX, outNodeY - 6)
        ctx.fillStyle = palette.bright
        ctx.font = '800 8.5px "Plus Jakarta Sans", system-ui, sans-serif'
        ctx.fillText(verdict.badgeText.toUpperCase(), outNodeX, outNodeY + 14)
      } else {
        ctx.fillStyle = '#64748b'
        ctx.font = '700 10.5px "JetBrains Mono", monospace'
        ctx.fillText('SALIDA', outNodeX, outNodeY)
      }
      ctx.restore()

      if (verdict && result) {
        targets.push({
          x: outNodeX,
          y: outNodeY,
          r: finalR + 10,
          info: {
            x: outNodeX,
            y: outNodeY,
            containerWidth: W,
            containerHeight: H,
            kind: 'output',
            title: verdict.headline,
            subtitle: `${verdict.badgeText} · Latencia ${result.latency_ms} ms`,
            valueText:
              verdict.confidencePct !== null
                ? `Confianza estimada: ${verdict.confidencePct}%`
                : verdict.formattedValue || String(result.prediction),
            extraNote: verdict.recommendation,
          },
        })
      }

      ctx.restore() // Fin de transformación de cámara (zoom + pan)

      hoverTargetsRef.current = targets
      ctx.restore()

      animId = window.requestAnimationFrame(render)
    }

    animId = window.requestAnimationFrame(render)
    return () => window.cancelAnimationFrame(animId)
  }, [displayLayers, inputItems.length, open, result, verdict, visibleInputs])

  const seekTimelineFromClientX = useCallback((clientX: number) => {
    const bar = timelineRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const next = clamp01((clientX - rect.left) / Math.max(1, rect.width))
    progressRef.current = next
    setProgressUi(next)
  }, [])

  if (!open) return null

  const activeStageIdx =
    progressUi < 0.22 ? 0 : progressUi < 0.44 ? 1 : progressUi < 0.85 ? 2 : 3
  const finished = progressUi >= 0.992 && Boolean(result) && Boolean(verdict)

  const liveNarrative = (() => {
    if (activeStageIdx === 0) {
      return `Capturando tus ${inputItems.length} variables reales y canalizándolas hacia el preprocesador...`
    }
    if (activeStageIdx === 1) {
      return 'Transformando tus datos (Z-Score y One-Hot) en tensores numéricos para inyectarlos en la Capa de Entrada...'
    }
    if (activeStageIdx === 2) {
      const seg = Math.min(
        displayLayers.length - 1,
        Math.floor(((progressUi - 0.44) / 0.41) * displayLayers.length)
      )
      const currL = displayLayers[seg]
      return `Onda sináptica recorriendo ${currL?.name || 'las capas ocultas'} (${currL?.units ?? 0} neuronas · ${currL?.activation ?? 'relu'})...`
    }
    if (verdict && result) {
      return `Inferencia completada en ${result.latency_ms} ms → ${verdict.headline}${verdict.confidencePct !== null ? ` (${verdict.confidencePct}%)` : ''}`
    }
    return 'Convergiendo activaciones hacia la capa de salida...'
  })()

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (panDragRef.current.active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const cam = cameraRef.current
    const wx = (mx - cam.panX) / cam.zoom
    const wy = (my - cam.panY) / cam.zoom

    const found = hoverTargetsRef.current.find(t => {
      if (t.box) {
        return wx >= t.box.x && wx <= t.box.x + t.box.w && wy >= t.box.y && wy <= t.box.y + t.box.h
      }
      return Math.hypot(t.x - wx, t.y - wy) <= t.r
    })
    const nextInfo = found
      ? {
        ...found.info,
        x: found.info.x * cam.zoom + cam.panX,
        y: found.info.y * cam.zoom + cam.panY,
      }
      : null
    hoverNodeRef.current = nextInfo
    setHoverNode(nextInfo)
  }

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return
    panDragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origPanX: cameraRef.current.panX,
      origPanY: cameraRef.current.panY,
    }
    setIsPanningCanvas(true)
    hoverNodeRef.current = null
    setHoverNode(null)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleCanvasPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!panDragRef.current.active) return
    const dx = e.clientX - panDragRef.current.startX
    const dy = e.clientY - panDragRef.current.startY
    cameraRef.current = {
      ...cameraRef.current,
      panX: panDragRef.current.origPanX + dx,
      panY: panDragRef.current.origPanY + dy,
    }
  }

  function handleCanvasPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!panDragRef.current.active) return
    panDragRef.current.active = false
    setIsPanningCanvas(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function handleZoomStep(direction: 1 | -1) {
    const cont = containerRef.current
    const cx = cont ? cont.clientWidth / 2 : 600
    const cy = cont ? cont.clientHeight / 2 : 300
    const prev = cameraRef.current
    const factor = direction > 0 ? 1.2 : 1 / 1.2
    const nextZoom = Math.max(0.22, Math.min(5.0, Number((prev.zoom * factor).toFixed(4))))
    const wx = (cx - prev.panX) / prev.zoom
    const wy = (cy - prev.panY) / prev.zoom
    cameraRef.current = {
      zoom: nextZoom,
      panX: cx - wx * nextZoom,
      panY: cy - wy * nextZoom,
    }
    setZoomPct(Math.round(nextZoom * 100))
  }

  function handleResetCamera() {
    cameraRef.current = { zoom: 1, panX: 0, panY: 0 }
    setZoomPct(100)
  }

  function handleToggleAllNeurons() {
    showAllNeuronsRef.current = !showAllNeuronsRef.current
    setShowAllNeurons(showAllNeuronsRef.current)
    hoverNodeRef.current = null
    setHoverNode(null)
  }

  function handleToggleCompactMatrix() {
    compactMatrixRef.current = !compactMatrixRef.current
    setCompactMatrix(compactMatrixRef.current)
    hoverNodeRef.current = null
    setHoverNode(null)
  }

  function handleReplay() {
    progressRef.current = 0
    pausedRef.current = false
    setPaused(false)
    setProgressUi(0)
  }

  function handleTogglePause() {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  function handleToggleSpeed() {
    const idx = SPEED_CYCLE.indexOf(speed)
    const next = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length]
    speedRef.current = next
    setSpeed(next)
  }

  function handleToggleSound() {
    setSoundEnabled(prev => {
      const next = !prev
      try {
        localStorage.setItem('nl_predict_anim_sound', next ? '1' : '0')
      } catch {
        // ignore storage restrictions
      }
      if (next) {
        playSynapseTone(audioCtxRef, 587.33, 0.18, 0.035)
      }
      return next
    })
  }

  function jumpToStage(startProgress: number) {
    progressRef.current = startProgress
    setProgressUi(startProgress)
  }

  function handleCardPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return
    const card = verdictCardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    cardDragOffsetRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    }
    isDraggingCardRef.current = true
    setCardPos({ x: rect.left, y: rect.top })
    setIsDraggingCard(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleCardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingCardRef.current) return
    const card = verdictCardRef.current
    const w = card?.offsetWidth ?? 356
    const h = card?.offsetHeight ?? 80
    const margin = 12
    const nextX = Math.max(margin, Math.min(window.innerWidth - w - margin, e.clientX - cardDragOffsetRef.current.dx))
    const nextY = Math.max(margin, Math.min(window.innerHeight - h - margin, e.clientY - cardDragOffsetRef.current.dy))
    setCardPos({ x: Math.round(nextX), y: Math.round(nextY) })
  }

  function handleCardPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingCardRef.current) return
    isDraggingCardRef.current = false
    setIsDraggingCard(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function handleToggleCardMinimized() {
    setCardMinimized(prev => {
      const next = !prev
      if (cardPos) {
        // Re-encuadrar dentro de la ventana al cambiar de tamaño
        window.requestAnimationFrame(() => {
          const card = verdictCardRef.current
          if (!card) return
          const margin = 12
          const maxX = Math.max(margin, window.innerWidth - card.offsetWidth - margin)
          const maxY = Math.max(margin, window.innerHeight - card.offsetHeight - margin)
          setCardPos(curr =>
            curr
              ? {
                x: Math.max(margin, Math.min(maxX, curr.x)),
                y: Math.max(margin, Math.min(maxY, curr.y)),
              }
              : null
          )
        })
      }
      return next
    })
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Animación de recorrido neuronal en vivo"
      className="nl-neural-theater fixed inset-0 z-[200] flex flex-col bg-[#020612]/98 backdrop-blur-2xl text-slate-100 animate-backdrop-fade select-none"
    >
      {/* Cabecera superior en pantalla completa */}
      <div className="nl-neural-theater-bar px-4 py-2 border-b border-cyan-500/20 bg-slate-950/85 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500/25 via-cyan-500/25 to-indigo-500/30 border border-cyan-400/50 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(34,211,238,0.28)]">
            <Sparkles className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white truncate">
                Recorrido Neuronal en Vivo
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/35 text-[10px] font-mono font-bold text-cyan-300 whitespace-nowrap">
                {goalTitle}
              </span>
              <InfoTip
                title="Laboratorio interactivo en tiempo real"
                text="Observa paso a paso cómo tus datos se convierten en tensores Z-Score/One-Hot y viajan por cada capa real del modelo .keras. Pasa el cursor sobre cualquier neurona para iluminar sus rutas sinápticas, usa la rueda para acercarte o pulsa «Ver todas» para desplegar el 100% de las neuronas."
                hint="Rueda: Zoom · Arrastrar: Mover · C: Compactar · T: Todas/Resumir · Esc: Omitir"
                size="xs"
              />
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {areaName} · {modelName} · {displayLayers.length} capas · {totalModelNeurons} neuronas reales
              {result ? ` · ${result.latency_ms} ms` : ''}
            </p>
          </div>
        </div>

        {/* Controles de cámara (Zoom) + Reproducción + Sonido + Velocidad + Omitir */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <div className="inline-flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 gap-0.5">
            <SystemTooltip
              title="Alejar zoom (−)"
              label="Reduce el acercamiento del lienzo. También puedes usar la rueda del ratón en cualquier punto."
              side="bottom"
            >
              <button
                type="button"
                onClick={() => handleZoomStep(-1)}
                aria-label="Alejar zoom"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </SystemTooltip>
            <SystemTooltip
              title="Restablecer vista (100%)"
              label="Centra el lienzo y restablece el zoom al 100%. También puedes hacer doble clic en el fondo o pulsar 0."
              hint="Rueda: Zoom · Arrastrar fondo: Mover"
              side="bottom"
            >
              <button
                type="button"
                onClick={handleResetCamera}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${zoomPct === 100
                  ? 'text-cyan-300'
                  : 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
              >
                {zoomPct}%
              </button>
            </SystemTooltip>
            <SystemTooltip
              title="Acercar zoom (+)"
              label="Acerca la red neuronal hasta 500% para inspeccionar tus variables y neuronas de cerca."
              side="bottom"
            >
              <button
                type="button"
                onClick={() => handleZoomStep(1)}
                aria-label="Acercar zoom"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </SystemTooltip>
          </div>

          {hasExpandableHiddenLayers && (
            <SystemTooltip
              title={
                showAllNeurons
                  ? `Mostrando todas las neuronas (${totalModelNeurons})`
                  : `Ver todas las neuronas (${totalModelNeurons})`
              }
              label={
                showAllNeurons
                  ? 'Vuelve a la vista resumida (8 neuronas representativas por capa oculta) para una lectura rápida.'
                  : `Despliega el 100% de las ${totalModelNeurons} neuronas reales de todas las capas del modelo .keras. Usa la rueda del ratón para acercarte y leer cada activación.`
              }
              hint="Atajo: tecla T · Zoom hasta 600%"
              side="bottom"
            >
              <button
                type="button"
                onClick={handleToggleAllNeurons}
                aria-pressed={showAllNeurons}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${showAllNeurons
                  ? 'bg-violet-500/20 border-violet-400/55 text-violet-200 shadow-[0_0_14px_rgba(167,139,250,0.28)]'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
              >
                <Layers className={`w-3.5 h-3.5 ${showAllNeurons ? 'text-violet-300' : 'text-cyan-400'}`} />
                <span>{showAllNeurons ? `Todas (${totalModelNeurons})` : `Ver todas (${totalModelNeurons})`}</span>
              </button>
            </SystemTooltip>
          )}

          {hasCompactableLayers && (
            <SystemTooltip
              title={compactMatrix ? 'Vista en matriz compacta activa' : 'Organizar en matriz compacta'}
              label={
                compactMatrix
                  ? 'Vuelve a la disposición clásica de 1 sola columna vertical por capa.'
                  : 'Agrupa las capas grandes (>24 neuronas) en varias sub-columnas para verlas más grandes sin necesidad de hacer zoom.'
              }
              hint="Atajo: tecla C"
              side="bottom"
            >
              <button
                type="button"
                onClick={handleToggleCompactMatrix}
                aria-pressed={compactMatrix}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${compactMatrix
                  ? 'bg-cyan-500/20 border-cyan-400/55 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
              >
                <LayoutGrid className={`w-3.5 h-3.5 ${compactMatrix ? 'text-cyan-300' : 'text-slate-400'}`} />
                <span>{compactMatrix ? 'Compacto' : 'Compactar'}</span>
              </button>
            </SystemTooltip>
          )}

          <SystemTooltip
            title="Efectos sinápticos"
            label={soundEnabled ? 'Silencia los tonos armónicos al activarse cada capa.' : 'Activa tonos cristalinos suaves conforme viaja la señal por la red.'}
            side="bottom"
          >
            <button
              type="button"
              onClick={handleToggleSound}
              aria-label={soundEnabled ? 'Silenciar efectos sinápticos' : 'Activar efectos de sonido'}
              className={`px-2 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition-colors ${soundEnabled
                ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-300" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </SystemTooltip>

          <SystemTooltip
            title="Velocidad de reproducción"
            label="Alterna entre 0.6× (cámara lenta para observar cada neurona), 1× (cinemático) y 1.6× (rápido)."
            side="bottom"
          >
            <button
              type="button"
              onClick={handleToggleSpeed}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono font-bold inline-flex items-center gap-1 transition-colors"
            >
              <FastForward className="w-3.5 h-3.5 text-cyan-400" />
              <span>{speed}×</span>
            </button>
          </SystemTooltip>

          <SystemTooltip
            title={paused ? 'Reanudar flujo' : 'Pausar flujo'}
            label="Congela o reanuda la onda sináptica para inspeccionar cualquier neurona con calma."
            hint="Atajo: barra Espaciadora"
            side="bottom"
          >
            <button
              type="button"
              onClick={handleTogglePause}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
            >
              {paused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-300" />}
              <span className="hidden sm:inline">{paused ? 'Reanudar' : 'Pausar'}</span>
            </button>
          </SystemTooltip>

          <SystemTooltip
            title="Repetir recorrido"
            label="Reinicia la animación desde la Fase 1 (Captura de Datos) hasta el veredicto."
            side="bottom"
          >
            <button
              type="button"
              onClick={handleReplay}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Repetir</span>
            </button>
          </SystemTooltip>

          <SystemTooltip
            title="Desactivar animación automática"
            label="No volverá a abrir esta vista automáticamente al pulsar «Obtener Predicción». Podrás reactivarla cuando quieras con el botón Animación."
            side="bottom"
          >
            <button
              type="button"
              onClick={onDisableAutoAnimation}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden md:inline">No mostrar más</span>
            </button>
          </SystemTooltip>

          <SystemTooltip
            title={finished ? 'Cerrar vista' : 'Omitir animación'}
            label="Regresa directamente al panel de resultados completo sin esperar al final."
            hint="Atajo: tecla Esc"
            side="bottom"
          >
            <button
              type="button"
              onClick={onSkip}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5 text-cyan-300" />
              <span>{finished ? 'Cerrar' : 'Omitir'}</span>
              <span className="text-[10px] font-mono text-cyan-200/80 hidden sm:inline">Esc</span>
            </button>
          </SystemTooltip>
        </div>
      </div>

      {/* Escenario Canvas a pantalla completa */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          onDoubleClick={handleResetCamera}
          onMouseLeave={() => {
            hoverNodeRef.current = null
            setHoverNode(null)
          }}
          className={`w-full h-full block touch-none ${isPanningCanvas ? 'cursor-grabbing' : 'cursor-grab'
            }`}
        />

        {/* Tooltip interactivo al pasar el cursor sobre cualquier dato, conversor o neurona */}
        {hoverNode && (
          <div
            className="pointer-events-none absolute z-20 px-3.5 py-2.5 rounded-xl bg-[#051026]/95 border border-cyan-400/55 shadow-[0_18px_48px_rgba(0,0,0,0.85)] max-w-[270px] backdrop-blur-md"
            style={{
              left: Math.min(
                hoverNode.containerWidth - 280,
                Math.max(14, hoverNode.x + 18)
              ),
              top: Math.min(
                hoverNode.containerHeight - 115,
                Math.max(14, hoverNode.y - 58)
              ),
            }}
          >
            <p className="text-[11.5px] font-extrabold text-white leading-snug">{hoverNode.title}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{hoverNode.subtitle}</p>
            <p className="text-[11px] font-mono font-bold text-cyan-300 mt-1">
              {hoverNode.valueText}
            </p>
            {hoverNode.extraNote && (
              <p className="text-[10px] text-slate-300/90 mt-1 pt-1 border-t border-slate-800 leading-snug">
                {hoverNode.extraNote}
              </p>
            )}
          </div>
        )}

        {/* Tarjeta flotante de Veredicto Final (arrastrable por toda la pantalla y minimizable) */}
        {finished && verdict && result && (
          <div
            ref={verdictCardRef}
            data-verdict-card="true"
            onPointerDown={handleCardPointerDown}
            onPointerMove={handleCardPointerMove}
            onPointerUp={handleCardPointerUp}
            onPointerCancel={handleCardPointerUp}
            style={
              cardPos
                ? { left: `${cardPos.x}px`, top: `${cardPos.y}px` }
                : { right: '20px', bottom: '84px' }
            }
            className={`fixed z-[210] rounded-2xl bg-[#051128]/95 border border-cyan-400/50 shadow-[0_24px_72px_rgba(0,0,0,0.9)] backdrop-blur-xl touch-none ${isDraggingCard
              ? 'cursor-grabbing ring-2 ring-cyan-400/60 shadow-[0_30px_84px_rgba(34,211,238,0.28)]'
              : 'cursor-grab animate-pop-in'
              } ${cardMinimized ? 'w-auto max-w-[calc(100vw-24px)] p-2.5' : 'w-[356px] max-w-[calc(100vw-24px)] p-4 space-y-3'}`}
          >
            {/* Cabecera arrastrable de la tarjeta */}
            <div
              onDoubleClick={e => {
                if ((e.target as HTMLElement).closest('button')) return
                handleToggleCardMinimized()
              }}
              className="flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 shrink-0 ${verdict.tone === 'danger'
                    ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                    : verdict.tone === 'warn'
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                      : verdict.tone === 'safe'
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                    }`}
                >
                  {verdict.tone === 'danger' ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : verdict.tone === 'safe' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Activity className="w-3.5 h-3.5" />
                  )}
                  <span>{verdict.badgeText}</span>
                </span>

                {cardMinimized && (
                  <span className="text-xs font-extrabold text-white truncate pl-1">
                    {verdict.headline}
                    {verdict.confidencePct !== null && (
                      <span className="ml-1.5 text-cyan-300 font-mono">
                        ({verdict.confidencePct}%)
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!cardMinimized && (
                  <span className="text-[10px] font-mono text-cyan-300/90 mr-1">
                    {result.latency_ms} ms
                  </span>
                )}
                <SystemTooltip
                  title={cardMinimized ? 'Expandir tarjeta' : 'Minimizar tarjeta'}
                  label={
                    cardMinimized
                      ? 'Muestra el veredicto completo, recomendación e impulsores.'
                      : 'Compacta la tarjeta para ver toda la red neuronal sin obstáculos.'
                  }
                  side="top"
                >
                  <button
                    type="button"
                    onClick={handleToggleCardMinimized}
                    aria-label={cardMinimized ? 'Expandir tarjeta de veredicto' : 'Minimizar tarjeta de veredicto'}
                    className="p-1 rounded-lg text-slate-400 hover:text-cyan-200 hover:bg-slate-800 transition-colors"
                  >
                    {cardMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  </button>
                </SystemTooltip>
                <SystemTooltip
                  title="Cerrar recorrido neuronal"
                  label="Sale de la pantalla completa y vuelve al panel principal de resultados."
                  side="top"
                >
                  <button
                    type="button"
                    onClick={onSkip}
                    aria-label="Cerrar animación"
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </SystemTooltip>
              </div>
            </div>

            {!cardMinimized && (
              <>
                <div>
                  <h3 className="text-lg font-extrabold text-white leading-tight">
                    {verdict.headline}
                    {verdict.confidencePct !== null && (
                      <span className="ml-2 text-cyan-300 font-mono text-base">
                        ({verdict.confidencePct}%)
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {verdict.recommendation}
                  </p>
                </div>

                {topMiniDrivers.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/90 space-y-1.5">
                    <p className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Principales impulsores del veredicto
                    </p>
                    {topMiniDrivers.map(d => (
                      <div key={d.key} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-300 truncate">
                          {d.label}: <strong className="text-white font-mono">{d.val}</strong>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300 shrink-0">
                          {d.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleReplay}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Repetir</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSkip}
                    className="flex-1 py-2 rounded-xl nl-accent-bg nl-accent-glow text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <span>Ver resultado completo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pie inferior interactivo con línea de tiempo arrastrable + 4 fases clicables */}
      <div className="nl-neural-theater-bar px-5 py-2.5 border-t border-cyan-500/20 bg-slate-950/92 space-y-2 shrink-0">
        {/* Línea de tiempo scrubbable */}
        <div
          ref={timelineRef}
          onPointerDown={e => {
            draggingTimelineRef.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            seekTimelineFromClientX(e.clientX)
          }}
          onPointerMove={e => {
            if (!draggingTimelineRef.current) return
            seekTimelineFromClientX(e.clientX)
          }}
          onPointerUp={e => {
            draggingTimelineRef.current = false
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          className="relative h-3.5 flex items-center cursor-pointer group"
          title="Haz clic o arrastra para recorrer cualquier instante del flujo neuronal"
        >
          <div className="w-full h-1.5 rounded-full bg-slate-800/90 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-violet-400 transition-[width] duration-75"
              style={{ width: `${Math.round(progressUi * 100)}%` }}
            />
          </div>
          {/* Marcadores de las 4 etapas */}
          {STAGE_BOUNDS.slice(1).map(st => (
            <span
              key={st.id}
              style={{ left: `${st.start * 100}%` }}
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-slate-500/70"
            />
          ))}
          {/* Cabezal brillante */}
          <span
            style={{ left: `${progressUi * 100}%` }}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)] group-hover:scale-125 transition-transform"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <p className="text-xs text-slate-200 font-medium truncate">{liveNarrative}</p>
          </div>

          {/* Botones compactos de etapa + porcentaje */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden md:flex items-center gap-1">
              {STAGE_BOUNDS.map(st => {
                const isCurr = activeStageIdx === st.id
                const isDone = activeStageIdx > st.id || finished
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => jumpToStage(st.start + 0.015)}
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold border transition-all ${isCurr
                      ? 'bg-cyan-500/20 border-cyan-400/55 text-cyan-200'
                      : isDone
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    {st.id + 1}. {st.short}
                  </button>
                )
              })}
            </div>
            <span className="text-xs font-mono font-extrabold text-cyan-300 w-10 text-right">
              {Math.round(progressUi * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
