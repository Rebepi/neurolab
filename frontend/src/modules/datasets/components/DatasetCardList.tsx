import { useState } from 'react'
import {
  BarChart3,
  CheckSquare,
  Database,
  FileSpreadsheet,
  GitMerge,
  Search,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react'
import type { Dataset } from '../../../types/index'
import { SystemTooltip } from '../../../components/InfoTip'
import { PaginationBar } from '../../../components/PaginationBar'
import { ProblemTypeBadge } from './ProblemTypeBadge'

type DatasetTabTarget = 'summary' | 'variables' | 'raw' | 'clean'

interface DatasetCardListProps {
  datasets: Dataset[]
  totalDatasetsCount: number
  searchQuery: string
  onClearSearch: () => void
  onOpenUpload: (droppedFile?: File) => void
  selectedDataset: Dataset | null
  onToggleEda: (ds: Dataset, tab?: DatasetTabTarget) => void
  selectedForFusion?: string[]
  onToggleFusionSelect?: (dsId: string) => void
  onDeleteDataset?: (ds: Dataset) => void
  deletingId?: string | null
  canWrite?: boolean
  currentPage: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function computeCompletenessPct(ds: Dataset): number {
  const summary = ds.metadata?.columns_summary
  const rows = ds.metadata?.total_rows ?? 0
  if (!summary || summary.length === 0 || rows <= 0) return 100
  const totalCells = rows * summary.length
  const totalMissing = summary.reduce(
    (acc, col) => acc + (col.missing_after !== undefined ? col.missing_after : (col.missing ?? 0)),
    0
  )
  if (totalMissing <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((1 - totalMissing / totalCells) * 1000) / 10))
}

function hasAppliedCleaning(ds: Dataset): boolean {
  const rep = ds.metadata?.cleaning_report
  if (!rep) return false
  return (
    ds.version.includes('clean') ||
    rep.rows_removed > 0 ||
    rep.null_cells_before > 0 ||
    rep.duplicates_removed > 0 ||
    rep.outliers_handled > 0 ||
    (rep.columns_dropped?.length ?? 0) > 0
  )
}

export function DatasetCardList({
  datasets,
  totalDatasetsCount,
  searchQuery,
  onClearSearch,
  onOpenUpload,
  selectedDataset,
  onToggleEda,
  selectedForFusion = [],
  onToggleFusionSelect,
  onDeleteDataset,
  deletingId,
  canWrite = true,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DatasetCardListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  if (totalDatasetsCount === 0) {
    return (
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          if (!canWrite) return
          const dropped = e.dataTransfer.files[0]
          if (dropped) onOpenUpload(dropped)
        }}
        className="nl-cyber-panel animate-card-reveal rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4 border-dashed border-2 border-cyan-500/30"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/15 border border-cyan-500/35 flex items-center justify-center">
          <Database className="w-7 h-7 text-cyan-300" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-bold text-white">No hay datasets cargados en esta área</h3>
          <p className="text-xs sm:text-sm text-slate-400">
            Arrastra un archivo CSV aquí o cárgalo manualmente para limpiar datos, explorar el CSV original y generar el Auto-EDA.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => onOpenUpload()}
            className="nl-btn-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-semibold shadow-md transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>+ Subir primer CSV</span>
          </button>
        )}
      </div>
    )
  }

  if (datasets.length === 0) {
    return (
      <div className="nl-cyber-panel rounded-2xl flex flex-col items-center justify-center py-14 gap-3 text-center">
        <Search className="w-9 h-9 text-slate-600" />
        <p className="text-sm text-slate-400">
          No hay datasets que coincidan con "{searchQuery}"
        </p>
        <button
          type="button"
          onClick={onClearSearch}
          className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-medium text-cyan-300 hover:bg-slate-800 transition-colors"
        >
          Limpiar búsqueda
        </button>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(datasets.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginated = datasets.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {paginated.map((ds, idx) => {
          const isChecked = selectedForFusion.includes(ds.id)
          const isFused = ds.version.includes('fused') || Boolean(ds.fusion_report)
          const isCleaned = hasAppliedCleaning(ds)
          const isActiveEda = selectedDataset?.id === ds.id
          const totalRows = Math.max(
            0,
            ds.splits.train_count + ds.splits.val_count + ds.splits.test_count
          )
          const safeTotal = Math.max(1, totalRows)
          const trainPct = Math.round((ds.splits.train_count / safeTotal) * 100)
          const valPct = Math.round((ds.splits.val_count / safeTotal) * 100)
          const testPct = Math.max(0, 100 - trainPct - valPct)
          const completenessPct = computeCompletenessPct(ds)

          return (
            <div
              key={ds.id}
              style={{ animationDelay: `${Math.min(idx * 55, 330)}ms` }}
              className={`nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden ${
                isChecked
                  ? 'border-teal-400/65 ring-1 ring-teal-400/55'
                  : isActiveEda
                    ? 'border-cyan-400/60 ring-1 ring-cyan-400/45'
                    : ''
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${
                  isFused
                    ? 'from-teal-400 via-emerald-400 to-cyan-400'
                    : isCleaned
                      ? 'from-emerald-400 via-teal-400 to-cyan-400'
                      : 'from-cyan-400/75 via-indigo-400/70 to-violet-500/75'
                }`}
              />

              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  {onToggleFusionSelect && canWrite && (
                    <SystemTooltip
                      label={
                        isChecked
                          ? 'Quitar de selección para fusión'
                          : 'Seleccionar para fusión intra-área'
                      }
                      side="top"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleFusionSelect(ds.id)}
                        className="mt-1 text-slate-400 hover:text-teal-300 transition-colors shrink-0"
                        aria-label={`Seleccionar ${ds.name} para fusión`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-teal-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </SystemTooltip>
                  )}

                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isFused
                        ? 'bg-teal-500/15 border-teal-500/35 text-teal-300'
                        : 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300'
                    }`}
                  >
                    {isFused ? (
                      <GitMerge className="w-4 h-4" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <h3 className="font-bold text-sm sm:text-[15px] text-white leading-snug line-clamp-2">
                      {ds.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-mono bg-violet-500/15 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-md">
                        v{ds.version}
                      </span>
                      {isFused && (
                        <span className="text-[11px] font-mono bg-teal-500/15 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <GitMerge className="w-3 h-3" />
                          Fusionado
                        </span>
                      )}
                      {isCleaned && (
                        <span className="text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Limpio
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {ds.metadata && (
                  <div className="shrink-0">
                    <ProblemTypeBadge type={ds.metadata.problem_type} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 px-2.5 py-2 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Filas</p>
                  <p className="text-xs sm:text-sm font-mono font-bold text-white truncate mt-0.5">
                    {totalRows.toLocaleString()}
                  </p>
                </div>

                <div
                  title={`${ds.input_shape} → ${ds.target}`}
                  className="rounded-xl bg-slate-900/70 border border-slate-800/80 px-2.5 py-2 min-w-0"
                >
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Esquema</p>
                  <p className="text-xs sm:text-sm font-mono font-bold text-cyan-300 truncate mt-0.5">
                    {ds.input_shape} → {ds.target}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 px-2.5 py-2 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Calidad</p>
                  <p
                    className={`text-xs sm:text-sm font-mono font-bold truncate mt-0.5 ${
                      completenessPct >= 99 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {completenessPct}%
                  </p>
                </div>
              </div>

              <SystemTooltip
                title={`Partición Estratificada ${trainPct}/${valPct}/${testPct}`}
                label={`Train: ${ds.splits.train_count.toLocaleString()} · Validación: ${ds.splits.val_count.toLocaleString()} · Test sellado: ${ds.splits.test_count.toLocaleString()}`}
                side="top"
                className="block"
              >
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden flex gap-0.5">
                    <div
                      className="h-full bg-teal-400 rounded-l-full"
                      style={{ width: `${trainPct}%` }}
                    />
                    <div className="h-full bg-cyan-400" style={{ width: `${valPct}%` }} />
                    <div
                      className="h-full bg-violet-400 rounded-r-full"
                      style={{ width: `${testPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Train {trainPct}%</span>
                    <span>Val {valPct}%</span>
                    <span>Test {testPct}%</span>
                  </div>
                </div>
              </SystemTooltip>

              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-800/75">
                <span className="text-xs text-slate-500">{formatDate(ds.created_at)}</span>
                <div className="flex items-center gap-1.5">
                  {onDeleteDataset && canWrite && (
                    confirmDeleteId === ds.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={deletingId === ds.id}
                          onClick={() => {
                            onDeleteDataset(ds)
                            setConfirmDeleteId(null)
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold disabled:opacity-50"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg border border-slate-700 text-slate-300 text-[11px] hover:bg-slate-800"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <SystemTooltip label="Eliminar dataset de forma segura" side="top">
                        <button
                          type="button"
                          disabled={deletingId === ds.id}
                          onClick={() => setConfirmDeleteId(ds.id)}
                          aria-label={`Eliminar ${ds.name}`}
                          className="p-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </SystemTooltip>
                    )
                  )}

                  <SystemTooltip label="Explorar dataset original fila por fila" side="top">
                    <button
                      type="button"
                      onClick={() => onToggleEda(ds, 'raw')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold transition-colors"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      <span>Ver Datos</span>
                    </button>
                  </SystemTooltip>

                  <button
                    type="button"
                    onClick={() => onToggleEda(ds, 'summary')}
                    className="nl-btn-shimmer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/85 to-cyan-600/85 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold transition-all shadow-sm"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>{isActiveEda ? 'EDA Abierto' : 'Auto-EDA'}</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="nl-cyber-panel rounded-2xl overflow-hidden mt-auto">
        <PaginationBar
          currentPage={safePage}
          totalItems={datasets.length}
          pageSize={pageSize}
          pageSizeOptions={[3, 6, 9, 12, 24]}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          itemLabel="datasets"
        />
      </div>
    </div>
  )
}
