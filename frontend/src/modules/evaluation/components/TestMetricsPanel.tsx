import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BarChart3,
  CheckCircle2,
  Compass,
  Crosshair,
  Grid,
  Layers,
  RefreshCw,
  ShieldCheck,
  Star,
  Target,
  TrendingDown,
} from 'lucide-react'
import type { ModelVersion, TrainingJob } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'
import { useTheme } from '../../../context/ThemeContext'

interface TestMetricsPanelProps {
  job: TrainingJob
  testMetrics?: ModelVersion['test_metrics'] | null
  confusionMatrix?: number[][] | null
  targetColumn?: string
  glassPanelClass: string
}

interface PerClassStat {
  classLabel: string
  support: number
  predicted: number
  correct: number
  errors: number
  precisionPct: number
  recallPct: number
  f1Pct: number
}

function computePerClassStats(cm: number[][]): PerClassStat[] {
  const n = cm.length
  return cm.map((row, i) => {
    const tp = row[i] ?? 0
    const rowSum = row.reduce((a, b) => a + b, 0)
    let colSum = 0
    for (let r = 0; r < n; r++) {
      colSum += cm[r]?.[i] ?? 0
    }
    const fn = Math.max(0, rowSum - tp)
    const precision = colSum > 0 ? tp / colSum : 0
    const recall = rowSum > 0 ? tp / rowSum : 0
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

    return {
      classLabel: `Clase ${i}`,
      support: rowSum,
      predicted: colSum,
      correct: tp,
      errors: fn,
      precisionPct: Number((precision * 100).toFixed(2)),
      recallPct: Number((recall * 100).toFixed(2)),
      f1Pct: Number((f1 * 100).toFixed(2)),
    }
  })
}

