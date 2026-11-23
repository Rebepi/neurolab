import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Layers,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import type {
  ArchitectureHealth,
  LayerParamBreakdown,
  RecommendedArchitecture,
} from '../utils'
import type { LayerSpec } from '../../../types'

interface ArchitectureInsightsModalProps {
  isOpen: boolean
  initialTab: 'reasons' | 'profile'
  onClose: () => void
  recommended: RecommendedArchitecture
  isOptimalApplied: boolean
  onApplyRecommended: () => void
  health: ArchitectureHealth
  breakdown: LayerParamBreakdown[]
  totalParams: number
  inputShape: number
  outputDim: number
  outputActivation: string
  targetColumn: string
  scalerApplied: string
  layersList: LayerSpec[]
  selectedIdx: number | null
  onSelectLayer: (idx: number) => void
}

function getHealthColors(status: ArchitectureHealth['status']) {
  if (status === 'optimal') {
    return {
      pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
      dot: 'bg-emerald-400',
      card: 'border-emerald-500/25 bg-emerald-500/5',
    }
  }
  if (status === 'acceptable') {
    return {
      pill: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
      dot: 'bg-amber-400',
      card: 'border-amber-500/25 bg-amber-500/5',
    }
  }
  return {
    pill: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
    dot: 'bg-rose-400',
    card: 'border-rose-500/25 bg-rose-500/5',
  }
}

