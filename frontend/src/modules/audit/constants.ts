import type { AuditEvent } from '../../types'

export type AuditCategory =
  | 'projects'
  | 'datasets'
  | 'architectures'
  | 'training'
  | 'models'
  | 'system'

export type AuditSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface AuditActionMeta {
  label: string
  category: AuditCategory
  severity: AuditSeverity
  badgeCls: string
}

export interface AuditMark {
  status: 'flagged' | 'reviewed'
  note: string
  updatedAt: string
}

export type AuditMarksStore = Record<string, AuditMark>

const MARKS_STORAGE_KEY = 'neurolab_audit_marks_v1'

export const ACTION_BADGE: Record<string, string> = {
  PROJECT_CREATED: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/35',
  CROSS_AREA_MODEL_FUSED: 'bg-indigo-500/20 text-cyan-300 border border-cyan-500/35',
  DATASET_UPLOADED: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35',
  DATASET_SEED: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35',
  DATASETS_FUSED_INTRA_AREA: 'bg-teal-500/20 text-teal-300 border border-teal-500/35',
  ARCHITECTURE_CREATED: 'bg-violet-500/20 text-violet-300 border border-violet-500/35',
  TRAINING_QUEUED: 'bg-amber-500/20 text-amber-300 border border-amber-500/35',
  TRAINING_COMPLETED: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35',
  TRAINING_FAILED: 'bg-rose-500/20 text-rose-300 border border-rose-500/35',
  TRAINING_CANCELLED: 'bg-slate-600/35 text-slate-300 border border-slate-600/40',
  TRAINING_CANCEL_REQUESTED: 'bg-orange-500/20 text-orange-300 border border-orange-500/35',
  MODEL_STATUS_CHANGED: 'bg-purple-500/20 text-purple-300 border border-purple-500/35',
}

export const AUDIT_ACTION_META: Record<string, AuditActionMeta> = {
  PROJECT_CREATED: {
    label: 'Área creada',
    category: 'projects',
    severity: 'info',
    badgeCls: ACTION_BADGE.PROJECT_CREATED,
  },
  CROSS_AREA_MODEL_FUSED: {
    label: 'Fusión corporativa multi-área',
    category: 'projects',
    severity: 'success',
    badgeCls: ACTION_BADGE.CROSS_AREA_MODEL_FUSED,
  },
  DATASET_UPLOADED: {
    label: 'Dataset CSV cargado',
    category: 'datasets',
    severity: 'info',
    badgeCls: ACTION_BADGE.DATASET_UPLOADED,
  },
  DATASET_SEED: {
    label: 'Dataset semilla generado',
    category: 'datasets',
    severity: 'info',
    badgeCls: ACTION_BADGE.DATASET_SEED,
  },
  DATASETS_FUSED_INTRA_AREA: {
    label: 'Fusión de datasets del área',
    category: 'datasets',
    severity: 'success',
    badgeCls: ACTION_BADGE.DATASETS_FUSED_INTRA_AREA,
  },
  ARCHITECTURE_CREATED: {
    label: 'Arquitectura Keras diseñada',
    category: 'architectures',
    severity: 'info',
    badgeCls: ACTION_BADGE.ARCHITECTURE_CREATED,
  },
  TRAINING_QUEUED: {
    label: 'Entrenamiento encolado',
    category: 'training',
    severity: 'info',
    badgeCls: ACTION_BADGE.TRAINING_QUEUED,
  },
  TRAINING_COMPLETED: {
    label: 'Entrenamiento completado',
    category: 'training',
    severity: 'success',
    badgeCls: ACTION_BADGE.TRAINING_COMPLETED,
  },
  TRAINING_FAILED: {
    label: 'Entrenamiento fallido',
    category: 'training',
    severity: 'critical',
    badgeCls: ACTION_BADGE.TRAINING_FAILED,
  },
  TRAINING_CANCELLED: {
    label: 'Entrenamiento cancelado',
    category: 'training',
    severity: 'warning',
    badgeCls: ACTION_BADGE.TRAINING_CANCELLED,
  },
  TRAINING_CANCEL_REQUESTED: {
    label: 'Cancelación solicitada',
    category: 'training',
    severity: 'warning',
    badgeCls: ACTION_BADGE.TRAINING_CANCEL_REQUESTED,
  },
  MODEL_STATUS_CHANGED: {
    label: 'Estado de modelo actualizado',
    category: 'models',
    severity: 'warning',
    badgeCls: ACTION_BADGE.MODEL_STATUS_CHANGED,
  },
}