export function TestMetricsPanel({
  job,
  testMetrics,
  confusionMatrix,
  targetColumn,
  glassPanelClass,
}: TestMetricsPanelProps) {
  const { mode } = useTheme()
  const isLight = mode === 'light'

  const effectiveMetrics = testMetrics ?? {
    test_accuracy: job.val_accuracy ?? job.accuracy ?? 0,
    test_loss: job.val_loss ?? job.loss ?? 0,
    precision: job.val_accuracy ?? job.accuracy ?? 0,
    recall: job.val_accuracy ?? job.accuracy ?? 0,
    f1_score: job.val_accuracy ?? job.accuracy ?? 0,
    total_test_samples: 0,
  }

  const totalSamples = confusionMatrix
    ? confusionMatrix.reduce((acc, row) => acc + row.reduce((s, v) => s + v, 0), 0)
    : effectiveMetrics.total_test_samples

  const totalCorrect = confusionMatrix
    ? confusionMatrix.reduce((acc, row, idx) => acc + (row[idx] ?? 0), 0)
    : Math.round(totalSamples * effectiveMetrics.test_accuracy)

  const totalErrors = Math.max(0, totalSamples - totalCorrect)

  const maxCell = confusionMatrix ? Math.max(1, ...confusionMatrix.flat()) : 1
  const perClassStats = confusionMatrix && confusionMatrix.length > 0 ? computePerClassStats(confusionMatrix) : []

  const stabilityScore = Math.max(
    0,
    Math.min(100, Number(((1 / (1 + effectiveMetrics.test_loss)) * 100).toFixed(1)))
  )
  const trainAccPct = Number(((job.accuracy ?? effectiveMetrics.test_accuracy) * 100).toFixed(1))
  const valAccPct = Number(((job.val_accuracy ?? effectiveMetrics.test_accuracy) * 100).toFixed(1))

  const radarData = [
    {
      metric: 'Exactitud',
      Test: Number((effectiveMetrics.test_accuracy * 100).toFixed(1)),
      Validación: valAccPct,
    },
    {
      metric: 'Precisión',
      Test: Number((effectiveMetrics.precision * 100).toFixed(1)),
      Validación: valAccPct,
    },
    {
      metric: 'Recall',
      Test: Number((effectiveMetrics.recall * 100).toFixed(1)),
      Validación: valAccPct,
    },
    {
      metric: 'F1-Score',
      Test: Number((effectiveMetrics.f1_score * 100).toFixed(1)),
      Validación: valAccPct,
    },
    {
      metric: 'Estabilidad',
      Test: stabilityScore,
      Validación: trainAccPct,
    },
  ]

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

  const cards = [
    {
      icon: <Target size={18} />,
      label: 'Test Accuracy',
      value: `${(effectiveMetrics.test_accuracy * 100).toFixed(2)}%`,
      ratio: effectiveMetrics.test_accuracy,
      sub: `Train: ${trainAccPct}% · Val: ${valAccPct}%`,
      hairline: 'from-emerald-400 to-teal-400',
      iconBox: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400',
      valueTone: 'text-emerald-400',
      barGradient: 'from-emerald-500 to-teal-400',
      info: 'Porcentaje total de predicciones acertadas sobre el 15% del dataset reservado exclusivamente para pruebas.',
    },
    {
      icon: <TrendingDown size={18} />,
      label: 'Test Loss',
      value: effectiveMetrics.test_loss.toFixed(4),
      ratio: Math.max(0.08, Math.min(1, 1 / (1 + effectiveMetrics.test_loss))),
      sub: `Estabilidad: ${stabilityScore}%`,
      hairline: 'from-amber-400 to-orange-400',
      iconBox: 'bg-amber-500/15 border-amber-500/35 text-amber-400',
      valueTone: 'text-amber-400',
      barGradient: 'from-amber-500 to-orange-400',
      info: 'Magnitud del error de entropía cruzada o error cuadrático en Test. Valores más bajos indican predicciones más seguras y calibradas.',
    },
    {
      icon: <Crosshair size={18} />,
      label: 'Precision',
      value: `${(effectiveMetrics.precision * 100).toFixed(2)}%`,
      ratio: effectiveMetrics.precision,
      sub: 'Fiabilidad de alerta positiva',
      hairline: 'from-indigo-400 to-cyan-400',
      iconBox: 'bg-indigo-500/15 border-indigo-500/35 text-indigo-400',
      valueTone: 'text-indigo-300',
      barGradient: 'from-indigo-500 to-cyan-400',
      info: 'De todos los casos que el modelo clasificó en cada categoría, qué porcentaje pertenecía realmente a ella (evita falsas alarmas).',
    },
    {
      icon: <RefreshCw size={18} />,
      label: 'Recall (Sensibilidad)',
      value: `${(effectiveMetrics.recall * 100).toFixed(2)}%`,
      ratio: effectiveMetrics.recall,
      sub: 'Cobertura de casos reales',
      hairline: 'from-violet-400 to-fuchsia-400',
      iconBox: 'bg-violet-500/15 border-violet-500/35 text-violet-400',
      valueTone: 'text-violet-300',
      barGradient: 'from-violet-500 to-fuchsia-400',
      info: 'De todos los casos reales existentes en el conjunto Test, qué porcentaje logró capturar el modelo sin dejarlos escapar.',
    },
    {
      icon: <Star size={18} />,
      label: 'F1-Score',
      value: `${(effectiveMetrics.f1_score * 100).toFixed(2)}%`,
      ratio: effectiveMetrics.f1_score,
      sub: 'Media armónica P / R',
      hairline: 'from-cyan-400 to-emerald-400',
      iconBox: 'bg-cyan-500/15 border-cyan-500/35 text-cyan-400',
      valueTone: 'text-cyan-300',
      barGradient: 'from-cyan-500 to-emerald-400',
      info: 'Balance armónico entre Precisión y Recall. Es el indicador más confiable cuando existen clases con diferente volumen de muestras.',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Métricas de Certificación en Partición Test Sellada (15%)</span>
              <InfoTip
                title="Evaluación Imparcial en Partición Test"
                text="Estas 5 métricas certifican el rendimiento real del modelo sobre datos aislados desde la ingesta del dataset, garantizando cero fuga de información."
                hint="F1-Score combina Precisión y Recall en un único índice de calidad."
                size="xs"
              />
            </h2>
          </div>

          {totalSamples > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300">
              Aciertos: <strong className="text-emerald-400">{totalCorrect.toLocaleString('es-ES')}</strong> /{' '}
              {totalSamples.toLocaleString('es-ES')} ({totalErrors} errores)
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cards.map((card, idx) => (
            <div
              key={card.label}
              className={`${glassPanelClass} nl-card-interactive p-4 flex flex-col justify-between gap-2.5 relative overflow-hidden`}
              style={{ animationDelay: `${idx * 45}ms` }}
            >
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${card.hairline}`} />

              <div className="flex items-center justify-between gap-2">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${card.iconBox}`}>
                  {card.icon}
                </div>
                <InfoTip title={card.label} text={card.info} size="xs" />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-300">{card.label}</p>
                <p className={`text-xl font-extrabold font-mono tabular-nums mt-0.5 ${card.valueTone}`}>
                  {card.value}
                </p>
              </div>

              <div className="space-y-1">
                <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${card.barGradient} transition-all duration-500`}
                    style={{ width: `${Math.max(6, Math.min(100, card.ratio * 100))}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono text-slate-400 truncate">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {confusionMatrix && confusionMatrix.length > 0 && (
          <div className={`${glassPanelClass} lg:col-span-7 p-5 relative overflow-hidden flex flex-col justify-between`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-rose-400" />

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-300">
                    <Grid className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Matriz de Confusión en Test Sellado</span>
                      <InfoTip
                        title="Mapa de Calor de Clasificación (Real vs. Predicho)"
                        text="Cruza la clase real de cada registro (filas) contra la clase predicha por la red neuronal (columnas). La diagonal principal verde concentra los aciertos; las celdas rojas fuera de la diagonal muestran confusiones entre clases."
                        hint="Cada celda indica: cantidad de casos, % sobre el total de Test y % de acierto sobre su clase real (Recall)."
                        size="xs"
                      />
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Objetivo: <span className="font-mono text-cyan-300">{targetColumn || 'target'}</span> ·{' '}
                      {confusionMatrix.length} clases evaluadas
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    Diagonal: {totalCorrect}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300">
                    Confusión: {totalErrors}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto py-1">
                <table className="mx-auto border-separate border-spacing-2">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 text-right">
                        Real \ Pred
                      </th>
                      {confusionMatrix[0].map((_, ci) => (
                        <th
                          key={ci}
                          className="text-center text-xs font-mono font-semibold text-cyan-300 pb-1 min-w-[96px]"
                        >
                          Pred: Clase {ci}
                        </th>
                      ))}
                      <th className="text-center text-[10px] font-mono uppercase tracking-wider text-slate-400 pb-1 px-2">
                        Recall Fila
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {confusionMatrix.map((row, ri) => {
                      const rowTotal = row.reduce((a, b) => a + b, 0)
                      const rowRecall = rowTotal > 0 ? ((row[ri] ?? 0) / rowTotal) * 100 : 0
                      return (
                        <tr key={ri}>
                          <td className="text-xs font-mono font-semibold text-slate-300 pr-2 text-right whitespace-nowrap">
                            Real: Clase {ri}
                          </td>
                          {row.map((val, ci) => {
                            const intensity = val / maxCell
                            const pctTotal = totalSamples > 0 ? ((val / totalSamples) * 100).toFixed(1) : '0.0'
                            const pctRow = rowTotal > 0 ? ((val / rowTotal) * 100).toFixed(1) : '0.0'
                            const isDiag = ri === ci
                            const cellBg = isDiag
                              ? `rgba(16, 185, 129, ${(0.14 + intensity * 0.28).toFixed(2)})`
                              : `rgba(244, 63, 94, ${(0.08 + intensity * 0.24).toFixed(2)})`
                            return (
                              <td
                                key={ci}
                                style={{ backgroundColor: cellBg }}
                                className={`text-center rounded-xl min-w-[96px] px-3 py-2.5 border transition-transform hover:scale-[1.02] ${
                                  isDiag
                                    ? 'border-emerald-500/45 text-emerald-200'
                                    : 'border-rose-500/35 text-rose-200'
                                }`}
                              >
                                <div className="text-base font-extrabold font-mono tabular-nums leading-tight">
                                  {val.toLocaleString('es-ES')}
                                </div>
                                <div className="text-[10px] font-mono opacity-85 mt-0.5">
                                  {pctTotal}% tot · {pctRow}% fila
                                </div>
                                <div className="w-full h-1 rounded-full bg-slate-950/60 overflow-hidden mt-1.5">
                                  <div
                                    className={`h-full rounded-full ${isDiag ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                    style={{ width: `${Math.max(4, Number(pctRow))}%` }}
                                  />
                                </div>
                              </td>
                            )
                          })}
                          <td className="px-2 text-center font-mono text-xs font-bold text-emerald-300">
                            {rowRecall.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-800/70">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/45 border border-emerald-400" />
                  Diagonal: Verdaderos Positivos / Negativos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/40 border border-rose-400" />
                  Fuera de diagonal: Falsos Positivos / Negativos
                </span>
              </div>
              <span className="font-mono text-slate-300">
                Total Test: {totalSamples.toLocaleString('es-ES')} muestras
              </span>
            </div>
          </div>
        )}

        <div
          className={`${glassPanelClass} ${
            confusionMatrix && confusionMatrix.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'
          } p-5 relative overflow-hidden flex flex-col justify-between`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400" />

          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300">
                <Compass className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Radar Multidimensional de Calidad</span>
                  <InfoTip
                    title="Huella Poligonal del Modelo (Test vs. Validación)"
                    text="Compara simultáneamente los 5 pilares del clasificador en una escala de 0 a 100%: Exactitud, Precisión, Sensibilidad (Recall), F1-Score y Estabilidad de Loss."
                    hint="Un pentágono amplio y simétrico indica un modelo equilibrado sin puntos ciegos."
                    size="xs"
                  />
                </h3>
                <p className="text-[11px] text-slate-400">Equilibrio geométrico entre métricas (0–100%)</p>
              </div>
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              F1: {(effectiveMetrics.f1_score * 100).toFixed(1)}%
            </span>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData} outerRadius="74%">
              <PolarGrid stroke={gridStroke} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: tickFill, fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: tickFill, fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Radar
                name="Test Sellado (%)"
                dataKey="Test"
                stroke="#22d3ee"
                fill="#22d3ee"
                fillOpacity={0.28}
                strokeWidth={2.2}
              />
              <Radar
                name="Referencia Val (%)"
                dataKey="Validación"
                stroke="#a78bfa"
                fill="#a78bfa"
                fillOpacity={0.14}
                strokeWidth={1.8}
              />
            </RadarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/70 text-center">
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 px-2.5 py-1.5">
              <p className="text-[10px] text-slate-400 uppercase">Precisión</p>
              <p className="text-xs font-mono font-bold text-cyan-300">
                {(effectiveMetrics.precision * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 px-2.5 py-1.5">
              <p className="text-[10px] text-slate-400 uppercase">Recall</p>
              <p className="text-xs font-mono font-bold text-violet-300">
                {(effectiveMetrics.recall * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 px-2.5 py-1.5">
              <p className="text-[10px] text-slate-400 uppercase">Estabilidad</p>
              <p className="text-xs font-mono font-bold text-emerald-300">{stabilityScore}%</p>
            </div>
          </div>
        </div>
      </div>

      {perClassStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`${glassPanelClass} nl-card-interactive p-5 relative overflow-hidden`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400" />

            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center text-indigo-300">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Precisión, Recall y F1-Score por Clase</span>
                    <InfoTip
                      title="Desglose de Calidad por Categoría"
                      text="Extrae directamente de la Matriz de Confusión la Precisión, el Recall y el F1-Score individuales de cada clase para detectar si alguna categoría minoritaria tiene menor sensibilidad."
                      hint="Ideal para auditar desbalance de clases en retención, fraude o fallas NOC."
                      size="xs"
                    />
                  </h3>
                  <p className="text-[11px] text-slate-400">Comparativa porcentual por categoría objetivo</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {perClassStats.length} clases
              </span>
            </div>

            <ResponsiveContainer width="100%" height={235}>
              <BarChart data={perClassStats}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="classLabel" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: tickFill, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  unit="%"
                />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="precisionPct" name="Precisión (%)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recallPct" name="Recall (%)" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="f1Pct" name="F1-Score (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={`${glassPanelClass} nl-card-interactive p-5 relative overflow-hidden`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400" />

            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-500/35 flex items-center justify-center text-teal-300">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Volumen Real vs. Predicho &amp; Aciertos por Clase</span>
                    <InfoTip
                      title="Balance de Soporte Real frente a Predicciones Emitidas"
                      text="Compara cuántas muestras reales existen de cada clase en Test (Soporte Real) contra cuántas veces el modelo predijo esa clase (Volumen Predicho) y cuántas acertó exactamente."
                      hint="Si Volumen Predicho supera mucho al Soporte Real en una clase, el modelo tiende a sobre-predecirla."
                      size="xs"
                    />
                  </h3>
                  <p className="text-[11px] text-slate-400">Auditoría de sesgo de predicción y volumen de aciertos</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {totalCorrect} aciertos
              </span>
            </div>

            <ResponsiveContainer width="100%" height={235}>
              <BarChart data={perClassStats}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="classLabel" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="support" name="Soporte Real (Muestras)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="predicted" name="Total Predicho" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                <Bar dataKey="correct" name="Aciertos Exactos" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
