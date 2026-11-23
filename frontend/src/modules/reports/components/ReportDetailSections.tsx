import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  DollarSign,
  EyeOff,
  FileSignature,
  GitCompare,
  Lightbulb,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react'
import type {
  AuditEvent,
  Architecture,
  Dataset,
  EpochMetric,
  ModelVersion,
  Project,
  TestMetrics,
  TrainingJob,
} from '../../../types/index'
import type {
  ComplianceCheckItem,
  ExecutiveDiagnostic,
  ReportCustomizationConfig,
  SectionKey,
} from '../types'
import type { CustomizerTab } from './ReportCustomizationModal'
import { PDF_THEME_COLORS, SECTION_META } from '../constants'
import {
  computeLayerBreakdown,
  computePerClassMetrics,
  computeQuarterlyRoi,
  computeRoiProjection,
  problemLabel,
} from '../helpers'
import { InfoTip } from '../../../components/InfoTip'
import { AuditLogSection } from './AuditLogSection'
import { MiniConvergenceChart } from './MiniConvergenceChart'
import {
  CustomBlocksSection,
  EpochHistorySection,
  ExperimentsRankingSection,
  FeatureDictionarySection,
} from './ReportExtraSections'

export type PreviewCategory = 'all' | 'executive' | 'data_arch' | 'evaluation' | 'governance'

const CATEGORY_SECTIONS: Record<Exclude<PreviewCategory, 'all'>, SectionKey[]> = {
  executive: ['projectContext', 'roiImpact', 'customSections'],
  data_arch: ['datasetEda', 'featureDictionary', 'networkArch'],
  evaluation: ['trainingMetrics', 'epochHistory', 'experimentsRanking'],
  governance: ['modelRegistry', 'complianceChecklist', 'auditTrail'],
}

interface ReportDetailSectionsProps {
  selectedSections: Record<SectionKey, boolean>
  sectionOrder: SectionKey[]
  previewCategory: PreviewCategory
  collapsedSections: Record<string, boolean>
  onToggleCollapse: (key: SectionKey) => void
  onHideSection: (key: SectionKey) => void
  onResetPreviewCategory: () => void
  project: Project | null
  currentProject: { id: string; name: string }
  primaryDataset: Dataset | null
  primaryArch: Architecture | null
  activeJob: TrainingJob | null
  comparisonJob: TrainingJob | null
  resolvedModel: ModelVersion | null
  resolvedMetrics: TestMetrics | null
  epochMetrics: EpochMetric[]
  jobs: TrainingJob[]
  models: ModelVersion[]
  auditEvents: AuditEvent[]
  displayAcc: number | null
  displayLoss: number | null
  copiedKey: string | null
  onCopy: (key: string, text: string) => void
  diagnostic: ExecutiveDiagnostic
  auditorNotes: string
  onAuditorNotesChange: (value: string) => void
  config: ReportCustomizationConfig
  onChangeConfig: (next: ReportCustomizationConfig) => void
  complianceChecks: ComplianceCheckItem[]
  onToggleComplianceCheck: (id: string) => void
  onDeleteCustomCheck: (id: string) => void
  onOpenCustomizer: (tab?: CustomizerTab) => void
}

