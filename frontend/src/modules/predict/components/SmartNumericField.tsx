import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'

interface SmartNumericFieldProps {
  id: string
  label: string
  value: number | ''
  defaultValue: number
  min: number
  max: number
  step: number
  isInteger?: boolean
  unit?: string
  prefix?: string
  help?: string
  onChange: (value: number | '') => void
}

function roundToStep(val: number, step: number, isInteger?: boolean): number {
  if (isInteger) return Math.round(val)
  const stepStr = String(step)
  const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0
  return Number(val.toFixed(Math.min(4, Math.max(decimals, 2))))
}

export function SmartNumericField({
  id,
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  isInteger,
  unit,
  prefix,
  help,
  onChange,
}: SmartNumericFieldProps) {
  const controlRef = useRef<HTMLDivElement | null>(null)
  const valueRef = useRef<number>(typeof value === 'number' && Number.isFinite(value) ? value : defaultValue)
  const holdTimerRef = useRef<number | null>(null)
  const holdIntervalRef = useRef<number | null>(null)
  const [hovered, setHovered] = useState(false)

  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : defaultValue
  const modified = Math.abs(numericValue - defaultValue) > 1e-6

  useEffect(() => {
    valueRef.current = numericValue
  }, [numericValue])

  const clampAndRound = useCallback(
    (raw: number) => {
      const clamped = max > min ? Math.min(max, Math.max(min, raw)) : raw
      return roundToStep(clamped, step, isInteger)
    },
    [isInteger, max, min, step]
  )

  // Rueda del ratón encima del campo: sube o baja el número sin mover el scroll de la página
  useEffect(() => {
    const el = controlRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const direction = e.deltaY < 0 ? 1 : -1
      const mult = e.shiftKey ? 5 : 1
      const next = clampAndRound(valueRef.current + direction * step * mult)
      if (next !== valueRef.current) {
        valueRef.current = next
        onChange(next)
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [clampAndRound, step, onChange])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
      if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current)
    }
  }, [])

  function stopHold() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
  }

  function nudge(direction: 1 | -1, shift = false) {
    const mult = shift ? 5 : 1
    const next = clampAndRound(valueRef.current + direction * step * mult)
    valueRef.current = next
    onChange(next)
  }

  function startHold(direction: 1 | -1) {
    stopHold()
    nudge(direction)
    holdTimerRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        nudge(direction)
      }, 75)
    }, 340)
  }

  const clampedSlider = max > min ? Math.min(max, Math.max(min, numericValue)) : numericValue
  const pct = max > min ? ((clampedSlider - min) / (max - min)) * 100 : 0
  const tipText =
    help ||
    `Variable numérica del modelo. Rango habitual entre ${prefix || ''}${min} y ${prefix || ''}${max}${unit ? ` ${unit}` : ''}.`

  return (
    <div
      className={`p-2.5 rounded-xl bg-slate-950/65 border transition-colors space-y-1.5 ${
        modified ? 'border-cyan-500/45 bg-cyan-500/[0.04]' : 'border-slate-800/90 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <label
          htmlFor={id}
          className="text-[11.5px] font-semibold text-slate-200 flex items-center gap-1 min-w-0"
        >
          {modified && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"
              title="Valor modificado respecto al promedio base"
            />
          )}
          <span className="truncate">{label}</span>
          <InfoTip
            title={label}
            text={tipText}
            hint={`Rango: ${prefix || ''}${min} – ${prefix || ''}${max}${unit ? ` ${unit}` : ''} · Promedio: ${prefix || ''}${defaultValue} · Rueda del ratón (Shift ×5)`}
            size="xs"
          />
        </label>

        <div className="flex items-center gap-1 shrink-0">
          {hovered && (
            <span className="hidden sm:inline-flex items-center px-1 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[9px] font-mono text-cyan-300 leading-none">
              ↕
            </span>
          )}
          {modified && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              title={`Restaurar a ${prefix || ''}${defaultValue}${unit ? ` ${unit}` : ''}`}
              aria-label={`Restaurar ${label}`}
              className="p-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-cyan-300 transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          )}
          {unit && (
            <span className="text-[9.5px] font-mono text-slate-400">{unit}</span>
          )}
        </div>
      </div>

      {/* Control numérico con botones -/+ y rueda del mouse */}
      <div
        ref={controlRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false)
          stopHold()
        }}
        className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 focus-within:border-cyan-500 hover:border-cyan-500/45 rounded-lg p-0.5 transition-colors"
        title="Mueve la rueda del ratón aquí para subir o bajar el valor (Shift + rueda para saltos ×5)"
      >
        <button
          type="button"
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          disabled={max > min && numericValue <= min}
          aria-label={`Disminuir ${label}`}
          className="w-6 h-6 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Minus className="w-3 h-3" />
        </button>

        <div className="flex items-center justify-center gap-0.5 flex-1 min-w-0 px-1">
          {prefix && (
            <span className="text-[11px] font-mono text-slate-400 select-none">{prefix}</span>
          )}
          <input
            id={id}
            type="number"
            step={step}
            value={value}
            onChange={e => {
              const raw = e.target.value
              onChange(raw === '' ? '' : Number(raw))
            }}
            onBlur={e => {
              if (e.target.value === '' || Number.isNaN(Number(e.target.value))) {
                onChange(defaultValue)
              }
            }}
            className="w-full bg-transparent text-center font-mono font-bold text-xs text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <button
          type="button"
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          disabled={max > min && numericValue >= max}
          aria-label={`Aumentar ${label}`}
          className="w-6 h-6 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-35 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {max > min && (
        <div className="space-y-0.5">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={clampedSlider}
            aria-label={`Deslizador de ${label}`}
            onChange={e => onChange(clampAndRound(Number(e.target.value)))}
            className="w-full"
            style={{
              background: `linear-gradient(to right, var(--nl-accent-light) ${pct}%, rgba(148,163,184,0.22) ${pct}%)`,
            }}
          />
          <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-500 leading-none">
            <span>
              {prefix || ''}
              {min}
            </span>
            <span className="text-slate-600">
              Prom {prefix || ''}
              {defaultValue}
            </span>
            <span>
              {prefix || ''}
              {max}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
