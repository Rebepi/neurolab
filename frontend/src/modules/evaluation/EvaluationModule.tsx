import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Cpu,
  Database,
  Layers,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { api } from '../../services/api'
import type { EpochMetric, ModelVersion, TrainingJob } from '../../types/index'
import { InfoTip } from '../../components/InfoTip'
import { ModuleStudioHero } from '../../components/ModuleStudioHero'
import { SystemSelect } from '../../components/SystemSelect'
import { useToast } from '../../components/toast/ToastContext'
import { ExperimentsComparisonTable } from './components/ExperimentsComparisonTable'
import { LearningCurvesPanel } from './components/LearningCurvesPanel'
import { TestMetricsPanel } from './components/TestMetricsPanel'

const GLASS_PANEL = 'nl-cyber-panel rounded-2xl animate-card-reveal'

export default function EvaluationModule({
  currentProject,
  onNavigate,
}: {
  currentProject: any
  onNavigate?: (module: string) => void
}) {
  const toast = useToast()
  const [completedJobs, setCompletedJobs] = useState<TrainingJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [metricsMap, setMetricsMap] = useState<Record<string, EpochMetric[]>>({})
  const [loading, setLoading] = useState(true)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    if (!currentProject) return
    setLoading(true)
    Promise.all([
      api.getProjectJobs(currentProject.id),
      api.getProjectModels(currentProject.id).catch(() => [] as ModelVersion[]),
    ])
      .then(([jobs, models]) => {
        const modelByJobId = new Map<string, ModelVersion>()
        models.forEach(m => {
          if (m.job_id) modelByJobId.set(m.job_id, m)
        })
        const done = jobs
          .filter(j => j.status === 'COMPLETED')
          .map(j => ({
            ...j,
            model_version: j.model_version ?? modelByJobId.get(j.id),
          }))
        setCompletedJobs(done)
        if (done.length > 0) {
          setSelectedJobId(prev => (prev && done.some(d => d.id === prev) ? prev : done[0].id))
        } else {
          setSelectedJobId(null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentProject])

  useEffect(() => {
    if (!selectedJobId || metricsMap[selectedJobId]) return
    api
      .getJobMetrics(selectedJobId)
      .then(metrics => {
        setMetricsMap(prev => ({ ...prev, [selectedJobId]: metrics }))
      })
      .catch(() => {})
  }, [selectedJobId, metricsMap])

  const selectedJob = completedJobs.find(j => j.id === selectedJobId) ?? null
  const metrics = selectedJobId ? (metricsMap[selectedJobId] ?? []) : []

  useEffect(() => {
    setNotesDraft(selectedJob?.notes ?? '')
  }, [selectedJob?.id, selectedJob?.notes])

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
        <BarChart2 size={56} className="opacity-30" />
        <p className="text-lg">Selecciona un proyecto para ver evaluaciones</p>
      </div>
    )
  }

  async function handleSaveNotes() {
    if (!selectedJob) return
    setSavingNotes(true)
    try {
      await api.updateJobNotes(selectedJob.id, notesDraft)
      setCompletedJobs(prev =>
        prev.map(j => (j.id === selectedJob.id ? { ...j, notes: notesDraft } : j))
      )
      toast.success('Observaciones guardadas', 'Limitaciones y notas registradas en la ejecución')
    } catch (e: any) {
      toast.error('Error al guardar observaciones', e.message || 'No se pudo actualizar las notas')
    } finally {
      setSavingNotes(false)
    }
  }

  const selectedTestMetrics = selectedJob?.model_version?.test_metrics
  const selectedTestAcc = selectedTestMetrics?.test_accuracy ?? selectedJob?.val_accuracy ?? selectedJob?.accuracy
  const selectedTestLoss = selectedTestMetrics?.test_loss ?? selectedJob?.val_loss ?? selectedJob?.loss
  const selectedF1 = selectedTestMetrics?.f1_score

  const trainValGap =
    selectedJob && typeof selectedJob.accuracy === 'number' && typeof selectedJob.val_accuracy === 'number'
      ? Math.abs(selectedJob.accuracy - selectedJob.val_accuracy)
      : null

  const diagnosis =
    trainValGap === null
      ? {
          label: 'Auditado en Test',
          cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
          desc: 'Métricas verificadas sobre la partición de prueba.',
        }
      : trainValGap <= 0.045
        ? {
            label: 'Generalización Óptima',
            cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
            desc: `Brecha Train/Val reducida (${(trainValGap * 100).toFixed(2)} pts); sin señales de sobreajuste.`,
          }
        : trainValGap <= 0.09
          ? {
              label: 'Brecha Moderada',
              cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
              desc: `Diferencia Train/Val de ${(trainValGap * 100).toFixed(2)} pts; revisar regularización si se agregan épocas.`,
            }
          : {
              label: 'Riesgo de Sobreajuste',
              cls: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
              desc: `Brecha Train/Val alta (${(trainValGap * 100).toFixed(2)} pts); considera aumentar Dropout o reducir épocas.`,
            }

  const jobSelectOptions = completedJobs.map((job, idx) => {
    const tAcc = job.model_version?.test_metrics?.test_accuracy ?? job.val_accuracy ?? job.accuracy
    const accText = tAcc != null ? `${(tAcc * 100).toFixed(2)}%` : '—'
    return {
      value: job.id,
      label: `#${completedJobs.length - idx} · ${job.arch_name || job.id.slice(0, 10)} (${accText})`,
      keywords: `${job.id} ${job.arch_name ?? ''} ${job.dataset_name ?? ''}`,
    }
  })

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <ModuleStudioHero
        variant="radar"
        eyebrow="AUDITORÍA SOBRE TEST SELLADO (15%) & CURVAS TRAIN/VAL"
        title="Evaluación"
        highlight="& Matriz Test"
        subtitle={`Validación imparcial sin fuga de datos y diagnóstico gráfico profundo para ${currentProject.name}.`}
        icon={BarChart2}
        tipTitle="Evaluación sobre Partición Sellada"
        tipText="Las métricas finales se calculan una única vez sobre el 15% de datos jamás vistos durante el ajuste de gradientes."
        metrics={[
          { label: 'Evaluaciones', value: completedJobs.length, tone: 'cyan' },
          ...(selectedTestAcc != null
            ? [{ label: 'Exactitud Test', value: `${(selectedTestAcc * 100).toFixed(2)}%`, tone: 'emerald' as const }]
            : []),
          ...(selectedTestLoss != null
            ? [{ label: 'Loss Test', value: selectedTestLoss.toFixed(4), tone: 'amber' as const }]
            : []),
          ...(selectedF1 != null
            ? [{ label: 'F1-Score', value: `${(selectedF1 * 100).toFixed(2)}%`, tone: 'violet' as const }]
            : []),
        ]}
        actions={
          completedJobs.length > 0 && onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate('models')}
              className="nl-btn-shimmer flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <span>Siguiente Paso: Model Registry &amp; Inferencia (06)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="nl-skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : completedJobs.length === 0 ? (
        <div className={`${GLASS_PANEL} flex flex-col items-center justify-center gap-4 py-20 text-slate-400`}>
          <BarChart2 size={48} className="opacity-30" />
          <p className="text-lg text-center">
            Sin evaluaciones disponibles. Completa un entrenamiento para desbloquear las gráficas y la matriz de test.
          </p>
        </div>
      ) : (
        <>
          <div className={`${GLASS_PANEL} p-4 relative overflow-hidden space-y-3`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-indigo-400 to-emerald-400" />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300 shrink-0">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-white truncate">
                      Corrida Auditada &amp; Diagnóstico de Modelo
                    </h3>
                    <InfoTip
                      title="Selector de Corrida Auditada"
                      text="Selecciona cualquier entrenamiento completado para inspeccionar sus curvas época por época, su matriz de confusión en Test sellado y sus métricas por clase."
                      hint="Los datos de Test (15%) nunca participan en el entrenamiento ni en el ajuste de hiperparámetros."
                      size="xs"
                    />
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedJob?.arch_name || 'Arquitectura Keras'} · {selectedJob?.dataset_name || 'Dataset del área'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${diagnosis.cls}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{diagnosis.label}</span>
                  <InfoTip
                    title="Diagnóstico de Generalización"
                    text={diagnosis.desc}
                    hint="Compara la exactitud de Entrenamiento (70%) frente a Validación (15%)."
                    size="xs"
                  />
                </span>

                <div className="w-72">
                  <SystemSelect
                    value={selectedJobId || ''}
                    onChange={val => setSelectedJobId(val)}
                    size="xs"
                    searchable={completedJobs.length > 4}
                    searchPlaceholder="Buscar corrida o arquitectura..."
                    ariaLabel="Seleccionar corrida completada"
                    options={jobSelectOptions}
                  />
                </div>
              </div>
            </div>

            {completedJobs.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                {completedJobs.map((job, idx) => {
                  const active = selectedJobId === job.id
                  const acc = job.model_version?.test_metrics?.test_accuracy ?? job.val_accuracy ?? job.accuracy
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setSelectedJobId(job.id)}
                      className={`nl-card-interactive shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all ${
                        active
                          ? 'border-cyan-400/70 bg-cyan-500/15 text-white shadow-sm'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-mono text-[11px] text-cyan-300">#{completedJobs.length - idx}</span>
                      <span className="max-w-[140px] truncate">{job.arch_name || job.id.slice(0, 8)}</span>
                      {acc != null && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 font-mono text-[10px] text-emerald-300">
                          {(acc * 100).toFixed(1)}%
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {selectedJob && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800/80">
                <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Arquitectura</span>
                  </p>
                  <p className="text-xs font-bold text-white truncate mt-0.5">
                    {selectedJob.arch_name || 'MLP Keras'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Database className="w-3 h-3 text-violet-400 shrink-0" />
                    <span>Target Objetivo</span>
                  </p>
                  <p className="text-xs font-mono font-bold text-violet-300 truncate mt-0.5">
                    {selectedJob.model_version?.target_column || 'Variable objetivo'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Épocas Ejecutadas</span>
                  </p>
                  <p className="text-xs font-mono font-bold text-emerald-300 truncate mt-0.5">
                    {selectedJob.current_epoch}/{selectedJob.total_epochs} épocas
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span>Optimizador &amp; LR</span>
                  </p>
                  <p className="text-xs font-mono font-bold text-indigo-300 truncate mt-0.5">
                    {(selectedJob.hyperparams?.optimizer || 'adam').toUpperCase()} · lr{' '}
                    {selectedJob.hyperparams?.learning_rate ?? 0.001}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-teal-400 shrink-0" />
                    <span>Muestras Test (15%)</span>
                  </p>
                  <p className="text-xs font-mono font-bold text-teal-300 truncate mt-0.5">
                    {selectedTestMetrics?.total_test_samples?.toLocaleString('es-ES') ?? 'Sellado'} muestras
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Versión &amp; Batch</p>
                  <p className="text-xs font-mono font-bold text-amber-300 truncate mt-0.5">
                    {(selectedJob.model_version?.version || 'v1.0.0').replace(/^v?/i, 'v')} · batch{' '}
                    {selectedJob.hyperparams?.batch_size ?? 32}
                  </p>
                </div>
              </div>
            )}
          </div>

          {selectedJob && (
            <>
              <TestMetricsPanel
                job={selectedJob}
                testMetrics={selectedJob.model_version?.test_metrics}
                confusionMatrix={selectedJob.model_version?.confusion_matrix}
                targetColumn={selectedJob.model_version?.target_column}
                glassPanelClass={GLASS_PANEL}
              />

              <LearningCurvesPanel metrics={metrics} glassPanelClass={GLASS_PANEL} />

              <ExperimentsComparisonTable
                completedJobs={completedJobs}
                selectedJobId={selectedJobId}
                onSelectJob={setSelectedJobId}
                glassPanelClass={GLASS_PANEL}
              />

              <div className={`${GLASS_PANEL} p-4 space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Registro de Limitaciones y Observaciones
                    </h3>
                    <p className="text-xs text-slate-400">
                      Documenta hallazgos, sesgos detectados o recomendaciones antes de aprobar el modelo.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={savingNotes}
                    onClick={handleSaveNotes}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    {savingNotes ? 'Guardando...' : 'Guardar Observaciones'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  placeholder="Ej: Buena generalización en Test; monitorear falsos negativos en segmentos de alta latencia..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
