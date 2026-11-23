import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import type { AuditEvent, Project, User } from '../../types'
import { GlobalAuditTab } from './components/GlobalAuditTab'
import { useToast } from '../../components/toast/ToastContext'

export default function AuditModule() {
  const { success: notifySuccess, error: notifyError } = useToast()
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadAudit = useCallback(
    async (notifyUser = true) => {
      setRefreshing(true)
      try {
        const [events, projs, usrs] = await Promise.all([
          api.getAuditEvents(undefined, 300),
          api.getProjects().catch(() => [] as Project[]),
          api.getUsers().catch(() => [] as User[]),
        ])
        setAuditEvents(events)
        setProjects(projs)
        setUsers(usrs)
        if (notifyUser) {
          notifySuccess('Bitácora actualizada', `${events.length} eventos cargados`)
        }
      } catch (e: unknown) {
        if (notifyUser) {
          notifyError(
            'Error al cargar auditoría',
            e instanceof Error ? e.message : 'No se pudo consultar la bitácora'
          )
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [notifySuccess, notifyError]
  )

  useEffect(() => {
    let active = true
    Promise.all([
      api.getAuditEvents(undefined, 300),
      api.getProjects().catch(() => [] as Project[]),
      api.getUsers().catch(() => [] as User[]),
    ])
      .then(([events, projs, usrs]) => {
        if (!active) return
        setAuditEvents(events)
        setProjects(projs)
        setUsers(usrs)
      })
      .catch((e: unknown) => {
        if (active) {
          notifyError(
            'Error al cargar auditoría',
            e instanceof Error ? e.message : 'No se pudo consultar la bitácora'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [notifyError])

  return (
    <div className="flex-1 flex flex-col gap-4 md:min-h-0">
      <GlobalAuditTab
        auditEvents={auditEvents}
        projects={projects}
        users={users}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => loadAudit(true)}
        onSilentRefresh={() => loadAudit(false)}
      />
    </div>
  )
}
