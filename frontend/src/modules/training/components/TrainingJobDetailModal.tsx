import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  ArrowRight,
  Cpu,
  Copy,
  Gauge,
  Layers,
  LineChart as LineChartIcon,
  Terminal,
  Timer,
  X,
  Zap,
} from 'lucide-react'
import type { TrainingJob } from '../../../types'
import { STATUS_BADGE, STATUS_LABEL } from '../constants'

interface TrainingJobDetailModalProps {
  job: TrainingJob
  onClose: () => void
  onCopyId: (jobId: string) => void
  onGoToEvaluation?: () => void
}

type DetailTab = 'summary' | 'curves' | 'log'

interface EpochPoint {
  epoch: number
  loss: number
  acc: number
  valLoss: number
  valAcc: number
}

interface ChartSeries {
  label: string
  color: string
  values: number[]
}

const LOG_PATTERN =
  /Epoch\s+(\d+)\/\d+\s*-\s*loss:\s*([\d.]+)\s*-\s*acc:\s*([\d.]+)\s*-\s*val_loss:\s*([\d.]+)\s*-\s*val_acc:\s*([\d.]+)/i

function parseEpochPoints(logs: string[]): EpochPoint[] {
  const points: EpochPoint[] = []
  logs.forEach(line => {
    const match = LOG_PATTERN.exec(line)
    if (!match) return
    points.push({
      epoch: Number(match[1]),
      loss: Number(match[2]),
      acc: Number(match[3]),
      valLoss: Number(match[4]),
      valAcc: Number(match[5]),
    })
  })
  return points
}

function formatDate(value?: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '—'
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

function AccuracyGauge({ value, label }: { value: number | undefined; label: string }) {
  const pct = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 0
  const radius = 46
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="nlTrainGaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(51,65,85,0.7)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#nlTrainGaugeGrad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${circumference * pct} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold font-mono text-white leading-none">
          {typeof value === 'number' ? (value * 100).toFixed(1) : '—'}
          <span className="text-sm text-slate-400">%</span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">{label}</span>
      </div>
    </div>
  )
}

function CompareRow({
  title,
  train,
  val,
  isPercent,
}: {
  title: string
  train: number | undefined
  val: number | undefined
  isPercent: boolean
}) {
  const maxValue = Math.max(train ?? 0, val ?? 0, 0.0001) * (isPercent ? 1 : 1.15)
  const fmt = (v: number | undefined) =>
    typeof v === 'number' ? (isPercent ? (v * 100).toFixed(2) + '%' : v.toFixed(4)) : '—'
  const width = (v: number | undefined) =>
    typeof v === 'number' ? Math.max(3, Math.min(100, (v / maxValue) * 100)) : 0

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{title}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-12 text-[10px] text-slate-400">Train</span>
          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400"
              style={{ width: `${width(train)}%` }}
            />
          </div>
          <span className="w-16 text-right text-xs font-mono font-bold text-cyan-300">{fmt(train)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-12 text-[10px] text-slate-400">Val</span>
          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
              style={{ width: `${width(val)}%` }}
            />
          </div>
          <span className="w-16 text-right text-xs font-mono font-bold text-violet-300">{fmt(val)}</span>
        </div>
      </div>
    </div>
  )
}

