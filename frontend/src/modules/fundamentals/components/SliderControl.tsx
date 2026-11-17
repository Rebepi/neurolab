import { Minus, Plus } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'

interface SliderControlProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  accentColor: string
  badgeClass: string
  info?: string
  onChange: (value: number) => void
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step = 0.1,
  accentColor,
  badgeClass,
  info,
  onChange,
}: SliderControlProps) {
  const ratio = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  const adjust = (delta: number) => {
    const next = Math.max(min, Math.min(max, Number((value + delta).toFixed(2))))
    onChange(next)
  }

  return (
    <div className="bg-slate-950/55 border border-slate-800/80 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-200 text-xs font-medium flex items-center gap-1.5">
          <span>{label}</span>
          {info && <InfoTip text={info} size="xs" />}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => adjust(-step)}
            disabled={value <= min}
            aria-label={`Disminuir ${label}`}
            className="w-5 h-5 rounded-md bg-slate-800/90 hover:bg-slate-700 disabled:opacity-35 text-slate-300 flex items-center justify-center transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className={`min-w-[54px] text-center px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${badgeClass}`}>
            {value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => adjust(step)}
            disabled={value >= max}
            aria-label={`Aumentar ${label}`}
            className="w-5 h-5 rounded-md bg-slate-800/90 hover:bg-slate-700 disabled:opacity-35 text-slate-300 flex items-center justify-center transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${ratio}%, rgba(100, 116, 139, 0.35) ${ratio}%, rgba(100, 116, 139, 0.35) 100%)`,
        }}
        className="w-full"
      />

      <div className="flex justify-between text-[10px] font-mono text-slate-500 leading-none">
        <span>{min.toFixed(1)}</span>
        <span>0.0</span>
        <span>+{max.toFixed(1)}</span>
      </div>
    </div>
  )
}

