import {
  Activity, Sparkles, Cpu, ShieldCheck, CheckCircle2, Copy, AlertTriangle, Check
} from 'lucide-react'
import type { Architecture, Dataset, ModelVersion, TestMetrics } from '../../../types/index'
import type { ExecutiveDiagnostic } from '../types'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'

interface ReportKpiStripProps {
  loading: boolean
  displayAcc: number | null
  displayLoss: number | null
  resolvedMetrics: TestMetrics | null
  primaryDataset: Dataset | null
  primaryArch: Architecture | null
  resolvedModel: ModelVersion | null
  modelsCount: number
  copiedKey: string | null
  onCopy: (key: string, text: string) => void
  diagnostic: ExecutiveDiagnostic
}

export function ReportKpiStrip({
  loading,
  displayAcc,
  displayLoss,
  resolvedMetrics,
  primaryDataset,
  primaryArch,
  resolvedModel,
  modelsCount,
  copiedKey,
  onCopy,
  diagnostic,
}: ReportKpiStripProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nl-skeleton rounded-2xl h-28" />
        ))}
      </div>
    )
  }

  const toneBadge =
    diagnostic.tone === 'optimal'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
      : diagnostic.tone === 'warning'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
        : diagnostic.tone === 'critical'
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
          : 'bg-slate-800 text-slate-300 border-slate-700'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="nl-surface nl-card-interactive animate-card-reveal rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>Exactitud Final</span>
              <InfoTip text="Tasa de aciertos medida prioritariamente sobre la partición de Test sellada (15%)." size="xs" />
            </span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-emerald-400">
            {displayAcc != null ? `${(displayAcc * 100).toFixed(2)}%` : '—'}
          </p>
          <p className="text-[11px] text-slate-400">
            {resolvedMetrics
              ? `Test sellado (${resolvedMetrics.total_test_samples || primaryDataset?.splits?.test_count || 0} filas) · Loss ${displayLoss != null ? displayLoss.toFixed(4) : '—'}`
              : 'Sin evaluación test registrada'}
          </p>
        </div>

        <div className="nl-surface nl-card-interactive animate-card-reveal rounded-2xl p-4 space-y-2" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>F1-Score y Balance</span>
              <InfoTip text="Media armónica entre Precision y Recall obtenida del modelo certificado asociado al experimento." size="xs" />
            </span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-cyan-400">
            {resolvedMetrics?.f1_score != null ? `${(resolvedMetrics.f1_score * 100).toFixed(2)}%` : '—'}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            {resolvedMetrics
              ? `Prec ${(resolvedMetrics.precision * 100).toFixed(1)}% · Rec ${(resolvedMetrics.recall * 100).toFixed(1)}%`
              : 'Pendiente de evaluación'}
          </p>
        </div>

        <div className="nl-surface nl-card-interactive animate-card-reveal rounded-2xl p-4 space-y-2" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>Arquitectura Activa</span>
              <InfoTip text="Total de pesos sinápticos y sesgos entrenables en la topología evaluada." size="xs" />
            </span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-white">
            {primaryArch ? `${primaryArch.total_parameters.toLocaleString('es')}` : '—'}
            {primaryArch && <span className="text-xs font-sans font-semibold text-slate-400 ml-1.5">parámetros</span>}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {primaryArch
              ? `${primaryArch.name} · ${primaryArch.config.layers.length} capas (${primaryArch.family})`
              : 'Sin topología configurada'}
          </p>
        </div>

        <div className="nl-surface nl-card-interactive animate-card-reveal rounded-2xl p-4 space-y-2" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>Certificación Registry</span>
              <InfoTip text="Versión del artefacto .keras publicada y sellada con suma SHA-256." size="xs" />
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-extrabold font-mono text-white">
              {resolvedModel ? resolvedModel.version : 'Sin modelo'}
            </p>
            {resolvedModel && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {resolvedModel.status}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="font-mono truncate">
              {resolvedModel ? `SHA: ${resolvedModel.checksum.slice(0, 14)}...` : `${modelsCount} versiones`}
            </span>
            {resolvedModel && (
              <SystemTooltip label="Copiar firma SHA-256 completa" side="bottom">
                <button
                  onClick={() => onCopy('kpi-hash', resolvedModel.checksum)}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'kpi-hash' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'kpi-hash' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </SystemTooltip>
            )}
          </div>
        </div>
      </div>

      <div className="nl-surface animate-card-reveal rounded-2xl px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start lg:items-center gap-3 min-w-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border shrink-0 ${toneBadge}`}>
            {diagnostic.tone === 'optimal' ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{diagnostic.verdict}</span>
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">{diagnostic.summary}</p>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
          <span>Diagnóstico Automático</span>
          <InfoTip
            title="Criterio de Dictamen Ejecutivo"
            text={diagnostic.recommendations.join(' ')}
            size="xs"
            side="bottom"
          />
        </div>
      </div>
    </div>
  )
}

