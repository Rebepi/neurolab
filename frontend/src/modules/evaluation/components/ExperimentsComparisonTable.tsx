import { useState } from 'react'
import type { TrainingJob } from '../../../types/index'
import { PaginationBar } from '../../../components/PaginationBar'

interface ExperimentsComparisonTableProps {
  completedJobs: TrainingJob[]
  glassPanelClass: string
}

const COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'arch_name', label: 'Arquitectura' },
  { key: 'total_epochs', label: 'Épocas' },
  { key: 'loss', label: 'Loss Final' },
  { key: 'accuracy', label: 'Accuracy Final' },
  { key: 'test_accuracy', label: 'Test Accuracy' },
  { key: 'f1', label: 'F1-Score' },
  { key: 'created_at', label: 'Fecha' },
]

export function ExperimentsComparisonTable({ completedJobs, glassPanelClass }: ExperimentsComparisonTableProps) {
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)

  const handleSort = (col: string) => {
    setCurrentPage(1)
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const sortedJobs = [...completedJobs].sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (sortBy === 'created_at') { av = a.created_at; bv = b.created_at }
    else if (sortBy === 'id') { av = a.id; bv = b.id }
    else if (sortBy === 'arch_name') { av = a.arch_name ?? ''; bv = b.arch_name ?? '' }
    else if (sortBy === 'total_epochs') { av = a.total_epochs; bv = b.total_epochs }
    else if (sortBy === 'loss') { av = a.loss ?? 0; bv = b.loss ?? 0 }
    else if (sortBy === 'accuracy') { av = a.accuracy ?? 0; bv = b.accuracy ?? 0 }
    else if (sortBy === 'test_accuracy') {
      av = a.model_version?.test_metrics?.test_accuracy ?? 0
      bv = b.model_version?.test_metrics?.test_accuracy ?? 0
    } else if (sortBy === 'f1') {
      av = a.model_version?.test_metrics?.f1_score ?? 0
      bv = b.model_version?.test_metrics?.f1_score ?? 0
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const bestTestAcc = Math.max(...completedJobs.map(j => j.model_version?.test_metrics?.test_accuracy ?? 0))
  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedJobs = sortedJobs.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-200 mb-3">Comparación de Experimentos</h2>
      <div className={`${glassPanelClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-4 py-3 text-left text-slate-400 font-medium cursor-pointer hover:text-slate-200 select-none whitespace-nowrap"
                  >
                    {col.label}
                    {sortBy === col.key && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedJobs.map(job => {
              const isBest = (job.model_version?.test_metrics?.test_accuracy ?? 0) === bestTestAcc && bestTestAcc > 0
              return (
                <tr
                  key={job.id}
                  className={`border-b border-slate-800 hover:bg-slate-800/40 transition-colors ${
                    isBest ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{job.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-slate-300">{job.arch_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{job.total_epochs}</td>
                  <td className="px-4 py-3 text-amber-400">{job.loss?.toFixed(4) ?? '—'}</td>
                  <td className="px-4 py-3 text-indigo-400">
                    {job.accuracy != null ? `${(job.accuracy * 100).toFixed(2)}%` : '—'}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${isBest ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {job.model_version?.test_metrics?.test_accuracy != null
                      ? `${(job.model_version.test_metrics.test_accuracy * 100).toFixed(2)}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-cyan-400">
                    {job.model_version?.test_metrics?.f1_score != null
                      ? `${(job.model_version.test_metrics.f1_score * 100).toFixed(2)}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(job.created_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              )
            })}
            </tbody>
          </table>
        </div>
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

