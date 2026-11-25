import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Clock, X } from 'lucide-react'
import { PaginationBar } from '../../../components/PaginationBar'

export interface InferenceHistoryEntry {
  id: string
  timestamp: string
  modelVersion: string
  targetColumn: string
  predictedLabel: string
  probability: number | null
  latencyMs: number
  summaryInputs: string
}

interface InferenceHistoryModalProps {
  history: InferenceHistoryEntry[]
  onClose: () => void
}

export function InferenceHistoryModal({ history, onClose }: InferenceHistoryModalProps) {
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

  const totalPages = Math.max(1, Math.ceil(history.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginated = history.slice((safePage - 1) * pageSize, safePage * pageSize)

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="twin-history-modal-title"
    >
      <div
        className="relative w-full max-w-4xl max-h-[86vh] flex flex-col rounded-2xl border border-cyan-500/25 bg-[#070f21] text-slate-100 shadow-[0_24px_90px_rgba(2,6,23,0.92)] overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 shrink-0" />

        <div className="px-5 py-4 border-b border-white/10 bg-slate-900/55 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="twin-history-modal-title" className="text-base font-bold text-white">
                Bitácora de Predicciones en esta Sesión ({history.length})
              </h2>
              <p className="text-xs text-slate-400">
                Historial cronológico de inferencias individuales ejecutadas en vivo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar bitácora"
            className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {history.length === 0 ? (
            <div className="py-14 text-center space-y-2 text-slate-400">
              <Clock className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">Aún no hay predicciones en esta sesión</p>
              <p className="text-xs text-slate-500">
                Ejecuta cualquier inferencia en vivo para registrarla aquí automáticamente.
              </p>
            </div>
          ) : (
            <>
              <div className="nl-cyber-panel rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/70 border-b border-slate-800 text-slate-400 font-mono text-[10.5px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Hora</th>
                        <th className="py-2.5 px-3">Modelo</th>
                        <th className="py-2.5 px-3">Muestra de Variables</th>
                        <th className="py-2.5 px-3">Predicción</th>
                        <th className="py-2.5 px-3">Confianza</th>
                        <th className="py-2.5 px-3">Latencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {paginated.map(item => (
                        <tr key={item.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-slate-400">{item.timestamp}</td>
                          <td className="py-2.5 px-3 text-indigo-300">{item.modelVersion}</td>
                          <td className="py-2.5 px-3 text-slate-300 truncate max-w-xs">
                            {item.summaryInputs}
                          </td>
                          <td className="py-2.5 px-3 text-teal-300 font-bold">{item.predictedLabel}</td>
                          <td className="py-2.5 px-3 text-white">
                            {item.probability !== null
                              ? `${(item.probability * 100).toFixed(1)}%`
                              : 'Regresión'}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-400">{item.latencyMs} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="nl-cyber-panel rounded-2xl overflow-hidden">
                <PaginationBar
                  currentPage={safePage}
                  totalItems={history.length}
                  pageSize={pageSize}
                  pageSizeOptions={[5, 8, 15]}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={size => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                  itemLabel="predicciones"
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
