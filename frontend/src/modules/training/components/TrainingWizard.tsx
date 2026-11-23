import { Fragment, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  Network,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react'
import type { Architecture, Dataset } from '../../../types'
import { InfoTip } from '../../../components/InfoTip'
import { BATCH_SIZES, LEARNING_RATES, OPTIMIZERS } from '../constants'

interface TrainingWizardProps {
  step: 1 | 2 | 3
  onStepChange: (s: 1 | 2 | 3) => void
  datasets: Dataset[]
  architectures: Architecture[]
  selectedDataset: Dataset | null
  onSelectDataset: (ds: Dataset) => void
  selectedArch: Architecture | null
  onSelectArch: (arch: Architecture) => void
  epochs: number
  onChangeEpochs: (v: number) => void
  batchSize: number
  onChangeBatchSize: (v: number) => void
  optimizer: string
  onChangeOptimizer: (v: string) => void
  learningRate: number
  onChangeLearningRate: (v: number) => void
  creating: boolean
  createError: string | null
  onStartTraining: () => void
  onClose: () => void
}

const STEPS = [
  { n: 1, label: 'Dataset', icon: Database },
  { n: 2, label: 'Arquitectura', icon: Network },
  { n: 3, label: 'Hiperparámetros', icon: SlidersHorizontal },
] as const

const optionBase = 'flex-1 py-2 rounded-xl border text-xs font-semibold transition-all'
const optionOn =
  'bg-gradient-to-r from-indigo-600/80 to-cyan-600/80 border-cyan-400/60 text-white shadow-md shadow-indigo-500/20'
const optionOff =
  'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-white'

export function TrainingWizard({
  step,
  onStepChange,
  datasets,
  architectures,
  selectedDataset,
  onSelectDataset,
  selectedArch,
  onSelectArch,
  epochs,
  onChangeEpochs,
  batchSize,
  onChangeBatchSize,
  optimizer,
  onChangeOptimizer,
  learningRate,
  onChangeLearningRate,
  creating,
  createError,
  onStartTraining,
  onClose,
}: TrainingWizardProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const cardBase = 'text-left p-3.5 rounded-xl border transition-all relative'
  const cardOn = 'border-cyan-400/70 bg-cyan-500/10 ring-1 ring-cyan-400/40'
  const cardOff = 'border-slate-800 bg-slate-900/70 hover:border-cyan-500/40'

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-wizard-title"
    >
      <div
        className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-cyan-500/25 bg-[#070f21] text-slate-100 shadow-[0_24px_90px_rgba(2,6,23,0.9)] overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400 shrink-0" />

        <div className="px-5 py-4 border-b border-white/10 bg-slate-900/50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h2 id="training-wizard-title" className="text-base font-semibold text-white truncate">
                Configurar Nuevo Entrenamiento
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Elige dataset, arquitectura e hiperparámetros para lanzar una corrida Keras.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente"
            className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4 shrink-0">
          <div className="flex items-center gap-2">
            {STEPS.map(({ n, label, icon: Icon }) => {
              const done = step > n
              const active = step === n
              return (
                <Fragment key={n}>
                  <div
                    className={`flex items-center gap-2 text-xs font-semibold ${
                      active ? 'text-cyan-200' : done ? 'text-emerald-300' : 'text-slate-500'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400/60'
                          : done
                            ? 'bg-emerald-500/20 border-emerald-400/50'
                            : 'bg-slate-900 border-slate-700'
                      }`}
                    >
                      {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className="hidden sm:block">{label}</span>
                  </div>
                  {n < 3 && (
                    <div
                      className={`flex-1 h-px ${
                        done ? 'bg-emerald-500/60' : 'bg-slate-700'
                      }`}
                    />
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm flex items-center gap-1.5">
                <span>Selecciona el dataset a usar en este entrenamiento</span>
                <InfoTip
                  title="Selección Única de Dataset"
                  text="El entrenamiento se ejecuta exclusivamente sobre el dataset que selecciones aquí (dividido en 70% Train, 15% Val y 15% Test). Si subiste varias versiones, nunca se mezclan automáticamente."
                  size="xs"
                />
              </p>
              {datasets.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">
                  No hay datasets disponibles. Sube uno en el módulo Datasets.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {datasets.map(ds => {
                    const selected = selectedDataset?.id === ds.id
                    return (
                      <button
                        key={ds.id}
                        type="button"
                        onClick={() => onSelectDataset(ds)}
                        className={`${cardBase} ${selected ? cardOn : cardOff}`}
                      >
                        {selected && (
                          <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                        <p className="text-white text-sm font-semibold pr-7 truncate">{ds.name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-cyan-300">
                            {ds.input_shape} → {ds.target}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300">
                            {(
                              ds.splits.train_count +
                              ds.splits.val_count +
                              ds.splits.test_count
                            ).toLocaleString()}{' '}
                            filas
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">Selecciona la arquitectura de red neuronal</p>
              {architectures.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">
                  No hay arquitecturas guardadas. Crea una en el módulo Diseñador.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {architectures.map(arch => {
                    const incompat =
                      selectedDataset && arch.config.input_shape !== selectedDataset.input_shape
                    const selected = selectedArch?.id === arch.id
                    return (
                      <button
                        key={arch.id}
                        type="button"
                        onClick={() => onSelectArch(arch)}
                        className={`${cardBase} ${selected ? cardOn : cardOff}`}
                      >
                        {selected && (
                          <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                        <p className="text-white text-sm font-semibold pr-7 truncate">{arch.name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300">
                            {arch.family} · v{arch.version}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-emerald-300">
                            {arch.total_parameters.toLocaleString()} p
                          </span>
                        </div>
                        <div className="mt-2">
                          {incompat ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              Auto-adaptable ({arch.config.input_shape} → {selectedDataset?.input_shape})
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              Compatible
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                  <label className="text-slate-200 text-sm font-semibold flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5">
                      Épocas
                      <InfoTip
                        title="Épocas (Epochs)"
                        text="Cantidad de pasadas completas sobre todo el conjunto de entrenamiento (70%). Más épocas permiten mayor ajuste pero aumentan riesgo de sobreajuste."
                        size="xs"
                      />
                    </span>
                    <span className="font-mono font-bold text-cyan-300">{epochs}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={epochs}
                    onChange={e => onChangeEpochs(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-slate-500">
                    <span>1</span>
                    <span>100</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                  <label className="text-slate-200 text-sm font-semibold flex items-center gap-1.5">
                    <span>Batch Size</span>
                    <InfoTip
                      title="Tamaño de Lote (Batch Size)"
                      text="Muestras procesadas antes de actualizar los pesos. Lotes pequeños generalizan mejor; lotes grandes aprovechan vectorización."
                      size="xs"
                    />
                  </label>
                  <div className="flex gap-2">
                    {BATCH_SIZES.map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => onChangeBatchSize(b)}
                        className={`${optionBase} font-mono ${batchSize === b ? optionOn : optionOff}`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                  <label className="text-slate-200 text-sm font-semibold flex items-center gap-1.5">
                    <span>Optimizador</span>
                    <InfoTip
                      title="Algoritmo de Optimización"
                      text="Adam adapta la tasa por parámetro (ideal por defecto); SGD aplica descenso clásico; RMSprop estabiliza gradientes oscilantes."
                      size="xs"
                    />
                  </label>
                  <div className="flex gap-2">
                    {OPTIMIZERS.map(o => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => onChangeOptimizer(o)}
                        className={`${optionBase} ${optimizer === o ? optionOn : optionOff}`}
                      >
                        {o.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                  <label className="text-slate-200 text-sm font-semibold flex items-center gap-1.5">
                    <span>Learning Rate</span>
                    <InfoTip
                      title="Tasa de Aprendizaje (η)"
                      text="Magnitud del paso de ajuste en cada gradiente. 0.001 es el estándar estable para Adam."
                      size="xs"
                    />
                  </label>
                  <div className="flex gap-2">
                    {LEARNING_RATES.map(lr => (
                      <button
                        key={lr}
                        type="button"
                        onClick={() => onChangeLearningRate(lr)}
                        className={`${optionBase} font-mono ${learningRate === lr ? optionOn : optionOff}`}
                      >
                        {lr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-cyan-500/8 border border-cyan-500/25 text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-cyan-200">Resumen:</span>
                <span className="font-mono">{selectedDataset?.name ?? 'Sin dataset'}</span>
                <ChevronRight className="w-3 h-3 text-slate-500" />
                <span className="font-mono">{selectedArch?.name ?? 'Sin arquitectura'}</span>
                <span className="font-mono text-slate-400">
                  {epochs} ép · batch {batchSize} · {optimizer.toUpperCase()} · lr {learningRate}
                </span>
              </div>

              {createError && (
                <div className="flex items-start gap-2 p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {createError}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-slate-900/65 flex items-center justify-between gap-3 shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => onStepChange((step - 1) as 1 | 2 | 3)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-white/10 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
          )}

          {step === 1 && (
            <button
              type="button"
              onClick={() => onStepChange(2)}
              disabled={!selectedDataset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={() => onStepChange(3)}
              disabled={!selectedArch}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={onStartTraining}
              disabled={creating || !selectedDataset || !selectedArch}
              className="nl-btn-shimmer flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/25"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {creating ? 'Iniciando...' : 'Iniciar Entrenamiento'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
