import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Pencil,
  Save,
  Shield,
  ShieldAlert,
  X,
} from 'lucide-react'
import type { User, UserRole } from '../../../types'
import {
  ROLE_AVATAR_GRADIENTS,
  ROLE_COLORS,
  ROLE_OPTIONS,
  ROLE_PERMISSIONS,
  computeRoleDiff,
  getInitials,
} from '../constants'
import { SystemSelect } from '../../../components/SystemSelect'
import { useToast } from '../../../components/toast/ToastContext'

interface EditUserModalProps {
  user: User
  isSelf: boolean
  isLastActiveAdmin?: boolean
  onClose: () => void
  onSave: (userId: string, updates: { role: string; status: string }) => Promise<void>
}

export function EditUserModal({
  user,
  isSelf,
  isLastActiveAdmin = false,
  onClose,
  onSave,
}: EditUserModalProps) {
  const toast = useToast()
  const [role, setRole] = useState<string>(user.role)
  const [status, setStatus] = useState<string>(user.status)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, submitting])

  const roleChanged = role !== user.role
  const hasChanges = roleChanged || status !== user.status
  const lockAdminControls = isSelf || (isLastActiveAdmin && user.role === 'Administrador')
  const roleDiff = roleChanged ? computeRoleDiff(user.role, role as UserRole) : null
  const avatarGrad = ROLE_AVATAR_GRADIENTS[user.role] || 'from-indigo-500 to-violet-600'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChanges) return
    setSubmitting(true)
    setError(null)
    try {
      await onSave(user.id, { role, status })
      onClose()
    } catch (err: any) {
      const msg = err?.message ?? 'No se pudieron guardar los cambios'
      setError(msg)
      toast.error('No se pudieron guardar los cambios', msg)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      onClick={() => { if (!submitting) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-modal-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg nl-cyber-panel rounded-2xl shadow-2xl overflow-hidden animate-pop-in"
      >
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl nl-accent-bg nl-accent-glow flex items-center justify-center">
              <Pencil className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 id="edit-user-modal-title" className="text-white font-bold text-base">
                Editar Usuario
              </h3>
              <p className="text-slate-400 text-xs">
                Actualiza el rol RBAC y el estado de acceso de forma segura
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Cerrar modal de edición"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-xs font-bold shrink-0`}
            >
              {getInitials(user.display_name)}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{user.display_name}</p>
              <p className="text-slate-400 text-xs font-mono truncate">{user.email}</p>
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold mb-1.5 block">
              Rol de Gobernanza (RBAC)
            </label>
            <SystemSelect
              value={role}
              onChange={setRole}
              disabled={lockAdminControls}
              size="md"
              ariaLabel="Rol de Gobernanza (RBAC)"
              options={ROLE_OPTIONS.map(r => ({
                value: r,
                label: r,
                description: ROLE_PERMISSIONS[r],
              }))}
            />

            <div className="mt-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[role] ?? ''}`}>
                  {role}
                </span>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {ROLE_PERMISSIONS[role]}
                </p>
              </div>
            </div>
          </div>

          {roleDiff && (roleDiff.gained.length > 0 || roleDiff.revoked.length > 0) && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                Impacto del Cambio RBAC ({user.role} → {role})
              </p>

              {roleDiff.gained.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10.5px] font-semibold text-emerald-300 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Permisos ganados o ampliados ({roleDiff.gained.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {roleDiff.gained.map(cap => (
                      <span
                        key={cap.key}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-[10.5px]"
                      >
                        {cap.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {roleDiff.revoked.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10.5px] font-semibold text-rose-300 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>Permisos reducidos o revocados ({roleDiff.revoked.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {roleDiff.revoked.map(cap => (
                      <span
                        key={cap.key}
                        className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-200 text-[10.5px]"
                      >
                        {cap.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-slate-300 text-xs font-semibold block">
              Estado de Cuenta
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setStatus('ACTIVE')}
                className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  status === 'ACTIVE'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Activo</span>
              </button>

              <button
                type="button"
                disabled={lockAdminControls}
                onClick={() => setStatus('INACTIVE')}
                className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-45 disabled:cursor-not-allowed ${
                  status === 'INACTIVE'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-sm'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Inactivo</span>
              </button>
            </div>

            {isSelf && (
              <p className="text-[11px] text-amber-300/90">
                No puedes desactivar ni degradar tu propia sesión de Administrador activa.
              </p>
            )}
            {!isSelf && isLastActiveAdmin && user.role === 'Administrador' && (
              <p className="text-[11px] text-amber-300/90">
                Protección RBAC: no puedes degradar ni desactivar al único Administrador activo del sistema.
              </p>
            )}
            {!lockAdminControls && status === 'INACTIVE' && (
              <p className="text-[11px] text-rose-300/90">
                Al guardar como Inactivo, esta cuenta quedará bloqueada para iniciar sesión.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !hasChanges}
              className="nl-btn-shimmer nl-accent-bg nl-accent-glow flex items-center gap-2 px-5 py-2 disabled:opacity-45 rounded-xl text-white text-xs font-bold transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{submitting ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
