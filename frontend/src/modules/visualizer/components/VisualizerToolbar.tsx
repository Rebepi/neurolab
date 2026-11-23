import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  ArrowRight,
  Cpu,
  StepForward,
  Lock,
  Sparkles,
} from 'lucide-react'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'

interface VisualizerToolbarProps {
  isPlaying: boolean
  onTogglePlay: () => void
  onStepWave: () => void
  onResetNetwork: () => void
  totalNeurons: number
  totalSynapses: number
  liveLoss: number
  liveAcc: number
  hasProject: boolean
  trainedVersion: string | null
  datasetName: string | null
  onSyncProject: () => void
  onOpenTwin3D?: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export function VisualizerToolbar({
  isPlaying,
  onTogglePlay,
  onStepWave,
  onResetNetwork,
  totalNeurons,
  totalSynapses,
  liveLoss,
  liveAcc,
  hasProject,
  trainedVersion,
  datasetName,
  onSyncProject,
  onOpenTwin3D,
  isFullscreen,
  onToggleFullscreen,
}: VisualizerToolbarProps) {
  return (
    <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
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

          <SystemTooltip label="Avanzar señal Forward Pass capa por capa" side="bottom">
            <button
              onClick={onStepWave}
              className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              aria-label="Avanzar señal hacia la siguiente capa"
            >
              <StepForward className="w-3.5 h-3.5 text-indigo-400" />
              <span>Paso a Paso</span>
            </button>
          </SystemTooltip>

          <SystemTooltip label="Recargar pesos reales desde el modelo .keras" side="bottom">
            <button
              onClick={onResetNetwork}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              aria-label="Recargar red"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </SystemTooltip>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs font-mono">
          <Lock className="w-3.5 h-3.5 text-teal-300 shrink-0" />
          <span className="text-teal-200 font-bold">
            {trainedVersion ? `MODELO REAL KERAS ${trainedVersion}` : 'ARQUITECTURA DEL ÁREA'}
          </span>
          {datasetName && (
            <span className="hidden md:inline text-slate-400">· {datasetName}</span>
          )}
          <ArrowRight className="w-3.5 h-3.5 text-cyan-400 hidden sm:inline" />
          <span className="text-cyan-300 hidden sm:inline">Forward Pass Real</span>
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
              title="Arquitectura Activa"
              text="N = neuronas en la topología activa. W = conexiones sinápticas reales extraídas del binario .keras."
              size="xs"
              side="bottom"
            />
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 inline-flex items-center gap-1">
            <span>
              Loss Muestra: <strong className="text-amber-400">{liveLoss.toFixed(4)}</strong>
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 inline-flex items-center gap-1">
            <span>
              Ajuste: <strong className="text-emerald-400">{liveAcc.toFixed(1)}%</strong>
            </span>
          </span>
        </div>

        {hasProject && (
          <SystemTooltip
            title="Resincronizar Modelo Real"
            label="Recarga los pesos W, sesgos b y muestras de Test directamente desde el modelo .keras de esta área."
            side="bottom"
          >
            <button
              onClick={onSyncProject}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-xs font-bold text-white flex items-center gap-1.5 transition-all"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>Sincronizar .keras</span>
            </button>
          </SystemTooltip>
        )}

        {onOpenTwin3D && (
          <button
            onClick={onOpenTwin3D}
            className="nl-btn-shimmer px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-md transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Usar en Gemelo 3D</span>
          </button>
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