export function getActionMeta(action: string): AuditActionMeta {
  return (
    AUDIT_ACTION_META[action] || {
      label: action.replace(/_/g, ' ').toLowerCase(),
      category: 'system',
      severity: 'info',
      badgeCls: 'bg-slate-800 text-slate-300 border border-slate-700',
    }
  )
}

export const AUDIT_CATEGORY_TABS: Array<{ id: 'all' | AuditCategory; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'projects', label: 'Proyectos' },
  { id: 'datasets', label: 'Datasets' },
  { id: 'architectures', label: 'Arquitecturas' },
  { id: 'training', label: 'Entrenamiento' },
  { id: 'models', label: 'Modelos' },
]

export const AUDIT_SEVERITY_META: Record<
  AuditSeverity,
  { label: string; dotCls: string; pillCls: string }
> = {
  info: {
    label: 'Operativo',
    dotCls: 'bg-cyan-400',
    pillCls: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35',
  },
  success: {
    label: 'Exitoso',
    dotCls: 'bg-emerald-400',
    pillCls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35',
  },
  warning: {
    label: 'Atención',
    dotCls: 'bg-amber-400',
    pillCls: 'bg-amber-500/15 text-amber-300 border border-amber-500/35',
  },
  critical: {
    label: 'Crítico',
    dotCls: 'bg-rose-400',
    pillCls: 'bg-rose-500/15 text-rose-300 border border-rose-500/35',
  },
}

function formatPctMaybe(val: unknown): string {
  const num = Number(val)
  if (!Number.isFinite(num)) return String(val)
  const pct = num <= 1 ? num * 100 : num
  return `${pct.toFixed(2)}%`
}

export function summarizeAuditMetadata(
  ev: AuditEvent,
  projectMap: Map<string, string>
): Array<{ label: string; value: string }> {
  const meta = ev.metadata || {}
  const items: Array<{ label: string; value: string }> = []

  if (typeof meta.name === 'string' && meta.name.trim()) {
    items.push({ label: 'Nombre', value: meta.name.trim() })
  }
  const version = meta.model_version ?? meta.version
  if (version != null && String(version).trim()) {
    items.push({ label: 'Versión', value: String(version) })
  }
  const acc = meta.test_accuracy ?? meta.accuracy
  if (acc != null && Number.isFinite(Number(acc))) {
    items.push({ label: 'Accuracy', value: formatPctMaybe(acc) })
  }
  if (meta.val_accuracy != null && Number.isFinite(Number(meta.val_accuracy))) {
    items.push({ label: 'Val Acc', value: formatPctMaybe(meta.val_accuracy) })
  }
  const st = meta.new_status ?? meta.status
  if (st != null && String(st).trim()) {
    items.push({ label: 'Estado', value: String(st) })
  }
  const kind = meta.type ?? meta.scaler ?? meta.family
  if (kind != null && String(kind).trim()) {
    items.push({ label: 'Tipo', value: String(kind) })
  }
  const rows = meta.total_rows ?? meta.rows
  if (rows != null && Number.isFinite(Number(rows))) {
    items.push({ label: 'Filas', value: Number(rows).toLocaleString('es') })
  }
  if (meta.total_parameters != null && Number.isFinite(Number(meta.total_parameters))) {
    items.push({ label: 'Parámetros', value: Number(meta.total_parameters).toLocaleString('es') })
  }
  if (meta.epochs != null || meta.total_epochs != null) {
    items.push({ label: 'Épocas', value: String(meta.epochs ?? meta.total_epochs) })
  }
  if (typeof meta.error === 'string' && meta.error.trim()) {
    items.push({ label: 'Error', value: meta.error.trim() })
  }
  if (typeof meta.notes === 'string' && meta.notes.trim()) {
    items.push({ label: 'Nota', value: meta.notes.trim() })
  }
  if (typeof meta.job_id === 'string' && meta.job_id.trim()) {
    items.push({ label: 'Job', value: meta.job_id.trim() })
  }
  if (typeof meta.dataset_id === 'string' && meta.dataset_id.trim()) {
    items.push({ label: 'Dataset', value: meta.dataset_id.trim() })
  }
  if (items.length === 0 && ev.project_id) {
    const pName = projectMap.get(ev.project_id)
    if (pName) items.push({ label: 'Área', value: pName })
  }
  if (items.length === 0) {
    for (const [k, v] of Object.entries(meta)) {
      if (v !== null && v !== undefined && typeof v !== 'object') {
        items.push({ label: k, value: String(v) })
      }
      if (items.length >= 6) break
    }
  }
  return items
}

