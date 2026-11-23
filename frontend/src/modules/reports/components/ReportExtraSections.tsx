import type { ReactNode } from 'react'
import { Award, BarChart3, Clock, FilePlus2, Plus, Sliders, Sparkles, Star, TableProperties } from 'lucide-react'
import type { Dataset, EpochMetric, ModelVersion, TrainingJob } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'
import { formatJobDuration, parseCustomKvMetrics, parseCustomTable } from '../helpers'
import type { CustomBlockTone, CustomReportBlock } from '../types'

const TONE_STYLE: Record<CustomBlockTone, { border: string; badge: string; title: string }> = {
  teal: {
    border: 'border-teal-500/35',
    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/35',
    title: 'text-teal-300',
  },
  cyan: {
    border: 'border-cyan-500/35',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
    title: 'text-cyan-300',
  },
  indigo: {
    border: 'border-indigo-500/35',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35',
    title: 'text-indigo-300',
  },
  emerald: {
    border: 'border-emerald-500/35',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    title: 'text-emerald-300',
  },
  amber: {
    border: 'border-amber-500/35',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    title: 'text-amber-300',
  },
  rose: {
    border: 'border-rose-500/35',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    title: 'text-rose-300',
  },
}

export function FeatureDictionarySection({
  sectionNum,
  dataset,
  maxColumns,
  onOpenCustomizer,
  headerActions,
}: {
  sectionNum: string
  dataset: Dataset | null
  maxColumns: number
  onOpenCustomizer: () => void
  headerActions?: ReactNode
}) {
  const allCols = dataset?.metadata?.columns_summary || []
  const sliced = allCols.slice(0, maxColumns)

  return (
    <section className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs font-extrabold font-mono flex items-center justify-center">
            {sectionNum}
          </span>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
            <TableProperties className="w-3.5 h-3.5" />
            <span>Diccionario Técnico de Variables ({sliced.length} / {allCols.length})</span>
            <InfoTip
              text="Esquema real extraído del Auto-EDA con rango mínimo/máximo, promedio, desviación estándar y valores categóricos."
              size="xs"
            />
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {allCols.length > maxColumns && (
            <button
              type="button"
              onClick={onOpenCustomizer}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 flex items-center gap-1 nl-no-print"
            >
              <Sliders className="w-3 h-3" />
              <span>Ajustar límite ({maxColumns})</span>
            </button>
          )}
          {headerActions}
        </div>
      </div>

      {sliced.length > 0 ? (
        <div className="overflow-x-auto bg-slate-950/75 border border-slate-800 rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Variable</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Tipo</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-[10px]">Nulos</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-[10px]">Únicos</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Rango / Categorías</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Media ± Std</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {sliced.map(col => (
                <tr key={col.name} className="hover:bg-slate-900/60 transition-colors">
                  <td className="px-3 py-2 font-bold text-white flex items-center gap-1.5">
                    <span>{col.name}</span>
                    {col.is_target && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[9px]">
                        TARGET
                      </span>
                    )}
                    {col.excluded_reason && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[9px]">
                        Excluida
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${col.dtype === 'numeric'
                          ? 'bg-cyan-500/15 text-cyan-300'
                          : 'bg-violet-500/15 text-violet-300'
                        }`}
                    >
                      {col.dtype}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-slate-300">{col.missing}</td>
                  <td className="px-3 py-2 text-center text-slate-300">{col.unique}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {col.dtype === 'numeric'
                      ? `[${col.min ?? '—'} .. ${col.max ?? '—'}]`
                      : Object.keys(col.top_values || {}).slice(0, 3).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-cyan-300">
                    {col.dtype === 'numeric' && col.mean !== undefined
                      ? `${col.mean.toFixed(2)} ± ${col.std !== undefined ? col.std.toFixed(2) : '0'}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Sin diccionario de variables disponible en este dataset.</p>
      )}
    </section>
  )
}

