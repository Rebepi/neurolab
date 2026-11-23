import type { AuditEvent, User, UserRole } from '../../types'

export const ROLE_OPTIONS = [
  'Administrador',
  'Responsable de proyecto',
  'Ingeniero/analista de IA',
  'Revisor',
  'Lector',
] as const

export const ROLE_COLORS: Record<string, string> = {
  'Administrador': 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  'Responsable de proyecto': 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  'Ingeniero/analista de IA': 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
  'Revisor': 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  'Lector': 'bg-slate-700/60 text-slate-300 border border-slate-600/40',
}

export const ROLE_AVATAR_GRADIENTS: Record<UserRole, string> = {
  'Administrador': 'from-rose-500 to-amber-500',
  'Responsable de proyecto': 'from-indigo-500 to-blue-600',
  'Ingeniero/analista de IA': 'from-violet-500 to-fuchsia-600',
  'Revisor': 'from-cyan-500 to-teal-500',
  'Lector': 'from-slate-600 to-slate-700',
}

export const ROLE_BAR_COLORS: Record<UserRole, string> = {
  'Administrador': 'bg-rose-400',
  'Responsable de proyecto': 'bg-indigo-400',
  'Ingeniero/analista de IA': 'bg-violet-400',
  'Revisor': 'bg-cyan-400',
  'Lector': 'bg-slate-400',
}

export const ROLE_PERMISSIONS: Record<string, string> = {
  'Administrador': 'Acceso total al sistema: RBAC, gestión de usuarios, cuotas globales, auditoría y ciclo completo.',
  'Responsable de proyecto': 'Crea y administra proyectos, miembros, aprobaciones de flujo y reportes ejecutivos.',
  'Ingeniero/analista de IA': 'Sube datasets, diseña arquitecturas Keras, ejecuta entrenamientos y evalúa métricas.',
  'Revisor': 'Audita métricas de test, verifica integridad SHA-256 y aprueba o retira modelos del Registry.',
  'Lector': 'Acceso de solo lectura a métricas, visualizador neuronal, reportes y estado general.',
}

export const ROLE_META: Record<
  UserRole,
  { level: number; tierLabel: string; shortLabel: string; summary: string }
> = {
  'Administrador': {
    level: 5,
    tierLabel: 'Nivel 5 · Superusuario',
    shortLabel: 'Admin',
    summary: 'Control total IAM, cuotas y sistema',
  },
  'Responsable de proyecto': {
    level: 4,
    tierLabel: 'Nivel 4 · Gestión de Área',
    shortLabel: 'Responsable',
    summary: 'Áreas, equipos, flujo y reportes',
  },
  'Ingeniero/analista de IA': {
    level: 3,
    tierLabel: 'Nivel 3 · Ingeniería ML',
    shortLabel: 'Ingeniero IA',
    summary: 'Datos, redes Keras y entrenamiento',
  },
  'Revisor': {
    level: 2,
    tierLabel: 'Nivel 2 · Auditoría QA',
    shortLabel: 'Revisor QA',
    summary: 'Certificación SHA-256 y revisión',
  },
  'Lector': {
    level: 1,
    tierLabel: 'Nivel 1 · Solo Lectura',
    shortLabel: 'Lector',
    summary: 'Visualización y consulta pasiva',
  },
}

export type PermissionAccess = 'full' | 'write' | 'approve' | 'read' | 'deny'

export type RbacDomain = 'Proyectos & Datos' | 'Entrenamiento & Modelos' | 'Gobernanza & Seguridad'

export const ACCESS_LEVEL_SCORE: Record<PermissionAccess, number> = {
  deny: 0,
  read: 1,
  approve: 2,
  write: 3,
  full: 4,
}

export const ACCESS_BADGE_META: Record<PermissionAccess, { label: string; cls: string }> = {
  full: {
    label: 'Total',
    cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/35',
  },
  write: {
    label: 'Operar',
    cls: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/35',
  },
  approve: {
    label: 'Aprobar',
    cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35',
  },
  read: {
    label: 'Lectura',
    cls: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35',
  },
  deny: {
    label: 'Denegado',
    cls: 'bg-slate-900/90 text-slate-500 border border-slate-800',
  },
}

