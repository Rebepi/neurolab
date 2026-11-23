import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, CheckCircle2, Layers, Loader2, Save, X } from 'lucide-react'
import { SystemSelect } from '../../../components/SystemSelect'
import type { LayerSpec } from '../../../types/index'
import type { ArchitectureHealth } from '../utils'

interface SaveArchitectureModalProps {
  archName: string
  onChangeArchName: (v: string) => void
  family: 'Feedforward' | 'RNN' | 'CNN' | 'GAN'
  onChangeFamily: (v: 'Feedforward' | 'RNN' | 'CNN' | 'GAN') => void
  justification: string
  onChangeJustification: (v: string) => void
  layersList: LayerSpec[]
  inputShape: number
  outputDim: number
  outputActivation: string
  totalParams: number
  health: ArchitectureHealth
  saving: boolean
  canNavigateToTraining: boolean
  onSave: (goToTraining: boolean) => void
  onClose: () => void
}

const INPUT_GLASS_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-[#071123]/90 hover:bg-[#0b1933]/95 border border-cyan-500/25 focus:border-teal-400/80 focus:ring-2 focus:ring-teal-400/20 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all'

export function SaveArchitectureModal({
  archName,
  onChangeArchName,
  family,
  onChangeFamily,
  justification,
  onChangeJustification,
  layersList,
  inputShape,
  outputDim,
  outputActivation,
  totalParams,
  health,
  saving,
  canNavigateToTraining,
  onSave,
  onClose,
}: SaveArchitectureModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving && !document.querySelector('[role="listbox"]')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])

  const memoryKb = ((totalParams * 4) / 1024).toFixed(1)
  const healthBadgeCls =
    health.status === 'optimal'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
      : health.status === 'acceptable'
        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/35'

  const isFormValid = Boolean(archName.trim()) && layersList.length > 0

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-backdrop-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-architecture-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div className="relative nl-cyber-panel rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-pop-in">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/85 via-indigo-400/80 to-violet-500/85" />

        <div className="shrink-0 px-6 py-4 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-cyan-500/35 flex items-center justify-center shrink-0">
              <Save className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2
                id="save-architecture-modal-title"
                className="text-base sm:text-lg font-bold text-white leading-tight"
              >
                Guardar Arquitectura
              </h2>
              <p className="text-xs text-slate-400">
                Registra esta topología Keras en el workspace para entrenarla en el Paso 04.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Cerrar modal guardar arquitectura"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-xl border border-cyan-500/25 bg-[#071123]/80 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                <Layers className="w-3.5 h-3.5" />
                Resumen de Topología ({layersList.length} capas ocultas)
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-emerald-300">
                  {totalParams.toLocaleString()} params
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-indigo-300">
                  {memoryKb} KB FP32
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-sans font-semibold ${healthBadgeCls}`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {health.label}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex items-center gap-1.5 min-w-max text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 font-semibold">
                  Input ({inputShape})
                </span>
                {layersList.map((layer, idx) => (
                  <div key={layer.id ?? idx} className="inline-flex items-center gap-1.5">
                    <span className="text-slate-600">→</span>
                    <span
                      className={`px-2 py-1 rounded-lg border ${
                        layer.type === 'Dense'
                          ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-200'
                          : layer.type === 'Dropout'
                            ? 'bg-amber-500/15 border-amber-500/35 text-amber-200'
                            : 'bg-teal-500/15 border-teal-500/35 text-teal-200'
                      }`}
                    >
                      {layer.type === 'Dense'
                        ? `Dense ${layer.units ?? 32} · ${layer.activation ?? 'relu'}`
                        : layer.type === 'Dropout'
                          ? `Drop ${Math.round((layer.rate ?? 0.2) * 100)}%`
                          : 'BatchNorm'}
                    </span>
                  </div>
                ))}
                <span className="text-slate-600">→</span>
                <span className="px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/35 text-violet-300 font-semibold">
                  Output ({outputDim} · {outputActivation})
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="save-arch-name" className="font-medium text-slate-200">
                  Nombre de Arquitectura <span className="text-cyan-400">*</span>
                </label>
                <span className="font-mono text-[11px] text-slate-500">{archName.length}/80</span>
              </div>
              <input
                id="save-arch-name"
                type="text"
                maxLength={80}
                value={archName}
                onChange={e => onChangeArchName(e.target.value)}
                placeholder="Ej: MLP Telecom · 48→24→12"
                className={INPUT_GLASS_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                Familia de Red
              </label>
              <SystemSelect
                value={family}
                onChange={val => onChangeFamily(val as 'Feedforward' | 'RNN' | 'CNN' | 'GAN')}
                size="md"
                ariaLabel="Familia de Red"
                options={[
                  {
                    value: 'Feedforward',
                    label: 'Feedforward / MLP (Tabular)',
                    description: 'Capas densas conectadas para datos estructurados',
                  },
                  {
                    value: 'CNN',
                    label: 'CNN (Convolucional)',
                    description: 'Extracción espacial o temporal mediante filtros',
                  },
                  {
                    value: 'RNN',
                    label: 'RNN / LSTM (Secuencias)',
                    description: 'Modelado de series temporales y dependencia secuencial',
                  },
                  {
                    value: 'GAN',
                    label: 'GAN (Generativa)',
                    description: 'Generación adversarial de distribuciones latentes',
                  },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="save-arch-justification" className="font-medium text-slate-200">
                  Justificación Técnica
                </label>
                <span className="font-mono text-[11px] text-slate-500">
                  {justification.length}/300
                </span>
              </div>
              <textarea
                id="save-arch-justification"
                rows={3}
                maxLength={300}
                value={justification}
                onChange={e => onChangeJustification(e.target.value)}
                placeholder="Documenta por qué esta profundidad, ancho y regularización encajan con el dataset..."
                className={`${INPUT_GLASS_CLASS} resize-none`}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-800/80 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>

          {canNavigateToTraining ? (
            <>
              <button
                type="button"
                disabled={saving || !isFormValid}
                onClick={() => onSave(false)}
                className="px-4 py-2 rounded-xl border border-cyan-500/35 bg-[#071123]/90 hover:bg-slate-800 text-cyan-200 text-xs sm:text-sm font-medium disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
              >
                Solo guardar
              </button>
              <button
                type="button"
                disabled={saving || !isFormValid}
                onClick={() => onSave(true)}
                className="nl-btn-shimmer inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-semibold shadow-md disabled:opacity-45 disabled:cursor-not-allowed transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>{saving ? 'Guardando...' : 'Guardar y Entrenar (04)'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={saving || !isFormValid}
              onClick={() => onSave(false)}
              className="nl-btn-shimmer inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-semibold shadow-md disabled:opacity-45 disabled:cursor-not-allowed transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Guardando...' : 'Guardar Arquitectura'}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
