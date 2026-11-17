import { useState } from 'react'
import { Download, Eye, Loader2, RefreshCw, Search } from 'lucide-react'
import type { AuditEvent } from '../../../types'
import { ACTION_BADGE } from '../constants'
import { AuditDetailModal } from './AuditDetailModal'
import { SystemSelect } from '../../../components/SystemSelect'
import { PaginationBar } from '../../../components/PaginationBar'
import { useToast } from '../../../components/toast/ToastContext'

interface GlobalAuditTabProps {
  auditEvents: AuditEvent[]
  loading?: boolean
  onRefresh?: () => void
}

export function GlobalAuditTab({ auditEvents, loading = false, onRefresh }: GlobalAuditTabProps) {
  const toast = useToast()
  const [actionFilter, setActionFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const uniqueActions = Array.from(new Set(auditEvents.map(e => e.action)))
  const filteredAudit = auditEvents.filter(ev => {
    const matchesAction = !actionFilter || ev.action === actionFilter
    const q = searchQuery.trim().toLowerCase()
    const matchesQuery =
      !q ||
      ev.actor_name.toLowerCase().includes(q) ||
      ev.action.toLowerCase().includes(q) ||
      (ev.project_id ?? '').toLowerCase().includes(q) ||
      JSON.stringify(ev.metadata ?? {}).toLowerCase().includes(q)
    return matchesAction && matchesQuery
  })

  const totalPages = Math.max(1, Math.ceil(filteredAudit.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedAudit = filteredAudit.slice((safePage - 1) * pageSize, safePage * pageSize)

  function handleExportJson() {
    const blob = new Blob([JSON.stringify(filteredAudit, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `neurolab-auditoria-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Auditoría exportada en JSON', `${filteredAudit.length} eventos exportados`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar actor, proyecto o payload..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <SystemSelect
            value={actionFilter}
            onChange={val => {
              setActionFilter(val)
              setCurrentPage(1)
            }}
            size="sm"
            className="w-full sm:w-64"
            ariaLabel="Filtrar auditoría por tipo de acción"
            options={[
              { value: '', label: `Todas las acciones (${auditEvents.length})` },
              ...uniqueActions.map(a => ({ value: a, label: a, mono: true })),
            ]}
          />

          <span className="text-slate-400 text-xs font-mono px-1">
            {filteredAudit.length} eventos
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-slate-950/75 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportJson}
            disabled={filteredAudit.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-950/75 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-45 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Exportar JSON</span>
          </button>
        </div>
      </div>

      {selectedEvent && (
        <AuditDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      <div className="nl-surface rounded-2xl border border-slate-700/50 overflow-hidden">
        {loading && auditEvents.length === 0 ? (
          <div className="p-12 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" />
          </div>
        ) : filteredAudit.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm text-slate-300 font-semibold">No se encontraron eventos de auditoría</p>
            {(searchQuery || actionFilter) && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setActionFilter('') }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/85">
                  <tr>
                    {['Fecha', 'Actor', 'Proyecto', 'Acción', 'Detalles', 'Inspección'].map(h => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-slate-400 text-[11px] uppercase tracking-wider font-bold whitespace-nowrap ${
                          h === 'Inspección' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedAudit.map(ev => {
                    const rawMeta = JSON.stringify(ev.metadata)
                    return (
                      <tr
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className="hover:bg-slate-800/35 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">
                          {new Date(ev.created_at).toLocaleString('es', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-white font-medium">{ev.actor_name}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono">
                          {ev.project_id ? `${ev.project_id.slice(0, 12)}...` : 'Sistema'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${ACTION_BADGE[ev.action] || 'bg-slate-700 text-slate-300'}`}>
                            {ev.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono max-w-52 truncate">
                          {rawMeta.slice(0, 56)}
                          {rawMeta.length > 56 ? '...' : ''}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedEvent(ev)
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3 h-3 text-indigo-400" />
                            <span>Ver detalle</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              currentPage={safePage}
              totalItems={filteredAudit.length}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={setCurrentPage}
              onPageSizeChange={size => {
                setPageSize(size)
                setCurrentPage(1)
              }}
              itemLabel="eventos"
            />
          </>
        )}
      </div>
    </div>
  )
}
