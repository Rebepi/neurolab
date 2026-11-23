export const STATUS_BADGE: Record<string, string> = {
  RUNNING: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  PREPARING: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  PAUSED: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  QUEUED: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  FAILED: 'bg-red-500/20 text-red-300 border-red-500/30',
  CANCELLED: 'bg-slate-600/40 text-slate-400 border-slate-600/30',
}

export const STATUS_LABEL: Record<string, string> = {
  RUNNING: 'En Ejecución',
  PREPARING: 'Preparando',
  PAUSED: 'Pausado',
  QUEUED: 'En Cola',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
}

export const BATCH_SIZES = [16, 32, 64, 128] as const
export const OPTIMIZERS = ['adam', 'sgd', 'rmsprop'] as const
export const LEARNING_RATES = [0.1, 0.01, 0.001, 0.0001] as const

