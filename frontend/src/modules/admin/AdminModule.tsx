import { useState, useEffect } from 'react'
import { KeyRound, ShieldCheck, ShieldOff, UserCheck, Users2 } from 'lucide-react'
import { api } from '../../services/api'
import type { User } from '../../types'
import { ROLE_OPTIONS } from './constants'
import { UsersTab } from './components/UsersTab'
import { useToast } from '../../components/toast/ToastContext'

export default function AdminModule({ currentUser }: { currentUser: User | null }) {
  const { error: notifyError, success: notifySuccess } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.getUsers()
      .then(list => {
        if (active) setUsers(list)
      })
      .catch((e: unknown) => {
        if (active) {
          notifyError('Error al cargar usuarios', e instanceof Error ? e.message : 'No se pudo obtener la lista de cuentas')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [notifyError])

  if (currentUser?.role !== 'Administrador') {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-800/50 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold">Acceso restringido</p>
          <p className="text-slate-400 text-sm mt-1">Solo el Administrador tiene acceso a la gestión de usuarios y roles RBAC</p>
        </div>
      </div>
    )
  }

  async function handleUpdateUser(userId: string, updates: { role: string; status: string }) {
    const existing = users.find(u => u.id === userId)
    if (!existing) return
    if (updates.role !== existing.role) {
      await api.updateUserRole(userId, updates.role)
    }
    if (updates.status !== existing.status) {
      await api.updateUserStatus(userId, updates.status)
    }
    setUsers(us =>
      us.map(u =>
        u.id === userId
          ? { ...u, role: updates.role as User['role'], status: updates.status }
          : u
      )
    )
    notifySuccess(
      'Usuario actualizado',
      `${existing.display_name} · ${updates.role} (${updates.status === 'ACTIVE' ? 'Activo' : 'Inactivo'})`
    )
  }

  async function handleCreateUser(payload: { email: string; display_name: string; password: string; role: string }) {
    const created = await api.createUser(payload)
    setUsers(us => [created, ...us])
    notifySuccess('Usuario creado', `${created.display_name} (${created.role})`)
  }

  const activeUsersCount = users.filter(u => u.status === 'ACTIVE').length
  const adminCount = users.filter(u => u.role === 'Administrador').length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="nl-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Total Usuarios</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">{users.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Users2 className="w-4 h-4 text-indigo-400" />
          </div>
        </div>

        <div className="nl-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Cuentas Activas</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">
              {activeUsersCount} <span className="text-xs text-slate-500 font-normal">/ {users.length}</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <div className="nl-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Administradores</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">{adminCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
          </div>
        </div>

        <div className="nl-surface rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Roles RBAC</p>
            <p className="text-xl font-bold text-white font-mono mt-0.5">{ROLE_OPTIONS.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4 text-cyan-400" />
          </div>
        </div>
      </div>

      <UsersTab
        users={users}
        currentUserId={currentUser?.id}
        loading={loading}
        onUpdateUser={handleUpdateUser}
        onCreateUser={handleCreateUser}
      />
    </div>
  )
}