export interface RbacCapability {
  key: string
  label: string
  domain: RbacDomain
  description: string
  matrix: Record<UserRole, PermissionAccess>
}

export const RBAC_CAPABILITIES: RbacCapability[] = [
  {
    key: 'projects_manage',
    label: 'Crear y configurar áreas / proyectos',
    domain: 'Proyectos & Datos',
    description: 'Alta, edición de metadatos, estado y ciclo de vida de áreas de negocio.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'full',
      'Ingeniero/analista de IA': 'read',
      'Revisor': 'read',
      'Lector': 'read',
    },
  },
  {
    key: 'workspace_members',
    label: 'Asignar y revocar miembros en áreas',
    domain: 'Proyectos & Datos',
    description: 'Control de pertenencia y rol específico dentro de cada área o proyecto.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'write',
      'Ingeniero/analista de IA': 'read',
      'Revisor': 'read',
      'Lector': 'read',
    },
  },
  {
    key: 'datasets_eda',
    label: 'Cargar, fusionar y preprocesar datasets',
    domain: 'Proyectos & Datos',
    description: 'Ingesta CSV, análisis EDA, fusión multiárea y escalado de variables.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'write',
      'Ingeniero/analista de IA': 'write',
      'Revisor': 'read',
      'Lector': 'read',
    },
  },
  {
    key: 'architectures_design',
    label: 'Diseñar y versionar topologías Keras',
    domain: 'Proyectos & Datos',
    description: 'Construcción de capas densas, activaciones, Dropout y parámetros.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'write',
      'Ingeniero/analista de IA': 'write',
      'Revisor': 'read',
      'Lector': 'read',
    },
  },
  {
    key: 'training_execute',
    label: 'Lanzar, monitorear y detener entrenamientos',
    domain: 'Entrenamiento & Modelos',
    description: 'Ejecución de corridas sobre el motor neuronal y cancelación en vivo.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'write',
      'Ingeniero/analista de IA': 'write',
      'Revisor': 'read',
      'Lector': 'read',
    },
  },
  {
    key: 'evaluation_inspect',
    label: 'Analizar métricas de test y matriz de confusión',
    domain: 'Entrenamiento & Modelos',
    description: 'Inspección del split sellado de test, curvas de pérdida y motor sináptico.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'read',
      'Ingeniero/analista de IA': 'read',
      'Revisor': 'read',
      'Lector': 'read',
    },
  },
  {
    key: 'models_certify',
    label: 'Certificar, aprobar o retirar versiones SHA-256',
    domain: 'Entrenamiento & Modelos',
    description: 'Gobernanza de promoción y retiro en el Model Registry productivo.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'approve',
      'Ingeniero/analista de IA': 'read',
      'Revisor': 'approve',
      'Lector': 'deny',
    },
  },
  {
    key: 'inference_run',
    label: 'Ejecutar inferencia en vivo y análisis batch',
    domain: 'Entrenamiento & Modelos',
    description: 'Simulación de predicciones unitarias y evaluación masiva por lotes.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'write',
      'Ingeniero/analista de IA': 'write',
      'Revisor': 'write',
      'Lector': 'read',
    },
  },
  {
    key: 'reports_export',
    label: 'Generar informes ejecutivos y exportar PDF/HTML',
    domain: 'Gobernanza & Seguridad',
    description: 'Personalización de bloques, firmas y exportación certificada de reportes.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'write',
      'Ingeniero/analista de IA': 'write',
      'Revisor': 'write',
      'Lector': 'read',
    },
  },
  {
    key: 'audit_view',
    label: 'Inspeccionar bitácora inmutable de auditoría',
    domain: 'Gobernanza & Seguridad',
    description: 'Trazabilidad cronológica de eventos, actores y firmas del sistema.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'read',
      'Ingeniero/analista de IA': 'read',
      'Revisor': 'read',
      'Lector': 'read',
    },
  },
  {
    key: 'users_rbac_admin',
    label: 'Gestionar usuarios, cuentas y roles RBAC',
    domain: 'Gobernanza & Seguridad',
    description: 'Alta de usuarios, suspensión de cuentas y cambios de privilegio global.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'deny',
      'Ingeniero/analista de IA': 'deny',
      'Revisor': 'deny',
      'Lector': 'deny',
    },
  },
  {
    key: 'system_policies',
    label: 'Configurar cuotas GPU/RAM y políticas globales',
    domain: 'Gobernanza & Seguridad',
    description: 'Parámetros globales de cómputo, umbrales SLA y retención de datos.',
    matrix: {
      'Administrador': 'full',
      'Responsable de proyecto': 'deny',
      'Ingeniero/analista de IA': 'deny',
      'Revisor': 'deny',
      'Lector': 'deny',
    },
  },
]

