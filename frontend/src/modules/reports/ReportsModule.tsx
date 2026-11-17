import { useEffect, useState } from 'react'
import {
  FileText, Download, Table, Loader2, FileJson, Printer, Copy, CheckCircle2
} from 'lucide-react'
import { api } from '../../services/api'
import { generateProjectPdfReport } from '../../services/pdf'
import type {
  Project, Dataset, Architecture, TrainingJob, ModelVersion, AuditEvent, EpochMetric
} from '../../types/index'
import { SystemTooltip } from '../../components/InfoTip'
import type { SectionKey } from './types'
import {
  computeExecutiveDiagnostic,
  buildMarkdownSummary,
  downloadJsonFile,
  downloadCsvFile,
} from './helpers'
import { ReportKpiStrip } from './components/ReportKpiStrip'
import { ReportBuilderSidebar } from './components/ReportBuilderSidebar'
import { ReportDetailSections } from './components/ReportDetailSections'
import { AuditLogSection } from './components/AuditLogSection'
import { useToast } from '../../components/toast/ToastContext'

export default function ReportsModule({ currentProject }: { currentProject: any }) {
  const toast = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [architectures, setArchitectures] = useState<Architecture[]>([])
  const [jobs, setJobs] = useState<TrainingJob[]>([])
  const [models, setModels] = useState<ModelVersion[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [metricsState, setMetricsState] = useState<{ jobId: string; items: EpochMetric[] }>({ jobId: '', items: [] })
  const [loadedProjectId, setLoadedProjectId] = useState<string>('')
  const [loadingReport, setLoadingReport] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [comparisonJobId, setComparisonJobId] = useState<string>('')
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [auditorNotes, setAuditorNotes] = useState<string>('')
  const [selectedSections, setSelectedSections] = useState<Record<SectionKey, boolean>>({
    projectContext: true,
    datasetEda: true,
    networkArch: true,
    trainingMetrics: true,
    modelRegistry: true,
    auditTrail: true,
  })

  useEffect(() => {
    if (!currentProject) return
    let active = true
    const projectId = currentProject.id
    Promise.all([
      api.getProject(projectId).catch(() => null),
      api.getProjectDatasets(projectId).catch(() => []),
      api.getProjectArchitectures(projectId).catch(() => []),
      api.getProjectJobs(projectId).catch(() => []),
      api.getProjectModels(projectId).catch(() => []),
      api.getAuditEvents(projectId, 60).catch(() => []),
    ]).then(([proj, ds, archs, jbs, mds, evts]) => {
      if (!active) return
      setProject(proj)
      setDatasets(ds)
      setArchitectures(archs)
      setJobs(jbs)
      setModels(mds)
      setAuditEvents(evts)
      setSelectedJobId('')
      setComparisonJobId('')
      setSelectedModelId('')
      setLoadedProjectId(projectId)
    })
    return () => { active = false }
  }, [currentProject])

  const loading = Boolean(currentProject && loadedProjectId !== currentProject.id)

  const modelScore = (m: ModelVersion) => m.test_metrics?.test_accuracy ?? 0
  const jobScore = (j: TrainingJob) => j.model_version?.test_metrics?.test_accuracy ?? j.accuracy ?? 0

  const bestJob = (() => {
    if (selectedJobId) {
      const explicit = jobs.find(j => j.id === selectedJobId)
      if (explicit) return explicit
    }
    const completed = jobs.filter(j => j.status === 'COMPLETED')
    if (completed.length > 0) {
      return [...completed].sort((a, b) => jobScore(b) - jobScore(a))[0]
    }
    return jobs[0] || null
  })()

  const comparisonJob = (() => {
    if (comparisonJobId) {
      return jobs.find(j => j.id === comparisonJobId) || null
    }
    const others = jobs.filter(j => j.status === 'COMPLETED' && j.id !== bestJob?.id)
    return others[0] || null
  })()

  const resolvedModel = (() => {
    if (selectedModelId) {
      const explicit = models.find(m => m.id === selectedModelId)
      if (explicit) return explicit
    }
    if (bestJob) {
      const linked = models.find(m => m.job_id === bestJob.id)
      if (linked) return linked
    }
    const approved = models
      .filter(m => m.status === 'Aprobado' || m.status === 'APPROVED')
      .sort((a, b) => modelScore(b) - modelScore(a))[0]
    return approved || [...models].sort((a, b) => modelScore(b) - modelScore(a))[0] || null
  })()

  const primaryDataset = (bestJob?.dataset_id ? datasets.find(d => d.id === bestJob.dataset_id) : undefined) || datasets[0] || null
  const primaryArch = (bestJob?.architecture_id ? architectures.find(a => a.id === bestJob.architecture_id) : undefined) || architectures[0] || null
  const resolvedMetrics = bestJob?.model_version?.test_metrics ?? resolvedModel?.test_metrics ?? null

  useEffect(() => {
    if (!bestJob?.id) return
    let active = true
    const jobId = bestJob.id
    api.getJobMetrics(jobId)
      .then(data => { if (active) setMetricsState({ jobId, items: data }) })
      .catch(() => { if (active) setMetricsState({ jobId, items: [] }) })
    return () => { active = false }
  }, [bestJob?.id])

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
        <FileText size={56} className="opacity-30" />
        <p className="text-lg">Selecciona un proyecto para generar reportes ejecutivos</p>
      </div>
    )
  }

  const epochMetrics = bestJob?.id && metricsState.jobId === bestJob.id ? metricsState.items : []
  const displayAcc = resolvedMetrics?.test_accuracy ?? bestJob?.accuracy ?? null
  const displayLoss = resolvedMetrics?.test_loss ?? bestJob?.loss ?? null
  const diagnostic = computeExecutiveDiagnostic(resolvedMetrics, bestJob, epochMetrics)
  const activeSectionsCount = Object.values(selectedSections).filter(Boolean).length

  const toggleSection = (key: SectionKey) => {
    setSelectedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const setAllSections = (enabled: boolean) => {
    setSelectedSections({
      projectContext: enabled,
      datasetEda: enabled,
      networkArch: enabled,
      trainingMetrics: enabled,
      modelRegistry: enabled,
      auditTrail: enabled,
    })
  }

  const copyValue = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1800)
    toast.success('Copiado al portapapeles', key === 'markdown-summary' ? 'Resumen ejecutivo en Markdown' : undefined)
  }

  const handleGeneratePdf = async () => {
    if (!project) return
    setLoadingReport(true)
    try {
      generateProjectPdfReport(
        project,
        primaryDataset || undefined,
        primaryArch || undefined,
        resolvedModel || undefined,
        bestJob || undefined,
        {
          sections: selectedSections,
          auditEvents,
          epochMetrics,
          diagnostic,
          auditorNotes,
          comparisonJob,
        }
      )
      toast.success('Reporte PDF generado', `Certificación de ${project.name}`)
    } catch (e: unknown) {
      toast.error('Error al generar PDF', e instanceof Error ? e.message : 'No se pudo exportar el PDF')
    } finally {
      setLoadingReport(false)
    }
  }

  const handleExportCsv = async () => {
    const targetJob = bestJob || jobs[0]
    if (!targetJob) return
    setExportingCsv(true)
    try {
      const metrics = epochMetrics.length > 0 ? epochMetrics : await api.getJobMetrics(targetJob.id)
      const safeName = (project?.name || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')
      downloadCsvFile(`metricas_${safeName}.csv`, metrics, auditEvents)
      toast.success('Métricas exportadas en CSV', `Archivo metricas_${safeName}.csv`)
    } catch (e: unknown) {
      toast.error('Error al exportar CSV', e instanceof Error ? e.message : 'No se pudieron descargar las métricas')
    } finally {
      setExportingCsv(false)
    }
  }

  const handleExportJson = () => {
    if (!project) return
    const safeName = (project.name || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')
    downloadJsonFile(`certificacion_${safeName}.json`, {
      generated_at: new Date().toISOString(),
      diagnostic,
      auditor_notes: auditorNotes || undefined,
      project: selectedSections.projectContext ? project : undefined,
      dataset: selectedSections.datasetEda ? primaryDataset : undefined,
      architecture: selectedSections.networkArch ? primaryArch : undefined,
      training_job: selectedSections.trainingMetrics ? bestJob : undefined,
      comparison_job: selectedSections.trainingMetrics ? comparisonJob : undefined,
      model_registry: selectedSections.modelRegistry ? resolvedModel : undefined,
      audit_events: selectedSections.auditTrail ? auditEvents : undefined,
    })
    toast.success('Certificación exportada en JSON', `Archivo certificacion_${safeName}.json`)
  }

  const handleCopyMarkdown = () => {
    if (!project) return
    const md = buildMarkdownSummary({
      project,
      dataset: primaryDataset,
      architecture: primaryArch,
      job: bestJob,
      model: resolvedModel,
      metrics: resolvedMetrics,
      diagnostic,
      auditorNotes,
      sections: selectedSections,
    })
    copyValue('markdown-summary', md)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2 nl-no-print">
        <SystemTooltip label="Copiar resumen ejecutivo formateado en Markdown" side="bottom">
            <button
              onClick={handleCopyMarkdown}
              disabled={!project}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-950 text-slate-200 border border-slate-800 hover:bg-slate-800 disabled:opacity-45 transition-all"
            >
              {copiedKey === 'markdown-summary' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{copiedKey === 'markdown-summary' ? 'Markdown Copiado' : 'Copiar Resumen'}</span>
            </button>
          </SystemTooltip>

          <SystemTooltip label="Descargar paquete JSON auditable con secciones y SHA-256" side="bottom">
            <button
              onClick={handleExportJson}
              disabled={!project || activeSectionsCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-950 text-slate-200 border border-slate-800 hover:bg-slate-800 disabled:opacity-45 transition-all"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-400" />
              <span>Exportar JSON</span>
            </button>
          </SystemTooltip>

          <SystemTooltip label="Descargar tabla época por época de Loss y Accuracy en CSV" side="bottom">
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv || jobs.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-950 text-slate-200 border border-slate-800 hover:bg-slate-800 disabled:opacity-45 transition-all"
            >
              {exportingCsv ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <Table className="w-3.5 h-3.5 text-cyan-400" />}
              <span>CSV Métricas</span>
            </button>
          </SystemTooltip>

          <SystemTooltip label="Abrir diálogo de impresión optimizado para informe" side="bottom">
            <button
              onClick={() => window.print()}
              disabled={!project}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-950 text-slate-200 border border-slate-800 hover:bg-slate-800 disabled:opacity-45 transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Imprimir</span>
            </button>
          </SystemTooltip>

          <SystemTooltip label={`Compilar reporte ejecutivo PDF con ${activeSectionsCount} sección(es) activas`} side="bottom">
            <button
              onClick={handleGeneratePdf}
              disabled={loadingReport || !project || activeSectionsCount === 0}
              className="nl-btn-shimmer nl-accent-bg flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-45 transition-all shadow-lg"
            >
              {loadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Generar PDF Ejecutivo</span>
              <span className="px-1.5 py-0.5 rounded-md bg-black/25 font-mono text-[10px]">{activeSectionsCount}/6</span>
            </button>
          </SystemTooltip>
      </div>

      <ReportKpiStrip
        loading={loading}
        displayAcc={displayAcc}
        displayLoss={displayLoss}
        resolvedMetrics={resolvedMetrics}
        primaryDataset={primaryDataset}
        primaryArch={primaryArch}
        resolvedModel={resolvedModel}
        modelsCount={models.length}
        copiedKey={copiedKey}
        onCopy={copyValue}
        diagnostic={diagnostic}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <ReportBuilderSidebar
          selectedSections={selectedSections}
          onToggleSection={toggleSection}
          onSelectAll={() => setAllSections(true)}
          onSelectPresetSummary={() => setSelectedSections({
            projectContext: true,
            datasetEda: false,
            networkArch: false,
            trainingMetrics: true,
            modelRegistry: true,
            auditTrail: false,
          })}
          jobs={jobs}
          models={models}
          activeJob={bestJob}
          comparisonJob={comparisonJob}
          resolvedModel={resolvedModel}
          onChangeJobId={setSelectedJobId}
          onChangeComparisonJobId={setComparisonJobId}
          onChangeModelId={setSelectedModelId}
        />

        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {activeSectionsCount === 0 && (
            <div className="nl-surface rounded-2xl p-10 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-500 mx-auto opacity-60" />
              <p className="text-white font-bold text-sm">Ninguna sección seleccionada</p>
              <p className="text-slate-400 text-xs">Activa al menos una sección en el Constructor del Informe para previsualizar y exportar el PDF.</p>
              <button
                onClick={() => setAllSections(true)}
                className="nl-accent-bg px-4 py-2 rounded-xl text-xs font-bold"
              >
                Activar todas las secciones
              </button>
            </div>
          )}

          <ReportDetailSections
            selectedSections={selectedSections}
            project={project}
            currentProject={currentProject}
            primaryDataset={primaryDataset}
            primaryArch={primaryArch}
            activeJob={bestJob}
            comparisonJob={comparisonJob}
            resolvedModel={resolvedModel}
            resolvedMetrics={resolvedMetrics}
            epochMetrics={epochMetrics}
            jobsCount={jobs.length}
            modelsCount={models.length}
            displayAcc={displayAcc}
            displayLoss={displayLoss}
            copiedKey={copiedKey}
            onCopy={copyValue}
            diagnostic={diagnostic}
            auditorNotes={auditorNotes}
            onAuditorNotesChange={setAuditorNotes}
          />

          {selectedSections.auditTrail && (
            <AuditLogSection auditEvents={auditEvents} />
          )}
        </div>
      </div>
    </div>
  )
}
