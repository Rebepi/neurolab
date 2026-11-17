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

export const ROLE_PERMISSIONS: Record<string, string> = {
  'Administrador': 'Acceso total al sistema: RBAC, gestión de usuarios, cuotas globales, auditoría y ciclo completo.',
  'Responsable de proyecto': 'Crea y administra proyectos, miembros, aprobaciones de flujo y reportes ejecutivos.',
  'Ingeniero/analista de IA': 'Sube datasets, diseña arquitecturas Keras, ejecuta entrenamientos y evalúa métricas.',
  'Revisor': 'Audita métricas de test, verifica integridad SHA-256 y aprueba o retira modelos del Registry.',
  'Lector': 'Acceso de solo lectura a métricas, visualizador neuronal, reportes y estado general.',
}
