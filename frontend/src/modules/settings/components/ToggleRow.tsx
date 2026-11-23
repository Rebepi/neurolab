import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { ToggleSwitch } from './ToggleSwitch'

interface ModifiedBadgeProps {
  onRevert: () => void
  disabled?: boolean
  title?: string
}

export function ModifiedBadge({ onRevert, disabled = false, title }: ModifiedBadgeProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onRevert}
      title={title || 'Revertir al valor guardado'}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[10px] font-bold hover:bg-amber-500/25 disabled:opacity-45 transition-colors"
    >
      <RotateCcw className="w-3 h-3" />
      <span>Modificado</span>
    </button>
  )
}

interface ToggleRowProps {
  title: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
  icon?: ReactNode
  iconBoxCls?: string
  baseline?: boolean
  disabled?: boolean
  tone?: 'indigo' | 'amber'
  autoSave?: boolean
}

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  icon,
  iconBoxCls = 'bg-cyan-500/15 border-cyan-500/30',
  baseline,
  disabled = false,
  tone = 'indigo',
  autoSave = false,
}: ToggleRowProps) {
  const modified = !autoSave && baseline !== undefined && baseline !== checked

  return (
    <div
      className={`flex items-center justify-between gap-3 bg-slate-950/60 border rounded-xl p-4 transition-colors ${
        modified ? 'border-amber-500/40' : 'border-slate-800/80'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconBoxCls}`}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-white text-xs font-bold">{title}</p>
            {autoSave && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[9.5px] font-mono border border-cyan-500/20">
                Auto
              </span>
            )}
            {modified && (
              <ModifiedBadge disabled={disabled} onRevert={() => onChange(baseline as boolean)} />
            )}
          </div>
          <p className="text-slate-400 text-[11px] mt-0.5">{description}</p>
        </div>
      </div>

      <ToggleSwitch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        tone={tone}
        ariaLabel={title}
      />
    </div>
  )
}
