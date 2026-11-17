import { useEffect, useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { api } from '../../services/api'
import type { TrainingJob, EpochMetric } from '../../types/index'
import { LearningCurvesPanel } from './components/LearningCurvesPanel'
import { TestMetricsPanel } from './components/TestMetricsPanel'
import { ExperimentsComparisonTable } from './components/ExperimentsComparisonTable'

const GLASS_PANEL = 'bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-xl'

export default function EvaluationModule({ currentProject }: { currentProject: any }) {
  const [completedJobs, setCompletedJobs] = useState<TrainingJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [metricsMap, setMetricsMap] = useState<Record<string, EpochMetric[]>>({})

  useEffect(() => {
    if (!currentProject) return
    api.getProjectJobs(currentProject.id).then(jobs => {
      const done = jobs.filter(j => j.status === 'COMPLETED')
      setCompletedJobs(done)
      if (done.length > 0) setSelectedJobId(done[0].id)
    }).catch(() => {})
  }, [currentProject])

  useEffect(() => {
    if (!selectedJobId || metricsMap[selectedJobId]) return
    api.getJobMetrics(selectedJobId).then(metrics => {
      setMetricsMap(prev => ({ ...prev, [selectedJobId]: metrics }))
    }).catch(() => {})
  }, [selectedJobId, metricsMap])

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
        <BarChart2 size={56} className="opacity-30" />
        <p className="text-lg">Selecciona un proyecto para ver evaluaciones</p>
      </div>
    )
  }

  const selectedJob = completedJobs.find(j => j.id === selectedJobId) ?? null
  const metrics = selectedJobId ? (metricsMap[selectedJobId] ?? []) : []

  return (
    <div className="flex flex-col gap-6">
      {completedJobs.length === 0 ? (
        <div className={`${GLASS_PANEL} flex flex-col items-center justify-center gap-4 py-20 text-slate-400`}>
          <BarChart2 size={48} className="opacity-30" />
          <p className="text-lg text-center">Sin evaluaciones disponibles. Completa un entrenamiento para ver resultados.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {completedJobs.map(job => (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  selectedJobId === job.id
                    ? 'border-indigo-500 text-indigo-400 border-b-2 bg-indigo-500/10'
                    : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                <span className="font-mono text-xs">{job.id.slice(0, 8)}</span>
                {job.model_version?.test_metrics?.test_accuracy != null && (
                  <span className="ml-2 text-emerald-400">
                    {(job.model_version.test_metrics.test_accuracy * 100).toFixed(1)}%
                  </span>
                )}
              </button>
            ))}
          </div>

          {selectedJob && (
            <>
              <LearningCurvesPanel metrics={metrics} glassPanelClass={GLASS_PANEL} />
              <TestMetricsPanel
                testMetrics={selectedJob.model_version?.test_metrics}
                confusionMatrix={selectedJob.model_version?.confusion_matrix}
                glassPanelClass={GLASS_PANEL}
              />
              {completedJobs.length > 1 && (
                <ExperimentsComparisonTable completedJobs={completedJobs} glassPanelClass={GLASS_PANEL} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
