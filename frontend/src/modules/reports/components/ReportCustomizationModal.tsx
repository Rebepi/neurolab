import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  ClipboardCheck,
  DollarSign,
  FilePlus2,
  FileSignature,
  LayoutGrid,
  Palette,
  Plus,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'
import {
  CUSTOM_BLOCK_TEMPLATES,
  DEFAULT_REPORT_CONFIG,
  PDF_THEME_COLORS,
} from '../constants'
import type {
  ComplianceCheckItem,
  ConfidentialityLevel,
  CustomBlockKind,
  CustomBlockTone,
  CustomReportBlock,
  PdfAccentTheme,
  ReportCustomizationConfig,
  ReportSignature,
} from '../types'

export type CustomizerTab = 'identity' | 'elements' | 'signatures' | 'blocks'

interface ReportCustomizationModalProps {
  initialTab?: CustomizerTab
  config: ReportCustomizationConfig
  onChange: (next: ReportCustomizationConfig) => void
  onReset: () => void
  complianceChecks: ComplianceCheckItem[]
  onToggleComplianceCheck: (id: string) => void
  onAddCustomCheck: (chk: Omit<ComplianceCheckItem, 'id' | 'autoVerified' | 'isCustom'>) => void
  onRemoveCustomCheck: (id: string) => void
  onClose: () => void
}

const CONFIDENTIALITY_OPTIONS: ConfidentialityLevel[] = [
  'CONFIDENCIAL CORPORATIVO',
  'COMITÉ DIRECTIVO',
  'USO INTERNO TÉCNICO',
  'AUDITORÍA EXTERNA ISO/SOC2',
]

const KIND_OPTIONS: Array<{ value: CustomBlockKind; label: string }> = [
  { value: 'callout', label: 'Nota / Dictamen Destacado' },
  { value: 'bullets', label: 'Lista de Puntos / Roadmap' },
  { value: 'kv_metrics', label: 'Tarjetas KPI (Etiqueta: Valor)' },
  { value: 'table', label: 'Tabla de Datos (Columnas | )' },
]

const TONE_OPTIONS: Array<{ value: CustomBlockTone; label: string; dot: string }> = [
  { value: 'teal', label: 'Turquesa', dot: '#2dd4bf' },
  { value: 'cyan', label: 'Cian', dot: '#22d3ee' },
  { value: 'indigo', label: 'Índigo', dot: '#818cf8' },
  { value: 'emerald', label: 'Esmeralda', dot: '#34d399' },
  { value: 'amber', label: 'Ámbar', dot: '#fbbf24' },
  { value: 'rose', label: 'Rosa', dot: '#fb7185' },
]

const BLOCK_PLACEHOLDER: Record<CustomBlockKind, string> = {
  callout: 'Escribe el texto ejecutivo o dictamen que aparecerá resaltado...',
  bullets: 'Escribe un punto por línea.\nEjemplo:\nFase 1: Piloto Canary 10%\nFase 2: Despliegue Total',
  kv_metrics:
    'Una métrica por línea con formato Etiqueta: Valor | Nota\nEjemplo:\nLatencia P95: 42 ms | Objetivo < 100 ms\nDisponibilidad: 99.95% | SLA Mensual',
  table:
    'Primera línea = encabezados separados por |\nEjemplo:\nRiesgo | Nivel | Mitigación\nData Drift | Alto | Reentrenar cada 30 días',
}

