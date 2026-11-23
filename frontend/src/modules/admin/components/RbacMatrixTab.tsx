import { useState } from 'react'
import { Shield } from 'lucide-react'
import type { User, UserRole } from '../../../types'
import {
  ACCESS_BADGE_META,
  RBAC_CAPABILITIES,
  ROLE_COLORS,
  ROLE_META,
  ROLE_OPTIONS,
  type RbacDomain,
} from '../constants'
import { PaginationBar } from '../../../components/PaginationBar'

interface RbacMatrixTabProps {
  users: User[]
  onInspectUser: (user: User) => void
}

const DOMAIN_TABS: Array<'all' | RbacDomain> = [
  'all',
  'Proyectos & Datos',
  'Entrenamiento & Modelos',
  'Gobernanza & Seguridad',
]

export function RbacMatrixTab({ users, onInspectUser }: RbacMatrixTabProps) {
  const [focusedRole, setFocusedRole] = useState<UserRole | null>(null)
  const [domainFilter, setDomainFilter] = useState<'all' | RbacDomain>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)

  const visibleCaps =
    domainFilter === 'all'
      ? RBAC_CAPABILITIES
      : RBAC_CAPABILITIES.filter(c => c.domain === domainFilter)

  const totalPages = Math.max(1, Math.ceil(visibleCaps.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedCaps = visibleCaps.slice((safePage - 1) * pageSize, safePage * pageSize)

  const focusedUsers = focusedRole ? users.filter(u => u.role === focusedRole) : []

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
        {ROLE_OPTIONS.map(role => {
          const count = users.filter(u => u.role === role).length
          const meta = ROLE_META[role]
          const isFocused = focusedRole === role
          return (
            <button
              key={role}
              type="button"
              onClick={() => setFocusedRole(isFocused ? null : role)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isFocused
                  ? 'nl-cyber-panel border-cyan-400/60 bg-cyan-500/10'
                  : 'nl-cyber-panel hover:border-cyan-400/35'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Nivel {meta.level}/5
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10.5px] font-mono font-bold text-white">
                  {count}
                </span>
              </div>
              <p className="text-xs font-extrabold text-white mt-1.5 truncate">{role}</p>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{meta.summary}</p>
            </button>
          )
        })}
      </div>

      {focusedRole && (
        <div className="nl-cyber-panel rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold ${
                ROLE_COLORS[focusedRole] || ''
              }`}
            >
              {focusedRole}
            </span>
            <span className="text-xs text-slate-400">
              {focusedUsers.length === 0
                ? 'Sin cuentas asignadas actualmente'
                : 'Haz clic en una cuenta para abrir su perfil:'}
            </span>
            {focusedUsers.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => onInspectUser(u)}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-white hover:text-cyan-300 transition-colors"
              >
                {u.display_name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFocusedRole(null)}
            className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold"
          >
            Quitar foco
          </button>
        </div>
      )}

      <div className="nl-cyber-panel rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Matriz de Capacidades y Privilegios</h3>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {DOMAIN_TABS.map(d => {
              const active = domainFilter === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDomainFilter(d)
                    setCurrentPage(1)
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                    active
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-white'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {d === 'all' ? 'Todos los dominios' : d}
                </button>
              )
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/70">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-bold text-slate-400 min-w-[260px]">
                  Capacidad del Sistema
                </th>
                {ROLE_OPTIONS.map(role => (
                  <th
                    key={role}
                    className={`px-3 py-3 text-center text-[11px] font-bold min-w-[125px] ${
                      focusedRole === role ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-300'
                    }`}
                  >
                    {ROLE_META[role].shortLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedCaps.map(cap => (
                <tr key={cap.key} className="hover:bg-slate-800/20">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{cap.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{cap.description}</p>
                  </td>
                  {ROLE_OPTIONS.map(role => {
                    const access = cap.matrix[role]
                    const meta = ACCESS_BADGE_META[access]
                    return (
                      <td
                        key={role}
                        className={`px-3 py-3 text-center ${
                          focusedRole === role ? 'bg-cyan-500/5' : ''
                        }`}
                      >
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10.5px] font-bold ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar
        variant="card"
        className="mt-auto"
        currentPage={safePage}
        totalItems={visibleCaps.length}
        pageSize={pageSize}
        pageSizeOptions={[6, 8, 12]}
        onPageChange={setCurrentPage}
        onPageSizeChange={size => {
          setPageSize(size)
          setCurrentPage(1)
        }}
        itemLabel="capacidades"
      />
    </div>
  )
}
