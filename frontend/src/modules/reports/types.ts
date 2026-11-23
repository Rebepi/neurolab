export type SectionKey =
  | 'projectContext'
  | 'datasetEda'
  | 'featureDictionary'
  | 'networkArch'
  | 'trainingMetrics'
  | 'epochHistory'
  | 'experimentsRanking'
  | 'roiImpact'
  | 'modelRegistry'
  | 'complianceChecklist'
  | 'customSections'
  | 'auditTrail'

export type VerdictTone = 'optimal' | 'warning' | 'critical' | 'neutral'

export type ReportTemplatePreset = 'full' | 'executive' | 'technical' | 'compliance' | 'custom'

export type PdfAccentTheme = 'teal' | 'cyan' | 'indigo' | 'amber' | 'rose'

export type PdfOrientation = 'portrait' | 'landscape'

export type PdfDensity = 'compact' | 'detailed'

export type PdfHeaderStyle = 'dark' | 'light'

export type ConfidentialityLevel =
  | 'CONFIDENCIAL CORPORATIVO'
  | 'USO INTERNO TÉCNICO'
  | 'COMITÉ DIRECTIVO'
  | 'AUDITORÍA EXTERNA ISO/SOC2'

export type CustomBlockKind = 'callout' | 'bullets' | 'kv_metrics' | 'table'

export type CustomBlockTone = 'teal' | 'cyan' | 'indigo' | 'amber' | 'rose' | 'emerald'

export interface CustomReportBlock {
  id: string
  title: string
  subtitle: string
  kind: CustomBlockKind
  tone: CustomBlockTone
  content: string
  enabled: boolean
}

export interface ReportSignature {
  id: string
  name: string
  role: string
  stamp: string
}

export interface ReportCustomizationConfig {
  reportTitle: string
  reportSubtitle: string
  organizationName: string
  departmentName: string
  documentCode: string
  reportVersion: string
  authorName: string
  reviewerName: string
  approverRole: string
  confidentiality: ConfidentialityLevel
  accentTheme: PdfAccentTheme
  pdfOrientation: PdfOrientation
  pdfDensity: PdfDensity
  pdfHeaderStyle: PdfHeaderStyle
  includeCoverSummary: boolean
  includeRbacMembersTable: boolean
  includeLayerParamsTable: boolean
  includeArchJustification: boolean
  includeChartsInView: boolean
  includeRadarChart: boolean
  includeConfusionMatrix: boolean
  includePerClassMetrics: boolean
  includeRoiQuarterlyChart: boolean
  includePageNumbers: boolean
  includeSignaturesBlock: boolean
  includeWatermark: boolean
  maxDictionaryColumns: number
  maxAuditEventsInPdf: number
  maxEpochsInTable: number
  targetSlaAccuracyPct: number
  maxAllowedOverfitGap: number
  monthlyVolumeUnits: number
  unitRiskCostUsd: number
  interventionSuccessPct: number
  signatures: ReportSignature[]
  customBlocks: CustomReportBlock[]
}

export interface ComplianceCheckItem {
  id: string
  category: 'Datos' | 'Modelo' | 'Seguridad' | 'Gobernanza'
  title: string
  description: string
  passed: boolean
  autoVerified: boolean
  isCustom?: boolean
}

export interface PerClassMetric {
  classLabel: string
  tp: number
  fp: number
  fn: number
  support: number
  predicted: number
  precision: number
  recall: number
  f1: number
}

export interface LayerBreakdownRow {
  index: number
  layerName: string
  type: string
  inputShape: string
  outputShape: string
  activation: string
  params: number
}

export interface ExecutiveDiagnostic {
  verdict: string
  tone: VerdictTone
  healthScore: number
  summary: string
  recommendations: string[]
  overfitGap: number | null
  slaPassed: boolean
}
