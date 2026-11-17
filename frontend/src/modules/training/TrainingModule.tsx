import { useState, useEffect, useRef } from 'react'
import { Play, Zap, RefreshCw } from 'lucide-react'
import { api } from '../../services/api'
import { Dataset, Architecture, TrainingJob } from '../../types'
import { TrainingWizard } from './components/TrainingWizard'
import { LiveMonitorPanel, type LiveTrainingMetrics } from './components/LiveMonitorPanel'
import { TrainingHistoryTable } from './components/TrainingHistoryTable'
import { useToast } from '../../components/toast/ToastContext'

export default function TrainingModule({ currentProject }: { currentProject: any }) {
  const { success: notifySuccess, error: notifyError, warning: notifyWarning, info: notifyInfo } = useToast()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [architectures, setArchitectures] = useState<Architecture[]>([])
  const [jobs, setJobs] = useState<TrainingJob[]>([])
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [selectedArch, setSelectedArch] = useState<Architecture | null>(null)
  const [epochs, setEpochs] = useState(20)
  const [batchSize, setBatchSize] = useState(32)
  const [optimizer, setOptimizer] = useState('adam')
  const [learningRate, setLearningRate] = useState(0.001)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [monitorJobId, setMonitorJobId] = useState<string | null>(null)
  const [liveLog, setLiveLog] = useState<string[]>([])
  const [liveMetrics, setLiveMetrics] = useState<LiveTrainingMetrics | null>(null)
  const [liveProgress, setLiveProgress] = useState(0)
  const [liveStatus, setLiveStatus] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  function connectSSE(jobId: string) {
    eventSourceRef.current?.close()
    setMonitorJobId(jobId)
    setLiveLog([])
    setLiveMetrics(null)
    setLiveProgress(0)
    const es = new EventSource(`http://localhost:8000/api/v1/training-jobs/${jobId}/events`)
    es.onmessage = e => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'epoch_end') {
          setLiveMetrics({
            epoch: data.epoch,
            loss: data.loss,
            acc: data.accuracy,
            val_loss: data.val_loss,
            val_acc: data.val_accuracy,
          })
          setLiveProgress(data.progress)
          if (data.log) setLiveLog(prev => [...prev.slice(-200), data.log])
        } else if (data.type === 'status_change') {
          setLiveStatus(data.status)
          setLiveProgress(data.progress || 0)
        } else if (data.type === 'completed' || data.type === 'failed' || data.type === 'cancelled') {
          const finalType = data.type
          setLiveStatus(data.status || finalType.toUpperCase())
          setLiveProgress(100)
          es.close()
          setTimeout(() => loadAll(), 1500)
          if (finalType === 'completed') {
            notifySuccess('Entrenamiento completado', 'Métricas de evaluación y artefacto generados')
          } else if (finalType === 'failed') {
            notifyError('Entrenamiento fallido', data.error || 'El worker reportó un error durante el entrenamiento')
          } else {
            notifyWarning('Entrenamiento cancelado', `Job ${jobId.slice(0, 8)} detenido`)
          }
        } else if (data.status) {
          setLiveStatus(data.status)
        }
      } catch {}
    }
    es.onerror = () => {
      es.close()
    }
    eventSourceRef.current = es
  }

  async function loadAll() {
    if (!currentProject) return
    setLoading(true)
    try {
      const [ds, archs, js] = await Promise.all([
        api.getProjectDatasets(currentProject.id),
        api.getProjectArchitectures(currentProject.id),
        api.getProjectJobs(currentProject.id),
      ])
      setDatasets(ds)
      setArchitectures(archs)
      setJobs(js)
      const runningJob = js.find(j => ['RUNNING', 'PREPARING', 'QUEUED'].includes(j.status))
      if (runningJob && !monitorJobId) {
        connectSSE(runningJob.id)
      }
    } catch (e: unknown) {
      notifyError('Error al cargar entrenamientos', e instanceof Error ? e.message : 'No se pudo consultar la cola de jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentProject) loadAll()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [currentProject])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [liveLog])

  async function handleStartTraining() {
    if (!currentProject || !selectedArch || !selectedDataset) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await api.createTrainingJob(currentProject.id, {
        architecture_id: selectedArch.id,
        dataset_id: selectedDataset.id,
        hyperparams: { epochs, batch_size: batchSize, optimizer, learning_rate: learningRate },
        actor_id: 'usr-engineer',
      })
      setShowWizard(false)
      setStep(1)
      setSelectedDataset(null)
      setSelectedArch(null)
      connectSSE(res.job_id)
      await loadAll()
      notifySuccess('Entrenamiento iniciado', `${selectedArch.name} · ${epochs} épocas`)
    } catch (e: any) {
      setCreateError(e.message)
      notifyError('Error al iniciar entrenamiento', e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleCancel(jobId: string) {
    setCancelling(jobId)
    try {
      await api.cancelJob(jobId)
      await loadAll()
      notifyWarning('Ejecución cancelada', `Job ${jobId.slice(0, 8)}`)
    } catch (e: unknown) {
      notifyError('No se pudo cancelar el job', e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setCancelling(null)
    }
  }

  async function handleRetry(jobId: string) {
    try {
      await api.retryJob(jobId)
      await loadAll()
      notifyInfo('Reintento encolado', `Job ${jobId.slice(0, 8)} enviado a ejecución`)
    } catch (e: unknown) {
      notifyError('No se pudo reintentar el job', e instanceof Error ? e.message : 'Error al reintentar')
    }
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Play className="w-10 h-10 text-slate-700" />
        <p className="text-slate-400 text-sm">Selecciona un proyecto primero</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={loadAll}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setShowWizard(w => !w)}
          className="nl-btn-shimmer flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium transition-all shadow-md"
        >
          <Zap className="w-4 h-4" />
          Nuevo Entrenamiento
        </button>
      </div>

      {showWizard && (
        <TrainingWizard
          step={step}
          onStepChange={setStep}
          datasets={datasets}
          architectures={architectures}
          selectedDataset={selectedDataset}
          onSelectDataset={setSelectedDataset}
          selectedArch={selectedArch}
          onSelectArch={setSelectedArch}
          epochs={epochs}
          onChangeEpochs={setEpochs}
          batchSize={batchSize}
          onChangeBatchSize={setBatchSize}
          optimizer={optimizer}
          onChangeOptimizer={setOptimizer}
          learningRate={learningRate}
          onChangeLearningRate={setLearningRate}
          creating={creating}
          createError={createError}
          onStartTraining={handleStartTraining}
        />
      )}

      {monitorJobId && (
        <LiveMonitorPanel
          monitorJobId={monitorJobId}
          liveStatus={liveStatus}
          liveProgress={liveProgress}
          liveMetrics={liveMetrics}
          liveLog={liveLog}
          logRef={logRef}
          onClose={() => {
            eventSourceRef.current?.close()
            setMonitorJobId(null)
          }}
        />
      )}

      <TrainingHistoryTable
        jobs={jobs}
        loading={loading}
        cancelling={cancelling}
        onMonitor={connectSSE}
        onCancel={handleCancel}
        onRetry={handleRetry}
      />
    </div>
  )
}
