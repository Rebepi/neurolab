import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Download,
  RefreshCw,
  ShieldOff,
  UserPlus,
  Users2,
} from 'lucide-react'
import { api } from '../../services/api'
import type { AuditEvent, Project, User, UserRole } from '../../types'
import {
  type AreaPermissionsStore,
  loadAreaPermissionsStore,
  saveAreaPermissionsStore,
} from './areaPermissions'
import {
  type UserActivityStats,
  type UserWorkspaceMembership,
  exportUsersDirectoryCsv,
} from './constants'
import { UsersTab } from './components/UsersTab'
import { WorkspaceAccessTab } from './components/WorkspaceAccessTab'
import { UserDetailDrawer } from './components/UserDetailDrawer'
import { GranularPermissionsDrawer } from './components/GranularPermissionsDrawer'
import { CreateUserModal } from './components/CreateUserModal'
import { EditUserModal } from './components/EditUserModal'
import { useToast } from '../../components/toast/ToastContext'

type AdminTabId = 'users' | 'workspaces'

export default function AdminModule({ currentUser }: { currentUser: User | null }) {
  const { error: notifyError, success: notifySuccess } = useToast()
  const [activeTab, setActiveTab] = useState<AdminTabId>('users')
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [areaPermissions, setAreaPermissions] = useState<AreaPermissionsStore>(() =>
    loadAreaPermissionsStore()
  )
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null)
  const [permEditorTarget, setPermEditorTarget] = useState<{
    projectId: string
    userId: string
  } | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadWorkspaceData = useCallback(
    async (showInitialLoader = false) => {
      if (showInitialLoader) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
      try {
        const [usersRes, projectsRes, eventsRes] = await Promise.all([
          api.getUsers(),
          api.getProjects().catch(() => [] as Project[]),
          api.getAuditEvents(undefined, 200).catch(() => [] as AuditEvent[]),
        ])
        const detailedProjects = await Promise.all(
          projectsRes.map(p => api.getProject(p.id).catch(() => p))
        )
        setUsers(usersRes)
        setProjects(detailedProjects)
        setAuditEvents(eventsRes)
      } catch (e: unknown) {
        notifyError(
          'Error al cargar Usuarios & RBAC',
          e instanceof Error ? e.message : 'No se pudo obtener la información de gobernanza'
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [notifyError]
  )

  useEffect(() => {
    if (currentUser?.role !== 'Administrador') return
    loadWorkspaceData(true)
  }, [currentUser?.role, loadWorkspaceData])

  const membershipsByUser = useMemo(() => {
    const map: Record<string, UserWorkspaceMembership[]> = {}
    for (const proj of projects) {
      for (const mem of proj.members || []) {
        if (!map[mem.user_id]) map[mem.user_id] = []
        map[mem.user_id].push({
          projectId: proj.id,
          projectName: proj.name,
          projectStatus: proj.status,
          areaRole: mem.role,
          isOwner: proj.owner_id === mem.user_id,
          joinedAt: mem.created_at,
        })
      }
    }
    return map
  }, [projects])

  const activityByUser = useMemo(() => {
    const map: Record<string, UserActivityStats> = {}
    for (const u of users) {
      map[u.id] = { count: 0, lastAt: null, events: [] }
    }
    const nameToId = new Map(users.map(u => [u.display_name, u.id]))
    for (const ev of auditEvents) {
      const targetId = map[ev.actor_id] ? ev.actor_id : nameToId.get(ev.actor_name)
      if (!targetId) continue
      const bucket = map[targetId]
      bucket.count += 1
      bucket.events.push(ev)
      if (!bucket.lastAt || ev.created_at > bucket.lastAt) {
        bucket.lastAt = ev.created_at
      }
    }
    return map
  }, [auditEvents, users])

  if (currentUser?.role !== 'Administrador') {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-800/50 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold">Acceso restringido</p>
          <p className="text-slate-400 text-sm mt-1">
            Solo el Administrador tiene acceso a la gestión de usuarios y roles RBAC
          </p>
        </div>
      </div>
    )
  }

  const activeAdminCount = users.filter(
    u => u.role === 'Administrador' && u.status === 'ACTIVE'
  ).length

  const inspectedUser = inspectedUserId
    ? users.find(u => u.id === inspectedUserId) || null
    : null

  const permEditorProject = permEditorTarget
    ? projects.find(p => p.id === permEditorTarget.projectId) || null
    : null
  const permEditorUser = permEditorTarget
    ? users.find(u => u.id === permEditorTarget.userId) || null
    : null
  const permEditorMember =
    permEditorProject && permEditorUser
      ? (permEditorProject.members || []).find(m => m.user_id === permEditorUser.id) || null
      : null

  async function refreshSingleProject(projectId: string) {
    const updated = await api.getProject(projectId).catch(() => null)
    if (!updated) return
    setProjects(prev => prev.map(p => (p.id === projectId ? updated : p)))
  }

  function handleSaveAreaPermissions(
    projectId: string,
    userId: string,
    overrides: Record<string, boolean>
  ) {
    setAreaPermissions(prev => {
      const nextProject = { ...(prev[projectId] || {}) }
      if (Object.keys(overrides).length > 0) {
        nextProject[userId] = overrides
      } else {
        delete nextProject[userId]
      }
      const next: AreaPermissionsStore = { ...prev }
      if (Object.keys(nextProject).length > 0) {
        next[projectId] = nextProject
      } else {
        delete next[projectId]
      }
      saveAreaPermissionsStore(next)
      return next
    })
    const uObj = users.find(u => u.id === userId)
    const pObj = projects.find(p => p.id === projectId)
    const count = Object.keys(overrides).length
    notifySuccess(
      'Permisos granulares guardados',
      `${uObj?.display_name || 'Usuario'} en ${pObj?.name || 'Área'} · ${
        count > 0 ? `${count} ajuste(s) personalizados` : 'Perfil base del rol'
      }`
    )
  }

  async function handleUpdateUser(
    userId: string,
    updates: { role: string; status: string }
  ) {
    const existing = users.find(u => u.id === userId)
    if (!existing) return
    const isLastActiveAdmin =
      existing.role === 'Administrador' &&
      existing.status === 'ACTIVE' &&
      activeAdminCount <= 1

    if (
      isLastActiveAdmin &&
      (updates.role !== 'Administrador' || updates.status !== 'ACTIVE')
    ) {
      throw new Error('No se puede degradar ni suspender al único Administrador activo.')
    }

    if (updates.role !== existing.role) {
      await api.updateUserRole(userId, updates.role)
    }
    if (updates.status !== existing.status) {
      await api.updateUserStatus(userId, updates.status)
    }
    setUsers(us =>
      us.map(u =>
        u.id === userId
          ? { ...u, role: updates.role as UserRole, status: updates.status }
          : u
      )
    )
    notifySuccess(
      'Usuario actualizado',
      `${existing.display_name} · ${updates.role} (${
        updates.status === 'ACTIVE' ? 'Activo' : 'Inactivo'
      })`
    )
  }

  async function handleToggleStatus(user: User) {
    const isLastActiveAdmin =
      user.role === 'Administrador' && user.status === 'ACTIVE' && activeAdminCount <= 1
    if (user.id === currentUser?.id || isLastActiveAdmin) {
      notifyError('Acción protegida', 'No se puede suspender esta cuenta activa.')
      return
    }
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await api.updateUserStatus(user.id, nextStatus)
    setUsers(us => us.map(u => (u.id === user.id ? { ...u, status: nextStatus } : u)))
    notifySuccess(
      nextStatus === 'ACTIVE' ? 'Cuenta reactivada' : 'Cuenta suspendida',
      `${user.display_name} ahora está ${nextStatus === 'ACTIVE' ? 'Activa' : 'Inactiva'}`
    )
  }

  async function handleCreateUser(payload: {
    email: string
    display_name: string
    password: string
    role: string
    initialProjectIds: string[]
  }) {
    const created = await api.createUser({
      email: payload.email,
      display_name: payload.display_name,
      password: payload.password,
      role: payload.role,
    })
    for (const pid of payload.initialProjectIds) {
      await api.addProjectMember(pid, { user_id: created.id, role: created.role }).catch(() => {})
    }
    setUsers(us => [created, ...us])
    if (payload.initialProjectIds.length > 0) {
      await Promise.all(payload.initialProjectIds.map(pid => refreshSingleProject(pid)))
    }
    notifySuccess(
      'Usuario creado',
      `${created.display_name} (${created.role})${
        payload.initialProjectIds.length > 0
          ? ` · ${payload.initialProjectIds.length} área(s)`
          : ''
      }`
    )
  }

  async function handleBulkUpdateRole(userIds: string[], role: UserRole) {
    const eligible = userIds.filter(id => {
      if (id === currentUser?.id) return false
      const u = users.find(item => item.id === id)
      if (!u) return false
      if (
        u.role === 'Administrador' &&
        u.status === 'ACTIVE' &&
        role !== 'Administrador' &&
        activeAdminCount <= 1
      ) {
        return false
      }
      return true
    })
    if (eligible.length === 0) return

    await Promise.all(eligible.map(id => api.updateUserRole(id, role)))
    setUsers(prev =>
      prev.map(u => (eligible.includes(u.id) ? { ...u, role } : u))
    )
    notifySuccess('Rol actualizado en lote', `${eligible.length} cuentas asignadas a ${role}`)
  }

  async function handleBulkUpdateStatus(userIds: string[], status: 'ACTIVE' | 'INACTIVE') {
    const eligible = userIds.filter(id => {
      if (id === currentUser?.id) return false
      const u = users.find(item => item.id === id)
      if (!u) return false
      if (
        status === 'INACTIVE' &&
        u.role === 'Administrador' &&
        u.status === 'ACTIVE' &&
        activeAdminCount <= 1
      ) {
        return false
      }
      return true
    })
    if (eligible.length === 0) return

    await Promise.all(eligible.map(id => api.updateUserStatus(id, status)))
    setUsers(prev =>
      prev.map(u => (eligible.includes(u.id) ? { ...u, status } : u))
    )
    notifySuccess(
      'Estado actualizado en lote',
      `${eligible.length} cuentas marcadas como ${status === 'ACTIVE' ? 'Activas' : 'Inactivas'}`
    )
  }

  async function handleAssignMember(projectId: string, userId: string, role: string) {
    await api.addProjectMember(projectId, { user_id: userId, role })
    await refreshSingleProject(projectId)
    const userObj = users.find(u => u.id === userId)
    notifySuccess('Miembro asignado', `${userObj?.display_name || 'Usuario'} incorporado al área`)
  }

  async function handleRevokeMember(projectId: string, userId: string) {
    await api.removeProjectMember(projectId, userId)
    setAreaPermissions(prev => {
      if (!prev[projectId]?.[userId]) return prev
      const nextProject = { ...prev[projectId] }
      delete nextProject[userId]
      const next: AreaPermissionsStore = { ...prev }
      if (Object.keys(nextProject).length > 0) {
        next[projectId] = nextProject
      } else {
        delete next[projectId]
      }
      saveAreaPermissionsStore(next)
      return next
    })
    await refreshSingleProject(projectId)
    const userObj = users.find(u => u.id === userId)
    notifySuccess('Acceso revocado', `${userObj?.display_name || 'Usuario'} retirado del área`)
  }

  async function handleChangeMemberRole(projectId: string, userId: string, role: string) {
    await api.removeProjectMember(projectId, userId)
    await api.addProjectMember(projectId, { user_id: userId, role })
    await refreshSingleProject(projectId)
    notifySuccess('Rol de área actualizado', `Nuevo rol en el workspace: ${role}`)
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              {
                id: 'users',
                label: 'Directorio de Usuarios',
                count: users.length,
                Icon: Users2,
              },
              {
                id: 'workspaces',
                label: 'Accesos por Área',
                count: projects.length,
                Icon: Building2,
              },
            ] as Array<{ id: AdminTabId; label: string; count: number; Icon: typeof Users2 }>
          ).map(tab => {
            const active = activeTab === tab.id
            const Icon = tab.Icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-2 transition-all ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-white shadow-sm'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-cyan-400" />
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-900/90 text-[10px] font-mono text-slate-300">
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => loadWorkspaceData(false)}
            className="px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-45"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            disabled={users.length === 0}
            onClick={() => {
              exportUsersDirectoryCsv(users, membershipsByUser, activityByUser)
              notifySuccess('CSV exportado', 'Archivo usuarios_rbac_neurolab.csv descargado')
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-45"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="nl-btn-shimmer nl-accent-bg nl-accent-glow flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-bold transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <UsersTab
          users={users}
          currentUserId={currentUser?.id}
          loading={loading}
          membershipsByUser={membershipsByUser}
          activityByUser={activityByUser}
          activeAdminCount={activeAdminCount}
          onInspectUser={u => setInspectedUserId(u.id)}
          onEditUser={u => setEditingUser(u)}
          onToggleStatus={handleToggleStatus}
          onBulkUpdateRole={handleBulkUpdateRole}
          onBulkUpdateStatus={handleBulkUpdateStatus}
        />
      )}

      {activeTab === 'workspaces' && (
        <WorkspaceAccessTab
          users={users}
          projects={projects}
          loading={loading}
          areaPermissions={areaPermissions}
          onAssignMember={handleAssignMember}
          onRevokeMember={handleRevokeMember}
          onChangeMemberRole={handleChangeMemberRole}
          onInspectUser={u => setInspectedUserId(u.id)}
          onOpenPermissions={(projectId, userId) => setPermEditorTarget({ projectId, userId })}
        />
      )}

      {inspectedUser && (
        <UserDetailDrawer
          user={inspectedUser}
          isSelf={inspectedUser.id === currentUser?.id}
          isLastActiveAdmin={
            inspectedUser.role === 'Administrador' &&
            inspectedUser.status === 'ACTIVE' &&
            activeAdminCount <= 1
          }
          projects={projects}
          memberships={membershipsByUser[inspectedUser.id] || []}
          recentEvents={activityByUser[inspectedUser.id]?.events || []}
          areaPermissions={areaPermissions}
          onClose={() => setInspectedUserId(null)}
          onOpenEdit={u => {
            setInspectedUserId(null)
            setEditingUser(u)
          }}
          onOpenPermissions={(projectId, userId) => setPermEditorTarget({ projectId, userId })}
          onToggleStatus={handleToggleStatus}
          onAssignMember={handleAssignMember}
          onRevokeMember={handleRevokeMember}
          onChangeMemberRole={handleChangeMemberRole}
        />
      )}

      {permEditorProject &&
        permEditorUser &&
        (permEditorMember || permEditorProject.owner_id === permEditorUser.id) && (
          <GranularPermissionsDrawer
            project={permEditorProject}
            user={permEditorUser}
            areaRole={permEditorMember?.role || permEditorUser.role}
            isOwner={permEditorProject.owner_id === permEditorUser.id}
            store={areaPermissions}
            peerMembers={(permEditorProject.members || [])
              .filter(m => m.user_id !== permEditorUser.id)
              .map(m => ({ userId: m.user_id, displayName: m.display_name, role: m.role }))}
            onClose={() => setPermEditorTarget(null)}
            onSaveOverrides={handleSaveAreaPermissions}
            onChangeAreaRole={handleChangeMemberRole}
          />
        )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          isSelf={editingUser.id === currentUser?.id}
          isLastActiveAdmin={
            editingUser.role === 'Administrador' &&
            editingUser.status === 'ACTIVE' &&
            activeAdminCount <= 1
          }
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
        />
      )}

      {showCreateModal && (
        <CreateUserModal
          projects={projects}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateUser}
        />
      )}
    </div>
  )
}
