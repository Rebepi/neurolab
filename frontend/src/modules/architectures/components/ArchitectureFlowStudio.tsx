import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Layers,
  LayoutGrid,
  Lock,
  Maximize2,
  Move,
  Pause,
  Play,
  Plus,
  Rows3,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type {
  ArchitectureHealth,
  LayerParamBreakdown,
  RecommendedArchitecture,
} from '../utils'
import type { LayerSpec } from '../../../types'

interface ArchitectureFlowStudioProps {
  inputShape: number
  outputDim: number
  outputActivation: string
  targetColumn: string
  scalerApplied: string
  layersList: LayerSpec[]
  selectedIdx: number | null
  onSelectLayer: (idx: number) => void
  onRemoveLayer: (idx: number) => void
  onMoveLayer: (idx: number, dir: -1 | 1) => void
  onDuplicateLayer: (idx: number) => void
  onInsertLayerAt: (idx: number, type: 'Dense' | 'Dropout' | 'BatchNormalization') => void
  recommended: RecommendedArchitecture
  isOptimalApplied: boolean
  health: ArchitectureHealth
  breakdown: LayerParamBreakdown[]
  totalParams: number
  onOpenInsights: (tab: 'reasons' | 'profile') => void
}

type LayoutMode = 'serpentine' | 'horizontal' | 'vertical'
type ConduitDirection = 'ltr' | 'rtl' | 'ttb'
type SocketSide = 'left' | 'right' | 'top' | 'bottom'

type FlowItem =
  | { kind: 'input'; globalIdx: number }
  | { kind: 'layer'; globalIdx: number; layer: LayerSpec; layerIdx: number }
  | { kind: 'output'; globalIdx: number }

interface NodeTooltipInfo {
  title: string
  roleBadge: string
  accentGradient: string
  badgeClass: string
  summary: string
  detail: string
  aiReason?: string
  metrics: Array<{ label: string; value: string }>
  footerHint: string
}

const INPUT_SPECTRUM_BARS = [46, 82, 62, 95, 54, 88, 68]

function getActivationExplanation(activation?: LayerSpec['activation']): string {
  if (activation === 'tanh') {
    return 'Activación Tanh: proyecta al rango [-1, 1] centrando las señales alrededor de cero para relaciones simétricas.'
  }
  if (activation === 'sigmoid') {
    return 'Activación Sigmoide: comprime valores entre [0, 1], útil para compuertas suaves o salidas probabilísticas.'
  }
  if (activation === 'linear') {
    return 'Activación Lineal: transmite el valor sin transformación no lineal para combinaciones directas.'
  }
  return 'Activación ReLU (max(0, z)): anula valores negativos para acelerar el gradiente y modelar relaciones no lineales.'
}

function buildNodeTooltipInfo(params: {
  item: FlowItem
  inputShape: number
  outputDim: number
  outputActivation: string
  targetColumn: string
  scalerApplied: string
  breakdown: LayerParamBreakdown[]
  totalParams: number
  recommended: RecommendedArchitecture
  isOptimalApplied: boolean
}): NodeTooltipInfo {
  const {
    item,
    inputShape,
    outputDim,
    outputActivation,
    targetColumn,
    scalerApplied,
    breakdown,
    totalParams,
    recommended,
    isOptimalApplied,
  } = params

  if (item.kind === 'input') {
    const aiReason = isOptimalApplied
      ? recommended.layerReasons.find(r => r.role === 'input')?.reason
      : undefined
    return {
      title: 'Capa de Entrada (Input)',
      roleBadge: 'Tensor Base',
      accentGradient: 'from-cyan-400 via-sky-400 to-blue-500',
      badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/35',
      summary: `Recibe exactamente ${inputShape} variables ya codificadas y escaladas con ${scalerApplied}.`,
      detail:
        'No posee parámetros entrenables; adapta y reparte el vector de entrada hacia la primera capa oculta de la red.',
      aiReason,
      metrics: [
        { label: 'Dimensión', value: `(${inputShape},)` },
        { label: 'Escalado', value: scalerApplied },
        { label: 'Parámetros', value: '0' },
      ],
      footerHint: 'Tensor fijo vinculado al dataset seleccionado',
    }
  }

  if (item.kind === 'output') {
    const aiReason = isOptimalApplied
      ? recommended.layerReasons.find(r => r.role === 'output')?.reason
      : undefined
    const headSummary =
      outputActivation === 'sigmoid'
        ? `Clasificación binaria: emite probabilidad p ∈ [0, 1] para estimar '${targetColumn}'.`
        : outputActivation === 'softmax'
          ? `Clasificación multiclase: distribuye probabilidades entre ${outputDim} categorías de '${targetColumn}' (suma = 1).`
          : `Regresión numérica: predice de forma continua el valor de '${targetColumn}'.`

    return {
      title: `Capa de Salida · ${outputActivation.toUpperCase()}`,
      roleBadge: 'Predicción Final',
      accentGradient: 'from-emerald-400 via-teal-400 to-cyan-400',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35',
      summary: headSummary,
      detail: `Cabezal configurado automáticamente según el tipo de problema de la variable objetivo '${targetColumn}'.`,
      aiReason,
      metrics: [
        { label: 'Dimensión', value: `(${outputDim},)` },
        { label: 'Activación', value: outputActivation },
        { label: 'Objetivo', value: targetColumn },
      ],
      footerHint: 'Cabezal bloqueado para garantizar compatibilidad Keras',
    }
  }

  const { layer, layerIdx } = item
  const b = breakdown[layerIdx]
  const inShape = b ? b.inShape : inputShape
  const outShape = b ? b.outShape : inputShape
  const weights = b ? b.weights : 0
  const biases = b ? b.biases : 0
  const layerTotal = b ? b.total : 0
  const sharePct = totalParams > 0 ? ((layerTotal / totalParams) * 100).toFixed(1) : '0.0'
  const aiReason = isOptimalApplied
    ? recommended.layerReasons.find(r => r.layerIndex === layerIdx)?.reason
    : undefined

  if (layer.type === 'Dropout') {
    const pct = Math.round((layer.rate ?? 0.2) * 100)
    return {
      title: `Capa #${layerIdx + 1} · Dropout (${pct}%)`,
      roleBadge: 'Regularización',
      accentGradient: 'from-amber-400 via-orange-400 to-rose-400',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-400/35',
      summary: `Desactiva aleatoriamente el ${pct}% de las neuronas (${100 - pct}% activas) en cada lote de entrenamiento para prevenir sobreajuste.`,
      detail:
        'Se desactiva automáticamente durante la evaluación e inferencia usando todas las conexiones; no añade pesos entrenables.',
      aiReason,
      metrics: [
        { label: 'Desconexión', value: `${pct}%` },
        { label: 'Tensor', value: `${inShape} → ${outShape}` },
        { label: 'Parámetros', value: '0' },
      ],
      footerHint: 'Haz clic en la tarjeta para calibrar la tasa Dropout',
    }
  }

  if (layer.type === 'BatchNormalization') {
    return {
      title: `Capa #${layerIdx + 1} · Batch Normalization`,
      roleBadge: 'Estabilización μ·σ',
      accentGradient: 'from-emerald-400 via-teal-400 to-cyan-400',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35',
      summary:
        'Centra y normaliza las activaciones por mini-lote (μ ≈ 0, σ² ≈ 1) usando x̂ = (x − μ) / √(σ² + ε) con escala γ y sesgo β ajustables.',
      detail:
        'Mitiga cambios internos de distribución entre capas, estabiliza gradientes y acelera el entrenamiento.',
      aiReason,
      metrics: [
        { label: 'Tensor', value: `${inShape} → ${outShape}` },
        { label: 'γ,β / μ,σ²', value: `${weights} / ${biases}` },
        { label: 'Peso modelo', value: `${sharePct}%` },
      ],
      footerHint: 'Haz clic para ver el desglose completo de parámetros',
    }
  }

  const units = layer.units ?? 32
  const opFormula = layer.use_bias === false ? 'W·x (sin bias)' : 'W·x + b'
  return {
    title: `Capa #${layerIdx + 1} · Dense (${units} neuronas)`,
    roleBadge: 'Transformación Lineal',
    accentGradient: 'from-cyan-400 via-sky-400 to-indigo-500',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/35',
    summary: `Proyecta ${inShape} entradas hacia ${units} neuronas totalmente conectadas calculando y = φ(${opFormula}).`,
    detail: getActivationExplanation(layer.activation),
    aiReason,
    metrics: [
      { label: 'Tensor', value: `${inShape} → ${outShape}` },
      { label: 'Pesos / Bias', value: `${weights.toLocaleString('es-ES')} / ${biases}` },
      { label: 'Peso modelo', value: `${sharePct}%` },
    ],
    footerHint: 'Haz clic en la tarjeta para ajustar neuronas y activación',
  }
}

