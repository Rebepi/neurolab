export type SimMode = 'forward_only' | 'auto_train'
export type ActivationType = 'sigmoid' | 'relu' | 'tanh' | 'leaky_relu' | 'linear' | 'softmax'
export type InspectorTab = 'neuron' | 'topology' | 'data'

export interface NeuronNode {
  layerIdx: number
  neuronIdx: number
  x: number
  y: number
  activation: number
  z: number
  bias: number
  gradient: number
  targetVal?: number
  label: string
  featureName?: string
}

export interface SynapseConnection {
  fromLayer: number
  fromNeuron: number
  toLayer: number
  toNeuron: number
  weight: number
  lastDelta: number
  lastSignal: number
}

export interface SignalParticle {
  fromX: number
  fromY: number
  toX: number
  toY: number
  cp1X: number
  cp1Y: number
  cp2X: number
  cp2Y: number
  progress: number
  speed: number
  direction: 'forward' | 'backward'
  color: string
  size: number
  targetLayer: number
  targetNeuron: number
  signalValue: number
  trail: Array<{ x: number; y: number }>
}

export interface ShockwaveRipple {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  color: string
}

export interface DatasetSample {
  index: number
  inputs: number[]
  targets: number[]
}

export interface LayerLayoutInfo {
  centerX: number
  topY: number
  height: number
  slotY: number
  nodeR: number
  colHalfW: number
}

export interface InspectDataState {
  node: NeuronNode | null
  layerAct: ActivationType
  incomingCount: number
  incoming: Array<{
    fromNeuron: number
    fromLabel: string
    weight: number
    inputVal: number
    contribution: number
  }>
  outgoing: Array<{
    toNeuron: number
    toLabel: string
    weight: number
  }>
}

export interface CameraState {
  zoom: number
  panX: number
  panY: number
}

export interface WaveState {
  currentLayer: number
  direction: 'forward' | 'backward'
  waitingForArrival: boolean
  holdFrames: number
}

