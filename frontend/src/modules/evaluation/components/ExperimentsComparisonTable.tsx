import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Award, BarChart2, Eye, Layers } from 'lucide-react'
import type { TrainingJob } from '../../../types/index'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import { PaginationBar } from '../../../components/PaginationBar'
import { useTheme } from '../../../context/ThemeContext'

interface ExperimentsComparisonTableProps {
  completedJobs: TrainingJob[]
  selectedJobId?: string | null
  onSelectJob?: (jobId: string) => void
  glassPanelClass: string
}

const COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'arch_name', label: 'Arquitectura' },
  { key: 'total_epochs', label: 'Épocas' },
  { key: 'loss', label: 'Train Loss' },
  { key: 'accuracy', label: 'Train Acc' },
  { key: 'val_accuracy', label: 'Val Acc' },
  { key: 'test_accuracy', label: 'Test Accuracy' },
  { key: 'f1', label: 'F1-Score' },
  { key: 'created_at', label: 'Fecha' },
  { key: 'action', label: 'Inspeccionar' },
]

export function ExperimentsComparisonTable({
  completedJobs,
  selectedJobId,
  onSelectJob,
  glassPanelClass,
}: ExperimentsComparisonTableProps) {
  const { mode } = useTheme()
  const isLight = mode === 'light'

  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)

  const handleSort = (col: string) => {
    if (col === 'action') return
    setCurrentPage(1)
    if (sortBy === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const getTestAcc = (job: TrainingJob) =>
    job.model_version?.test_metrics?.test_accuracy ?? job.val_accuracy ?? job.accuracy ?? 0

  const getF1 = (job: TrainingJob) =>
    job.model_version?.test_metrics?.f1_score ?? job.val_accuracy ?? job.accuracy ?? 0

  const sortedJobs = [...completedJobs].sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (sortBy === 'created_at') {
      av = a.created_at
      bv = b.created_at
    } else if (sortBy === 'id') {
      av = a.id
      bv = b.id
    } else if (sortBy === 'arch_name') {
      av = a.arch_name ?? ''
      bv = b.arch_name ?? ''
    } else if (sortBy === 'total_epochs') {
      av = a.total_epochs
      bv = b.total_epochs
    } else if (sortBy === 'loss') {
      av = a.loss ?? 0
      bv = b.loss ?? 0
    } else if (sortBy === 'accuracy') {
      av = a.accuracy ?? 0
      bv = b.accuracy ?? 0
    } else if (sortBy === 'val_accuracy') {
      av = a.val_accuracy ?? 0
      bv = b.val_accuracy ?? 0
    } else if (sortBy === 'test_accuracy') {
      av = getTestAcc(a)
      bv = getTestAcc(b)
    } else if (sortBy === 'f1') {
      av = getF1(a)
      bv = getF1(b)
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const bestTestAcc = Math.max(...completedJobs.map(j => getTestAcc(j)), 0)
  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedJobs = sortedJobs.slice((safePage - 1) * pageSize, safePage * pageSize)

  const chartData = completedJobs.slice(0, 10).map((job, idx) => ({
    name: `#${completedJobs.length - idx} ${(job.arch_name || job.id).slice(0, 12)}`,
    trainAcc: Number(((job.accuracy ?? 0) * 100).toFixed(2)),
    valAcc: Number(((job.val_accuracy ?? job.accuracy ?? 0) * 100).toFixed(2)),
    testAcc: Number((getTestAcc(job) * 100).toFixed(2)),
    f1Pct: Number((getF1(job) * 100).toFixed(2)),
  }))

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
          <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/35 flex items-center justify-center text-violet-300">
            <Award className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Benchmark &amp; Comparación de Experimentos</span>
            <InfoTip
              title="Benchmarking Multi-Corrida"
              text="Compara lado a lado todas las corridas completadas del proyecto en Entrenamiento (70%), Validación (15%) y Test Sellado (15%) para elegir la versión campeona."
              hint="Haz clic en cualquier encabezado de columna para ordenar o pulsa el botón de inspección para cargar sus gráficas arriba."
              size="xs"
            />
          </h2>
        </div>

        {bestTestAcc > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-xs font-mono font-semibold text-emerald-300">
            Récord Test: {(bestTestAcc * 100).toFixed(2)}%
          </span>
        )}
      </div>

      <div className={`${glassPanelClass} p-5 relative overflow-hidden`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400" />
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300">
              <BarChart2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Comparativa Gráfica Train vs. Val vs. Test &amp; F1 (%)</span>
                <InfoTip
                  title="Gráfico Comparativo de Corridas"
                  text="Contrasta para cada experimento su exactitud en Entrenamiento, Validación, Test Sellado y su F1-Score. El mejor modelo es aquel con barras altas y parejas en las cuatro métricas."
                  size="xs"
                />
              </h3>
              <p className="text-[11px] text-slate-400">Rendimiento comparativo entre experimentos del área</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-300">
            {completedJobs.length} {completedJobs.length === 1 ? 'experimento' : 'experimentos'}
          </span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
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
            <Bar dataKey="trainAcc" name="Train Acc (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="valAcc" name="Val Acc (%)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="testAcc" name="Test Acc (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="f1Pct" name="F1-Score (%)" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={`${glassPanelClass} overflow-hidden relative`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/75 via-violet-400/70 to-emerald-400/75" />

        <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Tabla de Ranking de Experimentos</span>
              <InfoTip
                title="Ranking Ordenable de Modelos"
                text="Lista todas las corridas finalizadas con sus métricas de entrenamiento, validación y test sellado. La fila marcada como «Mejor» lidera en Test Accuracy."
                size="xs"
              />
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">{sortedJobs.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-800/80 bg-slate-900/60">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-semibold select-none whitespace-nowrap ${
                      col.key !== 'action' ? 'cursor-pointer hover:text-slate-200' : ''
                    }`}
                  >
                    {col.label}
                    {sortBy === col.key && <span className="ml-1 text-cyan-400">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedJobs.map(job => {
                const tAcc = getTestAcc(job)
                const f1 = getF1(job)
                const isBest = tAcc === bestTestAcc && bestTestAcc > 0
                const isSelected = selectedJobId === job.id
                return (
                  <tr
                    key={job.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isBest
                        ? 'bg-emerald-500/8 shadow-[inset_3px_0_0_rgba(52,211,153,0.85)]'
                        : isSelected
                          ? 'bg-cyan-500/8 shadow-[inset_3px_0_0_rgba(34,211,238,0.75)]'
                          : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800">
                        {job.id.slice(0, 10)}…
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{job.arch_name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-300">{job.total_epochs}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-amber-300">
                      {job.loss?.toFixed(4) ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-indigo-300">
                      {job.accuracy != null ? `${(job.accuracy * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-sky-300">
                      {job.val_accuracy != null ? `${(job.val_accuracy * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold font-mono tabular-nums ${
                        isBest ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      <div className="inline-flex items-center gap-2">
                        <span>{tAcc > 0 ? `${(tAcc * 100).toFixed(2)}%` : '—'}</span>
                        {isBest && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                            Mejor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-300">
                      {f1 > 0 ? `${(f1 * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(job.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3">
                      {onSelectJob && (
                        <SystemTooltip label="Cargar gráficas y matriz de esta corrida" side="top">
                          <button
                            type="button"
                            onClick={() => onSelectJob(job.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                              isSelected
                                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                                : 'border-slate-700 bg-slate-900/70 hover:border-cyan-500/40 text-slate-300 hover:text-white'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isSelected ? 'Activa' : 'Ver'}</span>
                          </button>
                        </SystemTooltip>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="nl-cyber-panel rounded-2xl overflow-hidden mt-auto">
        <PaginationBar
          currentPage={safePage}
          totalItems={sortedJobs.length}
          pageSize={pageSize}
          pageSizeOptions={[5, 8, 15, 30]}
          onPageChange={setCurrentPage}
          onPageSizeChange={size => {
            setPageSize(size)
            setCurrentPage(1)
          }}
          itemLabel="experimentos"
        />
      </div>
    </div>
  )
}
