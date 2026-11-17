import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  ArrowRight,
  ArrowLeft,
  Cpu,
  StepForward,
} from 'lucide-react'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import type { SimMode } from '../types'

interface VisualizerToolbarProps {
  isPlaying: boolean
  onTogglePlay: () => void
  onStepWave: () => void
  onResetNetwork: () => void
  simMode: SimMode
  onSelectSimMode: (mode: SimMode) => void
  hiddenLayerCount: number
  layerCount: number
  onRemoveHiddenLayer: () => void
  onAddHiddenLayer: () => void
  totalNeurons: number
  totalSynapses: number
  liveLoss: number
  liveAcc: number
  hasProject: boolean
  onSyncProject: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export function VisualizerToolbar({
  isPlaying,
  onTogglePlay,
  onStepWave,
  onResetNetwork,
  simMode,
  onSelectSimMode,
  hiddenLayerCount,
  layerCount,
  onRemoveHiddenLayer,
  onAddHiddenLayer,
  totalNeurons,
  totalSynapses,
  liveLoss,
  liveAcc,
  hasProject,
  onSyncProject,
  isFullscreen,
  onToggleFullscreen,
}: VisualizerToolbarProps) {
  return (
    <div className="nl-surface rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={onTogglePlay}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'nl-accent-bg shadow-xs'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
          </button>

          <SystemTooltip label="Avanzar señal paso a paso hacia la siguiente capa" side="bottom">
            <button
              onClick={onStepWave}
              className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              aria-label="Avanzar señal hacia la siguiente capa"
            >
              <StepForward className="w-3.5 h-3.5 text-indigo-400" />
              <span>Paso a Paso</span>
            </button>
          </SystemTooltip>

          <SystemTooltip label="Reiniciar pesos y restablecer la red" side="bottom">
            <button
              onClick={onResetNetwork}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              aria-label="Reiniciar red"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </SystemTooltip>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <SystemTooltip
            title="Modo Predicción (Forward Pass)"
            label="Propaga los valores de entrada hacia adelante para calcular la salida sin modificar los pesos."
            side="bottom"
          >
            <button
              onClick={() => onSelectSimMode('forward_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                simMode === 'forward_only'
                  ? 'nl-accent-bg shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>1. Predicción (Avance →)</span>
            </button>
          </SystemTooltip>

          <SystemTooltip
            title="Modo Aprendizaje (Backpropagation)"
            label="Ejecuta avance hacia la salida y retropropagación de gradientes desde el error para ajustar pesos en cada ciclo."
            side="bottom"
          >
            <button
              onClick={() => onSelectSimMode('auto_train')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                simMode === 'auto_train'
                  ? 'nl-accent-bg shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>2. Aprendizaje (Ida y Vuelta ⇄)</span>
            </button>
          </SystemTooltip>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <span>Capas Ocultas:</span>
            <InfoTip
              title="Profundidad de la Red"
              text="Número de capas intermedias entre la entrada (X) y la salida (Ŷ). Más capas permiten aprender relaciones no lineales complejas."
              size="xs"
              side="bottom"
            />
          </span>
          <SystemTooltip label="Quitar última capa oculta" side="bottom">
            <button
              onClick={onRemoveHiddenLayer}
              disabled={layerCount <= 3}
              className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 flex items-center justify-center text-white"
              aria-label="Quitar capa oculta"
            >
              <Minus className="w-3 h-3" />
            </button>
          </SystemTooltip>
          <span className="text-xs font-mono font-extrabold text-white px-1">
            {hiddenLayerCount}
          </span>
          <SystemTooltip label="Añadir una nueva capa oculta" side="bottom">
            <button
              onClick={onAddHiddenLayer}
              disabled={layerCount >= 8}
              className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 flex items-center justify-center text-white"
              aria-label="Añadir capa oculta"
            >
              <Plus className="w-3 h-3" />
            </button>
          </SystemTooltip>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400 inline-flex items-center gap-1">
            <span>
              Red: <strong className="text-white">{totalNeurons.toLocaleString('es')}N</strong> ·{' '}
              <strong className="text-indigo-400">{totalSynapses.toLocaleString('es')}W</strong>
            </span>
            <InfoTip
              title="Tamaño Sináptico"
              text="N = total de neuronas activas en la red. W = conexiones entrenables (pesos) entre capas adyacentes."
              size="xs"
              side="bottom"
            />
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 inline-flex items-center gap-1">
            <span>
              Loss: <strong className="text-amber-400">{liveLoss.toFixed(4)}</strong>
            </span>
            <InfoTip
              title="Función de Pérdida (Loss)"
              text="Error cuadrático/cruzado promedio respecto al objetivo Y. Cuanto más cercano a 0, mejor ajusta la red."
              size="xs"
              side="bottom"
            />
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 inline-flex items-center gap-1">
            <span>
              Fidelidad: <strong className="text-emerald-400">{liveAcc.toFixed(1)}%</strong>
            </span>
            <InfoTip
              title="Fidelidad de Salida"
              text="Cercanía porcentual entre la predicción actual Ŷ y el objetivo esperado Y."
              size="xs"
              side="bottom"
            />
          </span>
        </div>

        {hasProject && (
          <SystemTooltip
            title="Sincronizar con Proyecto"
            label="Carga la última arquitectura definida y pesos reales entrenados de este proyecto."
            side="bottom"
          >
            <button
              onClick={onSyncProject}
              className="nl-btn-shimmer px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-xs font-bold text-white flex items-center gap-1.5 transition-all"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Cargar Red del Proyecto</span>
            </button>
          </SystemTooltip>
        )}

        <SystemTooltip
          label={isFullscreen ? 'Salir de Pantalla Completa' : 'Expandir lienzo a Pantalla Completa'}
          hint={isFullscreen ? 'Tecla Esc' : undefined}
          side="bottom"
        >
          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white transition-all"
            aria-label={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </SystemTooltip>
      </div>
    </div>
  )
}

