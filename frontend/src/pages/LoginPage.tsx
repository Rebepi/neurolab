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
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/toast/ToastContext'

const NeuralBrainCanvas = lazy(() =>
  import('../components/NeuralBrainCanvas').then(m => ({ default: m.NeuralBrainCanvas }))
)

export default function LoginPage() {
  const { verifyLogin, commitLogin } = useAuth()
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
      const userData = await verifyLogin(email, password)
      const reduced =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.motion === 'reduced'

      if (reduced) {
        commitLogin(userData)
        toast.success('Sesión iniciada', `Bienvenido, ${userData.display_name}`)
        return
      }

      setEntering(true)
      enterTimerRef.current = window.setTimeout(() => {
        commitLogin(userData)
        toast.success('Sesión iniciada', `Bienvenido, ${userData.display_name}`)
      }, 1120)
    } catch (err: any) {
      toast.error('Error al iniciar sesión', err.message ?? 'Verifica tus credenciales')
      setLoading(false)
    }
  }

  return (
    <div className="nl-login-shell min-h-screen w-full relative bg-[#04070e] flex items-center px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-8 overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 8% 12%, rgba(79, 70, 229, 0.14) 0%, transparent 38%), radial-gradient(circle at 54% 46%, rgba(6, 182, 212, 0.11) 0%, transparent 42%), radial-gradient(circle at 92% 88%, rgba(124, 58, 237, 0.13) 0%, transparent 38%), radial-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 30px 30px',
        }}
      />
      <Suspense fallback={null}>
        <NeuralBrainCanvas pulseBurst={pulseBurst} entering={entering} />
      </Suspense>
      <div
        className={`pointer-events-none fixed inset-0 z-20 transition-opacity duration-300 ease-in ${
          entering ? 'opacity-100 delay-[820ms]' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(165, 243, 252, 0.28) 0%, rgba(56, 189, 248, 0.12) 38%, rgba(4, 7, 14, 0.88) 85%)',
        }}
      />

      <main
        className={`relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-center animate-module-enter transition-all duration-500 ease-out ${
          entering ? 'opacity-0 scale-95 blur-md pointer-events-none' : ''
        }`}
      >
        <section className="lg:col-span-5 xl:col-span-4 space-y-5">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold animate-card-reveal">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Plataforma Empresarial de Redes Neuronales</span>
          </div>

          <div className="animate-card-reveal" style={{ animationDelay: '60ms' }}>
            <h1 className="text-4xl sm:text-5xl xl:text-[3.35rem] font-extrabold tracking-tight text-white leading-[1.06]">
              NeuroLab{' '}
              <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                Enterprise
              </span>
            </h1>
            <p className="text-slate-300/85 text-sm sm:text-[15px] mt-3 leading-relaxed">
              Preprocesamiento automatizado con aislamiento de Test, diseño visual multicapa, entrenamiento real en TensorFlow/Keras y simulación matemática en vivo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div
              className="nl-login-tile nl-card-interactive animate-card-reveal rounded-2xl p-3.5 space-y-1 border shadow-lg shadow-black/25"
              style={{ animationDelay: '120ms' }}
            >
              <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold">
                <Cpu className="w-3.5 h-3.5 shrink-0" />
                <span>Keras 2.21</span>
              </div>
              <p className="text-slate-300/80 text-[11px] leading-snug">
                Entrenamiento SSE época a época en GPU/CPU.
              </p>
            </div>

            <div
              className="nl-login-tile nl-card-interactive animate-card-reveal rounded-2xl p-3.5 space-y-1 border shadow-lg shadow-black/25"
              style={{ animationDelay: '180ms' }}
            >
              <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-bold">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Motor 3D</span>
              </div>
              <p className="text-slate-300/80 text-[11px] leading-snug">
                Pesos w, gradientes y activaciones reales.
              </p>
            </div>

            <div
              className="nl-login-tile nl-card-interactive animate-card-reveal rounded-2xl p-3.5 space-y-1 border shadow-lg shadow-black/25"
              style={{ animationDelay: '240ms' }}
            >
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>SHA-256</span>
              </div>
              <p className="text-slate-300/80 text-[11px] leading-snug">
                Model Registry inmutable y reportes PDF.
              </p>
            </div>
          </div>
        </section>

        <div className="hidden lg:block lg:col-span-3 xl:col-span-4" aria-hidden="true" />

        <section className="lg:col-span-4 xl:col-span-4 animate-card-reveal" style={{ animationDelay: '160ms' }}>
          <div className="nl-login-card relative rounded-3xl p-7 sm:p-8 overflow-hidden shadow-[0_28px_90px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.22)]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-teal-400/[0.05]" />
            <div
              className="pointer-events-none absolute top-0 left-8 right-8 h-[1.5px] opacity-95"
              style={{
                background: 'linear-gradient(90deg, transparent, #2dd4bf, #38bdf8, #818cf8, transparent)',
              }}
            />

            <div className="relative z-10 flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400/25 via-indigo-500/30 to-violet-500/30 border border-white/20 flex items-center justify-center shadow-lg shadow-teal-500/15">
                  <Brain className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Autenticación Corporativa</h2>
                  <p className="text-xs text-slate-300/80">Ingresa con tus credenciales autorizadas</p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-400/30 text-[10px] font-mono font-semibold text-teal-300">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                Sinapsis
              </span>
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300/85 mb-1.5">
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
                  className="nl-login-input w-full px-4 py-2.5 rounded-xl text-white placeholder-slate-400/70 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300/85 mb-1.5">
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
                    className="nl-login-input w-full px-4 py-2.5 pr-11 rounded-xl text-white placeholder-slate-400/70 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="nl-btn-shimmer w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-500/90 via-cyan-500/90 to-indigo-600/90 hover:from-teal-400 hover:via-cyan-400 hover:to-indigo-500 disabled:opacity-60 text-white font-bold rounded-xl border border-white/25 shadow-lg shadow-cyan-500/20 backdrop-blur-md transition-all text-sm cursor-pointer"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>{loading ? 'Verificando acceso...' : 'Entrar a NeuroLab Studio'}</span>
              </button>
            </form>

            <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex items-center justify-center text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sesión RBAC Cifrada</span>
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
