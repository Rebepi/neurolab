import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Wand2 } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import type { AutoCleanPlanResponse } from '../../../types/index'

interface AutoCleanSummaryCardProps {
  plan: AutoCleanPlanResponse
  manuallyAdjusted?: boolean
}

export function AutoCleanSummaryCard({ plan, manuallyAdjusted = false }: AutoCleanSummaryCardProps) {
  const { diagnostics, explanations } = plan
  const improved = diagnostics.health_score_after >= diagnostics.health_score_before
  const alerts = diagnostics.critical_alerts ?? []
  const impact = diagnostics.impact_preview

  return (
    <div className="rounded-xl border border-teal-500/40 bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-indigo-500/10 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center">
            <Wand2 className="w-3.5 h-3.5 text-teal-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-teal-200 uppercase tracking-wider">
                Diagnóstico y Plan Automático Inteligente
              </span>
              <InfoTip
                title="Motor AutoML de Curación"
                text="Analiza estadísticamente todas las filas y columnas del CSV para detectar fuga de datos, colinealidad, formatos rotos, desbalanceo y distribuciones asimétricas."
                side="right"
              />
              {manuallyAdjusted && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300">
                  Ajustado manualmente
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Evaluado sobre {diagnostics.total_rows.toLocaleString()} filas ·{' '}
              {diagnostics.total_columns} columnas → estimadas{' '}
              <strong className="text-white">{diagnostics.estimated_rows_after.toLocaleString()}</strong>{' '}
              filas limpias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 inline-flex items-center gap-1.5">
            <span>
              Salud: <strong className="text-amber-300">{diagnostics.health_score_before}</strong> →{' '}
              <strong className={improved ? 'text-emerald-300' : 'text-cyan-300'}>
                {diagnostics.health_score_after}
              </strong>
              /100
            </span>
            <InfoTip
              title="Índice de Salud del Dataset"
              text="Puntaje calculado según completitud (nulos), duplicados exactos, proporción de anomalías IQR, formatos rotos y fuga de datos."
              side="left"
            />
          </span>
        </div>
      </div>

      {impact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="rounded-lg bg-slate-950/75 border border-slate-800/80 px-3 py-2">
            <p className="text-[10px] text-slate-400">Simulación Filas</p>
            <p className="text-white font-bold mt-0.5">
              {impact.rows_before.toLocaleString()} → {impact.estimated_rows_after.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/75 border border-slate-800/80 px-3 py-2">
            <p className="text-[10px] text-slate-400">Simulación Columnas</p>
            <p className="text-cyan-300 font-bold mt-0.5">
              {impact.columns_before} → {impact.estimated_columns_after}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/75 border border-slate-800/80 px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span>Input Shape Est.</span>
              <InfoTip
                title="Dimensión de Entrada Proyectada"
                text="Número exacto de neuronas de entrada tras expandir categorías one-hot, fechas y excluir columnas ruidosas o con fuga."
                side="top"
              />
            </div>
            <p className="text-violet-300 font-bold mt-0.5">{impact.estimated_input_shape} features</p>
          </div>
          <div className="rounded-lg bg-slate-950/75 border border-slate-800/80 px-3 py-2">
            <p className="text-[10px] text-slate-400">Alertas Críticas</p>
            <p className={`font-bold mt-0.5 ${alerts.length > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {alerts.length > 0 ? `${alerts.length} detectadas` : 'Sin anomalías'}
            </p>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((al, idx) => (
            <div
              key={`${al.type}-${idx}`}
              className={`rounded-xl px-3 py-2 border text-[11px] flex items-start gap-2 ${
                al.severity === 'critical'
                  ? 'bg-rose-500/15 border-rose-500/45 text-rose-200'
                  : 'bg-amber-500/12 border-amber-500/40 text-amber-200'
              }`}
            >
              {al.severity === 'critical' ? (
                <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{al.title}</p>
                <p className="opacity-90 leading-snug">{al.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {explanations.map(item => (
          <div
            key={item.step}
            className="rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-2.5 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {item.step}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-200">
                <CheckCircle2 className="w-2.5 h-2.5 text-teal-300" />
                {item.decision}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{item.reason}</p>
          </div>
        ))}
      </div>

      {diagnostics.dropped_columns_detail.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
          <span className="inline-flex items-center gap-1 text-rose-300 font-medium">
            <Sparkles className="w-3 h-3" />
            Columnas excluidas por criterio estadístico:
          </span>
          {diagnostics.dropped_columns_detail.map(d => (
            <span
              key={d.column}
              title={d.reason}
              className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/35 text-rose-200 font-mono"
            >
              {d.column}: {d.reason}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
