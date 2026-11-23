import type { UserRole } from '../../types'

export type PermRisk = 'read' | 'write' | 'critical'

export interface GranularPermission {
  id: string
  label: string
  description: string
  risk: PermRisk
  defaultRoles: UserRole[]
}

export interface PermissionModuleGroup {
  id: string
  label: string
  subtitle: string
  colorCls: string
  permissions: GranularPermission[]
}

export type AreaPermissionsStore = Record<string, Record<string, Record<string, boolean>>>

const STORAGE_KEY = 'neurolab_area_granular_perms_v1'

const ALL_ROLES: UserRole[] = [
  'Administrador',
  'Responsable de proyecto',
  'Ingeniero/analista de IA',
  'Revisor',
  'Lector',
]

const LEAD_AND_ADMIN: UserRole[] = ['Administrador', 'Responsable de proyecto']
const ENG_UP: UserRole[] = ['Administrador', 'Responsable de proyecto', 'Ingeniero/analista de IA']
const QA_REVIEWERS: UserRole[] = ['Administrador', 'Responsable de proyecto', 'Revisor']
const NON_READER: UserRole[] = [
  'Administrador',
  'Responsable de proyecto',
  'Ingeniero/analista de IA',
  'Revisor',
]

export const PERM_RISK_META: Record<PermRisk, { label: string; cls: string }> = {
  read: {
    label: 'Lectura',
    cls: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35',
  },
  write: {
    label: 'Escritura',
    cls: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/35',
  },
  critical: {
    label: 'Crítico',
    cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/35',
  },
}