function NodeHoverPopover({
  anchorRect,
  info,
}: {
  anchorRect: DOMRect
  info: NodeTooltipInfo
}) {
  const popRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState({
    left: 0,
    top: 0,
    placedBelow: false,
    arrowLeft: 156,
    ready: false,
  })

  useLayoutEffect(() => {
    const el = popRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = document.documentElement.clientWidth || window.innerWidth
    const vh = document.documentElement.clientHeight || window.innerHeight
    const margin = 12
    const gap = 12

    const anchorCenterX = anchorRect.left + anchorRect.width / 2
    const left = Math.max(
      margin,
      Math.min(vw - margin - rect.width, anchorCenterX - rect.width / 2)
    )

    const fitsAbove = anchorRect.top - gap - rect.height >= margin
    const fitsBelow = anchorRect.bottom + gap + rect.height <= vh - margin
    const placedBelow = !fitsAbove && (fitsBelow || vh - anchorRect.bottom > anchorRect.top)
    const rawTop = placedBelow ? anchorRect.bottom + gap : anchorRect.top - gap - rect.height
    const top = Math.max(margin, Math.min(vh - margin - rect.height, rawTop))
    const arrowLeft = Math.max(20, Math.min(rect.width - 20, anchorCenterX - left))

    setLayout({
      left: Math.round(left),
      top: Math.round(top),
      placedBelow,
      arrowLeft: Math.round(arrowLeft),
      ready: true,
    })
  }, [anchorRect, info])

  return createPortal(
    <div
      ref={popRef}
      role="tooltip"
      style={{
        left: `${layout.left}px`,
        top: `${layout.top}px`,
        visibility: layout.ready ? 'visible' : 'hidden',
      }}
      className="fixed z-[10050] pointer-events-none w-[316px] max-w-[calc(100vw-24px)]"
    >
      <div className="nl-tooltip-solid animate-pop-in relative rounded-2xl p-3.5">
        <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
          <div className={`h-[2px] w-full bg-gradient-to-r ${info.accentGradient}`} />
        </div>

        <span
          style={{ left: `${layout.arrowLeft - 5}px` }}
          className={`nl-tooltip-solid-arrow absolute w-2.5 h-2.5 rotate-45 border-cyan-400/45 ${
            layout.placedBelow
              ? 'is-top -top-[5px] border-l border-t'
              : '-bottom-[5px] border-r border-b'
          }`}
        />

        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-xs font-extrabold text-white leading-snug">{info.title}</h4>
            <span
              className={`px-2 py-0.5 rounded-md border text-[9.5px] font-semibold whitespace-nowrap shrink-0 ${info.badgeClass}`}
            >
              {info.roleBadge}
            </span>
          </div>

          <p className="text-[11px] text-slate-200 leading-relaxed">{info.summary}</p>
          <p className="text-[10.5px] text-slate-400 leading-relaxed">{info.detail}</p>

          {info.aiReason && (
            <div className="p-2 rounded-xl bg-violet-500/12 border border-violet-400/30 space-y-0.5">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1">
                <Brain className="w-3 h-3 text-cyan-300" />
                <span>Criterio IA aplicado</span>
              </p>
              <p className="text-[10.5px] text-slate-200 leading-snug">{info.aiReason}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            {info.metrics.map(metric => (
              <div
                key={metric.label}
                className="px-2 py-1.5 rounded-lg bg-[#071123] border border-cyan-500/25 min-w-0"
              >
                <p className="text-[9px] uppercase tracking-wider text-slate-400 truncate">
                  {metric.label}
                </p>
                <p className="text-[10.5px] font-mono font-semibold text-cyan-300 truncate mt-0.5">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[9.5px] font-mono text-slate-400 border-t border-white/10 pt-1.5">
            {info.footerHint}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

function getLayerTheme(type: LayerSpec['type']) {
  if (type === 'Dense') {
    return {
      border: 'border-cyan-400/40',
      aura: 'from-cyan-500/18 via-sky-500/6 to-transparent',
      hairline: 'from-cyan-400 via-sky-400 to-indigo-500',
      pill: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/35',
      bar: 'from-cyan-400 via-sky-400 to-indigo-500',
      port: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]',
      title: 'Dense',
    }
  }
  if (type === 'Dropout') {
    return {
      border: 'border-amber-400/40',
      aura: 'from-amber-500/18 via-orange-500/6 to-transparent',
      hairline: 'from-amber-400 via-orange-400 to-rose-400',
      pill: 'bg-amber-500/15 text-amber-300 border-amber-400/35',
      bar: 'from-amber-400 to-orange-500',
      port: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
      title: 'Dropout',
    }
  }
  if (type === 'BatchNormalization') {
    return {
      border: 'border-emerald-400/40',
      aura: 'from-emerald-500/18 via-teal-500/6 to-transparent',
      hairline: 'from-emerald-400 via-teal-400 to-cyan-400',
      pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35',
      bar: 'from-emerald-400 to-teal-500',
      port: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
      title: 'BatchNorm',
    }
  }
  return {
    border: 'border-violet-400/40',
    aura: 'from-violet-500/18 via-fuchsia-500/6 to-transparent',
    hairline: 'from-violet-400 to-fuchsia-500',
    pill: 'bg-violet-500/15 text-violet-300 border-violet-400/35',
    bar: 'from-violet-400 to-fuchsia-500',
    port: 'bg-violet-400 shadow-[0_0_8px_#a78bfa]',
    title: type,
  }
}

function ActivationMiniCurve({
  activation,
  layerId,
}: {
  activation?: LayerSpec['activation']
  layerId: string
}) {
  const gradId = `nlCurveGrad-${layerId}`
  const strokePath = (() => {
    if (activation === 'sigmoid') return 'M 3 22 C 15 22, 21 4, 43 4'
    if (activation === 'tanh') return 'M 3 22 C 16 22, 18 4, 43 4'
    if (activation === 'linear') return 'M 3 22 L 43 4'
    return 'M 3 21 L 20 21 L 43 4'
  })()
  const fillPath = `${strokePath} L 43 24 L 3 24 Z`
  const midDot =
    activation === 'sigmoid' || activation === 'tanh' || activation === 'linear'
      ? { cx: 23, cy: 13 }
      : { cx: 20, cy: 21 }

  return (
    <svg viewBox="0 0 46 26" className="w-11 h-6 shrink-0 overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1="2" y1="21" x2="44" y2="21" stroke="rgba(148,163,184,0.22)" strokeWidth="0.9" />
      <line
        x1="20"
        y1="3"
        x2="20"
        y2="23"
        stroke="rgba(148,163,184,0.18)"
        strokeWidth="0.8"
        strokeDasharray="2 2"
      />
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={strokePath} fill="none" stroke="#38bdf8" strokeWidth="1.9" strokeLinecap="round" />
      <circle
        cx={midDot.cx}
        cy={midDot.cy}
        r="2.2"
        fill="#22d3ee"
        stroke="#ffffff"
        strokeWidth="0.8"
      />
    </svg>
  )
}

function BatchNormBellCurve({ layerId }: { layerId: string }) {
  const gradId = `nlBellGrad-${layerId}`
  return (
    <svg viewBox="0 0 116 26" className="w-full h-6.5 overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1="4" y1="22" x2="112" y2="22" stroke="rgba(148,163,184,0.22)" strokeWidth="0.9" />
      <line
        x1="58"
        y1="3"
        x2="58"
        y2="22"
        stroke="rgba(52,211,153,0.45)"
        strokeWidth="1"
        strokeDasharray="2.5 2"
      />
      <path d="M 6 22 C 24 22, 34 4, 58 4 C 82 4, 92 22, 110 22 Z" fill={`url(#${gradId})`} />
      <path
        d="M 6 22 C 24 22, 34 4, 58 4 C 82 4, 92 22, 110 22"
        fill="none"
        stroke="#34d399"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="58" cy="4" r="2.2" fill="#34d399" stroke="#ffffff" strokeWidth="0.8" />
    </svg>
  )
}

function FlowConduit({
  insertIndex,
  phaseIndex,
  direction,
  animated,
  fromDropout,
  toOutput,
  openUpwards,
  isMenuOpen,
  onToggleMenu,
  onInsert,
}: {
  insertIndex: number
  phaseIndex: number
  direction: ConduitDirection
  animated: boolean
  fromDropout?: boolean
  toOutput?: boolean
  openUpwards?: boolean
  isMenuOpen: boolean
  onToggleMenu: () => void
  onInsert: (type: 'Dense' | 'Dropout' | 'BatchNormalization') => void
}) {
  const isVertical = direction === 'ttb'
  const isRtl = direction === 'rtl'
  const primaryColor = toOutput ? '#34d399' : fromDropout ? '#f59e0b' : '#22d3ee'
  const secondaryColor = toOutput ? '#2dd4bf' : fromDropout ? '#fb923c' : '#818cf8'
  const packetBgClass = toOutput
    ? 'bg-emerald-300 shadow-[0_0_10px_#34d399,0_0_4px_#ffffff]'
    : fromDropout
      ? 'bg-amber-300 shadow-[0_0_10px_#fbbf24,0_0_4px_#ffffff]'
      : 'bg-cyan-300 shadow-[0_0_10px_#22d3ee,0_0_4px_#ffffff]'
  const delayStyle = { animationDelay: `${(phaseIndex * 240) % 1200}ms` }
  const flowClassH = isRtl ? 'nl-synapse-flow-rev' : 'nl-synapse-flow'

  return (
    <div
      data-interactive="true"
      className={`relative flex items-center justify-center shrink-0 ${
        isVertical ? 'w-[64px] h-[44px] flex-col' : 'w-[54px] h-[64px] flex-row'
      }`}
    >
      {isVertical ? (
        <svg viewBox="0 0 64 44" className="w-full h-full overflow-visible pointer-events-none">
          <path
            d="M 18 0 C 18 14, 30 30, 30 44"
            fill="none"
            stroke={secondaryColor}
            strokeOpacity="0.28"
            strokeWidth="1.2"
          />
          <path
            d="M 46 0 C 46 14, 34 30, 34 44"
            fill="none"
            stroke={secondaryColor}
            strokeOpacity="0.28"
            strokeWidth="1.2"
          />
          <path
            d="M 32 0 L 32 44"
            fill="none"
            stroke={primaryColor}
            strokeOpacity="0.34"
            strokeWidth="2.2"
          />
          {animated && (
            <>
              <path
                d="M 18 0 C 18 14, 30 30, 30 44"
                fill="none"
                stroke={secondaryColor}
                strokeOpacity="0.72"
                strokeWidth="1.3"
                className="nl-synapse-flow"
                style={{ animationDelay: `${phaseIndex * 160}ms` }}
              />
              <path
                d="M 46 0 C 46 14, 34 30, 34 44"
                fill="none"
                stroke={secondaryColor}
                strokeOpacity="0.72"
                strokeWidth="1.3"
                className="nl-synapse-flow"
                style={{ animationDelay: `${phaseIndex * 160 + 280}ms` }}
              />
              <path
                d="M 32 0 L 32 44"
                fill="none"
                stroke={primaryColor}
                strokeOpacity="0.9"
                strokeWidth="1.8"
                className="nl-synapse-flow"
                style={{ animationDelay: `${phaseIndex * 160 + 120}ms` }}
              />
            </>
          )}
        </svg>
      ) : (
        <svg viewBox="0 0 54 64" className="w-full h-full overflow-visible pointer-events-none">
          <path
            d="M 0 18 C 18 18, 36 30, 54 30"
            fill="none"
            stroke={secondaryColor}
            strokeOpacity="0.28"
            strokeWidth="1.2"
          />
          <path
            d="M 0 46 C 18 46, 36 34, 54 34"
            fill="none"
            stroke={secondaryColor}
            strokeOpacity="0.28"
            strokeWidth="1.2"
          />
          <path
            d="M 0 32 L 54 32"
            fill="none"
            stroke={primaryColor}
            strokeOpacity="0.34"
            strokeWidth="2.2"
          />
          {animated && (
            <>
              <path
                d="M 0 18 C 18 18, 36 30, 54 30"
                fill="none"
                stroke={secondaryColor}
                strokeOpacity="0.72"
                strokeWidth="1.3"
                className={flowClassH}
                style={{ animationDelay: `${phaseIndex * 160}ms` }}
              />
              <path
                d="M 0 46 C 18 46, 36 34, 54 34"
                fill="none"
                stroke={secondaryColor}
                strokeOpacity="0.72"
                strokeWidth="1.3"
                className={flowClassH}
                style={{ animationDelay: `${phaseIndex * 160 + 280}ms` }}
              />
              <path
                d="M 0 32 L 54 32"
                fill="none"
                stroke={primaryColor}
                strokeOpacity="0.9"
                strokeWidth="1.8"
                className={flowClassH}
                style={{ animationDelay: `${phaseIndex * 160 + 120}ms` }}
              />
            </>
          )}
        </svg>
      )}

      {animated && (
        <div
          className={`pointer-events-none absolute ${
            isVertical
              ? 'top-[2px] left-1/2 -translate-x-1/2'
              : 'left-[2px] top-1/2 -translate-y-1/2'
          }`}
        >
          <span
            style={delayStyle}
            className={`block w-2 h-2 rounded-full ${packetBgClass} ${
              isVertical ? 'nl-packet-v' : isRtl ? 'nl-packet-h-rev' : 'nl-packet-h'
            }`}
          />
        </div>
      )}

      <span
        className={`pointer-events-none absolute opacity-75 ${
          toOutput ? 'text-emerald-300' : fromDropout ? 'text-amber-300' : 'text-cyan-300'
        } ${
          isVertical
            ? 'bottom-0.5 left-1/2 -translate-x-1/2'
            : isRtl
              ? 'left-0.5 top-1/2 -translate-y-1/2'
              : 'right-0.5 top-1/2 -translate-y-1/2'
        }`}
      >
        {isVertical ? (
          <ChevronDown className="w-3 h-3" />
        ) : isRtl ? (
          <ChevronLeft className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </span>

      <button
        type="button"
        onClick={event => {
          event.stopPropagation()
          onToggleMenu()
        }}
        title={`Insertar capa en posición #${insertIndex + 1}`}
        className={`absolute z-10 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
          isMenuOpen
            ? 'bg-cyan-400 text-slate-950 border-cyan-300 scale-110 shadow-[0_0_12px_rgba(34,211,238,0.65)]'
            : 'bg-[#071123]/95 text-cyan-300 border-cyan-400/45 hover:bg-cyan-500/25 hover:border-cyan-300 hover:scale-110'
        }`}
      >
        <Plus className="w-3 h-3" />
      </button>

      {isMenuOpen && (
        <div
          data-interactive="true"
          onClick={event => event.stopPropagation()}
          className={`absolute z-30 rounded-xl border border-cyan-500/35 bg-[#081226]/95 p-1.5 shadow-xl backdrop-blur-md flex flex-col gap-1 min-w-[146px] ${
            isVertical
              ? 'left-14 top-1/2 -translate-y-1/2'
              : openUpwards
                ? 'bottom-12 left-1/2 -translate-x-1/2'
                : 'top-12 left-1/2 -translate-x-1/2'
          }`}
        >
          <button
            type="button"
            onClick={() => onInsert('Dense')}
            className="text-left px-2.5 py-1.5 rounded-lg text-[11px] text-cyan-200 hover:bg-cyan-500/15 transition-colors"
          >
            + Capa Densa
          </button>
          <button
            type="button"
            onClick={() => onInsert('Dropout')}
            className="text-left px-2.5 py-1.5 rounded-lg text-[11px] text-amber-200 hover:bg-amber-500/15 transition-colors"
          >
            + Capa Dropout
          </button>
          <button
            type="button"
            onClick={() => onInsert('BatchNormalization')}
            className="text-left px-2.5 py-1.5 rounded-lg text-[11px] text-emerald-200 hover:bg-emerald-500/15 transition-colors"
          >
            + Batch Norm
          </button>
        </div>
      )}
    </div>
  )
}

function NodeSockets({
  inSide,
  outSide,
  colorClass,
}: {
  inSide?: SocketSide
  outSide?: SocketSide
  colorClass: string
}) {
  const renderPin = (side: SocketSide) => {
    const posClass =
      side === 'left'
        ? '-left-[4.5px] top-1/2 -translate-y-1/2'
        : side === 'right'
          ? '-right-[4.5px] top-1/2 -translate-y-1/2'
          : side === 'top'
            ? '-top-[4.5px] left-1/2 -translate-x-1/2'
            : '-bottom-[4.5px] left-1/2 -translate-x-1/2'

    return (
      <span
        key={side}
        className={`pointer-events-none absolute w-2.5 h-2.5 rounded-full border border-slate-950 ${posClass} ${colorClass}`}
      />
    )
  }

  return (
    <>
      {inSide && renderPin(inSide)}
      {outSide && outSide !== inSide && renderPin(outSide)}
    </>
  )
}

export function ArchitectureFlowStudio({
  inputShape,
  outputDim,
  outputActivation,
  targetColumn,
  scalerApplied,
  layersList,
  selectedIdx,
  onSelectLayer,
  onRemoveLayer,
  onMoveLayer,
  onDuplicateLayer,
  onInsertLayerAt,
  recommended,
  isOptimalApplied,
  health,
  breakdown,
  totalParams,
  onOpenInsights,
}: ArchitectureFlowStudioProps) {
  const [compactMode, setCompactMode] = useState(false)
  const [flowAnimated, setFlowAnimated] = useState(true)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('serpentine')
  const [manualZoom, setManualZoom] = useState<number | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [openConduitIdx, setOpenConduitIdx] = useState<number | null>(null)
  const [hoveredNode, setHoveredNode] = useState<{
    key: string
    anchorRect: DOMRect
    info: NodeTooltipInfo
  } | null>(null)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const chainRef = useRef<HTMLDivElement | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [chainSize, setChainSize] = useState({ w: 0, h: 0 })

  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origPanX: number
    origPanY: number
  } | null>(null)

  const fitScale = (() => {
    if (stageSize.w <= 0 || stageSize.h <= 0 || chainSize.w <= 0 || chainSize.h <= 0) return 1
    const availW = Math.max(220, stageSize.w - 48)
    const availH = Math.max(180, stageSize.h - 68)
    return Math.min(1.05, Math.max(0.35, Math.min(availW / chainSize.w, availH / chainSize.h)))
  })()

  const effectiveScale = manualZoom ?? fitScale
  const scalePercent = Math.round(effectiveScale * 100)

  const cameraRef = useRef({ effectiveScale, pan, stageSize, chainSize })
  cameraRef.current = { effectiveScale, pan, stageSize, chainSize }

  function clearNodeHover() {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setHoveredNode(null)
  }

  function scheduleNodeHover(key: string, el: HTMLElement, item: FlowItem) {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
    }
    if (dragRef.current || openConduitIdx !== null) return
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null
      if (!el.isConnected || dragRef.current) return
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const info = buildNodeTooltipInfo({
        item,
        inputShape,
        outputDim,
        outputActivation,
        targetColumn,
        scalerApplied,
        breakdown,
        totalParams,
        recommended,
        isOptimalApplied,
      })
      setHoveredNode({ key, anchorRect: rect, info })
    }, 120)
  }

  useEffect(() => {
    const closeMenu = () => setOpenConduitIdx(null)
    window.addEventListener('click', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenu)
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      setHoveredNode(null)

      const { effectiveScale: oldScale, pan: oldPan, stageSize: sSize, chainSize: cSize } =
        cameraRef.current
      if (sSize.w <= 0 || cSize.w <= 0) return

      const rect = el.getBoundingClientRect()
      const mx = event.clientX - rect.left
      const my = event.clientY - rect.top

      const factor = event.deltaY < 0 ? 1.1 : 0.91
      const newScale = Math.min(1.8, Math.max(0.35, Number((oldScale * factor).toFixed(3))))
      if (Math.abs(newScale - oldScale) < 0.001) return

      const oldBaseX = (sSize.w - cSize.w * oldScale) / 2
      const oldBaseY = (sSize.h - cSize.h * oldScale) / 2
      const wx = (mx - (oldBaseX + oldPan.x)) / oldScale
      const wy = (my - (oldBaseY + oldPan.y)) / oldScale

      const newBaseX = (sSize.w - cSize.w * newScale) / 2
      const newBaseY = (sSize.h - cSize.h * newScale) / 2
      const nextPanX = mx - wx * newScale - newBaseX
      const nextPanY = my - wy * newScale - newBaseY

      setManualZoom(newScale)
      setPan({ x: nextPanX, y: nextPanY })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  useLayoutEffect(() => {
    const measureStage = () => {
      const stageEl = stageRef.current
      if (stageEl) {
        setStageSize({ w: stageEl.clientWidth, h: stageEl.clientHeight })
      }
      const chainEl = chainRef.current
      if (chainEl) {
        setChainSize({ w: chainEl.offsetWidth, h: chainEl.offsetHeight })
      }
    }

    measureStage()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measureStage)
    if (stageRef.current) observer.observe(stageRef.current)
    if (chainRef.current) observer.observe(chainRef.current)
    return () => observer.disconnect()
  }, [layersList.length, compactMode, layoutMode])

  function resetCamera() {
    clearNodeHover()
    setManualZoom(null)
    setPan({ x: 0, y: 0 })
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-interactive="true"]')) return

    clearNodeHover()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      return
    }
    setIsDragging(true)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d) return
    setPan({
      x: d.origPanX + (event.clientX - d.startX),
      y: d.origPanY + (event.clientY - d.startY),
    })
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d) return
    try {
      event.currentTarget.releasePointerCapture(d.pointerId)
    } catch {
      dragRef.current = null
      setIsDragging(false)
      return
    }
    dragRef.current = null
    setIsDragging(false)
  }

  function handleStageDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-interactive="true"]')) return
    resetCamera()
  }

  const healthBadgeClass =
    health.status === 'optimal'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35 hover:bg-emerald-500/25'
      : health.status === 'acceptable'
        ? 'bg-amber-500/15 text-amber-300 border-amber-400/35 hover:bg-amber-500/25'
        : 'bg-rose-500/15 text-rose-300 border-rose-400/35 hover:bg-rose-500/25'

  const healthDotClass =
    health.status === 'optimal'
      ? 'bg-emerald-400'
      : health.status === 'acceptable'
        ? 'bg-amber-400'
        : 'bg-rose-400'

  const lastLayerIsDropout =
    layersList.length > 0 && layersList[layersList.length - 1].type === 'Dropout'

  const items: FlowItem[] = [
    { kind: 'input', globalIdx: 0 },
    ...layersList.map((layer, idx) => ({
      kind: 'layer' as const,
      globalIdx: idx + 1,
      layer,
      layerIdx: idx,
    })),
    { kind: 'output', globalIdx: layersList.length + 1 },
  ]

  const isSerpentineMultiRow = layoutMode === 'serpentine' && items.length >= 6
  const nodeWidthPx = compactMode ? 148 : 178
  const conduitWidthPx = 54
  const perRow = items.length <= 6 ? 3 : items.length <= 8 ? 4 : 5
  const serpentineRowWidthPx = perRow * nodeWidthPx + (perRow - 1) * conduitWidthPx

  const baseX = stageSize.w > 0 && chainSize.w > 0 ? (stageSize.w - chainSize.w * effectiveScale) / 2 : 0
  const baseY = stageSize.h > 0 && chainSize.h > 0 ? (stageSize.h - chainSize.h * effectiveScale) / 2 : 0
  const hasCustomView = manualZoom !== null || Math.abs(pan.x) > 4 || Math.abs(pan.y) > 4

  function renderNode(
    item: FlowItem,
    inSide?: SocketSide,
    outSide?: SocketSide,
    isRtlRow?: boolean
  ) {
    if (item.kind === 'input') {
      const hoverKey = 'node-input'
      const isHovered = hoveredNode?.key === hoverKey
      return (
        <div
          key={hoverKey}
          data-interactive="true"
          onMouseEnter={event => scheduleNodeHover(hoverKey, event.currentTarget, item)}
          onMouseLeave={clearNodeHover}
          onMouseDown={clearNodeHover}
          style={{ width: `${nodeWidthPx}px` }}
          className={`nl-arch-node relative rounded-2xl border shrink-0 transition-all ${
            isHovered ? 'border-cyan-300/80 shadow-[0_0_24px_rgba(34,211,238,0.28)]' : 'border-cyan-400/40'
          } ${compactMode ? 'p-2.5' : 'p-3'}`}
        >
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500" />
            <div className="h-9 w-full bg-gradient-to-b from-cyan-500/14 to-transparent" />
          </div>
          <NodeSockets
            inSide={inSide}
            outSide={outSide}
            colorClass="bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
          />

          <div className="relative flex items-center justify-between gap-1 mb-1">
            <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
              Input
            </span>
            <Lock className="w-3 h-3 text-slate-500" />
          </div>

          <div className="relative text-lg font-extrabold font-mono text-white leading-tight">
            ({inputShape},)
          </div>

          {!compactMode && (
            <div className="relative mt-2 h-6 px-2 rounded-lg bg-[#040a18]/85 border border-white/5 flex items-end justify-between gap-1 py-1">
              {INPUT_SPECTRUM_BARS.map((heightPct, barIdx) => (
                <span
                  key={barIdx}
                  style={{
                    height: `${heightPct}%`,
                    animationDelay: `${barIdx * 130}ms`,
                  }}
                  className={`w-2 rounded-sm bg-gradient-to-t from-cyan-500/75 to-sky-300 ${
                    flowAnimated ? 'nl-spectrum-bar' : 'opacity-70'
                  }`}
                />
              ))}
            </div>
          )}

          <div className="relative mt-1.5 flex items-center justify-between gap-1 text-[10px] font-mono">
            <span className="text-slate-400">Escalado</span>
            <span className="text-cyan-300 truncate font-semibold">{scalerApplied}</span>
          </div>
        </div>
      )
    }

    if (item.kind === 'output') {
      const hoverKey = 'node-output'
      const isHovered = hoveredNode?.key === hoverKey
      return (
        <div
          key={hoverKey}
          data-interactive="true"
          onMouseEnter={event => scheduleNodeHover(hoverKey, event.currentTarget, item)}
          onMouseLeave={clearNodeHover}
          onMouseDown={clearNodeHover}
          style={{ width: `${nodeWidthPx}px` }}
          className={`nl-arch-node relative rounded-2xl border shrink-0 transition-all ${
            isHovered
              ? 'border-emerald-300/80 shadow-[0_0_24px_rgba(52,211,153,0.28)]'
              : 'border-emerald-400/40'
          } ${lastLayerIsDropout ? 'shadow-[0_0_24px_rgba(52,211,153,0.16)]' : ''} ${
            compactMode ? 'p-2.5' : 'p-3'
          }`}
        >
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="h-[2px] w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
            <div className="h-9 w-full bg-gradient-to-b from-emerald-500/14 to-transparent" />
          </div>
          <NodeSockets
            inSide={inSide}
            outSide={outSide}
            colorClass="bg-emerald-400 shadow-[0_0_8px_#34d399]"
          />

          <div className="relative flex items-center justify-between gap-1 mb-1">
            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
              <Target className="w-2.5 h-2.5" />
              <span>Salida</span>
            </span>
            <Lock className="w-3 h-3 text-slate-500" />
          </div>

          <div className="relative text-lg font-extrabold font-mono text-white leading-tight">
            ({outputDim},)
          </div>

          {!compactMode && (
            <div className="relative mt-2 px-2 py-1 rounded-lg bg-[#040a18]/85 border border-white/5 flex items-center justify-between gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono font-semibold text-emerald-300">
                <span
                  className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${
                    flowAnimated ? 'animate-pulse shadow-[0_0_6px_#34d399]' : ''
                  }`}
                />
                {outputActivation}
              </span>
              <span className="text-[9.5px] font-mono text-slate-400">head</span>
            </div>
          )}

          {compactMode && (
            <div className="relative mt-1 text-[10.5px] font-mono text-emerald-300">
              {outputActivation}
            </div>
          )}

          <div className="relative mt-1.5 flex items-center justify-between gap-1 text-[10px]">
            <span className="text-slate-400">Target</span>
            <span className="font-mono text-slate-200 truncate font-medium">{targetColumn}</span>
          </div>
        </div>
      )
    }

    const { layer, layerIdx } = item
    const theme = getLayerTheme(layer.type)
    const b = breakdown[layerIdx]
    const isSelected = selectedIdx === layerIdx
    const paramPct = totalParams > 0 && b ? Math.round((b.total / totalParams) * 100) : 0
    const units = layer.units ?? 32
    const denseNeuronDots = Math.min(7, Math.max(4, Math.round(Math.log2(units / 2))))
    const dropoutPct = Math.round((layer.rate ?? 0.2) * 100)
    const activeMaskCount = Math.max(1, Math.round((1 - (layer.rate ?? 0.2)) * 10))
    const PrevIcon = layoutMode === 'vertical' ? ArrowUp : isRtlRow ? ArrowRight : ArrowLeft
    const NextIcon = layoutMode === 'vertical' ? ArrowDown : isRtlRow ? ArrowLeft : ArrowRight
    const hoverKey = `node-layer-${layer.id}`

    return (
      <div
        key={layer.id}
        data-interactive="true"
        onClick={() => onSelectLayer(layerIdx)}
        onMouseEnter={event => scheduleNodeHover(hoverKey, event.currentTarget, item)}
        onMouseLeave={clearNodeHover}
        onMouseDown={clearNodeHover}
        style={{ width: `${nodeWidthPx}px` }}
        className={`nl-arch-node relative rounded-2xl border cursor-pointer shrink-0 ${
          compactMode ? 'p-2.5' : 'p-3'
        } ${theme.border} ${
          isSelected
            ? 'nl-node-selected ring-1 ring-cyan-300/80 border-cyan-300 -translate-y-1'
            : 'hover:border-cyan-400/60'
        }`}
      >
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className={`h-[2px] w-full bg-gradient-to-r ${theme.hairline}`} />
          <div className={`h-9 w-full bg-gradient-to-b ${theme.aura}`} />
        </div>

        <NodeSockets inSide={inSide} outSide={outSide} colorClass={theme.port} />

        {isSelected && (
          <>
            <span className="pointer-events-none absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-300 rounded-tl-md" />
            <span className="pointer-events-none absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-300 rounded-tr-md" />
            <span className="pointer-events-none absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-300 rounded-bl-md" />
            <span className="pointer-events-none absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-300 rounded-br-md" />
          </>
        )}

        <div className="relative flex items-center justify-between gap-2 mb-1.5">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${theme.pill}`}
          >
            {layer.type === 'Dropout' ? (
              <ShieldAlert className="w-2.5 h-2.5" />
            ) : layer.type === 'BatchNormalization' ? (
              <Activity className="w-2.5 h-2.5" />
            ) : (
              <Layers className="w-2.5 h-2.5" />
            )}
            <span>{theme.title}</span>
          </span>
          <span className="text-[10.5px] font-mono text-slate-400">#{layerIdx + 1}</span>
        </div>

        {layer.type === 'Dense' && (
          <div className="relative space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white leading-tight">
                  {units}u{' '}
                  <span className="text-[11px] font-medium text-cyan-300">
                    · {layer.activation ?? 'relu'}
                  </span>
                </div>
              </div>
              {!compactMode && (
                <ActivationMiniCurve activation={layer.activation} layerId={layer.id} />
              )}
            </div>

            {!compactMode && (
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-[#040a18]/85 border border-white/5">
                <div className="flex items-center gap-1">
                  {Array.from({ length: denseNeuronDots }, (_, dotIdx) => (
                    <span
                      key={dotIdx}
                      style={{ animationDelay: `${(layerIdx * 2 + dotIdx) * 140}ms` }}
                      className={`w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)] ${
                        flowAnimated ? 'nl-neuron-dot' : 'opacity-75'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[9.5px] font-mono text-slate-400">
                  {layer.use_bias === false ? 'sin bias' : 'W·x+b'}
                </span>
              </div>
            )}
          </div>
        )}

        {layer.type === 'Dropout' && (
          <div className="relative space-y-1.5">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-sm font-extrabold text-amber-200 leading-tight">
                {dropoutPct}% drop
              </span>
              <span className="text-[10px] font-mono text-emerald-300">
                {100 - dropoutPct}% act.
              </span>
            </div>

            {!compactMode && (
              <div className="grid grid-cols-5 gap-1 p-1.5 rounded-lg bg-[#040a18]/85 border border-white/5">
                {Array.from({ length: 10 }, (_, slotIdx) => {
                  const active = slotIdx < activeMaskCount
                  return (
                    <span
                      key={slotIdx}
                      style={{
                        animationDelay: active ? `${slotIdx * 120}ms` : undefined,
                      }}
                      className={`h-2 rounded-full ${
                        active
                          ? `bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] ${
                              flowAnimated ? 'nl-neuron-dot' : ''
                            }`
                          : 'border border-dashed border-amber-400/45 bg-amber-500/10'
                      }`}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}

        {layer.type === 'BatchNormalization' && (
          <div className="relative space-y-1.5">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-sm font-extrabold text-emerald-200 leading-tight">
                Norm μ·σ
              </span>
              <span className="text-[10px] font-mono text-teal-300">μ=0 σ=1</span>
            </div>

            {!compactMode && (
              <div className="px-1.5 py-1 rounded-lg bg-[#040a18]/85 border border-white/5">
                <BatchNormBellCurve layerId={layer.id} />
              </div>
            )}
          </div>
        )}

        {(layer.type === 'Conv1D' || layer.type === 'MaxPooling1D' || layer.type === 'Flatten' || layer.type === 'LSTM' || layer.type === 'GRU') && (
          <div className="relative space-y-1">
            <div className="text-sm font-extrabold text-white leading-tight">
              {layer.type === 'Conv1D'
                ? `${layer.filters ?? 32} filtros · k=${layer.kernel_size ?? 3}`
                : layer.type === 'MaxPooling1D'
                  ? `Pool ÷${layer.pool_size ?? 2}`
                  : layer.type === 'Flatten'
                    ? 'Aplanar 1D'
                    : `${layer.units ?? 32}u · ${layer.type}`}
            </div>
            <div className="text-[10px] font-mono text-cyan-300">
              {layer.type === 'Conv1D' ? `padding=${layer.padding ?? 'same'}` : layer.type}
            </div>
          </div>
        )}

        {b && (
          <div className="relative mt-2 space-y-1">
            <div className="flex items-center justify-between text-[10.5px] font-mono">
              <span className="text-slate-400">
                {b.inShape}→{b.outShape}
              </span>
              <span className="text-slate-200 font-semibold">
                {b.total.toLocaleString('es-ES')} p
              </span>
            </div>
            {!compactMode && (
              <div className="h-1.5 rounded-full bg-slate-950/90 overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${theme.bar}`}
                  style={{ width: `${Math.max(8, paramPct)}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="relative mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-1 text-slate-400">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={layerIdx === 0}
              onClick={event => {
                event.stopPropagation()
                onMoveLayer(layerIdx, -1)
              }}
              title="Mover hacia entrada"
              className="p-1 rounded hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
            >
              <PrevIcon className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={layerIdx === layersList.length - 1}
              onClick={event => {
                event.stopPropagation()
                onMoveLayer(layerIdx, 1)
              }}
              title="Mover hacia salida"
              className="p-1 rounded hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors"
            >
              <NextIcon className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={event => {
                event.stopPropagation()
                onDuplicateLayer(layerIdx)
              }}
              title="Duplicar capa"
              className="p-1 rounded hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation()
                onRemoveLayer(layerIdx)
              }}
              title="Eliminar capa"
              className="p-1 rounded hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderConduitBetween(
    leftItem: FlowItem,
    rightItem: FlowItem,
    direction: ConduitDirection,
    openUpwards?: boolean
  ) {
    const insertIdx = leftItem.globalIdx
    const fromDropout = leftItem.kind === 'layer' && leftItem.layer.type === 'Dropout'
    const toOutput = rightItem.kind === 'output'

    return (
      <FlowConduit
        key={`conduit-${insertIdx}-${direction}`}
        insertIndex={insertIdx}
        phaseIndex={insertIdx}
        direction={direction}
        animated={flowAnimated}
        fromDropout={fromDropout}
        toOutput={toOutput}
        openUpwards={openUpwards}
        isMenuOpen={openConduitIdx === insertIdx}
        onToggleMenu={() => {
          clearNodeHover()
          setOpenConduitIdx(prev => (prev === insertIdx ? null : insertIdx))
        }}
        onInsert={type => {
          onInsertLayerAt(insertIdx, type)
          setOpenConduitIdx(null)
        }}
      />
    )
  }

  function renderChainContent() {
    if (layersList.length === 0) {
      const linearDir: ConduitDirection = layoutMode === 'vertical' ? 'ttb' : 'ltr'
      return (
        <div
          className={`w-max flex items-center ${
            layoutMode === 'vertical' ? 'flex-col' : 'flex-row'
          }`}
        >
          {renderNode(
            items[0],
            undefined,
            layoutMode === 'vertical' ? 'bottom' : 'right',
            false
          )}
          <FlowConduit
            insertIndex={0}
            phaseIndex={0}
            direction={linearDir}
            animated={flowAnimated}
            toOutput
            isMenuOpen={openConduitIdx === 0}
            onToggleMenu={() => {
              clearNodeHover()
              setOpenConduitIdx(prev => (prev === 0 ? null : 0))
            }}
            onInsert={type => {
              onInsertLayerAt(0, type)
              setOpenConduitIdx(null)
            }}
          />
          <div
            data-interactive="true"
            className="rounded-2xl border border-dashed border-cyan-400/35 bg-slate-900/60 px-5 py-3.5 text-center max-w-[230px]"
          >
            <p className="text-xs font-semibold text-slate-200">Sin capas ocultas</p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              Usa el catálogo izquierdo o pulsa + en la conexión.
            </p>
          </div>
          <FlowConduit
            insertIndex={1}
            phaseIndex={1}
            direction={linearDir}
            animated={flowAnimated}
            toOutput
            isMenuOpen={openConduitIdx === 1}
            onToggleMenu={() => {
              clearNodeHover()
              setOpenConduitIdx(prev => (prev === 1 ? null : 1))
            }}
            onInsert={type => {
              onInsertLayerAt(0, type)
              setOpenConduitIdx(null)
            }}
          />
          {renderNode(
            items[1],
            layoutMode === 'vertical' ? 'top' : 'left',
            undefined,
            false
          )}
        </div>
      )
    }

    if (isSerpentineMultiRow) {
      const rows: FlowItem[][] = []
      for (let i = 0; i < items.length; i += perRow) {
        rows.push(items.slice(i, i + perRow))
      }

      return (
        <div
          style={{ width: `${serpentineRowWidthPx}px` }}
          className="flex flex-col items-stretch"
        >
          {rows.map((row, rIdx) => {
            const isRtlRow = rIdx % 2 === 1
            const rowDir: ConduitDirection = isRtlRow ? 'rtl' : 'ltr'
            const isLastRow = rIdx === rows.length - 1
            const nextRow = !isLastRow ? rows[rIdx + 1] : null

            return (
              <div key={`row-group-${rIdx}`} className="flex flex-col">
                <div
                  className={`flex items-center justify-start ${
                    isRtlRow ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {row.map((item, cIdx) => {
                    const isFirstInGlobal = item.globalIdx === 0
                    const isLastInGlobal = item.globalIdx === items.length - 1
                    const inSide: SocketSide | undefined = isFirstInGlobal
                      ? undefined
                      : cIdx === 0
                        ? 'top'
                        : isRtlRow
                          ? 'right'
                          : 'left'
                    const outSide: SocketSide | undefined = isLastInGlobal
                      ? undefined
                      : cIdx === row.length - 1
                        ? 'bottom'
                        : isRtlRow
                          ? 'left'
                          : 'right'

                    return (
                      <div
                        key={`cell-${item.globalIdx}`}
                        className={`flex items-center ${
                          isRtlRow ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        {renderNode(item, inSide, outSide, isRtlRow)}
                        {cIdx < row.length - 1 &&
                          renderConduitBetween(
                            item,
                            row[cIdx + 1],
                            rowDir,
                            isLastRow && rows.length > 1
                          )}
                      </div>
                    )
                  })}
                </div>

                {nextRow && (
                  <div className={`flex ${isRtlRow ? 'justify-start' : 'justify-end'}`}>
                    <div style={{ width: `${nodeWidthPx}px` }} className="flex justify-center">
                      {renderConduitBetween(row[row.length - 1], nextRow[0], 'ttb', false)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    const isVert = layoutMode === 'vertical'
    const linearDir: ConduitDirection = isVert ? 'ttb' : 'ltr'

    return (
      <div className={`w-max flex items-center ${isVert ? 'flex-col' : 'flex-row'}`}>
        {items.map((item, iIdx) => {
          const inSide: SocketSide | undefined =
            iIdx === 0 ? undefined : isVert ? 'top' : 'left'
          const outSide: SocketSide | undefined =
            iIdx === items.length - 1 ? undefined : isVert ? 'bottom' : 'right'

          return (
            <div
              key={`linear-${item.globalIdx}`}
              className={`flex items-center ${isVert ? 'flex-col' : 'flex-row'}`}
            >
              {renderNode(item, inSide, outSide, false)}
              {iIdx < items.length - 1 &&
                renderConduitBetween(item, items[iIdx + 1], linearDir, false)}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="nl-cyber-panel animate-card-reveal flex-1 h-full min-h-[380px] flex flex-col rounded-2xl overflow-hidden">
      <div className="px-3.5 py-2 border-b border-white/10 bg-slate-900/55 flex flex-wrap 2xl:flex-nowrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-200 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            Plano de Arquitectura
          </span>

          <button
            type="button"
            onClick={() => onOpenInsights('profile')}
            title="Abrir Perfil Tensorial & Salud"
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10.5px] font-semibold transition-colors whitespace-nowrap ${healthBadgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${healthDotClass}`} />
            <span>{health.label}</span>
          </button>

          <span className="px-2 py-0.5 rounded-md bg-slate-950/75 border border-white/10 text-[10.5px] font-mono text-slate-300 hidden md:inline whitespace-nowrap">
            {layersList.length}c · {totalParams.toLocaleString('es-ES')} p
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenInsights('reasons')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-violet-400/35 bg-gradient-to-r from-violet-500/20 to-cyan-500/15 hover:from-violet-500/30 hover:to-cyan-500/25 text-violet-100 text-[11px] font-medium transition-all whitespace-nowrap"
          >
            <Sparkles className="w-3 h-3 text-cyan-300" />
            <span>Justificación IA ({recommended.layerReasons.length})</span>
            {isOptimalApplied && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            )}
          </button>

          <div className="inline-flex items-center rounded-lg border border-white/10 bg-slate-950/80 p-0.5">
            <button
              type="button"
              onClick={() => {
                setLayoutMode('serpentine')
                resetCamera()
              }}
              title="Vista serpentina adaptable"
              aria-label="Vista serpentina adaptable"
              className={`p-1 rounded-md transition-colors ${
                layoutMode === 'serpentine'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode('horizontal')
                resetCamera()
              }}
              title="Línea horizontal"
              aria-label="Línea horizontal"
              className={`p-1 rounded-md transition-colors ${
                layoutMode === 'horizontal'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode('vertical')
                resetCamera()
              }}
              title="Columna vertical"
              aria-label="Columna vertical"
              className={`p-1 rounded-md transition-colors ${
                layoutMode === 'vertical'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="inline-flex items-center rounded-lg border border-white/10 bg-slate-950/80 px-1 py-0.5 gap-0.5">
            <button
              type="button"
              onClick={() =>
                setManualZoom(Math.max(0.35, Number((effectiveScale - 0.12).toFixed(2))))
              }
              title="Alejar zoom"
              aria-label="Alejar zoom"
              className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={resetCamera}
              title="Restablecer vista y encuadre automático"
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-mono transition-colors whitespace-nowrap ${
                !hasCustomView
                  ? 'text-cyan-300 bg-cyan-500/10'
                  : 'text-amber-200 bg-amber-500/10 hover:bg-amber-500/20'
              }`}
            >
              <Maximize2 className="w-2.5 h-2.5 opacity-80" />
              <span>{scalePercent}%</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setManualZoom(Math.min(1.8, Number((effectiveScale + 0.12).toFixed(2))))
              }
              title="Acercar zoom"
              aria-label="Acercar zoom"
              className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCompactMode(prev => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
              compactMode
                ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-200'
                : 'border-white/10 bg-slate-950/75 text-slate-300 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{compactMode ? 'Detallado' : 'Compacto'}</span>
          </button>

          <button
            type="button"
            onClick={() => setFlowAnimated(prev => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] transition-colors whitespace-nowrap ${
              flowAnimated
                ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-slate-950/75 text-slate-400 hover:text-white'
            }`}
          >
            {flowAnimated ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{flowAnimated ? 'Flujo' : 'Pausado'}</span>
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onMouseLeave={clearNodeHover}
        onDoubleClick={handleStageDoubleClick}
        className={`nl-arch-stage flex-1 relative overflow-hidden select-none touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <span className="pointer-events-none absolute top-2.5 left-2.5 w-3 h-3 border-t border-l border-cyan-400/35 z-10" />
        <span className="pointer-events-none absolute top-2.5 right-2.5 w-3 h-3 border-t border-r border-cyan-400/35 z-10" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 w-3 h-3 border-b border-l border-cyan-400/35 z-10" />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 w-3 h-3 border-b border-r border-cyan-400/35 z-10" />

        <div
          data-interactive="true"
          className="absolute top-3.5 left-4 z-10 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/75 border border-white/10 text-[10px] text-slate-300 backdrop-blur-sm"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              flowAnimated ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]' : 'bg-amber-400'
            }`}
          />
          <span>{flowAnimated ? 'Forward Pass Activo' : 'Flujo Pausado'}</span>
        </div>

        <div className="pointer-events-none absolute top-3.5 right-4 z-10 hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/70 border border-white/10 text-[10px] text-slate-400 backdrop-blur-sm">
          <Move className="w-2.5 h-2.5 text-cyan-400" />
          <span>Rueda: Zoom · Arrastrar: Mover · Hover: Info</span>
        </div>

        <button
          type="button"
          data-interactive="true"
          onClick={resetCamera}
          title="Centrar y ajustar automáticamente"
          className="absolute bottom-3.5 right-4 z-10 px-2.5 py-0.5 rounded-md bg-slate-950/80 hover:bg-slate-900 border border-white/10 hover:border-cyan-400/40 text-[10px] font-mono text-slate-300 hover:text-cyan-200 transition-colors"
        >
          {manualZoom === null ? 'Auto' : 'Manual'} {scalePercent}%
          {hasCustomView ? ' · Centrar' : ''}
        </button>

        <div
          ref={chainRef}
          style={{
            transform: `translate3d(${baseX + pan.x}px, ${baseY + pan.y}px, 0) scale(${effectiveScale})`,
            transformOrigin: '0 0',
          }}
          className={`absolute top-0 left-0 w-max ${
            isDragging ? '' : 'transition-transform duration-150 ease-out'
          }`}
        >
          {renderChainContent()}
        </div>
      </div>

      <div className="px-3.5 py-1.5 border-t border-white/10 bg-slate-900/55 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-1 text-[10.5px] font-mono">
          <span
            onMouseEnter={event =>
              scheduleNodeHover('crumb-input', event.currentTarget, items[0])
            }
            onMouseLeave={clearNodeHover}
            className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 cursor-help"
          >
            Input ({inputShape},)
          </span>
          {layersList.map((layer, idx) => (
            <div key={layer.id} className="inline-flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <button
                type="button"
                onClick={() => onSelectLayer(idx)}
                onMouseEnter={event =>
                  scheduleNodeHover(`crumb-${layer.id}`, event.currentTarget, items[idx + 1])
                }
                onMouseLeave={clearNodeHover}
                className={`px-2 py-0.5 rounded-md border transition-colors ${
                  selectedIdx === idx
                    ? 'bg-cyan-500/20 border-cyan-400/55 text-white font-semibold'
                    : 'bg-slate-950/75 border-white/10 text-slate-300 hover:border-cyan-400/35'
                }`}
              >
                #{idx + 1}{' '}
                {layer.type === 'Dense'
                  ? `${layer.units ?? 32}u`
                  : layer.type === 'Dropout'
                    ? `${Math.round((layer.rate ?? 0.2) * 100)}%`
                    : layer.type === 'BatchNormalization'
                      ? 'BN'
                      : layer.type === 'Conv1D'
                        ? `Conv ${layer.filters ?? 32}`
                        : layer.type === 'LSTM' || layer.type === 'GRU'
                          ? `${layer.type} ${layer.units ?? 32}`
                          : layer.type}
              </button>
            </div>
          ))}
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span
            onMouseEnter={event =>
              scheduleNodeHover(
                'crumb-output',
                event.currentTarget,
                items[items.length - 1]
              )
            }
            onMouseLeave={clearNodeHover}
            className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 cursor-help"
          >
            Salida ({outputDim},)
          </span>
        </div>

        <button
          type="button"
          onClick={() => onOpenInsights('profile')}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Perfil &amp; Salud</span>
        </button>
      </div>

      {hoveredNode && (
        <NodeHoverPopover anchorRect={hoveredNode.anchorRect} info={hoveredNode.info} />
      )}
    </div>
  )
}
