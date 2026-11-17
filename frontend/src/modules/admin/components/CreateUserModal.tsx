import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Eye, EyeOff, Loader2, Plus, Shield, UserPlus, X } from 'lucide-react'
import { ROLE_COLORS, ROLE_OPTIONS, ROLE_PERMISSIONS } from '../constants'
import { SystemSelect } from '../../../components/SystemSelect'
import { useToast } from '../../../components/toast/ToastContext'

interface CreateUserModalProps {
  onClose: () => void
  onCreate: (payload: { email: string; display_name: string; password: string; role: string }) => Promise<void>
}

export function CreateUserModal({ onClose, onCreate }: CreateUserModalProps) {
  const toast = useToast()
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    password: '',
    role: 'Lector',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, submitting])

  const isValid =
    form.display_name.trim().length > 1 &&
    form.email.includes('@') &&
    form.password.length >= 4

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      onClose()
    } catch (err: any) {
      const msg = err?.message ?? 'No se pudo crear el usuario'
      setError(msg)
      toast.error('No se pudo crear el usuario', msg)
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
        aria-labelledby="create-user-modal-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg nl-surface rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden animate-pop-in"
      >
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl nl-accent-bg nl-accent-glow flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 id="create-user-modal-title" className="text-white font-bold text-base">
                Crear Nuevo Usuario
              </h3>
              <p className="text-slate-400 text-xs">
                Asigna credenciales iniciales y nivel de acceso RBAC
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-slate-300 text-xs font-semibold mb-1.5 block">
                Nombre completo
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Ej. Dra. Sofía Ramírez"
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                className="w-full bg-slate-900/70 border border-slate-700/70 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold mb-1.5 block">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="usuario@neurolab.io"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-slate-900/70 border border-slate-700/70 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold mb-1.5 block">
                Contraseña inicial
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 4 caracteres"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-slate-900/70 border border-slate-700/70 focus:border-indigo-500 rounded-xl pl-3.5 pr-9 py-2.5 text-white placeholder-slate-500 text-sm outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label="Mostrar u ocultar contraseña"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-300 text-xs font-semibold mb-1.5 block">
                Rol de Gobernanza (RBAC)
              </label>
              <SystemSelect
                value={form.role}
                onChange={val => setForm(f => ({ ...f, role: val }))}
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
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[form.role] ?? ''}`}>
                    {form.role}
                  </span>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {ROLE_PERMISSIONS[form.role]}
                  </p>
                </div>
              </div>
            </div>
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
              disabled={submitting || !isValid}
              className="nl-btn-shimmer nl-accent-bg nl-accent-glow flex items-center gap-2 px-5 py-2 disabled:opacity-45 rounded-xl text-white text-xs font-bold transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Crear Usuario</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

