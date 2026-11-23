import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  HeartPulse,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react'
import type { Architecture, Dataset, ModelVersion, TestMetrics } from '../../../types/index'
import type { ExecutiveDiagnostic, ReportCustomizationConfig } from '../types'
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
  config: ReportCustomizationConfig
  onOpenCustomizer: () => void
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
  config,
  onOpenCustomizer,
}: ReportKpiStripProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
        {Array.from({ length: 5 }).map((_, i) => (
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

  const accPct = displayAcc != null ? displayAcc * 100 : 0
  const f1Pct = resolvedMetrics?.f1_score != null ? resolvedMetrics.f1_score * 100 : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
        <div className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>Exactitud Final</span>
              <InfoTip
                text={`Tasa de aciertos sobre la partición de Test sellada (15%). Meta SLA configurada: ${config.targetSlaAccuracyPct}%.`}
                size="xs"
              />
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-2xl font-extrabold font-mono text-emerald-400">
              {displayAcc != null ? `${accPct.toFixed(2)}%` : '—'}
            </p>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                diagnostic.slaPassed
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
              }`}
            >
              SLA {config.targetSlaAccuracyPct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
              style={{ width: `${Math.min(100, Math.max(4, accPct))}%` }}
            />
          </div>
          <p className="text-[10.5px] text-slate-400 truncate">
            {resolvedMetrics
              ? `Test (${resolvedMetrics.total_test_samples || primaryDataset?.splits?.test_count || 0} filas) · Loss ${displayLoss != null ? displayLoss.toFixed(4) : '—'}`
              : 'Sin evaluación test registrada'}
          </p>
        </div>

        <div
          className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-4 space-y-2"
          style={{ animationDelay: '50ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>F1-Score &amp; Balance</span>
              <InfoTip
                text="Media armónica entre Precision y Recall obtenida del modelo certificado asociado al experimento."
                size="xs"
              />
            </span>
            <span className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-cyan-400">
            {resolvedMetrics?.f1_score != null ? `${f1Pct.toFixed(2)}%` : '—'}
          </p>
          <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-400"
              style={{ width: `${Math.min(100, Math.max(4, f1Pct))}%` }}
            />
          </div>
          <p className="text-[10.5px] text-slate-400 font-mono truncate">
            {resolvedMetrics
              ? `Prec ${(resolvedMetrics.precision * 100).toFixed(1)}% · Rec ${(resolvedMetrics.recall * 100).toFixed(1)}%`
              : 'Pendiente de evaluación'}
          </p>
        </div>

        <div
          className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-4 space-y-2"
          style={{ animationDelay: '100ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>Health Score IA</span>
              <InfoTip
                text="Índice global (0–100) calculado combinando Exactitud, F1-Score y penalización por brecha de sobreajuste Val-Train Loss."
                size="xs"
              />
            </span>
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <HeartPulse className="w-3.5 h-3.5 text-amber-400" />
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-extrabold font-mono text-amber-300">
              {diagnostic.healthScore}
            </p>
            <span className="text-xs font-mono text-slate-400">/ 100 pts</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-teal-400 to-emerald-400"
              style={{ width: `${Math.min(100, Math.max(6, diagnostic.healthScore))}%` }}
            />
          </div>
          <p className="text-[10.5px] text-slate-400 font-mono truncate">
            Brecha Loss:{' '}
            <strong className="text-slate-200">
              {diagnostic.overfitGap != null
                ? `${diagnostic.overfitGap >= 0 ? '+' : ''}${diagnostic.overfitGap.toFixed(4)}`
                : '0.0000'}
            </strong>
          </p>
        </div>

        <div
          className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-4 space-y-2"
          style={{ animationDelay: '150ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>Arquitectura Activa</span>
              <InfoTip
                text="Total de pesos sinápticos y sesgos entrenables en la topología evaluada."
                size="xs"
              />
            </span>
            <span className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            </span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-white truncate">
            {primaryArch ? `${primaryArch.total_parameters.toLocaleString('es')}` : '—'}
            {primaryArch && (
              <span className="text-xs font-sans font-semibold text-slate-400 ml-1">pesos</span>
            )}
          </p>
          <p className="text-[10.5px] text-slate-400 truncate">
            {primaryArch
              ? `${primaryArch.name} · ${primaryArch.config.layers.length} capas (${primaryArch.family})`
              : 'Sin topología configurada'}
          </p>
        </div>

        <div
          className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-4 space-y-2"
          style={{ animationDelay: '200ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span>Certificación Registry</span>
              <InfoTip
                text="Versión del artefacto .keras publicada y sellada con suma SHA-256."
                size="xs"
              />
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </span>
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
          <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-400 pt-1">
            <span className="font-mono truncate">
              {resolvedModel
                ? `SHA: ${resolvedModel.checksum.slice(0, 12)}...`
                : `${modelsCount} versiones`}
            </span>
            {resolvedModel && (
              <SystemTooltip label="Copiar firma SHA-256 completa" side="bottom">
                <button
                  onClick={() => onCopy('kpi-hash', resolvedModel.checksum)}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 shrink-0"
                >
                  {copiedKey === 'kpi-hash' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedKey === 'kpi-hash' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </SystemTooltip>
            )}
          </div>
        </div>
      </div>

      <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start lg:items-center gap-3 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border shrink-0 ${toneBadge}`}
          >
            {diagnostic.tone === 'optimal' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>{diagnostic.verdict}</span>
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">{diagnostic.summary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 shrink-0">
          <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-cyan-300">
            {config.confidentiality}
          </span>
          <button
            type="button"
            onClick={onOpenCustomizer}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-semibold transition-colors nl-no-print"
          >
            <Sliders className="w-3 h-3" />
            <span>Ajustar SLA / Plantilla</span>
          </button>
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
