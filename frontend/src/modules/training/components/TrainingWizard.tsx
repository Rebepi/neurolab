import React from 'react'
import { ChevronRight, ChevronLeft, Zap, AlertCircle, Loader2 } from 'lucide-react'
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
}

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
}: TrainingWizardProps) {
  const isIncompatible = Boolean(
    selectedDataset &&
    selectedArch &&
    selectedArch.config.input_shape !== selectedDataset.input_shape
  )

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 animate-card-reveal">
      <h3 className="text-white font-semibold mb-5">Configurar Nuevo Entrenamiento</h3>

      <div className="flex items-center gap-2 mb-6">
        {[
          { n: 1, label: 'Dataset' },
          { n: 2, label: 'Arquitectura' },
          { n: 3, label: 'Hiperparámetros' },
        ].map(({ n, label }) => (
          <React.Fragment key={n}>
            <div className={`flex items-center gap-2 text-sm ${step === n ? 'text-indigo-300' : step > n ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                  step === n
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : step > n
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-slate-600 bg-slate-800'
                }`}
              >
                {step > n ? '✓' : n}
              </div>
              <span className="hidden sm:block">{label}</span>
            </div>
            {n < 3 && <div className={`flex-1 h-px ${step > n ? 'bg-emerald-600' : 'bg-slate-700'}`} />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div>
          <p className="text-slate-400 text-sm mb-3">Selecciona el dataset a usar en este entrenamiento</p>
          {datasets.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">
              No hay datasets disponibles. Sube uno en el módulo Datasets.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {datasets.map(ds => (
                <button
                  key={ds.id}
                  onClick={() => onSelectDataset(ds)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedDataset?.id === ds.id
                      ? 'border-indigo-500 bg-indigo-900/20 ring-2 ring-indigo-500/30'
                      : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                  }`}
                >
                  <p className="text-white text-sm font-semibold">{ds.name}</p>
                  <p className="text-slate-400 text-xs mt-1">
                    {ds.input_shape} features → <span className="text-indigo-400">{ds.target}</span>
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {ds.splits.train_count + ds.splits.val_count + ds.splits.test_count} filas totales
                  </p>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <button
              onClick={() => onStepChange(2)}
              disabled={!selectedDataset}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-slate-400 text-sm mb-3">Selecciona la arquitectura de red neuronal</p>
          {architectures.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">
              No hay arquitecturas guardadas. Crea una en el módulo Diseñador.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {architectures.map(arch => {
                const incompat = selectedDataset && arch.config.input_shape !== selectedDataset.input_shape
                return (
                  <button
                    key={arch.id}
                    onClick={() => onSelectArch(arch)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedArch?.id === arch.id
                        ? 'border-indigo-500 bg-indigo-900/20 ring-2 ring-indigo-500/30'
                        : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-white text-sm font-semibold">{arch.name}</p>
                      {incompat ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                          ⚠ Incompatible
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ✓ Compatible
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-1">
                      {arch.family} · {arch.total_parameters.toLocaleString()} parámetros
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      input: {arch.config.input_shape} · v{arch.version}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex justify-between mt-4">
            <button
              onClick={() => onStepChange(1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              onClick={() => onStepChange(3)}
              disabled={!selectedArch || isIncompatible}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <p className="text-slate-400 text-sm">Configura los hiperparámetros del entrenamiento</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-slate-300 text-sm font-medium mb-2 flex items-center gap-1.5">
                <span>Épocas: <span className="text-indigo-400 font-bold">{epochs}</span></span>
                <InfoTip
                  title="Épocas (Epochs)"
                  text="Cantidad de pasadas completas sobre todo el conjunto de entrenamiento (70%). Más épocas permiten mayor ajuste pero aumentan riesgo de sobreajuste."
                  size="xs"
                />
              </label>
              <input
                type="range"
                min={1}
                max={100}
                value={epochs}
                onChange={e => onChangeEpochs(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>1</span>
                <span>100</span>
              </div>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium mb-2 flex items-center gap-1.5">
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
                    onClick={() => onChangeBatchSize(b)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      batchSize === b ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium mb-2 flex items-center gap-1.5">
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
                    onClick={() => onChangeOptimizer(o)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      optimizer === o ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {o.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium mb-2 flex items-center gap-1.5">
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
                    onClick={() => onChangeLearningRate(lr)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                      learningRate === lr ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {lr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {createError && (
            <div className="flex items-start gap-2 p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {createError}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => onStepChange(2)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              onClick={onStartTraining}
              disabled={creating}
              className="nl-btn-shimmer flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 rounded-lg text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {creating ? 'Iniciando...' : '🚀 Iniciar Entrenamiento'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

