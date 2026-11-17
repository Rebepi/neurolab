export function StatusDot({ status }: { status: string }) {
  const active = status === 'ACTIVE' || status === 'Activo'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        active ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {status}
    </span>
  )
}

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-900/50 border border-indigo-700/50 text-indigo-300">
      {tag}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    'Administrador': 'bg-red-900/50 text-red-300',
    'Responsable de proyecto': 'bg-indigo-900/50 text-indigo-300',
    'Ingeniero/analista de IA': 'bg-violet-900/50 text-violet-300',
    'Revisor': 'bg-cyan-900/50 text-cyan-300',
    'Lector': 'bg-slate-800 text-slate-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[role] ?? 'bg-slate-800 text-slate-400'}`}>
      {role}
    </span>
  )
}

export function AuditBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    PROJECT_CREATED: 'bg-indigo-900/50 text-indigo-300',
    DATASET_UPLOADED: 'bg-cyan-900/50 text-cyan-300',
    ARCHITECTURE_CREATED: 'bg-violet-900/50 text-violet-300',
    TRAINING_QUEUED: 'bg-amber-900/50 text-amber-300',
    TRAINING_COMPLETED: 'bg-emerald-900/50 text-emerald-300',
    TRAINING_FAILED: 'bg-red-900/50 text-red-300',
    MODEL_STATUS_CHANGED: 'bg-purple-900/50 text-purple-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[action] ?? 'bg-slate-800 text-slate-400'}`}>
      {action}
    </span>
  )
}