export function formatRelativeTime(isoDate: string): string {
  const ts = new Date(isoDate).getTime()
  if (!Number.isFinite(ts)) return '—'
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (diffSec < 60) return 'Hace un momento'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Hace ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `Hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `Hace ${diffDays} d`
  const diffMonths = Math.floor(diffDays / 30)
  return `Hace ${diffMonths} mes${diffMonths === 1 ? '' : 'es'}`
}

export async function computeEventSha256(ev: AuditEvent): Promise<string> {
  const canonical = JSON.stringify({
    id: ev.id,
    created_at: ev.created_at,
    actor_id: ev.actor_id,
    actor_name: ev.actor_name,
    project_id: ev.project_id ?? null,
    action: ev.action,
    metadata: ev.metadata ?? {},
  })
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(canonical)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
  let h = 2166136261
  for (let i = 0; i < canonical.length; i += 1) {
    h ^= canonical.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0').repeat(8)
}

export function loadAuditMarks(): AuditMarksStore {
  try {
    const raw = localStorage.getItem(MARKS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as AuditMarksStore
    return {}
  } catch {
    return {}
  }
}

export function saveAuditMarks(store: AuditMarksStore): void {
  try {
    localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify(store))
  } catch {
  }
}

export function exportAuditJson(events: AuditEvent[], projectMap: Map<string, string>) {
  const enriched = events.map(ev => ({
    ...ev,
    project_name: ev.project_id ? projectMap.get(ev.project_id) || ev.project_id : 'Nivel Sistema',
    action_label: getActionMeta(ev.action).label,
  }))
  const blob = new Blob([JSON.stringify(enriched, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `neurolab-auditoria-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportAuditCsv(
  events: AuditEvent[],
  projectMap: Map<string, string>,
  marks: AuditMarksStore
) {
  const esc = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const headers = [
    'ID',
    'Fecha',
    'Actor',
    'Area_Proyecto',
    'Proyecto_ID',
    'Accion_Codigo',
    'Accion_Descripcion',
    'Severidad',
    'Revision',
    'Nota_Auditor',
    'Metadata_JSON',
  ]
  const rows = events.map(ev => {
    const meta = getActionMeta(ev.action)
    const mark = marks[ev.id]
    const areaName = ev.project_id ? projectMap.get(ev.project_id) || ev.project_id : 'Nivel Sistema'
    return [
      ev.id,
      new Date(ev.created_at).toLocaleString('es-ES'),
      ev.actor_name,
      areaName,
      ev.project_id || '',
      ev.action,
      meta.label,
      AUDIT_SEVERITY_META[meta.severity].label,
      mark ? (mark.status === 'flagged' ? 'Seguimiento' : 'Revisado') : 'Sin marca',
      mark?.note || '',
      JSON.stringify(ev.metadata ?? {}),
    ]
      .map(esc)
      .join(',')
  })
  const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `neurolab-auditoria-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function buildAuditMarkdown(
  events: AuditEvent[],
  projectMap: Map<string, string>,
  marks: AuditMarksStore
): string {
  const lines: string[] = [
    `# Registro de Auditoría Global — Aura Telecom AI Studio`,
    `- Exportado: ${new Date().toLocaleString('es-ES')}`,
    `- Total de eventos filtrados: ${events.length}`,
    '',
    '| Fecha | Actor | Área / Proyecto | Acción | Detalles | Estado |',
    '|---|---|---|---|---|---|',
  ]
  for (const ev of events.slice(0, 120)) {
    const meta = getActionMeta(ev.action)
    const area = ev.project_id ? projectMap.get(ev.project_id) || ev.project_id : 'Nivel Sistema'
    const chips = summarizeAuditMetadata(ev, projectMap)
      .slice(0, 2)
      .map(c => `${c.label}: ${c.value}`)
      .join(' · ')
    const mark = marks[ev.id]
    const rev = mark ? (mark.status === 'flagged' ? 'Seguimiento' : 'Revisado') : '—'
    const dt = new Date(ev.created_at).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    lines.push(
      `| ${dt} | ${ev.actor_name} | ${area.replace(/\|/g, '/')} | ${meta.label} (\`${ev.action}\`) | ${(chips || '—').replace(/\|/g, '/')} | ${rev} |`
    )
  }
  return lines.join('\n')
}
