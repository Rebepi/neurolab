import { Zap } from 'lucide-react'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import type { InspectDataState } from '../types'

interface NeuronInspectorTabProps {
  inspectData: InspectDataState
  layerCount: number
  hasSelectedNeuron: boolean
  onClearSelection: () => void
  onStepGradient: () => void
  onBiasChange: (val: number) => void
  onWeightChange: (fromNeuronIdx: number, val: number) => void
}

export function NeuronInspectorTab({
  inspectData,
  layerCount,
  hasSelectedNeuron,
  onClearSelection,
  onStepGradient,
  onBiasChange,
  onWeightChange,
}: NeuronInspectorTabProps) {
  if (!inspectData.node) {
    return (
      <p className="text-xs text-slate-400">
        Haz clic en cualquier neurona del lienzo para inspeccionarla.
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

        <SystemTooltip
          title="Paso de Gradiente Manual"
          label="Calcula ∂L/∂W mediante backpropagation y aplica una actualización inmediata de pesos y sesgos."
          side="bottom"
        >
          <button
            onClick={onStepGradient}
            className="nl-btn-shimmer px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Ajustar Pesos (∂L/∂W)</span>
          </button>
        </SystemTooltip>
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
            <InfoTip text="Activación emitida por la neurona tras aplicar su función no lineal f(z) hacia la capa siguiente." size="xs" />
          </p>
          <p className="text-sm font-extrabold font-mono text-emerald-400 mt-0.5">
            {node.activation.toFixed(3)}
          </p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1">
            <span>Sesgo (b)</span>
            <InfoTip text="Término independiente (bias) que desplaza el umbral de disparo de la neurona." size="xs" />
          </p>
          <p className="text-sm font-extrabold font-mono text-indigo-400 mt-0.5">
            {node.bias.toFixed(3)}
          </p>
        </div>
      </div>

      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 space-y-1">
        <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <span>Cálculo Matemático Real en este Nodo:</span>
          <InfoTip text="Evaluación algebraica en tiempo real ejecutada en este nodo con sus pesos y sesgo actuales." size="xs" />
        </p>
        <p>1. z = Σ(peso · entrada) + sesgo = <strong>{node.z.toFixed(4)}</strong></p>
        <p>
          2. a = {inspectData.layerAct.toUpperCase()}(z) ={' '}
          <strong className="text-emerald-400">{node.activation.toFixed(4)}</strong>
        </p>
      </div>

      {node.layerIdx > 0 && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <span>Ajustar Sesgo (Bias b):</span>
              <InfoTip
                text="Desplaza manualmente el sesgo entre -2.0 y +2.0 y observa cómo cambia la activación en toda la red."
                size="xs"
              />
            </span>
            <span className="text-indigo-400 font-mono font-bold">{node.bias.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min="-2.0"
            max="2.0"
            step="0.02"
            value={node.bias}
            onChange={e => onBiasChange(parseFloat(e.target.value))}
            className="w-full accent-teal-600 h-1.5 bg-slate-800 rounded-lg"
          />
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
          <span>
            Conexiones Entrantes ({inspectData.incomingCount})
            {inspectData.incomingCount > 24 && (
              <span className="ml-1.5 font-normal text-slate-400">· las 24 de mayor aporte |w·a|</span>
            )}
          </span>
          <InfoTip
            text="Sinapsis que alimentan a esta neurona desde la capa anterior. Puedes deslizar cada peso w manualmente."
            size="xs"
          />
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {inspectData.incomingCount === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-3">
              Esta es una neurona de la <strong>Capa de Entrada</strong>: recibe directamente el valor del dataset. Haz clic en cualquier neurona de una <strong>Capa Oculta</strong> para ver y editar sus pesos.
            </p>
          ) : (
            inspectData.incoming.map(inc => (
              <div key={inc.fromNeuron} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white font-mono">
                    Desde {inc.fromLabel} (valor={inc.inputVal.toFixed(2)})
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    aporte:{' '}
                    <strong className={inc.contribution >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {inc.contribution >= 0 ? `+${inc.contribution.toFixed(3)}` : inc.contribution.toFixed(3)}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">Peso w:</span>
                  <input
                    type="range"
                    min="-2.5"
                    max="2.5"
                    step="0.02"
                    value={inc.weight}
                    onChange={e => onWeightChange(inc.fromNeuron, parseFloat(e.target.value))}
                    className="flex-1 accent-teal-600 h-1.5 bg-slate-800 rounded-lg"
                  />
                  <span className={`w-12 text-right font-mono font-bold ${inc.weight >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {inc.weight >= 0 ? `+${inc.weight.toFixed(2)}` : inc.weight.toFixed(2)}
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

