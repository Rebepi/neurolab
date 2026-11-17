import type { ActivationType } from './types'

export const MAX_NEURONS_PER_LAYER = 256
export const MAX_SYNAPSES_DRAWN_PER_PAIR = 2400
export const MAX_PARTICLES_PER_WAVE = 220

export const DEFAULT_INPUT_VALUES: number[] = [
  0.85, -0.42, 0.92, 0.25, 0.65, -0.30, 0.75, 0.40,
  -0.55, 0.60, 0.15, 0.80, -0.20, 0.50, 0.33, -0.65,
  0.45, -0.15, 0.70, -0.35,
]

export const DEFAULT_TARGET_VALUES: number[] = [
  1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]

export const SPEED_PRESETS = [
  { val: 0.14, label: 'Muy Lenta' },
  { val: 0.26, label: 'Lenta (Ideal)' },
  { val: 0.55, label: 'Media' },
  { val: 1.10, label: 'Rápida' },
] as const

export const TOPOLOGY_PRESETS: Array<{
  label: string
  sizes: number[]
  acts: ActivationType[]
}> = [
  { label: 'Mínima (1-4-1)', sizes: [1, 4, 1], acts: ['linear', 'relu', 'sigmoid'] },
  { label: 'Profunda (1-8-12-8-1)', sizes: [1, 8, 12, 8, 1], acts: ['linear', 'relu', 'relu', 'tanh', 'sigmoid'] },
  { label: 'Ancha (1-64-64-1)', sizes: [1, 64, 64, 1], acts: ['linear', 'relu', 'relu', 'sigmoid'] },
  { label: 'Masiva (1-128-128-128-1)', sizes: [1, 128, 128, 128, 1], acts: ['linear', 'relu', 'relu', 'relu', 'sigmoid'] },
]

