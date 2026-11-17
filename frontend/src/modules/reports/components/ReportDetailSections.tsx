import {
  ArrowRight, CheckCircle2, Copy, ShieldCheck, GitCompare, MessageSquareText, Lightbulb
} from 'lucide-react'
import type {
  Project, Dataset, Architecture, TrainingJob, ModelVersion, EpochMetric, TestMetrics
} from '../../../types/index'
import type { ExecutiveDiagnostic, SectionKey } from '../types'
import { problemLabel } from '../helpers'
import { InfoTip } from '../../../components/InfoTip'
import { MiniConvergenceChart } from './MiniConvergenceChart'

interface ReportDetailSectionsProps {
  selectedSections: Record<SectionKey, boolean>
  project: Project | null
  currentProject: { id: string; name: string }
  primaryDataset: Dataset | null
  primaryArch: Architecture | null
  activeJob: TrainingJob | null
  comparisonJob: TrainingJob | null
  resolvedModel: ModelVersion | null
  resolvedMetrics: TestMetrics | null
  epochMetrics: EpochMetric[]
  jobsCount: number
  modelsCount: number
  displayAcc: number | null
  displayLoss: number | null
  copiedKey: string | null
  onCopy: (key: string, text: string) => void
  diagnostic: ExecutiveDiagnostic
  auditorNotes: string
  onAuditorNotesChange: (value: string) => void
}

