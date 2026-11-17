import { MAX_SYNAPSES_DRAWN_PER_PAIR } from './constants'
import {
  bezierPoint,
  computeSingleColumnLayerLayout,
  normalizeDisplayActivation,
} from './mathEngine'
import type {
  ActivationType,
  CameraState,
  LayerLayoutInfo,
  NeuronNode,
  ShockwaveRipple,
  SignalParticle,
  SimMode,
  SynapseConnection,
  WaveState,
} from './types'

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  isLightMode: boolean
  isPlaying: boolean
  simMode: SimMode
  speed: number
  showNumbers: boolean
  showWeights: boolean
  activeSpotlightLayer: number
  selectedNeuron: { layerIdx: number; neuronIdx: number } | null
  hoveredNeuron: { layerIdx: number; neuronIdx: number } | null
  layerActivations: ActivationType[]
  targetValues: number[]
  nodes: NeuronNode[][]
  synapses: SynapseConnection[]
  particlesRef: { current: SignalParticle[] }
  ripplesRef: { current: ShockwaveRipple[] }
  cam: CameraState
  camTarget: CameraState
  worldBoundsRef: { current: { w: number; h: number } }
  waveState: WaveState
  onWaveArrivalForward: (arrivedLayer: number) => void
  onWaveArrivalBackward: (currentLayer: number, arrivedLayer: number) => void
  onPhaseChange: (phase: 'FORWARD PASS' | 'BACKPROPAGATION') => void
  onSpotlightChange: (layerIdx: number) => void
  onSpawnWave: (fromLayer: number, direction: 'forward' | 'backward') => void
  onIncrementEpoch: () => void
}

function stepWaveSimulation(p: RenderFrameParams, numLayers: number) {
  if (!p.isPlaying || numLayers <= 1) return
  const ws = p.waveState

  if (ws.waitingForArrival) {
    if (p.particlesRef.current.length === 0) {
      ws.waitingForArrival = false
      ws.holdFrames = Math.max(16, Math.round(24 / Math.max(0.15, p.speed)))

      if (ws.direction === 'forward') {
        const arrivedLayer = ws.currentLayer + 1
        p.onWaveArrivalForward(arrivedLayer)
        p.onSpotlightChange(arrivedLayer)

        if (arrivedLayer >= numLayers - 1) {
          if (p.simMode === 'auto_train') {
            ws.direction = 'backward'
            ws.currentLayer = numLayers - 1
          } else {
            ws.direction = 'forward'
            ws.currentLayer = 0
          }
        } else {
          ws.currentLayer = arrivedLayer
        }
      } else {
        const arrivedLayer = ws.currentLayer - 1
        p.onWaveArrivalBackward(ws.currentLayer, arrivedLayer)
        p.onSpotlightChange(arrivedLayer)

        if (arrivedLayer <= 0) {
          p.onIncrementEpoch()
          ws.direction = 'forward'
          ws.currentLayer = 0
        } else {
          ws.currentLayer = arrivedLayer
        }
      }
    }
    return
  }

  if (ws.holdFrames > 0) {
    ws.holdFrames--
    return
  }

  if (p.simMode === 'forward_only') {
    ws.direction = 'forward'
    if (ws.currentLayer >= numLayers - 1) ws.currentLayer = 0
    p.onPhaseChange('FORWARD PASS')
    p.onSpotlightChange(ws.currentLayer)
    p.onSpawnWave(ws.currentLayer, 'forward')
    ws.waitingForArrival = true
  } else if (ws.direction === 'forward') {
    p.onPhaseChange('FORWARD PASS')
    p.onSpotlightChange(ws.currentLayer)
    p.onSpawnWave(ws.currentLayer, 'forward')
    ws.waitingForArrival = true
  } else {
    p.onPhaseChange('BACKPROPAGATION')
    p.onSpotlightChange(ws.currentLayer)
    p.onSpawnWave(ws.currentLayer, 'backward')
    ws.waitingForArrival = true
  }
}

