export type SectionKey =
  | 'projectContext'
  | 'datasetEda'
  | 'networkArch'
  | 'trainingMetrics'
  | 'modelRegistry'
  | 'auditTrail'

export type VerdictTone = 'optimal' | 'warning' | 'critical' | 'neutral'

export interface ExecutiveDiagnostic {
  verdict: string
  tone: VerdictTone
  summary: string
  recommendations: string[]
  overfitGap: number | null
}