function CurveChart({
  title,
  series,
  epochs,
  isPercent,
}: {
  title: string
  series: ChartSeries[]
  epochs: number[]
  isPercent: boolean
}) {
  const width = 320
  const height = 150
  const padL = 38
  const padR = 12
  const padT = 12
  const padB = 24
  const all = series.flatMap(s => s.values)
  const rawMin = Math.min(...all)
  const rawMax = Math.max(...all)
  const span = Math.max(rawMax - rawMin, 0.0001)
  const minV = rawMin - span * 0.1
  const maxV = rawMax + span * 0.1
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const count = epochs.length
  const xAt = (i: number) => padL + (count > 1 ? (i / (count - 1)) * plotW : plotW / 2)
  const yAt = (v: number) => padT + plotH - ((v - minV) / (maxV - minV)) * plotH
  const fmt = (v: number) => (isPercent ? (v * 100).toFixed(0) + '%' : v.toFixed(2))
  const gridLines = [0, 1, 2, 3]

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{title}</p>
        <div className="flex items-center gap-3">
          {series.map(s => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {gridLines.map(g => {
          const value = minV + ((maxV - minV) * g) / 3
          const y = yAt(value)
          return (
            <g key={g}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.14)"
                strokeDasharray="3 3"
              />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                {fmt(value)}
              </text>
            </g>
          )
        })}
        <text x={padL} y={height - 6} fontSize="9" fill="#94a3b8">
          Ép. {epochs[0]}
        </text>
        <text x={width - padR} y={height - 6} textAnchor="end" fontSize="9" fill="#94a3b8">
          Ép. {epochs[count - 1]}
        </text>
        {series.map(s => {
          const path = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(v)}`).join(' ')
          const lastIdx = s.values.length - 1
          return (
            <g key={s.label}>
              <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={xAt(lastIdx)} cy={yAt(s.values[lastIdx])} r="3.2" fill={s.color} stroke="#070f21" strokeWidth="1.5" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function TrainingJobDetailModal({
  job,
  onClose,
  onCopyId,
  onGoToEvaluation,
}: TrainingJobDetailModalProps) {
  const [tab, setTab] = useState<DetailTab>('summary')

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

  const logs = useMemo(() => job.logs ?? [], [job.logs])
  const points = useMemo(() => parseEpochPoints(logs), [logs])
  const hp = job.hyperparams
  const gap =
    typeof job.accuracy === 'number' && typeof job.val_accuracy === 'number'
      ? job.accuracy - job.val_accuracy
      : null

  const gapTone =
    gap === null
      ? null
      : gap > 0.08
        ? { label: 'Posible sobreajuste', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' }
        : { label: 'Generalización estable', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' }

  const configItems = [
    { icon: Layers, label: 'Épocas', value: hp ? String(hp.epochs) : '—' },
    { icon: Cpu, label: 'Batch', value: hp ? String(hp.batch_size) : '—' },
    { icon: Zap, label: 'Optimizador', value: hp ? hp.optimizer.toUpperCase() : '—' },
    { icon: Gauge, label: 'Learning rate', value: hp ? String(hp.learning_rate) : '—' },
  ]

  const tabs: Array<{ id: DetailTab; label: string; icon: typeof Gauge }> = [
    { id: 'summary', label: 'Resumen', icon: Gauge },
    { id: 'curves', label: 'Curvas', icon: LineChartIcon },
    { id: 'log', label: `Registro (${logs.length})`, icon: Terminal },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-job-detail-title"
    >
      <div
        className="relative w-full max-w-3xl flex flex-col rounded-2xl border border-cyan-500/25 bg-[#070f21] text-slate-100 shadow-[0_24px_90px_rgba(2,6,23,0.9)] overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400 shrink-0" />

        <div className="px-5 py-4 bg-gradient-to-br from-slate-900/70 to-transparent flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 border border-cyan-400/30 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <h2
                id="training-job-detail-title"
                className="text-base font-bold text-white leading-snug truncate"
              >
                {job.arch_name || 'Entrenamiento'}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 max-w-[260px] truncate">
                  {job.dataset_name || 'Dataset'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 max-w-[240px] truncate">
                  {job.id}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-semibold ${
                STATUS_BADGE[job.status] || 'bg-slate-700 text-slate-400 border-slate-600'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {STATUS_LABEL[job.status] || job.status}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle"
              className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 border-b border-white/10 flex items-center gap-1 shrink-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                tab === id
                  ? 'border-cyan-400 text-cyan-200'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="h-[390px] overflow-y-auto px-5 py-4">
          {tab === 'summary' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 flex flex-wrap items-center gap-5">
                <AccuracyGauge value={job.accuracy} label="Accuracy" />
                <div className="flex-1 min-w-[260px] space-y-3">
                  <CompareRow title="Accuracy" train={job.accuracy} val={job.val_accuracy} isPercent />
                  <CompareRow title="Loss" train={job.loss} val={job.val_loss} isPercent={false} />
                  {gapTone && gap !== null && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${gapTone.cls}`}
                    >
                      {gapTone.label} · brecha {(gap * 100).toFixed(1)} pts
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {configItems.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2.5 flex items-center gap-2.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-300 shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
                      <p className="text-sm font-mono font-bold text-white truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Timer className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="text-slate-400">Duración</span>
                  <strong className="font-mono text-white">
                    {formatDuration(job.started_at, job.ended_at)}
                  </strong>
                </div>
                <div className="text-xs">
                  <span className="text-slate-400">Inicio </span>
                  <span className="font-mono text-slate-200">{formatDate(job.started_at)}</span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-400">Fin </span>
                  <span className="font-mono text-slate-200">{formatDate(job.ended_at)}</span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-400">Época </span>
                  <span className="font-mono text-slate-200">
                    {job.current_epoch}/{job.total_epochs}
                  </span>
                </div>
              </div>

              {job.cancellation_reason && (
                <div className="p-3 bg-amber-950/35 border border-amber-700/40 rounded-xl text-amber-200 text-xs">
                  <strong>Motivo de cancelación:</strong> {job.cancellation_reason}
                </div>
              )}

              {job.notes && (
                <div className="p-3 bg-slate-900/80 border border-cyan-500/25 rounded-xl text-slate-200 text-xs">
                  <strong className="text-cyan-300">Observaciones:</strong> {job.notes}
                </div>
              )}

              {job.error_message && (
                <div className="flex items-start gap-2 p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{job.error_message}</span>
                </div>
              )}
            </div>
          )}

          {tab === 'curves' &&
            (points.length >= 2 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <CurveChart
                  title="Loss por época"
                  isPercent={false}
                  epochs={points.map(p => p.epoch)}
                  series={[
                    { label: 'Train', color: '#22d3ee', values: points.map(p => p.loss) },
                    { label: 'Val', color: '#c084fc', values: points.map(p => p.valLoss) },
                  ]}
                />
                <CurveChart
                  title="Accuracy por época"
                  isPercent
                  epochs={points.map(p => p.epoch)}
                  series={[
                    { label: 'Train', color: '#34d399', values: points.map(p => p.acc) },
                    { label: 'Val', color: '#fbbf24', values: points.map(p => p.valAcc) },
                  ]}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <LineChartIcon className="w-8 h-8 text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">Sin curvas disponibles</p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Esta corrida no almacenó suficientes métricas por época en su registro.
                </p>
              </div>
            ))}

          {tab === 'log' && (
            <div className="rounded-xl border border-slate-800 bg-[#03070f] overflow-hidden">
              <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-900/70 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400/80" />
                <span className="w-2 h-2 rounded-full bg-amber-400/80" />
                <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
                <span className="ml-2 text-[10px] font-mono text-slate-400">
                  worker · {logs.length} líneas
                </span>
              </div>
              <div className="p-3 max-h-[330px] overflow-y-auto font-mono text-xs space-y-0.5">
                {logs.length === 0 ? (
                  <span className="text-slate-500">Sin registros almacenados para esta corrida.</span>
                ) : (
                  logs.map((line, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-6 text-right text-slate-600 select-none shrink-0">{i + 1}</span>
                      <span className="text-emerald-400 break-all">{line}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-slate-900/65 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onCopyId(job.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar ID
          </button>
          <div className="flex items-center gap-2">
            {job.status === 'COMPLETED' && onGoToEvaluation && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onGoToEvaluation()
                }}
                className="nl-btn-shimmer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all"
              >
                Ver evaluación
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-white/10 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
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
