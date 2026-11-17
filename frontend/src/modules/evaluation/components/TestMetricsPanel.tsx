import { Target, TrendingDown, Crosshair, RefreshCw, Star } from 'lucide-react'
import type { ModelVersion } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'

interface TestMetricsPanelProps {
  testMetrics?: ModelVersion['test_metrics'] | null
  confusionMatrix?: number[][] | null
  glassPanelClass: string
}

export function TestMetricsPanel({ testMetrics, confusionMatrix, glassPanelClass }: TestMetricsPanelProps) {
  return (
    <>
      {testMetrics && (
        <div>
          <h2 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span>Resultados en Test</span>
            <InfoTip
              title="Evaluación en Partición Sellada (15%)"
              text="Métricas calculadas una sola vez al finalizar el entrenamiento sobre datos nunca vistos por el modelo ni el escalador."
              size="xs"
            />
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: <Target size={20} />, label: 'Test Accuracy', value: `${(testMetrics.test_accuracy * 100).toFixed(2)}%`, gradient: 'from-emerald-400 to-emerald-600', info: 'Porcentaje global de predicciones correctas en el conjunto de test.' },
              { icon: <TrendingDown size={20} />, label: 'Test Loss', value: testMetrics.test_loss.toFixed(4), gradient: 'from-amber-400 to-amber-600', info: 'Valor final de la función de pérdida sobre los datos de prueba.' },
              { icon: <Crosshair size={20} />, label: 'Precision', value: `${(testMetrics.precision * 100).toFixed(2)}%`, gradient: 'from-indigo-400 to-indigo-600', info: 'De todas las predicciones positivas emitidas, cuántas eran realmente positivas.' },
              { icon: <RefreshCw size={20} />, label: 'Recall', value: `${(testMetrics.recall * 100).toFixed(2)}%`, gradient: 'from-violet-400 to-violet-600', info: 'Capacidad del modelo para detectar todos los casos positivos reales (sensibilidad).' },
              { icon: <Star size={20} />, label: 'F1-Score', value: `${(testMetrics.f1_score * 100).toFixed(2)}%`, gradient: 'from-cyan-400 to-cyan-600', info: 'Media armónica entre Precision y Recall; ideal cuando las clases están desbalanceadas.' },
            ].map(card => (
              <div key={card.label} className={`${glassPanelClass} p-4 flex flex-col items-center gap-2`}>
                <div className={`bg-gradient-to-br ${card.gradient} bg-clip-text text-transparent`}>
                  {card.icon}
                </div>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <span>{card.label}</span>
                  <InfoTip title={card.label} text={card.info} size="xs" />
                </span>
                <span className={`text-xl font-bold bg-gradient-to-br ${card.gradient} bg-clip-text text-transparent`}>
                  {card.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confusionMatrix && (
        <div>
          <h2 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span>Matriz de Confusión</span>
            <InfoTip
              title="Matriz de Confusión"
              text="La diagonal verde muestra los aciertos por clase; las celdas rojas indican errores de clasificación cruzada entre clases reales y predichas."
              size="xs"
            />
          </h2>
          <div className={`${glassPanelClass} p-6 overflow-x-auto`}>
            <table className="mx-auto border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-20"></th>
                  {confusionMatrix[0].map((_, ci) => (
                    <th key={ci} className="text-center text-xs font-mono text-slate-400 pb-2 w-20">
                      Pred: {ci}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confusionMatrix.map((row, ri) => (
                  <tr key={ri}>
                    <td className="text-xs font-mono text-slate-400 pr-2 text-right">Real: {ri}</td>
                    {row.map((val, ci) => (
                      <td
                        key={ci}
                        className={`text-center text-xl font-bold rounded-lg w-20 h-14 ${
                          ri === ci
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 text-center mt-4">
              Aislamiento garantizado del conjunto Test durante entrenamiento
            </p>
          </div>
        </div>
      )}
    </>
  )
}

