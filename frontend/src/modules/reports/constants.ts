import {
  Activity,
  Award,
  BarChart3,
  ClipboardCheck,
  Database,
  DollarSign,
  FilePlus2,
  FileText,
  Layers,
  Package,
  ScrollText,
  TableProperties,
} from 'lucide-react'
import type {
  CustomBlockKind,
  CustomBlockTone,
  PdfAccentTheme,
  ReportCustomizationConfig,
  ReportSignature,
  SectionKey,
} from './types'

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'projectContext',
  'datasetEda',
  'featureDictionary',
  'networkArch',
  'trainingMetrics',
  'epochHistory',
  'experimentsRanking',
  'roiImpact',
  'modelRegistry',
  'complianceChecklist',
  'customSections',
  'auditTrail',
]

export const SECTION_META: Array<{
  key: SectionKey
  num: string
  label: string
  desc: string
  Icon: any
  colorCls: string
  activeBoxCls: string
}> = [
  {
    key: 'projectContext',
    num: '01',
    label: 'Contexto y Equipo RBAC',
    desc: 'Identidad, integrantes y alcance',
    Icon: FileText,
    colorCls: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/35',
    activeBoxCls: 'border-indigo-500/45 bg-indigo-500/10',
  },
  {
    key: 'datasetEda',
    num: '02',
    label: 'Dataset, Calidad y Splits',
    desc: 'Splits 70/15/15, nulos y escalado',
    Icon: Database,
    colorCls: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/35',
    activeBoxCls: 'border-cyan-500/45 bg-cyan-500/10',
  },
  {
    key: 'featureDictionary',
    num: '03',
    label: 'Diccionario de Variables',
    desc: 'Esquema, rangos, medias y tipos',
    Icon: TableProperties,
    colorCls: 'text-sky-400 bg-sky-500/15 border-sky-500/35',
    activeBoxCls: 'border-sky-500/45 bg-sky-500/10',
  },
  {
    key: 'networkArch',
    num: '04',
    label: 'Topología y Capas Keras',
    desc: 'Diagrama, tensores y parámetros',
    Icon: Layers,
    colorCls: 'text-violet-400 bg-violet-500/15 border-violet-500/35',
    activeBoxCls: 'border-violet-500/45 bg-violet-500/10',
  },
  {
    key: 'trainingMetrics',
    num: '05',
    label: 'Métricas, Radar y Clases',
    desc: 'Test sellado, matriz y F1 por clase',
    Icon: Activity,
    colorCls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35',
    activeBoxCls: 'border-emerald-500/45 bg-emerald-500/10',
  },
  {
    key: 'epochHistory',
    num: '06',
    label: 'Historial por Época',
    desc: 'Evolución Loss/Val Acc e hiperparámetros',
    Icon: BarChart3,
    colorCls: 'text-lime-400 bg-lime-500/15 border-lime-500/35',
    activeBoxCls: 'border-lime-500/45 bg-lime-500/10',
  },
  {
    key: 'experimentsRanking',
    num: '07',
    label: 'Ranking de Experimentos',
    desc: 'Comparativa histórica de corridas',
    Icon: Award,
    colorCls: 'text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/35',
    activeBoxCls: 'border-fuchsia-500/45 bg-fuchsia-500/10',
  },
  {
    key: 'roiImpact',
    num: '08',
    label: 'Simulador Financiero & ROI',
    desc: 'Ahorro proyectado y flujo Q1–Q4',
    Icon: DollarSign,
    colorCls: 'text-amber-400 bg-amber-500/15 border-amber-500/35',
    activeBoxCls: 'border-amber-500/45 bg-amber-500/10',
  },
  {
    key: 'modelRegistry',
    num: '09',
    label: 'Model Registry y SHA-256',
    desc: 'Inmutabilidad, dictamen y firma digital',
    Icon: Package,
    colorCls: 'text-purple-400 bg-purple-500/15 border-purple-500/35',
    activeBoxCls: 'border-purple-500/45 bg-purple-500/10',
  },
  {
    key: 'complianceChecklist',
    num: '10',
    label: 'Checklist Gobernanza ISO',
    desc: 'Controles ISO/IEC 42001 y firmas',
    Icon: ClipboardCheck,
    colorCls: 'text-teal-400 bg-teal-500/15 border-teal-500/35',
    activeBoxCls: 'border-teal-500/45 bg-teal-500/10',
  },
  {
    key: 'customSections',
    num: '11',
    label: 'Bloques Personalizados',
    desc: 'Anexos, tablas y KPIs propios',
    Icon: FilePlus2,
    colorCls: 'text-orange-400 bg-orange-500/15 border-orange-500/35',
    activeBoxCls: 'border-orange-500/45 bg-orange-500/10',
  },
  {
    key: 'auditTrail',
    num: '12',
    label: 'Bitácora de Auditoría',
    desc: 'Trazabilidad cronológica RBAC',
    Icon: ScrollText,
    colorCls: 'text-rose-400 bg-rose-500/15 border-rose-500/35',
    activeBoxCls: 'border-rose-500/45 bg-rose-500/10',
  },
]

export const DEFAULT_SIGNATURES: ReportSignature[] = [
  {
    id: 'sig-author',
    name: 'Admin Principal',
    role: 'Autor Técnico / Data Scientist',
    stamp: 'FIRMADO DIGITALMENTE',
  },
  {
    id: 'sig-reviewer',
    name: 'Comité de Riesgo & Gobernanza IA',
    role: 'Revisión y Validación QA MLOps',
    stamp: 'VALIDADO QA',
  },
  {
    id: 'sig-approver',
    name: 'CISO / Director de Operaciones Telecom',
    role: 'Aprobación Ejecutiva',
    stamp: 'CERTIFICADO OFICIAL',
  },
]