export function renderVisualizerFrame(p: RenderFrameParams) {
  const {
    ctx,
    W,
    H,
    isLightMode,
    showNumbers,
    showWeights,
    activeSpotlightLayer,
    selectedNeuron,
    hoveredNeuron,
    layerActivations,
    targetValues,
    nodes,
    synapses,
    cam,
    camTarget,
  } = p

  ctx.fillStyle = isLightMode ? '#f8fafc' : '#060911'
  ctx.fillRect(0, 0, W, H)

  const ease = 0.22
  cam.zoom += (camTarget.zoom - cam.zoom) * ease
  cam.panX += (camTarget.panX - cam.panX) * ease
  cam.panY += (camTarget.panY - cam.panY) * ease
  if (Math.abs(camTarget.zoom - cam.zoom) < 0.0005) cam.zoom = camTarget.zoom
  if (Math.abs(camTarget.panX - cam.panX) < 0.05) cam.panX = camTarget.panX
  if (Math.abs(camTarget.panY - cam.panY) < 0.05) cam.panY = camTarget.panY

  let gridStep = 32 * cam.zoom
  while (gridStep < 18) gridStep *= 2
  while (gridStep > 64) gridStep /= 2
  const oxGrid = W / 2 + cam.panX
  const oyGrid = H / 2 + cam.panY
  const startGx = ((oxGrid % gridStep) + gridStep) % gridStep
  const startGy = ((oyGrid % gridStep) + gridStep) % gridStep
  ctx.strokeStyle = isLightMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(30, 41, 59, 0.35)'
  ctx.lineWidth = 1
  for (let gx = startGx; gx < W; gx += gridStep) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, H)
    ctx.stroke()
  }
  for (let gy = startGy; gy < H; gy += gridStep) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(W, gy)
    ctx.stroke()
  }

  ctx.save()
  ctx.translate(W / 2 + cam.panX, H / 2 + cam.panY)
  ctx.scale(cam.zoom, cam.zoom)
  ctx.translate(-W / 2, -H / 2)

  const numLayers = nodes.length
  const padX = Math.max(54, W * 0.06)
  const padTop = 64
  const padBottom = 26
  const usableW = Math.max(200, W - padX * 2)
  const usableH = Math.max(180, H - padTop - padBottom)
  const maxCount = Math.max(1, ...nodes.map(l => l.length))
  const tallestLayerH = maxCount <= 22 ? usableH : Math.max(usableH, maxCount * 14)
  const worldW = tallestLayerH > usableH
    ? Math.max(usableW, Math.min(tallestLayerH * 0.55, numLayers * 220))
    : usableW
  const worldCenterX = W / 2
  const worldCenterY = padTop + usableH / 2
  p.worldBoundsRef.current = { w: worldW + 90, h: tallestLayerH + 100 }

  const layerLayouts: LayerLayoutInfo[] = nodes.map((layer, lIdx) => {
    const count = layer.length
    const layout = computeSingleColumnLayerLayout(
      count,
      lIdx,
      numLayers,
      worldW,
      usableH,
      worldCenterX,
      worldCenterY
    )
    layer.forEach((node, nIdx) => {
      node.x = layout.centerX
      node.y = count > 1
        ? layout.topY + ((nIdx + 0.5) / count) * layout.height
        : layout.topY + layout.height / 2
    })
    return layout
  })

  stepWaveSimulation(p, numLayers)

  nodes.forEach((layer, lIdx) => {
    if (layer.length === 0) return
    const layout = layerLayouts[lIdx]
    const lx = layout.centerX
    const isInput = lIdx === 0
    const isOutput = lIdx === numLayers - 1
    const isSpotlight = activeSpotlightLayer === lIdx

    if (!isInput && !isOutput) {
      ctx.save()
      ctx.fillStyle = isSpotlight
        ? (isLightMode ? 'rgba(13, 148, 136, 0.08)' : 'rgba(13, 148, 136, 0.1)')
        : (isLightMode ? 'rgba(226, 232, 240, 0.45)' : 'rgba(15, 23, 42, 0.45)')
      ctx.strokeStyle = isSpotlight
        ? 'rgba(13, 148, 136, 0.5)'
        : (isLightMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(51, 65, 85, 0.35)')
      ctx.lineWidth = (isSpotlight ? 1.5 : 1) / Math.min(1, cam.zoom)
      ctx.beginPath()
      ctx.roundRect(lx - layout.colHalfW, layout.topY - 8, layout.colHalfW * 2, layout.height + 16, 16)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  })

  const posColor = isLightMode ? '#0d9488' : '#2dd4bf'
  const negColor = isLightMode ? '#e11d48' : '#fb7185'
  const focus = hoveredNeuron || selectedNeuron
  const isLinkedToFocus = (s: SynapseConnection) => Boolean(focus && (
    (focus.layerIdx === s.fromLayer && focus.neuronIdx === s.fromNeuron) ||
    (focus.layerIdx === s.toLayer && focus.neuronIdx === s.toNeuron)
  ))

  const pairBudget = Math.round(MAX_SYNAPSES_DRAWN_PER_PAIR * Math.max(1, cam.zoom * cam.zoom))
  const buckets: Path2D[][] = [
    [new Path2D(), new Path2D(), new Path2D()],
    [new Path2D(), new Path2D(), new Path2D()],
  ]
  const highlighted: SynapseConnection[] = []

  for (let si = 0; si < synapses.length; si++) {
    const s = synapses[si]
    const src = nodes[s.fromLayer]?.[s.fromNeuron]
    const dst = nodes[s.toLayer]?.[s.toNeuron]
    if (!src || !dst) continue

    if (isLinkedToFocus(s)) {
      highlighted.push(s)
      continue
    }

    const fanOut = nodes[s.toLayer].length
    const pairCount = nodes[s.fromLayer].length * fanOut
    if (pairCount > pairBudget) {
      const stride = Math.ceil(pairCount / pairBudget)
      const localIdx = s.fromNeuron * fanOut + s.toNeuron
      if ((localIdx * 7919) % stride !== 0 && Math.abs(s.weight) < 1.2) continue
    }

    const weightMag = Math.min(1, Math.abs(s.weight))
    const bucketIdx = weightMag < 0.33 ? 0 : weightMag < 0.66 ? 1 : 2
    const path = buckets[s.weight >= 0 ? 0 : 1][bucketIdx]
    const dx = dst.x - src.x
    path.moveTo(src.x, src.y)
    if (pairCount > 900) {
      path.lineTo(dst.x, dst.y)
    } else {
      path.bezierCurveTo(src.x + dx * 0.42, src.y, dst.x - dx * 0.42, dst.y, dst.x, dst.y)
    }
  }

  const maxPair = nodes.slice(0, -1).reduce((m, layer, l) => Math.max(m, layer.length * (nodes[l + 1]?.length ?? 0)), 1)
  const density = Math.min(1, Math.max(0.16, Math.sqrt(140 / maxPair) * Math.sqrt(cam.zoom)))
  const dimFactor = focus ? 0.55 : 1

  ctx.save()
  buckets.forEach((group, signIdx) => {
    ctx.strokeStyle = signIdx === 0 ? posColor : negColor
    group.forEach((path, bIdx) => {
      ctx.globalAlpha = (0.3 + bIdx * 0.16) * density * dimFactor
      ctx.lineWidth = (0.3 + bIdx * 0.14) / Math.max(1, cam.zoom * 0.6)
      ctx.stroke(path)
    })
  })
  ctx.restore()

  highlighted.forEach(s => {
    const src = nodes[s.fromLayer][s.fromNeuron]
    const dst = nodes[s.toLayer][s.toNeuron]
    const weightMag = Math.min(1, Math.abs(s.weight))
    const strokeColor = s.weight >= 0 ? posColor : negColor
    ctx.save()
    ctx.strokeStyle = strokeColor
    ctx.globalAlpha = highlighted.length > 120 ? 0.7 : 0.95
    ctx.lineWidth = (0.55 + weightMag * 0.4) / Math.max(1, cam.zoom * 0.6)
    const dx = dst.x - src.x
    ctx.beginPath()
    ctx.moveTo(src.x, src.y)
    ctx.bezierCurveTo(src.x + dx * 0.42, src.y, dst.x - dx * 0.42, dst.y, dst.x, dst.y)
    ctx.stroke()

    if (showWeights && highlighted.length <= 40) {
      const midX = (src.x + dst.x) / 2
      const midY = (src.y + dst.y) / 2
      ctx.globalAlpha = 0.96
      ctx.fillStyle = isLightMode ? '#ffffff' : '#0f172a'
      ctx.fillRect(midX - 18, midY - 7, 36, 14)
      ctx.font = '9px ui-monospace, monospace'
      ctx.fillStyle = strokeColor
      ctx.textAlign = 'center'
      ctx.fillText(s.weight >= 0 ? `+${s.weight.toFixed(2)}` : s.weight.toFixed(2), midX, midY + 3)
    }
    ctx.restore()
  })

  const remainingParticles: SignalParticle[] = []
  const arrivedSet = new Set<string>()

  p.particlesRef.current.forEach(pt => {
    pt.progress += pt.speed
    if (pt.progress < 0) {
      remainingParticles.push(pt)
      return
    }
    const t = Math.min(1, pt.progress)
    const curX = bezierPoint(t, pt.fromX, pt.cp1X, pt.cp2X, pt.toX)
    const curY = bezierPoint(t, pt.fromY, pt.cp1Y, pt.cp2Y, pt.toY)

    pt.trail.push({ x: curX, y: curY })
    if (pt.trail.length > 10) pt.trail.shift()

    if (pt.trail.length > 1) {
      ctx.save()
      for (let i = 1; i < pt.trail.length; i++) {
        const ratio = i / pt.trail.length
        ctx.beginPath()
        ctx.moveTo(pt.trail[i - 1].x, pt.trail[i - 1].y)
        ctx.lineTo(pt.trail[i].x, pt.trail[i].y)
        ctx.strokeStyle = pt.color
        ctx.globalAlpha = ratio * 0.65
        ctx.lineWidth = Math.max(0.35, pt.size * ratio * 0.55)
        ctx.stroke()
      }
      ctx.restore()
    }

    ctx.save()
    ctx.beginPath()
    ctx.arc(curX, curY, pt.size, 0, Math.PI * 2)
    ctx.fillStyle = isLightMode ? pt.color : '#ffffff'
    ctx.shadowColor = pt.color
    ctx.shadowBlur = 5
    ctx.fill()
    ctx.restore()

    if (pt.progress < 1) {
      remainingParticles.push(pt)
    } else {
      const key = `${pt.targetLayer}-${pt.targetNeuron}`
      if (!arrivedSet.has(key)) {
        arrivedSet.add(key)
        const targetNode = nodes[pt.targetLayer]?.[pt.targetNeuron]
        if (targetNode) {
          const tNodeR = layerLayouts[pt.targetLayer]?.nodeR ?? 10
          const rScale = Math.min(1, Math.max(0.28, tNodeR / 14))
          p.ripplesRef.current.push({
            x: targetNode.x,
            y: targetNode.y,
            radius: 10 * rScale,
            maxRadius: 28 * rScale,
            alpha: 0.65,
            color: pt.color,
          })
        }
      }
    }
  })
  p.particlesRef.current = remainingParticles

  const remainingRipples: ShockwaveRipple[] = []
  p.ripplesRef.current.forEach(r => {
    r.radius += 0.85
    r.alpha -= 0.025
    if (r.alpha > 0 && r.radius < r.maxRadius) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      ctx.strokeStyle = r.color
      ctx.globalAlpha = r.alpha
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.restore()
      remainingRipples.push(r)
    }
  })
  p.ripplesRef.current = remainingRipples

  nodes.forEach((layer, lIdx) => {
    const isInput = lIdx === 0
    const isOutput = lIdx === numLayers - 1
    const baseColor = isInput ? '#0284c7' : isOutput ? '#10b981' : '#0d9488'
    const count = layer.length
    const layout = layerLayouts[lIdx]
    const slotHeight = layout.slotY
    const baseNodeR = layout.nodeR
    const screenNodeR = baseNodeR * cam.zoom
    const isDense = screenNodeR < 3.6

    layer.forEach((node, nIdx) => {
      const isSelected = selectedNeuron?.layerIdx === lIdx && selectedNeuron?.neuronIdx === nIdx
      const isHovered = hoveredNeuron?.layerIdx === lIdx && hoveredNeuron?.neuronIdx === nIdx
      const normAct = normalizeDisplayActivation(node.activation, layerActivations[lIdx] || 'sigmoid')
      const radius = baseNodeR + normAct * Math.min(2.5, baseNodeR * 0.18)
      const isFocused = isSelected || isHovered

      ctx.save()

      if (isDense && !isFocused) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = baseColor
        ctx.globalAlpha = 0.35 + normAct * 0.65
        ctx.fill()
        ctx.restore()
        return
      }

      const drawR = isFocused && isDense ? Math.max(radius, 5 / Math.max(1, cam.zoom)) : radius

      ctx.beginPath()
      ctx.arc(node.x, node.y, drawR, 0, Math.PI * 2)
      const grad = ctx.createRadialGradient(
        node.x - drawR * 0.15,
        node.y - drawR * 0.15,
        drawR * 0.1,
        node.x,
        node.y,
        drawR
      )
      grad.addColorStop(0, baseColor)
      grad.addColorStop(0.7, isLightMode ? '#0f172a' : '#111827')
      grad.addColorStop(1, '#090d16')
      ctx.fillStyle = grad
      ctx.shadowColor = baseColor
      ctx.shadowBlur = isFocused ? 20 : count > 40 ? 0 : 6 + normAct * 8
      ctx.fill()

      ctx.lineWidth = (isFocused ? 2.5 : 1.4) / Math.max(1, cam.zoom * 0.7)
      ctx.strokeStyle = isFocused ? (isLightMode ? '#0f172a' : '#ffffff') : baseColor
      ctx.stroke()

      if (showNumbers && screenNodeR >= 9.5) {
        const worldFont = Math.min(9, Math.max(3.5, drawR * 0.56))
        ctx.globalAlpha = 1
        ctx.font = `bold ${worldFont}px ui-monospace, SFMono-Regular, monospace`
        ctx.textAlign = 'center'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(node.activation.toFixed(2), node.x, node.y + worldFont * 0.35)
      }

      if (showNumbers && slotHeight * cam.zoom >= 42) {
        const subFont = Math.min(8, Math.max(3.2, drawR * 0.5))
        ctx.font = `${subFont}px ui-monospace, SFMono-Regular, monospace`
        ctx.textAlign = 'center'
        ctx.fillStyle = isLightMode ? '#475569' : '#94a3b8'
        const subLabel = isInput
          ? node.label
          : isOutput
            ? `y=${(targetValues[nIdx] ?? 0).toFixed(1)}`
            : `b:${node.bias >= 0 ? '+' : ''}${node.bias.toFixed(2)}`
        ctx.fillText(subLabel, node.x, node.y + drawR + subFont * 1.4)
      }

      ctx.restore()
    })
  })

  ctx.restore()

  const colScreenGap = numLayers > 1
    ? ((layerLayouts[1].centerX - layerLayouts[0].centerX) * cam.zoom)
    : W

  nodes.forEach((layer, lIdx) => {
    const layout = layerLayouts[lIdx]
    const isInput = lIdx === 0
    const isOutput = lIdx === numLayers - 1
    const baseColor = isInput ? '#0284c7' : isOutput ? '#10b981' : '#0d9488'
    const sxCol = (layout.centerX - W / 2) * cam.zoom + W / 2 + cam.panX
    const syTop = (layout.topY - 10 - H / 2) * cam.zoom + H / 2 + cam.panY
    const labelY = Math.min(H - 18, Math.max(20, syTop - 16))

    ctx.save()
    ctx.font = colScreenGap < 58 ? 'bold 9px Inter, system-ui, sans-serif' : 'bold 10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = baseColor
    const colTitle = colScreenGap < 68
      ? (isInput ? 'X' : isOutput ? 'Ŷ' : `H${lIdx}`)
      : (isInput ? 'ENTRADA (X)' : isOutput ? 'SALIDA (Ŷ)' : `OCULTA H${lIdx}`)
    ctx.fillText(colTitle, sxCol, labelY)

    if (colScreenGap >= 50) {
      ctx.font = '9px ui-monospace, SFMono-Regular, monospace'
      ctx.fillStyle = isLightMode ? '#64748b' : '#94a3b8'
      const colSub = colScreenGap < 84
        ? `${layer.length}N`
        : isInput
          ? `${layer.length}N · Features`
          : `${layer.length}N · ${(layerActivations[lIdx] || 'relu').toUpperCase()}`
      ctx.fillText(colSub, sxCol, labelY + 13)
    }
    ctx.restore()
  })
}

