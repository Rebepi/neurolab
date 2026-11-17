import { InfoTip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'
import { defaultInputValue } from '../mathEngine'
import type { DatasetSample } from '../types'

interface DataInspectorTabProps {
  datasetSamples: DatasetSample[]
  selectedSampleIdx: number
  onSelectSample: (idx: number) => void
  inputCount: number
  outputCount: number
  inputValues: number[]
  targetValues: number[]
  featureNames: string[]
  learningRate: number
  onInputSliderChange: (idx: number, val: number) => void
  onTargetChange: (idx: number, val: number) => void
  onLearningRateChange: (val: number) => void
}

export function DataInspectorTab({
  datasetSamples,
  selectedSampleIdx,
  onSelectSample,
  inputCount,
  outputCount,
  inputValues,
  targetValues,
  featureNames,
  learningRate,
  onInputSliderChange,
  onTargetChange,
  onLearningRateChange,
}: DataInspectorTabProps) {
  return (
    <div className="space-y-4">
      {datasetSamples.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-white mb-1.5">
            Cargar Fila Real del Dataset del Proyecto:
          </label>
          <SystemSelect
            value={String(selectedSampleIdx)}
            onChange={val => onSelectSample(parseInt(val, 10))}
            size="sm"
            ariaLabel="Cargar Fila Real del Dataset del Proyecto"
            options={datasetSamples.map((s, idx) => ({
              value: String(idx),
              label: `Muestra Real #${s.index} del Dataset`,
              mono: true,
            }))}
          />
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
          <span>
            Valores de Entrada (X)
            {inputCount > 32 && (
              <span className="ml-1.5 font-normal text-slate-400">· primeras 32 de {inputCount}</span>
            )}
          </span>
          <InfoTip
            text="Vector de entrada normalizado que inyectas en la capa inicial para observar la respuesta de la red."
            size="xs"
          />
        </p>
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {Array.from({ length: Math.min(32, inputCount) }).map((_, idx) => (
            <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white font-mono font-semibold truncate">
                  IN·{idx + 1} {featureNames[idx] ? `(${featureNames[idx]})` : ''}
                </span>
                <span className="text-indigo-400 font-mono font-bold">
                  {(inputValues[idx] ?? defaultInputValue(idx)).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="2.0"
                step="0.02"
                value={inputValues[idx] ?? defaultInputValue(idx)}
                onChange={e => onInputSliderChange(idx, parseFloat(e.target.value))}
                className="w-full accent-teal-600 h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
          <span>Valor Esperado en la Salida (Objetivo Y)</span>
          <InfoTip
            text="Etiqueta real esperada para calcular el error (Loss) y guiar el aprendizaje en retropropagación."
            size="xs"
          />
        </p>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: outputCount }).map((_, k) => (
            <div key={k} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-mono text-white">Salida y_{k + 1}:</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={targetValues[k] ?? (k === 0 ? 1 : 0)}
                onChange={e => onTargetChange(k, parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-mono font-bold text-emerald-400"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white font-bold flex items-center gap-1.5">
            <span>Tasa de Aprendizaje (η)</span>
            <InfoTip
              text="Tamaño del paso de actualización por gradiente: valores altos aprenden rápido pero pueden oscilar; valores bajos convergen con suavidad."
              size="xs"
            />
          </span>
          <span className="text-amber-400 font-mono font-bold">{learningRate.toFixed(3)}</span>
        </div>
        <input
          type="range"
          min="0.005"
          max="0.500"
          step="0.005"
          value={learningRate}
          onChange={e => onLearningRateChange(parseFloat(e.target.value))}
          className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg"
        />
      </div>
    </div>
  )
}

