import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Layers, GitMerge, Cpu, CheckSquare, Square, Loader2, Sparkles } from 'lucide-react'
import { api } from '../services/api'
import type { Project, Dataset, CrossAreaFusionResponse } from '../types'
import { InfoTip } from './InfoTip'
import { SystemSelect } from './SystemSelect'
import { useToast } from './toast/ToastContext'

interface AreaEntry {
  project: Project
  datasets: Dataset[]
  selected: boolean
  chosenDatasetId: string
}

export function CrossAreaFusionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (res: CrossAreaFusionResponse) => void
}) {
  const { error: notifyError, success: notifySuccess } = useToast()
  const [entries, setEntries] = useState<AreaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modelName, setModelName] = useState('Modelo General Corporativo · Aura Telecom 360°')
  const [maxRowsPerArea, setMaxRowsPerArea] = useState(2500)
  const [autoTrain, setAutoTrain] = useState(true)
  const [epochs, setEpochs] = useState(25)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting && !document.querySelector('[role="listbox"]')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, submitting])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const projects = await api.getProjects()
        const areaProjects = projects.filter(p => p.id !== 'prj-modelo-general')
        const loaded = await Promise.all(
          areaProjects.map(async project => {
            const ds = await api.getProjectDatasets(project.id).catch(() => [])
            return {
              project,
              datasets: ds,
              selected: ds.length > 0,
              chosenDatasetId: ds[0]?.id || '',
            }
          })
        )
        if (active) setEntries(loaded)
      } catch (e: any) {
        if (active) notifyError('Error al cargar áreas', e?.message ?? 'No se pudieron obtener las áreas')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [notifyError])

  function toggleArea(projectId: string) {
    setEntries(prev =>
      prev.map(item =>
        item.project.id === projectId && item.datasets.length > 0
          ? { ...item, selected: !item.selected }
          : item
      )
    )
  }

  function changeDataset(projectId: string, datasetId: string) {
    setEntries(prev =>
      prev.map(item =>
        item.project.id === projectId ? { ...item, chosenDatasetId: datasetId } : item
      )
    )
  }

  const selectedEntries = entries.filter(e => e.selected && e.chosenDatasetId)

  async function handleRunCrossFusion() {
    if (selectedEntries.length < 2) {
      notifyError('Selecciona al menos 2 áreas', 'Para construir un Modelo General debes unir mínimo 2 divisiones corporativas.')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.fuseCrossAreas({
        areas: selectedEntries.map(e => ({
          project_id: e.project.id,
          dataset_id: e.chosenDatasetId,
        })),
        name: modelName.trim() || undefined,
        max_rows_per_area: maxRowsPerArea,
        auto_train: autoTrain,
        epochs,
      })
      notifySuccess(
        'Modelo General Corporativo 360° generado',
        `${res.fusion_report.areas_merged} áreas unificadas · ${res.fusion_report.final_rows.toLocaleString()} registros (${res.fusion_report.unified_input_shape} features armonizadas · Alerta ${res.fusion_report.overall_alert_rate_pct}%)`
      )
      onSuccess(res)
    } catch (e: any) {
      notifyError('Error en Fusión Cross-Área', e?.message ?? 'No se pudo unificar las áreas')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-backdrop-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cross-area-fusion-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="relative nl-cyber-panel rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-pop-in">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-teal-400/80 via-cyan-400/75 to-indigo-500/80" />
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500/20 to-indigo-500/20 border border-teal-500/40 flex items-center justify-center shrink-0">
              <GitMerge className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="cross-area-fusion-modal-title" className="text-base font-bold text-white">
                  Fusión Inteligente Cross-Área · Modelo General 360°
                </h3>
                <InfoTip
                  title="Motor de Armonización Cross-Área"
                  text="Proyecta cada división (Retención, NOC 5G, Antifraude y Comercial LTV) sobre un espacio tensorial común de 12 features normalizadas (Z-Score intra-área + One-Hot de dominio) y unifica el objetivo corporativo alerta_corporativa para entrenar una sola red TensorFlow global."
                  size="xs"
                />
              </div>
              <p className="text-xs text-slate-400">
                Une 2 o más áreas operativas eligiendo la versión exacta (individual o ya fusionada) de cada división.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Cerrar fusión cross-área"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <span>Nombre del Modelo Unificado</span>
              <InfoTip
                title="Proyecto Maestro Corporativo"
                text="Creará o actualizará el proyecto maestro prj-modelo-general con su dataset armonizado, arquitectura Keras multipropósito y modelo entrenado."
                size="xs"
              />
            </label>
            <input
              type="text"
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-400"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                Áreas Corporativas y Dataset Fuente ({selectedEntries.length} seleccionadas)
              </span>
              <InfoTip
                title="Selección de Versión por Área"
                text="Si previamente fusionaste varios CSVs dentro de un área (ej. Retención 15K + Q4 5K = 20K), puedes elegir directamente ese dataset fusionado como aporte al Modelo General."
                size="xs"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-16 rounded-xl bg-slate-800/70 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {entries.map(item => {
                  const disabled = item.datasets.length === 0
                  return (
                    <div
                      key={item.project.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.selected
                          ? 'bg-slate-950/90 border-teal-500/50 shadow-sm shadow-teal-500/10'
                          : 'bg-slate-950/40 border-slate-800 opacity-75'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleArea(item.project.id)}
                        className="flex items-start gap-2.5 text-left disabled:opacity-50"
                      >
                        {item.selected ? (
                          <CheckSquare className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-white">
                            {item.project.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {item.datasets.length > 0
                              ? `${item.datasets.length} dataset(s) disponibles`
                              : 'Sin datasets cargados en esta área'}
                          </div>
                        </div>
                      </button>

                      {item.datasets.length > 0 && (
                        <SystemSelect
                          value={item.chosenDatasetId}
                          disabled={!item.selected}
                          onChange={val => changeDataset(item.project.id, val)}
                          className="sm:w-72"
                          size="xs"
                          menuMinWidth={300}
                          searchable
                          searchPlaceholder="Buscar dataset o versión..."
                          maxVisibleOptions={25}
                          options={item.datasets.map(ds => ({
                            value: ds.id,
                            label: ds.name,
                            badge: `${(ds.splits.train_count + ds.splits.val_count + ds.splits.test_count).toLocaleString()} filas`,
                            description: `${ds.input_shape} features · v${ds.version}`,
                            keywords: `${ds.target} v${ds.version}`,
                          }))}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <span>Muestreo Balanceado / Área</span>
                <InfoTip
                  title="Equilibrio Inter-Áreas"
                  text="Limita el aporte máximo de filas por área para evitar que un área muy grande domine los gradientes sobre otra área."
                  size="xs"
                />
              </label>
              <SystemSelect
                value={String(maxRowsPerArea)}
                onChange={val => setMaxRowsPerArea(Number(val))}
                size="sm"
                options={[
                  { value: '1500', label: '1,500 registros / área', description: 'Muestreo rápido' },
                  { value: '2500', label: '2,500 registros / área', description: 'Equilibrado recomendado' },
                  { value: '5000', label: '5,000 registros / área', description: 'Alta cobertura' },
                  { value: '8000', label: '8,000 registros / área', description: 'Cobertura máxima' },
                ]}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <span>Entrenar Red Keras Automático</span>
                <InfoTip
                  title="Auto-Entrenamiento TensorFlow"
                  text="Si está activado, encola inmediatamente un Job real en TensorFlow/Keras para entrenar el Modelo General Corporativo tras armonizar las áreas."
                  size="xs"
                />
              </label>
              <button
                type="button"
                onClick={() => setAutoTrain(v => !v)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  autoTrain
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-slate-700 text-slate-400'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {autoTrain ? 'Activado (Keras Real)' : 'Solo Generar Dataset'}
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <span>Épocas de Entrenamiento</span>
                <InfoTip
                  title="Ciclos de Backpropagation"
                  text="Número de épocas para optimizar la red profunda (128→64→32) del Modelo General 360°."
                  size="xs"
                />
              </label>
              <SystemSelect
                value={String(epochs)}
                disabled={!autoTrain}
                onChange={val => setEpochs(Number(val))}
                size="sm"
                options={[
                  { value: '15', label: '15 épocas', badge: 'Rápido' },
                  { value: '25', label: '25 épocas', badge: 'Balanceado' },
                  { value: '40', label: '40 épocas', badge: 'Alta Precisión' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting || selectedEntries.length < 2}
            onClick={handleRunCrossFusion}
            className="nl-btn-shimmer flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
            <span>
              {submitting ? 'Armonizando tensores...' : `Unir ${selectedEntries.length} Áreas y Construir Modelo 360°`}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