export const CUSTOM_BLOCK_TEMPLATES: Array<{
  title: string
  subtitle: string
  kind: CustomBlockKind
  tone: CustomBlockTone
  content: string
}> = [
  {
    title: 'Plan de Despliegue Canary & Rollback',
    subtitle: 'Estrategia progresiva de liberación en producción sin interrupción de servicio',
    kind: 'bullets',
    tone: 'cyan',
    content:
      'Fase 1 (Semana 1): Enrutar 10% del tráfico productivo al artefacto .keras en modo shadow/canary.\nFase 2 (Semana 2): Escalar a 35% si el PSI (Population Stability Index) es menor a 0.15.\nPlan de Rollback: Reversión automática < 30s ante latencia > 250 ms o caída de Precision bajo SLA.\nMonitoreo continuo de deriva de características y alertas en Prometheus/Slack.',
  },
  {
    title: 'KPIs Estratégicos de Negocio',
    subtitle: 'Indicadores ejecutivos comprometidos tras la puesta en producción',
    kind: 'kv_metrics',
    tone: 'emerald',
    content:
      'Latencia P95 Inferencia: 48 ms | SLA máximo < 120 ms\nCobertura de Automatización: 94.5% | Casos clasificados sin revisión manual\nReducción Churn / Riesgo: -18.4% | Proyección primer trimestre\nDisponibilidad Endpoint: 99.95% | Contenedor FastAPI + TensorFlow',
  },
  {
    title: 'Matriz de Riesgos & Mitigación Operativa',
    subtitle: 'Evaluación preventiva de amenazas técnicas y operacionales del modelo',
    kind: 'table',
    tone: 'amber',
    content:
      'Riesgo Identificado | Severidad | Probabilidad | Plan de Mitigación\nData Drift en variables de consumo | Alta | Media | Re-entrenamiento programado cada 30 días\nCambio de distribución estacional | Media | Media | Monitoreo semanal de F1-Score y alertas SLA\nFalla en nodo de inferencia Keras | Baja | Baja | Réplica activa + healthcheck automático SHA-256',
  },
  {
    title: 'Nota Ejecutiva para Comité Directivo',
    subtitle: 'Síntesis orientada a toma de decisiones presupuestarias y de cumplimiento',
    kind: 'callout',
    tone: 'indigo',
    content:
      'El modelo neuronal certificado ha superado todas las pruebas de aislamiento Test (15%) sin evidencia de fuga de datos ni sobreajuste crítico. Su adopción habilita automatizar alertas preventivas con retorno de inversión positivo desde el primer mes de operación.',
  },
]

export const DEFAULT_REPORT_CONFIG: ReportCustomizationConfig = {
  reportTitle: 'Informe Ejecutivo de Certificación y Auditoría IA',
  reportSubtitle: 'Evaluación de Generalización, Integridad SHA-256 y Gobernanza MLOps',
  organizationName: 'Aura Telecom Enterprise AI Studio',
  departmentName: 'Dirección de Ciencia de Datos & Arquitectura MLOps',
  documentCode: 'NL-DOC-2026-01',
  reportVersion: 'v2.0',
  authorName: 'Admin Principal',
  reviewerName: 'Comité de Riesgo & Gobernanza IA',
  approverRole: 'CISO / Director de Operaciones Telecom',
  confidentiality: 'CONFIDENCIAL CORPORATIVO',
  accentTheme: 'teal',
  pdfOrientation: 'portrait',
  pdfDensity: 'detailed',
  pdfHeaderStyle: 'dark',
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
  maxDictionaryColumns: 15,
  maxAuditEventsInPdf: 8,
  maxEpochsInTable: 15,
  targetSlaAccuracyPct: 75,
  maxAllowedOverfitGap: 0.08,
  monthlyVolumeUnits: 15000,
  unitRiskCostUsd: 45,
  interventionSuccessPct: 35,
  signatures: DEFAULT_SIGNATURES,
  customBlocks: [],
}

export const PDF_THEME_COLORS: Record<
  PdfAccentTheme,
  { label: string; hex: string; rgb: [number, number, number]; pillCls: string }
> = {
  teal: {
    label: 'Turquesa Corporativo',
    hex: '#0d9488',
    rgb: [13, 148, 136],
    pillCls: 'bg-teal-500/20 border-teal-400 text-teal-200',
  },
  cyan: {
    label: 'Cian Cuántico',
    hex: '#0284c7',
    rgb: [2, 132, 199],
    pillCls: 'bg-cyan-500/20 border-cyan-400 text-cyan-200',
  },
  indigo: {
    label: 'Índigo Ejecutivo',
    hex: '#4f46e5',
    rgb: [79, 70, 229],
    pillCls: 'bg-indigo-500/20 border-indigo-400 text-indigo-200',
  },
  amber: {
    label: 'Ámbar Financiero',
    hex: '#d97706',
    rgb: [217, 119, 6],
    pillCls: 'bg-amber-500/20 border-amber-400 text-amber-200',
  },
  rose: {
    label: 'Carmesí Seguridad',
    hex: '#e11d48',
    rgb: [225, 29, 72],
    pillCls: 'bg-rose-500/20 border-rose-400 text-rose-200',
  },
}

export const ACTION_BADGE: Record<string, string> = {
  PROJECT_CREATED: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  DATASET_UPLOADED: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  ARCHITECTURE_CREATED: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
  TRAINING_QUEUED: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  TRAINING_COMPLETED: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  TRAINING_FAILED: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  MODEL_STATUS_CHANGED: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
}
