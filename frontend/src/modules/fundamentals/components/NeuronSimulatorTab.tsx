import { useState } from 'react'
import { RotateCcw, Sliders, Sparkles, Zap } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import {
  evalNeuronActivation,
  evalNeuronDerivative,
  NEURON_PRESETS,
  type NeuronActivation,
  type NeuronPreset,
} from '../math'
import { NeuronDiagramSvg } from './NeuronDiagramSvg'
import { SliderControl } from './SliderControl'
import { DecisionBoundaryCard } from './DecisionBoundaryCard'

export function NeuronSimulatorTab() {
  const [x1, setX1] = useState(0.8)
  const [x2, setX2] = useState(-0.5)
  const [w1, setW1] = useState(1.2)
  const [w2, setW2] = useState(-1.5)
  const [bias, setBias] = useState(0.2)
  const [neuronActivation, setNeuronActivation] = useState<NeuronActivation>('sigmoid')
  const [activePresetId, setActivePresetId] = useState<string>('default')

  const weightedSum = Number((x1 * w1 + x2 * w2).toFixed(3))
  const z = Number((weightedSum + bias).toFixed(3))
  const activationOutput = Number(evalNeuronActivation(neuronActivation, z).toFixed(3))
  const localGrad = Number(evalNeuronDerivative(neuronActivation, z).toFixed(3))
  const isFired = neuronActivation === 'tanh' ? activationOutput > 0 : activationOutput > 0.5

  const meterPercent =
    neuronActivation === 'tanh'
      ? Math.min(100, Math.max(0, ((activationOutput + 1) / 2) * 100))
      : neuronActivation === 'sigmoid'
      ? Math.min(100, Math.max(0, activationOutput * 100))
      : Math.min(100, Math.max(0, (activationOutput / 4) * 100))

  const applyPreset = (preset: NeuronPreset) => {
    setActivePresetId(preset.id)
    setX1(preset.x1)
    setX2(preset.x2)
    setW1(preset.w1)
    setW2(preset.w2)
    setBias(preset.bias)
    setNeuronActivation(preset.activation)
  }

  return (
    <div className="space-y-5">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Escenarios rápidos:</span>
            <InfoTip text="Carga casos clásicos de redes neuronales para observar compuertas lógicas, saturación y neuronas muertas." size="xs" />
          </span>
          {NEURON_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all inline-flex items-center gap-1.5 ${
                activePresetId === preset.id
                  ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span>{preset.label}</span>
              <InfoTip text={preset.hint} size="xs" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-950/80 border border-slate-800 text-slate-300 inline-flex items-center gap-1">
            <span>Gradiente f&apos;(z):</span>
            <strong className={localGrad < 0.05 ? 'text-amber-400' : 'text-cyan-400'}>{localGrad}</strong>
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-300 inline-flex items-center gap-1.5 ${
              isFired
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isFired ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> : null}
            {isFired ? 'Neurona Activa (Dispara)' : 'Neurona en Reposo'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 nl-cyber-panel nl-card-interactive animate-card-reveal nl-stagger-1 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span>Simulador de Neurona Artificial</span>
                <InfoTip
                  title="Perceptrón + Activación No Lineal"
                  text="Observa en tiempo real el flujo desde entradas y pesos sinápticos hasta la activación final y su derivada."
                  size="xs"
                />
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Flujo sináptico ponderado con impulsos animados según signo e intensidad de los pesos
              </p>
            </div>
          </div>

          <NeuronDiagramSvg
            x1={x1}
            x2={x2}
            w1={w1}
            w2={w2}
            bias={bias}
            z={z}
            activationOutput={activationOutput}
            neuronActivation={neuronActivation}
            isFired={isFired}
          />

          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                <span>Desglose Matemático Paso a Paso</span>
                <InfoTip
                  title="Cómputo Forward Pass"
                  text="1) Producto escalar entradas×pesos, 2) Suma del sesgo b, 3) Función de activación no lineal."
                  size="xs"
                />
              </p>
              <span className="text-[11px] font-mono text-slate-400">
                Nivel de activación: <strong className="text-white">{meterPercent.toFixed(0)}%</strong>
              </span>
            </div>

            <div className="h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFired ? 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400' : 'bg-slate-600'
                }`}
                style={{ width: `${meterPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-1">
                <p className="text-[10px] uppercase text-slate-500 font-sans font-semibold">1. Suma Ponderada</p>
                <p className="text-slate-300 text-[11px]">
                  ({x1.toFixed(1)}×{w1.toFixed(1)}) + ({x2.toFixed(1)}×{w2.toFixed(1)})
                </p>
                <p className="text-cyan-400 font-bold text-sm">= {weightedSum.toFixed(3)}</p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-1">
                <p className="text-[10px] uppercase text-slate-500 font-sans font-semibold">2. Pre-activación (+ Bias)</p>
                <p className="text-slate-300 text-[11px]">
                  {weightedSum.toFixed(2)} + ({bias.toFixed(2)})
                </p>
                <p className="text-amber-400 font-bold text-sm">z = {z.toFixed(3)}</p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-1">
                <p className="text-[10px] uppercase text-slate-500 font-sans font-semibold">3. Activación f(z)</p>
                <p className="text-slate-300 text-[11px]">
                  {neuronActivation.toUpperCase()}({z.toFixed(2)})
                </p>
                <p className="text-emerald-400 font-bold text-sm">a = {activationOutput.toFixed(3)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 nl-cyber-panel nl-card-interactive animate-card-reveal nl-stagger-2 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-bold text-base flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Controles de Parámetros</span>
              <InfoTip
                title="Ajuste Interactivo"
                text="Usa los deslizadores o botones +/- para afinar cada variable y observar su efecto geométrico."
                size="xs"
              />
            </h4>

            <button
              type="button"
              onClick={() => applyPreset(NEURON_PRESETS[0])}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer
            </button>
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold mb-2 flex items-center gap-1.5">
              <span>Función de Activación:</span>
              <InfoTip
                text="ReLU anula negativos; Sigmoid comprime a (0, 1); Tanh acota simétricamente a (-1, 1)."
                size="xs"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['relu', 'sigmoid', 'tanh'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setNeuronActivation(f)}
                  className={`py-2 rounded-xl text-xs font-semibold uppercase transition-all ${
                    neuronActivation === f
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                      : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SliderControl
                label="Entrada x₁"
                value={x1}
                min={-2}
                max={2}
                accentColor="#38bdf8"
                badgeClass="bg-sky-500/15 text-sky-300 border-sky-500/30"
                info="Valor normalizado de la primera característica."
                onChange={v => { setActivePresetId('custom'); setX1(v) }}
              />
              <SliderControl
                label="Entrada x₂"
                value={x2}
                min={-2}
                max={2}
                accentColor="#38bdf8"
                badgeClass="bg-sky-500/15 text-sky-300 border-sky-500/30"
                info="Valor normalizado de la segunda característica."
                onChange={v => { setActivePresetId('custom'); setX2(v) }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SliderControl
                label="Peso w₁"
                value={w1}
                min={-3}
                max={3}
                accentColor="#10b981"
                badgeClass="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                info="Peso sináptico aplicado a x₁ (positivo excita, negativo inhibe)."
                onChange={v => { setActivePresetId('custom'); setW1(v) }}
              />
              <SliderControl
                label="Peso w₂"
                value={w2}
                min={-3}
                max={3}
                accentColor="#10b981"
                badgeClass="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                info="Peso sináptico aplicado a x₂."
                onChange={v => { setActivePresetId('custom'); setW2(v) }}
              />
            </div>

            <SliderControl
              label="Sesgo (Bias b)"
              value={bias}
              min={-2}
              max={2}
              accentColor="#f59e0b"
              badgeClass="bg-amber-500/15 text-amber-300 border-amber-500/30"
              info="Desplaza el umbral de disparo incluso cuando x₁ y x₂ valen 0."
              onChange={v => { setActivePresetId('custom'); setBias(v) }}
            />
          </div>

          <DecisionBoundaryCard
            x1={x1}
            x2={x2}
            w1={w1}
            w2={w2}
            bias={bias}
            activation={neuronActivation}
          />
        </div>
      </div>
    </div>
  )
}
