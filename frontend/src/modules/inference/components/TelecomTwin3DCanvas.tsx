import { useEffect, useMemo, useState } from 'react'
import { Activity, Cpu, RotateCcw, Sparkles, Zap } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import { useTheme } from '../../../context/ThemeContext'
import type { LayerTrace, PredictionResponse } from '../../../types/index'

export type EnterpriseAreaKind = 'retencion' | 'noc' | 'antifraude' | 'comercial' | 'general'

interface TelecomTwin3DCanvasProps {
  areaKind: EnterpriseAreaKind
  features: Record<string, any>
  visualLayers: LayerTrace[]
  animStage: number
  inferring: boolean
  result: PredictionResponse | null
  phaseText: string
}

interface PositionedNeuron {
  id: string
  layerIdx: number
  neuronIdx: number
  x: number
  y: number
  activation: number
  color: string
  glowColor: string
  isOutput: boolean
  isInput: boolean
  label?: string
}

interface SynapseEdge {
  id: string
  srcLayer: number
  dstLayer: number
  x1: number
  y1: number
  x2: number
  y2: number
  path: string
  weight: number
  color: string
  showPulse: boolean
  pulseDelay: number
}

const LAYER_COLORS = [
  { main: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.45)', badge: 'text-teal-300 border-teal-500/35 bg-teal-500/12' },
  { main: '#22d3ee', glow: 'rgba(34, 211, 238, 0.45)', badge: 'text-cyan-300 border-cyan-500/35 bg-cyan-500/12' },
  { main: '#818cf8', glow: 'rgba(129, 140, 248, 0.45)', badge: 'text-indigo-300 border-indigo-500/35 bg-indigo-500/12' },
  { main: '#a855f7', glow: 'rgba(168, 85, 247, 0.45)', badge: 'text-purple-300 border-purple-500/35 bg-purple-500/12' },
  { main: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)', badge: 'text-sky-300 border-sky-500/35 bg-sky-500/12' },
]

const LAYER_COLORS_LIGHT = [
  { main: '#0d9488', glow: 'rgba(13, 148, 136, 0.28)', badge: 'text-teal-700 border-teal-500/40 bg-teal-500/10' },
  { main: '#0284c7', glow: 'rgba(2, 132, 199, 0.28)', badge: 'text-sky-700 border-sky-500/40 bg-sky-500/10' },
  { main: '#4f46e5', glow: 'rgba(79, 70, 229, 0.28)', badge: 'text-indigo-700 border-indigo-500/40 bg-indigo-500/10' },
  { main: '#7c3aed', glow: 'rgba(124, 58, 237, 0.28)', badge: 'text-purple-700 border-purple-500/40 bg-purple-500/10' },
  { main: '#0369a1', glow: 'rgba(3, 105, 161, 0.28)', badge: 'text-cyan-700 border-cyan-500/40 bg-cyan-500/10' },
]

