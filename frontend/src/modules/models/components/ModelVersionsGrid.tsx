import { Clock, Package } from 'lucide-react'
import type { ModelVersion } from '../../../types/index'

interface ModelVersionsGridProps {
  models: ModelVersion[]
  selectedModel: ModelVersion | null
  updatingId: string | null
  onSelectModel: (model: ModelVersion) => void
  onRefresh: () => void
  onStatusChange: (modelId: string, newStatus: string) => void
}

export function ModelVersionsGrid({
  models,
  selectedModel,
  updatingId,
  onSelectModel,
  onRefresh,
  onStatusChange,
}: ModelVersionsGridProps) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
      <h3 className="text-white font-bold text-base mb-4 flex items-center justify-between">
        <span>Versiones Registradas ({models.length})</span>
        <button onClick={onRefresh} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> Refrescar
        </button>
      </h3>

      {models.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aún no se han registrado modelos en este proyecto.</p>
          <p className="text-xs text-slate-600 mt-1">Completa un entrenamiento satisfactorio para que se registre la versión v1.0.0.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map(m => {
            const isSelected = selectedModel?.id === m.id
            const isApp = m.status === 'Aprobado' || m.status === 'APPROVED'

            return (
              <div
                key={m.id}
                onClick={() => onSelectModel(m)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/20 shadow-lg'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">Versión {m.version}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        isApp ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{m.dataset_name || 'Dataset'} · {m.arch_name || 'Arquitectura'}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-emerald-400 font-bold font-mono text-sm">{(m.test_metrics.test_accuracy * 100).toFixed(1)}%</p>
                    <p className="text-slate-500 text-[10px]">Test Accuracy</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-500 font-mono text-[10px]">
                    SHA: {m.checksum.slice(0, 12)}...
                  </span>

                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {!isApp ? (
                      <button
                        onClick={() => onStatusChange(m.id, 'Aprobado')}
                        disabled={updatingId === m.id}
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Aprobar
                      </button>
                    ) : (
                      <button
                        onClick={() => onStatusChange(m.id, 'Retirado')}
                        disabled={updatingId === m.id}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs transition-colors"
                      >
                        Retirar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

