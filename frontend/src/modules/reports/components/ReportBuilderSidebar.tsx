import { CheckSquare, Square, ShieldCheck, GitCompare } from 'lucide-react'
import type { ModelVersion, TrainingJob } from '../../../types/index'
import type { SectionKey } from '../types'
import { SECTION_META } from '../constants'
import { InfoTip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'

interface ReportBuilderSidebarProps {
  selectedSections: Record<SectionKey, boolean>
  onToggleSection: (key: SectionKey) => void
  onSelectAll: () => void
  onSelectPresetSummary: () => void
  jobs: TrainingJob[]
  models: ModelVersion[]
  activeJob: TrainingJob | null
  comparisonJob: TrainingJob | null
  resolvedModel: ModelVersion | null
  onChangeJobId: (id: string) => void
  onChangeComparisonJobId: (id: string) => void
  onChangeModelId: (id: string) => void
}

export function ReportBuilderSidebar({
  selectedSections,
  onToggleSection,
  onSelectAll,
  onSelectPresetSummary,
  jobs,
  models,
  activeJob,
  comparisonJob,
  resolvedModel,
  onChangeJobId,
  onChangeComparisonJobId,
  onChangeModelId,
}: ReportBuilderSidebarProps) {
  return (
    <aside className="lg:col-span-4 xl:col-span-3 nl-surface nl-no-print rounded-2xl p-4 space-y-4 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
          <span>Constructor del Informe</span>
          <InfoTip
            text="Activa o desactiva bloques para personalizar tanto esta vista ejecutiva como el PDF y el paquete JSON."
            size="xs"
          />
        </h2>
        <div className="flex items-center gap-1 text-[10px] font-bold">
          <button
            onClick={onSelectAll}
            className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-400 transition-colors"
          >
            Todas
          </button>
          <button
            onClick={onSelectPresetSummary}
            className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            Resumen
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {SECTION_META.map(sec => {
          const checked = selectedSections[sec.key]
          const Icon = sec.Icon
          return (
            <button
              key={sec.key}
              onClick={() => onToggleSection(sec.key)}
              className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left border transition-all ${
                checked
                  ? 'bg-slate-950/90 border-indigo-500/35 text-white'
                  : 'bg-transparent border-slate-800/70 text-slate-400 hover:bg-slate-950/50'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {checked
                  ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                  : <Square className="w-4 h-4 text-slate-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold truncate">{sec.label}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{sec.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {(jobs.length > 0 || models.length > 0) && (
        <div className="pt-3 border-t border-slate-800 space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Fuente Certificada y Comparativa
          </p>

          {jobs.length > 0 && (
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Experimento Principal</label>
              <SystemSelect
                value={activeJob?.id || ''}
                onChange={onChangeJobId}
                size="sm"
                ariaLabel="Experimento Principal"
                options={jobs.map(j => ({
                  value: j.id,
                  label: `${j.arch_name || 'Run'} · ${j.status}${j.accuracy != null ? ` (${(j.accuracy * 100).toFixed(1)}%)` : ''}`,
                }))}
              />
            </div>
          )}

          {jobs.length > 1 && (
            <div>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <GitCompare className="w-3 h-3 text-cyan-400" />
                <span>Comparar contra corrida</span>
              </label>
              <SystemSelect
                value={comparisonJob?.id || ''}
                onChange={onChangeComparisonJobId}
                size="sm"
                ariaLabel="Comparar contra corrida"
                options={[
                  { value: '', label: 'Sin comparativa' },
                  ...jobs
                    .filter(j => j.id !== activeJob?.id)
                    .map(j => ({
                      value: j.id,
                      label: `${j.arch_name || 'Run'} · ${j.status}${j.accuracy != null ? ` (${(j.accuracy * 100).toFixed(1)}%)` : ''}`,
                    })),
                ]}
              />
            </div>
          )}

          {models.length > 0 && (
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Versión Model Registry</label>
              <SystemSelect
                value={resolvedModel?.id || ''}
                onChange={onChangeModelId}
                size="sm"
                ariaLabel="Versión Model Registry"
                options={models.map(m => ({
                  value: m.id,
                  label: `${m.version} · ${m.status} (${(m.test_metrics.test_accuracy * 100).toFixed(1)}%)`,
                }))}
              />
            </div>
          )}
        </div>
      )}

      <div className="pt-3 border-t border-slate-800 flex items-center gap-2 text-[11px] text-emerald-400 font-semibold">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>Aislamiento Test (15%) verificado para auditoría</span>
      </div>
    </aside>
  )
}

