import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  CheckSquare,
  FileSpreadsheet,
  GitMerge,
  Loader2,
  Search,
  Square,
  X,
} from 'lucide-react'
import type { Dataset } from '../../../types/index'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'
import { SystemTooltip } from '../../../components/InfoTip'

interface DatasetFusionModalProps {
  projectName?: string
  datasets: Dataset[]
  fusionIds: string[]
  onToggleFusionId: (id: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  fusionStrategy: 'union' | 'intersection'
  onChangeStrategy: (v: 'union' | 'intersection') => void
  deduplicate: boolean
  onToggleDeduplicate: () => void
  fusionName: string
  onChangeFusionName: (v: string) => void
  fusing: boolean
  onFuse: () => void
  onClose: () => void
}

export function DatasetFusionModal({
  projectName,
  datasets,
  fusionIds,
  onToggleFusionId,
  onSelectAll,
  onClearSelection,
  fusionStrategy,
  onChangeStrategy,
  deduplicate,
  onToggleDeduplicate,
  fusionName,
  onChangeFusionName,
  fusing,
  onFuse,
  onClose,
}: DatasetFusionModalProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !fusing && !document.querySelector('[role="listbox"]')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fusing, onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return datasets
    return datasets.filter(
      ds =>
        ds.name.toLowerCase().includes(q) ||
        ds.target.toLowerCase().includes(q) ||
        ds.version.toLowerCase().includes(q)
    )
  }, [datasets, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const selectedDatasets = useMemo(
    () => datasets.filter(d => fusionIds.includes(d.id)),
    [datasets, fusionIds]
  )

  const combinedRows = useMemo(
    () =>
      selectedDatasets.reduce(
        (acc, ds) => acc + ds.splits.train_count + ds.splits.val_count + ds.splits.test_count,
        0
      ),
    [selectedDatasets]
  )

  const distinctTargets = useMemo(
    () => Array.from(new Set(selectedDatasets.map(d => d.target))),
    [selectedDatasets]
  )

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-backdrop-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dataset-fusion-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !fusing) onClose()
      }}
    >
      <div className="relative nl-cyber-panel rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-pop-in">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-teal-400/85 via-cyan-400/80 to-indigo-500/85" />

        <div className="shrink-0 px-6 py-4 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-indigo-500/20 border border-teal-500/40 flex items-center justify-center shrink-0">
              <GitMerge className="w-5 h-5 text-teal-300" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2
                id="dataset-fusion-modal-title"
                className="text-base sm:text-lg font-bold text-white leading-tight"
              >
                Fusión Inteligente Intra-Área
              </h2>
              <p className="text-xs text-slate-400">
                Consolida 2 o más datasets de {projectName ?? 'esta área'} en una versión unificada con Auto-EDA.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={fusing}
            onClick={onClose}
            aria-label="Cerrar fusión intra-área"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="relative flex-1 min-w-48">
                <Search className="w-3.5 h-3.5 text-cyan-400/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Buscar dataset fuente..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#071123]/90 border border-cyan-500/25 focus:border-teal-400/80 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setPage(1)
                    }}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-teal-500/10 border border-teal-500/30 text-teal-300">
                  {fusionIds.length} seleccionados · ~{combinedRows.toLocaleString()} filas
                </span>
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors"
                >
                  Seleccionar todos
                </button>
                {fusionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800/70 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {distinctTargets.length > 1 && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Targets distintos detectados:{' '}
                  <span className="font-mono font-semibold">{distinctTargets.join(', ')}</span>.
                  Verifica compatibilidad de variable objetivo antes de fusionar.
                </span>
              </div>
            )}

            <div className="rounded-xl border border-slate-800/80 bg-slate-950/35 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  No hay datasets que coincidan con "{search}".
                </div>
              ) : (
                <div className="divide-y divide-slate-800/70">
                  {paginated.map(ds => {
                    const checked = fusionIds.includes(ds.id)
                    const totalRows =
                      ds.splits.train_count + ds.splits.val_count + ds.splits.test_count
                    return (
                      <button
                        key={ds.id}
                        type="button"
                        onClick={() => onToggleFusionId(ds.id)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                          checked
                            ? 'bg-teal-500/10 hover:bg-teal-500/15'
                            : 'hover:bg-slate-800/35'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-teal-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <FileSpreadsheet className="w-4 h-4 text-cyan-400/80 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                              {ds.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
                              <span className="text-violet-300">v{ds.version}</span>
                              <span>·</span>
                              <span>
                                {ds.input_shape} → <span className="text-cyan-300">{ds.target}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 shrink-0">
                          {totalRows.toLocaleString()} filas
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <PaginationBar
                currentPage={safePage}
                totalItems={filtered.length}
                pageSize={pageSize}
                pageSizeOptions={[5, 10, 25]}
                onPageChange={setPage}
                onPageSizeChange={size => {
                  setPageSize(size)
                  setPage(1)
                }}
                itemLabel="datasets"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t border-slate-800/80">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Estrategia de Esquema
              </label>
              <SystemSelect
                value={fusionStrategy}
                onChange={val => onChangeStrategy(val as 'union' | 'intersection')}
                size="sm"
                ariaLabel="Estrategia de Esquema"
                options={[
                  {
                    value: 'union',
                    label: 'Unión Inteligente',
                    badge: 'Imputación',
                    description: 'Conserva todas las columnas e imputa celdas ausentes con mediana/moda',
                  },
                  {
                    value: 'intersection',
                    label: 'Intersección Estricta',
                    badge: 'Comunes',
                    description: 'Mantiene únicamente columnas presentes en todos los CSV',
                  },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Deduplicación
              </label>
              <SystemTooltip
                title="Deduplicación por Huella SHA"
                label="Detecta y descarta automáticamente filas idénticas para evitar fuga de datos entre Train y Test."
                side="top"
                className="block w-full"
              >
                <button
                  type="button"
                  onClick={onToggleDeduplicate}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-colors ${
                    deduplicate
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#071123]/90 border-cyan-500/25 text-slate-400'
                  }`}
                >
                  {deduplicate ? 'Activa: Sin duplicados' : 'Desactivada: Conservar'}
                </button>
              </SystemTooltip>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nombre consolidado <span className="text-slate-500">(opcional)</span>
              </label>
              <input
                type="text"
                value={fusionName}
                onChange={e => onChangeFusionName(e.target.value)}
                placeholder="Ej: Área 01 · Consolidado Anual"
                className="w-full px-3 py-2 rounded-xl bg-[#071123]/90 hover:bg-[#0b1933]/95 border border-cyan-500/25 focus:border-teal-400/80 focus:ring-2 focus:ring-teal-400/20 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={fusing}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={fusing || fusionIds.length < 2}
            onClick={onFuse}
            className="nl-btn-shimmer inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold shadow-md transition-all"
          >
            {fusing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
            <span>{fusing ? 'Fusionando...' : `Fusionar ${fusionIds.length} Datasets`}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
