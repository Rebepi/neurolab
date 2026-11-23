import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  Columns3,
  CopyMinus,
  Cpu,
  Download,
  FilterX,
  GitMerge,
  Loader2,
  RotateCcw,
  Rows3,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Wand2,
  X,
} from 'lucide-react'
import { api } from '../../../services/api'
import { InfoTip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'
import { ProblemTypeBadge } from './ProblemTypeBadge'
import { AutoCleanSummaryCard } from './AutoCleanSummaryCard'
import { SmartCleaningToggles } from './SmartCleaningToggles'
import type {
  AutoCleanPlanResponse,
  Dataset,
  DatasetRowsResponse,
  MissingStrategy,
  OutlierStrategy,
  ScalerStrategy,
  SplitRatioOption,
} from '../../../types/index'

type EdaTab = 'summary' | 'variables' | 'raw' | 'clean'
type ColumnFilter = 'ALL' | 'numeric' | 'categorical' | 'missing' | 'target'

interface DatasetEdaPanelProps {
  dataset: Dataset
  initialTab?: EdaTab
  canWrite?: boolean
  onClose: () => void
  onDatasetCleaned?: (ds: Dataset) => void
  onGoToArchitectures?: () => void
}

const MISSING_LABELS: Record<string, string> = {
  median_mode: 'Imputación Mediana / Moda',
  mean_mode: 'Imputación Media / Moda',
  drop_rows: 'Eliminación de filas con nulos',
  zero: 'Relleno 0 / Desconocido',
}

const OUTLIER_LABELS: Record<string, string> = {
  none: 'Sin alterar',
  iqr_clip: 'Recorte IQR (Winsorize)',
  iqr_drop: 'Eliminación por IQR',
}

const INPUT_GLASS_CLASS =
  'w-full px-3.5 py-2 rounded-xl bg-[#071123]/90 hover:bg-[#0b1933]/95 border border-cyan-500/25 focus:border-teal-400/80 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-all'

export function DatasetEdaPanel({
  dataset,
  initialTab = 'summary',
  canWrite = true,
  onClose,
  onDatasetCleaned,
  onGoToArchitectures,
}: DatasetEdaPanelProps) {
  const eda = dataset.metadata
  const isFused = dataset.version.includes('fused') || Boolean(dataset.fusion_report)

  const [tab, setTab] = useState<EdaTab>(initialTab)
  const [showAllFeatures, setShowAllFeatures] = useState(false)

  const [colSearch, setColSearch] = useState('')
  const [colFilter, setColFilter] = useState<ColumnFilter>('ALL')
  const [colPage, setColPage] = useState(1)
  const [colPageSize, setColPageSize] = useState(8)

  const [rowSource, setRowSource] = useState<'raw' | 'clean'>('raw')
  const [rowPage, setRowPage] = useState(1)
  const [rowPageSize, setRowPageSize] = useState(25)
  const [rowSearch, setRowSearch] = useState('')
  const [debouncedRowSearch, setDebouncedRowSearch] = useState('')
  const [onlyNulls, setOnlyNulls] = useState(false)
  const [sortBy, setSortBy] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [rowsData, setRowsData] = useState<DatasetRowsResponse | null>(null)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [rowsError, setRowsError] = useState('')

  const [cleanName, setCleanName] = useState(`${dataset.name} (Limpio)`)
  const [cleanTarget, setCleanTarget] = useState(eda.target_column)
  const [cleanMissing, setCleanMissing] = useState<MissingStrategy>('median_mode')
  const [cleanDropDups, setCleanDropDups] = useState(true)
  const [cleanOutlier, setCleanOutlier] = useState<OutlierStrategy>('iqr_clip')
  const [cleanScaler, setCleanScaler] = useState<ScalerStrategy>(
    (eda.scaler_applied as ScalerStrategy) || 'standard'
  )
  const [cleanSplitRatio, setCleanSplitRatio] = useState<SplitRatioOption>('70/15/15')
  const [cleanDropCols, setCleanDropCols] = useState<string[]>([])
  const [cleanNormalizeText, setCleanNormalizeText] = useState(true)
  const [cleanExtractDates, setCleanExtractDates] = useState(true)
  const [cleanGroupRare, setCleanGroupRare] = useState(true)
  const [cleanLogSkewed, setCleanLogSkewed] = useState(false)
  const [cleanStratify, setCleanStratify] = useState(true)
  const [cleaningBusy, setCleaningBusy] = useState(false)
  const [cleanError, setCleanError] = useState('')
  const [autoPlan, setAutoPlan] = useState<AutoCleanPlanResponse | null>(null)
  const [autoPlanLoading, setAutoPlanLoading] = useState(false)
  const [autoManuallyAdjusted, setAutoManuallyAdjusted] = useState(false)

  useEffect(() => {
    setTab(initialTab)
    setShowAllFeatures(false)
    setColSearch('')
    setColFilter('ALL')
    setColPage(1)
    setRowSource('raw')
    setRowPage(1)
    setRowSearch('')
    setDebouncedRowSearch('')
    setOnlyNulls(false)
    setSortBy('')
    setSortDir('asc')
    setRowsData(null)
    setRowsError('')
    setCleanName(`${dataset.name} (Limpio)`)
    setCleanTarget(dataset.metadata.target_column)
    setCleanDropCols([])
    setCleanNormalizeText(true)
    setCleanExtractDates(true)
    setCleanGroupRare(true)
    setCleanLogSkewed(false)
    setCleanStratify(true)
    setCleanError('')
    setAutoPlan(null)
    setAutoManuallyAdjusted(false)
  }, [dataset.id, initialTab])

  useEffect(() => {
    if (cleanTarget && cleanDropCols.includes(cleanTarget)) {
      setCleanDropCols(prev => prev.filter(c => c !== cleanTarget))
    }
  }, [cleanTarget, cleanDropCols])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRowSearch(rowSearch)
      setRowPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [rowSearch])

  const loadRows = useCallback(async () => {
    setRowsLoading(true)
    setRowsError('')
    try {
      const resp = await api.getDatasetRows(dataset.id, {
        source: rowSource,
        page: rowPage,
        page_size: rowPageSize,
        search: debouncedRowSearch.trim() || undefined,
        only_nulls: onlyNulls,
        sort_by: sortBy || undefined,
        sort_dir: sortDir,
      })
      setRowsData(resp)
    } catch (err: any) {
      setRowsError(err?.message || 'Error al cargar las filas del dataset')
    } finally {
      setRowsLoading(false)
    }
  }, [dataset.id, rowSource, rowPage, rowPageSize, debouncedRowSearch, onlyNulls, sortBy, sortDir])

  useEffect(() => {
    if (tab === 'raw') {
      loadRows()
    }
  }, [tab, loadRows])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !cleaningBusy && !document.querySelector('[role="listbox"]')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, cleaningBusy])

  const completenessPct = useMemo(() => {
    const cols = eda.columns_summary
    if (!cols || cols.length === 0 || eda.total_rows <= 0) return 100
    const totalCells = eda.total_rows * cols.length
    const missingCells = cols.reduce(
      (acc, c) => acc + (c.missing_after !== undefined ? c.missing_after : (c.missing ?? 0)),
      0
    )
    if (missingCells <= 0) return 100
    return Math.max(0, Math.min(100, Math.round((1 - missingCells / totalCells) * 1000) / 10))
  }, [eda.columns_summary, eda.total_rows])

  const filteredColumns = useMemo(() => {
    const q = colSearch.trim().toLowerCase()
    return eda.columns_summary.filter(col => {
      if (colFilter === 'numeric' && col.dtype !== 'numeric') return false
      if (colFilter === 'categorical' && col.dtype !== 'categorical') return false
      if (colFilter === 'missing' && (col.missing ?? 0) === 0) return false
      if (colFilter === 'target' && !col.is_target) return false
      if (!q) return true
      return col.name.toLowerCase().includes(q)
    })
  }, [colFilter, colSearch, eda.columns_summary])

  const colTotalPages = Math.max(1, Math.ceil(filteredColumns.length / colPageSize))
  const safeColPage = Math.min(colPage, colTotalPages)
  const paginatedColumns = filteredColumns.slice(
    (safeColPage - 1) * colPageSize,
    safeColPage * colPageSize
  )

  const visibleFeatures = showAllFeatures
    ? eda.feature_names
    : eda.feature_names.slice(0, 24)

  const trainPct = Math.round((eda.splits.train_ratio ?? 0.7) * 100)
  const valPct = Math.round((eda.splits.val_ratio ?? 0.15) * 100)
  const testPct = Math.max(0, 100 - trainPct - valPct)

  function handleSortColumn(col: string) {
    if (sortBy !== col) {
      setSortBy(col)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortBy('')
      setSortDir('asc')
    }
    setRowPage(1)
  }

  function toggleCleanDropCol(col: string) {
    if (col === cleanTarget) return
    if (autoPlan) setAutoManuallyAdjusted(true)
    setCleanDropCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    )
  }

  async function handleRunAutoPlan() {
    setAutoPlanLoading(true)
    setCleanError('')
    try {
      const plan = await api.getDatasetAutoCleanPlan(dataset.id, cleanTarget || undefined)
      setAutoPlan(plan)
      setAutoManuallyAdjusted(false)
      setCleanMissing(plan.recommended.missing_strategy)
      setCleanDropDups(plan.recommended.drop_duplicates)
      setCleanOutlier(plan.recommended.outlier_strategy)
      setCleanDropCols(plan.recommended.drop_columns)
      setCleanScaler(plan.recommended.scaler_type)
      setCleanSplitRatio(plan.recommended.split_ratio)
      if (typeof plan.recommended.normalize_text === 'boolean') {
        setCleanNormalizeText(plan.recommended.normalize_text)
      }
      if (typeof plan.recommended.extract_dates === 'boolean') {
        setCleanExtractDates(plan.recommended.extract_dates)
      }
      if (typeof plan.recommended.group_rare_categories === 'boolean') {
        setCleanGroupRare(plan.recommended.group_rare_categories)
      }
      if (typeof plan.recommended.log_transform_skewed === 'boolean') {
        setCleanLogSkewed(plan.recommended.log_transform_skewed)
      }
      if (typeof plan.recommended.stratify_split === 'boolean') {
        setCleanStratify(plan.recommended.stratify_split)
      }
    } catch (err: any) {
      setCleanError(err?.message || 'No se pudo diagnosticar automáticamente este dataset')
    } finally {
      setAutoPlanLoading(false)
    }
  }

  function handleResetCleaningDefaults() {
    setAutoPlan(null)
    setAutoManuallyAdjusted(false)
    setCleanError('')
    setCleanName(`${dataset.name} (Limpio)`)
    setCleanTarget(dataset.metadata.target_column)
    setCleanMissing('median_mode')
    setCleanDropDups(true)
    setCleanOutlier('iqr_clip')
    setCleanScaler((dataset.metadata.scaler_applied as ScalerStrategy) || 'standard')
    setCleanSplitRatio('70/15/15')
    setCleanDropCols([])
    setCleanNormalizeText(true)
    setCleanExtractDates(true)
    setCleanGroupRare(true)
    setCleanLogSkewed(false)
    setCleanStratify(true)
  }

  const isCleanAtDefaults =
    !autoPlan &&
    cleanTarget === dataset.metadata.target_column &&
    cleanMissing === 'median_mode' &&
    cleanDropDups === true &&
    cleanOutlier === 'iqr_clip' &&
    cleanScaler === ((dataset.metadata.scaler_applied as ScalerStrategy) || 'standard') &&
    cleanSplitRatio === '70/15/15' &&
    cleanDropCols.length === 0 &&
    cleanNormalizeText === true &&
    cleanExtractDates === true &&
    cleanGroupRare === true &&
    cleanLogSkewed === false &&
    cleanStratify === true

  async function handleExecuteCleaning() {
    setCleaningBusy(true)
    setCleanError('')
    try {
      const cleaned = await api.cleanDataset(dataset.id, {
        name: cleanName.trim() || undefined,
        target_column: cleanTarget || undefined,
        missing_strategy: cleanMissing,
        drop_duplicates: cleanDropDups,
        outlier_strategy: cleanOutlier,
        drop_columns: cleanDropCols,
        scaler_type: cleanScaler,
        split_ratio: cleanSplitRatio,
        normalize_text: cleanNormalizeText,
        extract_dates: cleanExtractDates,
        group_rare_categories: cleanGroupRare,
        log_transform_skewed: cleanLogSkewed,
        stratify_split: cleanStratify,
      })
      onDatasetCleaned?.(cleaned)
      setTab('summary')
    } catch (err: any) {
      setCleanError(err?.message || 'No se pudo completar la limpieza del dataset')
    } finally {
      setCleaningBusy(false)
    }
  }

  const tabs: { id: EdaTab; label: string; badge?: number }[] = [
    { id: 'summary', label: 'Resumen & Partición' },
    { id: 'variables', label: 'Variables', badge: eda.columns_summary.length },
    { id: 'raw', label: 'Dataset Original', badge: rowsData?.total_rows ?? eda.raw_stats?.raw_rows ?? eda.total_rows },
    ...(canWrite ? [{ id: 'clean' as const, label: 'Limpieza & Reprocesar' }] : []),
  ]

  const allColumnNames = useMemo(
    () => eda.columns_summary.map(c => c.name),
    [eda.columns_summary]
  )

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-backdrop-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dataset-eda-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !cleaningBusy) onClose()
      }}
    >
      <div className="relative nl-cyber-panel rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-pop-in">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/85 via-teal-400/80 to-violet-500/85" />

        <div className="shrink-0 px-6 py-4 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/35 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="dataset-eda-modal-title"
                  className="text-base sm:text-lg font-bold text-white leading-tight truncate"
                >
                  {dataset.name}
                </h2>
                <span className="text-[11px] font-mono bg-violet-500/15 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-md">
                  v{dataset.version}
                </span>
                <ProblemTypeBadge type={eda.problem_type} />
                {isFused && (
                  <span className="text-[11px] font-mono bg-teal-500/15 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                    <GitMerge className="w-3 h-3" />
                    Fusionado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Análisis Exploratorio, Inspección de CSV Original y Limpieza · Objetivo:{' '}
                <span className="font-mono text-cyan-300">{eda.target_column}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={cleaningBusy}
            onClick={onClose}
            aria-label="Cerrar Auto-EDA"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="shrink-0 px-6 pt-2 flex flex-wrap gap-1 border-b border-slate-800/80">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.id === 'raw' && <Table2 className="w-3.5 h-3.5" />}
              {t.id === 'clean' && <Wand2 className="w-3.5 h-3.5" />}
              <span>{t.label}</span>
              {typeof t.badge === 'number' && (
                <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-800/90 text-slate-300 border border-slate-700/70">
                  {t.badge.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === 'summary' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Filas Procesadas',
                    value: eda.total_rows.toLocaleString(),
                    color: 'text-cyan-400',
                    icon: Rows3,
                  },
                  {
                    label: 'Columnas Activas',
                    value: eda.total_columns,
                    color: 'text-indigo-400',
                    icon: Columns3,
                  },
                  {
                    label: 'Input Shape',
                    value: eda.input_shape,
                    color: 'text-violet-400',
                    icon: Cpu,
                  },
                  {
                    label: 'Calidad Actual',
                    value: `${completenessPct}%`,
                    color: completenessPct >= 99 ? 'text-emerald-400' : 'text-amber-400',
                    icon: ShieldCheck,
                  },
                ].map(item => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 text-center space-y-1"
                    >
                      <Icon className={`w-4 h-4 mx-auto ${item.color}`} />
                      <p className={`text-xl sm:text-2xl font-bold font-mono ${item.color}`}>
                        {item.value}
                      </p>
                      <p className="text-xs text-slate-400">{item.label}</p>
                    </div>
                  )
                })}
              </div>

              {eda.cleaning_report && (
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                      <Sparkles className="w-4 h-4" />
                      <span>Reporte de Limpieza Aplicada</span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-200/80">
                      {MISSING_LABELS[eda.cleaning_report.missing_strategy] || eda.cleaning_report.missing_strategy} ·{' '}
                      {OUTLIER_LABELS[eda.cleaning_report.outlier_strategy] || eda.cleaning_report.outlier_strategy}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                    <div className="rounded-lg bg-slate-950/65 border border-slate-800/80 px-3 py-2">
                      <p className="text-[10px] text-slate-400">Filas Original → Final</p>
                      <p className="font-mono font-bold text-white mt-0.5">
                        {eda.cleaning_report.rows_before.toLocaleString()} →{' '}
                        {eda.cleaning_report.rows_after.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/65 border border-slate-800/80 px-3 py-2">
                      <p className="text-[10px] text-slate-400">Nulos Orig. → Final</p>
                      <p className="font-mono font-bold text-amber-300 mt-0.5">
                        {eda.cleaning_report.null_cells_before.toLocaleString()} →{' '}
                        {eda.cleaning_report.null_cells_after.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/65 border border-slate-800/80 px-3 py-2">
                      <p className="text-[10px] text-slate-400">Duplicados Removidos</p>
                      <p className="font-mono font-bold text-teal-300 mt-0.5">
                        {eda.cleaning_report.duplicates_removed.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/65 border border-slate-800/80 px-3 py-2">
                      <p className="text-[10px] text-slate-400">Outliers Tratados</p>
                      <p className="font-mono font-bold text-cyan-300 mt-0.5">
                        {eda.cleaning_report.outliers_handled.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/65 border border-slate-800/80 px-3 py-2">
                      <p className="text-[10px] text-slate-400">Columnas Excluidas</p>
                      <p className="font-mono font-bold text-violet-300 mt-0.5 truncate">
                        {eda.cleaning_report.columns_dropped.length > 0
                          ? eda.cleaning_report.columns_dropped.join(', ')
                          : 'Ninguna'}
                      </p>
                    </div>
                  </div>
                  {(
                    (eda.cleaning_report.numeric_repaired?.length ?? 0) > 0 ||
                    (eda.cleaning_report.text_normalized?.length ?? 0) > 0 ||
                    (eda.cleaning_report.dates_extracted?.length ?? 0) > 0 ||
                    (eda.cleaning_report.rare_grouped_columns?.length ?? 0) > 0 ||
                    (eda.cleaning_report.log_transformed_columns?.length ?? 0) > 0 ||
                    eda.cleaning_report.stratified_applied ||
                    eda.class_balance?.is_imbalanced
                  ) && (
                    <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-mono">
                      {eda.cleaning_report.stratified_applied && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-cyan-200">
                          Partición estratificada
                        </span>
                      )}
                      {eda.class_balance?.is_imbalanced && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-200">
                          Desbalanceo ({eda.class_balance.minority_class_pct}%) · class_weight activo
                        </span>
                      )}
                      {(eda.cleaning_report.numeric_repaired?.length ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-500/15 border border-teal-500/35 text-teal-200">
                          Monedas/Números reparados: {eda.cleaning_report.numeric_repaired?.join(', ')}
                        </span>
                      )}
                      {(eda.cleaning_report.text_normalized?.length ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-200">
                          Texto normalizado: {eda.cleaning_report.text_normalized?.join(', ')}
                        </span>
                      )}
                      {(eda.cleaning_report.dates_extracted?.length ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/35 text-indigo-200">
                          Fechas extraídas: {eda.cleaning_report.dates_extracted?.join(', ')}
                        </span>
                      )}
                      {(eda.cleaning_report.rare_grouped_columns?.length ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/35 text-violet-200">
                          Categorías raras agrupadas: {eda.cleaning_report.rare_grouped_columns?.join(', ')}
                        </span>
                      )}
                      {(eda.cleaning_report.log_transformed_columns?.length ?? 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-cyan-200">
                          log1p aplicado: {eda.cleaning_report.log_transformed_columns?.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {dataset.fusion_report && (
                <div className="rounded-xl border border-teal-500/35 bg-teal-500/10 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-300">
                    <GitMerge className="w-4 h-4" />
                    <span>Reporte de Fusión Intra-Área</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 px-3 py-2">
                      <p className="text-[10px] text-slate-400">Fuentes unidas</p>
                      <p className="font-mono font-bold text-white mt-0.5">
                        {dataset.fusion_report.datasets_merged} datasets
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 px-3 py-2">
                      <p className="text-[10px] text-slate-400">Duplicados removidos</p>
                      <p className="font-mono font-bold text-amber-300 mt-0.5">
                        {dataset.fusion_report.duplicates_removed.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 px-3 py-2">
                      <p className="text-[10px] text-slate-400">Compatibilidad Jaccard</p>
                      <p className="font-mono font-bold text-emerald-300 mt-0.5">
                        {dataset.fusion_report.jaccard_compatibility_pct}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 px-3 py-2">
                      <p className="text-[10px] text-slate-400">Features alineadas</p>
                      <p className="font-mono font-bold text-cyan-300 mt-0.5">
                        {dataset.fusion_report.aligned_feature_count}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-cyan-500/30 bg-slate-900/50 p-5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  <span>Configuración Keras Sugerida</span>
                  <InfoTip
                    title="Arquitectura Automática de Salida"
                    text="Parámetros inferidos automáticamente según el tipo de problema detectado (binaria, multiclase o regresión) y el tamaño del tensor de entrada."
                    side="right"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] text-slate-500 mb-0.5">Variable Objetivo (Y)</p>
                    <p className="text-sm font-mono text-indigo-300 font-semibold truncate">
                      {eda.target_column}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 mb-0.5">Activación de Salida</p>
                    <p className="text-sm font-mono text-violet-300">{eda.output_activation}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 mb-0.5">Output Dim</p>
                    <p className="text-sm font-mono text-slate-200">{eda.output_dim}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 mb-0.5">Loss Sugerida</p>
                    <p className="text-sm font-mono text-cyan-300">{eda.suggested_loss}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 mb-0.5">Métrica Principal</p>
                    <p className="text-sm font-mono text-emerald-300">{eda.suggested_metric}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 mb-0.5 flex items-center gap-1">
                      <span>Escalado Aplicado</span>
                      <InfoTip
                        title="Escalado Guardado para Inferencia"
                        text="Los parámetros de escalado se almacenan junto al dataset para que cada predicción futura reciba exactamente la misma transformación."
                        side="top"
                      />
                    </p>
                    <p className="text-sm font-mono text-slate-300">{eda.scaler_applied}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Partición Sellada Train / Validación / Test</span>
                  <InfoTip
                    title="Aislamiento Estricto"
                    text="Test nunca interviene en entrenamiento ni selección de hiperparámetros, asegurando una evaluación sin sesgo."
                    side="right"
                  />
                </p>
                <div className="flex rounded-xl overflow-hidden h-9 border border-slate-800/80">
                  {[
                    {
                      label: 'Train',
                      count: eda.splits.train_count,
                      pct: trainPct,
                      color: 'bg-teal-600/85',
                    },
                    {
                      label: 'Val',
                      count: eda.splits.val_count,
                      pct: valPct,
                      color: 'bg-cyan-600/85',
                    },
                    {
                      label: 'Test',
                      count: eda.splits.test_count,
                      pct: testPct,
                      color: 'bg-violet-600/85',
                    },
                  ].map(seg => (
                    <div
                      key={seg.label}
                      className={`${seg.color} flex items-center justify-center px-2`}
                      style={{ width: `${seg.pct}%` }}
                    >
                      <span className="text-xs text-white font-semibold truncate">
                        {seg.label} {seg.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="rounded-xl bg-slate-900/55 border border-slate-800/80 px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-teal-300 font-medium">Train ({trainPct}%)</span>
                    <span className="font-mono font-bold text-white">
                      {eda.splits.train_count.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-900/55 border border-slate-800/80 px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-cyan-300 font-medium">Validación ({valPct}%)</span>
                    <span className="font-mono font-bold text-white">
                      {eda.splits.val_count.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-900/55 border border-slate-800/80 px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-violet-300 font-medium">Test Sellado ({testPct}%)</span>
                    <span className="font-mono font-bold text-white">
                      {eda.splits.test_count.toLocaleString()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>El conjunto Test permanece completamente aislado durante entrenamiento</span>
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Features de Entrada ({eda.feature_names.length})
                  </p>
                  {eda.feature_names.length > 24 && (
                    <button
                      type="button"
                      onClick={() => setShowAllFeatures(prev => !prev)}
                      className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {showAllFeatures
                        ? 'Mostrar menos'
                        : `Ver todas (+${eda.feature_names.length - 24})`}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleFeatures.map(f => (
                    <span
                      key={f}
                      className="bg-slate-900/80 text-slate-300 text-xs rounded-lg px-2.5 py-0.5 font-mono border border-slate-800"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'variables' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="relative flex-1 min-w-44">
                  <Search className="w-3.5 h-3.5 text-cyan-400/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={colSearch}
                    onChange={e => {
                      setColSearch(e.target.value)
                      setColPage(1)
                    }}
                    placeholder="Buscar columna..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#071123]/90 border border-cyan-500/25 focus:border-teal-400/80 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  />
                  {colSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setColSearch('')
                        setColPage(1)
                      }}
                      aria-label="Limpiar búsqueda de columnas"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <SystemSelect
                  value={colFilter}
                  onChange={val => {
                    setColFilter(val as ColumnFilter)
                    setColPage(1)
                  }}
                  size="sm"
                  className="w-full sm:w-52"
                  ariaLabel="Filtrar variables"
                  options={[
                    { value: 'ALL', label: 'Todas las variables', badge: String(eda.columns_summary.length) },
                    { value: 'numeric', label: 'Numéricas' },
                    { value: 'categorical', label: 'Categóricas' },
                    { value: 'missing', label: 'Con valores nulos orig.' },
                    { value: 'target', label: 'Variable objetivo' },
                  ]}
                />
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/35 overflow-hidden">
                {filteredColumns.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">
                    No hay variables que coincidan con el filtro aplicado.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-400 border-b border-slate-800/80 bg-slate-900/50">
                            <th className="py-2.5 px-4 font-medium">Columna</th>
                            <th className="py-2.5 px-4 font-medium">Tipo</th>
                            <th className="py-2.5 px-4 font-medium">Completitud</th>
                            <th className="py-2.5 px-4 font-medium">Únicos</th>
                            <th className="py-2.5 px-4 font-medium">Distribución / Estadísticas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {paginatedColumns.map(col => {
                            const activeMissing =
                              col.missing_after !== undefined ? col.missing_after : col.missing
                            const colCompleteness =
                              eda.total_rows > 0
                                ? Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      Math.round(((eda.total_rows - activeMissing) / eda.total_rows) * 100)
                                    )
                                  )
                                : 100
                            return (
                              <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-slate-100 font-medium">
                                      {col.name}
                                    </span>
                                    {col.is_target && (
                                      <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 rounded px-1.5 py-0.5">
                                        target
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4">
                                  <span
                                    className={`text-[11px] rounded-md px-2 py-0.5 font-medium ${
                                      col.dtype === 'numeric'
                                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    }`}
                                  >
                                    {col.dtype}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center gap-2 min-w-36">
                                    <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          activeMissing === 0 ? 'bg-emerald-400' : 'bg-amber-400'
                                        }`}
                                        style={{ width: `${colCompleteness}%` }}
                                      />
                                    </div>
                                    <span
                                      className={`text-[11px] font-mono whitespace-nowrap ${
                                        activeMissing === 0 ? 'text-emerald-400' : 'text-amber-400'
                                      }`}
                                    >
                                      {activeMissing} nulos
                                      {col.missing > 0 && activeMissing === 0
                                        ? ` (orig: ${col.missing})`
                                        : ''}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 font-mono text-xs text-slate-300">
                                  {col.unique.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-4">
                                  {col.dtype === 'numeric' && col.mean !== undefined ? (
                                    <span className="text-xs text-slate-300 font-mono">
                                      {col.min !== undefined ? `${col.min.toFixed(1)} · ` : ''}
                                      <span className="text-cyan-300">
                                        {col.mean.toFixed(2)} ± {col.std?.toFixed(2)}
                                      </span>
                                      {col.max !== undefined ? ` · ${col.max.toFixed(1)}` : ''}
                                    </span>
                                  ) : col.top_values ? (
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(col.top_values)
                                        .slice(0, 3)
                                        .map(([k]) => (
                                          <span
                                            key={k}
                                            className="text-[11px] bg-slate-900 border border-slate-800 text-slate-300 rounded px-1.5 py-0.5 font-mono"
                                          >
                                            {k}
                                          </span>
                                        ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-600">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <PaginationBar
                      currentPage={safeColPage}
                      totalItems={filteredColumns.length}
                      pageSize={colPageSize}
                      pageSizeOptions={[5, 8, 15, 30]}
                      onPageChange={setColPage}
                      onPageSizeChange={size => {
                        setColPageSize(size)
                        setColPage(1)
                      }}
                      itemLabel="variables"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'raw' && (
            <div className="space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {rowsData?.has_raw_version && (
                    <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900/80 p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRowSource('raw')
                          setRowPage(1)
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          rowSource === 'raw'
                            ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Original (Crudo)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRowSource('clean')
                          setRowPage(1)
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          rowSource === 'clean'
                            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Limpio (Procesado)
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOnlyNulls(prev => !prev)
                      setRowPage(1)
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                      onlyNulls
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Solo filas con nulos</span>
                    {rowsData && (
                      <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-950/70">
                        {rowsData.total_null_rows.toLocaleString()}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-cyan-400/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={rowSearch}
                      onChange={e => setRowSearch(e.target.value)}
                      placeholder="Buscar valor en el CSV..."
                      className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-[#071123]/90 border border-cyan-500/25 focus:border-teal-400/80 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                    />
                    {rowSearch && (
                      <button
                        type="button"
                        onClick={() => setRowSearch('')}
                        aria-label="Limpiar búsqueda en dataset"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <a
                    href={api.getDatasetDownloadUrl(dataset.id, rowSource)}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar CSV ({rowSource === 'raw' ? 'Original' : 'Limpio'})</span>
                  </a>
                </div>
              </div>

              {rowsData && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
                    Total filas: <strong className="text-white">{rowsData.total_rows.toLocaleString()}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
                    Visibles: <strong className="text-cyan-300">{rowsData.filtered_rows.toLocaleString()}</strong>
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg border ${
                      rowsData.total_null_cells > 0
                        ? 'bg-amber-500/10 border-amber-500/35 text-amber-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    Celdas nulas: <strong>{rowsData.total_null_cells.toLocaleString()}</strong>
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg border ${
                      rowsData.duplicate_rows > 0
                        ? 'bg-amber-500/10 border-amber-500/35 text-amber-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    Duplicados: <strong>{rowsData.duplicate_rows.toLocaleString()}</strong>
                  </span>
                  {!rowsData.has_raw_version && (
                    <span className="text-slate-500">
                      · Archivo único almacenado en servidor
                    </span>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/35 overflow-hidden">
                {rowsLoading ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Cargando registros del dataset desde el servidor...</span>
                  </div>
                ) : rowsError ? (
                  <div className="py-10 text-center space-y-2">
                    <p className="text-xs text-rose-400">{rowsError}</p>
                    <button
                      type="button"
                      onClick={loadRows}
                      className="px-3 py-1 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : !rowsData || rowsData.rows.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400">
                    {onlyNulls
                      ? 'Esta vista no contiene ninguna fila con valores nulos.'
                      : 'Ninguna fila coincide con la búsqueda actual.'}
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto max-h-[48vh]">
                      <table className="w-full text-xs whitespace-nowrap">
                        <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/90">
                          <tr>
                            <th className="px-3 py-2.5 text-left text-slate-500 font-mono">#</th>
                            {rowsData.columns.map(col => {
                              const isSorted = sortBy === col
                              const isTarget = col === rowsData.target_column
                              return (
                                <th key={col} className="px-3 py-2 text-left font-mono">
                                  <button
                                    type="button"
                                    onClick={() => handleSortColumn(col)}
                                    className={`inline-flex items-center gap-1 hover:text-white transition-colors ${
                                      isTarget ? 'text-cyan-300 font-bold' : 'text-slate-300 font-semibold'
                                    }`}
                                  >
                                    <span>{isTarget ? `${col} (Y)` : col}</span>
                                    {isSorted ? (
                                      sortDir === 'asc' ? (
                                        <ArrowUp className="w-3 h-3 text-cyan-400" />
                                      ) : (
                                        <ArrowDown className="w-3 h-3 text-cyan-400" />
                                      )
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 opacity-35" />
                                    )}
                                  </button>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {rowsData.rows.map((row, idx) => {
                            const rowHasNull = rowsData.columns.some(
                              c => row[c] === null || row[c] === undefined || row[c] === ''
                            )
                            return (
                              <tr
                                key={idx}
                                className={`hover:bg-slate-800/35 transition-colors ${
                                  rowHasNull ? 'bg-amber-500/[0.04]' : ''
                                }`}
                              >
                                <td className="px-3 py-2 text-slate-500 font-mono">
                                  {(rowsData.page - 1) * rowsData.page_size + idx + 1}
                                </td>
                                {rowsData.columns.map(colKey => {
                                  const val = row[colKey]
                                  const isNull = val === null || val === undefined || val === ''
                                  return (
                                    <td
                                      key={colKey}
                                      className={`px-3 py-2 font-mono ${
                                        colKey === rowsData.target_column
                                          ? 'text-cyan-300 font-semibold'
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      {isNull ? (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px]">
                                          NULL
                                        </span>
                                      ) : (
                                        String(val)
                                      )}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <PaginationBar
                      currentPage={rowsData.page}
                      totalItems={rowsData.filtered_rows}
                      pageSize={rowsData.page_size}
                      pageSizeOptions={[15, 25, 50, 100]}
                      onPageChange={setRowPage}
                      onPageSizeChange={size => {
                        setRowPageSize(size)
                        setRowPage(1)
                      }}
                      itemLabel="filas"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'clean' && canWrite && (
            <div className="space-y-5">
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-xs text-cyan-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Wand2 className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Estudio de Limpieza y Reprocesamiento sobre Dataset Existente
                    </p>
                    <p className="text-slate-300">
                      Usa <strong className="text-teal-300">Automático</strong> para perfilar nulos, asimetría, duplicados,
                      outliers e identificadores del CSV original y seleccionar la mejor estrategia, o personalízala abajo.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    disabled={isCleanAtDefaults || autoPlanLoading || cleaningBusy}
                    onClick={handleResetCleaningDefaults}
                    title="Quitar configuración automática y restaurar parámetros predeterminados"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs font-medium transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restablecer</span>
                  </button>

                  <button
                    type="button"
                    disabled={autoPlanLoading || cleaningBusy}
                    onClick={handleRunAutoPlan}
                    className="nl-btn-shimmer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all"
                  >
                    {autoPlanLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    <span>{autoPlanLoading ? 'Analizando CSV...' : 'Automático'}</span>
                  </button>
                </div>
              </div>

              {autoPlan && (
                <AutoCleanSummaryCard plan={autoPlan} manuallyAdjusted={autoManuallyAdjusted} />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-200">
                    Nombre de la nueva versión limpia
                  </label>
                  <input
                    type="text"
                    value={cleanName}
                    onChange={e => setCleanName(e.target.value)}
                    className={INPUT_GLASS_CLASS}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-200">
                    Columna objetivo (Y)
                  </label>
                  <SystemSelect
                    value={cleanTarget}
                    onChange={setCleanTarget}
                    size="sm"
                    searchable
                    ariaLabel="Columna objetivo para limpieza"
                    options={allColumnNames.map(c => ({
                      value: c,
                      label: c,
                      mono: true,
                    }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <span>Estrategia para valores nulos</span>
                    <InfoTip
                      title="Tratamiento de Nulos"
                      text="Mediana/Moda resiste outliers; Media/Moda funciona en datos simétricos; Eliminar filas descarta incompletas si son pocas (< 3%)."
                      side="top"
                    />
                  </label>
                  <SystemSelect
                    value={cleanMissing}
                    onChange={val => {
                      if (autoPlan) setAutoManuallyAdjusted(true)
                      setCleanMissing(val as MissingStrategy)
                    }}
                    size="sm"
                    ariaLabel="Estrategia nulos"
                    options={[
                      { value: 'median_mode', label: 'Imputar Mediana / Moda' },
                      { value: 'mean_mode', label: 'Imputar Media / Moda' },
                      { value: 'drop_rows', label: 'Eliminar filas con nulos' },
                      { value: 'zero', label: 'Rellenar con 0 / Desconocido' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <span>Tratamiento de valores atípicos (IQR)</span>
                    <InfoTip
                      title="Detección por Rango Intercuartílico"
                      text="Winsorize recorta anomalías extremas al límite IQR sin descartar registros; Eliminar descarta filas atípicas."
                      side="top"
                    />
                  </label>
                  <SystemSelect
                    value={cleanOutlier}
                    onChange={val => {
                      if (autoPlan) setAutoManuallyAdjusted(true)
                      setCleanOutlier(val as OutlierStrategy)
                    }}
                    size="sm"
                    ariaLabel="Estrategia outliers"
                    options={[
                      { value: 'none', label: 'Sin cambios' },
                      { value: 'iqr_clip', label: 'Recortar al rango IQR (Winsorize)' },
                      { value: 'iqr_drop', label: 'Eliminar filas atípicas (IQR)' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <span>Escalado de variables</span>
                    <InfoTip
                      title="Normalización Numérica"
                      text="Robust (Mediana/IQR) resiste colas largas; Standard usa media/desviación; Min-Max acota en [0, 1]."
                      side="top"
                    />
                  </label>
                  <SystemSelect
                    value={cleanScaler}
                    onChange={val => {
                      if (autoPlan) setAutoManuallyAdjusted(true)
                      setCleanScaler(val as ScalerStrategy)
                    }}
                    size="sm"
                    ariaLabel="Escalado"
                    options={[
                      { value: 'standard', label: 'Standard (Z-score)' },
                      { value: 'robust', label: 'Robust (Mediana / IQR)' },
                      { value: 'minmax', label: 'Min-Max [0, 1]' },
                      { value: 'none', label: 'Sin escalado' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <span>Partición Train / Val / Test</span>
                    <InfoTip
                      title="Proporción de Particiones"
                      text="Ajusta 80/10/10 en corpus grandes, 70/15/15 equilibrado o 60/20/20 para datasets pequeños."
                      side="top"
                    />
                  </label>
                  <SystemSelect
                    value={cleanSplitRatio}
                    onChange={val => {
                      if (autoPlan) setAutoManuallyAdjusted(true)
                      setCleanSplitRatio(val as SplitRatioOption)
                    }}
                    size="sm"
                    ariaLabel="Partición"
                    options={[
                      { value: '70/15/15', label: '70% / 15% / 15%' },
                      { value: '80/10/10', label: '80% / 10% / 10%' },
                      { value: '60/20/20', label: '60% / 20% / 20%' },
                    ]}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (autoPlan) setAutoManuallyAdjusted(true)
                  setCleanDropDups(prev => !prev)
                }}
                className={`w-full px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                  cleanDropDups
                    ? 'bg-teal-500/15 border-teal-400/60 text-teal-200'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CopyMinus className="w-4 h-4" />
                  <div>
                    <p className="text-xs font-semibold">Eliminar filas duplicadas exactas</p>
                    <p className="text-[11px] opacity-75">
                      Evita sesgos de entrenamiento causados por registros repetidos.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <InfoTip
                    title="Deduplicación Exacta"
                    text="Remueve registros repetidos para que no aparezcan simultáneamente en Train y Test."
                    side="left"
                  />
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                      cleanDropDups ? 'bg-teal-400/20 text-teal-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cleanDropDups ? 'ACTIVO' : 'DESACTIVADO'}
                  </span>
                </div>
              </button>

              <SmartCleaningToggles
                normalizeText={cleanNormalizeText}
                onChangeNormalizeText={v => {
                  if (autoPlan) setAutoManuallyAdjusted(true)
                  setCleanNormalizeText(v)
                }}
                extractDates={cleanExtractDates}
                onChangeExtractDates={v => {
                  if (autoPlan) setAutoManuallyAdjusted(true)
                  setCleanExtractDates(v)
                }}
                groupRareCategories={cleanGroupRare}
                onChangeGroupRareCategories={v => {
                  if (autoPlan) setAutoManuallyAdjusted(true)
                  setCleanGroupRare(v)
                }}
                logTransformSkewed={cleanLogSkewed}
                onChangeLogTransformSkewed={v => {
                  if (autoPlan) setAutoManuallyAdjusted(true)
                  setCleanLogSkewed(v)
                }}
                stratifySplit={cleanStratify}
                onChangeStratifySplit={v => {
                  if (autoPlan) setAutoManuallyAdjusted(true)
                  setCleanStratify(v)
                }}
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <FilterX className="w-3.5 h-3.5 text-amber-300" />
                    <span>Excluir columnas manualmente:</span>
                    <InfoTip
                      title="Exclusión de Columnas"
                      text="Descarta IDs, columnas constantes, fuga de datos (Target Leakage) o variables redundantes."
                      side="right"
                    />
                  </span>
                  {cleanDropCols.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCleanDropCols([])}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Limpiar selección ({cleanDropCols.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-950/65 border border-slate-800/80">
                  {eda.columns_summary.map(col => {
                    const isTarget = col.name === cleanTarget
                    const isDropped = cleanDropCols.includes(col.name)
                    return (
                      <button
                        key={col.name}
                        type="button"
                        disabled={isTarget}
                        onClick={() => toggleCleanDropCol(col.name)}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all ${
                          isTarget
                            ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-semibold cursor-not-allowed'
                            : isDropped
                              ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 line-through'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span>{col.name}</span>
                        {isTarget && <span className="text-[10px] text-cyan-300">(Y)</span>}
                        {!isTarget && col.missing > 0 && (
                          <span className="px-1 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                            {col.missing} null
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {cleanError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
                  {cleanError}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={cleaningBusy}
                  onClick={handleExecuteCleaning}
                  className="nl-btn-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-md transition-all"
                >
                  {cleaningBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  <span>
                    {cleaningBusy ? 'Procesando Limpieza...' : 'Aplicar Limpieza y Crear Versión'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-mono text-slate-400">
            v{dataset.version} · {eda.total_rows.toLocaleString()} filas · {eda.total_columns} cols
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={cleaningBusy}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
            {onGoToArchitectures && (
              <button
                type="button"
                onClick={onGoToArchitectures}
                className="nl-btn-shimmer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-semibold shadow-md transition-all"
              >
                <span>Diseñar Arquitectura (03)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
