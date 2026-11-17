export function ProblemTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    binary_classification: 'bg-indigo-900/60 text-indigo-300 border-indigo-700',
    multiclass_classification: 'bg-violet-900/60 text-violet-300 border-violet-700',
    regression: 'bg-cyan-900/60 text-cyan-300 border-cyan-700',
  }
  const labels: Record<string, string> = {
    binary_classification: 'Clasificación Binaria',
    multiclass_classification: 'Clasificación Multiclase',
    regression: 'Regresión',
  }
  const cls = map[type] ?? 'bg-slate-800 text-slate-300 border-slate-600'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {labels[type] ?? type}
    </span>
  )
}