export function EpochHistorySection({
  sectionNum,
  activeJob,
  epochMetrics,
  maxEpochs,
  headerActions,
}: {
  sectionNum: string
  activeJob: TrainingJob | null
  epochMetrics: EpochMetric[]
  maxEpochs: number
  headerActions?: ReactNode
}) {
  const bestEpochNum = epochMetrics.reduce(
    (best, cur) => (cur.val_accuracy > best.val_accuracy ? cur : best),
    epochMetrics[0] || ({ epoch: -1, val_accuracy: -1 } as EpochMetric)
  ).epoch
  const visible = epochMetrics.slice(0, maxEpochs)

  return (
    <section className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-lime-500/15 border border-lime-500/30 text-lime-400 text-xs font-extrabold font-mono flex items-center justify-center">
            {sectionNum}
          </span>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-lime-400 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Historial Detallado por Época ({epochMetrics.length} épocas)</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeJob && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-300">
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                Opt: <strong className="text-cyan-300">{activeJob.hyperparams.optimizer.toUpperCase()}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                LR: <strong className="text-amber-300">{activeJob.hyperparams.learning_rate}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                {formatJobDuration(activeJob.started_at, activeJob.ended_at)}
              </span>
            </div>
          )}
          {headerActions}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="overflow-x-auto bg-slate-950/75 border border-slate-800 rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Época</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Train Loss</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Train Acc</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Val Loss</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Val Acc</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Brecha Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {visible.map(ep => {
                const isBest = ep.epoch === bestEpochNum
                const gap = ep.val_loss - ep.loss
                return (
                  <tr
                    key={ep.epoch}
                    className={isBest ? 'bg-emerald-500/10' : 'hover:bg-slate-900/60'}
                  >
                    <td className="px-3 py-1.5 font-bold text-white flex items-center gap-1.5">
                      <span>Época {ep.epoch}</span>
                      {isBest && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px]">
                          <Star className="w-2.5 h-2.5" /> Mejor Val
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right text-amber-300">{ep.loss.toFixed(4)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-200">
                      {(ep.accuracy * 100).toFixed(2)}%
                    </td>
                    <td className="px-3 py-1.5 text-right text-cyan-300">{ep.val_loss.toFixed(4)}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-emerald-300">
                      {(ep.val_accuracy * 100).toFixed(2)}%
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right ${gap > 0.08 ? 'text-rose-400' : 'text-slate-400'
                        }`}
                    >
                      {gap >= 0 ? '+' : ''}
                      {gap.toFixed(4)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No hay registro de épocas disponible para el experimento seleccionado.</p>
      )}
    </section>
  )
}

export function ExperimentsRankingSection({
  sectionNum,
  jobs,
  models,
  activeJobId,
  headerActions,
}: {
  sectionNum: string
  jobs: TrainingJob[]
  models: ModelVersion[]
  activeJobId?: string
  headerActions?: ReactNode
}) {
  const sortedJobs = [...jobs].sort((a, b) => {
    const scoreA = a.model_version?.test_metrics?.test_accuracy ?? a.accuracy ?? 0
    const scoreB = b.model_version?.test_metrics?.test_accuracy ?? b.accuracy ?? 0
    return scoreB - scoreA
  })

  return (
    <section className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-400 text-xs font-extrabold font-mono flex items-center justify-center">
            {sectionNum}
          </span>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-fuchsia-400 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" />
            <span>Ranking Histórico de Experimentos ({jobs.length} corridas · {models.length} modelos)</span>
          </h3>
        </div>
        {headerActions}
      </div>

      {sortedJobs.length > 0 ? (
        <div className="overflow-x-auto bg-slate-950/75 border border-slate-800 rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">#</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Arquitectura</th>
                <th className="px-3 py-2 text-left font-bold uppercase text-[10px]">Optimizador / Épocas</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-[10px]">Estado</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Loss</th>
                <th className="px-3 py-2 text-right font-bold uppercase text-[10px]">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {sortedJobs.map((j, idx) => {
                const score = j.model_version?.test_metrics?.test_accuracy ?? j.accuracy
                const loss = j.model_version?.test_metrics?.test_loss ?? j.loss
                const isSelected = j.id === activeJobId
                return (
                  <tr
                    key={j.id}
                    className={isSelected ? 'bg-indigo-500/10' : 'hover:bg-slate-900/60'}
                  >
                    <td className="px-3 py-2 font-bold text-slate-400">#{idx + 1}</td>
                    <td className="px-3 py-2 font-sans font-bold text-white flex items-center gap-1.5">
                      <span>{j.arch_name || j.id}</span>
                      {idx === 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[9px]">
                          TOP 1
                        </span>
                      )}
                      {isSelected && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono text-[9px]">
                          ACTIVO
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {j.hyperparams.optimizer.toUpperCase()} · {j.current_epoch}/{j.total_epochs} ep.
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] bg-slate-900 border border-slate-700 text-slate-200">
                        {j.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-amber-300">
                      {loss != null ? loss.toFixed(4) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-300">
                      {score != null ? `${(score * 100).toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Aún no existen entrenamientos para rankear.</p>
      )}

      {models.length > 0 && (
        <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-2">
          <span className="text-[11px] font-bold text-slate-300 block">
            Versiones Certificadas en Registry ({models.length})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {models.map(m => (
              <div
                key={m.id}
                className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono"
              >
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">
                    {m.version} · <span className="text-emerald-300">{m.status}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">SHA: {m.checksum.slice(0, 14)}…</p>
                </div>
                <span className="text-cyan-300 font-bold shrink-0">
                  {(m.test_metrics.test_accuracy * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function CustomBlocksSection({
  sectionNum,
  customBlocks,
  onOpenBlocksCustomizer,
  headerActions,
}: {
  sectionNum: string
  customBlocks: CustomReportBlock[]
  onOpenBlocksCustomizer: () => void
  headerActions?: ReactNode
}) {
  const activeBlocks = customBlocks.filter(b => b.enabled)

  return (
    <section className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-extrabold font-mono flex items-center justify-center">
            {sectionNum}
          </span>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Bloques y Anexos Personalizados ({activeBlocks.length})</span>
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenBlocksCustomizer}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-400/40 text-teal-200 text-xs font-bold transition-colors nl-no-print"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir / Editar Bloques</span>
          </button>
          {headerActions}
        </div>
      </div>

      {activeBlocks.length === 0 ? (
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-6 text-center space-y-2">
          <Sparkles className="w-6 h-6 text-cyan-400 mx-auto opacity-75" />
          <p className="text-xs font-semibold text-slate-300">
            Añade tus propios anexos, KPIs, tablas de riesgos o planes de despliegue
          </p>
          <p className="text-[11px] text-slate-400">
            Todo lo que agregues aquí se incluirá en el PDF Ejecutivo, HTML y Markdown.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeBlocks.map(blk => {
            const st = TONE_STYLE[blk.tone] || TONE_STYLE.cyan
            return (
              <div
                key={blk.id}
                className={`p-4 rounded-xl bg-slate-950/75 border ${st.border} space-y-2.5`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className={`text-sm font-bold ${st.title}`}>{blk.title}</h4>
                    {blk.subtitle && <p className="text-xs text-slate-400">{blk.subtitle}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${st.badge}`}>
                    {blk.kind === 'callout'
                      ? 'Nota Destacada'
                      : blk.kind === 'bullets'
                        ? 'Lista'
                        : blk.kind === 'kv_metrics'
                          ? 'KPIs'
                          : 'Tabla'}
                  </span>
                </div>

                {blk.kind === 'callout' && (
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {blk.content}
                  </p>
                )}

                {blk.kind === 'bullets' && (
                  <ul className="space-y-1.5 text-xs text-slate-200 list-disc list-inside">
                    {blk.content
                      .split('\n')
                      .map(l => l.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                  </ul>
                )}

                {blk.kind === 'kv_metrics' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {parseCustomKvMetrics(blk.content).map((kv, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-800"
                      >
                        <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">
                          {kv.label}
                        </span>
                        <span className={`text-base font-extrabold font-mono mt-0.5 block ${st.title}`}>
                          {kv.value}
                        </span>
                        {kv.note && (
                          <span className="text-[10px] text-slate-400 block truncate">{kv.note}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {blk.kind === 'table' && (() => {
                  const tbl = parseCustomTable(blk.content)
                  return (
                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/70 text-slate-300">
                            {tbl.headers.map((h, i) => (
                              <th key={i} className="px-3 py-2 text-left font-bold text-[10.5px]">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {tbl.rows.map((r, ri) => (
                            <tr key={ri} className="hover:bg-slate-900/40">
                              {r.map((cell, ci) => (
                                <td key={ci} className="px-3 py-2 text-slate-200">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
