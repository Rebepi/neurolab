import { CheckCircle2, X } from 'lucide-react'
import type { Dataset } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'
import { ProblemTypeBadge } from './ProblemTypeBadge'

interface DatasetEdaPanelProps {
  dataset: Dataset
  onClose: () => void
}

export function DatasetEdaPanel({ dataset, onClose }: DatasetEdaPanelProps) {
  const eda = dataset.metadata

  return (
    <div className="bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span>Análisis Exploratorio</span>
            <InfoTip
              title="EDA Automatizado"
              text="Inspección estadística previa al entrenamiento: distribuciones, nulos, dimensionalidad de entrada y activación de salida sugerida."
              size="xs"
            />
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{dataset.name}</p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cerrar
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Filas', value: eda.total_rows },
            { label: 'Total Columnas', value: eda.total_columns },
            { label: 'Input Shape', value: eda.input_shape },
          ].map(c => (
            <div key={c.label} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-indigo-300 font-mono">{c.value}</p>
              <p className="text-xs text-slate-400 mt-1">{c.label}</p>
            </div>
          ))}
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5">
            <ProblemTypeBadge type={eda.problem_type} />
            <p className="text-xs text-slate-400">Tipo de Problema</p>
          </div>
        </div>

        <div className="bg-slate-800/40 border-2 border-indigo-500/40 rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Columna objetivo</p>
            <p className="text-sm font-mono text-indigo-300 font-semibold">{eda.target_column}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Activación de salida</p>
            <p className="text-sm font-mono text-violet-300">{eda.output_activation}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Output dim</p>
            <p className="text-sm font-mono text-slate-200">{eda.output_dim}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Loss sugerida</p>
            <p className="text-sm font-mono text-cyan-300">{eda.suggested_loss}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Métrica sugerida</p>
            <p className="text-sm font-mono text-emerald-300">{eda.suggested_metric}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Escalado aplicado</p>
            <p className="text-sm font-mono text-slate-300">{eda.scaler_applied}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Features ({eda.feature_names.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {eda.feature_names.map(f => (
              <span
                key={f}
                className="bg-slate-800 text-slate-300 text-xs rounded px-2 py-0.5 font-mono border border-slate-700/40"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Partición de datos
          </p>
          <div className="flex rounded-xl overflow-hidden h-10">
            {[
              { label: 'Train', count: eda.splits.train_count, pct: eda.splits.train_ratio, color: 'bg-indigo-600' },
              { label: 'Val', count: eda.splits.val_count, pct: eda.splits.val_ratio, color: 'bg-violet-600' },
              { label: 'Test', count: eda.splits.test_count, pct: eda.splits.test_ratio, color: 'bg-slate-600' },
            ].map(seg => (
              <div
                key={seg.label}
                className={`${seg.color} flex items-center justify-center`}
                style={{ width: `${(seg.pct * 100).toFixed(0)}%` }}
              >
                <span className="text-xs text-white font-semibold drop-shadow">
                  {seg.label} {seg.count}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            El conjunto Test permanece aislado durante entrenamiento
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Resumen de columnas
          </p>
          <div className="rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                  {['Columna', 'Tipo', 'Nulos', 'Únicos', 'Estadísticas'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {eda.columns_summary.map(col => (
                  <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-slate-200">{col.name}</span>
                      {col.is_target && (
                        <span className="ml-2 text-xs bg-indigo-900/50 text-indigo-300 rounded px-1">target</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs rounded px-2 py-0.5 font-medium ${
                          col.dtype === 'numeric'
                            ? 'bg-blue-900/50 text-blue-300'
                            : 'bg-orange-900/50 text-orange-300'
                        }`}
                      >
                        {col.dtype}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-mono font-semibold ${
                          col.missing === 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {col.missing}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono text-slate-300">{col.unique}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {col.dtype === 'numeric' && col.mean !== undefined ? (
                        <span className="text-xs text-slate-400 font-mono">
                          {col.mean.toFixed(2)} ± {col.std?.toFixed(2)}
                        </span>
                      ) : col.top_values ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(col.top_values).slice(0, 2).map(([k]) => (
                            <span key={k} className="text-xs bg-slate-700 text-slate-300 rounded px-1.5 py-0.5 font-mono">
                              {k}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {eda.preview && eda.preview.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Primeras 10 filas
            </p>
            <div className="max-h-64 overflow-auto rounded-xl border border-slate-700/50">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-slate-800 z-10">
                  <tr>
                    {Object.keys(eda.preview[0]).map(k => (
                      <th key={k} className="px-3 py-2 text-left text-slate-400 font-medium font-mono border-b border-slate-700">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {eda.preview.slice(0, 10).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-3 py-2 text-slate-300 font-mono">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

