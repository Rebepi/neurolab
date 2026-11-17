import { useState, useEffect } from 'react'
import { FolderKanban, Zap, Package, Activity, RefreshCw, Sparkles } from 'lucide-react'
import { api } from '../../services/api'
import { DashboardOverview } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { SystemTooltip } from '../../components/InfoTip'
import { SparklineStatCard } from './components/SparklineStatCard'
import { EngineDiagnosticCard } from './components/EngineDiagnosticCard'
import { RecentJobsTable } from './components/RecentJobsTable'
import { useToast } from '../../components/toast/ToastContext'

export default function DashboardModule({ onNavigate }: { onNavigate: (m: string) => void }) {
  const { user } = useAuth()
  const { error: notifyError } = useToast()
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const overview = await api.getOverview()
      setData(overview)
    } catch (e: any) {
      notifyError('Error al sincronizar telemetría', e?.message ?? 'No se pudo conectar al servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="space-y-6">
      <div className="nl-surface animate-card-reveal rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-16 -right-12 w-56 h-56 rounded-full blur-[80px] opacity-20 animate-pulse-glow"
          style={{ backgroundColor: 'var(--nl-accent-light)' }}
        />
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md nl-accent-bg nl-accent-glow text-[11px] font-mono font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Estación de Ingeniería Neuronal
          </span>
          <span className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
            Operador: {user?.display_name} · {user?.role}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 relative z-10">
          <button
            onClick={() => onNavigate('visualizer')}
            className="nl-btn-shimmer flex items-center gap-2 px-4 py-2 rounded-xl nl-accent-bg nl-accent-glow text-xs font-bold shadow-md transition-all hover:opacity-95"
          >
            <Sparkles className="w-4 h-4" />
            Abrir Motor Sináptico en Vivo
          </button>

          <button
            onClick={() => onNavigate('training')}
            className="nl-btn-shimmer flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition-all"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            Ejecutar Entrenamiento
          </button>

          <SystemTooltip label="Sincronizar métricas y ejecuciones en vivo" side="bottom">
            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              aria-label="Actualizar telemetría"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </SystemTooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="nl-skeleton rounded-2xl h-32" />
          ))
        ) : data ? (
          <>
            <SparklineStatCard
              icon={FolderKanban}
              label="Workspaces IA"
              value={data.total_projects}
              sublabel="Gestionar proyectos"
              trendPoints="2,22 18,18 34,20 50,11 66,13 78,5"
              strokeColor="#0d9488"
              delay={0}
              info="Espacios de trabajo aislados por proyecto. Cada workspace agrupa sus datasets, arquitecturas de red, ejecuciones y modelos registrados."
              onClick={() => onNavigate('projects')}
            />
            <SparklineStatCard
              icon={Zap}
              label="Workers en Ejecución"
              value={data.active_jobs}
              sublabel="Cola SSE en tiempo real"
              trendPoints="2,20 18,14 34,16 50,8 66,12 78,6"
              strokeColor="#d97706"
              delay={70}
              info="Procesos de entrenamiento activos actualmente en el servidor TensorFlow/Keras transmitiendo telemetría por Server-Sent Events (SSE)."
              onClick={() => onNavigate('training')}
            />
            <SparklineStatCard
              icon={Package}
              label="Modelos Certificados"
              value={data.approved_models}
              sublabel="Inmutables SHA-256"
              trendPoints="2,24 18,19 34,15 50,14 66,8 78,4"
              strokeColor="#10b981"
              delay={140}
              info="Artefactos .keras versionados y firmados con hash SHA-256 tras aprobar la evaluación estricta sobre la partición de test."
              onClick={() => onNavigate('models')}
            />
            <SparklineStatCard
              icon={Activity}
              label="Corridas Históricas"
              value={data.total_jobs}
              sublabel="Curvas Loss & Accuracy"
              trendPoints="2,23 18,21 34,14 50,16 66,9 78,3"
              strokeColor="#0284c7"
              delay={210}
              info="Total acumulado de entrenamientos registrados en la plataforma, incluyendo métricas por época y resultados de validación."
              onClick={() => onNavigate('evaluation')}
            />
          </>
        ) : null}
      </div>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <EngineDiagnosticCard data={data} onNavigateAdmin={() => onNavigate('settings')} />
          <RecentJobsTable
            jobs={data.recent_jobs}
            onNavigateTraining={() => onNavigate('training')}
            onNavigateEvaluation={() => onNavigate('evaluation')}
          />
        </div>
      )}
    </div>
  )
}
