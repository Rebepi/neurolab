import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, Flame, Gauge, TrendingDown } from 'lucide-react'
import type { EpochMetric } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'
import { useTheme } from '../../../context/ThemeContext'

interface LearningCurvesPanelProps {
  metrics: EpochMetric[]
  glassPanelClass: string
}

export function LearningCurvesPanel({ metrics, glassPanelClass }: LearningCurvesPanelProps) {
  const { mode } = useTheme()
  const isLight = mode === 'light'

  const enriched = metrics.map((m, idx) => {
    const prev = idx > 0 ? metrics[idx - 1] : null
    const accTrainPct = Number((m.accuracy * 100).toFixed(2))
    const accValPct = Number((m.val_accuracy * 100).toFixed(2))
    const accGapPts = Number(((m.accuracy - m.val_accuracy) * 100).toFixed(2))
    const lossGap = Number((m.val_loss - m.loss).toFixed(4))
    const lossDrop = prev ? Number((prev.val_loss - m.val_loss).toFixed(4)) : 0
    const valAccGainPts = prev ? Number(((m.val_accuracy - prev.val_accuracy) * 100).toFixed(2)) : 0

    return {
      ...m,
      accTrainPct,
      accValPct,
      accGapPts,
      lossGap,
      lossDrop,
      valAccGainPts,
    }
  })

  const validLosses = metrics.map(m => m.val_loss).filter((v): v is number => typeof v === 'number')
  const validAccs = metrics.map(m => m.val_accuracy).filter((v): v is number => typeof v === 'number')
  const minValLoss = validLosses.length > 0 ? Math.min(...validLosses) : null
  const bestValAcc = validAccs.length > 0 ? Math.max(...validAccs) : null
  const bestEpochRow =
    minValLoss != null ? metrics.find(m => m.val_loss === minValLoss) ?? null : null

  const lastRow = enriched.length > 0 ? enriched[enriched.length - 1] : null
  const firstRow = enriched.length > 0 ? enriched[0] : null
  const totalLossReductionPct =
    firstRow && lastRow && firstRow.val_loss > 0
      ? (((firstRow.val_loss - lastRow.val_loss) / firstRow.val_loss) * 100).toFixed(1)
      : null

  const gridStroke = isLight ? '#e2e8f0' : '#1e293b'
  const tickFill = isLight ? '#475569' : '#94a3b8'
  const tooltipStyle = {
    backgroundColor: isLight ? '#ffffff' : '#071022',
    border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(56, 189, 248, 0.45)',
    borderRadius: 12,
    boxShadow: isLight
      ? '0 10px 24px -8px rgba(15, 23, 42, 0.16)'
      : '0 18px 40px -8px rgba(0, 0, 0, 0.92)',
    fontSize: 12,
  }
  const tooltipLabelStyle = { color: isLight ? '#0f172a' : '#e2e8f0', fontWeight: 700 }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center text-indigo-300">
            <Activity className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Curvas de Aprendizaje &amp; Dinámica por Época</span>
            <InfoTip
              title="Dinámica Completa de Entrenamiento"
              text="Analiza la evolución del modelo época tras época sobre Entrenamiento (70%) y Validación (15%): pérdida, exactitud, brecha de sobreajuste y velocidad de mejora."
              hint="Pasa el cursor sobre cualquier gráfica para inspeccionar los valores exactos por época."
              size="xs"
            />
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {bestEpochRow && (
            <span className="px-2.5 py-1 rounded-full bg-cyan-500/12 border border-cyan-500/30 text-cyan-300 font-mono">
              Época óptima: #{bestEpochRow.epoch}
            </span>
          )}
          {totalLossReductionPct != null && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 font-mono">
              Reducción Val Loss: {totalLossReductionPct}%
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${glassPanelClass} nl-card-interactive p-5 relative overflow-hidden`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-400 via-violet-400 to-amber-400" />
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-300">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Curva de Pérdida (Loss Train vs. Val)</span>
                  <InfoTip
                    title="Evolución de la Función de Pérdida (Loss)"
                    text="Mide el error cuantitativo que el optimizador minimiza en cada época. Ambas curvas deben descender suavemente hasta estabilizarse."
                    hint="Si Val Loss empieza a subir mientras Train Loss baja, hay sobreajuste (overfitting)."
                    size="xs"
                  />
                </p>
                <p className="text-[11px] text-slate-400">Minimización del error de predicción</p>
              </div>
            </div>
            {minValLoss != null && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Mín. Val: {minValLoss.toFixed(4)}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={235}>
            <AreaChart data={enriched}>
              <defs>
                <linearGradient id="lossTrainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="lossValGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="epoch" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="loss"
                name="Train Loss"
                stroke="#818cf8"
                fill="url(#lossTrainGrad)"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="val_loss"
                name="Val Loss"
                stroke="#f59e0b"
                fill="url(#lossValGrad)"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={`${glassPanelClass} nl-card-interactive p-5 relative overflow-hidden`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400" />
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-300">
                <Gauge className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Curva de Exactitud (Accuracy %)</span>
                  <InfoTip
                    title="Evolución de la Exactitud (Accuracy)"
                    text="Porcentaje de muestras clasificadas correctamente en cada época tanto en el conjunto de entrenamiento como en el de validación."
                    hint="Valores altos y cercanos entre sí indican aprendizaje sólido y buena capacidad de generalización."
                    size="xs"
                  />
                </p>
                <p className="text-[11px] text-slate-400">Porcentaje de aciertos por época (0–100%)</p>
              </div>
            </div>
            {bestValAcc != null && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Mejor Val: {(bestValAcc * 100).toFixed(2)}%
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={235}>
            <AreaChart data={enriched}>
              <defs>
                <linearGradient id="accTrainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="accValGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="epoch" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: tickFill, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                unit="%"
              />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="accTrainPct"
                name="Train Accuracy (%)"
                stroke="#38bdf8"
                fill="url(#accTrainGrad)"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="accValPct"
                name="Val Accuracy (%)"
                stroke="#10b981"
                fill="url(#accValGrad)"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={`${glassPanelClass} nl-card-interactive p-5 relative overflow-hidden`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400" />
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/35 flex items-center justify-center text-violet-300">
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Brecha de Generalización (Train − Val Gap)</span>
                  <InfoTip
                    title="Monitor de Sobreajuste (Overfitting Gap)"
                    text="Muestra la diferencia entre Entrenamiento y Validación en cada época: las barras miden la brecha de exactitud (puntos %) y la línea mide el exceso de Val Loss sobre Train Loss."
                    hint="Valores cercanos a 0 indican que la red generaliza sin memorizar el conjunto Train."
                    size="xs"
                  />
                </p>
                <p className="text-[11px] text-slate-400">Control de memorización y divergencia Train/Val</p>
              </div>
            </div>
            {lastRow && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                Gap final: {lastRow.accGapPts > 0 ? `+${lastRow.accGapPts}` : lastRow.accGapPts} pts
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={235}>
            <ComposedChart data={enriched}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="epoch" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tick={{ fill: tickFill, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                unit="%"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: tickFill, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine yAxisId="left" y={0} stroke="#64748b" strokeDasharray="3 3" />
              <Bar
                yAxisId="left"
                dataKey="accGapPts"
                name="Brecha Acc (Train − Val pts %)"
                fill="#a78bfa"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.75}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="lossGap"
                name="Brecha Loss (Val − Train)"
                stroke="#22d3ee"
                strokeWidth={2.2}
                dot={{ r: 2.5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className={`${glassPanelClass} nl-card-interactive p-5 relative overflow-hidden`}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400" />
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Velocidad de Convergencia (Δ por Época)</span>
                  <InfoTip
                    title="Ganancia Marginal entre Épocas Consecutivas"
                    text="Cuantifica cuánto mejora la exactitud de validación (Δ Val Acc %) y cuánto se reduce el error (Δ Val Loss) respecto a la época inmediatamente anterior."
                    hint="Cuando las barras se estabilizan cerca de 0, el modelo alcanzó su meseta de convergencia."
                    size="xs"
                  />
                </p>
                <p className="text-[11px] text-slate-400">Mejora incremental de validación época a época</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              {enriched.length} épocas registradas
            </span>
          </div>
          <ResponsiveContainer width="100%" height={235}>
            <BarChart data={enriched}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="epoch" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: tickFill, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                unit="%"
              />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
              <Bar
                dataKey="valAccGainPts"
                name="Δ Val Accuracy (pts %)"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.82}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
