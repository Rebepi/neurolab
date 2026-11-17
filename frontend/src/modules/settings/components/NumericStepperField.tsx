import { Minus, Plus } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'

interface NumericStepperFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  info?: string
  disabled?: boolean
  onChange: (value: number) => void
}

export function NumericStepperField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  info,
  disabled = false,
  onChange,
}: NumericStepperFieldProps) {
  function clamp(next: number) {
    if (Number.isNaN(next)) return min
    return Math.min(max, Math.max(min, next))
  }

  return (
    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <label className="text-slate-200 text-xs font-semibold flex items-center gap-1.5">
            <span>{label}</span>
            {info && <InfoTip text={info} size="xs" />}
          </label>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            Rango: {min} – {max}{unit ? ` ${unit}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 focus-within:border-indigo-500/80 rounded-xl p-1 transition-colors">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - step))}
          aria-label={`Disminuir ${label}`}
          className="w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center justify-center gap-1.5 flex-1 min-w-0">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={e => {
              const parsed = parseInt(e.target.value, 10)
              if (!Number.isNaN(parsed)) onChange(parsed)
            }}
            onBlur={e => {
              const parsed = parseInt(e.target.value, 10)
              onChange(clamp(Number.isNaN(parsed) ? value : parsed))
            }}
            className="w-20 bg-transparent text-center font-mono font-bold text-sm text-white outline-none disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && (
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              {unit}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + step))}
          aria-label={`Aumentar ${label}`}
          className="w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

