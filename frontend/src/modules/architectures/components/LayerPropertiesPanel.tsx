import { Activity, ArrowLeft, ArrowRight, Brain, Copy, Layers, ShieldAlert, Sliders, Trash2 } from 'lucide-react'
import type { LayerSpec } from '../../../types/index'
import { SystemSelect } from '../../../components/SystemSelect'
import { SystemTooltip } from '../../../components/InfoTip'
import type { LayerDecisionReason, LayerParamBreakdown } from '../utils'

interface LayerPropertiesPanelProps {
  selectedLayer: LayerSpec | null
  selectedIdx: number | null
  selectedBreakdown: LayerParamBreakdown | null
  selectedLayerReason?: LayerDecisionReason | null
  totalParams: number
  inputShape: number
  outputDim: number
  outputActivation: string
  suggestedLoss?: string
  scalerApplied?: string
  layersCount: number
  onUpdateLayer: (patch: Partial<LayerSpec>) => void
  onMoveLayer: (idx: number, direction: -1 | 1) => void
  onDuplicateLayer: (idx: number) => void
  onRemoveLayer: (idx: number) => void
}

const UNIT_PRESETS = [8, 16, 32, 64, 128, 256]
const DROPOUT_PRESETS = [0.1, 0.2, 0.3, 0.5]

function evalMiniActivation(fn: string, x: number): number {
  if (fn === 'relu') return Math.max(0, x) / 4
  if (fn === 'tanh') return Math.tanh(x)
  if (fn === 'sigmoid') return 1 / (1 + Math.exp(-x))
  return x / 4
}

