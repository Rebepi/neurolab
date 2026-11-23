import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, BookmarkCheck, Layers, Search, X } from 'lucide-react'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'
import type { Architecture } from '../../../types/index'

interface SavedArchitecturesModalProps {
  architectures: Architecture[]
  onLoad: (arch: Architecture) => void
  onClose: () => void
}

type FamilyFilter = 'ALL' | 'Feedforward' | 'CNN' | 'RNN' | 'GAN'

export function SavedArchitecturesModal({
  architectures,
  onLoad,
  onClose,
}: SavedArchitecturesModalProps) {
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('ALL')
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
      if (e.key === 'Escape' && !document.querySelector('[role="listbox"]')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return architectures.filter(arch => {
      if (familyFilter !== 'ALL' && arch.family !== familyFilter) return false
      if (!q) return true
      return (
        arch.name.toLowerCase().includes(q) ||
        arch.family.toLowerCase().includes(q) ||
        arch.version.toLowerCase().includes(q) ||
        (arch.justification ?? '').toLowerCase().includes(q)
      )
    })
  }, [architectures, familyFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  function clearFilters() {
    setSearch('')
    setFamilyFilter('ALL')
    setPage(1)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-backdrop-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-architectures-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative nl-cyber-panel rounded-2xl w-full max-w-3xl max-h-[86vh] flex flex-col overflow-hidden shadow-2xl animate-pop-in">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-400/85 via-cyan-400/80 to-indigo-500/85" />

        <div className="shrink-0 px-6 py-4 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/35 flex items-center justify-center shrink-0">
              <BookmarkCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2
                id="saved-architectures-modal-title"
                className="text-base sm:text-lg font-bold text-white leading-tight"
              >
                Archivo de Arquitecturas
              </h2>
              <p className="text-xs text-slate-400">
                {architectures.length}{' '}
                {architectures.length === 1
                  ? 'topología registrada en este workspace'
                  : 'topologías registradas en este workspace'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar archivo de arquitecturas"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-700 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1 min-w-44">
              <Search className="w-3.5 h-3.5 text-cyan-400/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Buscar por nombre, familia o versión..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#071123]/90 border border-cyan-500/25 focus:border-teal-400/80 text-xs text-white placeholder-slate-500 outline-none transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setPage(1)
                  }}
                  aria-label="Limpiar búsqueda de arquitecturas"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <SystemSelect
              value={familyFilter}
              onChange={val => {
                setFamilyFilter(val as FamilyFilter)
                setPage(1)
              }}
              size="sm"
              className="w-full sm:w-52"
              ariaLabel="Filtrar por familia"
              options={[
                { value: 'ALL', label: 'Todas las familias', badge: String(architectures.length) },
                { value: 'Feedforward', label: 'Feedforward' },
                { value: 'CNN', label: 'CNN' },
                { value: 'RNN', label: 'RNN' },
                { value: 'GAN', label: 'GAN' },
              ]}
            />
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/35 overflow-hidden">
            {architectures.length === 0 ? (
              <div className="px-6 py-12 text-center space-y-2">
                <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">Sin topologías guardadas aún</p>
                <p className="text-xs text-slate-500">
                  Diseña tu red neuronal en el estudio y presiona Guardar para registrarla aquí.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-10 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  No hay arquitecturas que coincidan con el filtro aplicado.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-800/70">
                  {paginated.map(arch => {
                    const layers = arch.config?.layers ?? []
                    return (
                      <div
                        key={arch.id}
                        className="p-4 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="min-w-0 space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-white truncate">{arch.name}</h3>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-violet-500/15 text-violet-300 border border-violet-500/30">
                              v{arch.version}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              {arch.family}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                              {arch.total_parameters.toLocaleString()} p
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                            {layers.slice(0, 5).map((layer, lIdx) => (
                              <span
                                key={layer.id ?? lIdx}
                                className={`px-1.5 py-0.5 rounded border ${
                                  layer.type === 'Dense'
                                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                                    : layer.type === 'Dropout'
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                      : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                                }`}
                              >
                                {layer.type === 'Dense'
                                  ? `Dense ${layer.units ?? 32}`
                                  : layer.type === 'Dropout'
                                    ? `Drop ${Math.round((layer.rate ?? 0.2) * 100)}%`
                                    : 'BN'}
                              </span>
                            ))}
                            {layers.length > 5 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                +{layers.length - 5}
                              </span>
                            )}
                          </div>

                          {arch.justification && (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {arch.justification}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onLoad(arch)
                            onClose()
                          }}
                          className="nl-btn-shimmer inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold shrink-0 transition-all shadow-sm"
                        >
                          <span>Cargar en Estudio</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>

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
                  itemLabel="arquitecturas"
                />
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-mono text-slate-400">
            Mostrando {filtered.length} de {architectures.length} arquitecturas
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