export const AREA_PERMISSION_MODULES: PermissionModuleGroup[] = [
  {
    id: 'dashboard',
    label: 'Centro de Mando',
    subtitle: 'KPIs globales, actividad corporativa y estado del área',
    colorCls: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/35',
    permissions: [
      {
        id: 'dash.view_kpis',
        label: 'Ver KPIs y telemetría CPU/RAM',
        description: 'Acceso al panel de métricas operativas y recursos del servidor.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'dash.view_activity',
        label: 'Consultar feed de actividad corporativa',
        description: 'Visualizar eventos recientes de entrenamiento y despliegues en el área.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'dash.view_models',
        label: 'Consultar resumen de modelos del área',
        description: 'Ver listado consolidado de versiones entrenadas del proyecto.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
    ],
  },
  {
    id: 'projects',
    label: 'Proyecto & Workspace',
    subtitle: 'Metadatos del área, miembros RBAC y ciclo de vida',
    colorCls: 'text-blue-400 bg-blue-500/15 border-blue-500/35',
    permissions: [
      {
        id: 'proj.view',
        label: 'Ver ficha y detalles del área',
        description: 'Acceder a la descripción, propietario, etiquetas y resumen del proyecto.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'proj.edit_meta',
        label: 'Editar nombre, descripción, tags y estado',
        description: 'Modificar información descriptiva y etiquetas operativas del área.',
        risk: 'write',
        defaultRoles: LEAD_AND_ADMIN,
      },
      {
        id: 'proj.manage_members',
        label: 'Asignar y revocar miembros del área',
        description: 'Incorporar integrantes, cambiar roles internos y retirar accesos.',
        risk: 'critical',
        defaultRoles: LEAD_AND_ADMIN,
      },
      {
        id: 'proj.archive_delete',
        label: 'Archivar o eliminar el área',
        description: 'Desactivar permanentemente el proyecto y sus recursos vinculados.',
        risk: 'critical',
        defaultRoles: ['Administrador'],
      },
    ],
  },
  {
    id: 'datasets',
    label: 'Datasets & Auto-EDA',
    subtitle: 'Ingesta CSV, exploración estadística, escalado y fusión',
    colorCls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/35',
    permissions: [
      {
        id: 'ds.inspect_eda',
        label: 'Inspeccionar esquemas EDA, nulos y splits',
        description: 'Consultar columnas numéricas/categóricas, correlaciones y partición 70/15/15.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'ds.upload_scale',
        label: 'Subir archivos CSV y configurar escalado',
        description: 'Ingestar nuevos datasets tabulares y definir Standard/MinMax.',
        risk: 'write',
        defaultRoles: ENG_UP,
      },
      {
        id: 'ds.seed_sample',
        label: 'Cargar datasets semilla de referencia',
        description: 'Generar juegos de datos sintéticos corporativos en el área.',
        risk: 'write',
        defaultRoles: ENG_UP,
      },
      {
        id: 'ds.fuse_cross',
        label: 'Fusionar datasets intra-área o multi-área',
        description: 'Combinar múltiples fuentes de datos en un corpus unificado.',
        risk: 'critical',
        defaultRoles: ENG_UP,
      },
    ],
  },
  {
    id: 'architectures',
    label: 'Arquitecturas Keras',
    subtitle: 'Diseño de capas neuronales, activaciones y versionado',
    colorCls: 'text-violet-400 bg-violet-500/15 border-violet-500/35',
    permissions: [
      {
        id: 'arch.view',
        label: 'Consultar topologías y conteo de parámetros',
        description: 'Revisar capas Dense, BatchNorm, Dropout y pesos totales.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'arch.design',
        label: 'Diseñar o editar capas y activaciones',
        description: 'Crear nuevas arquitecturas MLP y configurar neuronas y activaciones.',
        risk: 'write',
        defaultRoles: ENG_UP,
      },
      {
        id: 'arch.version',
        label: 'Versionar arquitecturas y registrar justificación',
        description: 'Publicar nuevas versiones con nota técnica de diseño.',
        risk: 'write',
        defaultRoles: ENG_UP,
      },
    ],
  },
  {
    id: 'training',
    label: 'Entrenamiento IA',
    subtitle: 'Ejecución de corridas sobre TensorFlow y control en vivo',
    colorCls: 'text-amber-400 bg-amber-500/15 border-amber-500/35',
    permissions: [
      {
        id: 'train.monitor',
        label: 'Monitorear métricas por época y consola',
        description: 'Observar progreso en tiempo real, loss, accuracy y logs.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'train.start',
        label: 'Configurar hiperparámetros y lanzar corridas',
        description: 'Definir epochs, optimizer, learning rate y encolar entrenamientos.',
        risk: 'write',
        defaultRoles: ENG_UP,
      },
      {
        id: 'train.control',
        label: 'Cancelar corridas activas o reintentar',
        description: 'Detener entrenamientos en curso o relanzar jobs fallidos.',
        risk: 'critical',
        defaultRoles: ENG_UP,
      },
    ],
  },
  {
    id: 'evaluation',
    label: 'Evaluación & Curvas',
    subtitle: 'Validación sobre Test sellado (15%) y comparativas',
    colorCls: 'text-teal-400 bg-teal-500/15 border-teal-500/35',
    permissions: [
      {
        id: 'eval.test_metrics',
        label: 'Consultar métricas finales en Test sellado',
        description: 'Ver Accuracy, Loss, Precision, Recall y F1-Score auditados.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'eval.charts',
        label: 'Inspeccionar matriz de confusión y curvas',
        description: 'Explorar distribución de errores y convergencia train/val.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'eval.compare',
        label: 'Comparar métricas entre corridas',
        description: 'Contrastar deltas de accuracy y loss entre experimentos.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
    ],
  },
  {
    id: 'models',
    label: 'Model Registry',
    subtitle: 'Certificación SHA-256, aprobación QA y retiro de versiones',
    colorCls: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/35',
    permissions: [
      {
        id: 'mod.inspect',
        label: 'Consultar versiones y checksum SHA-256',
        description: 'Revisar artefactos registrados, métricas y estado de aprobación.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'mod.approve',
        label: 'Aprobar o enviar versiones a revisión QA',
        description: 'Certificar modelos como APPROVED o IN_REVIEW con notas técnicas.',
        risk: 'critical',
        defaultRoles: QA_REVIEWERS,
      },
      {
        id: 'mod.retire',
        label: 'Retirar o deprecar versiones productivas',
        description: 'Pasar versiones obsoletas o comprometidas a estado RETIRED.',
        risk: 'critical',
        defaultRoles: QA_REVIEWERS,
      },
    ],
  },
  {
    id: 'inference',
    label: 'Uso del Modelo',
    subtitle: 'Inferencia en vivo, evaluación por lotes y explicabilidad',
    colorCls: 'text-sky-400 bg-sky-500/15 border-sky-500/35',
    permissions: [
      {
        id: 'inf.single',
        label: 'Ejecutar predicción unitaria e inspectar salidas',
        description: 'Probar casos individuales sobre modelos aprobados del área.',
        risk: 'write',
        defaultRoles: NON_READER,
      },
      {
        id: 'inf.batch',
        label: 'Ejecutar scoring masivo por lotes (batch)',
        description: 'Procesar registros del corpus para clasificación de riesgo en masa.',
        risk: 'write',
        defaultRoles: ENG_UP,
      },
      {
        id: 'inf.explain',
        label: 'Inspeccionar contribuciones y trazas por capa',
        description: 'Analizar importancia por variable e intensidades internas.',
        risk: 'read',
        defaultRoles: NON_READER,
      },
    ],
  },
  {
    id: 'visualizer',
    label: 'Motor Sináptico',
    subtitle: 'Visualización neuronal interactiva y forward pass',
    colorCls: 'text-purple-400 bg-purple-500/15 border-purple-500/35',
    permissions: [
      {
        id: 'vis.explore',
        label: 'Explorar red neuronal, pesos y activaciones',
        description: 'Inspeccionar neuronas y conexiones sinápticas del modelo.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'vis.forward',
        label: 'Simular propagación forward interactiva',
        description: 'Injectar vectores de entrada para observar señales por capa.',
        risk: 'write',
        defaultRoles: ENG_UP,
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reportes & PDF',
    subtitle: 'Estudio documental, personalización ISO y exportación',
    colorCls: 'text-orange-400 bg-orange-500/15 border-orange-500/35',
    permissions: [
      {
        id: 'rep.preview',
        label: 'Previsualizar secciones del informe ejecutivo',
        description: 'Consultar contexto, gráficas, métricas y ROI en pantalla.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'rep.customize',
        label: 'Personalizar portada, bloques, firmas y checklist',
        description: 'Editar estructura modular, textos y controles ISO del reporte.',
        risk: 'write',
        defaultRoles: NON_READER,
      },
      {
        id: 'rep.export_doc',
        label: 'Exportar documento oficial en PDF o HTML',
        description: 'Generar archivos ejecutivos descargables para auditoría o comité.',
        risk: 'write',
        defaultRoles: NON_READER,
      },
      {
        id: 'rep.export_data',
        label: 'Exportar certificación JSON, CSV o Markdown',
        description: 'Descargar métricas crudas y paquetes técnicos estructurados.',
        risk: 'write',
        defaultRoles: NON_READER,
      },
    ],
  },
  {
    id: 'audit',
    label: 'Auditoría & Gobernanza',
    subtitle: 'Bitácora cronológica inmutable y evidencia de cumplimiento',
    colorCls: 'text-rose-400 bg-rose-500/15 border-rose-500/35',
    permissions: [
      {
        id: 'aud.view',
        label: 'Consultar bitácora cronológica del área',
        description: 'Visualizar acciones ejecutadas dentro del workspace.',
        risk: 'read',
        defaultRoles: ALL_ROLES,
      },
      {
        id: 'aud.inspect_meta',
        label: 'Inspeccionar metadatos JSON, actor y marca temporal',
        description: 'Ver detalle técnico completo de cada registro de auditoría.',
        risk: 'read',
        defaultRoles: NON_READER,
      },
      {
        id: 'aud.export',
        label: 'Exportar registros de trazabilidad',
        description: 'Descargar evidencia de auditoría para revisiones externas.',
        risk: 'critical',
        defaultRoles: QA_REVIEWERS,
      },
    ],
  },
]

export const ALL_GRANULAR_PERMISSIONS: GranularPermission[] = AREA_PERMISSION_MODULES.flatMap(
  m => m.permissions
)

export function getDefaultAreaPermissions(role: UserRole): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const perm of ALL_GRANULAR_PERMISSIONS) {
    result[perm.id] = perm.defaultRoles.includes(role)
  }
  return result
}

export function resolveEffectiveAreaPermissions(
  projectId: string,
  userId: string,
  areaRole: UserRole,
  store: AreaPermissionsStore
): {
  defaults: Record<string, boolean>
  effective: Record<string, boolean>
  overrides: Record<string, boolean>
  overridesCount: number
  grantedCount: number
  totalCount: number
} {
  const defaults = getDefaultAreaPermissions(areaRole)
  const rawOverrides = store[projectId]?.[userId] || {}
  const effective: Record<string, boolean> = { ...defaults }
  const cleanOverrides: Record<string, boolean> = {}

  for (const perm of ALL_GRANULAR_PERMISSIONS) {
    if (Object.prototype.hasOwnProperty.call(rawOverrides, perm.id)) {
      const overrideVal = Boolean(rawOverrides[perm.id])
      effective[perm.id] = overrideVal
      if (overrideVal !== defaults[perm.id]) {
        cleanOverrides[perm.id] = overrideVal
      }
    }
  }

  let grantedCount = 0
  for (const perm of ALL_GRANULAR_PERMISSIONS) {
    if (effective[perm.id]) grantedCount += 1
  }

  return {
    defaults,
    effective,
    overrides: cleanOverrides,
    overridesCount: Object.keys(cleanOverrides).length,
    grantedCount,
    totalCount: ALL_GRANULAR_PERMISSIONS.length,
  }
}

export function buildOverridesFromEffective(
  areaRole: UserRole,
  effective: Record<string, boolean>
): Record<string, boolean> {
  const defaults = getDefaultAreaPermissions(areaRole)
  const overrides: Record<string, boolean> = {}
  for (const perm of ALL_GRANULAR_PERMISSIONS) {
    const val = Boolean(effective[perm.id])
    if (val !== Boolean(defaults[perm.id])) {
      overrides[perm.id] = val
    }
  }
  return overrides
}

export function loadAreaPermissionsStore(): AreaPermissionsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as AreaPermissionsStore
    }
    return {}
  } catch {
    return {}
  }
}

