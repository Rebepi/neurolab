import { Compass } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import { evalNeuronActivation, type NeuronActivation } from '../math'

interface DecisionBoundaryCardProps {
  x1: number
  x2: number
  w1: number
  w2: number
  bias: number
  activation: NeuronActivation
}

const GRID_STEPS = 12

export function DecisionBoundaryCard({
  x1,
  x2,
  w1,
  w2,
  bias,
  activation,
}: DecisionBoundaryCardProps) {
  const cells: Array<{ gx: number; gy: number; out: number; fired: boolean }> = []
  for (let row = 0; row < GRID_STEPS; row++) {
    const gy = 2 - ((row + 0.5) / GRID_STEPS) * 4
    for (let col = 0; col < GRID_STEPS; col++) {
      const gx = -2 + ((col + 0.5) / GRID_STEPS) * 4
      const zCell = gx * w1 + gy * w2 + bias
      const out = evalNeuronActivation(activation, zCell)
      const fired = activation === 'tanh' ? out > 0 : out > 0.5
      cells.push({ gx, gy, out, fired })
    }
  }

  const pxX = ((x1 + 2) / 4) * 100
  const pxY = ((2 - x2) / 4) * 100

  let lineCoords: { x1p: number; y1p: number; x2p: number; y2p: number } | null = null
  if (Math.abs(w2) > 0.05) {
    const yAtLeft = (-w1 * -2 - bias) / w2
    const yAtRight = (-w1 * 2 - bias) / w2
    lineCoords = {
      x1p: 0,
      y1p: ((2 - yAtLeft) / 4) * 100,
      x2p: 100,
      y2p: ((2 - yAtRight) / 4) * 100,
    }
  } else if (Math.abs(w1) > 0.05) {
    const xLine = -bias / w1
    const xp = ((xLine + 2) / 4) * 100
    lineCoords = { x1p: xp, y1p: 0, x2p: xp, y2p: 100 }
  }

  return (
    <div className="bg-slate-950/65 border border-cyan-500/20 rounded-xl p-4 space-y-3 shadow-inner">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white">Plano de Decisión 2D (x₁ vs x₂)</span>
          <InfoTip
            title="Frontera Lineal de Separación"
            text="Cada celda muestra cómo responde la neurona en todo el plano [-2, +2]². La línea punteada marca z = 0 donde cambia la activación."
            size="xs"
          />
        </div>
        <span className="text-[10px] font-mono text-slate-400">z = w₁x₁ + w₂x₂ + b = 0</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-40 h-40 shrink-0 rounded-lg overflow-hidden border border-slate-700/70 bg-slate-900">
          <div className="grid grid-cols-12 w-full h-full">
            {cells.map((c, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: c.fired
                    ? `rgba(16, 185, 129, ${Math.min(0.65, Math.max(0.18, Math.abs(c.out) * 0.55))})`
                    : 'rgba(244, 63, 94, 0.14)',
                }}
              />
            ))}
          </div>

          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
            <line x1="50" y1="0" x2="50" y2="100" stroke="#475569" strokeWidth="0.6" strokeOpacity="0.6" />
            <line x1="0" y1="50" x2="100" y2="50" stroke="#475569" strokeWidth="0.6" strokeOpacity="0.6" />
            {lineCoords && (
              <line
                x1={lineCoords.x1p}
                y1={lineCoords.y1p}
                x2={lineCoords.x2p}
                y2={lineCoords.y2p}
                stroke="#f8fafc"
                strokeWidth="1.4"
                strokeDasharray="3 2.5"
              />
            )}
            <circle cx={pxX} cy={pxY} r="4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="flex-1 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60 border border-emerald-400/50 shrink-0" />
            <span className="text-slate-300">Zona de disparo activa</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/30 border border-rose-400/40 shrink-0" />
            <span className="text-slate-400">Zona inhibida / reposo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 border border-white shrink-0" />
            <span className="text-slate-300 font-mono text-[11px]">
              Punto actual ({x1.toFixed(1)}, {x2.toFixed(1)})
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/80">
            Al variar <strong className="text-emerald-400">w₁ / w₂</strong> rotas el ángulo de la frontera; al variar <strong className="text-amber-400">b</strong> la desplazas.
          </p>
        </div>
      </div>
    </div>
  )
}

