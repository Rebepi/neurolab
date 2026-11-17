import { CheckCircle2, Copy, Lock, Trash2 } from 'lucide-react'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import type { LayerSpec } from '../../../types/index'
import type { LayerParamBreakdown } from '../utils'

interface ArchitectureViewsProps {
  activeView: 'canvas' | 'table' | 'code'
  inputShape: number
  outputDim: number
  outputActivation: string
  layersList: LayerSpec[]
  selectedIdx: number | null
  onSelectLayer: (idx: number) => void
  onRemoveLayer: (idx: number) => void
  breakdown: LayerParamBreakdown[]
  totalParams: number
  generatedPythonCode: string
  copiedCode: boolean
  onCopyCode: () => void
}

export function ArchitectureViews({
  activeView,
  inputShape,
  outputDim,
  outputActivation,
  layersList,
  selectedIdx,
  onSelectLayer,
  onRemoveLayer,
  breakdown,
  totalParams,
  generatedPythonCode,
  copiedCode,
  onCopyCode,
}: ArchitectureViewsProps) {
  return (
    <div key={activeView} className="lg:col-span-6 animate-module-enter">
      {activeView === 'canvas' && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center min-h-[460px]">
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between mb-3 shadow">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-white text-xs font-bold flex items-center gap-1.5">
                  <span>Capa de Entrada (Input Layer)</span>
                  <InfoTip
                    title="Tensor de Entrada"
                    text="Define la dimensionalidad fija que espera el modelo, emparejada automáticamente con las columnas numéricas del dataset."
                    size="xs"
                  />
                </p>
                <p className="text-slate-400 text-[10px]">
                  Adaptada al dataset: {inputShape} características normalizadas
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
              ({inputShape},)
            </span>
          </div>

          <div className="flex flex-col items-center gap-3 w-full max-w-md my-1">
            {layersList.map((layer, idx) => {
              const isSelected = selectedIdx === idx
              let borderCls = 'border-slate-800 bg-slate-950/70'
              let badgeCls = 'bg-slate-800 text-slate-300'
              if (layer.type === 'Dense') {
                borderCls = isSelected
                  ? 'border-indigo-500 bg-indigo-950/40 ring-2 ring-indigo-500/20'
                  : 'border-indigo-900/40 bg-slate-950/80 hover:border-indigo-600/50'
                badgeCls = 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
              } else if (layer.type === 'Dropout') {
                borderCls = isSelected
                  ? 'border-amber-500 bg-amber-950/40 ring-2 ring-amber-500/20'
                  : 'border-amber-900/40 bg-slate-950/80 hover:border-amber-600/50'
                badgeCls = 'bg-amber-950 text-amber-300 border border-amber-800/50'
              } else if (layer.type === 'BatchNormalization') {
                borderCls = isSelected
                  ? 'border-cyan-500 bg-cyan-950/40 ring-2 ring-cyan-500/20'
                  : 'border-cyan-900/40 bg-slate-950/80 hover:border-cyan-600/50'
                badgeCls = 'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
              }

              return (
                <div
                  key={layer.id}
                  style={{ animationDelay: `${idx * 45}ms` }}
                  className="w-full flex flex-col items-center animate-card-reveal"
                >
                  <div className="relative w-0.5 h-3.5 bg-gradient-to-b from-slate-700 to-indigo-500/70">
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping opacity-60" />
                  </div>
                  <div
                    onClick={() => onSelectLayer(idx)}
                    className={`nl-card-interactive w-full p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${borderCls}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 font-mono text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-bold">{layer.type}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeCls}`}>
                            {layer.type === 'Dense'
                              ? `${layer.units} unidades · ${layer.activation}`
                              : layer.type === 'Dropout'
                                ? `rate = ${layer.rate}`
                                : 'BatchNorm'}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          {layer.type === 'Dense'
                            ? `${(breakdown[idx]?.weights || 0) + (breakdown[idx]?.biases || 0)} parámetros aprendibles`
                            : layer.type === 'Dropout'
                              ? 'Desactiva conexiones aleatorias'
                              : 'Normaliza medias y varianzas'}
                        </p>
                      </div>
                    </div>

                    <SystemTooltip label="Eliminar esta capa" side="top">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          onRemoveLayer(idx)
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        aria-label="Eliminar capa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </SystemTooltip>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="w-0.5 h-3 bg-gradient-to-b from-indigo-600/50 to-violet-600" />
          <div className="w-full max-w-md bg-slate-950 border border-violet-900/50 rounded-xl p-3 flex items-center justify-between shadow">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-950/80 border border-violet-700 flex items-center justify-center text-violet-300">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-white text-xs font-bold flex items-center gap-1.5">
                  <span>Capa de Salida (Output Layer)</span>
                  <InfoTip
                    title="Capa de Salida Bloqueada"
                    text="Su dimensión y activación (Sigmoid/Softmax) se deducen automáticamente del tipo de problema del dataset."
                    size="xs"
                  />
                </p>
                <p className="text-slate-400 text-[10px]">
                  {outputDim} neurona con activación <strong className="text-violet-300">{outputActivation}</strong>
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-violet-950 text-violet-300 font-mono text-[10px] border border-violet-800/50">
              ({outputDim},)
            </span>
          </div>
        </div>
      )}

      {activeView === 'table' && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 overflow-x-auto">
          <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-1.5">
            <span>Resumen de Tensores y Parámetros</span>
            <InfoTip
              title="Desglose Paramétrico"
              text="Muestra las dimensiones de entrada/salida de cada capa y la suma exacta de pesos (W = in·out) más sesgos (b = out)."
              size="xs"
            />
          </h4>
          <table className="w-full text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60">
              <tr>
                <th className="py-2.5 px-3 text-left text-slate-400 font-semibold"># Capa</th>
                <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">Tipo</th>
                <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">Entrada</th>
                <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">Salida</th>
                <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">Pesos W</th>
                <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">Sesgos b</th>
                <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">Total Parámetros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {breakdown.map((row, i) => (
                <tr key={i} className="hover:bg-slate-800/20">
                  <td className="py-2.5 px-3 font-mono text-slate-400">{row.layerIndex}</td>
                  <td className="py-2.5 px-3 font-semibold text-white">{row.type}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">({row.inShape})</td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">({row.outShape})</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{row.weights.toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{row.biases.toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">{row.total.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-slate-950/80 font-bold border-t-2 border-slate-700">
                <td colSpan={6} className="py-3 px-3 text-right text-slate-300">Suma Total de Parámetros Entrenables:</td>
                <td className="py-3 px-3 font-mono text-emerald-400 text-sm">{totalParams.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeView === 'code' && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-slate-400">tensorflow_keras_model.py</span>
            <button
              onClick={onCopyCode}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-200 transition-colors"
            >
              {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copiado al portapapeles' : 'Copiar Código'}
            </button>
          </div>
          <pre className="bg-black/90 p-4 rounded-xl text-xs font-mono text-indigo-300 overflow-x-auto leading-relaxed border border-slate-800">
            <code>{generatedPythonCode}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

