import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  Copy,
  Database,
  Download,
  FileJson,
  FilePlus2,
  FileText,
  GitCompare,
  Loader2,
  Printer,
  Sliders,
  Table,
} from 'lucide-react'
import { api } from '../../services/api'
import { generateProjectPdfReport } from '../../services/pdf'
import type {
  AuditEvent,
  Architecture,
  Dataset,
  EpochMetric,
  ModelVersion,
  Project,
  TrainingJob,
} from '../../types/index'
import { DEFAULT_REPORT_CONFIG, DEFAULT_SECTION_ORDER, SECTION_META } from './constants'
import type {
  ComplianceCheckItem,
  ReportCustomizationConfig,
  ReportTemplatePreset,
  SectionKey,
} from './types'
import {
  buildDefaultComplianceChecks,
  buildMarkdownSummary,
  buildStandaloneHtmlReport,
  computeExecutiveDiagnostic,
  downloadCsvFile,
  downloadHtmlFile,
  downloadJsonFile,
} from './helpers'
import { ReportBuilderSidebar } from './components/ReportBuilderSidebar'
import {
  ReportCustomizationModal,
  type CustomizerTab,
} from './components/ReportCustomizationModal'
import {
  ReportDetailSections,
  type PreviewCategory,
} from './components/ReportDetailSections'
import { useToast } from '../../components/toast/ToastContext'
import { SystemSelect } from '../../components/SystemSelect'

const ALL_SECTIONS: Record<SectionKey, boolean> = {
  projectContext: true,
  datasetEda: true,
  featureDictionary: true,
  networkArch: true,
  trainingMetrics: true,
  epochHistory: true,
  experimentsRanking: true,
  roiImpact: true,
  modelRegistry: true,
  complianceChecklist: true,
  customSections: true,
  auditTrail: true,
}

const EXECUTIVE_SECTIONS: Record<SectionKey, boolean> = {
  projectContext: true,
  datasetEda: true,
  featureDictionary: false,
  networkArch: true,
  trainingMetrics: true,
  epochHistory: false,
  experimentsRanking: false,
  roiImpact: true,
  modelRegistry: true,
  complianceChecklist: true,
  customSections: false,
  auditTrail: false,
}

const PREVIEW_TABS: Array<{ id: PreviewCategory; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'executive', label: 'Ejecutivo' },
  { id: 'data_arch', label: 'Datos & Red' },
  { id: 'evaluation', label: 'Evaluación' },
  { id: 'governance', label: 'Gobernanza' },
]

