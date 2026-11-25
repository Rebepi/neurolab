import {
  Award,
  Box,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  Layers,
  Package,
  Play,
  SearchX,
  ShieldCheck,
} from 'lucide-react'
import type { ModelVersion } from '../../../types/index'
import { SystemTooltip } from '../../../components/InfoTip'

export interface NormalizedModelStatus {
  code: 'APPROVED' | 'IN_REVIEW' | 'DRAFT' | 'RETIRED'
  label: string
  badgeClass: string
  hairline: string
}

export function normalizeModelStatus(status: string): NormalizedModelStatus {
  const upper = (status || '').toUpperCase()
  if (upper === 'APPROVED' || upper === 'APROBADO') {
    return {
      code: 'APPROVED',
      label: 'Aprobado',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      hairline: 'from-emerald-400 via-teal-400 to-cyan-400',
    }
  }
  if (upper === 'IN_REVIEW' || upper === 'EN REVISIÓN' || upper === 'EN REVISION') {
    return {
      code: 'IN_REVIEW',
      label: 'En Revisión',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
      hairline: 'from-amber-400 via-orange-400 to-cyan-400',
    }
  }
  if (upper === 'RETIRED' || upper === 'RETIRADO') {
    return {
      code: 'RETIRED',
      label: 'Retirado',
      badgeClass: 'bg-slate-700/50 text-slate-300 border-slate-600/60',
      hairline: 'from-slate-500 via-slate-400 to-slate-600',
    }
  }
  return {
    code: 'DRAFT',
    label: 'Borrador',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
    hairline: 'from-cyan-400 via-indigo-400 to-violet-400',
  }
}

interface ModelVersionsGridProps {
  models: ModelVersion[]
  totalModelsCount: number
  bestModelId: string | null
  selectedModel: ModelVersion | null
  updatingId: string | null
  hasFilters: boolean
  onClearFilters: () => void
  onSelectModel: (model: ModelVersion) => void
  onOpenDetail: (model: ModelVersion) => void
  onOpenSimulator: (model: ModelVersion) => void
  onUseIn3D?: (model: ModelVersion) => void
  onOpenReport?: (model: ModelVersion) => void
  onStatusChange: (modelId: string, newStatus: string) => void
}

