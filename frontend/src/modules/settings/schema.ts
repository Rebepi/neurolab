import type { SystemPolicies, SystemQuotas } from '../../types'

export type NumericQuotaKey =
  | 'max_concurrent_jobs'
  | 'max_epochs_per_job'
  | 'max_dataset_mb'
  | 'max_batch_size'
  | 'retention_days'
  | 'random_seed'

export type NumericPolicyKey = 'min_certification_accuracy' | 'early_stopping_patience'

export interface NumericRange {
  min: number
  max: number
  step: number
  unit?: string
}

export const QUOTA_RANGES: Record<NumericQuotaKey, NumericRange> = {
  max_concurrent_jobs: { min: 1, max: 20, step: 1, unit: 'jobs' },
  max_epochs_per_job: { min: 10, max: 500, step: 10, unit: 'épocas' },
  max_dataset_mb: { min: 5, max: 500, step: 5, unit: 'MB' },
  max_batch_size: { min: 16, max: 512, step: 16, unit: 'muestras' },
  retention_days: { min: 30, max: 365, step: 15, unit: 'días' },
  random_seed: { min: 0, max: 99999, step: 1 },
}

export const POLICY_RANGES: Record<NumericPolicyKey, NumericRange> = {
  min_certification_accuracy: { min: 50, max: 99, step: 1, unit: '%' },
  early_stopping_patience: { min: 2, max: 30, step: 1, unit: 'épocas' },
}

export const SPLIT_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  {
    value: '70/15/15',
    label: '70% Train · 15% Val · 15% Test',
    description: 'Balance recomendado para aislamiento estricto',
  },
  {
    value: '80/10/10',
    label: '80% Train · 10% Val · 10% Test',
    description: 'Prioriza volumen de entrenamiento',
  },
  {
    value: '60/20/20',
    label: '60% Train · 20% Val · 20% Test',
    description: 'Validación y test reforzados',
  },
]

export const SESSION_OPTIONS: Array<{ value: number; label: string; description: string }> = [
  { value: 30, label: '30 minutos', description: 'Alta seguridad para estaciones compartidas' },
  { value: 120, label: '2 horas', description: 'Balance estándar de oficina' },
  {
    value: 480,
    label: '8 horas (Jornada)',
    description: 'Recomendado para sesiones largas de entrenamiento',
  },
  { value: 1440, label: '24 horas', description: 'Monitoreo continuo sin cierre frecuente' },
]

export const RECOMMENDED_QUOTAS: SystemQuotas = {
  max_concurrent_jobs: 4,
  max_epochs_per_job: 100,
  max_dataset_mb: 50,
  gpu_acceleration: true,
  retention_days: 90,
  max_batch_size: 128,
  mixed_precision: false,
  random_seed: 42,
}

export const RECOMMENDED_POLICIES: SystemPolicies = {
  dataset_split_ratio: '70/15/15',
  min_certification_accuracy: 75,
  auto_approve_models: false,
  early_stopping_enabled: true,
  early_stopping_patience: 5,
  session_timeout_minutes: 480,
  strict_inference_audit: true,
  require_sha256_export: true,
}

export const QUOTA_LABELS: Record<keyof SystemQuotas, string> = {
  max_concurrent_jobs: 'Trabajos concurrentes',
  max_epochs_per_job: 'Épocas máximas',
  max_dataset_mb: 'Tamaño de dataset',
  gpu_acceleration: 'Aceleración GPU / AVX2',
  retention_days: 'Retención de artefactos',
  max_batch_size: 'Batch Size máximo',
  mixed_precision: 'Precisión mixta (FP16)',
  random_seed: 'Semilla aleatoria',
}

export const POLICY_LABELS: Record<keyof SystemPolicies, string> = {
  dataset_split_ratio: 'Partición del dataset',
  min_certification_accuracy: 'Accuracy mínimo',
  auto_approve_models: 'Aprobación automática',
  early_stopping_enabled: 'Early Stopping',
  early_stopping_patience: 'Paciencia Early Stopping',
  session_timeout_minutes: 'Expiración de sesión',
  strict_inference_audit: 'Auditoría estricta',
  require_sha256_export: 'SHA-256 al exportar',
}

