import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Database,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  Sliders,
  X,
  Zap,
} from 'lucide-react'
import type { ColumnSummary, ModelVersion } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'
import { PaginationBar } from '../../../components/PaginationBar'
import { SystemSelect } from '../../../components/SystemSelect'

interface InferenceVariablesModalProps {
  selectedModel: ModelVersion
  targetCol: string
  inputColumns: ColumnSummary[]
  features: Record<string, any>
  sampleIdx: number
  hasPreviewRows: boolean
  inferring: boolean
  onChangeFeature: (name: string, value: any) => void
  onResetDefaults: () => void
  onLoadSampleRow: () => void
  onExecuteInference: () => void
  onClose: () => void
}

export function InferenceVariablesModal({
  selectedModel,
  targetCol,
  inputColumns,
  features,
  sampleIdx,
  hasPreviewRows,
  inferring,
  onChangeFeature,
  onResetDefaults,
  onLoadSampleRow,
  onExecuteInference,
  onClose,
}: InferenceVariablesModalProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'numeric' | 'categorical'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(9)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    setPage(1)
  }, [search, typeFilter, pageSize])

  const numericCount = inputColumns.filter(c => c.dtype === 'numeric').length
  const categoricalCount = inputColumns.length - numericCount

  const filteredColumns = inputColumns.filter(col => {
    if (typeFilter === 'numeric' && col.dtype !== 'numeric') return false
    if (typeFilter === 'categorical' && col.dtype !== 'categorical') return false
    if (!search.trim()) return true
    return col.name.toLowerCase().includes(search.trim().toLowerCase())
  })

  const totalPages = Math.max(1, Math.ceil(filteredColumns.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedColumns = filteredColumns.slice((safePage - 1) * pageSize, safePage * pageSize)

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="twin-vars-modal-title"
    >
      <div
        className="relative w-full max-w-4xl flex flex-col rounded-2xl border border-cyan-500/25 bg-[#070f21] text-slate-100 shadow-[0_24px_90px_rgba(2,6,23,0.92)] overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
          <div className="h-[2px] w-full bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-500" />
        </div>

        <div className="px-5 py-3.5 border-b border-white/10 bg-slate-900/55 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-cyan-400/35 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="twin-vars-modal-title" className="text-base font-bold text-white truncate">
                  Editor de Variables de Entrada ({inputColumns.length})
                </h2>
                <InfoTip
                  title="Ajuste Fino de Variables"
                  text="Modifica cualquier variable numérica o categórica del dataset activo. Los selectores desplegables se renderizan en capa flotante sin recortarse."
                  size="xs"
                />
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Dataset: <strong className="text-slate-200">{selectedModel.dataset_name}</strong> → Objetivo:{' '}
                <strong className="text-cyan-300 font-mono">{targetCol}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasPreviewRows && (
              <button
                type="button"
                onClick={onLoadSampleRow}
                disabled={inferring}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/35 text-teal-300 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Cargar Fila #{sampleIdx + 1}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onResetDefaults}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Promedios</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar editor de variables"
              className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 bg-slate-950/40">
          <div className="nl-cyber-panel rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar variable por nombre..."
                className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 focus:border-cyan-400 outline-none text-xs text-slate-200 placeholder:text-slate-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-950/90 p-1 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas ({inputColumns.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('numeric')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  typeFilter === 'numeric'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Numéricas ({numericCount})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('categorical')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  typeFilter === 'categorical'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Categóricas ({categoricalCount})
              </button>
            </div>
          </div>

          {paginatedColumns.length === 0 ? (
            <div className="nl-cyber-panel rounded-xl py-12 text-center text-slate-500 text-xs">
              Ninguna variable coincide con el filtro actual.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {paginatedColumns.map(col => {
                const val = features[col.name] ?? ''
                if (col.dtype === 'categorical') {
                  const categories = Object.keys(col.top_values || {})
                  return (
                    <div
                      key={col.name}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 hover:border-violet-500/40 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <label
                          className="text-slate-100 text-[11.5px] font-mono font-bold truncate"
                          title={col.name}
                        >
                          {col.name}
                        </label>
                        <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 shrink-0">
                          Categórica ({categories.length})
                        </span>
                      </div>
                      <SystemSelect
                        value={String(val)}
                        onChange={v => onChangeFeature(col.name, v)}
                        size="xs"
                        searchable={categories.length >= 5}
                        searchPlaceholder={`Buscar en ${col.name}...`}
                        maxVisibleOptions={25}
                        ariaLabel={col.name}
                        options={categories.map(cat => ({ value: cat, label: cat }))}
                      />
                    </div>
                  )
                }

                const minVal = col.min ?? 0
                const maxVal = col.max ?? 100
                const meanVal = col.mean ?? (minVal + maxVal) / 2
                const numVal = Number(val || 0)
                const rangeSpan = Math.max(0.0001, maxVal - minVal)
                const fillPct = Math.min(100, Math.max(0, ((numVal - minVal) / rangeSpan) * 100))

                const isInt =
                  Number.isInteger(col.min) &&
                  Number.isInteger(col.max) &&
                  maxVal - minVal >= 5

                return (
                  <div
                    key={col.name}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 hover:border-cyan-500/40 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <label
                        className="text-slate-100 text-[11.5px] font-mono font-bold truncate"
                        title={col.name}
                      >
                        {col.name}
                      </label>
                      <span className="text-[9.5px] text-cyan-300 font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 shrink-0">
                        [{Number(minVal).toFixed(isInt ? 0 : 1)} – {Number(maxVal).toFixed(isInt ? 0 : 1)}]
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={isInt ? 1 : 'any'}
                        value={val}
                        onChange={e =>
                          onChangeFeature(
                            col.name,
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-700/90 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono outline-none focus:border-teal-400 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-500 transition-all duration-200"
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400">
                        <span>Media: {Number(meanVal).toFixed(isInt ? 0 : 1)}</span>
                        <span>{fillPct.toFixed(0)}% del rango</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="nl-cyber-panel rounded-xl px-3.5 py-1">
            <PaginationBar
              currentPage={safePage}
              totalItems={filteredColumns.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[6, 9, 12]}
              itemLabel="variables de entrada"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-slate-900/65 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {numericCount} numéricas · {categoricalCount} categóricas sincronizadas con TensorFlow/Keras
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-white/15 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={inferring}
              onClick={() => {
                onExecuteInference()
                onClose()
              }}
              className="nl-btn-shimmer inline-flex items-center gap-2 px-5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-60"
            >
              {inferring ? <Zap className="w-4 h-4 animate-bounce" /> : <Play className="w-4 h-4" />}
              <span>Aplicar y Ejecutar Inferencia (.keras)</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
