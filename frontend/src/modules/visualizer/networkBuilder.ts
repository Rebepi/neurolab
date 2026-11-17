import { MAX_PARTICLES_PER_WAVE } from './constants'
import { computeForwardPassMath, defaultInputValue, deterministicGlorot } from './mathEngine'
import type {
  ActivationType,
  InspectDataState,
  NeuronNode,
  SignalParticle,
  SynapseConnection,
} from './types'

export function buildNetworkGraph(
  sizes: number[],
  actsToUse: ActivationType[],
  inputsToUse: number[],
  targetsToUse: number[],
  featsToUse: string[],
  customWeights?: number[][][],
  customBiases?: number[][]
): {
  nodes: NeuronNode[][]
  synapses: SynapseConnection[]
  metrics: { loss: number; acc: number } | null
} {
  const newNodes: NeuronNode[][] = []
  const newSynapses: SynapseConnection[] = []

  sizes.forEach((count, lIdx) => {
    const layerArr: NeuronNode[] = []
    for (let nIdx = 0; nIdx < count; nIdx++) {
      const isInput = lIdx === 0
      const isOutput = lIdx === sizes.length - 1
      const prefix = isInput ? 'IN' : isOutput ? 'OUT' : `H${lIdx}`
      const initAct = isInput ? Number((inputsToUse[nIdx] ?? defaultInputValue(nIdx)).toFixed(4)) : 0
      const initBias = isInput
        ? 0
        : customBiases?.[lIdx - 1]?.[nIdx] !== undefined
          ? Number(customBiases[lIdx - 1][nIdx].toFixed(4))
          : Number((((nIdx % 2 === 0 ? 1 : -1) * 0.12) / (lIdx + 1)).toFixed(4))

      layerArr.push({
        layerIdx: lIdx,
        neuronIdx: nIdx,
        x: 0,
        y: 0,
        activation: initAct,
        z: isInput ? initAct : 0,
        bias: initBias,
        gradient: 0,
        targetVal: isOutput ? (targetsToUse[nIdx] ?? (nIdx === 0 ? 1 : 0)) : undefined,
        label: `${prefix}·${nIdx + 1}`,
        featureName: isInput ? featsToUse[nIdx] : undefined,
      })
    }
    newNodes.push(layerArr)
  })

  for (let l = 0; l < sizes.length - 1; l++) {
    const fanIn = sizes[l]
    const fanOut = sizes[l + 1]
    for (let i = 0; i < fanIn; i++) {
      for (let j = 0; j < fanOut; j++) {
        const w = customWeights?.[l]?.[i]?.[j] !== undefined
          ? Number(customWeights[l][i][j].toFixed(4))
          : deterministicGlorot(l, i, j, fanIn, fanOut)
        newSynapses.push({
          fromLayer: l,
          fromNeuron: i,
          toLayer: l + 1,
          toNeuron: j,
          weight: w,
          lastDelta: 0,
          lastSignal: 0,
        })
      }
    }
  }

  const metrics = computeForwardPassMath(newNodes, newSynapses, actsToUse, targetsToUse)
  return { nodes: newNodes, synapses: newSynapses, metrics }
}

