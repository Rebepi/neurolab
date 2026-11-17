import type { EpochMetric } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'

export function MiniConvergenceChart({ metrics }: { metrics: EpochMetric[] }) {
  if (metrics.length < 2) return null

  const w = 360
  const h = 108
  const padX = 8
  const padY = 10
  const innerW = w - padX * 2
  const innerH = h - padY * 2

  const losses = metrics.flatMap(m => [m.loss, m.val_loss]).filter(Number.isFinite)
  const maxLoss = Math.max(...losses, 0.01)
  const minLoss = Math.min(...losses, 0)
  const spanLoss = Math.max(0.001, maxLoss - minLoss)

  const buildPath = (extractor: (m: EpochMetric) => number, isAcc: boolean) =>
    metrics
      .map((m, idx) => {
        const x = padX + (idx / (metrics.length - 1)) * innerW
        const val = extractor(m)
        const norm = isAcc ? Math.min(1, Math.max(0, val)) : (val - minLoss) / spanLoss
        const y = padY + (1 - norm) * innerH
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

  return (
    <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold text-slate-300 flex items-center gap-1.5">
          <span>Convergencia ({metrics.length} épocas)</span>
          <InfoTip
            text="Evolución comparativa entre exactitud de validación (verde) y pérdida de entrenamiento (ámbar) a lo largo de las épocas."
            size="xs"
          />
        </span>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-0.5 bg-emerald-400 inline-block rounded" /> Val Acc
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-0.5 bg-amber-400 inline-block rounded" /> Loss
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24 overflow-visible">
        <line x1={padX} y1={padY + innerH * 0.5} x2={w - padX} y2={padY + innerH * 0.5} stroke="#334155" strokeOpacity="0.35" strokeDasharray="3 3" />
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="#334155" strokeOpacity="0.4" />
        <path d={buildPath(m => m.loss, false)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <path d={buildPath(m => m.val_accuracy, true)} fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