export default function ReportsModule({ currentProject }: { currentProject: any }) {
  const toast = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [architectures, setArchitectures] = useState<Architecture[]>([])
  const [jobs, setJobs] = useState<TrainingJob[]>([])
  const [models, setModels] = useState<ModelVersion[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [metricsState, setMetricsState] = useState<{ jobId: string; items: EpochMetric[] }>({
    jobId: '',
    items: [],
  })
  const [loadedProjectId, setLoadedProjectId] = useState<string>('')
  const [loadingReport, setLoadingReport] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [comparisonJobId, setComparisonJobId] = useState<string>('')
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [auditorNotes, setAuditorNotes] = useState<string>('')

  const [config, setConfig] = useState<ReportCustomizationConfig>(DEFAULT_REPORT_CONFIG)
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [customizerTab, setCustomizerTab] = useState<CustomizerTab>('identity')
  const [activePreset, setActivePreset] = useState<ReportTemplatePreset>('executive')
  const [manualCheckOverrides, setManualCheckOverrides] = useState<Record<string, boolean>>({})
  const [customChecks, setCustomChecks] = useState<ComplianceCheckItem[]>([])
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(DEFAULT_SECTION_ORDER)
  const [selectedSections, setSelectedSections] =
    useState<Record<SectionKey, boolean>>(EXECUTIVE_SECTIONS)

  const [previewCategory, setPreviewCategory] = useState<PreviewCategory>('all')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!exportMenuOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [exportMenuOpen])

  useEffect(() => {
    if (!currentProject) return
    let active = true
    const projectId = currentProject.id

    try {
      const savedRaw = localStorage.getItem(`neurolab_report_studio_v3_${projectId}`)
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw)
        if (parsed.config) setConfig({ ...DEFAULT_REPORT_CONFIG, ...parsed.config })
        if (parsed.selectedSections) {
          setSelectedSections({ ...EXECUTIVE_SECTIONS, ...parsed.selectedSections })
        }
        if (parsed.activePreset) setActivePreset(parsed.activePreset)
        if (Array.isArray(parsed.sectionOrder) && parsed.sectionOrder.length > 0) {
          const validOrder = parsed.sectionOrder.filter((k: SectionKey) =>
            DEFAULT_SECTION_ORDER.includes(k)
          )
          const missing = DEFAULT_SECTION_ORDER.filter(k => !validOrder.includes(k))
          setSectionOrder([...validOrder, ...missing])
        }
        if (Array.isArray(parsed.customChecks)) setCustomChecks(parsed.customChecks)
        if (typeof parsed.auditorNotes === 'string') setAuditorNotes(parsed.auditorNotes)
      } else {
        setConfig(DEFAULT_REPORT_CONFIG)
        setSelectedSections(EXECUTIVE_SECTIONS)
        setActivePreset('executive')
        setSectionOrder(DEFAULT_SECTION_ORDER)
        setCustomChecks([])
        setAuditorNotes('')
      }
    } catch {
      setConfig(DEFAULT_REPORT_CONFIG)
      setSelectedSections(EXECUTIVE_SECTIONS)
      setActivePreset('executive')
      setSectionOrder(DEFAULT_SECTION_ORDER)
    }

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
      setManualCheckOverrides({})
      setLoadedProjectId(projectId)
    })
    return () => {
      active = false
    }
  }, [currentProject?.id])

  useEffect(() => {
    if (!currentProject?.id || loadedProjectId !== currentProject.id) return
    try {
      localStorage.setItem(
        `neurolab_report_studio_v3_${currentProject.id}`,
        JSON.stringify({
          config,
          selectedSections,
          activePreset,
          sectionOrder,
          customChecks,
          auditorNotes,
        })
      )
    } catch {
    }
  }, [
    currentProject?.id,
    loadedProjectId,
    config,
    selectedSections,
    activePreset,
    sectionOrder,
    customChecks,
    auditorNotes,
  ])

  const loading = Boolean(currentProject && loadedProjectId !== currentProject.id)

  const modelScore = (m: ModelVersion) => m.test_metrics?.test_accuracy ?? 0
  const jobScore = (j: TrainingJob) =>
    j.model_version?.test_metrics?.test_accuracy ?? j.accuracy ?? 0

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

  const primaryDataset =
    (bestJob?.dataset_id ? datasets.find(d => d.id === bestJob.dataset_id) : undefined) ||
    datasets[0] ||
    null
  const primaryArch =
    (bestJob?.architecture_id
      ? architectures.find(a => a.id === bestJob.architecture_id)
      : undefined) ||
    architectures[0] ||
    null
  const resolvedMetrics =
    bestJob?.model_version?.test_metrics ?? resolvedModel?.test_metrics ?? null

  useEffect(() => {
    if (!bestJob?.id) return
    let active = true
    const jobId = bestJob.id
    api
      .getJobMetrics(jobId)
      .then(data => {
        if (active) setMetricsState({ jobId, items: data })
      })
      .catch(() => {
        if (active) setMetricsState({ jobId, items: [] })
      })
    return () => {
      active = false
    }
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
  const diagnostic = computeExecutiveDiagnostic(
    resolvedMetrics,
    bestJob,
    epochMetrics,
    config.targetSlaAccuracyPct,
    config.maxAllowedOverfitGap
  )

  const baseChecks = buildDefaultComplianceChecks({
    dataset: primaryDataset,
    architecture: primaryArch,
    model: resolvedModel,
    diagnostic,
    auditEvents,
  })

  const complianceChecks: ComplianceCheckItem[] = [...baseChecks, ...customChecks].map(c => ({
    ...c,
    passed: manualCheckOverrides[c.id] !== undefined ? manualCheckOverrides[c.id] : c.passed,
  }))

  const handleConfigChange = (nextConfig: ReportCustomizationConfig) => {
    if (nextConfig.customBlocks.length > config.customBlocks.length) {
      setSelectedSections(prev => ({ ...prev, customSections: true }))
    }
    setConfig(nextConfig)
  }

  const handleToggleComplianceCheck = (id: string) => {
    const found = complianceChecks.find(c => c.id === id)
    if (!found) return
    setManualCheckOverrides(prev => ({ ...prev, [id]: !found.passed }))
  }

  const handleAddCustomCheck = (
    chk: Omit<ComplianceCheckItem, 'id' | 'autoVerified' | 'isCustom'>
  ) => {
    setCustomChecks(prev => [
      ...prev,
      {
        ...chk,
        id: `custom-chk-${Date.now()}`,
        autoVerified: false,
        isCustom: true,
      },
    ])
    toast.success('Control agregado al Checklist', chk.title)
  }

  const handleRemoveCustomCheck = (id: string) => {
    setCustomChecks(prev => prev.filter(c => c.id !== id))
  }

  const totalSections = SECTION_META.length
  const activeSectionsCount = Object.values(selectedSections).filter(Boolean).length
  const anyExpanded = sectionOrder.some(k => selectedSections[k] && !collapsedSections[k])

  const toggleSection = (key: SectionKey) => {
    setActivePreset('custom')
    setSelectedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleHideSection = (key: SectionKey) => {
    setActivePreset('custom')
    setSelectedSections(prev => ({ ...prev, [key]: false }))
  }

  const handleToggleCollapse = (key: SectionKey) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleToggleCollapseAll = () => {
    if (anyExpanded) {
      const next: Record<string, boolean> = {}
      sectionOrder.forEach(k => {
        next[k] = true
      })
      setCollapsedSections(next)
    } else {
      setCollapsedSections({})
    }
  }

  const moveSection = (key: SectionKey, dir: -1 | 1) => {
    const idx = sectionOrder.indexOf(key)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= sectionOrder.length) return
    const next = [...sectionOrder]
    const [moved] = next.splice(idx, 1)
    next.splice(target, 0, moved)
    setSectionOrder(next)
  }

  const openCustomizer = (tab: CustomizerTab = 'identity') => {
    setCustomizerTab(tab)
    setShowCustomizer(true)
  }

  const applyPreset = (preset: ReportTemplatePreset) => {
    setActivePreset(preset)
    if (preset === 'full') {
      setSelectedSections(ALL_SECTIONS)
    } else if (preset === 'executive') {
      setSelectedSections(EXECUTIVE_SECTIONS)
    } else if (preset === 'technical') {
      setSelectedSections({
        projectContext: false,
        datasetEda: true,
        featureDictionary: true,
        networkArch: true,
        trainingMetrics: true,
        epochHistory: true,
        experimentsRanking: true,
        roiImpact: false,
        modelRegistry: true,
        complianceChecklist: false,
        customSections: false,
        auditTrail: false,
      })
    } else {
      setSelectedSections({
        projectContext: true,
        datasetEda: false,
        featureDictionary: false,
        networkArch: false,
        trainingMetrics: false,
        epochHistory: false,
        experimentsRanking: false,
        roiImpact: false,
        modelRegistry: true,
        complianceChecklist: true,
        customSections: true,
        auditTrail: true,
      })
    }
  }

  const copyValue = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1800)
    toast.success(
      'Copiado al portapapeles',
      key === 'markdown-summary' ? 'Resumen ejecutivo en Markdown' : undefined
    )
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
          sectionOrder,
          auditEvents,
          epochMetrics,
          jobs,
          models,
          diagnostic,
          auditorNotes,
          comparisonJob,
          customization: config,
          complianceChecks,
        }
      )
      toast.success('Reporte PDF Ejecutivo generado', `Certificación de ${project.name}`)
    } catch (e: unknown) {
      toast.error(
        'Error al generar PDF',
        e instanceof Error ? e.message : 'No se pudo exportar el PDF'
      )
    } finally {
      setLoadingReport(false)
    }
  }

  const handleExportHtml = () => {
    if (!project) return
    const safeName = (project.name || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')
    const html = buildStandaloneHtmlReport({
      project,
      dataset: primaryDataset,
      architecture: primaryArch,
      job: bestJob,
      model: resolvedModel,
      metrics: resolvedMetrics,
      diagnostic,
      auditorNotes,
      sections: selectedSections,
      sectionOrder,
      config,
      complianceChecks,
      jobs,
      epochMetrics,
      auditEvents,
    })
    downloadHtmlFile(`informe_ejecutivo_${safeName}.html`, html)
    toast.success('Informe HTML interactivo exportado', `Archivo informe_ejecutivo_${safeName}.html`)
    setExportMenuOpen(false)
  }

  const handleExportCsv = async () => {
    const targetJob = bestJob || jobs[0]
    if (!targetJob) return
    setExportingCsv(true)
    try {
      const metrics =
        epochMetrics.length > 0 ? epochMetrics : await api.getJobMetrics(targetJob.id)
      const safeName = (project?.name || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')
      downloadCsvFile(`metricas_${safeName}.csv`, metrics, auditEvents)
      toast.success('Métricas exportadas en CSV', `Archivo metricas_${safeName}.csv`)
    } catch (e: unknown) {
      toast.error(
        'Error al exportar CSV',
        e instanceof Error ? e.message : 'No se pudieron descargar las métricas'
      )
    } finally {
      setExportingCsv(false)
      setExportMenuOpen(false)
    }
  }

  const handleExportJson = () => {
    if (!project) return
    const safeName = (project.name || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')
    downloadJsonFile(`certificacion_${safeName}.json`, {
      generated_at: new Date().toISOString(),
      customization: config,
      section_order: sectionOrder,
      diagnostic,
      auditor_notes: auditorNotes || undefined,
      project: selectedSections.projectContext ? project : undefined,
      dataset: selectedSections.datasetEda ? primaryDataset : undefined,
      architecture: selectedSections.networkArch ? primaryArch : undefined,
      training_job: selectedSections.trainingMetrics ? bestJob : undefined,
      epoch_history: selectedSections.epochHistory ? epochMetrics : undefined,
      experiments_ranking: selectedSections.experimentsRanking ? jobs : undefined,
      comparison_job: selectedSections.trainingMetrics ? comparisonJob : undefined,
      model_registry: selectedSections.modelRegistry ? resolvedModel : undefined,
      compliance_checklist: selectedSections.complianceChecklist ? complianceChecks : undefined,
      custom_blocks: selectedSections.customSections ? config.customBlocks : undefined,
      audit_events: selectedSections.auditTrail ? auditEvents : undefined,
    })
    toast.success('Certificación exportada en JSON', `Archivo certificacion_${safeName}.json`)
    setExportMenuOpen(false)
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
      sectionOrder,
      config,
      complianceChecks,
      jobs,
      models,
      epochMetrics,
      auditEvents,
    })
    copyValue('markdown-summary', md)
    setExportMenuOpen(false)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-1 lg:min-h-0 lg:overflow-hidden print:block print:h-auto print:overflow-visible">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 nl-no-print shrink-0 relative z-20">
        {jobs.length > 0 || models.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center shrink-0"
              title="Fuente de Datos del Informe"
            >
              <Database className="w-4 h-4 text-cyan-400" />
            </div>

            {jobs.length > 0 && (
              <div className="min-w-[200px] sm:w-56 xl:w-64">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 leading-none">
                  Experimento Principal
                </label>
                <SystemSelect
                  value={bestJob?.id || ''}
                  onChange={setSelectedJobId}
                  size="xs"
                  menuMinWidth={280}
                  searchable
                  searchPlaceholder="Buscar experimento o estado..."
                  maxVisibleOptions={25}
                  ariaLabel="Experimento Principal"
                  options={jobs.map(j => ({
                    value: j.id,
                    label: `${j.arch_name || 'Run'} · ${j.status}${
                      j.accuracy != null ? ` (${(j.accuracy * 100).toFixed(1)}%)` : ''
                    }`,
                    keywords: `${j.id} ${j.status} ${j.arch_name || ''}`,
                  }))}
                />
              </div>
            )}

            {models.length > 0 && (
              <div className="min-w-[175px] sm:w-48 xl:w-52">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 leading-none">
                  Versión Model Registry
                </label>
                <SystemSelect
                  value={resolvedModel?.id || ''}
                  onChange={setSelectedModelId}
                  size="xs"
                  menuMinWidth={240}
                  searchable
                  searchPlaceholder="Buscar versión o estado..."
                  maxVisibleOptions={25}
                  ariaLabel="Versión Model Registry"
                  options={models.map(m => ({
                    value: m.id,
                    label: `${m.version} · ${m.status} (${(
                      m.test_metrics.test_accuracy * 100
                    ).toFixed(1)}%)`,
                    keywords: `${m.version} ${m.status}`,
                  }))}
                />
              </div>
            )}

            {jobs.length > 1 && (
              <div className="min-w-[180px] sm:w-48 xl:w-56">
                <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 leading-none">
                  <GitCompare className="w-2.5 h-2.5 text-cyan-400" />
                  <span>Comparar corrida</span>
                </label>
                <SystemSelect
                  value={comparisonJob?.id || ''}
                  onChange={setComparisonJobId}
                  size="xs"
                  menuMinWidth={280}
                  searchable
                  searchPlaceholder="Buscar corrida a comparar..."
                  maxVisibleOptions={25}
                  ariaLabel="Comparar contra corrida"
                  options={[
                    { value: '', label: 'Sin comparativa' },
                    ...jobs
                      .filter(j => j.id !== bestJob?.id)
                      .map(j => ({
                        value: j.id,
                        label: `${j.arch_name || 'Run'} · ${j.status}${
                          j.accuracy != null ? ` (${(j.accuracy * 100).toFixed(1)}%)` : ''
                        }`,
                        keywords: `${j.id} ${j.status} ${j.arch_name || ''}`,
                      })),
                  ]}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-400/25 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4 text-cyan-400/70" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">Fuente de Datos</p>
              <p className="text-[11px] text-slate-400 truncate">
                Sin experimentos ni modelos registrados aún
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => openCustomizer('blocks')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/35 transition-all"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-teal-400" />
            <span>+ Bloque</span>
          </button>

          <button
            type="button"
            onClick={() => openCustomizer('identity')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Personalizar</span>
          </button>

          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen(o => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-all"
            >
              <span>Exportar</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-[#091329] border border-cyan-500/30 rounded-xl shadow-2xl p-1.5 z-40 space-y-0.5">
                <button
                  type="button"
                  onClick={handleExportHtml}
                  disabled={!project || activeSectionsCount === 0}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800/80 disabled:opacity-45 text-left"
                >
                  <Code2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Informe HTML (.html)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  disabled={!project || activeSectionsCount === 0}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800/80 disabled:opacity-45 text-left"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-400" />
                  <span>Certificación JSON (.json)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exportingCsv || jobs.length === 0}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800/80 disabled:opacity-45 text-left"
                >
                  {exportingCsv ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  ) : (
                    <Table className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>Métricas Épocas (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  disabled={!project}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800/80 disabled:opacity-45 text-left"
                >
                  {copiedKey === 'markdown-summary' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span>
                    {copiedKey === 'markdown-summary' ? 'Markdown Copiado' : 'Copiar Resumen Markdown'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false)
                    window.print()
                  }}
                  disabled={!project}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800/80 disabled:opacity-45 text-left"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-300" />
                  <span>Imprimir vista</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={loadingReport || !project || activeSectionsCount === 0}
            className="nl-btn-shimmer nl-accent-bg flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold disabled:opacity-45 transition-all shadow-lg"
          >
            {loadingReport ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Generar PDF</span>
            <span className="px-1.5 py-0.5 rounded-md bg-black/25 font-mono text-[10px]">
              {activeSectionsCount}/{totalSections}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0 print:block">
        <ReportBuilderSidebar
          selectedSections={selectedSections}
          sectionOrder={sectionOrder}
          activePreset={activePreset}
          onToggleSection={toggleSection}
          onMoveSection={moveSection}
          onApplyPreset={applyPreset}
          onOpenCustomizer={openCustomizer}
          customBlocksCount={config.customBlocks.length}
        />

        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-3.5 lg:h-full lg:min-h-0 print:block">
          <div className="nl-cyber-panel rounded-2xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 nl-no-print shrink-0">
            <div className="flex flex-wrap items-center gap-1">
              {PREVIEW_TABS.map(tab => {
                const active = previewCategory === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setPreviewCategory(tab.id)
                      previewScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-white'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {activeSectionsCount > 0 && (
              <button
                type="button"
                onClick={handleToggleCollapseAll}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors"
              >
                {anyExpanded ? (
                  <>
                    <ChevronsDownUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Contraer todo</span>
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-teal-400" />
                    <span>Expandir todo</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div
            ref={previewScrollRef}
            className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1.5 space-y-4 pb-2 print:overflow-visible print:pr-0"
          >
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="nl-skeleton rounded-2xl h-36" />
                ))}
              </div>
            ) : (
              <>
                {activeSectionsCount === 0 && (
                  <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-10 text-center space-y-3">
                    <FileText className="w-10 h-10 text-slate-500 mx-auto opacity-60" />
                    <p className="text-white font-bold text-sm">Ninguna sección seleccionada</p>
                    <p className="text-slate-400 text-xs">
                      Activa al menos una sección en el Constructor Modular para previsualizar y
                      exportar el PDF.
                    </p>
                    <button
                      onClick={() => applyPreset('executive')}
                      className="nl-accent-bg px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      Activar plantilla ejecutiva
                    </button>
                  </div>
                )}

                <ReportDetailSections
                  selectedSections={selectedSections}
                  sectionOrder={sectionOrder}
                  previewCategory={previewCategory}
                  collapsedSections={collapsedSections}
                  onToggleCollapse={handleToggleCollapse}
                  onHideSection={handleHideSection}
                  onResetPreviewCategory={() => setPreviewCategory('all')}
                  project={project}
                  currentProject={currentProject}
                  primaryDataset={primaryDataset}
                  primaryArch={primaryArch}
                  activeJob={bestJob}
                  comparisonJob={comparisonJob}
                  resolvedModel={resolvedModel}
                  resolvedMetrics={resolvedMetrics}
                  epochMetrics={epochMetrics}
                  jobs={jobs}
                  models={models}
                  auditEvents={auditEvents}
                  displayAcc={displayAcc}
                  displayLoss={displayLoss}
                  copiedKey={copiedKey}
                  onCopy={copyValue}
                  diagnostic={diagnostic}
                  auditorNotes={auditorNotes}
                  onAuditorNotesChange={setAuditorNotes}
                  config={config}
                  onChangeConfig={handleConfigChange}
                  complianceChecks={complianceChecks}
                  onToggleComplianceCheck={handleToggleComplianceCheck}
                  onDeleteCustomCheck={handleRemoveCustomCheck}
                  onOpenCustomizer={openCustomizer}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {showCustomizer && (
        <ReportCustomizationModal
          initialTab={customizerTab}
          config={config}
          onChange={handleConfigChange}
          onReset={() => {
            setConfig(DEFAULT_REPORT_CONFIG)
            setSectionOrder(DEFAULT_SECTION_ORDER)
            setSelectedSections(EXECUTIVE_SECTIONS)
            setActivePreset('executive')
            setCustomChecks([])
            setManualCheckOverrides({})
            toast.info('Estudio documental restaurado', 'Se cargaron los valores ejecutivos base')
          }}
          complianceChecks={complianceChecks}
          onToggleComplianceCheck={handleToggleComplianceCheck}
          onAddCustomCheck={handleAddCustomCheck}
          onRemoveCustomCheck={handleRemoveCustomCheck}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  )
}
