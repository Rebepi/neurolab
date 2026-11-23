import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  Cpu,
  Database,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react'
import type { ColumnSummary, ModelVersion } from '../../../types/index'
import { api } from '../../../services/api'
import { InfoTip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'
import { useToast } from '../../../components/toast/ToastContext'
import { normalizeModelStatus } from './ModelVersionsGrid'

interface InferenceSimulatorPanelProps {
  selectedModel: ModelVersion
  onClose: () => void
}

export function InferenceSimulatorPanel({
  selectedModel,
  onClose,
}: InferenceSimulatorPanelProps) {
  const toast = useToast()
  const eda = selectedModel.dataset_metadata
  const inputColumns: ColumnSummary[] = (eda?.columns_summary || []).filter(
    c => !c.is_target && !c.excluded_reason
  )
  const previewRows = eda?.preview || []
  const targetCol = selectedModel.target_column || eda?.target_column || 'objetivo'
  const normStatus = normalizeModelStatus(selectedModel.status)

  const [features, setFeatures] = useState<Record<string, any>>({})
  const [sampleIndex, setSampleIndex] = useState(0)
  const [inferring, setInferring] = useState(false)
  const [inferResult, setInferResult] = useState<{
    problem_type: string
    target_column: string
    prediction: string | number
    predicted_label: string
    probability: number | null
    probabilities: Record<string, number> | null
    latency_ms: number
  } | null>(null)

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

  function buildMeanFeatures(): Record<string, any> {
    const initial: Record<string, any> = {}
    for (const col of inputColumns) {
      if (col.dtype === 'numeric') {
        initial[col.name] = Number((col.mean ?? 0).toFixed(2))
      } else {
        const cats = Object.keys(col.top_values || {})
        initial[col.name] = cats[0] || ''
      }
    }
    return initial
  }

  useEffect(() => {
    setInferResult(null)
    setSampleIndex(0)
    if (previewRows.length > 0) {
      const firstRow = previewRows[0]
      const initial = buildMeanFeatures()
      for (const col of inputColumns) {
        if (firstRow[col.name] !== undefined && firstRow[col.name] !== null) {
          initial[col.name] = firstRow[col.name]
        }
      }
      setFeatures(initial)
    } else {
      setFeatures(buildMeanFeatures())
    }
  }, [selectedModel.id])

  function handleLoadSampleRow() {
    if (previewRows.length === 0) return
    const nextIdx = (sampleIndex + 1) % previewRows.length
    setSampleIndex(nextIdx)
    const row = previewRows[nextIdx]
    const nextFeatures: Record<string, any> = { ...features }
    for (const col of inputColumns) {
      if (row[col.name] !== undefined && row[col.name] !== null) {
        nextFeatures[col.name] = row[col.name]
      }
    }
    setFeatures(nextFeatures)
    toast.info(
      'Registro real cargado',
      `Fila de muestra #${nextIdx + 1} del dataset ${selectedModel.dataset_name || ''}`
    )
  }

  function handleResetDefaults() {
    setFeatures(buildMeanFeatures())
    setInferResult(null)
    toast.info('Valores restablecidos', 'Se cargaron los promedios y modas base del dataset')
  }

  async function runSimulation() {
    setInferring(true)
    try {
      const res = await api.predictModel(selectedModel.id, features)
      setInferResult(res)
    } catch (e: any) {
      toast.error('Error en inferencia', e.message || 'No se pudo ejecutar el modelo')
    } finally {
      setInferring(false)
    }
  }

  const numericCols = inputColumns.filter(c => c.dtype === 'numeric').length
  const categoricalCols = inputColumns.length - numericCols

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-simulator-modal-title"
    >
      <div
        className="relative w-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl border border-cyan-500/25 bg-[#070f21] text-slate-100 shadow-[0_24px_90px_rgba(2,6,23,0.92)] overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 shrink-0" />

        <div className="px-5 py-4 border-b border-white/10 bg-slate-900/55 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-cyan-400/35 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="model-simulator-modal-title"
                  className="text-base font-bold text-white truncate"
                >
                  Simulador de Inferencia Dinámica (.keras)
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/30 text-xs font-mono font-bold text-cyan-300">
                  {selectedModel.version}
                </span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${normStatus.badgeClass}`}
                >
                  {normStatus.label}
                </span>
                <InfoTip
                  title="Inferencia Universal en Tiempo Real"
                  text="Ejecuta el binario .keras real en el servidor aplicando el mismo preprocesamiento (StandardScaler / MinMaxScaler y codificación One-Hot) registrado durante el entrenamiento."
                  size="xs"
                />
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {selectedModel.dataset_name || 'Dataset'} · {selectedModel.arch_name || 'Topología Keras'} →{' '}
                Objetivo: <strong className="text-cyan-300 font-mono">{targetCol}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {previewRows.length > 0 && (
              <button
                type="button"
                onClick={handleLoadSampleRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5 text-teal-400" />
                <span>Fila real (#{sampleIndex + 1})</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Promedios</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar simulador"
              className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Variables de Entrada ({inputColumns.length})</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {numericCols} numéricas · {categoricalCols} categóricas
              </span>
            </div>

            {inputColumns.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-950/75 p-4 rounded-2xl border border-slate-800/90">
                {inputColumns.map(col => {
                  const val = features[col.name] ?? ''
                  if (col.dtype === 'categorical') {
                    const categories = Object.keys(col.top_values || {})
                    return (
                      <div
                        key={col.name}
                        className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <label
                            className="text-slate-200 text-[11px] font-mono font-semibold truncate"
                            title={col.name}
                          >
                            {col.name}
                          </label>
                          <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
                            cat
                          </span>
                        </div>
                        <SystemSelect
                          value={String(val)}
                          onChange={v => setFeatures(prev => ({ ...prev, [col.name]: v }))}
                          size="xs"
                          searchable={categories.length >= 4}
                          searchPlaceholder={`Buscar en ${col.name}...`}
                          maxVisibleOptions={25}
                          ariaLabel={col.name}
                          options={categories.map(cat => ({ value: cat, label: cat }))}
                        />
                      </div>
                    )
                  }

                  const isInt =
                    Number.isInteger(col.min) &&
                    Number.isInteger(col.max) &&
                    (col.max ?? 100) - (col.min ?? 0) >= 5

                  return (
                    <div
                      key={col.name}
                      className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <label
                          className="text-slate-200 text-[11px] font-mono font-semibold truncate"
                          title={col.name}
                        >
                          {col.name}
                        </label>
                        {col.min !== undefined && col.max !== undefined && (
                          <span className="text-[9.5px] text-cyan-300/80 font-mono shrink-0">
                            [{Number(col.min).toFixed(isInt ? 0 : 1)}–{Number(col.max).toFixed(isInt ? 0 : 1)}]
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        step={isInt ? 1 : 'any'}
                        value={val}
                        onChange={e =>
                          setFeatures(prev => ({
                            ...prev,
                            [col.name]: e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-700/90 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 text-center">
                Metadatos de columnas no disponibles para este modelo.
              </div>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col justify-between gap-4 rounded-2xl bg-slate-950/80 border border-slate-800 p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Respuesta del Motor Keras</span>
                </span>
                {inferResult && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-300">
                    {inferResult.latency_ms} ms
                  </span>
                )}
              </div>

              {inferResult ? (
                <div className="space-y-4 animate-pop-in">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/12 via-cyan-500/10 to-indigo-500/10 border border-cyan-400/35 text-center space-y-1.5">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
                      Predicción para {inferResult.target_column}
                    </p>
                    <p className="text-xl font-extrabold font-mono text-white">
                      {inferResult.predicted_label}
                    </p>
                    {inferResult.probability !== null && (
                      <p className="text-xs font-mono text-emerald-300">
                        Confianza: <strong>{(inferResult.probability * 100).toFixed(2)}%</strong>
                      </p>
                    )}
                  </div>

                  {inferResult.probabilities && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-300">
                        Distribución de Probabilidades por Clase
                      </p>
                      <div className="space-y-2">
                        {Object.entries(inferResult.probabilities).map(([cls, p]) => {
                          const pct = Math.max(0, Math.min(100, p * 100))
                          return (
                            <div key={cls} className="space-y-1">
                              <div className="flex justify-between text-xs font-mono">
                                <span className="text-slate-300">Clase {cls}</span>
                                <span className="text-cyan-300 font-bold">{pct.toFixed(2)}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                                  style={{ width: `${Math.max(3, pct)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 px-4 text-center space-y-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">
                    Listo para evaluar el binario .keras
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Ajusta cualquier variable de entrada o carga una fila real y pulsa «Ejecutar Inferencia» para obtener la predicción.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  SHA-256
                </span>
                <span>{selectedModel.checksum.slice(0, 14)}…</span>
              </div>

              <button
                type="button"
                onClick={runSimulation}
                disabled={inferring || inputColumns.length === 0}
                className="nl-btn-shimmer w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 rounded-xl text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                {inferring ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>{inferring ? 'Evaluando .keras...' : 'Ejecutar Inferencia Real (.keras)'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-slate-900/65 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Test Accuracy certificada:{' '}
              <strong className="text-emerald-400 font-mono">
                {(selectedModel.test_metrics.test_accuracy * 100).toFixed(2)}%
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-white/15 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