export interface UserWorkspaceMembership {
  projectId: string
  projectName: string
  projectStatus: string
  areaRole: UserRole
  isOwner: boolean
  joinedAt: string
}

export interface UserActivityStats {
  count: number
  lastAt: string | null
  events: AuditEvent[]
}

export function computeRoleDiff(
  fromRole: UserRole,
  toRole: UserRole
): { gained: RbacCapability[]; revoked: RbacCapability[] } {
  const gained: RbacCapability[] = []
  const revoked: RbacCapability[] = []
  for (const cap of RBAC_CAPABILITIES) {
    const before = ACCESS_LEVEL_SCORE[cap.matrix[fromRole]]
    const after = ACCESS_LEVEL_SCORE[cap.matrix[toRole]]
    if (after > before) {
      gained.push(cap)
    } else if (after < before) {
      revoked.push(cap)
    }
  }
  return { gained, revoked }
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  PROJECT_CREATED: 'Creó un proyecto/área',
  DATASET_UPLOADED: 'Subió un dataset',
  DATASET_FUSED: 'Fusionó datasets',
  CROSS_AREA_FUSION: 'Ejecutó fusión multiárea',
  ARCHITECTURE_CREATED: 'Diseñó arquitectura neuronal',
  TRAINING_STARTED: 'Inició entrenamiento',
  TRAINING_COMPLETED: 'Completó entrenamiento',
  TRAINING_CANCELLED: 'Canceló entrenamiento',
  MODEL_REGISTERED: 'Registró versión de modelo',
  MODEL_STATUS_UPDATED: 'Actualizó estado de modelo',
  MODEL_APPROVED: 'Aprobó modelo en Registry',
  INFERENCE_EXECUTED: 'Ejecutó inferencia',
}

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] || action.replace(/_/g, ' ').toLowerCase()
}

export function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NL'
  )
}

export function exportUsersDirectoryCsv(
  users: User[],
  membershipsByUser: Record<string, UserWorkspaceMembership[]>,
  activityByUser: Record<string, UserActivityStats>
) {
  const esc = (v: unknown) => {
    const s = String(v ?? '').replace(/"/g, '""')
    return `"${s}"`
  }
  const headers = [
    'ID',
    'Nombre',
    'Correo',
    'Rol RBAC',
    'Nivel Privilegio',
    'Estado',
    'Areas Asignadas',
    'Eventos Auditoria',
    'Ultima Actividad',
    'Registrado',
  ]
  const rows = users.map(u => {
    const areas = (membershipsByUser[u.id] || []).map(m => `${m.projectName} (${m.areaRole})`).join(' | ')
    const act = activityByUser[u.id]
    return [
      u.id,
      u.display_name,
      u.email,
      u.role,
      ROLE_META[u.role]?.level ?? 1,
      u.status === 'ACTIVE' ? 'Activo' : 'Inactivo',
      areas || 'Sin asignaciones',
      act?.count ?? 0,
      act?.lastAt ? new Date(act.lastAt).toLocaleString('es') : '—',
      u.created_at ? new Date(u.created_at).toLocaleDateString('es') : '—',
    ]
      .map(esc)
      .join(',')
  })
  const csvContent = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'usuarios_rbac_neurolab.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