function MetricRadarSvg({
  accuracy,
  precision,
  recall,
  f1,
  health,
}: {
  accuracy: number
  precision: number
  recall: number
  f1: number
  health: number
}) {
  const cx = 110
  const cy = 96
  const maxR = 64
  const axes = [
    { label: 'Accuracy', val: accuracy },
    { label: 'Precision', val: precision },
    { label: 'Recall', val: recall },
    { label: 'F1-Score', val: f1 },
    { label: 'Salud IA', val: health },
  ]

  const angleFor = (idx: number) => -Math.PI / 2 + (idx / axes.length) * Math.PI * 2
  const pointFor = (idx: number, radiusFraction: number) => {
    const a = angleFor(idx)
    const r = maxR * Math.min(1, Math.max(0.08, radiusFraction))
    return {
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
    }
  }

  const polygonPoints = axes
    .map((ax, idx) => {
      const p = pointFor(idx, ax.val)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-slate-300 flex items-center gap-1.5">
          <span>Radar Multidimensional</span>
          <InfoTip
            text="Balance pentágono entre Exactitud, Precisión, Sensibilidad (Recall), F1-Score y Salud General del modelo."
            size="xs"
          />
        </span>
        <span className="text-[10px] font-mono text-cyan-300">5 ejes</span>
      </div>

      <svg viewBox="0 0 220 190" className="w-full h-36">
        {[0.33, 0.66, 1].map(ring => {
          const pts = axes
            .map((_, idx) => {
              const p = pointFor(idx, ring)
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
            })
            .join(' ')
          return (
            <polygon
              key={ring}
              points={pts}
              fill="none"
              stroke="#334155"
              strokeOpacity={ring === 1 ? 0.55 : 0.3}
              strokeDasharray={ring === 1 ? undefined : '2 2'}
            />
          )
        })}

        {axes.map((ax, idx) => {
          const end = pointFor(idx, 1)
          const lbl = pointFor(idx, 1.24)
          return (
            <g key={ax.label}>
              <line
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                stroke="#334155"
                strokeOpacity={0.45}
              />
              <text
                x={lbl.x}
                y={lbl.y + 3}
                textAnchor="middle"
                fill="#94a3b8"
                className="text-[8.5px] font-mono"
              >
                {ax.label}
              </text>
            </g>
          )
        })}

        <polygon
          points={polygonPoints}
          fill="rgba(34, 211, 238, 0.22)"
          stroke="#22d3ee"
          strokeWidth="2"
        />

        {axes.map((ax, idx) => {
          const p = pointFor(idx, ax.val)
          return (
            <circle
              key={`dot-${ax.label}`}
              cx={p.x}
              cy={p.y}
              r={3}
              fill="#2dd4bf"
              stroke="#040915"
              strokeWidth="1"
            />
          )
        })}
      </svg>
    </div>
  )
}

const AUDITOR_TEMPLATES = [
  {
    label: 'Aprobación Producción',
    text: 'Modelo auditado y aprobado para despliegue en producción. Cumple el SLA de exactitud sobre la partición de Test sellada (15%) sin signos de sobreajuste y cuenta con firma criptográfica SHA-256 inmutable.',
  },
  {
    label: 'Piloto Controlado (Canary)',
    text: 'Se autoriza despliegue gradual en entorno piloto (Canary 20% tráfico) con monitoreo continuo de deriva de datos (Data Drift) y recalibración mensual.',
  },
  {
    label: 'Solicitud de Re-entrenamiento',
    text: 'Se recomienda ejecutar una corrida adicional incrementando la regularización Dropout y ajustando el umbral de clasificación para elevar el Recall de la clase minoritaria antes del pase a producción.',
  },
]

const SIGNATURE_GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

export function ReportDetailSections({
  selectedSections,
  sectionOrder,
  previewCategory,
  collapsedSections,
  onToggleCollapse,
  onHideSection,
  onResetPreviewCategory,
  project,
  currentProject,
  primaryDataset,
  primaryArch,
  activeJob,
  comparisonJob,
  resolvedModel,
  resolvedMetrics,
  epochMetrics,
  jobs,
  models,
  auditEvents,
  displayAcc,
  displayLoss,
  copiedKey,
  onCopy,
  diagnostic,
  auditorNotes,
  onAuditorNotesChange,
  config,
  onChangeConfig,
  complianceChecks,
  onToggleComplianceCheck,
  onDeleteCustomCheck,
  onOpenCustomizer,
}: ReportDetailSectionsProps) {
  const totalSplitRows = primaryDataset
    ? (primaryDataset.splits?.train_count || 0) +
      (primaryDataset.splits?.val_count || 0) +
      (primaryDataset.splits?.test_count || 0)
    : 0
  const trainPct =
    primaryDataset && totalSplitRows > 0
      ? (primaryDataset.splits.train_count / totalSplitRows) * 100
      : 70
  const valPct =
    primaryDataset && totalSplitRows > 0
      ? (primaryDataset.splits.val_count / totalSplitRows) * 100
      : 15
  const testPct =
    primaryDataset && totalSplitRows > 0
      ? (primaryDataset.splits.test_count / totalSplitRows) * 100
      : 15

  const compAcc = comparisonJob
    ? (comparisonJob.model_version?.test_metrics?.test_accuracy ?? comparisonJob.accuracy ?? null)
    : null
  const compLoss = comparisonJob
    ? (comparisonJob.model_version?.test_metrics?.test_loss ?? comparisonJob.loss ?? null)
    : null
  const deltaAcc = displayAcc != null && compAcc != null ? (displayAcc - compAcc) * 100 : null
  const deltaLoss = displayLoss != null && compLoss != null ? displayLoss - compLoss : null

  const themeMeta = PDF_THEME_COLORS[config.accentTheme]
  const roi = computeRoiProjection(config, displayAcc, resolvedMetrics?.recall ?? null)
  const quarterlyRoi = computeQuarterlyRoi(roi.monthlySavingsUsd)
  const passedChecksCount = complianceChecks.filter(c => c.passed).length
  const perClass = computePerClassMetrics(
    resolvedModel?.confusion_matrix,
    primaryDataset?.metadata?.target_classes
  )
  const layerBreakdown = computeLayerBreakdown(primaryArch)

  const dsCols = primaryDataset?.metadata?.columns_summary || []
  const missingTotal = dsCols.reduce((acc, c) => acc + (c.missing || 0), 0)
  const numericColsCount = dsCols.filter(c => c.dtype === 'numeric').length
  const catColsCount = dsCols.filter(c => c.dtype === 'categorical').length

  const signers = config.signatures.length > 0 ? config.signatures : []
  const sigGridCls = SIGNATURE_GRID_COLS[Math.min(4, Math.max(1, signers.length))]

  const verdictToneCls =
    diagnostic.tone === 'optimal'
      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
      : diagnostic.tone === 'warning'
        ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
        : diagnostic.tone === 'critical'
          ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
          : 'bg-slate-800 border-slate-700 text-slate-300'

  const activeOrderedSections = sectionOrder.filter(k => selectedSections[k])
  const numberedActive = activeOrderedSections.map((key, idx) => ({
    key,
    secNum: String(idx + 1).padStart(2, '0'),
  }))

  const visibleOrderedSections = numberedActive.filter(({ key }) => {
    if (previewCategory === 'all') return true
    return CATEGORY_SECTIONS[previewCategory].includes(key)
  })

  const renderSectionActions = (key: SectionKey) => (
    <div className="inline-flex items-center gap-1 ml-1 nl-no-print">
      <button
        type="button"
        onClick={() => onToggleCollapse(key)}
        title="Contraer sección"
        className="p-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onHideSection(key)}
        title="Ocultar del informe y PDF"
        className="p-1 rounded-lg bg-slate-900/90 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/35 text-slate-400 hover:text-rose-300 transition-colors"
      >
        <EyeOff className="w-3.5 h-3.5" />
      </button>
    </div>
  )

  return (
    <>
      {config.includeCoverSummary && (
        <section className="nl-cyber-panel animate-card-reveal rounded-2xl p-5 relative overflow-hidden space-y-3">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1"
            style={{ backgroundColor: themeMeta.hex }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                {config.organizationName} · {config.departmentName}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${verdictToneCls}`}
              >
                {diagnostic.verdict}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                {config.documentCode} · {config.reportVersion}
              </span>
              {config.includeWatermark && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${themeMeta.pillCls}`}
                >
                  {config.confidentiality}
                </span>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white">{config.reportTitle}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{config.reportSubtitle}</p>
          </div>

          {signers.length > 0 && (
            <div className={`grid ${sigGridCls} gap-2.5 pt-1 text-xs`}>
              {signers.map(sig => (
                <div key={sig.id} className="bg-slate-950/75 border border-slate-800/90 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block truncate">
                    {sig.role}
                  </span>
                  <span className="text-white font-semibold mt-0.5 block truncate">{sig.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeOrderedSections.length > 0 && visibleOrderedSections.length === 0 && (
        <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-8 text-center space-y-2.5">
          <p className="text-sm font-bold text-white">
            No hay secciones activas en esta categoría visual
          </p>
          <p className="text-xs text-slate-400">
            Activa secciones de este grupo en el Constructor Modular o vuelve a mostrar todas.
          </p>
          <button
            type="button"
            onClick={onResetPreviewCategory}
            className="px-4 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold"
          >
            Ver todas las secciones
          </button>
        </div>
      )}

      {visibleOrderedSections.map(({ key, secNum }) => {
        const meta = SECTION_META.find(s => s.key === key)

        if (collapsedSections[key]) {
          const Icon = meta?.Icon
          return (
            <div
              key={key}
              className="nl-cyber-panel animate-card-reveal rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-6 h-6 rounded-lg border text-xs font-extrabold font-mono flex items-center justify-center shrink-0 ${
                    meta?.colorCls || 'text-cyan-400 bg-cyan-500/15 border-cyan-500/35'
                  }`}
                >
                  {secNum}
                </span>
                {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                <span className="text-xs font-bold text-white truncate">
                  {meta?.label || key}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 nl-no-print">
                <button
                  type="button"
                  onClick={() => onHideSection(key)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/35 text-[11px] font-semibold text-slate-300 hover:text-rose-300 transition-colors"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Ocultar del PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleCollapse(key)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-[11px] font-bold text-cyan-200 transition-colors"
                >
                  <ChevronDown className="w-3 h-3" />
                  <span>Expandir</span>
                </button>
              </div>
            </div>
          )
        }

        if (key === 'projectContext') {
          return (
            <section
              key={key}
              className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-extrabold font-mono flex items-center justify-center">
                    {secNum}
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">
                    Contexto del Proyecto y Equipo RBAC
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    {project?.status || 'ACTIVE'}
                  </span>
                  {renderSectionActions(key)}
                </div>
              </div>

              <div>
                <h4 className="text-xl font-extrabold text-white">
                  {project?.name || currentProject.name}
                </h4>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  {project?.description || 'Sin descripción disponible.'}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    ID Workspace
                  </span>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <code className="text-slate-200 font-mono truncate">
                      {project?.id || currentProject.id}
                    </code>
                    <button
                      onClick={() => onCopy('proj-id', project?.id || currentProject.id)}
                      className="text-indigo-400 hover:text-indigo-300 shrink-0 nl-no-print"
                      aria-label="Copiar ID de proyecto"
                    >
                      {copiedKey === 'proj-id' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Miembros RBAC
                  </span>
                  <span className="text-white font-bold text-sm mt-1 block">
                    {project?.members?.length ?? 1} integrantes
                  </span>
                </div>
                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Corridas / Modelos
                  </span>
                  <span className="text-white font-bold font-mono text-sm mt-1 block">
                    {jobs.length} runs · {models.length} vers.
                  </span>
                </div>
                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Última Actualización
                  </span>
                  <span className="text-slate-200 font-medium mt-1 block">
                    {project?.updated_at
                      ? new Date(project.updated_at).toLocaleDateString('es-ES')
                      : 'Reciente'}
                  </span>
                </div>
              </div>

              {config.includeRbacMembersTable && project?.members && project.members.length > 0 && (
                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Integrantes Autorizados RBAC</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                          <th className="py-1.5 text-left">Integrante</th>
                          <th className="py-1.5 text-left">Correo</th>
                          <th className="py-1.5 text-left">Rol RBAC</th>
                          <th className="py-1.5 text-right">Asignado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {project.members.map(m => (
                          <tr key={m.id}>
                            <td className="py-1.5 font-semibold text-white">{m.display_name}</td>
                            <td className="py-1.5 font-mono text-slate-400">{m.email}</td>
                            <td className="py-1.5">
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                                {m.role}
                              </span>
                            </td>
                            <td className="py-1.5 text-right font-mono text-slate-400">
                              {new Date(m.created_at).toLocaleDateString('es-ES')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {project?.tags && project.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {project.tags.map(t => (
                    <span
                      key={t}
                      className="px-2.5 py-0.5 rounded-full bg-slate-950 text-slate-300 border border-slate-800 text-[11px] font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )
        }

        if (key === 'datasetEda') {
          return (
            <section
              key={key}
              className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-extrabold font-mono flex items-center justify-center">
                    {secNum}
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                    Especificación, Calidad y Partición EDA del Dataset
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {primaryDataset && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                      {problemLabel(primaryDataset.metadata?.problem_type)}
                    </span>
                  )}
                  {renderSectionActions(key)}
                </div>
              </div>

              {primaryDataset ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="sm:col-span-2 bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Dataset Primario
                      </span>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-sm font-bold text-white break-words">
                          {primaryDataset.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-cyan-300 shrink-0">
                          v{primaryDataset.version}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Input Shape &amp; Target
                      </span>
                      <span className="text-sm font-bold text-white font-mono mt-1 block">
                        {primaryDataset.input_shape}D <span className="text-slate-500">→</span>{' '}
                        <span className="text-cyan-400">{primaryDataset.target}</span>
                      </span>
                    </div>
                    <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Calidad Auto-EDA
                      </span>
                      <span className="text-sm font-bold text-emerald-300 font-mono mt-1 block">
                        {numericColsCount} Num / {catColsCount} Cat · {missingTotal} Nulos
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <span>Partición Estratificada ({totalSplitRows} registros)</span>
                        <InfoTip
                          text="Train ajusta los pesos, Validación supervisa el sobreajuste por época y Test (15%) queda aislado para evaluación final."
                          size="xs"
                        />
                      </span>
                      <span className="font-mono text-emerald-400 font-bold text-[11px]">
                        Escalado {primaryDataset.metadata?.scaler_applied || 'Standard'} · Test Sellado
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-900">
                      <div style={{ width: `${trainPct}%` }} className="bg-indigo-500 h-full" />
                      <div style={{ width: `${valPct}%` }} className="bg-amber-400 h-full" />
                      <div style={{ width: `${testPct}%` }} className="bg-emerald-500 h-full" />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                        Train: <strong>{primaryDataset.splits?.train_count || 0}</strong> (
                        {trainPct.toFixed(0)}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        Validación: <strong>{primaryDataset.splits?.val_count || 0}</strong> (
                        {valPct.toFixed(0)}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        Test Sellado: <strong>{primaryDataset.splits?.test_count || 0}</strong> (
                        {testPct.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No se ha registrado ningún dataset aún.</p>
              )}
            </section>
          )
        }

        if (key === 'featureDictionary') {
          return (
            <FeatureDictionarySection
              key={key}
              sectionNum={secNum}
              dataset={primaryDataset}
              maxColumns={config.maxDictionaryColumns}
              onOpenCustomizer={() => onOpenCustomizer('elements')}
              headerActions={renderSectionActions(key)}
            />
          )
        }

        if (key === 'networkArch') {
          return (
            <section
              key={key}
              className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-extrabold font-mono flex items-center justify-center">
                    {secNum}
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-violet-400">
                    Topología de Red Neuronal y Desglose de Capas
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {primaryArch && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 font-semibold">
                      {primaryArch.family} · v{primaryArch.version}
                    </span>
                  )}
                  {renderSectionActions(key)}
                </div>
              </div>

              {primaryArch ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Arquitectura
                      </span>
                      <span className="text-sm font-bold text-white mt-1 block">
                        {primaryArch.name}
                      </span>
                    </div>
                    <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Parámetros Entrenables
                      </span>
                      <span className="text-sm font-extrabold font-mono text-indigo-400 mt-1 block">
                        {primaryArch.total_parameters?.toLocaleString('es') ?? 0} pesos/sesgos
                      </span>
                    </div>
                    <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Capa de Salida
                      </span>
                      <span className="text-sm font-bold font-mono text-violet-300 mt-1 block">
                        {primaryArch.config.output_dim} neurona ·{' '}
                        {primaryArch.config.output_activation}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-2.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Flujo Secuencial de Capas
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold">
                        Input({primaryArch.config.input_shape})
                      </span>
                      {primaryArch.config.layers.map(layer => (
                        <span key={layer.id} className="inline-flex items-center gap-1.5">
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
                            {layer.type === 'Dense'
                              ? `Dense(${layer.units} · ${layer.activation})`
                              : layer.type === 'Dropout'
                                ? `Dropout(${layer.rate})`
                                : layer.type}
                          </span>
                        </span>
                      ))}
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                        Output({primaryArch.config.output_dim} · {primaryArch.config.output_activation})
                      </span>
                    </div>

                    {config.includeLayerParamsTable && layerBreakdown.length > 0 && (
                      <div className="overflow-x-auto pt-2 border-t border-slate-800/80">
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                              <th className="py-1.5 text-left">Capa</th>
                              <th className="py-1.5 text-left">Tipo Keras</th>
                              <th className="py-1.5 text-left">Tensor Salida</th>
                              <th className="py-1.5 text-left">Activación</th>
                              <th className="py-1.5 text-right">Parámetros</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-[11px]">
                            {layerBreakdown.map(row => (
                              <tr key={row.index}>
                                <td className="py-1.5 text-white font-semibold">{row.layerName}</td>
                                <td className="py-1.5 text-violet-300">{row.type}</td>
                                <td className="py-1.5 text-cyan-300">{row.outputShape}</td>
                                <td className="py-1.5 text-slate-300">{row.activation}</td>
                                <td className="py-1.5 text-right text-emerald-300 font-bold">
                                  {row.params.toLocaleString('es')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {config.includeArchJustification && primaryArch.justification && (
                      <p className="text-xs text-slate-400 pt-2 leading-relaxed border-t border-slate-800/80">
                        {primaryArch.justification}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No se ha configurado ninguna arquitectura aún.
                </p>
              )}
            </section>
          )
        }

        if (key === 'trainingMetrics') {
          return (
            <section
              key={key}
              className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold font-mono flex items-center justify-center">
                    {secNum}
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                    Métricas de Evaluación, Radar y Desglose por Clase
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeJob && (
                    <span className="text-[11px] font-mono text-slate-400">
                      {activeJob.hyperparams.optimizer.toUpperCase()} · lr=
                      {activeJob.hyperparams.learning_rate} · batch={activeJob.hyperparams.batch_size}{' '}
                      · {activeJob.current_epoch}/{activeJob.total_epochs} ep.
                    </span>
                  )}
                  {renderSectionActions(key)}
                </div>
              </div>

              {activeJob || resolvedMetrics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      {
                        label: 'Test Accuracy',
                        value: displayAcc != null ? `${(displayAcc * 100).toFixed(2)}%` : '—',
                        cls: 'text-emerald-400',
                      },
                      {
                        label: 'Test Loss',
                        value: displayLoss != null ? displayLoss.toFixed(4) : '—',
                        cls: 'text-amber-400',
                      },
                      {
                        label: 'Precision',
                        value:
                          resolvedMetrics?.precision != null
                            ? `${(resolvedMetrics.precision * 100).toFixed(2)}%`
                            : '—',
                        cls: 'text-indigo-400',
                      },
                      {
                        label: 'Recall',
                        value:
                          resolvedMetrics?.recall != null
                            ? `${(resolvedMetrics.recall * 100).toFixed(2)}%`
                            : '—',
                        cls: 'text-violet-400',
                      },
                      {
                        label: 'F1-Score',
                        value:
                          resolvedMetrics?.f1_score != null
                            ? `${(resolvedMetrics.f1_score * 100).toFixed(2)}%`
                            : '—',
                        cls: 'text-cyan-400',
                      },
                    ].map(metric => (
                      <div
                        key={metric.label}
                        className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 text-center"
                      >
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          {metric.label}
                        </span>
                        <span className={`text-lg font-extrabold font-mono mt-1 block ${metric.cls}`}>
                          {metric.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {comparisonJob && comparisonJob.id !== activeJob?.id && (
                    <div className="bg-slate-950/75 border border-cyan-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <GitCompare className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div>
                          <p className="font-bold text-white">
                            Comparativa contra:{' '}
                            {comparisonJob.arch_name || comparisonJob.id.slice(0, 10)}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Ref: {compAcc != null ? `${(compAcc * 100).toFixed(2)}%` : '—'} · Loss{' '}
                            {compLoss != null ? compLoss.toFixed(4) : '—'} ·{' '}
                            {comparisonJob.hyperparams.optimizer.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 font-mono font-bold">
                        {deltaAcc != null && (
                          <span
                            className={`px-2.5 py-1 rounded-lg border ${
                              deltaAcc >= 0
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            Δ Acc: {deltaAcc >= 0 ? '+' : ''}
                            {deltaAcc.toFixed(2)}%
                          </span>
                        )}
                        {deltaLoss != null && (
                          <span
                            className={`px-2.5 py-1 rounded-lg border ${
                              deltaLoss <= 0
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            Δ Loss: {deltaLoss >= 0 ? '+' : ''}
                            {deltaLoss.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {(config.includeChartsInView ||
                    config.includeRadarChart ||
                    config.includeConfusionMatrix) && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      {config.includeChartsInView && epochMetrics.length > 1 && (
                        <div className="md:col-span-5">
                          <MiniConvergenceChart metrics={epochMetrics} />
                        </div>
                      )}

                      {config.includeRadarChart && (
                        <div
                          className={
                            config.includeChartsInView && epochMetrics.length > 1
                              ? 'md:col-span-4'
                              : 'md:col-span-6'
                          }
                        >
                          <MetricRadarSvg
                            accuracy={displayAcc ?? 0.75}
                            precision={resolvedMetrics?.precision ?? displayAcc ?? 0.75}
                            recall={resolvedMetrics?.recall ?? displayAcc ?? 0.75}
                            f1={resolvedMetrics?.f1_score ?? displayAcc ?? 0.75}
                            health={diagnostic.healthScore / 100}
                          />
                        </div>
                      )}

                      {config.includeConfusionMatrix &&
                        resolvedModel?.confusion_matrix &&
                        resolvedModel.confusion_matrix.length > 0 && (
                          <div
                            className={`${
                              config.includeChartsInView && epochMetrics.length > 1
                                ? 'md:col-span-3'
                                : 'md:col-span-6'
                            } bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-2 flex flex-col justify-between`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-300 flex items-center gap-1">
                                <span>Matriz Test</span>
                                <InfoTip
                                  text="Diagonal verde = aciertos por clase; celdas rojas = falsos positivos/negativos."
                                  size="xs"
                                />
                              </span>
                            </div>
                            <div className="overflow-x-auto my-auto">
                              <table className="mx-auto border-separate border-spacing-1 text-xs font-mono">
                                <thead>
                                  <tr>
                                    <th className="w-8"></th>
                                    {resolvedModel.confusion_matrix[0].map((_, ci) => (
                                      <th
                                        key={ci}
                                        className="text-[9.5px] text-slate-400 px-1.5 pb-0.5"
                                      >
                                        P{ci}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {resolvedModel.confusion_matrix.map((row, ri) => (
                                    <tr key={ri}>
                                      <td className="text-[9.5px] text-slate-400 pr-1 text-right">
                                        R{ri}
                                      </td>
                                      {row.map((val, ci) => (
                                        <td
                                          key={ci}
                                          className={`px-2 py-1 rounded-lg text-center font-bold ${
                                            ri === ci
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                          }`}
                                        >
                                          {val}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {config.includePerClassMetrics && perClass.length > 0 && (
                    <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <span className="text-[11px] font-bold text-slate-300 block">
                        Desempeño Detallado por Clase (Desde Matriz de Confusión Test)
                      </span>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                              <th className="py-1.5 text-left">Clase</th>
                              <th className="py-1.5 text-right">Soporte</th>
                              <th className="py-1.5 text-right">Predichos</th>
                              <th className="py-1.5 text-right">Precision</th>
                              <th className="py-1.5 text-right">Recall</th>
                              <th className="py-1.5 text-right">F1-Score</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-[11px]">
                            {perClass.map(c => (
                              <tr key={c.classLabel}>
                                <td className="py-1.5 font-sans font-bold text-white">
                                  {c.classLabel}
                                </td>
                                <td className="py-1.5 text-right text-slate-300">{c.support}</td>
                                <td className="py-1.5 text-right text-slate-300">{c.predicted}</td>
                                <td className="py-1.5 text-right text-indigo-300">
                                  {(c.precision * 100).toFixed(1)}%
                                </td>
                                <td className="py-1.5 text-right text-cyan-300">
                                  {(c.recall * 100).toFixed(1)}%
                                </td>
                                <td className="py-1.5 text-right font-bold text-emerald-300">
                                  {(c.f1 * 100).toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Recomendaciones Técnicas del Motor</span>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                      {diagnostic.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No hay ejecuciones completadas para extraer métricas.
                </p>
              )}
            </section>
          )
        }

        if (key === 'epochHistory') {
          return (
            <EpochHistorySection
              key={key}
              sectionNum={secNum}
              activeJob={activeJob}
              epochMetrics={epochMetrics}
              maxEpochs={config.maxEpochsInTable}
              headerActions={renderSectionActions(key)}
            />
          )
        }

        if (key === 'experimentsRanking') {
          return (
            <ExperimentsRankingSection
              key={key}
              sectionNum={secNum}
              jobs={jobs}
              models={models}
              activeJobId={activeJob?.id}
              headerActions={renderSectionActions(key)}
            />
          )
        }

        if (key === 'roiImpact') {
          const maxQuarterly = Math.max(...quarterlyRoi.map(q => q.cumulativeUsd), 1)
          return (
            <section
              key={key}
              className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-extrabold font-mono flex items-center justify-center">
                    {secNum}
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span>Simulador de Impacto Operativo &amp; ROI Financiero</span>
                    <InfoTip
                      title="Proyección de Retorno de Inversión (ROI)"
                      text="Calcula el impacto económico mensual, trimestral y anual combinando la tasa de detección real del modelo (Recall/Accuracy) con el volumen de operaciones."
                      size="xs"
                    />
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold">
                    Detección Efectiva: {roi.effectiveDetectionPct.toFixed(1)}%
                  </span>
                  {renderSectionActions(key)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 nl-no-print">
                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold">Volumen Mensual</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {config.monthlyVolumeUnits.toLocaleString('es')}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={100000}
                    step={1000}
                    value={config.monthlyVolumeUnits}
                    onChange={e =>
                      onChangeConfig({ ...config, monthlyVolumeUnits: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>

                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold">Costo / Riesgo (USD)</span>
                    <span className="font-mono font-bold text-amber-300">
                      ${config.unitRiskCostUsd} USD
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={350}
                    step={5}
                    value={config.unitRiskCostUsd}
                    onChange={e =>
                      onChangeConfig({ ...config, unitRiskCostUsd: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>

                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold">Éxito Intervención</span>
                    <span className="font-mono font-bold text-emerald-300">
                      {config.interventionSuccessPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={5}
                    value={config.interventionSuccessPct}
                    onChange={e =>
                      onChangeConfig({ ...config, interventionSuccessPct: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Casos en Riesgo / Mes
                  </span>
                  <span className="text-lg font-extrabold font-mono text-slate-200 mt-1 block">
                    {roi.baseCasesAtRisk.toLocaleString('es')}
                  </span>
                </div>
                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Detectados por Keras
                  </span>
                  <span className="text-lg font-extrabold font-mono text-cyan-400 mt-1 block">
                    {roi.detectedCases.toLocaleString('es')}
                  </span>
                </div>
                <div className="bg-slate-950/75 border border-emerald-500/30 rounded-xl p-3">
                  <span className="text-[10px] font-bold uppercase text-emerald-300/80 block">
                    Ahorro Mensual Est.
                  </span>
                  <span className="text-lg font-extrabold font-mono text-emerald-400 mt-1 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {roi.monthlySavingsUsd.toLocaleString('es')}
                  </span>
                </div>
                <div className="bg-slate-950/75 border border-amber-500/30 rounded-xl p-3">
                  <span className="text-[10px] font-bold uppercase text-amber-300/80 block">
                    Impacto Anual (12m)
                  </span>
                  <span className="text-lg font-extrabold font-mono text-amber-300 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />${roi.annualSavingsUsd.toLocaleString('es')}
                  </span>
                </div>
              </div>

              {config.includeRoiQuarterlyChart && (
                <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Proyección Acumulada por Trimestre (Q1–Q4)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    {quarterlyRoi.map(q => (
                      <div key={q.quarter} className="space-y-1">
                        <div className="flex items-center justify-between text-[10.5px] font-mono">
                          <span className="text-slate-400">{q.quarter}</span>
                          <span className="text-amber-300 font-bold">
                            ${q.cumulativeUsd.toLocaleString('es')}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                            style={{ width: `${Math.max(8, (q.cumulativeUsd / maxQuarterly) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        }

        if (key === 'modelRegistry') {
          return (
            <section
              key={key}
              className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-extrabold font-mono flex items-center justify-center">
                    {secNum}
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-400">
                    Model Registry e Integridad Criptográfica
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-slate-400">
                    {models.length} versión(es) en repositorio
                  </span>
                  {renderSectionActions(key)}
                </div>
              </div>

              {resolvedModel ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Versión Seleccionada
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-extrabold font-mono text-purple-300">
                          {resolvedModel.version}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                          Inmutable
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Estado de Gobernanza
                      </span>
                      <span className="text-sm font-bold text-emerald-400 mt-1 block">
                        {resolvedModel.status}
                      </span>
                    </div>
                    <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Fecha de Registro
                      </span>
                      <span className="text-sm font-medium text-slate-200 mt-1 block">
                        {new Date(resolvedModel.created_at).toLocaleString('es-ES', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-400 font-semibold shrink-0">SHA-256:</span>
                      <code className="font-mono text-slate-200 truncate">
                        {resolvedModel.checksum}
                      </code>
                    </div>
                    <button
                      onClick={() => onCopy('registry-hash', resolvedModel.checksum)}
                      className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 shrink-0 nl-no-print"
                    >
                      {copiedKey === 'registry-hash' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'registry-hash' ? 'Hash copiado' : 'Copiar firma'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No hay modelos registrados en el repositorio.
                </p>
              )}

              <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <MessageSquareText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Observaciones y Dictamen del Revisor</span>
                    <InfoTip
                      text="Estas notas ejecutivas se incluyen automáticamente al exportar el PDF Certificado, HTML, JSON o Resumen Markdown."
                      size="xs"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-1.5 nl-no-print">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Plantillas:</span>
                    </span>
                    {AUDITOR_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => onAuditorNotesChange(tpl.text)}
                        className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-semibold text-cyan-300 transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={auditorNotes}
                  onChange={e => onAuditorNotesChange(e.target.value)}
                  placeholder="Ej.: Modelo validado para despliegue piloto; estabilidad verificada sobre partición Test aislada..."
                  className="w-full bg-slate-900/90 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none resize-y"
                />
              </div>
            </section>
          )
        }

        if (key === 'complianceChecklist') {
          return (
            <section
              key={key}
              className="nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400 text-xs font-extrabold font-mono flex items-center justify-center">
                    {secNum}
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                    <span>Checklist de Gobernanza IA &amp; Cumplimiento (ISO/IEC 42001)</span>
                    <InfoTip
                      title="Matriz de Conformidad MLOps"
                      text="Controles verificados automáticamente contra el pipeline y controles personalizados agregables antes de exportar."
                      size="xs"
                    />
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 font-mono font-bold">
                    {passedChecksCount}/{complianceChecks.length} Cumplidos
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenCustomizer('blocks')}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-teal-300 text-[11px] font-bold nl-no-print"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Control</span>
                  </button>
                  {renderSectionActions(key)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {complianceChecks.map(item => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleComplianceCheck(item.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onToggleComplianceCheck(item.id)
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      item.passed
                        ? 'bg-slate-950/85 border-emerald-500/35 hover:border-emerald-400/60'
                        : 'bg-slate-950/60 border-amber-500/30 hover:border-amber-400/50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 ${
                        item.passed
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                      }`}
                    >
                      {item.passed ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <ClipboardCheck className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">{item.title}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            {item.category}
                          </span>
                          {item.isCustom && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation()
                                onDeleteCustomCheck(item.id)
                              }}
                              className="text-rose-400 hover:text-rose-300 p-0.5 nl-no-print"
                              title="Eliminar control"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {config.includeSignaturesBlock && signers.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <FileSignature className="w-3.5 h-3.5 text-teal-400" />
                      <span>Bloque de Firmas y Aprobación Oficial ({signers.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenCustomizer('signatures')}
                      className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 nl-no-print"
                    >
                      Editar firmantes
                    </button>
                  </div>
                  <div className={`grid ${sigGridCls} gap-3 text-center`}>
                    {signers.map(sig => (
                      <div
                        key={sig.id}
                        className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 space-y-1.5"
                      >
                        <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                          {sig.stamp}
                        </span>
                        <p className="text-xs font-bold text-white truncate pt-1">{sig.name}</p>
                        <div className="border-t border-dashed border-slate-700 pt-1 text-[10px] text-slate-400">
                          {sig.role}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        }

        if (key === 'customSections') {
          return (
            <CustomBlocksSection
              key={key}
              sectionNum={secNum}
              customBlocks={config.customBlocks}
              onOpenBlocksCustomizer={() => onOpenCustomizer('blocks')}
              headerActions={renderSectionActions(key)}
            />
          )
        }

        return (
          <AuditLogSection
            key={key}
            auditEvents={auditEvents}
            sectionNumber={secNum}
            headerActions={renderSectionActions(key)}
          />
        )
      })}
    </>
  )
}
