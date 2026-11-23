import { useEffect, useState, type ReactNode } from 'react'
import { Filter, Search, X } from 'lucide-react'
import type { AuditEvent } from '../../../types/index'
import { ACTION_BADGE } from '../constants'
import { formatAuditMetadata } from '../helpers'
import { PaginationBar } from '../../../components/PaginationBar'
import { SystemSelect } from '../../../components/SystemSelect'

export function AuditLogSection({
  auditEvents,
  sectionNumber = '12',
  headerActions,
}: {
  auditEvents: AuditEvent[]
  sectionNumber?: string
  headerActions?: ReactNode
}) {
  const [auditFilter, setAuditFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)

  const uniqueActions = Array.from(new Set(auditEvents.map(e => e.action)))
  const q = searchQuery.trim().toLowerCase()

  useEffect(() => {
    setPage(1)
  }, [auditFilter, q, pageSize])

  const filteredEvents = auditEvents.filter(evt => {
    if (auditFilter !== 'ALL' && evt.action !== auditFilter) return false
    if (!q) return true
    const actor = (evt.actor_name || evt.actor_id || '').toLowerCase()
    const action = evt.action.toLowerCase()
    const meta = formatAuditMetadata(evt.metadata).toLowerCase()
    return actor.includes(q) || action.includes(q) || meta.includes(q)
  })

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const visibleEvents = filteredEvents.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="space-y-3">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 nl-no-print">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-extrabold font-mono flex items-center justify-center">
            {sectionNumber}
          </span>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-400">
            Bitácora de Auditoría ({filteredEvents.length})
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar actor, acción o dato..."
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-52"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {uniqueActions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <SystemSelect
                value={auditFilter}
                onChange={setAuditFilter}
                size="xs"
                className="w-48"
                align="right"
                searchable
                searchPlaceholder="Buscar acción en bitácora..."
                maxVisibleOptions={25}
                ariaLabel="Filtrar bitácora por acción"
                options={[
                  { value: 'ALL', label: `Todas las acciones (${auditEvents.length})` },
                  ...uniqueActions.map(act => ({ value: act, label: act, mono: true })),
                ]}
              />
            </div>
          )}

          {headerActions}
        </div>
      </div>

      <section className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">
                  Fecha
                </th>
                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">
                  Actor
                </th>
                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">
                  Acción
                </th>
                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {visibleEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No se registran eventos de auditoría para este criterio.
                  </td>
                </tr>
              ) : (
                visibleEvents.map(evt => {
                  const badgeClass =
                    ACTION_BADGE[evt.action] ||
                    'bg-slate-800 text-slate-300 border border-slate-700'
                  return (
                    <tr key={evt.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="px-3 py-2.5 text-slate-400 font-mono whitespace-nowrap">
                        {new Date(evt.created_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-white font-semibold whitespace-nowrap">
                        {evt.actor_name || evt.actor_id}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeClass}`}
                        >
                          {evt.action}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 font-mono">
                        {formatAuditMetadata(evt.metadata)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {filteredEvents.length > 0 && (
        <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-4 py-1.5 nl-no-print">
          <PaginationBar
            currentPage={safePage}
            totalItems={filteredEvents.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[6, 12, 24]}
            itemLabel="eventos de auditoría"
          />
        </div>
      )}
    </div>
  )
}
