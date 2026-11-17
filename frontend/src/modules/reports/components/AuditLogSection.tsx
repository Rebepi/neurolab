import { useState } from 'react'
import { Filter, Search, ChevronDown, ChevronUp } from 'lucide-react'
import type { AuditEvent } from '../../../types/index'
import { ACTION_BADGE } from '../constants'
import { formatAuditMetadata } from '../helpers'
import { SystemSelect } from '../../../components/SystemSelect'

export function AuditLogSection({ auditEvents }: { auditEvents: AuditEvent[] }) {
  const [auditFilter, setAuditFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllEvents, setShowAllEvents] = useState(false)

  const uniqueActions = Array.from(new Set(auditEvents.map(e => e.action)))
  const q = searchQuery.trim().toLowerCase()

  const filteredEvents = auditEvents.filter(evt => {
    if (auditFilter !== 'ALL' && evt.action !== auditFilter) return false
    if (!q) return true
    const actor = (evt.actor_name || evt.actor_id || '').toLowerCase()
    const action = evt.action.toLowerCase()
    const meta = formatAuditMetadata(evt.metadata).toLowerCase()
    return actor.includes(q) || action.includes(q) || meta.includes(q)
  })

  const visibleEvents = showAllEvents ? filteredEvents : filteredEvents.slice(0, 8)

  return (
    <section className="nl-surface animate-card-reveal rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-extrabold font-mono flex items-center justify-center">
            06
          </span>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
            Bitácora de Auditoría ({filteredEvents.length})
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 nl-no-print">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar actor, acción o dato..."
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-56"
            />
          </div>

          {uniqueActions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <SystemSelect
                value={auditFilter}
                onChange={setAuditFilter}
                size="xs"
                className="w-56"
                align="right"
                ariaLabel="Filtrar bitácora por acción"
                options={[
                  { value: 'ALL', label: `Todas las acciones (${auditEvents.length})` },
                  ...uniqueActions.map(act => ({ value: act, label: act, mono: true })),
                ]}
              />
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">Fecha</th>
              <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">Actor</th>
              <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">Acción</th>
              <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">Detalle</th>
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
                const badgeClass = ACTION_BADGE[evt.action] || 'bg-slate-800 text-slate-300 border border-slate-700'
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
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeClass}`}>
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

      {filteredEvents.length > 8 && (
        <div className="flex justify-center pt-1 nl-no-print">
          <button
            onClick={() => setShowAllEvents(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-indigo-400 transition-colors"
          >
            {showAllEvents ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showAllEvents ? 'Mostrar menos' : `Ver los ${filteredEvents.length} eventos`}</span>
          </button>
        </div>
      )}
    </section>
  )
}

