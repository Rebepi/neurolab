import {
  Activity,
  CheckCircle2,
  Layers,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import type { LayerSpec } from '../../../types/index'
import { SystemTooltip } from '../../../components/InfoTip'
import type { ArchitecturePreset } from '../constants'
import { computeArchitectureParams } from '../utils'

interface ArchitectureCatalogPanelProps {
  onAddLayer: (type: LayerSpec['type']) => void
  archName: string
  family: 'Feedforward' | 'RNN' | 'CNN' | 'GAN'
  layerCount: number
  inputShape: number
  outputDim: number
  totalParams: number
  presets: ArchitecturePreset[]
  onApplyPreset: (preset: ArchitecturePreset) => void
  isPresetActive: (preset: ArchitecturePreset) => boolean
  onClearLayers: () => void
}

export function ArchitectureCatalogPanel({
  onAddLayer,
  archName,
  family,
  layerCount,
  inputShape,
  outputDim,
  totalParams,
  presets,
  onApplyPreset,
  isPresetActive,
  onClearLayers,
}: ArchitectureCatalogPanelProps) {
  const memoryKb = ((totalParams * 4) / 1024).toFixed(1)
  return (
    <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-3 flex flex-col justify-between gap-2.5 h-full">
      <div className="space-y-2.5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Añadir Capa</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Keras</span>
          </div>

          <SystemTooltip
            side="right"
            className="block w-full"
            title="Capa Densa (Dense)"
            label="Capa totalmente conectada donde cada neurona combina todas las entradas mediante y = φ(W·x + b) para aprender patrones complejos en datos tabulares."
            hint="Aporta pesos W y bias b · Clic para añadir al final"
          >
            <button
              type="button"
              onClick={() => onAddLayer('Dense')}
              className="nl-card-interactive w-full p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 hover:border-indigo-400/65 text-left flex items-center justify-between gap-2 transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center text-indigo-300 shrink-0">
                  <Layers className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">Capa Densa</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">Lineal + activación</p>
                </div>
              </div>
              <span className="text-[9.5px] font-mono bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded text-indigo-300 shrink-0">
                W·x+b
              </span>
            </button>
          </SystemTooltip>

          <SystemTooltip
            side="right"
            className="block w-full"
            title="Capa Dropout (Regularización)"
            label="Desconecta aleatoriamente un porcentaje de neuronas en cada iteración de entrenamiento para evitar que la red memorice ruido (overfitting)."
            hint="0 parámetros entrenables · Se desactiva al predecir"
          >
            <button
              type="button"
              onClick={() => onAddLayer('Dropout')}
              className="nl-card-interactive w-full p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 hover:border-amber-400/65 text-left flex items-center justify-between gap-2 transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-300 shrink-0">
                  <ShieldAlert className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">Capa Dropout</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">Regularización</p>
                </div>
              </div>
              <span className="text-[9.5px] font-mono bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded text-amber-300 shrink-0">
                p-drop
              </span>
            </button>
          </SystemTooltip>

          <SystemTooltip
            side="right"
            className="block w-full"
            title="Batch Normalization"
            label="Normaliza las activaciones intermedias por mini-lote (μ ≈ 0, σ² ≈ 1) aplicando escala γ y desplazamiento β aprendibles."
            hint="Estabiliza gradientes · Acelera la convergencia"
          >
            <button
              type="button"
              onClick={() => onAddLayer('BatchNormalization')}
              className="nl-card-interactive w-full p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 hover:border-teal-400/65 text-left flex items-center justify-between gap-2 transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-teal-500/15 border border-teal-500/35 flex items-center justify-center text-teal-300 shrink-0">
                  <Activity className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">Batch Norm</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">Estabiliza μ y σ²</p>
                </div>
              </div>
              <span className="text-[9.5px] font-mono bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded text-teal-300 shrink-0">
                γ·x̂+β
              </span>
            </button>
          </SystemTooltip>

          {family === 'CNN' && (
            <>
              <button
                type="button"
                onClick={() => onAddLayer('Conv1D')}
                className="nl-card-interactive w-full p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 hover:border-cyan-400/65 text-left flex items-center justify-between gap-2 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">Conv1D</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">Filtros + Kernel</p>
                </div>
                <span className="text-[9.5px] font-mono bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded text-cyan-300 shrink-0">
                  CNN
                </span>
              </button>
              <button
                type="button"
                onClick={() => onAddLayer('MaxPooling1D')}
                className="nl-card-interactive w-full p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 hover:border-cyan-400/65 text-left flex items-center justify-between gap-2 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">MaxPooling1D</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">Reducción espacial</p>
                </div>
                <span className="text-[9.5px] font-mono bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded text-cyan-300 shrink-0">
                  Pool
                </span>
              </button>
              <button
                type="button"
                onClick={() => onAddLayer('Flatten')}
                className="nl-card-interactive w-full p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 hover:border-cyan-400/65 text-left flex items-center justify-between gap-2 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">Flatten</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">Aplanar tensor 1D</p>
                </div>
                <span className="text-[9.5px] font-mono bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded text-cyan-300 shrink-0">
                  Flat
                </span>
              </button>
            </>
          )}

          {family === 'RNN' && (
            <>
              <button
                type="button"
                onClick={() => onAddLayer('LSTM')}
                className="nl-card-interactive w-full p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 hover:border-violet-400/65 text-left flex items-center justify-between gap-2 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">Capa LSTM</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">Memoria secuencial</p>
                </div>
                <span className="text-[9.5px] font-mono bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded text-violet-300 shrink-0">
                  RNN
                </span>
              </button>
              <button
                type="button"
                onClick={() => onAddLayer('GRU')}
                className="nl-card-interactive w-full p-2 rounded-xl bg-[#071123]/80 border border-cyan-500/20 hover:border-violet-400/65 text-left flex items-center justify-between gap-2 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">Capa GRU</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight">Compuerta recurrente</p>
                </div>
                <span className="text-[9.5px] font-mono bg-slate-900/90 border border-slate-800 px-1.5 py-0.5 rounded text-violet-300 shrink-0">
                  RNN
                </span>
              </button>
            </>
          )}
        </div>

        <div className="space-y-1.5 pt-2.5 border-t border-slate-800/80">
          <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Plantillas Base</span>
          </h4>
          <div className="space-y-1.5">
            {presets.map((preset, idx) => {
              const active = isPresetActive(preset)
              const presetParams = computeArchitectureParams(
                preset.layers,
                inputShape,
                outputDim,
                preset.family
              ).total
              const sequenceSummary = preset.layers
                .map(layer =>
                  layer.type === 'Dense'
                    ? `Dense ${layer.units ?? 32}`
                    : layer.type === 'Dropout'
                      ? `Dropout ${Math.round((layer.rate ?? 0.2) * 100)}%`
                      : 'BatchNorm'
                )
                .join(' → ')
              return (
                <SystemTooltip
                  key={idx}
                  side="right"
                  className="block w-full"
                  title={preset.name}
                  label={preset.desc}
                  hint={`${sequenceSummary} · ${presetParams.toLocaleString()} p`}
                >
                  <button
                    type="button"
                    onClick={() => onApplyPreset(preset)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl border transition-all space-y-1 ${
                      active
                        ? 'bg-cyan-500/12 border-cyan-400/60 shadow-sm'
                        : 'bg-[#071123]/75 border-cyan-500/15 hover:border-indigo-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-[11px] font-bold truncate ${
                          active ? 'text-cyan-300' : 'text-slate-200'
                        }`}
                      >
                        {preset.name}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                          {presetParams.toLocaleString()} p
                        </span>
                        {active && <CheckCircle2 className="w-3 h-3 text-cyan-400" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {preset.layers.map((layer, lIdx) => (
                        <span
                          key={lIdx}
                          title={layer.type}
                          className={`w-1.5 h-1.5 rounded-full ${
                            layer.type === 'Dense'
                              ? 'bg-indigo-400'
                              : layer.type === 'Dropout'
                                ? 'bg-amber-400'
                                : 'bg-teal-400'
                          }`}
                        />
                      ))}
                    </div>
                  </button>
                </SystemTooltip>
              )
            })}
          </div>
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-800/80">
        <div className="p-2.5 rounded-xl bg-[#071123]/80 border border-cyan-500/20 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap">
              Activa
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
              {family}
            </span>
          </div>
          <p className="text-xs font-bold text-white truncate">{archName || 'Sin título'}</p>
          <div className="flex items-center justify-between gap-1.5">
            <p className="text-[10px] font-mono text-slate-400 whitespace-nowrap truncate">
              {layerCount}c · {totalParams.toLocaleString()}p · {memoryKb} KB
            </p>
            {layerCount > 0 && (
              <button
                type="button"
                onClick={onClearLayers}
                title="Restablecer todas las capas ocultas"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-medium text-rose-300 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Vaciar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
