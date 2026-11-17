import { useState, useEffect, useCallback } from 'react'
import { Activity, Clock, ScrollText, Users2 } from 'lucide-react'
import { api } from '../../services/api'
import type { AuditEvent } from '../../types'
import { GlobalAuditTab } from './components/GlobalAuditTab'
import { useToast } from '../../components/toast/ToastContext'

export default function AuditModule() {
  const { success: notifySuccess, error: notifyError } = useToast()
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  const loadAudit = useCallback(async () => {
    setLoading(true)
    try {
      const events = await api.getAuditEvents(undefined, 200)
      setAuditEvents(events)
      notifySuccess('Bitácora actualizada', `${events.length} eventos cargados`)
    } catch (e: unknown) {
      notifyError('Error al cargar auditoría', e instanceof Error ? e.message : 'No se pudo consultar la bitácora')
    } finally {
      setLoading(false)
    }
  }, [notifySuccess, notifyError])

  useEffect(() => {
    let active = true
    api.getAuditEvents(undefined, 200)
      .then(events => {
        if (active) setAuditEvents(events)
      })
      .catch((e: unknown) => {
        if (active) {
          notifyError('Error al cargar auditoría', e instanceof Error ? e.message : 'No se pudo consultar la bitácora')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [notifyError])

  const uniqueActionsCount = new Set(auditEvents.map(e => e.action)).size
  const uniqueActorsCount = new Set(auditEvents.map(e => e.actor_name)).size
  const latestEventTime = auditEvents[0]?.created_at
    ? new Date(auditEvents[0].created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="nl-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Eventos Auditados</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">{auditEvents.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <ScrollText className="w-4 h-4 text-indigo-400" />
          </div>
        </div>

        <div className="nl-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Tipos de Acción</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">{uniqueActionsCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
        </div>

        <div className="nl-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Actores Activos</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">{uniqueActorsCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Users2 className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <div className="nl-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Última Actividad</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">{latestEventTime}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
        </div>
      </div>

      <GlobalAuditTab
        auditEvents={auditEvents}
        loading={loading}
        onRefresh={loadAudit}
      />
    </div>
  )
}