export function TelecomTwin3DCanvas({
  areaKind,
  features,
  visualLayers,
  animStage,
  inferring,
  result,
  phaseText,
}: TelecomTwin3DCanvasProps) {
  const { mode } = useTheme()
  const isLight = mode === 'light'
  const activeLayerColors = isLight ? LAYER_COLORS_LIGHT : LAYER_COLORS
  const [hoveredNeuron, setHoveredNeuron] = useState<PositionedNeuron | null>(null)
  const [selectedLayerIdx, setSelectedLayerIdx] = useState<number | null>(null)
  const [stageProgress, setStageProgress] = useState<number>(0)

  useEffect(() => {
    if (!inferring || animStage < 0) {
      setStageProgress(0)
      return
    }
    let rafId = 0
    const start = performance.now()
    const duration = 125

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setStageProgress(p)
      if (p < 1) {
        rafId = requestAnimationFrame(tick)
      }
    }

    setStageProgress(0)
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [inferring, animStage])

  const latency = Number(features.latencia_promedio_ms ?? features.avg_latency_ms ?? 28)
  const packetLoss = Number(features.perdida_paquetes_pct ?? features.packet_loss_pct ?? 0.5)
  const supportCalls = Number(features.llamadas_soporte ?? features.support_calls ?? 1)
  const satisfaction = Number(features.puntaje_satisfaccion ?? features.satisfaction_score ?? 7.5)
  const devices = Math.max(
    1,
    Math.min(8, Math.round(Number(features.dispositivos_conectados ?? features.devices_connected ?? 4)))
  )

  const tempC = Number(features.temperatura_equipo_c ?? 48)
  const cpuPct = Number(features.uso_cpu_pct ?? 52)
  const memPct = Number(features.uso_memoria_pct ?? 58)
  const optPower = Number(features.potencia_optica_dbm ?? -16.5)
  const crcErrs = Number(features.errores_crc_hora ?? 3)

  const txAmount = Number(features.monto_operacion_usd ?? 95)
  const txDist = Number(features.distancia_ult_ubicacion_km ?? 25)
  const simChanges = Number(features.cambios_sim_30d ?? 0)
  const pinFails = Number(features.intentos_fallidos_pin ?? 0)
  const bioOk = String(features.verificacion_biometrica ?? 'Si') === 'Si'
  const riskPais = String(features.pais_destino_riesgo ?? 'Bajo')

  const ltvSpend = Number(features.gasto_mensual_usd ?? 90)
  const ltvServices = Math.max(1, Math.min(6, Math.round(Number(features.servicios_activos ?? 3))))
  const ltvLoyalty = Number(features.puntaje_fidelidad ?? 76)
  const ltvSegment = String(features.segmento_cliente ?? 'Profesional')

  const genArea = String(features.area_corporativa ?? 'retencion')
  const genMag = Number(features.indice_magnitud_area ?? 0.35)
  const genVol = Number(features.indice_volatilidad_area ?? 0.72)
  const genPeak = Number(features.indice_pico_maximo_area ?? 1.45)

  const prob = result?.probability ?? null
  const predText = String(result?.prediction ?? '').toLowerCase()

  const riskTone: 'high' | 'medium' | 'low' = (() => {
    if (areaKind === 'comercial') {
      const val = Number(result?.prediction ?? ltvSpend * 12)
      return val >= 2400 ? 'low' : val >= 1100 ? 'medium' : 'high'
    }
    if (areaKind === 'noc') {
      if (predText.includes('falla') || predText.includes('crit')) return 'high'
      if (predText.includes('degrad')) return 'medium'
      if (result) return 'low'
      return tempC > 68 || cpuPct > 82 || crcErrs > 8 ? 'high' : tempC > 55 ? 'medium' : 'low'
    }
    if (areaKind === 'antifraude') {
      if (prob !== null) return prob >= 0.6 ? 'high' : prob >= 0.35 ? 'medium' : 'low'
      return simChanges >= 2 || pinFails >= 3 || riskPais === 'Alto' ? 'high' : !bioOk ? 'medium' : 'low'
    }
    if (areaKind === 'general') {
      if (prob !== null) return prob >= 0.55 ? 'high' : prob >= 0.35 ? 'medium' : 'low'
      return genPeak > 2.2 || genMag > 1.2 ? 'high' : genVol > 1.0 ? 'medium' : 'low'
    }
    if (prob !== null) return prob >= 0.6 ? 'high' : prob >= 0.38 ? 'medium' : 'low'
    return satisfaction < 5 || supportCalls >= 4 ? 'high' : satisfaction < 7 ? 'medium' : 'low'
  })()

  const auraRgb =
    areaKind === 'comercial'
      ? { r: 245, g: 158, b: 11, hex: '#fbbf24', label: 'PROYECCIÓN FINANCIERA LTV' }
      : riskTone === 'high'
        ? {
            r: 244,
            g: 63,
            b: 94,
            hex: '#f43f5e',
            label:
              areaKind === 'general'
                ? 'ALERTA CORPORATIVA 360°'
                : areaKind === 'noc'
                  ? 'FALLA CRÍTICA DE RED'
                  : areaKind === 'antifraude'
                    ? 'ALERTA DE FRAUDE / SIM-SWAP'
                    : 'ALERTA CRÍTICA DE FUGA',
          }
        : riskTone === 'medium'
          ? { r: 245, g: 158, b: 11, hex: '#f59e0b', label: 'ATENCIÓN PREVENTIVA' }
          : {
              r: 16,
              g: 185,
              b: 129,
              hex: '#10b981',
              label:
                areaKind === 'general'
                  ? 'ECOSISTEMA 360° ESTABLE'
                  : areaKind === 'noc'
                    ? 'NODO 5G OPERATIVO'
                    : areaKind === 'antifraude'
                      ? 'OPERACIÓN LEGÍTIMA SEGURA'
                      : 'CLIENTE ESTABLE',
            }

  const featureKeys = useMemo(() => Object.keys(features).slice(0, 8), [features])

  const { layersNodes, edges, viewBoxW, viewBoxH } = useMemo(() => {
    const vbW = 920
    const vbH = 385
    const padX = 94
    const topY = 58
    const botY = 304
    const usableH = botY - topY

    const nL = Math.max(2, visualLayers.length)
    const stepX = (vbW - padX * 2) / (nL - 1)

    const builtLayers: PositionedNeuron[][] = []

    visualLayers.forEach((layer, lIdx) => {
      const isInput = lIdx === 0
      const isOutput = lIdx === nL - 1
      const x = padX + lIdx * stepX

      const rawCount = layer.neurons?.length || layer.units || 6
      const count = isOutput
        ? Math.min(3, Math.max(1, layer.units || 1))
        : isInput
          ? Math.min(7, Math.max(5, rawCount))
          : Math.min(7, Math.max(4, rawCount))

      const palette = isOutput
        ? { main: auraRgb.hex, glow: `rgba(${auraRgb.r}, ${auraRgb.g}, ${auraRgb.b}, ${isLight ? 0.34 : 0.55})` }
        : activeLayerColors[lIdx % activeLayerColors.length]

      const colSpanH = count === 1 ? 0 : usableH * (count <= 3 ? 0.45 : count <= 5 ? 0.76 : 0.92)
      const startY = (topY + botY) / 2 - colSpanH / 2
      const stepY = count > 1 ? colSpanH / (count - 1) : 0

      const list: PositionedNeuron[] = []
      for (let i = 0; i < count; i++) {
        const y = count === 1 ? (topY + botY) / 2 : startY + i * stepY
        const rawAct =
          layer.neurons?.[i] ??
          (isOutput
            ? (result?.probability ?? 0.78)
            : 0.42 + ((i * 19 + lIdx * 13) % 48) / 100)
        const act = Math.max(0.18, Math.min(1, Number(rawAct)))
        const label = isInput
          ? featureKeys[i] || `x_${i + 1}`
          : isOutput
            ? result?.predicted_label || 'ŷ (Output)'
            : `h_${lIdx},${i + 1}`

        list.push({
          id: `n-${lIdx}-${i}`,
          layerIdx: lIdx,
          neuronIdx: i,
          x,
          y,
          activation: act,
          color: palette.main,
          glowColor: palette.glow,
          isOutput,
          isInput,
          label,
        })
      }
      builtLayers.push(list)
    })

    const builtEdges: SynapseEdge[] = []
    for (let l = 0; l < builtLayers.length - 1; l++) {
      const src = builtLayers[l]
      const dst = builtLayers[l + 1]
      src.forEach((a, i) => {
        dst.forEach((b, j) => {
          const dx = b.x - a.x
          const dy = b.y - a.y
          const isHorizontal = Math.abs(dy) < 1
          const c1x = a.x + dx * 0.42
          const c2x = a.x + dx * 0.58
          const c1y = isHorizontal ? a.y - 0.35 : a.y
          const c2y = isHorizontal ? b.y + 0.35 : b.y
          const path = `M ${a.x} ${a.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${b.x} ${b.y}`
          const weight = Math.min(1, Math.max(0.2, (a.activation + b.activation) * 0.5))
          const showPulse = (i + j) % 2 === 0 || dst.length === 1
          builtEdges.push({
            id: `e-${l}-${i}-${j}`,
            srcLayer: l,
            dstLayer: l + 1,
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            path,
            weight,
            color: b.color,
            showPulse,
            pulseDelay: ((i * 7 + j * 11) % 5) * 0.045,
          })
        })
      })
    }

    return {
      layersNodes: builtLayers,
      edges: builtEdges,
      viewBoxW: vbW,
      viewBoxH: vbH,
    }
  }, [
    visualLayers,
    activeLayerColors,
    isLight,
    auraRgb.hex,
    auraRgb.r,
    auraRgb.g,
    auraRgb.b,
    featureKeys,
    result?.probability,
    result?.predicted_label,
  ])

  const cubicPoint = (t: number, p0: number, p1: number, p2: number, p3: number) => {
    const u = 1 - t
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  }

  const activeStageEdges = useMemo(() => {
    if (!inferring || animStage < 0) return []
    const activeSrcLayer = Math.min(animStage, Math.max(0, visualLayers.length - 2))
    return edges.filter(e => e.srcLayer === activeSrcLayer && e.showPulse)
  }, [inferring, animStage, visualLayers.length, edges])

  return (
    <div className="nl-cyber-panel animate-card-reveal rounded-2xl overflow-hidden relative flex-1 flex flex-col">
      <div className="flex flex-wrap 2xl:flex-nowrap items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-800/80 bg-slate-900/85">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0"
            style={{
              backgroundColor: `rgba(${auraRgb.r}, ${auraRgb.g}, ${auraRgb.b}, 0.16)`,
              borderColor: `rgba(${auraRgb.r}, ${auraRgb.g}, ${auraRgb.b}, 0.45)`,
              color: auraRgb.hex,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: auraRgb.hex }} />
            GRAFO NEURONAL KERAS · {auraRgb.label}
          </span>
          <InfoTip
            title="Arquitectura de Red Neuronal en Tiempo Real"
            text="Visualización de la arquitectura neuronal real (Entrada → Capas Ocultas → Neurona de Salida). Los pulsos de activación viajan exactamente por las conexiones sinápticas únicamente cuando ejecutas una inferencia."
            size="xs"
          />
          <span className="text-[11px] font-mono text-slate-300 truncate" title={phaseText}>
            {phaseText}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedLayerIdx(null)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-mono border transition-colors ${
              selectedLayerIdx === null
                ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span>Todas las Capas</span>
          </button>

          {visualLayers.map((l, idx) => (
            <button
              key={`${l.name}-${idx}`}
              type="button"
              onClick={() => setSelectedLayerIdx(prev => (prev === idx ? null : idx))}
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-mono border transition-colors ${
                selectedLayerIdx === idx || (inferring && animStage === idx)
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              <span>L{idx}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setSelectedLayerIdx(null)
              setHoveredNeuron(null)
            }}
            className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10.5px] font-mono bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Restablecer vista"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div
        className={`relative flex-1 min-h-[325px] sm:min-h-[355px] flex items-center justify-center overflow-hidden ${
          isLight
            ? 'bg-gradient-to-b from-slate-50 via-sky-50/60 to-indigo-50/45'
            : 'bg-gradient-to-b from-slate-950/95 via-[#061024] to-slate-950/95'
        }`}
      >
        <div
          className={`pointer-events-none absolute inset-0 ${isLight ? 'opacity-45' : 'opacity-25'}`}
          style={{
            backgroundImage: isLight
              ? 'radial-gradient(circle at 1px 1px, rgba(2, 132, 199, 0.16) 1px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.22) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <svg
          viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
          className="w-full h-full max-h-[375px] select-none relative z-10"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="nl-neuron-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient
              id="nl-active-beam"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={viewBoxW}
              y2="0"
            >
              <stop offset="0%" stopColor={isLight ? '#0d9488' : '#2dd4bf'} stopOpacity="0.95" />
              <stop offset="50%" stopColor={isLight ? '#0284c7' : '#22d3ee'} stopOpacity="0.98" />
              <stop offset="100%" stopColor={auraRgb.hex} stopOpacity="0.98" />
            </linearGradient>
          </defs>

          {visualLayers.map((layer, lIdx) => {
            const colNodes = layersNodes[lIdx] || []
            if (colNodes.length === 0) return null
            const cx = colNodes[0].x
            const isStageActive = inferring && animStage === lIdx
            const isFocused = selectedLayerIdx === null || selectedLayerIdx === lIdx
            const palette =
              lIdx === visualLayers.length - 1
                ? { main: auraRgb.hex }
                : activeLayerColors[lIdx % activeLayerColors.length]

            return (
              <g key={`col-bg-${lIdx}`} opacity={isFocused ? 1 : 0.28}>
                <rect
                  x={cx - 38}
                  y={22}
                  width={76}
                  height={viewBoxH - 68}
                  rx={16}
                  fill={
                    isLight
                      ? isStageActive
                        ? 'rgba(14, 165, 233, 0.12)'
                        : 'rgba(255, 255, 255, 0.86)'
                      : isStageActive
                        ? 'rgba(34, 211, 238, 0.09)'
                        : 'rgba(15, 23, 42, 0.45)'
                  }
                  stroke={
                    isStageActive
                      ? palette.main
                      : isLight
                        ? 'rgba(148, 163, 184, 0.48)'
                        : 'rgba(51, 65, 85, 0.45)'
                  }
                  strokeWidth={isStageActive ? 1.8 : 1}
                  strokeDasharray={lIdx === 0 || lIdx === visualLayers.length - 1 ? undefined : '4 3'}
                />
                <text
                  x={cx}
                  y={38}
                  textAnchor="middle"
                  fill={isStageActive ? (isLight ? '#0f172a' : '#ffffff') : palette.main}
                  className="text-[9.5px] font-mono font-bold uppercase"
                >
                  {lIdx === 0
                    ? 'INPUT'
                    : lIdx === visualLayers.length - 1
                      ? 'OUTPUT'
                      : `HIDDEN L${lIdx}`}
                </text>
                <text
                  x={cx}
                  y={50}
                  textAnchor="middle"
                  fill={isLight ? '#475569' : '#94a3b8'}
                  className="text-[8.5px] font-mono"
                >
                  {layer.type === 'BatchNormalization' ? 'BatchNorm' : layer.type} · {layer.units}u
                </text>
                <text
                  x={cx}
                  y={viewBoxH - 54}
                  textAnchor="middle"
                  fill={isLight ? '#64748b' : '#64748b'}
                  className="text-[8.5px] font-mono"
                >
                  {layer.activation}
                </text>
              </g>
            )
          })}

          <g>
            {edges.map(edge => {
              const isNeuronConnected =
                hoveredNeuron &&
                ((hoveredNeuron.layerIdx === edge.srcLayer &&
                  edge.id.startsWith(`e-${edge.srcLayer}-${hoveredNeuron.neuronIdx}-`)) ||
                  (hoveredNeuron.layerIdx === edge.dstLayer &&
                    edge.id.endsWith(`-${hoveredNeuron.neuronIdx}`)))

              const isLayerStage =
                inferring && animStage === edge.srcLayer

              const isLayerSelected =
                selectedLayerIdx !== null &&
                (selectedLayerIdx === edge.srcLayer || selectedLayerIdx === edge.dstLayer)

              const dimmed =
                (hoveredNeuron && !isNeuronConnected) ||
                (selectedLayerIdx !== null && !isLayerSelected)

              const strokeOpacity = dimmed
                ? isLight ? 0.06 : 0.04
                : isNeuronConnected
                  ? 0.92
                  : isLayerStage
                    ? 0.78
                    : (isLight ? 0.2 : 0.14) + edge.weight * (isLight ? 0.22 : 0.16)

              const strokeW = isNeuronConnected
                ? 2.1
                : isLayerStage
                  ? 1.75
                  : 0.75 + edge.weight * 0.65

              return (
                <path
                  key={edge.id}
                  d={edge.path}
                  fill="none"
                  stroke={isNeuronConnected || isLayerStage ? 'url(#nl-active-beam)' : edge.color}
                  strokeWidth={strokeW}
                  strokeOpacity={strokeOpacity}
                />
              )
            })}
          </g>

          {inferring && activeStageEdges.length > 0 && (
            <g>
              {activeStageEdges.map(edge => {
                const localT = Math.min(1, Math.max(0, (stageProgress - edge.pulseDelay) / (1 - edge.pulseDelay)))
                if (localT <= 0 || localT >= 1) return null
                const dx = edge.x2 - edge.x1
                const c1x = edge.x1 + dx * 0.42
                const c2x = edge.x1 + dx * 0.58
                const px = cubicPoint(localT, edge.x1, c1x, c2x, edge.x2)
                const py = cubicPoint(localT, edge.y1, edge.y1, edge.y2, edge.y2)

                return (
                  <g key={`pulse-${edge.id}`} transform={`translate(${px}, ${py})`}>
                    <circle r={6.5} fill={edge.color} opacity={isLight ? 0.28 : 0.32} />
                    <circle r={3.2} fill={isLight ? edge.color : '#ffffff'} filter={isLight ? undefined : 'url(#nl-neuron-glow)'} />
                  </g>
                )
              })}
            </g>
          )}

          <g>
            {layersNodes.flat().map(node => {
              const isStageActive = inferring && animStage === node.layerIdx
              const isHovered = hoveredNeuron?.id === node.id
              const isFocused =
                selectedLayerIdx === null || selectedLayerIdx === node.layerIdx
              const baseR = node.isOutput ? 16.5 : node.isInput ? 11 : 12
              const r = isHovered ? baseR + 2.5 : isStageActive ? baseR + 1.8 : baseR

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  opacity={isFocused ? 1 : 0.3}
                  onMouseEnter={() => setHoveredNeuron(node)}
                  onMouseLeave={() => setHoveredNeuron(null)}
                >
                  {(isStageActive || isHovered || node.isOutput) && (
                    <circle
                      r={r + 5.5}
                      fill="none"
                      stroke={node.color}
                      strokeWidth={isStageActive || isHovered ? 1.8 : 1.1}
                      strokeOpacity={isStageActive || isHovered ? 0.8 : 0.4}
                      strokeDasharray={node.isOutput ? '3 2' : undefined}
                    />
                  )}

                  <circle
                    r={r + 2.8}
                    fill={node.glowColor}
                    opacity={isStageActive || isHovered ? (isLight ? 0.45 : 0.58) : (isLight ? 0.12 : 0.16) + node.activation * (isLight ? 0.18 : 0.24)}
                  />

                  <circle
                    r={r}
                    fill={isLight ? (node.isOutput ? node.color : '#ffffff') : '#071126'}
                    stroke={node.color}
                    strokeWidth={isHovered || isStageActive ? 2.6 : 1.8}
                    filter={!isLight && (isStageActive || node.isOutput) ? 'url(#nl-neuron-glow)' : undefined}
                  />

                  <circle
                    r={Math.max(3, r * (0.35 + node.activation * 0.42))}
                    fill={node.color}
                    opacity={isLight ? (node.isOutput ? 0.2 : 0.14 + node.activation * 0.16) : 0.75 + node.activation * 0.25}
                  />

                  <text
                    y={2.8}
                    textAnchor="middle"
                    fill={isLight ? (node.isOutput ? '#ffffff' : '#0f172a') : '#ffffff'}
                    className="text-[7.5px] font-mono font-bold pointer-events-none"
                  >
                    {node.isOutput && result?.probability !== null && result?.probability !== undefined
                      ? `${Math.round(result.probability * 100)}%`
                      : node.activation.toFixed(2)}
                  </text>

                  {node.isInput && node.label && (
                    <text
                      x={-17}
                      y={3}
                      textAnchor="end"
                      fill={isLight ? '#334155' : '#94a3b8'}
                      className="text-[8.5px] font-mono"
                    >
                      {node.label.length > 12 ? `${node.label.slice(0, 12)}…` : node.label}
                    </text>
                  )}

                  {node.isOutput && (
                    <text
                      x={23}
                      y={4}
                      textAnchor="start"
                      fill={node.color}
                      className="text-[10px] font-mono font-extrabold"
                    >
                      {result?.predicted_label || 'Salida'}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute top-2.5 left-3 flex flex-wrap items-center gap-1.5 text-[10px] font-mono z-30">
          {areaKind === 'retencion' && (
            <div className="bg-slate-950/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 shadow-sm">
              Ping: <strong className={latency > 45 ? 'text-rose-400' : 'text-teal-300'}>{latency}ms</strong> · Pérdida:{' '}
              <strong className={packetLoss > 1.5 ? 'text-rose-400' : 'text-cyan-300'}>{packetLoss}%</strong> · Disp:{' '}
              <strong className="text-sky-300">{devices}</strong> · Reclamos:{' '}
              <strong className={supportCalls >= 3 ? 'text-rose-400' : 'text-emerald-300'}>{supportCalls}</strong> · Satisf:{' '}
              <strong className={satisfaction < 6 ? 'text-amber-400' : 'text-emerald-300'}>{satisfaction}/10</strong>
            </div>
          )}
          {areaKind === 'noc' && (
            <div className="bg-slate-950/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 shadow-sm">
              Temp: <strong className={tempC > 65 ? 'text-rose-400' : 'text-teal-300'}>{tempC}°C</strong> · CPU:{' '}
              <strong className={cpuPct > 80 ? 'text-amber-400' : 'text-cyan-300'}>{cpuPct}%</strong> · RAM:{' '}
              <strong className="text-indigo-300">{memPct}%</strong> · Óptica:{' '}
              <strong className="text-teal-300">{optPower}dBm</strong> · CRC:{' '}
              <strong className={crcErrs > 7 ? 'text-rose-400' : 'text-emerald-300'}>{crcErrs}/h</strong>
            </div>
          )}
          {areaKind === 'antifraude' && (
            <div className="bg-slate-950/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 shadow-sm">
              Monto: <strong className="text-amber-300">${txAmount}</strong> · Dist:{' '}
              <strong className={txDist > 500 ? 'text-rose-400' : 'text-cyan-300'}>{txDist}km</strong> · SIMs:{' '}
              <strong className={simChanges >= 1 ? 'text-rose-400' : 'text-emerald-300'}>{simChanges}</strong> · Biometría:{' '}
              <strong className={bioOk ? 'text-emerald-300' : 'text-rose-400'}>{bioOk ? 'OK' : 'No'}</strong>
            </div>
          )}
          {areaKind === 'comercial' && (
            <div className="bg-slate-950/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 shadow-sm">
              Gasto: <strong className="text-amber-300">${ltvSpend}/m</strong> · Servicios:{' '}
              <strong className="text-teal-300">{ltvServices}</strong> · Seg:{' '}
              <strong className="text-indigo-300">{ltvSegment}</strong> · Fidelidad:{' '}
              <strong className="text-emerald-300">{ltvLoyalty}/100</strong>
            </div>
          )}
          {areaKind === 'general' && (
            <div className="bg-slate-950/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 shadow-sm">
              Área: <strong className="text-teal-300">{genArea.toUpperCase()}</strong> · Mag Z:{' '}
              <strong className="text-cyan-300">{genMag.toFixed(2)}</strong> · Vol:{' '}
              <strong className={genVol > 1.2 ? 'text-rose-400' : 'text-indigo-300'}>{genVol.toFixed(2)}</strong> · Pico:{' '}
              <strong className={genPeak > 2.2 ? 'text-rose-400' : 'text-emerald-300'}>{genPeak.toFixed(2)}σ</strong>
            </div>
          )}
        </div>

        {hoveredNeuron && (
          <div className="pointer-events-none absolute top-2.5 right-3 bg-slate-950/95 border border-cyan-500/40 rounded-xl px-3 py-1.5 text-[10.5px] font-mono text-slate-200 shadow-lg z-30 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div>
              <span className="text-cyan-300 font-bold">
                {visualLayers[hoveredNeuron.layerIdx]?.name || `Capa L${hoveredNeuron.layerIdx}`}
              </span>{' '}
              · Neurona #{hoveredNeuron.neuronIdx + 1} ({hoveredNeuron.label}) · Activación:{' '}
              <strong className="text-white">{(hoveredNeuron.activation * 100).toFixed(1)}%</strong>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono z-30">
          <div className="hidden sm:flex items-center gap-1.5 text-slate-300 bg-slate-950/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 shadow-sm">
            <Cpu className="w-3 h-3 text-teal-400" />
            <span>
              Topología: <strong className="text-cyan-300">{visualLayers.length} capas</strong> ·{' '}
              <strong className="text-indigo-300">
                {visualLayers.reduce((acc, l) => acc + (l.units || 0), 0)} unidades
              </strong>{' '}
              · <strong className="text-emerald-300">{edges.length} sinapsis</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-950/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 shadow-sm shrink-0 ml-auto">
            {inferring ? (
              <>
                <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
                <span className="text-amber-300 font-bold">
                  Propagando Tensores por L{animStage} → L{Math.min(visualLayers.length - 1, animStage + 1)}...
                </span>
              </>
            ) : (
              <>
                <Activity className="w-3 h-3 text-cyan-400" />
                <span>Pasa el cursor por las neuronas · Pulsa «Ejecutar Inferencia» para animar</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