export function ModelVersionsGrid({
  models,
  totalModelsCount,
  bestModelId,
  selectedModel,
  updatingId,
  hasFilters,
  onClearFilters,
  onSelectModel,
  onOpenDetail,
  onOpenSimulator,
  onUseIn3D,
  onOpenReport,
  onStatusChange,
}: ModelVersionsGridProps) {
  if (totalModelsCount === 0) {
    return (
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl py-16 px-6 text-center space-y-2.5">
        <div className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mx-auto">
          <Package className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-200">Aún no se han registrado modelos en este proyecto</p>
        <p className="text-xs text-slate-500">
          Completa un entrenamiento satisfactorio para registrar automáticamente la versión v1.0.0.
        </p>
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl py-14 px-6 text-center space-y-2.5">
        <div className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mx-auto">
          <SearchX className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-200">Sin versiones coincidentes</p>
        <p className="text-xs text-slate-500">Ninguna versión registrada coincide con los filtros actuales.</p>
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-200 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {models.map((m, idx) => {
        const isSelected = selectedModel?.id === m.id
        const isBest = bestModelId === m.id && totalModelsCount > 0
        const norm = normalizeModelStatus(m.status)
        const tm = m.test_metrics
        const accPct = (tm.test_accuracy * 100).toFixed(2)
        const f1Pct = (tm.f1_score * 100).toFixed(2)
        const layerCount = m.architecture_config?.layers?.length ?? 0

        return (
          <div
            key={m.id}
            onClick={() => onSelectModel(m)}
            style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
            className={`nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-4 flex flex-col justify-between gap-3.5 cursor-pointer relative overflow-hidden transition-all ${
              isSelected
                ? 'border-cyan-400/70 ring-1 ring-cyan-400/40 shadow-lg'
                : 'hover:border-cyan-500/40'
            }`}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${norm.hairline}`} />

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300 shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-extrabold text-white tracking-tight">
                        Modelo {m.version}
                      </h3>
                      {isBest && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/35">
                          <Award className="w-2.5 h-2.5" />
                          Mejor
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {new Date(m.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${norm.badgeClass}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {norm.label}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-200 truncate">
                  <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate font-medium">{m.dataset_name || 'Dataset Aura Telecom'}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-slate-400">
                  <span className="inline-flex items-center gap-1.5 truncate min-w-0">
                    <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">{m.arch_name || 'MLP Standard'}</span>
                  </span>
                  {m.target_column && (
                    <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-[10px] shrink-0">
                      → {m.target_column}
                    </code>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-950/75 border border-slate-800/80 px-2.5 py-2 min-w-0">
                  <p className="text-[9.5px] uppercase tracking-wider text-slate-400">Exactitud</p>
                  <p className="text-xs sm:text-sm font-mono font-extrabold text-emerald-400 truncate mt-0.5">
                    {accPct}%
                  </p>
                </div>
                <div className="rounded-xl bg-slate-950/75 border border-slate-800/80 px-2.5 py-2 min-w-0">
                  <p className="text-[9.5px] uppercase tracking-wider text-slate-400">F1-Score</p>
                  <p className="text-xs sm:text-sm font-mono font-extrabold text-violet-300 truncate mt-0.5">
                    {f1Pct}%
                  </p>
                </div>
                <div className="rounded-xl bg-slate-950/75 border border-slate-800/80 px-2.5 py-2 min-w-0">
                  <p className="text-[9.5px] uppercase tracking-wider text-slate-400">Loss Test</p>
                  <p className="text-xs sm:text-sm font-mono font-extrabold text-amber-300 truncate mt-0.5">
                    {tm.test_loss.toFixed(4)}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
                    style={{ width: `${Math.max(6, Math.min(100, tm.test_accuracy * 100))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    SHA: {m.checksum.slice(0, 8)}…
                  </span>
                  <span>
                    {layerCount > 0 ? `${layerCount} capas` : m.arch_family || 'Keras'} · Prec{' '}
                    {(tm.precision * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div
              className="flex flex-wrap items-center justify-between gap-1.5 pt-2.5 border-t border-slate-800/75"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <SystemTooltip label="Simular inferencia en tiempo real (.keras)" side="top">
                  <button
                    type="button"
                    onClick={() => onOpenSimulator(m)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/12 hover:bg-emerald-500/25 text-emerald-200 text-[11px] font-semibold transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>Simular</span>
                  </button>
                </SystemTooltip>

                {onUseIn3D && (
                  <SystemTooltip label="Usar este modelo en Inferencia en Vivo (Paso 07)" side="top">
                    <button
                      type="button"
                      onClick={() => onUseIn3D(m)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-indigo-500/35 bg-indigo-500/12 hover:bg-indigo-500/25 text-indigo-200 text-[11px] font-semibold transition-colors"
                    >
                      <Box className="w-3 h-3" />
                      <span>En Vivo</span>
                    </button>
                  </SystemTooltip>
                )}

                {onOpenReport && (
                  <SystemTooltip label="Generar Reporte PDF ejecutivo" side="top">
                    <button
                      type="button"
                      onClick={() => onOpenReport(m)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      <span>PDF</span>
                    </button>
                  </SystemTooltip>
                )}

                {norm.code !== 'APPROVED' && (
                  <SystemTooltip label="Aprobar versión para producción" side="top">
                    <button
                      type="button"
                      disabled={updatingId === m.id}
                      onClick={() => onStatusChange(m.id, 'Aprobado')}
                      className="p-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/12 hover:bg-emerald-500/25 text-emerald-300 transition-colors disabled:opacity-50"
                      aria-label="Aprobar versión"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  </SystemTooltip>
                )}
              </div>

              <button
                type="button"
                onClick={() => onOpenDetail(m)}
                className="nl-btn-shimmer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/90 to-cyan-600/90 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold transition-all shadow-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Ver Detalles</span>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
