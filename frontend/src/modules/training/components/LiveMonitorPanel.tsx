import type { RefObject } from 'react'
import { XCircle } from 'lucide-react'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import { STATUS_BADGE, STATUS_LABEL } from '../constants'

export interface LiveTrainingMetrics {
  epoch: number
  loss: number
  acc: number
  val_loss: number
  val_acc: number
}

interface LiveMonitorPanelProps {
  monitorJobId: string
  liveStatus: string
  liveProgress: number
  liveMetrics: LiveTrainingMetrics | null
  liveLog: string[]
  logRef: RefObject<HTMLDivElement | null>
  onClose: () => void
}

export function LiveMonitorPanel({
  monitorJobId,
  liveStatus,
  liveProgress,
  liveMetrics,
  liveLog,
  logRef,
  onClose,
}: LiveMonitorPanelProps) {
  const metricCards = liveMetrics
    ? [
        { label: 'Época', value: String(liveMetrics.epoch), tone: 'text-white' },
        { label: 'Loss', value: liveMetrics.loss.toFixed(4), tone: 'text-rose-300' },
        { label: 'Accuracy', value: (liveMetrics.acc * 100).toFixed(2) + '%', tone: 'text-emerald-300' },
        { label: 'Val. Loss', value: liveMetrics.val_loss.toFixed(4), tone: 'text-amber-300' },
        { label: 'Val. Acc.', value: (liveMetrics.val_acc * 100).toFixed(2) + '%', tone: 'text-cyan-300' },
      ]
    : []

  return (
    <div className="nl-cyber-panel rounded-2xl p-4 animate-card-reveal relative overflow-hidden space-y-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-rose-400/80 via-indigo-400/75 to-cyan-400/80" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_#fb7185]" />
          <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
            <span>Monitoreo en Vivo</span>
            <InfoTip
              title="Stream SSE en Tiempo Real"
              text="Recibe métricas época por época directamente desde TensorFlow mediante Server-Sent Events sin recargar la vista."
              size="xs"
            />
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-indigo-300 font-mono">
            {monitorJobId}
          </span>
          {liveStatus && (
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${
                STATUS_BADGE[liveStatus] || 'bg-slate-700 text-slate-400 border-slate-600'
              }`}
            >
              {STATUS_LABEL[liveStatus] || liveStatus}
            </span>
          )}
        </div>
        <SystemTooltip label="Cerrar panel de monitoreo" side="bottom">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Cerrar monitor"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </SystemTooltip>
      </div>

      <div>
        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
          <span>Progreso</span>
          <span className="font-mono font-bold text-cyan-300">{liveProgress.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full nl-progress-shimmer bg-gradient-to-r from-indigo-500 via-cyan-400 to-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(100, liveProgress))}%` }}
          />
        </div>
      </div>

      {metricCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {metricCards.map(({ label, value, tone }) => (
            <div
              key={label}
              className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-center"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
              <p className={`font-bold font-mono text-sm mt-0.5 ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-[#03070f] overflow-hidden">
        <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-900/70 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-400/80" />
          <span className="w-2 h-2 rounded-full bg-amber-400/80" />
          <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-[10px] font-mono text-slate-400">worker · consola de entrenamiento</span>
        </div>
        <div
          ref={logRef}
          className="p-3 h-40 overflow-y-auto font-mono text-xs text-emerald-400 space-y-0.5"
        >
          {liveLog.length === 0 ? (
            <span className="text-slate-500">Esperando datos del worker...</span>
          ) : (
            liveLog.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
      </div>
    </div>
  )
}
