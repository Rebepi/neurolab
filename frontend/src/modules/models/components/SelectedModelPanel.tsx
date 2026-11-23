import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Box,
  CheckCircle2,
  Copy,
  Crosshair,
  Database,
  Download,
  FileJson,
  FileText,
  Grid,
  Layers,
  Play,
  RefreshCw,
  ShieldCheck,
  Star,
  Target,
  TrendingDown,
  X,
} from 'lucide-react'
import type { ModelVersion } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'
import { useToast } from '../../../components/toast/ToastContext'
import { buildAuthorizedUrl } from '../../../services/api'
import { normalizeModelStatus } from './ModelVersionsGrid'

interface SelectedModelPanelProps {
  selectedModel: ModelVersion
  updatingId: string | null
  onStatusChange: (modelId: string, newStatus: string) => void
  onOpenSimulator: () => void
  onUseIn3D?: () => void
  onOpenReport?: () => void
  onClose: () => void
}

export function SelectedModelPanel({
  selectedModel,
  updatingId,
  onStatusChange,
  onOpenSimulator,
  onUseIn3D,
  onOpenReport,
  onClose,
}: SelectedModelPanelProps) {
  const toast = useToast()
  const [copiedHash, setCopiedHash] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const normStatus = normalizeModelStatus(selectedModel.status)
  const tm = selectedModel.test_metrics
  const archLayers = selectedModel.architecture_config?.layers ?? []
  const inputDim = selectedModel.architecture_config?.input_shape
  const cm = selectedModel.confusion_matrix ?? []
  const totalSamples = cm.reduce((acc, r) => acc + r.reduce((s, v) => s + v, 0), 0)
  const maxCell = cm.length > 0 ? Math.max(1, ...cm.flat()) : 1
  const stabilityPct = Math.max(
    0,
    Math.min(100, Number(((1 / (1 + tm.test_loss)) * 100).toFixed(1)))
  )

  function copyHash(checksum: string) {
    navigator.clipboard.writeText(checksum)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
    toast.success('Firma SHA-256 copiada', `Modelo ${selectedModel.version}`)
  }

  const kpiCards = [
    {
      label: 'Exactitud Test',
      value: `${(tm.test_accuracy * 100).toFixed(2)}%`,
      ratio: tm.test_accuracy,
      tone: 'text-emerald-400',
      bar: 'from-emerald-500 to-teal-400',
      icon: Target,
      info: 'Tasa de aciertos sobre la partición de prueba sellada (15%).',
    },
    {
      label: 'F1-Score',
      value: `${(tm.f1_score * 100).toFixed(2)}%`,
      ratio: tm.f1_score,
      tone: 'text-violet-300',
      bar: 'from-violet-500 to-indigo-400',
      icon: Star,
      info: 'Media armónica entre Precisión y Recall.',
    },
    {
      label: 'Precisión',
      value: `${(tm.precision * 100).toFixed(2)}%`,
      ratio: tm.precision,
      tone: 'text-cyan-300',
      bar: 'from-cyan-500 to-sky-400',
      icon: Crosshair,
      info: 'Porcentaje de predicciones positivas que fueron correctas.',
    },
    {
      label: 'Recall',
      value: `${(tm.recall * 100).toFixed(2)}%`,
      ratio: tm.recall,
      tone: 'text-teal-300',
      bar: 'from-teal-500 to-emerald-400',
      icon: RefreshCw,
      info: 'Porcentaje de casos positivos reales capturados.',
    },
    {
      label: 'Test Loss',
      value: tm.test_loss.toFixed(4),
      ratio: stabilityPct / 100,
      tone: 'text-amber-300',
      bar: 'from-amber-500 to-orange-400',
      icon: TrendingDown,
      info: `Error residual en Test. Estabilidad: ${stabilityPct}%.`,
    },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-detail-modal-title"
    >
      <div
        className="relative w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-cyan-500/25 bg-[#070f21] text-slate-100 shadow-[0_24px_90px_rgba(2,6,23,0.92)] overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500 shrink-0" />

        <div className="px-5 py-4 border-b border-white/10 bg-slate-900/55 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2
                id="model-detail-modal-title"
                className="text-base sm:text-lg font-extrabold text-white tracking-tight"
              >
                Certificado de Artefacto · Modelo {selectedModel.version}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${normStatus.badgeClass}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {normStatus.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              Dataset: <strong className="text-slate-200">{selectedModel.dataset_name || 'Dataset'}</strong> ·{' '}
              Topología: <strong className="text-slate-200">{selectedModel.arch_name || 'MLP Keras'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {normStatus.code !== 'APPROVED' ? (
              <button
                type="button"
                disabled={updatingId === selectedModel.id}
                onClick={() => onStatusChange(selectedModel.id, 'Aprobado')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Aprobar</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={updatingId === selectedModel.id}
                onClick={() => onStatusChange(selectedModel.id, 'En Revisión')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/35 bg-amber-500/12 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <span>Pasar a Revisión</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ficha de modelo"
              className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {kpiCards.map(card => {
              const Icon = card.icon
              return (
                <div
                  key={card.label}
                  className="bg-slate-950/75 p-3 rounded-xl border border-slate-800/90 flex flex-col justify-between gap-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-400 text-[11px] font-medium truncate flex items-center gap-1">
                      <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{card.label}</span>
                    </span>
                    <InfoTip title={card.label} text={card.info} size="xs" />
                  </div>
                  <p className={`text-lg font-extrabold font-mono tabular-nums ${card.tone}`}>
                    {card.value}
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${card.bar}`}
                      style={{ width: `${Math.max(6, Math.min(100, card.ratio * 100))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {cm.length > 0 && (
              <div className="lg:col-span-7 rounded-2xl bg-slate-950/70 border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Matriz de Confusión en Test Sellado</span>
                    <InfoTip
                      title="Matriz de Confusión Certificada"
                      text="La diagonal verde concentra las muestras clasificadas correctamente; fuera de la diagonal se observan los errores cruzados."
                      size="xs"
                    />
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    {totalSamples.toLocaleString('es-ES')} muestras
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="mx-auto border-separate border-spacing-2">
                    <thead>
                      <tr>
                        <th className="text-[10px] font-mono text-slate-400 text-right pr-2">Real \ Pred</th>
                        {cm[0].map((_, ci) => (
                          <th key={ci} className="text-center text-xs font-mono text-cyan-300 pb-1 min-w-[84px]">
                            Pred {ci}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cm.map((row, ri) => (
                        <tr key={ri}>
                          <td className="text-xs font-mono text-slate-300 pr-2 text-right whitespace-nowrap">
                            Real {ri}
                          </td>
                          {row.map((val, ci) => {
                            const intensity = val / maxCell
                            const pct = totalSamples > 0 ? ((val / totalSamples) * 100).toFixed(1) : '0.0'
                            const isDiag = ri === ci
                            const cellBg = isDiag
                              ? `rgba(16, 185, 129, ${(0.14 + intensity * 0.28).toFixed(2)})`
                              : `rgba(244, 63, 94, ${(0.08 + intensity * 0.24).toFixed(2)})`
                            return (
                              <td
                                key={ci}
                                style={{ backgroundColor: cellBg }}
                                className={`text-center rounded-xl min-w-[84px] px-3 py-2 border ${
                                  isDiag
                                    ? 'border-emerald-500/45 text-emerald-200'
                                    : 'border-rose-500/35 text-rose-200'
                                }`}
                              >
                                <div className="text-sm font-extrabold font-mono">{val}</div>
                                <div className="text-[10px] font-mono opacity-80">{pct}%</div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div
              className={`${
                cm.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'
              } rounded-2xl bg-slate-950/70 border border-slate-800 p-4 space-y-3`}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Topología &amp; Linaje del Binario</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/75 border border-slate-800">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    Entrada / Target
                  </span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    ({inputDim ?? '—'},) → {selectedModel.target_column || 'target'}
                  </span>
                </div>

                {archLayers.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-slate-900/75 border border-slate-800 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Capas Ocultas ({archLayers.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {archLayers.map((l, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200"
                        >
                          #{idx + 1}{' '}
                          {l.type === 'Dense'
                            ? `Dense ${l.units ?? 32}u (${l.activation ?? 'relu'})`
                            : l.type === 'Dropout'
                              ? `Dropout ${Math.round((l.rate ?? 0.2) * 100)}%`
                              : 'BatchNorm'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-2.5 rounded-xl bg-slate-900/75 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Checksum SHA-256
                    </span>
                    <button
                      type="button"
                      onClick={() => copyHash(selectedModel.checksum)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      {copiedHash ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedHash ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <code className="block font-mono text-[10.5px] text-slate-300 break-all bg-slate-950 p-2 rounded-lg border border-slate-800">
                    {selectedModel.checksum}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-slate-900/65 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.open(buildAuthorizedUrl(`/models/${selectedModel.id}/download`))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar .keras</span>
            </button>
            <button
              type="button"
              onClick={() => window.open(buildAuthorizedUrl(`/models/${selectedModel.id}/download-spec`))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-xs font-semibold transition-all"
            >
              <FileJson className="w-3.5 h-3.5 text-cyan-400" />
              <span>JSON Spec</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenSimulator}
              className="nl-btn-shimmer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simular Inferencia (.keras)</span>
            </button>
            {onUseIn3D && (
              <button
                type="button"
                onClick={onUseIn3D}
                className="nl-btn-shimmer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold transition-all"
              >
                <Box className="w-3.5 h-3.5" />
                <span>Usar en Vivo 3D (07)</span>
              </button>
            )}
            {onOpenReport && (
              <button
                type="button"
                onClick={onOpenReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reporte PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-white/15 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
