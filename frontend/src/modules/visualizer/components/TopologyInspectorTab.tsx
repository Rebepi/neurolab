import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'
import { MAX_NEURONS_PER_LAYER, TOPOLOGY_PRESETS } from '../constants'
import type { ActivationType } from '../types'

interface TopologyInspectorTabProps {
  layerSizes: number[]
  layerActivations: ActivationType[]
  onApplyPreset: (sizes: number[], acts: ActivationType[]) => void
  onUpdateLayerActivation: (layerIdx: number, act: ActivationType) => void
  onSetExactLayerCount: (layerIdx: number, newCount: number) => void
}

export function TopologyInspectorTab({
  layerSizes,
  layerActivations,
  onApplyPreset,
  onUpdateLayerActivation,
  onSetExactLayerCount,
}: TopologyInspectorTabProps) {
  const [draftLayerCounts, setDraftLayerCounts] = useState<Record<number, string>>({})

  const clearDraft = (lIdx: number) => {
    setDraftLayerCounts(prev => {
      const next = { ...prev }
      delete next[lIdx]
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
          <span>Plantillas Rápidas de Arquitectura</span>
          <InfoTip
            text="Preajustes de topología listos para probar desde redes mínimas hasta capas masivas de 128 neuronas."
            size="xs"
          />
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TOPOLOGY_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => onApplyPreset(preset.sizes, preset.acts)}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-xs font-bold text-white transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>Neuronas por Capa (1 – 256)</span>
            <InfoTip
              text="Define cuántas neuronas integran cada columna y la función de activación usada al pasar a la siguiente capa."
              size="xs"
            />
          </p>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {layerSizes.map((count, lIdx) => {
            const isInput = lIdx === 0
            const isOutput = lIdx === layerSizes.length - 1
            const name = isInput
              ? 'Capa de Entrada (X)'
              : isOutput
                ? 'Capa de Salida (Ŷ)'
                : `Capa Oculta H${lIdx}`
            return (
              <div
                key={lIdx}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">{name}</span>
                  {!isInput && (
                    <SystemSelect
                      value={layerActivations[lIdx] || 'relu'}
                      onChange={val => onUpdateLayerActivation(lIdx, val as ActivationType)}
                      size="xs"
                      className="w-32"
                      align="right"
                      menuMinWidth={150}
                      triggerClassName="text-indigo-400 font-mono"
                      ariaLabel={`Activación de ${name}`}
                      options={[
                        { value: 'relu', label: 'ReLU', mono: true },
                        { value: 'sigmoid', label: 'Sigmoid', mono: true },
                        { value: 'tanh', label: 'Tanh', mono: true },
                        { value: 'leaky_relu', label: 'LeakyReLU', mono: true },
                        { value: 'softmax', label: 'Softmax', mono: true },
                        { value: 'linear', label: 'Linear', mono: true },
                      ]}
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <SystemTooltip label="Quitar 1 neurona" side="top">
                    <button
                      onClick={() => {
                        clearDraft(lIdx)
                        onSetExactLayerCount(lIdx, count - 1)
                      }}
                      disabled={count <= 1}
                      className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white flex items-center justify-center disabled:opacity-40"
                      aria-label="Quitar 1 neurona"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </SystemTooltip>
                  <input
                    type="range"
                    min={1}
                    max={MAX_NEURONS_PER_LAYER}
                    value={count}
                    onChange={e => {
                      clearDraft(lIdx)
                      onSetExactLayerCount(lIdx, parseInt(e.target.value, 10))
                    }}
                    className="flex-1 accent-teal-600 h-1.5 bg-slate-800 rounded-lg"
                  />
                  <SystemTooltip label="Añadir 1 neurona" side="top">
                    <button
                      onClick={() => {
                        clearDraft(lIdx)
                        onSetExactLayerCount(lIdx, count + 1)
                      }}
                      disabled={count >= MAX_NEURONS_PER_LAYER}
                      className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white flex items-center justify-center disabled:opacity-40"
                      aria-label="Añadir 1 neurona"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </SystemTooltip>
                  <input
                    type="number"
                    min={1}
                    max={MAX_NEURONS_PER_LAYER}
                    value={draftLayerCounts[lIdx] ?? String(count)}
                    onChange={e => {
                      const raw = e.target.value
                      setDraftLayerCounts(prev => ({ ...prev, [lIdx]: raw }))
                      const v = parseInt(raw, 10)
                      if (!Number.isNaN(v) && v >= 1 && v <= MAX_NEURONS_PER_LAYER) {
                        onSetExactLayerCount(lIdx, v)
                      }
                    }}
                    onBlur={() => {
                      const raw = draftLayerCounts[lIdx]
                      if (raw !== undefined) {
                        const v = parseInt(raw, 10)
                        if (!Number.isNaN(v)) {
                          onSetExactLayerCount(lIdx, v)
                        }
                        clearDraft(lIdx)
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        (e.currentTarget as HTMLInputElement).blur()
                      }
                    }}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-white text-right"
                    aria-label={`Neuronas en ${name}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

