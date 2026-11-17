import { useState, useEffect } from 'react'
import {
  X, Activity, ShieldCheck, Cpu, Clock, CheckCircle2,
  Database, Network, Package, RefreshCw, ArrowUpRight
} from 'lucide-react'
import { api } from '../services/api'
import { AuditEvent } from '../types'
import { InfoTip, SystemTooltip } from './InfoTip'

interface TelemetryDrawerProps {
  open: boolean
  onClose: () => void
  currentProject?: { id: string; name: string } | null
  onNavigate: (m: string) => void
}

export default function TelemetryDrawer({
  open,
  onClose,
  currentProject,
  onNavigate
}: TelemetryDrawerProps) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [projectStats, setProjectStats] = useState({
    datasets: 0,
    architectures: 0,
    jobs: 0,
    models: 0
  })

  async function loadTelemetry() {
    setLoading(true)
    try {
      const [audits, d, a, j, m] = await Promise.all([
        api.getAuditEvents(currentProject?.id, 15).catch(() => []),
        currentProject ? api.getProjectDatasets(currentProject.id).then(r => r.length).catch(() => 0) : Promise.resolve(0),
        currentProject ? api.getProjectArchitectures(currentProject.id).then(r => r.length).catch(() => 0) : Promise.resolve(0),
        currentProject ? api.getProjectJobs(currentProject.id).then(r => r.length).catch(() => 0) : Promise.resolve(0),
        currentProject ? api.getProjectModels(currentProject.id).then(r => r.length).catch(() => 0) : Promise.resolve(0),
      ])
      setEvents(audits)
      setProjectStats({ datasets: d, architectures: a, jobs: j, models: m })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadTelemetry()
    }
  }, [open, currentProject?.id])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs animate-backdrop-fade"
        onClick={onClose}
      />

      <aside className="relative z-10 w-full max-w-md h-full nl-glass border-l border-slate-800 flex flex-col shadow-2xl animate-drawer-in">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl nl-accent-bg flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Telemetría & Auditoría en Vivo</h3>
              <p className="text-[11px] text-slate-400">Trazabilidad criptográfica y estado del motor</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <SystemTooltip label="Recargar telemetría y eventos recientes" side="bottom">
              <button
                onClick={loadTelemetry}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Actualizar"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </SystemTooltip>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Núcleo de Cómputo
                <InfoTip
                  title="Motor TensorFlow / Keras"
                  text="Ejecución real en servidor con streaming de métricas por época y aislamiento estricto de Test."
                  side="bottom"
                />
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ONLINE · TF 2.21.0
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] text-slate-400">Aislamiento Test</p>
                  <InfoTip
                    title="Partición Sellada 15%"
                    text="El conjunto Test se guarda aparte (.npz) y jamás participa en el ajuste de pesos durante entrenamiento."
                    side="bottom"
                  />
                </div>
                <p className="font-mono font-bold text-emerald-400 mt-0.5">15% Sellado (.npz)</p>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] text-slate-400">Integridad Registry</p>
                  <InfoTip
                    title="Hash SHA-256"
                    text="Firma criptográfica única por cada versión guardada para garantizar trazabilidad e inmutabilidad."
                    side="bottom"
                  />
                </div>
                <p className="font-mono font-bold text-indigo-400 mt-0.5">SHA-256 Activo</p>
              </div>
            </div>
          </div>

          {currentProject && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Inventario de {currentProject.name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'datasets', label: 'Datasets EDA', val: projectStats.datasets, Icon: Database },
                  { id: 'architectures', label: 'Arquitecturas', val: projectStats.architectures, Icon: Network },
                  { id: 'training', label: 'Ejecuciones', val: projectStats.jobs, Icon: Activity },
                  { id: 'models', label: 'Modelos v1.x', val: projectStats.models, Icon: Package },
                ].map(item => {
                  const Icon = item.Icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id); onClose() }}
                      className="nl-card-interactive bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-left flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[10px] text-slate-400">{item.label}</p>
                        <p className="text-base font-extrabold font-mono text-white mt-0.5">{item.val}</p>
                      </div>
                      <Icon className="w-4 h-4 text-indigo-400" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bitácora de Auditoría Reciente</span>
                <InfoTip
                  title="Bitácora de Auditoría"
                  text="Registro cronológico inmutable de acciones críticas: creación de proyectos, cargas de CSV, entrenamientos y publicaciones en el Model Registry."
                  size="xs"
                />
              </p>
              <button
                onClick={() => { onNavigate('audit'); onClose() }}
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-0.5 font-semibold"
              >
                <span>Ver todo</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {events.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Sin eventos registrados.</p>
              ) : (
                events.map((ev, idx) => (
                  <div
                    key={ev.id}
                    style={{ animationDelay: `${Math.min(idx, 10) * 45}ms` }}
                    className="animate-card-reveal bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3 space-y-1 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {ev.action}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Actor: <strong className="text-white">{ev.actor_name}</strong></span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

