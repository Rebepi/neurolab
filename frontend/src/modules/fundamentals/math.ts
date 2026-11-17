export type ActivationTab = 'ReLU' | 'LeakyReLU' | 'Sigmoid' | 'Tanh' | 'Softmax'
export type NeuronActivation = 'relu' | 'sigmoid' | 'tanh'
export type FundamentalsSection = 'neuron' | 'activations' | 'families' | 'learning' | 'glossary'

export interface NeuronPreset {
  id: string
  label: string
  hint: string
  x1: number
  x2: number
  w1: number
  w2: number
  bias: number
  activation: NeuronActivation
}

export const NEURON_PRESETS: NeuronPreset[] = [
  {
    id: 'default',
    label: 'Por Defecto',
    hint: 'Combinación mixta con un peso excitatorio y otro inhibitorio.',
    x1: 0.8,
    x2: -0.5,
    w1: 1.2,
    w2: -1.5,
    bias: 0.2,
    activation: 'sigmoid',
  },
  {
    id: 'and-gate',
    label: 'Compuerta AND',
    hint: 'Solo dispara si ambas entradas x₁ y x₂ son altas a la vez.',
    x1: 1.0,
    x2: 1.0,
    w1: 2.0,
    w2: 2.0,
    bias: -1.8,
    activation: 'sigmoid',
  },
  {
    id: 'or-gate',
    label: 'Compuerta OR',
    hint: 'Dispara con facilidad cuando cualquiera de las entradas es positiva.',
    x1: 1.0,
    x2: 0.0,
    w1: 2.0,
    w2: 2.0,
    bias: -0.5,
    activation: 'sigmoid',
  },
  {
    id: 'inhibited',
    label: 'Inhibición (Dying ReLU)',
    hint: 'Suma z negativa bloqueada a 0.000 por la función ReLU.',
    x1: 0.6,
    x2: 0.9,
    w1: -1.5,
    w2: -1.2,
    bias: -0.4,
    activation: 'relu',
  },
  {
    id: 'tanh-center',
    label: 'Tanh Simétrica',
    hint: 'Salida acotada entre -1 y +1 centrada en el origen.',
    x1: 0.5,
    x2: -0.9,
    w1: 1.4,
    w2: 1.1,
    bias: 0.0,
    activation: 'tanh',
  },
]

export function relu(x: number): number {
  return Math.max(0, x)
}

export function leakyRelu(x: number): number {
  return x >= 0 ? x : 0.1 * x
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

export function tanhFn(x: number): number {
  return Math.tanh(x)
}

export function softmax(logits: number[], temperature = 1): number[] {
  const t = Math.max(0.1, temperature)
  const scaled = logits.map(v => v / t)
  const maxVal = Math.max(...scaled)
  const exps = scaled.map(v => Math.exp(v - maxVal))
  const sum = exps.reduce((acc, v) => acc + v, 0)
  return exps.map(v => v / sum)
}

export function evalActivationFn(tab: ActivationTab, val: number): number {
  if (tab === 'ReLU') return relu(val)
  if (tab === 'LeakyReLU') return leakyRelu(val)
  if (tab === 'Sigmoid') return sigmoid(val)
  if (tab === 'Tanh') return tanhFn(val)
  return 1
}

export function evalDerivativeFn(tab: ActivationTab, val: number): number {
  if (tab === 'ReLU') return val > 0 ? 1 : 0
  if (tab === 'LeakyReLU') return val > 0 ? 1 : 0.1
  if (tab === 'Sigmoid') {
    const s = sigmoid(val)
    return s * (1 - s)
  }
  if (tab === 'Tanh') {
    const t = tanhFn(val)
    return 1 - t * t
  }
  return 0
}

export function evalNeuronActivation(fn: NeuronActivation, z: number): number {
  if (fn === 'relu') return relu(z)
  if (fn === 'sigmoid') return sigmoid(z)
  return tanhFn(z)
}

export function evalNeuronDerivative(fn: NeuronActivation, z: number): number {
  if (fn === 'relu') return z > 0 ? 1 : 0
  if (fn === 'sigmoid') {
    const s = sigmoid(z)
    return s * (1 - s)
  }
  const t = tanhFn(z)
  return 1 - t * t
}