export function ArchitectureInsightsModal({
  isOpen,
  initialTab,
  onClose,
  recommended,
  isOptimalApplied,
  onApplyRecommended,
  health,
  breakdown,
  totalParams,
  inputShape,
  outputDim,
  outputActivation,
  targetColumn,
  scalerApplied,
  layersList,
  selectedIdx,
  onSelectLayer,
}: ArchitectureInsightsModalProps) {
  const [activeTab, setActiveTab] = useState<'reasons' | 'profile'>(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const healthColors = getHealthColors(health.status)
  const memoryKb = ((totalParams * 4) / 1024).toFixed(1)

  const funnelStages = (() => {
    const raw: Array<{ label: string; sub: string; dim: number; layerIndex: number | null }> = [
      { label: 'Input', sub: `${inputShape} vars`, dim: Math.max(1, inputShape), layerIndex: null },
    ]
    let currentDim = Math.max(1, inputShape)
    layersList.forEach((layer, idx) => {
      const b = breakdown[idx]
      const outDim = b ? Math.max(1, b.outShape) : currentDim
      currentDim = outDim
      const shortType =
        layer.type === 'Dense'
          ? `#${idx + 1} Dense`
          : layer.type === 'Dropout'
            ? `#${idx + 1} Drop`
            : layer.type === 'BatchNormalization'
              ? `#${idx + 1} BN`
              : `#${idx + 1} ${layer.type}`
      const subText =
        layer.type === 'Dense'
          ? `${outDim}u · ${layer.activation ?? 'relu'}`
          : layer.type === 'Dropout'
            ? `${Math.round((layer.rate ?? 0.2) * 100)}% drop`
            : 'norm μ,σ'
      raw.push({
        label: shortType,
        sub: subText,
        dim: outDim,
        layerIndex: idx,
      })
    })
    raw.push({
      label: 'Salida',
      sub: `${outputDim} · ${outputActivation}`,
      dim: Math.max(1, outputDim),
      layerIndex: null,
    })
    return raw
  })()

  const maxDim = Math.max(...funnelStages.map(s => s.dim), 1)
  const svgW = 520
  const svgH = 130
  const padX = 34
  const padTop = 18
  const padBottom = 30
  const plotH = svgH - padTop - padBottom
  const count = funnelStages.length
  const stepX = count > 1 ? (svgW - padX * 2) / (count - 1) : 0

  const coords = funnelStages.map((stage, i) => {
    const cx = count > 1 ? padX + i * stepX : svgW / 2
    const ratio = stage.dim / maxDim
    const halfH = Math.max(7, Math.min(plotH / 2, ratio * (plotH / 2)))
    const midY = padTop + plotH / 2
    return {
      ...stage,
      cx,
      topY: midY - halfH,
      botY: midY + halfH,
      midY,
      halfH,
    }
  })

  const polygonPoints = [
    ...coords.map(c => `${c.cx.toFixed(1)},${c.topY.toFixed(1)}`),
    ...[...coords].reverse().map(c => `${c.cx.toFixed(1)},${c.botY.toFixed(1)}`),
  ].join(' ')

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="arch-insights-modal-title"
    >
      <div
        className="relative w-full max-w-4xl max-h-[86vh] flex flex-col rounded-2xl border border-cyan-500/25 bg-[#070f21]/95 text-slate-100 shadow-[0_24px_90px_rgba(2,6,23,0.9)] overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400 shrink-0" />

        <div className="px-5 py-4 border-b border-white/10 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0">
              {activeTab === 'reasons' ? (
                <Sparkles className="w-5 h-5 text-cyan-300" />
              ) : (
                <Activity className="w-5 h-5 text-emerald-300" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="arch-insights-modal-title"
                className="text-base sm:text-lg font-semibold text-white tracking-tight truncate"
              >
                Análisis IA &amp; Perfil Tensorial
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {recommended.signals.problemLabel} ·{' '}
                {recommended.signals.trainRows.toLocaleString('es-ES')} filas train ·{' '}
                {recommended.signals.features} variables de entrada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-white/10 bg-slate-950/80 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('reasons')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'reasons'
                    ? 'bg-gradient-to-r from-violet-500/25 to-cyan-500/25 text-cyan-200 border border-cyan-400/35 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Justificación IA ({recommended.layerReasons.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'profile'
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-200 border border-emerald-400/35 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Perfil Tensorial &amp; Salud</span>
                <span className={`w-1.5 h-1.5 rounded-full ${healthColors.dot}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'reasons' ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-white/10 text-slate-300">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  {recommended.signals.trainRows.toLocaleString('es-ES')} filas train
                  <span className="text-slate-500">
                    ({recommended.signals.totalRows.toLocaleString('es-ES')} tot.)
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-white/10 text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                  {recommended.signals.features} vars ({recommended.signals.numericCols} num ·{' '}
                  {recommended.signals.categoricalCols} cat
                  {recommended.signals.oneHotExpansion > 0
                    ? ` · +${recommended.signals.oneHotExpansion} One-Hot`
                    : ''}
                  )
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-white/10 text-slate-300">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  {recommended.signals.candidatesEvaluated} topologías ·{' '}
                  {recommended.signals.chosenParams.toLocaleString('es-ES')} params (
                  {recommended.signals.samplesPerParam !== null
                    ? `${recommended.signals.samplesPerParam}x`
                    : '—'}
                  )
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-white/10 text-slate-300">
                  Loss: <code className="text-cyan-300">{recommended.signals.lossName}</code>
                </span>
              </div>

              {isOptimalApplied ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="text-xs text-emerald-200">
                      <span className="font-semibold">Topología recomendada activa:</span>{' '}
                      {recommended.name} — {recommended.summary}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shrink-0">
                    {recommended.tierLabel}
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-transparent px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-cyan-200">
                      Recomendación calculada: {recommended.name} ({recommended.tierLabel})
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">{recommended.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onApplyRecommended}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-semibold text-xs shadow-lg shadow-cyan-500/20 transition-all shrink-0"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Aplicar Recomendada
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recommended.layerReasons.map(reason => {
                  const canSelect =
                    reason.layerIndex !== null && reason.layerIndex < layersList.length
                  const isSelected = canSelect && selectedIdx === reason.layerIndex
                  return (
                    <div
                      key={reason.id}
                      onClick={() => {
                        if (canSelect && reason.layerIndex !== null) {
                          onSelectLayer(reason.layerIndex)
                        }
                      }}
                      className={`rounded-xl border p-3.5 transition-all ${
                        canSelect ? 'cursor-pointer hover:border-cyan-400/40' : ''
                      } ${
                        isSelected
                          ? 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
                          : 'border-white/10 bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              reason.role === 'input'
                                ? 'bg-cyan-400'
                                : reason.role === 'output'
                                  ? 'bg-emerald-400'
                                  : 'bg-violet-400'
                            }`}
                          />
                          <h3 className="text-xs font-semibold text-white truncate">
                            {reason.title}
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950/90 border border-white/10 text-cyan-300 shrink-0">
                          {reason.specBadge}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">{reason.reason}</p>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-slate-900/65 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Embudo de Dimensionalidad Tensorial
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Evolución de dimensiones desde entrada ({inputShape},) hasta salida (
                      {outputDim},)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-white/10 font-mono">
                      ({inputShape},) → ({outputDim},)
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/70 p-2 overflow-hidden">
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="w-full h-[150px]"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <linearGradient id="nlFunnelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
                        <stop offset="55%" stopColor="#818cf8" stopOpacity="0.38" />
                        <stop offset="100%" stopColor="#34d399" stopOpacity="0.45" />
                      </linearGradient>
                    </defs>

                    <line
                      x1={padX}
                      y1={padTop + plotH / 2}
                      x2={svgW - padX}
                      y2={padTop + plotH / 2}
                      stroke="rgba(148,163,184,0.16)"
                      strokeDasharray="4 4"
                    />

                    {coords.length >= 2 && (
                      <polygon
                        points={polygonPoints}
                        fill="url(#nlFunnelGrad)"
                        stroke="rgba(56,189,248,0.45)"
                        strokeWidth="1.25"
                      />
                    )}

                    {coords.map((c, idx) => {
                      const isSel = c.layerIndex !== null && selectedIdx === c.layerIndex
                      return (
                        <g
                          key={`${c.label}-${idx}`}
                          onClick={() => {
                            if (c.layerIndex !== null) onSelectLayer(c.layerIndex)
                          }}
                          className={c.layerIndex !== null ? 'cursor-pointer' : undefined}
                        >
                          <line
                            x1={c.cx}
                            y1={c.topY}
                            x2={c.cx}
                            y2={c.botY}
                            stroke={isSel ? '#22d3ee' : 'rgba(226,232,240,0.5)'}
                            strokeWidth={isSel ? 2.5 : 1.5}
                          />
                          <circle
                            cx={c.cx}
                            cy={c.midY}
                            r={isSel ? 4.5 : 3.2}
                            fill={
                              idx === 0
                                ? '#22d3ee'
                                : idx === coords.length - 1
                                  ? '#34d399'
                                  : isSel
                                    ? '#fde047'
                                    : '#a78bfa'
                            }
                          />
                          <text
                            x={c.cx}
                            y={12}
                            textAnchor="middle"
                            fill="#cbd5e1"
                            fontSize="9.5"
                            fontWeight="600"
                          >
                            {c.label}
                          </text>
                          <text
                            x={c.cx}
                            y={svgH - 12}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="8.5"
                          >
                            {c.sub}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>
              </div>

              <div className={`rounded-xl border p-4 space-y-3 ${healthColors.card}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-300" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                      Diagnóstico de Capacidad &amp; Regularización
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${healthColors.pill}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${healthColors.dot}`} />
                    {health.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Muestras / Parámetro
                    </div>
                    <div className="text-sm font-semibold text-white mt-0.5">
                      {health.samplesPerParam !== null ? `${health.samplesPerParam}x` : 'N/A'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Regularización
                    </div>
                    <div className="text-sm font-semibold text-white mt-0.5">
                      {health.hasRegularization ? 'Activa' : 'Ausente'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Escalado Entrada
                    </div>
                    <div className="text-sm font-semibold text-cyan-300 mt-0.5 truncate">
                      {scalerApplied}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Cabezal Salida
                    </div>
                    <div className="text-sm font-semibold text-emerald-300 mt-0.5 truncate">
                      ({outputDim},) · {outputActivation} · {targetColumn}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {health.notes.map((note, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs text-slate-200 bg-slate-950/50 border border-white/5 rounded-lg px-3 py-2"
                    >
                      {health.status === 'optimal' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      )}
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </div>

              {breakdown.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5">
                    Desglose Tensorial por Capa
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {breakdown.map(row => (
                      <button
                        key={row.layerIndex}
                        type="button"
                        onClick={() => onSelectLayer(row.layerIndex)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                          selectedIdx === row.layerIndex
                            ? 'border-cyan-400/60 bg-cyan-500/15 text-white'
                            : 'border-white/10 bg-slate-950/70 text-slate-300 hover:border-cyan-400/35'
                        }`}
                      >
                        <span className="font-semibold text-cyan-300">#{row.layerIndex + 1}</span>
                        <span>{row.type}</span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
                          {row.inShape}
                          <ArrowRight className="w-3 h-3" />
                          {row.outShape}
                        </span>
                        <span className="font-mono text-[11px] text-emerald-300">
                          {row.total.toLocaleString('es-ES')} p
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-slate-900/65 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            <span className="text-slate-200 font-medium">{layersList.length}</span> capas ocultas ·{' '}
            <span className="text-cyan-300 font-mono font-medium">
              {totalParams.toLocaleString('es-ES')}
            </span>{' '}
            parámetros entrenables · <span className="text-slate-200 font-mono">{memoryKb} KB</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-white/15 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
