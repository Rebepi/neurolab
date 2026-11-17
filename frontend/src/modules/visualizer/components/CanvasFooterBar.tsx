import { InfoTip } from '../../../components/InfoTip'
import { SPEED_PRESETS } from '../constants'

interface CanvasFooterBarProps {
  speed: number
  onChangeSpeed: (val: number) => void
  showNumbers: boolean
  onToggleNumbers: (val: boolean) => void
  showWeights: boolean
  onToggleWeights: (val: boolean) => void
}

export function CanvasFooterBar({
  speed,
  onChangeSpeed,
  showNumbers,
  onToggleNumbers,
  showWeights,
  onToggleWeights,
}: CanvasFooterBarProps) {
  return (
    <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-4 text-xs">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <span>Velocidad de Señal:</span>
            <InfoTip
              text="Controla qué tan rápido viaja el pulso visual de activación o gradiente entre capas."
              size="xs"
            />
          </span>
          {SPEED_PRESETS.map(s => (
            <button
              key={s.label}
              onClick={() => onChangeSpeed(s.val)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                Math.abs(speed - s.val) < 0.05
                  ? 'nl-accent-bg'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={e => onToggleNumbers(e.target.checked)}
            className="rounded accent-teal-600"
          />
          <span>Mostrar valores en neuronas</span>
          <InfoTip
            text="Dibuja el valor numérico de activación (a) y sesgo (b) directamente dentro de cada nodo visible."
            size="xs"
          />
        </label>

        <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showWeights}
            onChange={e => onToggleWeights(e.target.checked)}
            className="rounded accent-teal-600"
          />
          <span>Mostrar pesos en conexiones</span>
          <InfoTip
            text="Muestra etiquetas numéricas con los pesos sinápticos (w) de las conexiones visibles al hacer zoom."
            size="xs"
          />
        </label>
      </div>
    </div>
  )
}

