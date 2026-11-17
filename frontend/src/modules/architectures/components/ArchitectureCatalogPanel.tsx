import { Plus } from 'lucide-react'
import { SystemSelect } from '../../../components/SystemSelect'

interface ArchitectureCatalogPanelProps {
  onAddLayer: (type: 'Dense' | 'Dropout' | 'BatchNormalization') => void
  archName: string
  onChangeArchName: (val: string) => void
  family: 'Feedforward' | 'RNN' | 'CNN' | 'GAN'
  onChangeFamily: (val: 'Feedforward' | 'RNN' | 'CNN' | 'GAN') => void
  inputShape: number
  outputDim: number
  totalParams: number
}

export function ArchitectureCatalogPanel({
  onAddLayer,
  archName,
  onChangeArchName,
  family,
  onChangeFamily,
  inputShape,
  outputDim,
  totalParams,
}: ArchitectureCatalogPanelProps) {
  return (
    <div className="lg:col-span-3 space-y-4">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-400" />
          Catálogo de Capas
        </h3>
        <p className="text-slate-400 text-xs">Haz clic para incorporar una capa a la red:</p>

        <div className="space-y-2">
          <button
            onClick={() => onAddLayer('Dense')}
            className="w-full py-2.5 px-3 rounded-xl bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center justify-between transition-all"
          >
            <span>+ Capa Densa (Dense)</span>
            <span className="text-[10px] bg-indigo-900/80 px-2 py-0.5 rounded text-indigo-200">W·x + b</span>
          </button>

          <button
            onClick={() => onAddLayer('Dropout')}
            className="w-full py-2.5 px-3 rounded-xl bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 text-amber-300 text-xs font-semibold flex items-center justify-between transition-all"
          >
            <span>+ Capa Dropout</span>
            <span className="text-[10px] bg-amber-900/80 px-2 py-0.5 rounded text-amber-200">Regularización</span>
          </button>

          <button
            onClick={() => onAddLayer('BatchNormalization')}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-700/30 border border-slate-600/40 hover:bg-slate-700/40 text-slate-300 text-xs font-semibold flex items-center justify-between transition-all"
          >
            <span>+ Batch Normalization</span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Normalizar</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Metadatos de la Red</h4>
        <div>
          <label className="text-slate-300 text-xs block mb-1">Nombre de la Arquitectura:</label>
          <input
            type="text"
            value={archName}
            onChange={e => onChangeArchName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-slate-300 text-xs block mb-1">Familia de Red:</label>
          <SystemSelect
            value={family}
            onChange={val => onChangeFamily(val as 'Feedforward' | 'RNN' | 'CNN' | 'GAN')}
            size="xs"
            ariaLabel="Familia de Red"
            options={[
              { value: 'Feedforward', label: 'Feedforward / MLP (Tabular)' },
              { value: 'CNN', label: 'CNN (Convolucional - Imágenes)' },
              { value: 'RNN', label: 'RNN / LSTM (Secuencias temporales)' },
              { value: 'GAN', label: 'GAN (Generativa antagónica)' },
            ]}
          />
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Dimensión de Entrada:</span>
            <span className="text-indigo-400 font-mono font-bold">{inputShape} features</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Dimensión de Salida:</span>
            <span className="text-indigo-400 font-mono font-bold">
              {outputDim} {outputDim === 1 ? 'unidad' : 'unidades'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Parámetros Totales:</span>
            <span className="text-emerald-400 font-mono font-bold">{totalParams.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