export interface ChangeItem {
  key: string
  label: string
  from: string
  to: string
}

const ALL_RANGES: Record<string, NumericRange | undefined> = {
  ...QUOTA_RANGES,
  ...POLICY_RANGES,
}

export function formatSessionMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} h`
  return `${minutes} min`
}

export function formatSettingValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Activado' : 'Desactivado'
  if (key === 'session_timeout_minutes') return formatSessionMinutes(Number(value))
  if (typeof value === 'number') {
    const range = ALL_RANGES[key]
    return range?.unit ? `${value} ${range.unit}` : String(value)
  }
  return String(value ?? '—')
}

export function diffSettings(
  server: object,
  local: object,
  labels: Record<string, string>
): ChangeItem[] {
  const a = server as unknown as Record<string, unknown>
  const b = local as unknown as Record<string, unknown>
  const items: ChangeItem[] = []
  for (const key of Object.keys(labels)) {
    if (a[key] !== b[key]) {
      items.push({
        key,
        label: labels[key],
        from: formatSettingValue(key, a[key]),
        to: formatSettingValue(key, b[key]),
      })
    }
  }
  return items
}

type PresetNumericKey =
  | 'max_concurrent_jobs'
  | 'max_epochs_per_job'
  | 'max_dataset_mb'
  | 'max_batch_size'
  | 'retention_days'

export interface QuotaPreset {
  id: string
  label: string
  subtitle: string
  values: Record<PresetNumericKey, number>
}

export const QUOTA_PRESETS: QuotaPreset[] = [
  {
    id: 'light',
    label: 'Ligero',
    subtitle: 'Equipos compartidos o de bajos recursos',
    values: {
      max_concurrent_jobs: 2,
      max_epochs_per_job: 50,
      max_dataset_mb: 25,
      max_batch_size: 64,
      retention_days: 60,
    },
  },
  {
    id: 'balanced',
    label: 'Balanceado',
    subtitle: 'Perfil recomendado para uso corporativo',
    values: {
      max_concurrent_jobs: 4,
      max_epochs_per_job: 100,
      max_dataset_mb: 50,
      max_batch_size: 128,
      retention_days: 90,
    },
  },
  {
    id: 'performance',
    label: 'Alto rendimiento',
    subtitle: 'Servidores dedicados con GPU',
    values: {
      max_concurrent_jobs: 8,
      max_epochs_per_job: 300,
      max_dataset_mb: 200,
      max_batch_size: 256,
      retention_days: 180,
    },
  },
]

export function applyQuotaPreset(quotas: SystemQuotas, preset: QuotaPreset): SystemQuotas {
  return { ...quotas, ...preset.values }
}

export function detectQuotaPreset(quotas: SystemQuotas): string | null {
  const found = QUOTA_PRESETS.find(preset =>
    (Object.keys(preset.values) as PresetNumericKey[]).every(
      key => (quotas[key] ?? RECOMMENDED_QUOTAS[key]) === preset.values[key]
    )
  )
  return found ? found.id : null
}

export interface PolicyPreset {
  id: string
  label: string
  subtitle: string
  values: SystemPolicies
}

export const POLICY_PRESETS: PolicyPreset[] = [
  {
    id: 'flexible',
    label: 'Flexible',
    subtitle: 'Desarrollo y experimentación ágil',
    values: {
      dataset_split_ratio: '80/10/10',
      min_certification_accuracy: 70,
      auto_approve_models: true,
      early_stopping_enabled: true,
      early_stopping_patience: 10,
      session_timeout_minutes: 1440,
      strict_inference_audit: false,
      require_sha256_export: false,
    },
  },
  {
    id: 'balanced',
    label: 'Balanceado',
    subtitle: 'Perfil recomendado para operación',
    values: RECOMMENDED_POLICIES,
  },
  {
    id: 'strict',
    label: 'Estricto',
    subtitle: 'Auditoría ISO y producción regulada',
    values: {
      dataset_split_ratio: '70/15/15',
      min_certification_accuracy: 85,
      auto_approve_models: false,
      early_stopping_enabled: true,
      early_stopping_patience: 5,
      session_timeout_minutes: 30,
      strict_inference_audit: true,
      require_sha256_export: true,
    },
  },
]

export function detectPolicyPreset(policies: SystemPolicies): string | null {
  const found = POLICY_PRESETS.find(preset =>
    (Object.keys(preset.values) as Array<keyof SystemPolicies>).every(
      key => preset.values[key] === policies[key]
    )
  )
  return found ? found.id : null
}

export function computeSecurityPosture(policies: SystemPolicies): {
  score: number
  total: number
  label: string
  toneCls: string
  barCls: string
} {
  const checks = [
    policies.strict_inference_audit,
    policies.require_sha256_export,
    !policies.auto_approve_models,
    policies.session_timeout_minutes <= 480,
    policies.min_certification_accuracy >= 75,
  ]
  const score = checks.filter(Boolean).length
  if (score >= 5) {
    return { score, total: 5, label: 'Estricta', toneCls: 'text-emerald-300', barCls: 'bg-emerald-400' }
  }
  if (score >= 3) {
    return { score, total: 5, label: 'Sólida', toneCls: 'text-cyan-300', barCls: 'bg-cyan-400' }
  }
  return { score, total: 5, label: 'Básica', toneCls: 'text-amber-300', barCls: 'bg-amber-400' }
}

function toRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

function clampRange(value: number, range: NumericRange): number {
  return Math.min(range.max, Math.max(range.min, Math.round(value)))
}

export function sanitizeQuotas(raw: unknown, base: SystemQuotas): SystemQuotas {
  const src = toRecord(raw)
  const next: SystemQuotas = { ...base }
  for (const key of Object.keys(QUOTA_RANGES) as NumericQuotaKey[]) {
    const value = src[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = clampRange(value, QUOTA_RANGES[key])
    }
  }
  if (typeof src.gpu_acceleration === 'boolean') next.gpu_acceleration = src.gpu_acceleration
  if (typeof src.mixed_precision === 'boolean') next.mixed_precision = src.mixed_precision
  return next
}

export function sanitizePolicies(raw: unknown, base: SystemPolicies): SystemPolicies {
  const src = toRecord(raw)
  const next: SystemPolicies = { ...base }
  const split = src.dataset_split_ratio
  if (typeof split === 'string' && SPLIT_OPTIONS.some(o => o.value === split)) {
    next.dataset_split_ratio = split
  }
  for (const key of Object.keys(POLICY_RANGES) as NumericPolicyKey[]) {
    const value = src[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = clampRange(value, POLICY_RANGES[key])
    }
  }
  const session = src.session_timeout_minutes
  if (typeof session === 'number' && SESSION_OPTIONS.some(o => o.value === session)) {
    next.session_timeout_minutes = session
  }
  if (typeof src.auto_approve_models === 'boolean') next.auto_approve_models = src.auto_approve_models
  if (typeof src.early_stopping_enabled === 'boolean') {
    next.early_stopping_enabled = src.early_stopping_enabled
  }
  if (typeof src.strict_inference_audit === 'boolean') {
    next.strict_inference_audit = src.strict_inference_audit
  }
  if (typeof src.require_sha256_export === 'boolean') {
    next.require_sha256_export = src.require_sha256_export
  }
  return next
}

export interface SettingsBundle {
  app: 'neurolab'
  version: 1
  exported_at: string
  quotas: SystemQuotas
  policies: SystemPolicies
}

export function buildSettingsBundle(quotas: SystemQuotas, policies: SystemPolicies): SettingsBundle {
  return {
    app: 'neurolab',
    version: 1,
    exported_at: new Date().toISOString(),
    quotas,
    policies,
  }
}

export function downloadSettingsBundle(bundle: SettingsBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `neurolab-configuracion-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function parseSettingsBundle(
  text: string,
  baseQuotas: SystemQuotas,
  basePolicies: SystemPolicies
): { quotas: SystemQuotas; policies: SystemPolicies } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido')
  }
  const obj = toRecord(parsed)
  if (obj.app !== 'neurolab' || (!obj.quotas && !obj.policies)) {
    throw new Error('El archivo no corresponde a una configuración exportada de NeuroLab')
  }
  return {
    quotas: sanitizeQuotas(obj.quotas, baseQuotas),
    policies: sanitizePolicies(obj.policies, basePolicies),
  }
}
