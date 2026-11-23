import { Lock, Layers, ArrowRight } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import type { ActivationType } from '../types'

interface TopologyInspectorTabProps {
  layerSizes: number[]
  layerActivations: ActivationType[]
  trainedVersion: string | null
  targetName: string
  onGoToArchitectures?: () => void
}

export function TopologyInspectorTab({
  layerSizes,
  layerActivations,
  trainedVersion,
  targetName,
  onGoToArchitectures,
}: TopologyInspectorTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-xl bg-teal-950/35 border border-teal-500/35 space-y-1.5">
        <p className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>
            {trainedVersion
              ? `Topología Sellada al Modelo Keras ${trainedVersion}`
              : 'Topología Sincronizada con el Área'}
          </span>
        </p>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          Para garantizar fidelidad matemática con el modelo real entrenado en TensorFlow, las capas y neuronas aquí son de solo lectura. Si deseas modificar la red, hazlo en <strong>Arquitecturas</strong> y vuelve a entrenar.
        </p>
        {onGoToArchitectures && (
          <button
            type="button"
            onClick={onGoToArchitectures}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-300 hover:text-white pt-1 transition-colors"
          >
            <span>Ir a Diseñar Nueva Arquitectura</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Estructura Real de Capas ({layerSizes.length})</span>
            <InfoTip
              text="Desglose exacto de dimensiones y funciones de activación extraído directamente del grafo compilado en Keras."
              size="xs"
            />
          </p>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {layerSizes.map((count, lIdx) => {
            const isInput = lIdx === 0
            const isOutput = lIdx === layerSizes.length - 1
            const name = isInput
              ? 'Capa de Entrada (Features)'
              : isOutput
                ? `Capa de Salida (${targetName})`
                : `Capa Oculta Dense #${lIdx}`
            const act = (layerActivations[lIdx] || 'relu').toUpperCase()
            return (
              <div
                key={lIdx}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-white">{name}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {count} {count === 1 ? 'neurona' : 'neuronas'} en grafo visual
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-mono font-bold text-indigo-300">
                  {act}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
