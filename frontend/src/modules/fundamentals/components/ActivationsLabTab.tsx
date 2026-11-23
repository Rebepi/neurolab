import { useState } from 'react'
import { Layers, Sigma } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import { ACTIVATION_SPECS } from '../constants'
import {
  evalActivationFn,
  evalDerivativeFn,
  softmax,
  type ActivationTab,
} from '../math'
import { SliderControl } from './SliderControl'

const ACTIVATION_TABS: ActivationTab[] = ['ReLU', 'LeakyReLU', 'Sigmoid', 'Tanh', 'Softmax']
const CURVE_TABS: ActivationTab[] = ['ReLU', 'LeakyReLU', 'Sigmoid', 'Tanh']

function buildCurvePath(tab: ActivationTab, derivative = false): string {
  return Array.from({ length: 81 }, (_, i) => {
    const x = -5 + (i * 10) / 80
    const y = derivative ? evalDerivativeFn(tab, x) : evalActivationFn(tab, x)
    const clampedY = Math.max(-2.3, Math.min(2.3, y))
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${(-clampedY).toFixed(2)}`
  }).join(' ')
}

export function ActivationsLabTab() {
  const [selectedActivation, setSelectedActivation] = useState<ActivationTab>('ReLU')
  const [activationX, setActivationX] = useState(1.5)
  const [showDerivative, setShowDerivative] = useState(true)
  const [compareAll, setCompareAll] = useState(false)

  const [logits, setLogits] = useState<[number, number, number]>([2.1, 0.8, -0.4])
  const [temperature, setTemperature] = useState(1.0)

  const spec = ACTIVATION_SPECS[selectedActivation]
  const fx = evalActivationFn(selectedActivation, activationX)
  const dfx = evalDerivativeFn(selectedActivation, activationX)
  const probs = softmax(logits, temperature)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ACTIVATION_TABS.map(tab => {
            const isActive = selectedActivation === tab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedActivation(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-slate-900/60 border border-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {selectedActivation !== 'Softmax' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDerivative(v => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                showDerivative
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900/60 border-slate-700 text-slate-400'
              }`}
            >
              <Sigma className="w-3.5 h-3.5" />
              Mostrar Derivada f&apos;(x)
            </button>
            <button
              type="button"
              onClick={() => setCompareAll(v => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                compareAll
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-900/60 border-slate-700 text-slate-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Comparar Todas
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 nl-cyber-panel nl-card-interactive animate-card-reveal nl-stagger-1 rounded-2xl p-6 space-y-5">
          {selectedActivation === 'Softmax' ? (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-white font-bold text-base flex items-center gap-2">
                    <span>Simulador Multiclase Softmax</span>
                    <InfoTip
                      title="Distribución de Probabilidades"
                      text="Convierte logits crudos de N clases en probabilidades positivas cuya suma exacta siempre es 100%."
                      size="xs"
                    />
                  </h4>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Ajusta los logits y la temperatura τ para observar cómo se reparte la confianza del modelo
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-semibold">
                  Σ P = {(probs.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="space-y-3 bg-slate-950/75 rounded-xl p-4 border border-slate-800">
                {['Clase A (ej. Baja Riesgo)', 'Clase B (ej. Neutral)', 'Clase C (ej. Retención)'].map((clsName, idx) => {
                  const pct = probs[idx] * 100
                  return (
                    <div key={clsName} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-200 font-medium">{clsName}</span>
                        <span className="font-mono text-slate-300">
                          z{idx + 1} = {logits[idx].toFixed(2)} → <strong className="text-purple-300">{pct.toFixed(1)}%</strong>
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1, 2].map(idx => (
                  <SliderControl
                    key={idx}
                    label={`Logit Clase ${String.fromCharCode(65 + idx)}`}
                    value={logits[idx]}
                    min={-4}
                    max={4}
                    accentColor="#a855f7"
                    badgeClass="bg-purple-500/15 text-purple-300 border-purple-500/30"
                    onChange={val => {
                      const next: [number, number, number] = [...logits] as [number, number, number]
                      next[idx] = val
                      setLogits(next)
                    }}
                  />
                ))}
                <SliderControl
                  label="Temperatura τ"
                  value={temperature}
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  accentColor="#38bdf8"
                  badgeClass="bg-sky-500/15 text-sky-300 border-sky-500/30"
                  info="τ < 1 vuelve la predicción más segura; τ > 1 suaviza la distribución entre clases."
                  onChange={setTemperature}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-white font-bold text-base">Curva Característica: {selectedActivation}</h4>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                    x = <strong className="text-indigo-400">{activationX.toFixed(2)}</strong>
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                    f(x) = <strong className="text-emerald-400">{fx.toFixed(3)}</strong>
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                    f&apos;(x) = <strong className="text-amber-400">{dfx.toFixed(3)}</strong>
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800 flex items-center justify-center">
                <svg viewBox="-5.5 -2.4 11 4.8" className="w-full h-72">
                  {[-4, -3, -2, -1, 1, 2, 3, 4].map(gx => (
                    <line key={`vx-${gx}`} x1={gx} y1="-2.2" x2={gx} y2="2.2" stroke="#1e293b" strokeWidth="0.03" />
                  ))}
                  {[-2, -1, 1, 2].map(gy => (
                    <line key={`hz-${gy}`} x1="-5" y1={-gy} x2="5" y2={-gy} stroke="#1e293b" strokeWidth="0.03" />
                  ))}

                  <line x1="-5.2" y1="0" x2="5.2" y2="0" stroke="#475569" strokeWidth="0.06" />
                  <line x1="0" y1="-2.3" x2="0" y2="2.3" stroke="#475569" strokeWidth="0.06" />

                  {[-4, -2, 2, 4].map(xVal => (
                    <text key={xVal} x={xVal} y="0.28" textAnchor="middle" fill="#64748b" fontSize="0.24" fontFamily="monospace">
                      {xVal}
                    </text>
                  ))}
                  {[-1, 1, 2].map(yVal => (
                    <text key={yVal} x="-0.22" y={-yVal + 0.08} textAnchor="end" fill="#64748b" fontSize="0.24" fontFamily="monospace">
                      {yVal}
                    </text>
                  ))}

                  {compareAll &&
                    CURVE_TABS.filter(t => t !== selectedActivation).map(other => (
                      <path
                        key={other}
                        d={buildCurvePath(other, false)}
                        fill="none"
                        stroke={ACTIVATION_SPECS[other].color}
                        strokeWidth="0.06"
                        strokeOpacity="0.4"
                      />
                    ))}

                  {showDerivative && (
                    <path
                      d={buildCurvePath(selectedActivation, true)}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="0.08"
                      strokeDasharray="0.16 0.12"
                    />
                  )}

                  <path
                    d={buildCurvePath(selectedActivation, false)}
                    fill="none"
                    stroke={spec.color}
                    strokeWidth="0.13"
                    strokeLinecap="round"
                  />

                  <line
                    x1={activationX}
                    y1="-2.2"
                    x2={activationX}
                    y2="2.2"
                    stroke="#38bdf8"
                    strokeWidth="0.04"
                    strokeDasharray="0.12 0.12"
                  />

                  <circle
                    cx={activationX}
                    cy={-Math.max(-2.2, Math.min(2.2, fx))}
                    r="0.19"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="0.06"
                  />

                  {showDerivative && (
                    <circle
                      cx={activationX}
                      cy={-Math.max(-2.2, Math.min(2.2, dfx))}
                      r="0.13"
                      fill="#f59e0b"
                      stroke="#0f172a"
                      strokeWidth="0.04"
                    />
                  )}
                </svg>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: spec.color }} />
                  Función {selectedActivation} f(x)
                </span>
                {showDerivative && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-400" />
                    Gradiente f&apos;(x)
                  </span>
                )}
                {compareAll && (
                  <span className="inline-flex items-center gap-1.5 text-cyan-300">
                    Comparativa superpuesta activa
                  </span>
                )}
              </div>

              <SliderControl
                label="Valor de prueba x"
                value={activationX}
                min={-5}
                max={5}
                step={0.1}
                accentColor={spec.color}
                badgeClass="bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                info="Desplaza x a lo largo del eje horizontal para inspeccionar salida y saturación del gradiente."
                onChange={setActivationX}
              />
            </>
          )}
        </div>

        <div className="lg:col-span-5 nl-cyber-panel nl-card-interactive animate-card-reveal nl-stagger-2 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-bold text-base">Ficha Técnica de {selectedActivation}</h4>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-300">
              Rango: {spec.range}
            </span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-1.5">
            <p className="text-indigo-300 font-semibold">{spec.formula}</p>
            <p className="text-amber-300/90">{spec.derivativeFormula}</p>
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
              <p className="text-emerald-300 font-semibold mb-1">Ventaja Principal</p>
              <p className="text-slate-300">{spec.advantage}</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <p className="text-amber-300 font-semibold mb-1">Limitación / Precaución</p>
              <p className="text-slate-300">{spec.limitation}</p>
            </div>
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
              <p className="text-indigo-300 font-semibold mb-1">Dónde se usa en NeuroLab</p>
              <p className="text-slate-300">{spec.usage}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
