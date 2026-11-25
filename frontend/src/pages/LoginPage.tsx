import { useState, useEffect, useRef, lazy, Suspense, FormEvent } from 'react'
import {
  Eye,
  EyeOff,
  Loader2,
  Brain,
  Cpu,
  Shield,
  Sparkles,
  Layers,
  Lock,
  Monitor,
  Sun,
  Moon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme, type ThemePreference } from '../context/ThemeContext'
import { useToast } from '../components/toast/ToastContext'

const NeuralBrainCanvas = lazy(() =>
  import('../components/NeuralBrainCanvas').then(m => ({ default: m.NeuralBrainCanvas }))
)

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: typeof Monitor }[] = [
  { id: 'system', label: 'Sistema', icon: Monitor },
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
]

export default function LoginPage() {
  const { verifyLogin, commitLogin } = useAuth()
  const { mode, preference, setMode } = useTheme()
  const isLight = mode === 'light'
  const toast = useToast()
  const [email, setEmail] = useState('admin@neurolab.io')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [entering, setEntering] = useState(false)
  const [pulseBurst, setPulseBurst] = useState(0)
  const enterTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (enterTimerRef.current !== null) {
        window.clearTimeout(enterTimerRef.current)
      }
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (entering) return
    setPulseBurst(b => b + 1)
    setLoading(true)
    try {
      const authSession = await verifyLogin(email, password)
      const reduced =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.motion === 'reduced'

      if (reduced) {
        commitLogin(authSession)
        toast.success('Sesión iniciada', `Bienvenido, ${authSession.user.display_name}`)
        return
      }

      setEntering(true)
      enterTimerRef.current = window.setTimeout(() => {
        commitLogin(authSession)
        toast.success('Sesión iniciada', `Bienvenido, ${authSession.user.display_name}`)
      }, 1120)
    } catch (err: any) {
      toast.error('Error al iniciar sesión', err.message ?? 'Verifica tus credenciales')
      setLoading(false)
    }
  }

  return (
    <div
      className={`nl-login-shell min-h-screen w-full relative flex items-center px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-8 overflow-hidden transition-colors duration-300 ${
        isLight ? 'bg-[#f3f7fe]' : 'bg-[#04070e]'
      }`}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: isLight
            ? 'radial-gradient(circle at 8% 12%, rgba(99, 102, 241, 0.11) 0%, transparent 40%), radial-gradient(circle at 52% 48%, rgba(6, 182, 212, 0.12) 0%, transparent 44%), radial-gradient(circle at 92% 88%, rgba(124, 58, 237, 0.09) 0%, transparent 38%), radial-gradient(rgba(15, 23, 42, 0.055) 1px, transparent 1px)'
            : 'radial-gradient(circle at 8% 12%, rgba(79, 70, 229, 0.14) 0%, transparent 38%), radial-gradient(circle at 54% 46%, rgba(6, 182, 212, 0.11) 0%, transparent 42%), radial-gradient(circle at 92% 88%, rgba(124, 58, 237, 0.13) 0%, transparent 38%), radial-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 30px 30px',
        }}
      />
      <Suspense fallback={null}>
        <NeuralBrainCanvas pulseBurst={pulseBurst} entering={entering} lightMode={isLight} />
      </Suspense>
      <div
        className={`pointer-events-none fixed inset-0 z-20 transition-opacity duration-300 ease-in ${
          entering ? 'opacity-100 delay-[820ms]' : 'opacity-0'
        }`}
        style={{
          background: isLight
            ? 'radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.22) 0%, rgba(243, 247, 254, 0.72) 44%, rgba(243, 247, 254, 0.96) 86%)'
            : 'radial-gradient(circle at 50% 50%, rgba(165, 243, 252, 0.28) 0%, rgba(56, 189, 248, 0.12) 38%, rgba(4, 7, 14, 0.88) 85%)',
        }}
      />

      {/* Selector rápido de apariencia (Sistema / Claro / Oscuro) */}
      <div
        role="group"
        aria-label="Apariencia de la interfaz"
        className={`fixed top-4 right-5 z-30 inline-flex items-center gap-0.5 p-1 rounded-full border backdrop-blur-md transition-all ${
          isLight
            ? 'bg-white/80 border-slate-300/80 shadow-sm shadow-slate-900/5'
            : 'bg-slate-900/60 border-white/15 shadow-lg shadow-black/40'
        } ${entering ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon
          const active = preference === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              aria-pressed={active}
              title={opt.id === 'system' ? `Seguir tema del sistema (${isLight ? 'Claro' : 'Oscuro'})` : `Usar tema ${opt.label.toLowerCase()}`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                active
                  ? isLight
                    ? 'bg-teal-600 !text-white shadow-sm'
                    : 'bg-teal-500/25 text-teal-200 border border-teal-400/35'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          )
        })}
      </div>

      <main
        className={`relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-center animate-module-enter transition-all duration-500 ease-out ${
          entering ? 'opacity-0 scale-95 blur-md pointer-events-none' : ''
        }`}
      >
        <section className="lg:col-span-5 xl:col-span-4 space-y-5">
          <div
            className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold animate-card-reveal ${
              isLight
                ? 'bg-teal-50/90 border-teal-300/70 text-teal-800 shadow-sm shadow-teal-900/5'
                : 'bg-teal-500/15 border-teal-400/35 text-teal-200'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLight ? 'bg-teal-500' : 'bg-teal-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLight ? 'bg-teal-600' : 'bg-teal-400'}`} />
            </span>
            <Sparkles className={`w-3.5 h-3.5 ${isLight ? 'text-teal-600' : 'text-cyan-300'}`} />
            <span>Aura Telecom · Plataforma Corporativa de Redes Neuronales</span>
          </div>

          <div className="animate-card-reveal" style={{ animationDelay: '60ms' }}>
            <h1
              className={`text-4xl sm:text-5xl xl:text-[3.2rem] font-extrabold tracking-tight leading-[1.06] ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              Aura Telecom{' '}
              <span
                className={`bg-clip-text text-transparent ${
                  isLight
                    ? 'bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600'
                    : 'bg-gradient-to-r from-teal-300 via-cyan-300 to-indigo-400'
                }`}
              >
                NeuroLab AI
              </span>
            </h1>
            <p
              className={`text-sm sm:text-[15px] mt-3 leading-relaxed ${
                isLight ? 'text-slate-600' : 'text-slate-300/85'
              }`}
            >
              Ecosistema corporativo de Inteligencia Artificial con 4 áreas operativas (Retención, Red NOC 5G, Antifraude y Comercial LTV), entrenamiento real en TensorFlow/Keras e inferencia neuronal interactiva en vivo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div
              className="nl-login-tile nl-card-interactive animate-card-reveal rounded-2xl p-3.5 space-y-1 border shadow-lg shadow-black/25"
              style={{ animationDelay: '120ms' }}
            >
              <div className={`flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-indigo-700' : 'text-indigo-400'}`}>
                <Cpu className="w-3.5 h-3.5 shrink-0" />
                <span>4 Áreas IA</span>
              </div>
              <p className={`text-[11px] leading-snug ${isLight ? 'text-slate-600' : 'text-slate-300/80'}`}>
                Retención, NOC 5G, Antifraude y LTV en Keras 2.21.
              </p>
            </div>

            <div
              className="nl-login-tile nl-card-interactive animate-card-reveal rounded-2xl p-3.5 space-y-1 border shadow-lg shadow-black/25"
              style={{ animationDelay: '180ms' }}
            >
              <div className={`flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Inferencia</span>
              </div>
              <p className={`text-[11px] leading-snug ${isLight ? 'text-slate-600' : 'text-slate-300/80'}`}>
                Escenarios interactivos What-If conectados al modelo real.
              </p>
            </div>

            <div
              className="nl-login-tile nl-card-interactive animate-card-reveal rounded-2xl p-3.5 space-y-1 border shadow-lg shadow-black/25"
              style={{ animationDelay: '240ms' }}
            >
              <div className={`flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>SHA-256</span>
              </div>
              <p className={`text-[11px] leading-snug ${isLight ? 'text-slate-600' : 'text-slate-300/80'}`}>
                Model Registry inmutable y reportes PDF ejecutivos.
              </p>
            </div>
          </div>
        </section>

        <div className="hidden lg:block lg:col-span-3 xl:col-span-4" aria-hidden="true" />

        <section className="lg:col-span-4 xl:col-span-4 animate-card-reveal" style={{ animationDelay: '160ms' }}>
          <div className="nl-login-card relative rounded-3xl p-7 sm:p-8 overflow-hidden shadow-[0_28px_90px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.22)]">
            <div
              className={`pointer-events-none absolute inset-0 ${
                isLight
                  ? 'bg-gradient-to-br from-white/70 via-transparent to-teal-500/[0.04]'
                  : 'bg-gradient-to-br from-white/[0.08] via-transparent to-teal-400/[0.05]'
              }`}
            />
            <div
              className="pointer-events-none absolute top-0 left-8 right-8 h-[1.5px] opacity-95"
              style={{
                background: isLight
                  ? 'linear-gradient(90deg, transparent, #0d9488, #0284c7, #4f46e5, transparent)'
                  : 'linear-gradient(90deg, transparent, #2dd4bf, #38bdf8, #818cf8, transparent)',
              }}
            />

            <div className="relative z-10 flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-lg ${
                    isLight
                      ? 'bg-gradient-to-br from-teal-50 via-cyan-50 to-indigo-100 border-teal-200/80 shadow-teal-600/10'
                      : 'bg-gradient-to-br from-teal-400/25 via-indigo-500/30 to-violet-500/30 border-white/20 shadow-teal-500/15'
                  }`}
                >
                  <Brain className={`w-5 h-5 ${isLight ? 'text-teal-700' : 'text-teal-300'}`} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Autenticación Corporativa
                  </h2>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-300/80'}`}>
                    Ingresa con tus credenciales autorizadas
                  </p>
                </div>
              </div>
              <span
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-semibold ${
                  isLight
                    ? 'bg-teal-50 border-teal-200 text-teal-700'
                    : 'bg-teal-500/15 border-teal-400/30 text-teal-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-teal-500' : 'bg-teal-400'}`} />
                Sinapsis
              </span>
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
              <div>
                <label
                  className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${
                    isLight ? 'text-slate-600' : 'text-slate-300/85'
                  }`}
                >
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setPulseBurst(b => b + 1)
                  }}
                  required
                  placeholder="usuario@neurolab.io"
                  className={`nl-login-input w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/20 transition-all ${
                    isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-400/70'
                  }`}
                />
              </div>

              <div>
                <label
                  className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${
                    isLight ? 'text-slate-600' : 'text-slate-300/85'
                  }`}
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setPulseBurst(b => b + 1)
                    }}
                    required
                    placeholder="••••••••"
                    className={`nl-login-input w-full px-4 py-2.5 pr-11 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/20 transition-all ${
                      isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-400/70'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                      isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`nl-btn-shimmer w-full flex items-center justify-center gap-2 px-4 py-3 disabled:opacity-60 !text-white font-bold rounded-xl border shadow-lg backdrop-blur-md transition-all text-sm cursor-pointer ${
                  isLight
                    ? 'bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 hover:from-teal-500 hover:via-cyan-500 hover:to-indigo-500 border-teal-500/30 shadow-cyan-700/20'
                    : 'bg-gradient-to-r from-teal-500/90 via-cyan-500/90 to-indigo-600/90 hover:from-teal-400 hover:via-cyan-400 hover:to-indigo-500 border-white/25 shadow-cyan-500/20'
                }`}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>{loading ? 'Verificando acceso...' : 'Entrar a NeuroLab Studio'}</span>
              </button>
            </form>

            <div
              className={`relative z-10 mt-5 pt-4 border-t flex items-center justify-center text-[11px] ${
                isLight ? 'border-slate-200/80 text-slate-500' : 'border-white/10 text-slate-400'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Lock className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <span>Sesión RBAC Cifrada</span>
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
