import { Bell, Check, LayoutGrid, Moon, Palette, RotateCcw, Server, Sparkles, Sun, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { useTheme, PALETTE_META, AccentPalette } from '../../../context/ThemeContext'
import type { ComputeTelemetry, User } from '../../../types'
import { SystemSelect } from '../../../components/SystemSelect'
import { useToast } from '../../../components/toast/ToastContext'
import { ROLE_PERMISSIONS } from '../../admin/constants'
import { ToggleSwitch } from './ToggleSwitch'
import {
  applyDensity,
  applyReducedMotion,
  readDensity,
  readReducedMotion,
} from '../uiPreferences'
import {
  TOAST_DURATIONS,
  TOAST_POSITIONS,
  getToastDurationPreference,
  getToastPosition,
  setToastDurationPreference,
  setToastPosition,
  type ToastDurationPreference,
  type ToastPosition,
} from '../../../components/toast/preferences'

interface AppearanceSettingsCardProps {
  currentUser: User | null
  telemetry: ComputeTelemetry | null
}

export function AppearanceSettingsCard({ currentUser, telemetry }: AppearanceSettingsCardProps) {
  const { mode, palette, setMode, setPalette } = useTheme()
  const toast = useToast()
  const [toastPosition, setToastPositionState] = useState<ToastPosition>(getToastPosition)
  const [toastDuration, setToastDurationState] = useState<ToastDurationPreference>(
    getToastDurationPreference
  )
  const [reducedMotion, setReducedMotion] = useState<boolean>(readReducedMotion)
  const [compactDensity, setCompactDensity] = useState<boolean>(() => readDensity() === 'compact')

  function handleToggleMotion(next: boolean) {
    setReducedMotion(next)
    applyReducedMotion(next)
  }

  function handleSetDensity(compact: boolean) {
    setCompactDensity(compact)
    applyDensity(compact ? 'compact' : 'comfortable')
  }

  function handleResetAppearance() {
    setMode('light')
    setPalette('emerald_copper')
    handleToggleMotion(false)
    handleSetDensity(false)
    toast.info('Apariencia restablecida', 'Tema claro, paleta esmeralda y densidad cómoda')
  }

  const roleDescription = currentUser?.role ? ROLE_PERMISSIONS[currentUser.role] : undefined

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-7 nl-cyber-panel animate-card-reveal rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-400" />
            <h3 className="text-white font-bold text-base">Apariencia del Estudio</h3>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[9.5px] font-mono border border-cyan-500/20">
              Auto
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetAppearance}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restablecer apariencia</span>
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Modo de Luminancia
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setMode('light')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                mode === 'light'
                  ? 'nl-accent-bg nl-accent-glow text-white border-transparent'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Claro (Editorial)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('dark')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                mode === 'dark'
                  ? 'nl-accent-bg nl-accent-glow text-white border-transparent'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Oscuro (Obsidian)</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Firma Cromática
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              Object.entries(PALETTE_META) as Array<[AccentPalette, (typeof PALETTE_META)[AccentPalette]]>
            ).map(([key, meta]) => {
              const isCur = palette === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPalette(key)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                    isCur
                      ? 'bg-slate-800/90 border-slate-600'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center -space-x-1 shrink-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full ring-1 ring-black/20"
                        style={{ backgroundColor: meta.primaryHex }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full ring-1 ring-black/20"
                        style={{ backgroundColor: meta.secondaryHex }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white leading-tight truncate">{meta.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{meta.subtitle}</p>
                    </div>
                  </div>
                  {isCur && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">Movimiento reducido</p>
                <p className="text-[10px] text-slate-400 truncate">Minimiza animaciones UI</p>
              </div>
            </div>
            <ToggleSwitch
              size="sm"
              checked={reducedMotion}
              onChange={handleToggleMotion}
              ariaLabel="Alternar movimiento reducido"
            />
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <LayoutGrid className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">Densidad</p>
                <p className="text-[10px] text-slate-400 truncate">Escala interfaz</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => handleSetDensity(false)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                  !compactDensity ? 'nl-accent-bg text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cómoda
              </button>
              <button
                type="button"
                onClick={() => handleSetDensity(true)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                  compactDensity ? 'nl-accent-bg text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Compacta
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Notificaciones Toast</p>
                <p className="text-[10px] text-slate-400">
                  Ubicación y permanencia de alertas operativas
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                toast.success('Notificación de prueba', 'Vista previa del sistema Sileo en NeuroLab')
              }
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
            >
              Probar Toast
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Posición en pantalla
              </p>
              <SystemSelect
                value={toastPosition}
                size="sm"
                ariaLabel="Posición de notificaciones toast"
                onChange={val => {
                  const next = val as ToastPosition
                  setToastPositionState(next)
                  setToastPosition(next)
                  toast.info(
                    'Posición actualizada',
                    TOAST_POSITIONS.find(p => p.value === next)?.label
                  )
                }}
                options={TOAST_POSITIONS.map(p => ({ value: p.value, label: p.label }))}
              />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Duración automática
              </p>
              <SystemSelect
                value={toastDuration}
                size="sm"
                ariaLabel="Duración de notificaciones toast"
                onChange={val => {
                  const next = val as ToastDurationPreference
                  setToastDurationState(next)
                  setToastDurationPreference(next)
                  toast.info(
                    'Duración actualizada',
                    TOAST_DURATIONS.find(d => d.value === next)?.label
                  )
                }}
                options={TOAST_DURATIONS.map(d => ({ value: d.value, label: d.label }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 space-y-5">
        <div className="nl-cyber-panel animate-card-reveal nl-stagger-1 rounded-2xl p-6 space-y-3.5">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="text-white font-bold text-base">Entorno y Motor ML</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="bg-slate-950/65 border border-slate-800/80 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Runtime ML
              </p>
              <p className="text-slate-200 font-mono font-bold mt-1">TensorFlow / Keras</p>
            </div>
            <div className="bg-slate-950/65 border border-slate-800/80 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Dispositivo
              </p>
              <p className="text-emerald-400 font-mono font-bold mt-1 truncate">
                {telemetry?.runtime_device || '—'}
              </p>
            </div>
            <div className="bg-slate-950/65 border border-slate-800/80 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                CPU
              </p>
              <p className="text-slate-200 font-mono font-bold mt-1">
                {telemetry ? `${telemetry.cpu_cores} núcleos` : '—'}
              </p>
            </div>
            <div className="bg-slate-950/65 border border-slate-800/80 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                RAM total
              </p>
              <p className="text-slate-200 font-mono font-bold mt-1">
                {telemetry ? `${telemetry.ram_total_gb.toFixed(1)} GB` : '—'}
              </p>
            </div>
            <div className="bg-slate-950/65 border border-slate-800/80 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Base de Datos
              </p>
              <p className="text-slate-200 font-mono font-bold mt-1">SQLite Local</p>
            </div>
            <div className="bg-slate-950/65 border border-slate-800/80 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                API Endpoint
              </p>
              <p className="text-cyan-300 font-mono font-bold mt-1">FastAPI · /api/v1</p>
            </div>
          </div>
        </div>

        <div className="nl-cyber-panel animate-card-reveal nl-stagger-2 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-400" />
            <h3 className="text-white font-bold text-base">Sesión del Operador</h3>
          </div>
          <div className="bg-slate-950/65 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
            <p className="text-xs font-bold text-white">
              {currentUser?.display_name || 'Operador NeuroLab'}
            </p>
            <p className="text-[11px] font-mono text-slate-400">{currentUser?.email || '—'}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              {currentUser?.role || 'Sin rol'}
            </span>
            {roleDescription && (
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1.5">{roleDescription}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