function buildMiniActivationPath(fn: string): string {
  return Array.from({ length: 41 }, (_, i) => {
    const x = -4 + (i * 8) / 40
    const px = ((x + 4) / 8) * 100
    const val = Math.max(-1, Math.min(1, evalMiniActivation(fn, x)))
    const py = 20 - val * 16
    return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`
  }).join(' ')
}

function getActivationFormula(fn: string): string {
  if (fn === 'relu') return 'f(z) = max(0, z)'
  if (fn === 'tanh') return 'f(z) = tanh(z)'
  if (fn === 'sigmoid') return 'f(z) = 1 / (1 + e⁻ᶻ)'
  return 'f(z) = z'
}

export function LayerPropertiesPanel({
  selectedLayer,
  selectedIdx,
  selectedBreakdown,
  selectedLayerReason,
  totalParams,
  inputShape,
  outputDim,
  outputActivation,
  suggestedLoss,
  scalerApplied,
  layersCount,
  onUpdateLayer,
  onMoveLayer,
  onDuplicateLayer,
  onRemoveLayer,
}: LayerPropertiesPanelProps) {
  const actName = selectedLayer?.activation || 'relu'
  const sharePct =
    selectedBreakdown && totalParams > 0
      ? ((selectedBreakdown.total / totalParams) * 100).toFixed(1)
      : '0.0'
  const activeRate = selectedLayer?.rate || 0.2
  const activeNeuronSlots = Math.max(1, Math.round((1 - activeRate) * 10))
  const lossName =
    suggestedLoss ||
    (outputActivation === 'sigmoid'
      ? 'binary_crossentropy'
      : outputActivation === 'softmax'
        ? 'sparse_categorical_crossentropy'
        : 'mean_squared_error')
  const zeroY = (20 - evalMiniActivation(actName, 0) * 16).toFixed(1)
  const curvePath = buildMiniActivationPath(actName)
  const areaPath = `${curvePath} L 100 38 L 0 38 Z`

  const layerBadgeIcon =
    selectedLayer?.type === 'Dropout' ? (
      <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-300 shrink-0">
        <ShieldAlert className="w-3.5 h-3.5" />
      </div>
    ) : selectedLayer?.type === 'BatchNormalization' ? (
      <div className="w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-500/35 flex items-center justify-center text-teal-300 shrink-0">
        <Activity className="w-3.5 h-3.5" />
      </div>
    ) : (
      <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center text-indigo-300 shrink-0">
        <Layers className="w-3.5 h-3.5" />
      </div>
    )

  return (
    <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-3 flex flex-col justify-between gap-2.5 h-full">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <h3 className="text-white font-bold text-[11px] uppercase tracking-wider truncate">
              Inspector de Capa
            </h3>
          </div>

          {selectedLayer && selectedIdx !== null && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                #{selectedIdx + 1}
              </span>
              <SystemTooltip label="Duplicar" side="top">
                <button
                  type="button"
                  onClick={() => onDuplicateLayer(selectedIdx)}
                  className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/15 transition-colors"
                  aria-label="Duplicar capa seleccionada"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </SystemTooltip>
              <SystemTooltip label="Eliminar" side="top">
                <button
                  type="button"
                  onClick={() => onRemoveLayer(selectedIdx)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
                  aria-label="Eliminar capa seleccionada"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </SystemTooltip>
            </div>
          )}
        </div>

        {selectedLayer && selectedIdx !== null ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#071123]/80 border border-cyan-500/20 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="shrink-0 scale-90 origin-left">{layerBadgeIcon}</div>
                <div className="min-w-0">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider leading-tight">
                    Capa activa
                  </p>
                  <p className="font-bold text-white text-xs truncate leading-tight">
                    {selectedLayer.type === 'BatchNormalization' ? 'BatchNorm' : selectedLayer.type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <SystemTooltip label="Mover atrás" side="top">
                  <button
                    type="button"
                    disabled={selectedIdx === 0}
                    onClick={() => onMoveLayer(selectedIdx, -1)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-500/40 disabled:opacity-30"
                    aria-label="Mover capa atrás"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                </SystemTooltip>
                <SystemTooltip label="Mover adelante" side="top">
                  <button
                    type="button"
                    disabled={selectedIdx >= layersCount - 1}
                    onClick={() => onMoveLayer(selectedIdx, 1)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-500/40 disabled:opacity-30"
                    aria-label="Mover capa adelante"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </SystemTooltip>
              </div>
            </div>

            {selectedLayer.type === 'Dense' && (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-indigo-400" />
                      <span>Unidades (Neuronas):</span>
                    </span>
                    <span className="text-cyan-400 font-mono font-bold">{selectedLayer.units || 32}</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={256}
                    step={4}
                    value={selectedLayer.units || 32}
                    onChange={e => onUpdateLayer({ units: parseInt(e.target.value, 10) })}
                    className="w-full accent-cyan-500 h-1.5"
                  />
                  <div className="grid grid-cols-6 gap-1">
                    {UNIT_PRESETS.map(u => {
                      const isUnitSelected = (selectedLayer.units || 32) === u
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => onUpdateLayer({ units: u })}
                          className={`py-0.5 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                            isUnitSelected
                              ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
                              : 'bg-[#071123]/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          {u}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <label className="text-slate-300">Activación:</label>
                    <span className="text-[10px] font-mono text-cyan-400 font-semibold">
                      {getActivationFormula(actName)}
                    </span>
                  </div>
                  <SystemSelect
                    value={actName}
                    onChange={val => onUpdateLayer({ activation: val as LayerSpec['activation'] })}
                    size="xs"
                    ariaLabel="Función de Activación"
                    options={[
                      { value: 'relu', label: 'ReLU (Recomendada para ocultas)' },
                      { value: 'tanh', label: 'Tanh (Tangente hiperbólica)' },
                      { value: 'sigmoid', label: 'Sigmoide' },
                      { value: 'linear', label: 'Lineal' },
                    ]}
                  />
                  <div className="px-2 py-1.5 rounded-xl bg-[#071123]/80 border border-cyan-500/20">
                    <svg viewBox="0 0 100 40" className="w-full h-9 overflow-visible">
                      <defs>
                        <linearGradient id="nlActAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="20" x2="100" y2="20" stroke="#475569" strokeWidth="0.6" strokeDasharray="2 2" />
                      <line x1="50" y1="2" x2="50" y2="38" stroke="#475569" strokeWidth="0.6" strokeDasharray="2 2" />
                      <path d={areaPath} fill="url(#nlActAreaGrad)" />
                      <path
                        d={curvePath}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle cx="50" cy={zeroY} r="2.6" fill="#22d3ee" stroke="#ffffff" strokeWidth="1" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">Usar sesgo (bias b):</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedLayer.use_bias !== false}
                    onClick={() => onUpdateLayer({ use_bias: selectedLayer.use_bias === false })}
                    className={`w-9 h-4.5 rounded-full transition-colors p-0.5 flex items-center ${
                      selectedLayer.use_bias !== false ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>

                {selectedBreakdown && (
                  <div className="p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 space-y-0.5 text-[10.5px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Tensor:</span>
                      <span className="text-indigo-300 font-semibold">
                        ({selectedBreakdown.inShape}) → ({selectedBreakdown.outShape})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Pesos W / b:</span>
                      <span className="text-slate-200">
                        {selectedBreakdown.weights.toLocaleString()} / {selectedBreakdown.biases.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between pt-0.5 border-t border-slate-800/80">
                      <span className="text-slate-400 font-sans">Peso relativo:</span>
                      <span className="text-emerald-400 font-bold">{sharePct}% del modelo</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedLayer.type === 'Dropout' && (
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tasa de Desconexión:</span>
                  </span>
                  <span className="text-amber-400 font-mono font-bold">
                    {(activeRate * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.7}
                  step={0.05}
                  value={activeRate}
                  onChange={e => onUpdateLayer({ rate: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 h-1.5"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {DROPOUT_PRESETS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onUpdateLayer({ rate: r })}
                      className={`py-0.5 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                        Math.abs(activeRate - r) < 0.01
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                          : 'bg-[#071123]/80 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {(r * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>

                <div className="p-2.5 rounded-xl bg-[#071123]/80 border border-cyan-500/20 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Retención</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {Math.round((1 - activeRate) * 100)}% activas
                    </span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: 10 }, (_, dIdx) => {
                      const kept = dIdx < activeNeuronSlots
                      return (
                        <span
                          key={dIdx}
                          className={`h-2 rounded-full transition-all ${
                            kept
                              ? 'bg-emerald-400/80 shadow-sm shadow-emerald-400/40'
                              : 'bg-amber-500/20 border border-amber-500/40'
                          }`}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {selectedLayer.type === 'BatchNormalization' && (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-1">
                  <p className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Normalización por Lotes</span>
                  </p>
                  <p className="text-[11px] font-mono text-teal-200">x̂ = (x − μ) / √(σ² + ε)</p>
                  <p className="text-[10px] text-slate-300 leading-snug">
                    Estabiliza activaciones intermedias por lote y acelera el gradiente descendente.
                  </p>
                </div>
                {selectedBreakdown && (
                  <div className="p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 space-y-0.5 text-[10.5px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Tensor:</span>
                      <span className="text-teal-300">
                        ({selectedBreakdown.inShape}) → ({selectedBreakdown.outShape})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Escala / Desp.:</span>
                      <span className="text-slate-200">{selectedBreakdown.weights.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Media / Var.:</span>
                      <span className="text-slate-200">{selectedBreakdown.biases.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-0.5 border-t border-slate-800/80">
                      <span className="text-slate-400 font-sans">Total:</span>
                      <span className="text-emerald-400 font-bold">{selectedBreakdown.total.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedLayer.type === 'Conv1D' && (
              <div className="space-y-2.5 text-[11px]">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Filtros:</span>
                    <span className="text-cyan-400 font-mono font-bold">{selectedLayer.filters ?? 32}</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={128}
                    step={8}
                    value={selectedLayer.filters ?? 32}
                    onChange={e => onUpdateLayer({ filters: parseInt(e.target.value, 10) })}
                    className="w-full accent-cyan-500 h-1.5"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Kernel Size:</span>
                    <span className="text-cyan-400 font-mono font-bold">{selectedLayer.kernel_size ?? 3}</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={7}
                    step={1}
                    value={selectedLayer.kernel_size ?? 3}
                    onChange={e => onUpdateLayer({ kernel_size: parseInt(e.target.value, 10) })}
                    className="w-full accent-cyan-500 h-1.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300">Padding:</label>
                  <SystemSelect
                    value={selectedLayer.padding ?? 'same'}
                    onChange={val => onUpdateLayer({ padding: val as 'same' | 'valid' })}
                    size="xs"
                    ariaLabel="Padding Conv1D"
                    options={[
                      { value: 'same', label: 'same (Mantiene dimensión)' },
                      { value: 'valid', label: 'valid (Sin relleno)' },
                    ]}
                  />
                </div>
              </div>
            )}

            {selectedLayer.type === 'MaxPooling1D' && (
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-300">Pool Size:</span>
                  <span className="text-cyan-400 font-mono font-bold">{selectedLayer.pool_size ?? 2}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={4}
                  step={1}
                  value={selectedLayer.pool_size ?? 2}
                  onChange={e => onUpdateLayer({ pool_size: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-500 h-1.5"
                />
              </div>
            )}

            {(selectedLayer.type === 'LSTM' || selectedLayer.type === 'GRU') && (
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-300">Unidades ({selectedLayer.type}):</span>
                  <span className="text-violet-300 font-mono font-bold">{selectedLayer.units ?? 32}</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={128}
                  step={8}
                  value={selectedLayer.units ?? 32}
                  onChange={e => onUpdateLayer({ units: parseInt(e.target.value, 10) })}
                  className="w-full accent-violet-500 h-1.5"
                />
                {selectedBreakdown && (
                  <div className="p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 font-mono text-[10.5px] flex justify-between">
                    <span className="text-slate-400 font-sans">Parámetros:</span>
                    <span className="text-emerald-400 font-bold">{selectedBreakdown.total.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {selectedLayer.type === 'Flatten' && (
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-[10.5px] text-slate-300">
                Convierte el mapa de características 2D/3D en un vector 1D para conectar con capas Dense.
              </div>
            )}

            {selectedLayerReason && (
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  <span>Por qué se eligió esta capa</span>
                </p>
                <p className="text-[10.5px] text-slate-300 leading-snug line-clamp-3">{selectedLayerReason.reason}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 px-3 text-center space-y-2">
            <div className="w-9 h-9 rounded-xl bg-[#071123]/80 border border-cyan-500/25 flex items-center justify-center mx-auto">
              <Sliders className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Haz clic en una capa del plano interactivo para ajustar sus hiperparámetros.
            </p>
          </div>
        )}
      </div>

      <div className="p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 space-y-1 text-[10.5px]">
        <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
          Validación TensorFlow / Keras
        </p>
        <div className="flex justify-between font-mono gap-2">
          <span className="text-slate-400 font-sans">Entrada:</span>
          <span className="text-cyan-400 truncate">
            ({inputShape},) {scalerApplied ? `· ${scalerApplied}` : ''}
          </span>
        </div>
        <div className="flex justify-between font-mono gap-2">
          <span className="text-slate-400 font-sans">Salida:</span>
          <span className="text-violet-300 truncate">
            ({outputDim},) · {outputActivation}
          </span>
        </div>
        <div className="flex justify-between font-mono gap-2">
          <span className="text-slate-400 font-sans">Loss:</span>
          <span className="text-emerald-400 truncate">{lossName}</span>
        </div>
      </div>
    </div>
  )
}
