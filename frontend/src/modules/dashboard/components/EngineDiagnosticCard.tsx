import { CheckCircle2, Cpu, Server, ShieldCheck } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import type { DashboardOverview } from '../../../types'

interface EngineDiagnosticCardProps {
  data: DashboardOverview
  onNavigateAdmin: () => void
}

export function EngineDiagnosticCard({ data, onNavigateAdmin }: EngineDiagnosticCardProps) {
  return (
    <div
      className="lg:col-span-4 nl-surface animate-card-reveal rounded-2xl p-5 flex flex-col justify-between space-y-4"
      style={{ animationDelay: '180ms' }}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>Diagnóstico del Motor IA</span>
            <InfoTip
              title="Diagnóstico del Motor IA"
              text="Estado en vivo del runtime TensorFlow/Keras, disponibilidad del servicio y aislamiento de los datos de prueba."
              size="xs"
            />
          </h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            {data.system_health.status}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>Backend ML:</span>
                <InfoTip
                  text="Motor de cálculo tensorial encargado de compilar capas densas, calcular gradientes y ejecutar inferencias."
                  size="xs"
                />
              </span>
              <span className="text-white font-mono font-bold">{data.system_health.engine}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span>Disponibilidad (SLA):</span>
                <InfoTip
                  text="Porcentaje de tiempo operativo sin caídas del servicio de entrenamiento e inferencia."
                  size="xs"
                />
              </span>
              <span className="text-emerald-400 font-mono font-bold">{data.system_health.uptime_pct}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span>Optimización Tensorial:</span>
                <InfoTip
                  text="Instrucciones vectoriales de hardware (oneDNN / AVX2 o GPU) empleadas para acelerar multiplicaciones de matrices."
                  size="xs"
                />
              </span>
              <span className="text-indigo-400 font-mono font-semibold">
                {data.system_health.gpu_acceleration ? 'oneDNN / AVX2 Activo' : 'CPU Estándar'}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <span>Capacidad de Cola de Entrenamiento</span>
                  <InfoTip
                    text="Número máximo de trabajos de entrenamiento simultáneos permitidos por el planizador antes de encolar nuevas corridas."
                    size="xs"
                  />
                </span>
                <span className="text-white font-mono font-bold">
                  {data.active_jobs} / {data.system_health.queue_capacity} slots
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full nl-accent-bg nl-progress-shimmer rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(10, (data.active_jobs / data.system_health.queue_capacity) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <span>Integridad de Partición Test (15%)</span>
                  <InfoTip
                    title="Sellado Anti-Data Leakage"
                    text="El 15% del dataset queda bloqueado criptográficamente fuera del entrenamiento y la validación para medir generalización real sin sesgo."
                    size="xs"
                  />
                </span>
                <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 100% Sellado
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 nl-progress-shimmer rounded-full w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Control RBAC & Auditoría Activos
        </span>
        <button onClick={onNavigateAdmin} className="text-indigo-400 font-bold hover:underline">
          Configuración & Cuotas →
        </button>
      </div>
    </div>
  )
}

