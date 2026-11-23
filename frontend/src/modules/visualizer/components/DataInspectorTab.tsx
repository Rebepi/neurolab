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
  targetName: string
  onInputSliderChange: (idx: number, val: number) => void
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
  targetName,
  onInputSliderChange,
}: DataInspectorTabProps) {
  return (
    <div className="space-y-4">
      {datasetSamples.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-white mb-1.5">
            Seleccionar Muestra Real de Test ({datasetSamples.length} disponibles):
          </label>
          <SystemSelect
            value={String(selectedSampleIdx)}
            onChange={val => onSelectSample(parseInt(val, 10))}
            size="sm"
            searchable
            searchPlaceholder="Buscar # de muestra de test..."
            maxVisibleOptions={25}
            ariaLabel="Seleccionar Muestra Real de Test"
            options={datasetSamples.map((s, idx) => ({
              value: String(idx),
              label: `Registro Real Test #${s.index}`,
              mono: true,
            }))}
          />
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
          <span>
            Vector de Entrada Normalizado (X)
            {inputCount > 32 && (
              <span className="ml-1.5 font-normal text-slate-400">· primeras 32 de {inputCount}</span>
            )}
          </span>
          <InfoTip
            text="Valores reales escalados (Z-Score) inyectados en la capa inicial del modelo Keras."
            size="xs"
          />
        </p>
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {Array.from({ length: Math.min(32, inputCount) }).map((_, idx) => (
            <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white font-mono font-semibold truncate">
                  {featureNames[idx] || `Feature ${idx + 1}`}
                </span>
                <span className="text-indigo-400 font-mono font-bold">
                  {(inputValues[idx] ?? defaultInputValue(idx)).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="-3.0"
                max="3.0"
                step="0.05"
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
          <span>Etiqueta Real en el Dataset ({targetName})</span>
          <InfoTip
            text="Valor real registrado en el conjunto de prueba sellado (15%) para esta muestra."
            size="xs"
          />
        </p>
        <div className="grid grid-cols-1 gap-2">
          {Array.from({ length: outputCount }).map((_, k) => (
            <div key={k} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-300">{targetName} [{k}]:</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {targetValues[k] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