export function ReportDetailSections({
  selectedSections,
  project,
  currentProject,
  primaryDataset,
  primaryArch,
  activeJob,
  comparisonJob,
  resolvedModel,
  resolvedMetrics,
  epochMetrics,
  jobsCount,
  modelsCount,
  displayAcc,
  displayLoss,
  copiedKey,
  onCopy,
  diagnostic,
  auditorNotes,
  onAuditorNotesChange,
}: ReportDetailSectionsProps) {
  const totalSplitRows = primaryDataset
    ? (primaryDataset.splits?.train_count || 0) + (primaryDataset.splits?.val_count || 0) + (primaryDataset.splits?.test_count || 0)
    : 0
  const trainPct = primaryDataset && totalSplitRows > 0 ? (primaryDataset.splits.train_count / totalSplitRows) * 100 : 70
  const valPct = primaryDataset && totalSplitRows > 0 ? (primaryDataset.splits.val_count / totalSplitRows) * 100 : 15
  const testPct = primaryDataset && totalSplitRows > 0 ? (primaryDataset.splits.test_count / totalSplitRows) * 100 : 15

  const compAcc = comparisonJob ? (comparisonJob.model_version?.test_metrics?.test_accuracy ?? comparisonJob.accuracy ?? null) : null
  const compLoss = comparisonJob ? (comparisonJob.model_version?.test_metrics?.test_loss ?? comparisonJob.loss ?? null) : null
  const deltaAcc = displayAcc != null && compAcc != null ? (displayAcc - compAcc) * 100 : null
  const deltaLoss = displayLoss != null && compLoss != null ? displayLoss - compLoss : null

  return (
    <>
      {selectedSections.projectContext && (
        <section className="nl-surface animate-card-reveal rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-extrabold font-mono flex items-center justify-center">
                01
              </span>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">
                Contexto del Proyecto
              </h3>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
              {project?.status || 'ACTIVE'}
            </span>
          </div>

          <div>
            <h4 className="text-xl font-extrabold text-white">
              {project?.name || currentProject.name}
            </h4>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              {project?.description || 'Sin descripción disponible.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">ID Workspace</span>
              <div className="flex items-center justify-between gap-1 mt-1">
                <code className="text-slate-200 font-mono truncate">{project?.id || currentProject.id}</code>
                <button
                  onClick={() => onCopy('proj-id', project?.id || currentProject.id)}
                  className="text-indigo-400 hover:text-indigo-300 shrink-0 nl-no-print"
                  aria-label="Copiar ID de proyecto"
                >
                  {copiedKey === 'proj-id' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Miembros RBAC</span>
              <span className="text-white font-bold text-sm mt-1 block">{project?.members?.length ?? 1} integrantes</span>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Corridas / Modelos</span>
              <span className="text-white font-bold font-mono text-sm mt-1 block">{jobsCount} runs · {modelsCount} vers.</span>
            </div>
            <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Última Actualización</span>
              <span className="text-slate-200 font-medium mt-1 block">
                {project?.updated_at ? new Date(project.updated_at).toLocaleDateString('es-ES') : 'Reciente'}
              </span>
            </div>
          </div>

          {project?.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {project.tags.map(t => (
                <span key={t} className="px-2.5 py-0.5 rounded-full bg-slate-950 text-slate-300 border border-slate-800 text-[11px] font-medium">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedSections.datasetEda && (
        <section className="nl-surface animate-card-reveal rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-extrabold font-mono flex items-center justify-center">
                02
              </span>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                Especificación y Partición EDA del Dataset
              </h3>
            </div>
            {primaryDataset && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                {problemLabel(primaryDataset.metadata?.problem_type)}
              </span>
            )}
          </div>

          {primaryDataset ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="sm:col-span-2 bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Dataset Primario</span>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-sm font-bold text-white break-words">{primaryDataset.name}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-cyan-300 shrink-0">
                      v{primaryDataset.version}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Input Shape & Target</span>
                  <span className="text-sm font-bold text-white font-mono mt-1 block">
                    {primaryDataset.input_shape}D <span className="text-slate-500">→</span> <span className="text-cyan-400">{primaryDataset.target}</span>
                  </span>
                </div>
                <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Preprocesamiento</span>
                  <span className="text-sm font-bold text-slate-200 mt-1 block capitalize">
                    Escalado {primaryDataset.metadata?.scaler_applied || 'Standard'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <span>Partición Estratificada ({totalSplitRows} registros)</span>
                    <InfoTip text="Train ajusta los pesos, Validación supervisa el sobreajuste por época y Test (15%) queda aislado para evaluación final." size="xs" />
                  </span>
                  <span className="font-mono text-emerald-400 font-bold text-[11px]">Test 100% Sellado</span>
                </div>
                <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-900">
                  <div style={{ width: `${trainPct}%` }} className="bg-indigo-500 h-full" />
                  <div style={{ width: `${valPct}%` }} className="bg-amber-400 h-full" />
                  <div style={{ width: `${testPct}%` }} className="bg-emerald-500 h-full" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                    Train: <strong>{primaryDataset.splits?.train_count || 0}</strong> ({trainPct.toFixed(0)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    Validación: <strong>{primaryDataset.splits?.val_count || 0}</strong> ({valPct.toFixed(0)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Test Sellado: <strong>{primaryDataset.splits?.test_count || 0}</strong> ({testPct.toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No se ha registrado ningún dataset aún.</p>
          )}
        </section>
      )}

      {selectedSections.networkArch && (
        <section className="nl-surface animate-card-reveal rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-extrabold font-mono flex items-center justify-center">
                03
              </span>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-violet-400">
                Topología de Red Neuronal
              </h3>
            </div>
            {primaryArch && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 font-semibold">
                {primaryArch.family} · v{primaryArch.version}
              </span>
            )}
          </div>

          {primaryArch ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Arquitectura</span>
                  <span className="text-sm font-bold text-white mt-1 block">{primaryArch.name}</span>
                </div>
                <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Parámetros Entrenables</span>
                  <span className="text-sm font-extrabold font-mono text-indigo-400 mt-1 block">
                    {primaryArch.total_parameters?.toLocaleString('es') ?? 0} pesos/sesgos
                  </span>
                </div>
                <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Capa de Salida</span>
                  <span className="text-sm font-bold font-mono text-violet-300 mt-1 block">
                    {primaryArch.config.output_dim} neurona · {primaryArch.config.output_activation}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Flujo Secuencial de Capas</span>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold">
                    Input({primaryArch.config.input_shape})
                  </span>
                  {primaryArch.config.layers.map(layer => (
                    <span key={layer.id} className="inline-flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
                        {layer.type === 'Dense'
                          ? `Dense(${layer.units} · ${layer.activation})`
                          : layer.type === 'Dropout'
                            ? `Dropout(${layer.rate})`
                            : layer.type}
                      </span>
                    </span>
                  ))}
                </div>
                {primaryArch.justification && (
                  <p className="text-xs text-slate-400 pt-1 leading-relaxed border-t border-slate-800/80">
                    {primaryArch.justification}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No se ha configurado ninguna arquitectura aún.</p>
          )}
        </section>
      )}

      {selectedSections.trainingMetrics && (
        <section className="nl-surface animate-card-reveal rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold font-mono flex items-center justify-center">
                04
              </span>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                Métricas de Evaluación, Curvas y Recomendaciones
              </h3>
            </div>
            {activeJob && (
              <span className="text-[11px] font-mono text-slate-400">
                {activeJob.hyperparams.optimizer.toUpperCase()} · lr={activeJob.hyperparams.learning_rate} · batch={activeJob.hyperparams.batch_size} · {activeJob.current_epoch}/{activeJob.total_epochs} ep.
              </span>
            )}
          </div>

          {activeJob || resolvedMetrics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  {
                    label: 'Test Accuracy',
                    value: displayAcc != null ? `${(displayAcc * 100).toFixed(2)}%` : '—',
                    cls: 'text-emerald-400',
                  },
                  {
                    label: 'Test Loss',
                    value: displayLoss != null ? displayLoss.toFixed(4) : '—',
                    cls: 'text-amber-400',
                  },
                  {
                    label: 'Precision',
                    value: resolvedMetrics?.precision != null ? `${(resolvedMetrics.precision * 100).toFixed(2)}%` : '—',
                    cls: 'text-indigo-400',
                  },
                  {
                    label: 'Recall',
                    value: resolvedMetrics?.recall != null ? `${(resolvedMetrics.recall * 100).toFixed(2)}%` : '—',
                    cls: 'text-violet-400',
                  },
                  {
                    label: 'F1-Score',
                    value: resolvedMetrics?.f1_score != null ? `${(resolvedMetrics.f1_score * 100).toFixed(2)}%` : '—',
                    cls: 'text-cyan-400',
                  },
                ].map(metric => (
                  <div key={metric.label} className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{metric.label}</span>
                    <span className={`text-lg font-extrabold font-mono mt-1 block ${metric.cls}`}>
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>

              {comparisonJob && comparisonJob.id !== activeJob?.id && (
                <div className="bg-slate-950/75 border border-cyan-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <p className="font-bold text-white">
                        Comparativa contra: {comparisonJob.arch_name || comparisonJob.id.slice(0, 10)}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Ref: {compAcc != null ? `${(compAcc * 100).toFixed(2)}%` : '—'} · Loss {compLoss != null ? compLoss.toFixed(4) : '—'} · {comparisonJob.hyperparams.optimizer.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 font-mono font-bold">
                    {deltaAcc != null && (
                      <span className={`px-2.5 py-1 rounded-lg border ${
                        deltaAcc >= 0
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}>
                        Δ Acc: {deltaAcc >= 0 ? '+' : ''}{deltaAcc.toFixed(2)}%
                      </span>
                    )}
                    {deltaLoss != null && (
                      <span className={`px-2.5 py-1 rounded-lg border ${
                        deltaLoss <= 0
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}>
                        Δ Loss: {deltaLoss >= 0 ? '+' : ''}{deltaLoss.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(epochMetrics.length > 1 || (resolvedModel?.confusion_matrix && resolvedModel.confusion_matrix.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {epochMetrics.length > 1 && (
                    <div className={resolvedModel?.confusion_matrix?.length ? 'md:col-span-7' : 'md:col-span-12'}>
                      <MiniConvergenceChart metrics={epochMetrics} />
                    </div>
                  )}

                  {resolvedModel?.confusion_matrix && resolvedModel.confusion_matrix.length > 0 && (
                    <div className={`${epochMetrics.length > 1 ? 'md:col-span-5' : 'md:col-span-12'} bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-2`}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-300 flex items-center gap-1.5">
                          <span>Matriz de Confusión (Test)</span>
                          <InfoTip text="Diagonal verde = aciertos por clase; celdas rojas = errores entre clase real y predicción." size="xs" />
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="mx-auto border-separate border-spacing-1 text-xs font-mono">
                          <thead>
                            <tr>
                              <th className="w-12"></th>
                              {resolvedModel.confusion_matrix[0].map((_, ci) => (
                                <th key={ci} className="text-[10px] text-slate-400 px-2 pb-0.5">Pred {ci}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {resolvedModel.confusion_matrix.map((row, ri) => (
                              <tr key={ri}>
                                <td className="text-[10px] text-slate-400 pr-1.5 text-right">Real {ri}</td>
                                {row.map((val, ci) => (
                                  <td
                                    key={ci}
                                    className={`px-3 py-1.5 rounded-lg text-center font-bold ${
                                      ri === ci
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    }`}
                                  >
                                    {val}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Recomendaciones Técnicas del Motor</span>
                </div>
                <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                  {diagnostic.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No hay ejecuciones completadas para extraer métricas.</p>
          )}
        </section>
      )}

      {selectedSections.modelRegistry && (
        <section className="nl-surface animate-card-reveal rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-extrabold font-mono flex items-center justify-center">
                05
              </span>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-400">
                Model Registry e Integridad Criptográfica
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{modelsCount} versión(es) en repositorio</span>
          </div>

          {resolvedModel ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Versión Seleccionada</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-extrabold font-mono text-purple-300">{resolvedModel.version}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">Inmutable</span>
                  </div>
                </div>
                <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Estado de Gobernanza</span>
                  <span className="text-sm font-bold text-emerald-400 mt-1 block">{resolvedModel.status}</span>
                </div>
                <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Fecha de Registro</span>
                  <span className="text-sm font-medium text-slate-200 mt-1 block">
                    {new Date(resolvedModel.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-400 font-semibold shrink-0">SHA-256:</span>
                  <code className="font-mono text-slate-200 truncate">{resolvedModel.checksum}</code>
                </div>
                <button
                  onClick={() => onCopy('registry-hash', resolvedModel.checksum)}
                  className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 shrink-0 nl-no-print"
                >
                  {copiedKey === 'registry-hash' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'registry-hash' ? 'Hash copiado' : 'Copiar firma'}</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No hay modelos registrados en el repositorio.</p>
          )}

          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-2">
            <label className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Observaciones y Dictamen del Revisor</span>
                <InfoTip text="Estas notas ejecutivas se incluyen automáticamente al exportar el PDF Certificado, JSON o Resumen Markdown." size="xs" />
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Incluido en PDF/JSON</span>
            </label>
            <textarea
              rows={2}
              value={auditorNotes}
              onChange={e => onAuditorNotesChange(e.target.value)}
              placeholder="Ej.: Modelo validado para despliegue piloto; estabilidad verificada sobre partición Test aislada..."
              className="w-full bg-slate-900/90 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none resize-y"
            />
          </div>
        </section>
      )}
    </>
  )
}

