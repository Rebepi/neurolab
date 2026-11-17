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
  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-indigo-700/40 rounded-xl p-5 animate-card-reveal nl-accent-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <h3 className="text-white font-semibold text-sm flex items-center gap-1.5">
            <span>Monitoreo en Vivo</span>
            <InfoTip
              title="Stream SSE en Tiempo Real"
              text="Recibe métricas época por época directamente desde TensorFlow mediante Server-Sent Events sin recargar la vista."
              size="xs"
            />
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
            {monitorJobId}
          </span>
          {liveStatus && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                STATUS_BADGE[liveStatus] || 'bg-slate-700 text-slate-400 border-slate-600'
              }`}
            >
              {STATUS_LABEL[liveStatus] || liveStatus}
            </span>
          )}
        </div>
        <SystemTooltip label="Cerrar panel de monitoreo" side="bottom">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Cerrar monitor"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </SystemTooltip>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Progreso</span>
          <span className="font-mono font-bold text-indigo-300">{liveProgress.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full nl-progress-shimmer bg-gradient-to-r from-indigo-500 via-cyan-400 to-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${liveProgress}%` }}
          />
        </div>
      </div>

      {liveMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Época', value: liveMetrics.epoch },
            { label: 'Loss', value: liveMetrics.loss.toFixed(4) },
            { label: 'Accuracy', value: (liveMetrics.acc * 100).toFixed(2) + '%' },
            { label: 'Val. Loss', value: liveMetrics.val_loss.toFixed(4) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800/60 rounded-lg px-3 py-2 text-center">
              <p className="text-slate-500 text-xs">{label}</p>
              <p className="text-indigo-300 font-bold font-mono text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div ref={logRef} className="bg-black rounded-xl p-4 h-44 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5">
        {liveLog.length === 0 ? (
          <span className="text-slate-600">Esperando datos del worker...</span>
        ) : (
          liveLog.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
    </div>
  )
}

