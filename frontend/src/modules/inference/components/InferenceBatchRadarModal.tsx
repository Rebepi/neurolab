import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Radar, Search, Users, X } from 'lucide-react'
import type { BatchPredictionItem, BatchPredictionResponse } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'
import { PaginationBar } from '../../../components/PaginationBar'
import { SystemSelect } from '../../../components/SystemSelect'

interface InferenceBatchRadarModalProps {
  batchData: BatchPredictionResponse | null
  scanningBatch: boolean
  onScanBatch: () => void
  onInspectItem: (item: BatchPredictionItem) => void
  onClose: () => void
}

const RISK_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Todos los niveles' },
  { value: 'ALTO', label: 'Prioridad Alta' },
  { value: 'MEDIO', label: 'Prioridad Media' },
  { value: 'BAJO', label: 'Prioridad Baja' },
]

export function InferenceBatchRadarModal({
  batchData,
  scanningBatch,
  onScanBatch,
  onInspectItem,
  onClose,
}: InferenceBatchRadarModalProps) {
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)

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
    setCurrentPage(1)
  }, [batchData])

  const items = batchData?.items ?? []
  const query = search.trim().toLowerCase()
  const filteredItems = items.filter(item => {
    if (riskFilter !== 'ALL' && item.risk_level !== riskFilter) return false
    if (!query) return true
    const summary = Object.entries(item.features)
      .slice(0, 4)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
    const haystack = `#${item.row_index} ${item.predicted_label} ${summary}`.toLowerCase()
    return haystack.includes(query)
  })

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize)

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-radar-modal-title"
    >
      <div
        className="relative w-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl border border-cyan-500/25 bg-[#070f21] text-slate-100 shadow-[0_24px_90px_rgba(2,6,23,0.92)] overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-rose-400 shrink-0" />

        <div className="px-5 py-4 border-b border-white/10 bg-slate-900/55 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-400/35 flex items-center justify-center shrink-0">
              <Radar className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="batch-radar-modal-title" className="text-base font-bold text-white truncate">
                  Radar Masivo de Riesgo (Inferencia Batch Real en Keras)
                </h2>
                <InfoTip
                  title="Evaluación Masiva por Lotes"
                  text="Envía 25 registros reales del CSV del área en una sola llamada al binario .keras, los ordena por nivel de prioridad y permite cargar cualquiera directamente en el Gemelo 3D."
                  size="xs"
                />
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Escanea lotes de 25 registros reales sobre tu red neuronal entrenada y sincronízalos en el Gemelo 3D con un clic.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onScanBatch}
              disabled={scanningBatch}
              className="nl-btn-shimmer flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              <Users className={`w-3.5 h-3.5 ${scanningBatch ? 'animate-pulse' : ''}`} />
              <span>
                {scanningBatch
                  ? 'Escaneando lote...'
                  : batchData
                    ? 'Escanear Siguiente Lote (25)'
                    : 'Escanear 25 Registros Ahora'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar radar batch"
              className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {!batchData ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400">
                <Radar className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Listo para escaneo masivo por lote
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Pulsa «Escanear 25 Registros Ahora» para evaluar un lote real del dataset sobre el modelo Keras activo.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Registros Evaluados</span>
                  <span className="text-lg font-extrabold text-white font-mono">
                    {batchData.total_scanned}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between">
                  <span className="text-xs text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Prioridad Alta
                  </span>
                  <span className="text-lg font-extrabold text-rose-400 font-mono">
                    {batchData.high_risk_count}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                  <span className="text-xs text-emerald-300">Latencia Total Batch</span>
                  <span className="text-lg font-extrabold text-emerald-400 font-mono">
                    {batchData.latency_ms} ms
                  </span>
                </div>
              </div>

              <div className="nl-cyber-panel rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => {
                        setSearch(e.target.value)
                        setCurrentPage(1)
                      }}
                      placeholder="Buscar fila, predicción o variable..."
                      className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-cyan-400 outline-none text-xs text-slate-200 placeholder:text-slate-500"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('')
                          setCurrentPage(1)
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="w-44">
                    <SystemSelect
                      value={riskFilter}
                      onChange={val => {
                        setRiskFilter(val)
                        setCurrentPage(1)
                      }}
                      size="xs"
                      ariaLabel="Filtrar por nivel de prioridad"
                      options={RISK_FILTER_OPTIONS}
                    />
                  </div>
                </div>

                <span className="text-xs font-mono text-slate-400">
                  {filteredItems.length} de {items.length} registros
                </span>
              </div>

              <div className="nl-cyber-panel rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/70 text-slate-400 font-mono text-[10.5px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Registro #</th>
                        <th className="py-2.5 px-3">Resumen de Variables</th>
                        <th className="py-2.5 px-3">Predicción Keras</th>
                        <th className="py-2.5 px-3">Confianza</th>
                        <th className="py-2.5 px-3">Nivel</th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {paginatedItems.map(item => {
                        const summary = Object.entries(item.features)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(' · ')
                        return (
                          <tr key={item.row_index} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400">#{item.row_index}</td>
                            <td className="py-2.5 px-3 text-slate-300 truncate max-w-xs">{summary}</td>
                            <td className="py-2.5 px-3 text-white font-bold">{item.predicted_label}</td>
                            <td className="py-2.5 px-3 text-cyan-300 font-bold">
                              {item.probability !== null
                                ? `${(item.probability * 100).toFixed(1)}%`
                                : 'Regresión'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.risk_level === 'ALTO'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : item.risk_level === 'MEDIO'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                }`}
                              >
                                {item.risk_level}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  onInspectItem(item)
                                  onClose()
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600/85 hover:bg-indigo-500 text-white text-[11px] font-sans font-semibold transition-colors"
                              >
                                Cargar en 3D
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="nl-cyber-panel rounded-2xl overflow-hidden">
                <PaginationBar
                  currentPage={safePage}
                  totalItems={filteredItems.length}
                  pageSize={pageSize}
                  pageSizeOptions={[5, 8, 15, 25]}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={size => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                  itemLabel="registros evaluados"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
