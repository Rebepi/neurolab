import { Lock } from 'lucide-react'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import type { InspectDataState } from '../types'

interface NeuronInspectorTabProps {
  inspectData: InspectDataState
  layerCount: number
  hasSelectedNeuron: boolean
  onClearSelection: () => void
}

export function NeuronInspectorTab({
  inspectData,
  layerCount,
  hasSelectedNeuron,
  onClearSelection,
}: NeuronInspectorTabProps) {
  if (!inspectData.node) {
    return (
      <p className="text-xs text-slate-400">
        Haz clic en cualquier neurona del lienzo para inspeccionar sus pesos reales extraídos de Keras.
      </p>
    )
  }

  const node = inspectData.node

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
            {node.layerIdx === 0
              ? 'Neurona de Entrada'
              : node.layerIdx === layerCount - 1
                ? 'Neurona de Salida'
                : `Neurona de Capa Oculta H${node.layerIdx}`}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className="text-base font-extrabold text-white">
              Nodo {node.label}
            </h3>
            {hasSelectedNeuron && (
              <SystemTooltip label="Quitar selección fija en el lienzo" side="bottom">
                <button
                  onClick={onClearSelection}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 transition-all"
                >
                  ✕ Deseleccionar
                </button>
              </SystemTooltip>
            )}
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-[10px] font-mono font-bold text-teal-300">
          <Lock className="w-3 h-3" />
          PESOS REALES
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1">
            <span>Suma (z)</span>
            <InfoTip text="Suma ponderada de todas las entradas más el sesgo: z = Σ(w·x) + b antes de activar." size="xs" />
          </p>
          <p className="text-sm font-extrabold font-mono text-cyan-400 mt-0.5">
            {node.z.toFixed(3)}
          </p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1">
            <span>Salida (a)</span>
            <InfoTip text="Activación real emitida por la neurona tras aplicar su función f(z) hacia la siguiente capa." size="xs" />
          </p>
          <p className="text-sm font-extrabold font-mono text-emerald-400 mt-0.5">
            {node.activation.toFixed(3)}
          </p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1">
            <span>Sesgo (b)</span>
            <InfoTip text="Sesgo entrenado en TensorFlow/Keras para este nodo." size="xs" />
          </p>
          <p className="text-sm font-extrabold font-mono text-indigo-400 mt-0.5">
            {node.bias.toFixed(3)}
          </p>
        </div>
      </div>

      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 space-y-1">
        <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <span>Cálculo Forward Pass en este Nodo:</span>
          <InfoTip text="Evaluación algebraica ejecutada con los pesos reales W y sesgo b del modelo entrenado." size="xs" />
        </p>
        <p>1. z = Σ(w · x) + b = <strong>{node.z.toFixed(4)}</strong></p>
        <p>
          2. a = {inspectData.layerAct.toUpperCase()}(z) ={' '}
          <strong className="text-emerald-400">{node.activation.toFixed(4)}</strong>
        </p>
      </div>

      <div>
        <p className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
          <span>
            Sinapsis Entrantes Reales ({inspectData.incomingCount})
            {inspectData.incomingCount > 24 && (
              <span className="ml-1.5 font-normal text-slate-400">· top 24 por aporte |w·a|</span>
            )}
          </span>
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {inspectData.incomingCount === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-3">
              Esta es una neurona de la <strong>Capa de Entrada</strong>: recibe directamente la variable normalizada del dataset. Haz clic en cualquier neurona de una <strong>Capa Oculta</strong> para inspeccionar sus pesos reales de Keras.
            </p>
          ) : (
            inspectData.incoming.map(inc => (
              <div key={inc.fromNeuron} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white font-mono">
                    Desde {inc.fromLabel} (x={inc.inputVal.toFixed(2)})
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    aporte:{' '}
                    <strong className={inc.contribution >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {inc.contribution >= 0 ? `+${inc.contribution.toFixed(3)}` : inc.contribution.toFixed(3)}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Peso sináptico entrenado w:</span>
                  <span className={`font-bold ${inc.weight >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {inc.weight >= 0 ? `+${inc.weight.toFixed(4)}` : inc.weight.toFixed(4)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
