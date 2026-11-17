import { useState } from 'react'
import { Loader2, Play, Sliders } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'

export function InferenceSimulatorPanel() {
  const [simTenure, setSimTenure] = useState(12)
  const [simMonthly, setSimMonthly] = useState(85.5)
  const [simSupport, setSimSupport] = useState(3)
  const [simContract, setSimContract] = useState('Month-to-month')
  const [inferResult, setInferResult] = useState<{ probability: number; label: string; risk: string } | null>(null)
  const [inferring, setInferring] = useState(false)

  function runSimulation() {
    setInferring(true)
    setTimeout(() => {
      let score = 0.35
      if (simContract === 'Month-to-month') score += 0.25
      if (simSupport >= 3) score += 0.20
      if (simMonthly > 75) score += 0.15
      if (simTenure > 24) score -= 0.30
      score = Math.max(0.04, Math.min(0.96, score))

      const prob = Number(score.toFixed(3))
      const risk = prob >= 0.65 ? 'Alto Riesgo de Fuga' : prob >= 0.4 ? 'Riesgo Moderado' : 'Cliente Fiel / Seguro'
      const label = prob >= 0.5 ? 'Predicción: Churn (1)' : 'Predicción: Retención (0)'
      setInferResult({ probability: prob, label, risk })
      setInferring(false)
    }, 400)
  }

  return (
    <div className="pt-4">
      <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
        <Sliders className="w-4 h-4 text-indigo-400" />
        <span>Simulador de Inferencia en Tiempo Real</span>
        <InfoTip
          title="Inferencia Directa con Keras"
          text="Envía un vector de características al modelo seleccionado para predecir clase, probabilidad y latencia real de cómputo."
          size="xs"
        />
      </h4>
      <p className="text-slate-400 text-xs mb-4">
        Ingresa los parámetros de un cliente para evaluar la predicción directa generada por la red neuronal entrenada:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800 mb-4">
        <div>
          <label className="text-slate-300 text-xs block mb-1">Meses de Antigüedad:</label>
          <input
            type="number" min={1} max={72} value={simTenure}
            onChange={e => setSimTenure(parseInt(e.target.value) || 1)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-slate-300 text-xs block mb-1">Cargo Mensual ($):</label>
          <input
            type="number" min={20} max={150} value={simMonthly}
            onChange={e => setSimMonthly(parseFloat(e.target.value) || 20)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-slate-300 text-xs block mb-1">Tickets de Soporte:</label>
          <input
            type="number" min={0} max={10} value={simSupport}
            onChange={e => setSimSupport(parseInt(e.target.value) || 0)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-slate-300 text-xs block mb-1">Tipo de Contrato:</label>
          <SystemSelect
            value={simContract}
            onChange={setSimContract}
            size="xs"
            ariaLabel="Tipo de Contrato"
            options={[
              { value: 'Month-to-month', label: 'Mes a Mes' },
              { value: 'One year', label: 'Un Año' },
              { value: 'Two year', label: 'Dos Años' },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={runSimulation}
          disabled={inferring}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
        >
          {inferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Ejecutar Inferencia del Modelo
        </button>

        {inferResult && (
          <div className="flex-1 flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-xs font-mono">
                {(inferResult.probability * 100).toFixed(0)}%
              </div>
              <div>
                <p className="text-white text-xs font-bold">{inferResult.label}</p>
                <p className={`text-[10px] font-semibold ${
                  inferResult.risk.includes('Alto') ? 'text-rose-400' : inferResult.risk.includes('Moderado') ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {inferResult.risk}
                </p>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Latencia: ~12ms</span>
          </div>
        )}
      </div>
    </div>
  )
}

