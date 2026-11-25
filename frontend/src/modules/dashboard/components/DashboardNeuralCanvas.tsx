import { useEffect, useRef, useState } from 'react'
import { Cpu, Sparkles, Network, ArrowRight, Activity } from 'lucide-react'
import { api } from '../../../services/api'
import { useTheme } from '../../../context/ThemeContext'
import { InfoTip } from '../../../components/InfoTip'

interface VisualizerState {
  dataset_name: string | null
  feature_names: string[]
  target_name: string
  trained_model: {
    model_id: string
    version: string
    test_metrics?: {
      test_accuracy?: number
      test_loss?: number
      f1_score?: number
    } | null
    layer_sizes: number[]
    layer_activations: string[]
    weights: number[][][]
    biases: number[][]
  } | null
}

interface NodePos {
  layerIdx: number
  nodeIdx: number
  x: number
  y: number
  radius: number
  label: string
  activation: string
  bias: number
}

interface Pulse {
  lIdx: number
  fromIdx: number
  toIdx: number
  t: number
  speed: number
  weight: number
}

interface DashboardNeuralCanvasProps {
  projectId?: string
  projectName?: string
  onNavigate: (module: string) => void
}

export function DashboardNeuralCanvas({
  projectId,
  projectName,
  onNavigate,
}: DashboardNeuralCanvasProps) {
  const { mode } = useTheme()
  const isLight = mode === 'light'
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [vState, setVState] = useState<VisualizerState | null>(null)
  const [hoveredNode, setHoveredNode] = useState<NodePos | null>(null)
  const nodesRef = useRef<NodePos[][]>([])
  const hoveredRef = useRef<NodePos | null>(null)

  useEffect(() => {
    if (!projectId) return
    let active = true
    api
      .getProjectVisualizerState(projectId, 7)
      .then(res => {
        if (active) setVState(res)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [projectId])

  const layerSizes = vState?.trained_model?.layer_sizes || [6, 7, 5, 1]
  const layerActs = vState?.trained_model?.layer_activations || ['linear', 'relu', 'relu', 'sigmoid']
  const weights = vState?.trained_model?.weights || null
  const biases = vState?.trained_model?.biases || null
  const featureNames = vState?.feature_names || []
  const targetName = vState?.target_name || 'fuga'
  const realAcc = vState?.trained_model?.test_metrics?.test_accuracy

  const totalNodes = layerSizes.reduce((a, b) => a + b, 0)
  const totalSynapses = layerSizes.slice(0, -1).reduce((acc, sz, idx) => acc + sz * layerSizes[idx + 1], 0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let animId = 0
    const pulses: Pulse[] = []

    const getWeight = (l: number, i: number, j: number): number => {
      const w = weights?.[l]?.[i]?.[j]
      if (typeof w === 'number' && !Number.isNaN(w)) return w
      return Math.sin((l + 1) * 3.1 + i * 1.7 + j * 2.3) * 0.85
    }

    const getBias = (l: number, j: number): number => {
      if (l === 0) return 0
      const b = biases?.[l - 1]?.[j]
      return typeof b === 'number' && !Number.isNaN(b) ? b : 0
    }

    const seedPulses = () => {
      pulses.length = 0
      for (let l = 0; l < layerSizes.length - 1; l++) {
        const count = Math.min(9, Math.max(4, layerSizes[l]))
        for (let k = 0; k < count; k++) {
          const fi = Math.floor(Math.random() * layerSizes[l])
          const ti = Math.floor(Math.random() * layerSizes[l + 1])
          pulses.push({
            lIdx: l,
            fromIdx: fi,
            toIdx: ti,
            t: Math.random(),
            speed: 0.0042 + Math.random() * 0.0045,
            weight: getWeight(l, fi, ti),
          })
        }
      }
    }
    seedPulses()

    const render = (now: number) => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const W = Math.max(320, rect.width)
      const H = Math.max(250, rect.height)
      if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
        canvas.width = Math.floor(W * dpr)
        canvas.height = Math.floor(H * dpr)
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, W, H)

      const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, 20, W * 0.5, H * 0.5, W * 0.58)
      if (isLight) {
        bgGrad.addColorStop(0, 'rgba(13, 148, 136, 0.09)')
        bgGrad.addColorStop(0.6, 'rgba(79, 70, 229, 0.04)')
        bgGrad.addColorStop(1, 'rgba(248, 250, 252, 0)')
      } else {
        bgGrad.addColorStop(0, 'rgba(13, 148, 136, 0.16)')
        bgGrad.addColorStop(0.55, 'rgba(79, 70, 229, 0.08)')
        bgGrad.addColorStop(1, 'rgba(2, 6, 23, 0)')
      }
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)

      const padX = Math.max(85, W * 0.13)
      const padTop = 40
      const padBottom = 38
      const usableW = W - padX * 2
      const usableH = H - padTop - padBottom
      const stepX = layerSizes.length > 1 ? usableW / (layerSizes.length - 1) : 0

      const grid: NodePos[][] = layerSizes.map((count, lIdx) => {
        const x = padX + lIdx * stepX
        const maxSpan = Math.min(usableH, Math.max(40, (count - 1) * 40))
        const startY = padTop + (usableH - maxSpan) / 2
        const isOutput = lIdx === layerSizes.length - 1
        return Array.from({ length: count }, (_, nIdx) => {
          const y = count === 1 ? padTop + usableH / 2 : startY + (nIdx * maxSpan) / (count - 1)
          const lbl =
            lIdx === 0
              ? featureNames[nIdx] || `x${nIdx + 1}`
              : isOutput
                ? targetName
                : `H${lIdx}.${nIdx + 1}`
          return {
            layerIdx: lIdx,
            nodeIdx: nIdx,
            x,
            y,
            radius: isOutput ? 14 : lIdx === 0 ? 10 : 9.5,
            label: lbl,
            activation: layerActs[lIdx] || 'relu',
            bias: getBias(lIdx, nIdx),
          }
        })
      })
      nodesRef.current = grid

      const hov = hoveredRef.current

      for (let l = 0; l < grid.length - 1; l++) {
        const src = grid[l]
        const dst = grid[l + 1]
        for (let i = 0; i < src.length; i++) {
          for (let j = 0; j < dst.length; j++) {
            const w = getWeight(l, i, j)
            const absW = Math.min(1.5, Math.abs(w))
            const isHighlighted =
              hov &&
              ((hov.layerIdx === l && hov.nodeIdx === i) ||
                (hov.layerIdx === l + 1 && hov.nodeIdx === j))

            const alpha = hov
              ? isHighlighted
                ? 0.88
                : 0.06
              : 0.14 + Math.min(0.44, absW * 0.36)

            ctx.beginPath()
            const cpX = (src[i].x + dst[j].x) * 0.5
            ctx.moveTo(src[i].x, src[i].y)
            ctx.bezierCurveTo(cpX, src[i].y, cpX, dst[j].y, dst[j].x, dst[j].y)
            ctx.strokeStyle =
              w >= 0
                ? `rgba(45, 212, 191, ${alpha})`
                : `rgba(244, 63, 94, ${alpha})`
            ctx.lineWidth = isHighlighted ? 2.2 : 0.7 + absW * 1.15
            ctx.stroke()
          }
        }
      }

      if (!reducedMotion) {
        for (const p of pulses) {
          p.t += p.speed
          if (p.t >= 1) {
            p.t = 0
            p.lIdx = (p.lIdx + 1) % (grid.length - 1)
            p.fromIdx = p.toIdx % grid[p.lIdx].length
            p.toIdx = Math.floor(Math.random() * grid[p.lIdx + 1].length)
            p.weight = getWeight(p.lIdx, p.fromIdx, p.toIdx)
          }
          const a = grid[p.lIdx]?.[p.fromIdx]
          const b = grid[p.lIdx + 1]?.[p.toIdx]
          if (!a || !b) continue

          const t = p.t
          const inv = 1 - t
          const cpX = (a.x + b.x) * 0.5
          const px =
            inv * inv * inv * a.x +
            3 * inv * inv * t * cpX +
            3 * inv * t * t * cpX +
            t * t * t * b.x
          const py =
            inv * inv * inv * a.y +
            3 * inv * inv * t * a.y +
            3 * inv * t * t * b.y +
            t * t * t * b.y

          const color = p.weight >= 0 ? '#5eead4' : '#fb7185'
          const glow = ctx.createRadialGradient(px, py, 0.5, px, py, 7.5)
          glow.addColorStop(0, color)
          glow.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(px, py, 7.5, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(px, py, 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const timeSec = now * 0.002
      for (let l = 0; l < grid.length; l++) {
        const layerNodes = grid[l]
        const x = layerNodes[0]?.x ?? 0
        const isInput = l === 0
        const isOutput = l === grid.length - 1

        ctx.font = '600 10px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = isLight ? '#334155' : '#94a3b8'
        const title = isInput
          ? `ENTRADA (${layerNodes.length})`
          : isOutput
            ? `SALIDA (${layerActs[l] || 'sigmoid'})`
            : `CAPA ${l} · ${(layerActs[l] || 'relu').toUpperCase()}`
        ctx.fillText(title, x, 20)

        for (const n of layerNodes) {
          const isHov = hov && hov.layerIdx === n.layerIdx && hov.nodeIdx === n.nodeIdx
          const pulseScale = reducedMotion
            ? 1
            : 1 + 0.07 * Math.sin(timeSec * 1.6 + n.layerIdx * 1.1 + n.nodeIdx * 0.7)
          const r = n.radius * (isHov ? 1.32 : pulseScale)

          const halo = ctx.createRadialGradient(n.x, n.y, r * 0.4, n.x, n.y, r * 2.5)
          if (isOutput) {
            halo.addColorStop(0, 'rgba(129, 140, 248, 0.58)')
            halo.addColorStop(1, 'rgba(129, 140, 248, 0)')
          } else if (isInput) {
            halo.addColorStop(0, 'rgba(45, 212, 191, 0.48)')
            halo.addColorStop(1, 'rgba(45, 212, 191, 0)')
          } else {
            halo.addColorStop(0, 'rgba(56, 189, 248, 0.40)')
            halo.addColorStop(1, 'rgba(56, 189, 248, 0)')
          }
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2)
          ctx.fill()

          const sphere = ctx.createRadialGradient(n.x - r * 0.35, n.y - r * 0.35, r * 0.1, n.x, n.y, r)
          if (isOutput) {
            sphere.addColorStop(0, '#c084fc')
            sphere.addColorStop(0.6, '#4f46e5')
            sphere.addColorStop(1, '#1e1b4b')
          } else if (isInput) {
            sphere.addColorStop(0, '#99f6e4')
            sphere.addColorStop(0.6, '#0d9488')
            sphere.addColorStop(1, '#134e4a')
          } else {
            sphere.addColorStop(0, '#7dd3fc')
            sphere.addColorStop(0.6, '#0284c7')
            sphere.addColorStop(1, '#0c4a6e')
          }

          ctx.fillStyle = sphere
          ctx.beginPath()
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
          ctx.fill()

          ctx.strokeStyle = isHov ? '#ffffff' : isOutput ? '#e9d5ff' : '#5eead4'
          ctx.lineWidth = isHov ? 2.2 : 1.1
          ctx.stroke()

          if (isInput && W > 520) {
            ctx.font = '500 9.5px "JetBrains Mono", monospace'
            ctx.textAlign = 'right'
            ctx.fillStyle = isHov ? (isLight ? '#0f172a' : '#ffffff') : isLight ? '#475569' : '#94a3b8'
            const shortLbl = n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label
            ctx.fillText(shortLbl, n.x - r - 8, n.y + 3)
          } else if (isOutput && W > 520) {
            ctx.font = '700 10.5px "JetBrains Mono", monospace'
            ctx.textAlign = 'left'
            ctx.fillStyle = isLight ? '#4f46e5' : '#a5b4fc'
            ctx.fillText(n.label.toUpperCase(), n.x + r + 10, n.y + 4)
          }
        }
      }

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [layerSizes.join(','), layerActs.join(','), featureNames.join(','), targetName, isLight, vState])

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let found: NodePos | null = null
    for (const layer of nodesRef.current) {
      for (const n of layer) {
        const dx = mx - n.x
        const dy = my - n.y
        if (dx * dx + dy * dy <= (n.radius + 8) * (n.radius + 8)) {
          found = n
          break
        }
      }
      if (found) break
    }
    hoveredRef.current = found
    setHoveredNode(found)
  }

  return (
    <div className="nl-surface rounded-2xl overflow-hidden border border-indigo-500/35 shadow-2xl relative animate-card-reveal">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/65">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/25 to-indigo-500/30 border border-teal-400/35 flex items-center justify-center shadow-lg shadow-teal-500/10">
            <Network className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <span>Topología Neuronal & Conexiones Sinápticas Reales</span>
                <InfoTip
                  title="Mapa Vivo de Pesos Reales Keras"
                  text="Visualiza las neuronas de entrada, capas ocultas y salida del modelo entrenado en el área activa. Las líneas turquesa representan pesos positivos (w > 0) y las rojas pesos inhibitorios (w < 0). Pasa el cursor por cualquier neurona para ver su sesgo b."
                  size="xs"
                />
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/35 text-[10px] font-mono font-bold text-teal-300">
                <Activity className="w-3 h-3 animate-pulse" />
                {vState?.trained_model
                  ? `KERAS ${vState.trained_model.version}${
                      realAcc !== undefined ? ` · ${(realAcc * 100).toFixed(1)}% Score` : ''
                    }`
                  : 'SIN MODELO ENTRENADO AÚN'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Área activa: <strong className="text-slate-200">{projectName || 'Aura Telecom'}</strong> · Dataset:{' '}
              <strong className="text-cyan-300">{vState?.dataset_name || 'Pendiente'}</strong> ·{' '}
              <span className="font-mono text-slate-300">
                {totalNodes} neuronas · {totalSynapses} sinapsis ponderadas
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate(vState?.trained_model ? 'inference' : 'training')}
            className="nl-btn-shimmer flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{vState?.trained_model ? 'Inferencia en Vivo' : 'Entrenar Red Ahora'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigate('visualizer')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Motor Sináptico</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            hoveredRef.current = null
            setHoveredNode(null)
          }}
          className="w-full h-[300px] sm:h-[330px] block cursor-crosshair"
        />

        <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap items-center gap-3 text-[10px] font-mono bg-slate-950/85 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="flex items-center gap-1.5 text-teal-300">
            <span className="w-3 h-0.5 bg-teal-400 inline-block" /> Peso w &gt; 0 (Excitatorio)
          </span>
          <span className="flex items-center gap-1.5 text-rose-300">
            <span className="w-3 h-0.5 bg-rose-400 inline-block" /> Peso w &lt; 0 (Inhibitorio)
          </span>
          <span className="text-slate-400 hidden sm:inline">Inspecciona cualquier neurona con el cursor</span>
        </div>

        {hoveredNode && (
          <div className="pointer-events-none absolute bottom-3 right-4 bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 rounded-xl px-3.5 py-2 text-[11px] font-mono shadow-xl">
            <p className="text-cyan-300 font-bold">{hoveredNode.label}</p>
            <p className="text-slate-300">
              Capa {hoveredNode.layerIdx} · act: <span className="text-indigo-300">{hoveredNode.activation}</span> · bias b:{' '}
              <span className="text-amber-300">{hoveredNode.bias.toFixed(4)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