export function spawnLayerSignalWave(
  nodes: NeuronNode[][],
  synapses: SynapseConnection[],
  particles: SignalParticle[],
  fromLayer: number,
  direction: 'forward' | 'backward',
  speed: number
) {
  if (direction === 'forward') {
    const toLayer = fromLayer + 1
    if (!nodes[fromLayer] || !nodes[toLayer]) return

    const candidates = synapses
      .filter(s => s.fromLayer === fromLayer && s.toLayer === toLayer)
      .map(s => ({ s, mag: Math.abs((nodes[fromLayer][s.fromNeuron]?.activation ?? 0) * s.weight) }))
    const selected = candidates.length > MAX_PARTICLES_PER_WAVE
      ? candidates.sort((a, b) => b.mag - a.mag).slice(0, MAX_PARTICLES_PER_WAVE)
      : candidates

    selected.forEach(({ s }, idx) => {
      const src = nodes[fromLayer][s.fromNeuron]
      const dst = nodes[toLayer][s.toNeuron]
      if (!src || !dst) return

      const sigVal = Number((src.activation * s.weight).toFixed(3))
      s.lastSignal = sigVal
      const dx = dst.x - src.x
      particles.push({
        fromX: src.x,
        fromY: src.y,
        toX: dst.x,
        toY: dst.y,
        cp1X: src.x + dx * 0.42,
        cp1Y: src.y,
        cp2X: dst.x - dx * 0.42,
        cp2Y: dst.y,
        progress: -((idx % 7) * 0.032),
        speed: 0.011 * speed,
        direction: 'forward',
        color: s.weight >= 0 ? '#2dd4bf' : '#fb7185',
        size: Math.min(2.1, Math.max(1.2, Math.abs(sigVal) * 0.9 + 1.1)),
        targetLayer: toLayer,
        targetNeuron: s.toNeuron,
        signalValue: sigVal,
        trail: [],
      })
    })
  } else {
    const toLayer = fromLayer - 1
    if (!nodes[fromLayer] || !nodes[toLayer]) return

    const backCandidates = synapses
      .filter(s => s.toLayer === fromLayer && s.fromLayer === toLayer)
      .map(s => ({ s, mag: Math.abs((nodes[fromLayer][s.toNeuron]?.gradient ?? 0) * s.weight) }))
    const backSelected = backCandidates.length > MAX_PARTICLES_PER_WAVE
      ? backCandidates.sort((a, b) => b.mag - a.mag).slice(0, MAX_PARTICLES_PER_WAVE)
      : backCandidates

    backSelected.forEach(({ s }, idx) => {
      const src = nodes[fromLayer][s.toNeuron]
      const dst = nodes[toLayer][s.fromNeuron]
      if (!src || !dst) return

      const gradVal = Number((src.gradient * s.weight).toFixed(3))
      const dx = dst.x - src.x
      particles.push({
        fromX: src.x,
        fromY: src.y,
        toX: dst.x,
        toY: dst.y,
        cp1X: src.x + dx * 0.42,
        cp1Y: src.y,
        cp2X: dst.x - dx * 0.42,
        cp2Y: dst.y,
        progress: -((idx % 7) * 0.032),
        speed: 0.011 * speed,
        direction: 'backward',
        color: '#f59e0b',
        size: 1.6,
        targetLayer: toLayer,
        targetNeuron: s.fromNeuron,
        signalValue: gradVal,
        trail: [],
      })
    })
  }
}

export function buildInspectDataForNode(
  nodes: NeuronNode[][],
  synapses: SynapseConnection[],
  targetFocus: { layerIdx: number; neuronIdx: number },
  layerActivations: ActivationType[]
): InspectDataState | null {
  const targetNode = nodes[targetFocus.layerIdx]?.[targetFocus.neuronIdx] || null
  if (!targetNode) return null

  const allInc: InspectDataState['incoming'] = []
  const allOut: InspectDataState['outgoing'] = []

  for (let si = 0; si < synapses.length; si++) {
    const s = synapses[si]
    if (s.toLayer === targetFocus.layerIdx && s.toNeuron === targetFocus.neuronIdx) {
      const fn = nodes[s.fromLayer]?.[s.fromNeuron]
      const inVal = fn?.activation ?? 0
      allInc.push({
        fromNeuron: s.fromNeuron,
        fromLabel: fn?.label || `N${s.fromNeuron + 1}`,
        weight: s.weight,
        inputVal: inVal,
        contribution: Number((s.weight * inVal).toFixed(4)),
      })
    } else if (s.fromLayer === targetFocus.layerIdx && s.fromNeuron === targetFocus.neuronIdx) {
      const tn = nodes[s.toLayer]?.[s.toNeuron]
      allOut.push({
        toNeuron: s.toNeuron,
        toLabel: tn?.label || `N${s.toNeuron + 1}`,
        weight: s.weight,
      })
    }
  }

  const incDisplay = allInc.length > 24
    ? allInc.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 24).sort((a, b) => a.fromNeuron - b.fromNeuron)
    : allInc

  return {
    node: { ...targetNode },
    layerAct: layerActivations[targetFocus.layerIdx] || 'sigmoid',
    incomingCount: allInc.length,
    incoming: incDisplay,
    outgoing: allOut.slice(0, 24),
  }
}

