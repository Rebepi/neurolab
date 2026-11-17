import { Database, FileSpreadsheet } from 'lucide-react'
import type { Dataset } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'

interface DatasetCardListProps {
  datasets: Dataset[]
  selectedDataset: Dataset | null
  onToggleEda: (ds: Dataset) => void
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function DatasetCardList({ datasets, selectedDataset, onToggleEda }: DatasetCardListProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Datasets del Proyecto</h2>
      {datasets.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 flex flex-col items-center gap-3 text-slate-500">
          <Database className="w-10 h-10 text-slate-700" />
          <p className="text-sm">No hay datasets cargados aún</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {datasets.map(ds => (
            <div
              key={ds.id}
              className="bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-xl p-5 flex flex-col gap-3 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100">{ds.name}</p>
                  <span className="text-xs font-mono bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded mt-1 inline-block">
                    v{ds.version}
                  </span>
                </div>
                <FileSpreadsheet className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              </div>

              <p className="text-xs text-slate-400">
                <span className="font-mono text-indigo-300">{ds.input_shape}</span> features →{' '}
                <span className="font-mono text-violet-300">{ds.target}</span>
              </p>

              <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-300 font-medium">
                  Total: {ds.splits.train_count + ds.splits.val_count + ds.splits.test_count} filas
                </span>
                {' '}·{' '}Train: {ds.splits.train_count} · Val: {ds.splits.val_count} · Test: {ds.splits.test_count}
                <InfoTip
                  title="Partición Estratificada 70 / 15 / 15"
                  text="Train (70%) ajusta pesos; Val (15%) monitorea épocas; Test (15%) permanece sellado para evaluación final sin fuga de datos."
                  size="xs"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">{formatDate(ds.created_at)}</p>
                <button
                  onClick={() => onToggleEda(ds)}
                  className="text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-600/30 rounded-lg px-3 py-1.5 transition-colors"
                >
                  {selectedDataset?.id === ds.id ? 'Cerrar EDA' : 'Ver EDA'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

