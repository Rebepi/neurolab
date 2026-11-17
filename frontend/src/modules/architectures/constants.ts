import type { LayerSpec } from '../../types/index'

export interface ArchitecturePreset {
  name: string
  desc: string
  layers: LayerSpec[]
}

export const ARCHITECTURE_PRESETS: ArchitecturePreset[] = [
  {
    name: 'MLP Clásico (32 → 16)',
    desc: 'Arquitectura estándar y equilibrada para clasificación y regresión en datos tabulares.',
    layers: [
      { id: 'preset-classic-1', type: 'Dense', units: 32, activation: 'relu', use_bias: true },
      { id: 'preset-classic-2', type: 'Dense', units: 16, activation: 'relu', use_bias: true },
    ],
  },
  {
    name: 'Deep Classifier con Dropout (64 → 32 → 16)',
    desc: 'Red profunda con capas de Dropout interactivas para prevenir sobreajuste (overfitting).',
    layers: [
      { id: 'preset-deep-1', type: 'Dense', units: 64, activation: 'relu', use_bias: true },
      { id: 'preset-deep-2', type: 'Dropout', rate: 0.2 },
      { id: 'preset-deep-3', type: 'Dense', units: 32, activation: 'relu', use_bias: true },
      { id: 'preset-deep-4', type: 'Dropout', rate: 0.1 },
      { id: 'preset-deep-5', type: 'Dense', units: 16, activation: 'relu', use_bias: true },
    ],
  },
  {
    name: 'Red Ancha / Wide Network (128 → 64)',
    desc: 'Alta capacidad de representación para datasets con gran cantidad de características codificadas.',
    layers: [
      { id: 'preset-wide-1', type: 'Dense', units: 128, activation: 'relu', use_bias: true },
      { id: 'preset-wide-2', type: 'BatchNormalization' },
      { id: 'preset-wide-3', type: 'Dense', units: 64, activation: 'relu', use_bias: true },
    ],
  },
]