export function saveAreaPermissionsStore(store: AreaPermissionsStore): void {
  const sanitized: AreaPermissionsStore = {}
  for (const [projectId, usersMap] of Object.entries(store)) {
    const cleanUsers: Record<string, Record<string, boolean>> = {}
    for (const [userId, permsMap] of Object.entries(usersMap || {})) {
      if (permsMap && Object.keys(permsMap).length > 0) {
        cleanUsers[userId] = permsMap
      }
    }
    if (Object.keys(cleanUsers).length > 0) {
      sanitized[projectId] = cleanUsers
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
  } catch {
  }
}

export function exportMemberPermissionsJson(
  projectName: string,
  userName: string,
  areaRole: UserRole,
  effective: Record<string, boolean>,
  overrides: Record<string, boolean>
) {
  const safeProject = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const safeUser = userName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const payload = {
    exported_at: new Date().toISOString(),
    area: projectName,
    user: userName,
    base_area_role: areaRole,
    summary: {
      total_permissions: ALL_GRANULAR_PERMISSIONS.length,
      granted: Object.values(effective).filter(Boolean).length,
      custom_overrides: Object.keys(overrides).length,
    },
    modules: AREA_PERMISSION_MODULES.map(m => ({
      module_id: m.id,
      module_label: m.label,
      permissions: m.permissions.map(p => ({
        id: p.id,
        label: p.label,
        risk: p.risk,
        granted: Boolean(effective[p.id]),
        overridden: Object.prototype.hasOwnProperty.call(overrides, p.id),
      })),
    })),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeProject || 'area'}_${safeUser || 'usuario'}_permisos.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