export function ReportCustomizationModal({
  initialTab = 'identity',
  config,
  onChange,
  onReset,
  complianceChecks,
  onToggleComplianceCheck,
  onAddCustomCheck,
  onRemoveCustomCheck,
  onClose,
}: ReportCustomizationModalProps) {
  const [activeTab, setActiveTab] = useState<CustomizerTab>(initialTab)
  const [newCheckCategory, setNewCheckCategory] = useState<'Datos' | 'Modelo' | 'Seguridad' | 'Gobernanza'>('Gobernanza')
  const [newCheckTitle, setNewCheckTitle] = useState('')
  const [newCheckDesc, setNewCheckDesc] = useState('')

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

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

  const updateField = <K extends keyof ReportCustomizationConfig>(
    key: K,
    value: ReportCustomizationConfig[K]
  ) => {
    onChange({ ...config, [key]: value })
  }

  const updateSignatures = (nextSigs: ReportSignature[]) => {
    onChange({
      ...config,
      signatures: nextSigs,
      authorName: nextSigs[0]?.name || config.authorName,
      reviewerName: nextSigs[1]?.name || config.reviewerName,
      approverRole: nextSigs[2]?.name || config.approverRole,
    })
  }

  const addSignature = () => {
    if (config.signatures.length >= 4) return
    updateSignatures([
      ...config.signatures,
      {
        id: `sig-${Date.now()}`,
        name: 'Director de Área Corporativa',
        role: 'Aprobación Adicional',
        stamp: 'APROBADO',
      },
    ])
  }

  const removeSignature = (id: string) => {
    if (config.signatures.length <= 1) return
    updateSignatures(config.signatures.filter(s => s.id !== id))
  }

  const addBlockFromTemplate = (tpl?: (typeof CUSTOM_BLOCK_TEMPLATES)[number]) => {
    const nextBlock: CustomReportBlock = tpl
      ? {
          id: `blk-${Date.now()}`,
          title: tpl.title,
          subtitle: tpl.subtitle,
          kind: tpl.kind,
          tone: tpl.tone,
          content: tpl.content,
          enabled: true,
        }
      : {
          id: `blk-${Date.now()}`,
          title: 'Nueva Sección Personalizada',
          subtitle: 'Resumen o análisis adicional agregado por el usuario',
          kind: 'callout',
          tone: 'cyan',
          content: 'Describe aquí tus conclusiones, acuerdos de despliegue o hallazgos adicionales.',
          enabled: true,
        }
    updateField('customBlocks', [...config.customBlocks, nextBlock])
  }

  const updateBlock = (id: string, patch: Partial<CustomReportBlock>) => {
    updateField(
      'customBlocks',
      config.customBlocks.map(b => (b.id === id ? { ...b, ...patch } : b))
    )
  }

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= config.customBlocks.length) return
    const copy = [...config.customBlocks]
    const [item] = copy.splice(idx, 1)
    copy.splice(target, 0, item)
    updateField('customBlocks', copy)
  }

  const removeBlock = (id: string) => {
    updateField(
      'customBlocks',
      config.customBlocks.filter(b => b.id !== id)
    )
  }

  const handleAddCheck = () => {
    if (!newCheckTitle.trim()) return
    onAddCustomCheck({
      category: newCheckCategory,
      title: newCheckTitle.trim(),
      description: newCheckDesc.trim() || 'Control adicional configurado por el auditor responsable.',
      passed: true,
    })
    setNewCheckTitle('')
    setNewCheckDesc('')
  }

  const tabs: Array<{ id: CustomizerTab; label: string; Icon: any; badge?: number }> = [
    { id: 'identity', label: 'Identidad & PDF', Icon: Building2 },
    { id: 'elements', label: 'Elementos & Gráficos', Icon: LayoutGrid },
    { id: 'signatures', label: 'Firmas & SLA/ROI', Icon: FileSignature, badge: config.signatures.length },
    { id: 'blocks', label: 'Bloques & Checklist', Icon: FilePlus2, badge: config.customBlocks.length },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-customizer-title"
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-amber-500/30 bg-[#070f21] text-slate-100 shadow-[0_24px_90px_rgba(2,6,23,0.92)] overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
          <div className="h-[2px] w-full bg-gradient-to-r from-amber-400 via-teal-400 to-indigo-500" />
        </div>

        <div className="px-5 py-3.5 border-b border-white/10 bg-slate-900/55 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="report-customizer-title" className="text-base font-bold text-white truncate">
                  Estudio de Personalización Total del Informe &amp; PDF
                </h2>
                <InfoTip
                  title="Personalización Granular"
                  text="Controla diseño de página, qué tablas o gráficos se muestran, firmantes ilimitados, umbrales SLA/ROI, bloques propios (tablas, KPIs, listas) y controles del checklist."
                  size="xs"
                />
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Todos los ajustes se guardan automáticamente y aplican al PDF, HTML, JSON y vista previa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Restaurar todo</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar personalización"
              className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-white/10 bg-slate-950/60 flex flex-wrap items-center gap-1.5 shrink-0">
          {tabs.map(tab => {
            const active = activeTab === tab.id
            const Icon = tab.Icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-white shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-cyan-300' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'identity' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="nl-cyber-panel rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <span>Membrete y Datos del Documento</span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Título Principal
                    </label>
                    <input
                      type="text"
                      value={config.reportTitle}
                      onChange={e => updateField('reportTitle', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Subtítulo / Alcance Técnico
                    </label>
                    <input
                      type="text"
                      value={config.reportSubtitle}
                      onChange={e => updateField('reportSubtitle', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Organización / Empresa
                      </label>
                      <input
                        type="text"
                        value={config.organizationName}
                        onChange={e => updateField('organizationName', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Unidad / Departamento
                      </label>
                      <input
                        type="text"
                        value={config.departmentName}
                        onChange={e => updateField('departmentName', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Código Doc.
                      </label>
                      <input
                        type="text"
                        value={config.documentCode}
                        onChange={e => updateField('documentCode', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Versión Doc.
                      </label>
                      <input
                        type="text"
                        value={config.reportVersion}
                        onChange={e => updateField('reportVersion', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Confidencialidad
                      </label>
                      <SystemSelect
                        value={config.confidentiality}
                        onChange={v => updateField('confidentiality', v as ConfidentialityLevel)}
                        size="xs"
                        ariaLabel="Nivel de Confidencialidad"
                        options={CONFIDENTIALITY_OPTIONS.map(c => ({ value: c, label: c }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="nl-cyber-panel rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-300 uppercase tracking-wider">
                  <Palette className="w-4 h-4 text-teal-400" />
                  <span>Diseño del PDF (Color, Formato y Estilo)</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Color de Acento Corporativo
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {(Object.keys(PDF_THEME_COLORS) as PdfAccentTheme[]).map(themeKey => {
                      const item = PDF_THEME_COLORS[themeKey]
                      const active = config.accentTheme === themeKey
                      return (
                        <button
                          key={themeKey}
                          type="button"
                          onClick={() => updateField('accentTheme', themeKey)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                            active
                              ? item.pillCls
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.hex }}
                          />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Orientación de Página
                    </label>
                    <SystemSelect
                      value={config.pdfOrientation}
                      onChange={v => updateField('pdfOrientation', v as 'portrait' | 'landscape')}
                      size="xs"
                      ariaLabel="Orientación de Página"
                      options={[
                        { value: 'portrait', label: 'Vertical (A4)' },
                        { value: 'landscape', label: 'Horizontal (A4 Apaisado)' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Estilo de Cabecera PDF
                    </label>
                    <SystemSelect
                      value={config.pdfHeaderStyle}
                      onChange={v => updateField('pdfHeaderStyle', v as 'dark' | 'light')}
                      size="xs"
                      ariaLabel="Estilo de Cabecera PDF"
                      options={[
                        { value: 'dark', label: 'Oscuro Corporativo' },
                        { value: 'light', label: 'Claro Minimalista' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Densidad del PDF
                    </label>
                    <SystemSelect
                      value={config.pdfDensity}
                      onChange={v => updateField('pdfDensity', v as 'compact' | 'detailed')}
                      size="xs"
                      ariaLabel="Densidad del PDF"
                      options={[
                        { value: 'detailed', label: 'Detallado (Completo)' },
                        { value: 'compact', label: 'Compacto (Ejecutivo)' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'elements' && (
            <div className="space-y-4">
              <div className="nl-cyber-panel rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    <LayoutGrid className="w-4 h-4 text-cyan-400" />
                    <span>Interruptores de Contenido (Añadir / Quitar Elementos)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...config,
                          includeCoverSummary: true,
                          includeRbacMembersTable: true,
                          includeLayerParamsTable: true,
                          includeArchJustification: true,
                          includeChartsInView: true,
                          includeRadarChart: true,
                          includeConfusionMatrix: true,
                          includePerClassMetrics: true,
                          includeRoiQuarterlyChart: true,
                          includePageNumbers: true,
                          includeSignaturesBlock: true,
                          includeWatermark: true,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/35 text-teal-300 font-semibold"
                    >
                      Activar todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {[
                    { key: 'includeCoverSummary' as const, label: 'Portada KPIs & Dictamen Auto' },
                    { key: 'includeRbacMembersTable' as const, label: 'Tabla de Equipo RBAC (Sec. 01)' },
                    { key: 'includeLayerParamsTable' as const, label: 'Tabla Tensores y Parámetros por Capa' },
                    { key: 'includeArchJustification' as const, label: 'Justificación Técnica de Red' },
                    { key: 'includeChartsInView' as const, label: 'Curvas de Convergencia por Época' },
                    { key: 'includeRadarChart' as const, label: 'Gráfico Radar 5 Ejes (Vista + PDF)' },
                    { key: 'includeConfusionMatrix' as const, label: 'Matriz de Confusión en Test' },
                    { key: 'includePerClassMetrics' as const, label: 'Desglose Precision / Recall por Clase' },
                    { key: 'includeRoiQuarterlyChart' as const, label: 'Proyección Trimestral ROI (Q1–Q4)' },
                    { key: 'includeWatermark' as const, label: 'Sello de Confidencialidad' },
                    { key: 'includePageNumbers' as const, label: 'Numeración «Página X de Y» en PDF' },
                    { key: 'includeSignaturesBlock' as const, label: 'Bloque de Firmas Oficiales' },
                  ].map(opt => {
                    const active = config[opt.key]
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => updateField(opt.key, !active)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                          active
                            ? 'bg-teal-500/15 border-teal-500/40 text-white'
                            : 'bg-slate-950/75 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            active
                              ? 'bg-teal-500 border-teal-400 text-slate-950'
                              : 'border-slate-700'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <span className="truncate">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="nl-cyber-panel rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Límites de Filas en Tablas &amp; PDF
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Máx. Variables en Diccionario
                    </label>
                    <SystemSelect
                      value={String(config.maxDictionaryColumns)}
                      onChange={v => updateField('maxDictionaryColumns', Number(v))}
                      size="xs"
                      ariaLabel="Máximo variables en diccionario"
                      options={[
                        { value: '8', label: '8 variables clave' },
                        { value: '15', label: '15 variables' },
                        { value: '50', label: 'Hasta 50 (Completo)' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Máx. Épocas en Tabla
                    </label>
                    <SystemSelect
                      value={String(config.maxEpochsInTable)}
                      onChange={v => updateField('maxEpochsInTable', Number(v))}
                      size="xs"
                      ariaLabel="Máximo épocas en tabla"
                      options={[
                        { value: '10', label: 'Primeras / Últimas 10 épocas' },
                        { value: '15', label: 'Hasta 15 épocas' },
                        { value: '50', label: 'Hasta 50 épocas' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Eventos Auditoría en PDF
                    </label>
                    <SystemSelect
                      value={String(config.maxAuditEventsInPdf)}
                      onChange={v => updateField('maxAuditEventsInPdf', Number(v))}
                      size="xs"
                      ariaLabel="Eventos auditoría en PDF"
                      options={[
                        { value: '6', label: 'Últimos 6 eventos' },
                        { value: '12', label: 'Últimos 12 eventos' },
                        { value: '25', label: 'Últimos 25 eventos' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'signatures' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 nl-cyber-panel rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    <FileSignature className="w-4 h-4 text-indigo-400" />
                    <span>Firmantes Oficiales ({config.signatures.length}/4)</span>
                  </div>
                  <button
                    type="button"
                    disabled={config.signatures.length >= 4}
                    onClick={addSignature}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[11px] font-bold disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Firmante</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {config.signatures.map((sig, idx) => (
                    <div
                      key={sig.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-mono text-cyan-300 font-bold">
                          FIRMANTE #{idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={config.signatures.length <= 1}
                          onClick={() => removeSignature(sig.id)}
                          className="text-rose-400 hover:text-rose-300 disabled:opacity-30 p-1"
                          title="Eliminar firmante"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={sig.name}
                          onChange={e =>
                            updateSignatures(
                              config.signatures.map(s =>
                                s.id === sig.id ? { ...s, name: e.target.value } : s
                              )
                            )
                          }
                          placeholder="Nombre o Comité"
                          className="bg-slate-900 border border-slate-800 focus:border-indigo-400 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                        />
                        <input
                          type="text"
                          value={sig.role}
                          onChange={e =>
                            updateSignatures(
                              config.signatures.map(s =>
                                s.id === sig.id ? { ...s, role: e.target.value } : s
                              )
                            )
                          }
                          placeholder="Cargo o Responsabilidad"
                          className="bg-slate-900 border border-slate-800 focus:border-indigo-400 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                        />
                        <input
                          type="text"
                          value={sig.stamp}
                          onChange={e =>
                            updateSignatures(
                              config.signatures.map(s =>
                                s.id === sig.id ? { ...s, stamp: e.target.value } : s
                              )
                            )
                          }
                          placeholder="Sello (ej. CERTIFICADO)"
                          className="bg-slate-900 border border-slate-800 focus:border-indigo-400 rounded-lg px-2.5 py-1.5 text-xs font-mono text-teal-300 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 nl-cyber-panel rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <span>Política SLA &amp; Parámetros ROI</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Meta SLA Exactitud (%)
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={99}
                      value={config.targetSlaAccuracyPct}
                      onChange={e => updateField('targetSlaAccuracyPct', Number(e.target.value || 75))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs font-mono text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Máx. Brecha Overfit
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      max={0.5}
                      step={0.01}
                      value={config.maxAllowedOverfitGap}
                      onChange={e => updateField('maxAllowedOverfitGap', Number(e.target.value || 0.08))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs font-mono text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Volumen Mensual
                    </label>
                    <input
                      type="number"
                      min={100}
                      step={500}
                      value={config.monthlyVolumeUnits}
                      onChange={e => updateField('monthlyVolumeUnits', Number(e.target.value || 15000))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs font-mono text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Costo por Riesgo (USD)
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={5}
                      value={config.unitRiskCostUsd}
                      onChange={e => updateField('unitRiskCostUsd', Number(e.target.value || 45))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs font-mono text-white outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Tasa de Éxito de Intervención ({config.interventionSuccessPct}%)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={5}
                      value={config.interventionSuccessPct}
                      onChange={e => updateField('interventionSuccessPct', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'blocks' && (
            <div className="space-y-4">
              <div className="nl-cyber-panel rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-300 uppercase tracking-wider">
                    <FilePlus2 className="w-4 h-4 text-orange-400" />
                    <span>Constructor de Bloques Personalizados ({config.customBlocks.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => addBlockFromTemplate()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/45 text-teal-200 text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Bloque Vacío</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] text-slate-400 flex items-center gap-1 mr-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Insertar plantilla rápida:</span>
                  </span>
                  {CUSTOM_BLOCK_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.title}
                      type="button"
                      onClick={() => addBlockFromTemplate(tpl)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-cyan-300 transition-colors"
                    >
                      + {tpl.title}
                    </button>
                  ))}
                </div>

                {config.customBlocks.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                    No has añadido bloques propios aún. Usa una plantilla rápida arriba o pulsa «Bloque Vacío» para agregar secciones al informe y PDF.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {config.customBlocks.map((blk, idx) => (
                      <div
                        key={blk.id}
                        className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateBlock(blk.id, { enabled: !blk.enabled })}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                blk.enabled
                                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                  : 'bg-slate-900 border-slate-700 text-slate-400'
                              }`}
                            >
                              {blk.enabled ? 'Visible en Informe/PDF' : 'Oculto'}
                            </button>
                            <span className="text-[11px] font-mono text-slate-400">
                              Bloque #{idx + 1}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveBlock(idx, -1)}
                              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === config.customBlocks.length - 1}
                              onClick={() => moveBlock(idx, 1)}
                              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBlock(blk.id)}
                              className="p-1 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              value={blk.title}
                              onChange={e => updateBlock(blk.id, { title: e.target.value })}
                              placeholder="Título del bloque"
                              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <SystemSelect
                              value={blk.kind}
                              onChange={v => updateBlock(blk.id, { kind: v as CustomBlockKind })}
                              size="xs"
                              ariaLabel="Tipo de bloque"
                              options={KIND_OPTIONS}
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <SystemSelect
                              value={blk.tone}
                              onChange={v => updateBlock(blk.id, { tone: v as CustomBlockTone })}
                              size="xs"
                              ariaLabel="Color de bloque"
                              options={TONE_OPTIONS.map(t => ({ value: t.value, label: t.label }))}
                            />
                          </div>
                        </div>

                        <input
                          type="text"
                          value={blk.subtitle}
                          onChange={e => updateBlock(blk.id, { subtitle: e.target.value })}
                          placeholder="Subtítulo o descripción breve..."
                          className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 outline-none"
                        />

                        <textarea
                          rows={3}
                          value={blk.content}
                          onChange={e => updateBlock(blk.id, { content: e.target.value })}
                          placeholder={BLOCK_PLACEHOLDER[blk.kind]}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none resize-y"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="nl-cyber-panel rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-300 uppercase tracking-wider">
                  <ClipboardCheck className="w-4 h-4 text-teal-400" />
                  <span>Checklist Personalizable de Gobernanza IA ({complianceChecks.length})</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-2">
                    <SystemSelect
                      value={newCheckCategory}
                      onChange={v => setNewCheckCategory(v as any)}
                      size="xs"
                      ariaLabel="Categoría de control"
                      options={[
                        { value: 'Gobernanza', label: 'Gobernanza' },
                        { value: 'Modelo', label: 'Modelo' },
                        { value: 'Datos', label: 'Datos' },
                        { value: 'Seguridad', label: 'Seguridad' },
                      ]}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={newCheckTitle}
                      onChange={e => setNewCheckTitle(e.target.value)}
                      placeholder="Nuevo control de auditoría..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-400"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={newCheckDesc}
                      onChange={e => setNewCheckDesc(e.target.value)}
                      placeholder="Criterio o evidencia requerida..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-teal-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddCheck}
                      disabled={!newCheckTitle.trim()}
                      className="w-full h-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 text-xs font-bold disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {complianceChecks.map(chk => (
                    <div
                      key={chk.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/75 border border-slate-800 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleComplianceCheck(chk.id)}
                        className="flex items-center gap-2 min-w-0 text-left flex-1"
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            chk.passed
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                              : 'border-amber-400/60'
                          }`}
                        >
                          {chk.passed && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <span className="truncate font-semibold text-slate-200">{chk.title}</span>
                      </button>
                      {chk.isCustom && (
                        <button
                          type="button"
                          onClick={() => onRemoveCustomCheck(chk.id)}
                          className="text-rose-400 hover:text-rose-300 p-1 shrink-0"
                          title="Eliminar control personalizado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-slate-900/65 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong className="text-slate-200">{config.documentCode}</strong> ·{' '}
              <strong className="text-cyan-300">
                {config.pdfOrientation === 'landscape' ? 'Horizontal A4' : 'Vertical A4'}
              </strong>{' '}
              · SLA{' '}
              <strong className="text-amber-300">
                {DEFAULT_REPORT_CONFIG.targetSlaAccuracyPct === config.targetSlaAccuracyPct
                  ? `${config.targetSlaAccuracyPct}%`
                  : `${config.targetSlaAccuracyPct}% (Personalizado)`}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="nl-btn-shimmer px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg transition-all"
          >
            Guardar y Aplicar al Informe
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
