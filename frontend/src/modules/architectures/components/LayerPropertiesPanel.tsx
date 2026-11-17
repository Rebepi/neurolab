import { Sliders } from 'lucide-react'
import type { Architecture, LayerSpec } from '../../../types/index'
import { SystemSelect } from '../../../components/SystemSelect'

interface LayerPropertiesPanelProps {
  selectedLayer: LayerSpec | null
  onUpdateLayer: (patch: Partial<LayerSpec>) => void
  savedArchitectures: Architecture[]
}

export function LayerPropertiesPanel({
  selectedLayer,
  onUpdateLayer,
  savedArchitectures,
}: LayerPropertiesPanelProps) {
  return (
    <div className="lg:col-span-3 space-y-4">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 space-y-4">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          Propiedades de la Capa
        </h3>

        {selectedLayer ? (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Tipo de Capa:</span>
              <span className="font-semibold text-white">{selectedLayer.type}</span>
            </div>

            {selectedLayer.type === 'Dense' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Unidades (Neuronas):</span>
                    <span className="text-indigo-400 font-mono font-bold">{selectedLayer.units}</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={256}
                    step={4}
                    value={selectedLayer.units || 32}
                    onChange={e => onUpdateLayer({ units: parseInt(e.target.value, 10) })}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 text-xs block mb-1">Función de Activación:</label>
                  <SystemSelect
                    value={selectedLayer.activation || 'relu'}
                    onChange={val => onUpdateLayer({ activation: val as LayerSpec['activation'] })}
                    size="xs"
                    ariaLabel="Función de Activación"
                    options={[
                      { value: 'relu', label: 'ReLU (Recomendada para ocultas)' },
                      { value: 'tanh', label: 'Tanh (Tangente hiperbólica)' },
                      { value: 'sigmoid', label: 'Sigmoide' },
                      { value: 'linear', label: 'Lineal' },
                    ]}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-300">Usar sesgo (bias b):</span>
                  <input
                    type="checkbox"
                    checked={selectedLayer.use_bias !== false}
                    onChange={e => onUpdateLayer({ use_bias: e.target.checked })}
                    className="rounded accent-indigo-500"
                  />
                </div>
              </>
            )}

            {selectedLayer.type === 'Dropout' && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Tasa de Desconexión (Rate):</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {((selectedLayer.rate || 0.2) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.7}
                  step={0.05}
                  value={selectedLayer.rate || 0.2}
                  onChange={e => onUpdateLayer({ rate: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">
            Selecciona una capa en el lienzo para ajustar sus hiperparámetros.
          </p>
        )}
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 space-y-2">
        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Arquitecturas Guardadas</h4>
        {savedArchitectures.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No hay arquitecturas previas.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {savedArchitectures.map(arch => (
              <div key={arch.id} className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                <p className="text-white font-bold truncate">{arch.name}</p>
                <p className="text-slate-400 text-[10px]">
                  {arch.family} · {arch.total_parameters.toLocaleString()} params · v{arch.version}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

