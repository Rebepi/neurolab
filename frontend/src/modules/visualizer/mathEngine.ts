import type {
  ActivationType,
  LayerLayoutInfo,
  NeuronNode,
  SynapseConnection,
} from './types'

export function evalActivation(z: number, act: ActivationType): number {
  if (act === 'linear') return z
  if (act === 'relu') return Math.max(0, z)
  if (act === 'leaky_relu') return z >= 0 ? z : 0.1 * z
  if (act === 'tanh') return Math.tanh(z)
  return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, z))))
}

export function evalActivationDerivative(z: number, a: number, act: ActivationType): number {
  if (act === 'linear') return 1
  if (act === 'relu') return z > 0 ? 1 : 0
  if (act === 'leaky_relu') return z >= 0 ? 1 : 0.1
  if (act === 'tanh') return 1 - a * a
  return a * (1 - a)
}

export function normalizeDisplayActivation(a: number, act: ActivationType): number {
  if (act === 'sigmoid' || act === 'softmax') return Math.max(0, Math.min(1, a))
  if (act === 'tanh') return Math.max(0, Math.min(1, (a + 1) / 2))
  return Math.max(0, Math.min(1, 1 / (1 + Math.exp(-a))))
}

export function bezierPoint(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

export function computeSingleColumnLayerLayout(
  count: number,
  lIdx: number,
  numLayers: number,
  worldW: number,
  usableH: number,
  worldCenterX: number,
  worldCenterY: number
): LayerLayoutInfo {
  const centerX = numLayers > 1
    ? worldCenterX - worldW / 2 + (lIdx / (numLayers - 1)) * worldW
    : worldCenterX
  const height = count <= 22 ? usableH : Math.max(usableH, count * 14)
  const slotY = height / Math.max(1, count)
  const nodeR = count <= 22
    ? Math.min(18, Math.max(5.5, slotY * 0.34))
    : Math.min(6.5, Math.max(4.4, slotY * 0.34))
  return {
    centerX,
    topY: worldCenterY - height / 2,
    height,
    slotY,
    nodeR,
    colHalfW: Math.max(22, Math.min(34, nodeR + 12)),
  }
}

export function defaultInputValue(i: number): number {
  return Number((Math.sin((i + 1) * 1.7) * 0.85).toFixed(2))
}

export function deterministicGlorot(
  l: number,
  i: number,
  j: number,
  fanIn: number,
  fanOut: number
): number {
  const limit = Math.sqrt(6 / (fanIn + fanOut))
  const seed = (l + 1) * 131 + (i + 1) * 37 + (j + 1) * 17
  const pseudo = Math.sin(seed * 12.9898) * 43758.5453
  const frac = pseudo - Math.floor(pseudo)
  const val = (frac * 2 - 1) * limit
  return Number((Math.abs(val) < 0.08 ? (val >= 0 ? 0.18 : -0.18) : val).toFixed(4))
}

export function computeOutputMetrics(
  outLayer: NeuronNode[],
  targets: number[]
): { loss: number; acc: number } {
  let totalLoss = 0

  outLayer.forEach((node, k) => {
    const y = targets[k] ?? (k === 0 ? 1 : 0)
    node.targetVal = y
    const yHat = Math.max(1e-6, Math.min(1 - 1e-6, node.activation))
    if (y === 0 || y === 1) {
      totalLoss += -(y * Math.log(yHat) + (1 - y) * Math.log(1 - yHat))
    } else {
      totalLoss += 0.5 * Math.pow(node.activation - y, 2)
    }
  })

  const loss = Number((totalLoss / Math.max(1, outLayer.length)).toFixed(4))
  const confidenceAcc = outLayer.reduce((acc, node, k) => {
    const y = targets[k] ?? (k === 0 ? 1 : 0)
    const err = Math.min(1, Math.abs(node.activation - y))
    return acc + (1 - err)
  }, 0) / Math.max(1, outLayer.length)

  return {
    loss,
    acc: Number((confidenceAcc * 100).toFixed(1)),
  }
}

export function computeSingleLayerForward(
  nodes: NeuronNode[][],
  synapses: SynapseConnection[],
  targetLayerIdx: number,
  acts: ActivationType[],
  targets: number[]
): { loss: number; acc: number } | null {
  if (!nodes[targetLayerIdx] || targetLayerIdx === 0) return null

  const actType = acts[targetLayerIdx] || 'sigmoid'
  const rawZs: number[] = nodes[targetLayerIdx].map(n => n.bias)

  for (let si = 0; si < synapses.length; si++) {
    const s = synapses[si]
    if (s.toLayer !== targetLayerIdx) continue
    const fromNode = nodes[s.fromLayer]?.[s.fromNeuron]
    if (!fromNode || rawZs[s.toNeuron] === undefined) continue
    const sig = fromNode.activation * s.weight
    s.lastSignal = sig
    rawZs[s.toNeuron] += sig
  }

  nodes[targetLayerIdx].forEach((node, j) => {
    node.z = Number(rawZs[j].toFixed(4))
  })

  if (actType === 'softmax') {
    const maxZ = Math.max(...rawZs)
    const exps = rawZs.map(z => Math.exp(z - maxZ))
    const sumExp = exps.reduce((a, b) => a + b, 0) || 1
    nodes[targetLayerIdx].forEach((node, j) => {
      node.activation = Number((exps[j] / sumExp).toFixed(4))
    })
  } else {
    nodes[targetLayerIdx].forEach((node) => {
      node.activation = Number(evalActivation(node.z, actType).toFixed(4))
    })
  }

  if (targetLayerIdx === nodes.length - 1) {
    return computeOutputMetrics(nodes[targetLayerIdx], targets)
  }
  return null
}

export function computeForwardPassMath(
  nodes: NeuronNode[][],
  synapses: SynapseConnection[],
  acts: ActivationType[],
  targets: number[]
): { loss: number; acc: number } | null {
  if (nodes.length < 2) return null
  for (let l = 1; l < nodes.length; l++) {
    computeSingleLayerForward(nodes, synapses, l, acts, targets)
  }
  return computeOutputMetrics(nodes[nodes.length - 1], targets)
}

export function computeLayerBackprop(
  nodes: NeuronNode[][],
  synapses: SynapseConnection[],
  fromLayerIdx: number,
  acts: ActivationType[],
  targets: number[],
  learningRate: number
) {
  const L = nodes.length - 1
  if (fromLayerIdx <= 0 || !nodes[fromLayerIdx]) return

  if (fromLayerIdx === L) {
    nodes[L].forEach((node, k) => {
      const y = targets[k] ?? (k === 0 ? 1 : 0)
      node.targetVal = y
      node.gradient = Number((node.activation - y).toFixed(4))
    })
  }

  const prevLayerIdx = fromLayerIdx - 1
  const prevAct = acts[prevLayerIdx] || 'relu'

  if (prevLayerIdx > 0) {
    const downstream: number[] = nodes[prevLayerIdx].map(() => 0)
    for (let si = 0; si < synapses.length; si++) {
      const s = synapses[si]
      if (s.fromLayer !== prevLayerIdx || s.toLayer !== fromLayerIdx) continue
      const nextNode = nodes[fromLayerIdx]?.[s.toNeuron]
      if (nextNode && downstream[s.fromNeuron] !== undefined) {
        downstream[s.fromNeuron] += s.weight * nextNode.gradient
      }
    }
    nodes[prevLayerIdx].forEach((prevNode, i) => {
      const dAct = evalActivationDerivative(prevNode.z, prevNode.activation, prevAct)
      prevNode.gradient = Number((downstream[i] * dAct).toFixed(4))
    })
  }

  synapses
    .filter(s => s.toLayer === fromLayerIdx && s.fromLayer === prevLayerIdx)
    .forEach(s => {
      const srcNode = nodes[prevLayerIdx]?.[s.fromNeuron]
      const dstNode = nodes[fromLayerIdx]?.[s.toNeuron]
      if (!srcNode || !dstNode) return
      const dW = srcNode.activation * dstNode.gradient
      const stepDelta = -learningRate * dW
      s.lastDelta = Number(stepDelta.toFixed(4))
      s.weight = Number(Math.max(-3.5, Math.min(3.5, s.weight + stepDelta)).toFixed(4))
    })

  nodes[fromLayerIdx].forEach(node => {
    const stepBias = -learningRate * node.gradient
    node.bias = Number(Math.max(-3.0, Math.min(3.0, node.bias + stepBias)).toFixed(4))
  })
}

