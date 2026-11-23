import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  FolderKanban,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  UserPlus,
  X,
} from 'lucide-react'
import type { Project } from '../../../types'
import { ROLE_COLORS, ROLE_OPTIONS, ROLE_PERMISSIONS } from '../constants'
import { SystemSelect } from '../../../components/SystemSelect'
import { useToast } from '../../../components/toast/ToastContext'

interface CreateUserModalProps {
  projects?: Project[]
  onClose: () => void
  onCreate: (payload: {
    email: string
    display_name: string
    password: string
    role: string
    initialProjectIds: string[]
  }) => Promise<void>
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const arr = new Uint32Array(12)
  crypto.getRandomValues(arr)
  return Array.from(arr, n => chars[n % chars.length]).join('')
}

function getPasswordStrength(pw: string): {
  level: 0 | 1 | 2 | 3
  label: string
  barCls: string
  textCls: string
} {
  if (!pw) {
    return { level: 0, label: 'Sin clave', barCls: 'bg-slate-800', textCls: 'text-slate-500' }
  }
  const hasMix = /[A-Z]/.test(pw) && /[0-9!@#$%^&*]/.test(pw)
  if (pw.length >= 10 || (pw.length >= 8 && hasMix)) {
    return { level: 3, label: 'Fuerte', barCls: 'bg-emerald-400', textCls: 'text-emerald-300' }
  }
  if (pw.length >= 6) {
    return { level: 2, label: 'Media', barCls: 'bg-amber-400', textCls: 'text-amber-300' }
  }
  return { level: 1, label: 'Débil', barCls: 'bg-rose-400', textCls: 'text-rose-300' }
}

export function CreateUserModal({ projects = [], onClose, onCreate }: CreateUserModalProps) {
  const toast = useToast()
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    password: '',
    role: 'Lector',
  })
  const [initialProjectIds, setInitialProjectIds] = useState<string[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [copiedPw, setCopiedPw] = useState(false)
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

  const strength = getPasswordStrength(form.password)

  function handleGeneratePw() {
    const generated = generateSecurePassword()
    setForm(f => ({ ...f, password: generated }))
    setShowPassword(true)
  }

  async function handleCopyPw() {
    if (!form.password) return
    await navigator.clipboard.writeText(form.password).catch(() => {})
    setCopiedPw(true)
    setTimeout(() => setCopiedPw(false), 1600)
  }

  function toggleProject(projectId: string) {
    setInitialProjectIds(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    )
  }

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
        initialProjectIds,
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
        className="w-full max-w-xl nl-cyber-panel rounded-2xl shadow-2xl overflow-hidden animate-pop-in"
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
                Asigna credenciales iniciales, nivel RBAC y áreas iniciales
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 text-xs font-semibold">
                  Contraseña inicial
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleGeneratePw}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generar</span>
                  </button>
                  {form.password && (
                    <button
                      type="button"
                      onClick={handleCopyPw}
                      className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-400 hover:text-white"
                      title="Copiar contraseña"
                    >
                      {copiedPw ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
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
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {[1, 2, 3].map(step => (
                    <div
                      key={step}
                      className={`h-1 rounded-full transition-colors ${
                        strength.level >= step ? strength.barCls : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-[10px] font-semibold ${strength.textCls}`}>
                  {strength.label}
                </span>
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

            {projects.length > 0 && (
              <div className="sm:col-span-2 space-y-2">
                <label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Áreas iniciales (opcional · {initialProjectIds.length} seleccionadas)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  {projects.map(p => {
                    const selected = initialProjectIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProject(p.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all inline-flex items-center gap-1 ${
                          selected
                            ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-cyan-300" />}
                        <span className="max-w-[200px] truncate">{p.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
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
