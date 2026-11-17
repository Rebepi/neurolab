import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, Layers, Eye, Database } from 'lucide-react'
import { api } from '../../services/api'
import { useTheme } from '../../context/ThemeContext'
import { SystemTooltip } from '../../components/InfoTip'
import {
  DEFAULT_INPUT_VALUES,
  DEFAULT_TARGET_VALUES,
  MAX_NEURONS_PER_LAYER,
} from './constants'
import {
  computeForwardPassMath,
  computeLayerBackprop,
  computeSingleLayerForward,
} from './mathEngine'
import {
  buildInspectDataForNode,
  buildNetworkGraph,
  spawnLayerSignalWave,
} from './networkBuilder'
import { renderVisualizerFrame } from './canvasRenderer'
import { VisualizerToolbar } from './components/VisualizerToolbar'
import { CanvasFooterBar } from './components/CanvasFooterBar'
import { NeuronInspectorTab } from './components/NeuronInspectorTab'
import { TopologyInspectorTab } from './components/TopologyInspectorTab'
import { DataInspectorTab } from './components/DataInspectorTab'
import type {
  ActivationType,
  CameraState,
  DatasetSample,
  InspectDataState,
  InspectorTab,
  NeuronNode,
  ShockwaveRipple,
  SignalParticle,
  SimMode,
  SynapseConnection,
  WaveState,
} from './types'

export default function NeuralVisualizerModule({ currentProject }: { currentProject?: any }) {
  const { mode: globalThemeMode } = useTheme()
  const isLightMode = globalThemeMode === 'light'

  const [layerSizes, setLayerSizes] = useState<number[]>([1, 6, 8, 6, 1])
  const [layerActivations, setLayerActivations] = useState<ActivationType[]>([
    'linear',
    'relu',
    'relu',
    'tanh',
    'sigmoid',
  ])
  const [isPlaying, setIsPlaying] = useState(true)
  const [simMode, setSimMode] = useState<SimMode>('forward_only')
  const [activeTab, setActiveTab] = useState<InspectorTab>('neuron')
  const [speed, setSpeed] = useState(0.26)
  const [learningRate, setLearningRate] = useState(0.08)
  const [zoomPct, setZoomPct] = useState(100)
  const [isPanning, setIsPanning] = useState(false)
  const [showNumbers, setShowNumbers] = useState(true)
  const [showWeights, setShowWeights] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeSpotlightLayer, setActiveSpotlightLayer] = useState(0)
  const [, setEpochCount] = useState(1)
  const [liveLoss, setLiveLoss] = useState(0.0)
  const [liveAcc, setLiveAcc] = useState(0.0)
  const [, setPhaseLabel] = useState<'FORWARD PASS' | 'BACKPROPAGATION'>('FORWARD PASS')
  const [selectedNeuron, setSelectedNeuron] = useState<{ layerIdx: number; neuronIdx: number } | null>(null)
  const [hoveredNeuron, setHoveredNeuron] = useState<{ layerIdx: number; neuronIdx: number } | null>(null)
  const [inputValues, setInputValues] = useState<number[]>(DEFAULT_INPUT_VALUES)
  const [targetValues, setTargetValues] = useState<number[]>(DEFAULT_TARGET_VALUES)
  const [featureNames, setFeatureNames] = useState<string[]>([])
  const [datasetSamples, setDatasetSamples] = useState<DatasetSample[]>([])
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0)

  const [inspectData, setInspectData] = useState<InspectDataState>({
    node: null,
    layerAct: 'sigmoid',
    incomingCount: 0,
    incoming: [],
    outgoing: [],
  })

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodesRef = useRef<NeuronNode[][]>([])
  const synapsesRef = useRef<SynapseConnection[]>([])
  const particlesRef = useRef<SignalParticle[]>([])
  const ripplesRef = useRef<ShockwaveRipple[]>([])
  const cameraRef = useRef<CameraState>({ zoom: 1, panX: 0, panY: 0 })
  const inspectorDirtyRef = useRef(true)
  const worldBoundsRef = useRef({ w: 800, h: 480 })
  const cameraTargetRef = useRef<CameraState>({ zoom: 1, panX: 0, panY: 0 })
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originPanX: 0, originPanY: 0 })
  const waveStateRef = useRef<WaveState>({
    currentLayer: 0,
    direction: 'forward',
    waitingForArrival: false,
    holdFrames: 0,
  })

  const applyMetrics = useCallback((metrics: { loss: number; acc: number } | null) => {
    if (!metrics) return
    setLiveLoss(metrics.loss)
    setLiveAcc(metrics.acc)
    inspectorDirtyRef.current = true
  }, [])

  const clampCamera = useCallback((cam: CameraState) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const W = rect.width
    const H = rect.height
    const wb = worldBoundsRef.current
    const maxPanX = Math.max(0, (wb.w * cam.zoom - W) / 2 + 56)
    const maxPanY = Math.max(0, (wb.h * cam.zoom - H) / 2 + 56)
    cam.panX = wb.w * cam.zoom <= W ? 0 : Math.min(maxPanX, Math.max(-maxPanX, cam.panX))
    cam.panY = wb.h * cam.zoom <= H ? 0 : Math.min(maxPanY, Math.max(-maxPanY, cam.panY))
  }, [])

  const resetCamera = useCallback(() => {
    const t = cameraTargetRef.current
    t.zoom = 1
    t.panX = 0
    t.panY = 0
    setZoomPct(100)
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isFullscreen])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const cx = rect.width / 2
      const cy = rect.height / 2
      const wb = worldBoundsRef.current
      const fitMin = Math.min(
        0.25,
        Math.min((rect.width - 60) / Math.max(1, wb.w), (rect.height - 80) / Math.max(1, wb.h)) * 0.85
      )
      const minZoom = Math.max(0.1, fitMin)
      const t = cameraTargetRef.current
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.002))
      const rawNext = Math.min(6, Math.max(minZoom, t.zoom * factor))
      const nextZoom = Math.abs(rawNext - 1) < 0.025 ? 1 : rawNext
      if (Math.abs(nextZoom - t.zoom) < 0.0001) return
      const wx = (sx - cx - t.panX) / t.zoom + cx
      const wy = (sy - cy - t.panY) / t.zoom + cy
      t.zoom = nextZoom
      t.panX = sx - cx - (wx - cx) * t.zoom
      t.panY = sy - cy - (wy - cy) * t.zoom
      clampCamera(t)
      setZoomPct(Math.round(t.zoom * 100))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [clampCamera, isFullscreen])

  const rebuildNetwork = useCallback((
    sizes: number[],
    customActs?: ActivationType[],
    customWeights?: number[][][],
    customBiases?: number[][],
    customInputs?: number[],
    customTargets?: number[],
    customFeatureNames?: string[]
  ) => {
    const actsToUse = customActs || layerActivations
    const inputsToUse = customInputs || inputValues
    const targetsToUse = customTargets || targetValues
    const featsToUse = customFeatureNames || featureNames

    const { nodes, synapses, metrics } = buildNetworkGraph(
      sizes,
      actsToUse,
      inputsToUse,
      targetsToUse,
      featsToUse,
      customWeights,
      customBiases
    )

    applyMetrics(metrics)
    nodesRef.current = nodes
    synapsesRef.current = synapses
    particlesRef.current = []
    ripplesRef.current = []
    waveStateRef.current = {
      currentLayer: 0,
      direction: 'forward',
      waitingForArrival: false,
      holdFrames: 12,
    }
  }, [applyMetrics, featureNames, inputValues, layerActivations, targetValues])

  useEffect(() => {
    inspectorDirtyRef.current = true
  }, [hoveredNeuron, selectedNeuron, layerActivations])

  useEffect(() => {
    rebuildNetwork(layerSizes, layerActivations)
  }, [])

  useEffect(() => {
    if (!currentProject?.id) return
    api.getProjectVisualizerState(currentProject.id, 20)
      .then(data => {
        if (data.feature_names && data.feature_names.length > 0) {
          setFeatureNames(data.feature_names)
        }
        if (data.samples && data.samples.length > 0) {
          setDatasetSamples(data.samples)
        }
      })
      .catch(() => {})
  }, [currentProject?.id])

  const spawnLayerWave = useCallback((fromLayer: number, direction: 'forward' | 'backward') => {
    spawnLayerSignalWave(
      nodesRef.current,
      synapsesRef.current,
      particlesRef.current,
      fromLayer,
      direction,
      speed
    )
  }, [speed])

  const handleWaveArrivalForward = useCallback((arrivedLayer: number) => {
    const metrics = computeSingleLayerForward(
      nodesRef.current,
      synapsesRef.current,
      arrivedLayer,
      layerActivations,
      targetValues
    )
    applyMetrics(metrics)
    inspectorDirtyRef.current = true
  }, [applyMetrics, layerActivations, targetValues])

  const handleWaveArrivalBackward = useCallback((currentLayer: number) => {
    computeLayerBackprop(
      nodesRef.current,
      synapsesRef.current,
      currentLayer,
      layerActivations,
      targetValues,
      learningRate
    )
    inspectorDirtyRef.current = true
  }, [layerActivations, learningRate, targetValues])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number

    const render = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr)
        canvas.height = Math.floor(rect.height * dpr)
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      renderVisualizerFrame({
        ctx,
        W: rect.width,
        H: rect.height,
        isLightMode,
        isPlaying,
        simMode,
        speed,
        showNumbers,
        showWeights,
        activeSpotlightLayer,
        selectedNeuron,
        hoveredNeuron,
        layerActivations,
        targetValues,
        nodes: nodesRef.current,
        synapses: synapsesRef.current,
        particlesRef,
        ripplesRef,
        cam: cameraRef.current,
        camTarget: cameraTargetRef.current,
        worldBoundsRef,
        waveState: waveStateRef.current,
        onWaveArrivalForward: handleWaveArrivalForward,
        onWaveArrivalBackward: handleWaveArrivalBackward,
        onPhaseChange: setPhaseLabel,
        onSpotlightChange: setActiveSpotlightLayer,
        onSpawnWave: spawnLayerWave,
        onIncrementEpoch: () => setEpochCount(e => e + 1),
      })

      const numLayers = nodesRef.current.length
      const targetFocus = hoveredNeuron || selectedNeuron || { layerIdx: Math.min(1, numLayers - 1), neuronIdx: 0 }
      if (targetFocus && inspectorDirtyRef.current) {
        inspectorDirtyRef.current = false
        const nextInspect = buildInspectDataForNode(
          nodesRef.current,
          synapsesRef.current,
          targetFocus,
          layerActivations
        )
        if (nextInspect) setInspectData(nextInspect)
      }

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [
    isPlaying,
    isFullscreen,
    isLightMode,
    simMode,
    speed,
    showNumbers,
    showWeights,
    activeSpotlightLayer,
    selectedNeuron,
    hoveredNeuron,
    layerActivations,
    targetValues,
    spawnLayerWave,
    handleWaveArrivalForward,
    handleWaveArrivalBackward,
  ])

  function screenToWorld(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { sx: 0, sy: 0, wx: 0, wy: 0 }
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    const cam = cameraRef.current
    return {
      sx,
      sy,
      wx: (sx - cx - cam.panX) / cam.zoom + cx,
      wy: (sy - cy - cam.panY) / cam.zoom + cy,
    }
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return
    const { sx, sy } = screenToWorld(e)
    const t = cameraTargetRef.current
    dragRef.current = { active: true, moved: false, startX: sx, startY: sy, originPanX: t.panX, originPanY: t.panY }
  }

  function handleCanvasMouseUp() {
    dragRef.current.active = false
    setIsPanning(false)
  }

  function handleCanvasMouseLeave() {
    dragRef.current.active = false
    setIsPanning(false)
    setHoveredNeuron(null)
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { sx, sy, wx, wy } = screenToWorld(e)
    const drag = dragRef.current

    if (drag.active) {
      const dx = sx - drag.startX
      const dy = sy - drag.startY
      const rect = canvasRef.current?.getBoundingClientRect()
      const wb = worldBoundsRef.current
      const t = cameraTargetRef.current
      const canPan = Boolean(rect && (wb.w * t.zoom > rect.width || wb.h * t.zoom > rect.height)) || t.zoom > 1.001
      if (!drag.moved && Math.hypot(dx, dy) > 4 && canPan) {
        drag.moved = true
        setIsPanning(true)
        setHoveredNeuron(null)
      }
      if (drag.moved) {
        t.panX = drag.originPanX + dx
        t.panY = drag.originPanY + dy
        clampCamera(t)
        const cam = cameraRef.current
        cam.panX = t.panX
        cam.panY = t.panY
        return
      }
    }

    let found: { layerIdx: number; neuronIdx: number } | null = null
    let bestDist = Infinity
    nodesRef.current.forEach((layer, lIdx) => {
      const stepY = layer.length > 1 ? Math.abs((layer[1]?.y ?? 0) - (layer[0]?.y ?? 0)) : 40
      const hitR = Math.max(5.5, Math.min(20, (stepY > 0 ? stepY : 12) * 0.52))
      layer.forEach((node, nIdx) => {
        const dist = Math.hypot(wx - node.x, wy - node.y)
        if (dist <= hitR && dist < bestDist) {
          bestDist = dist
          found = { layerIdx: lIdx, neuronIdx: nIdx }
        }
      })
    })
    setHoveredNeuron(prev => {
      const f = found as { layerIdx: number; neuronIdx: number } | null
      if (prev?.layerIdx === f?.layerIdx && prev?.neuronIdx === f?.neuronIdx) return prev
      return f
    })
  }

  function handleCanvasClick() {
    if (dragRef.current.moved) {
      dragRef.current.moved = false
      return
    }
    if (hoveredNeuron) {
      if (
        selectedNeuron &&
        selectedNeuron.layerIdx === hoveredNeuron.layerIdx &&
        selectedNeuron.neuronIdx === hoveredNeuron.neuronIdx
      ) {
        setSelectedNeuron(null)
      } else {
        setSelectedNeuron(hoveredNeuron)
        setActiveTab('neuron')
      }
    } else {
      setSelectedNeuron(null)
    }
  }

  function triggerSingleStepWave() {
    const numLayers = nodesRef.current.length
    if (numLayers < 2) return
    const ws = waveStateRef.current
    if (ws.currentLayer >= numLayers - 1) ws.currentLayer = 0
    setPhaseLabel('FORWARD PASS')
    setActiveSpotlightLayer(ws.currentLayer)
    spawnLayerWave(ws.currentLayer, 'forward')
    applyMetrics(
      computeSingleLayerForward(
        nodesRef.current,
        synapsesRef.current,
        ws.currentLayer + 1,
        layerActivations,
        targetValues
      )
    )
    inspectorDirtyRef.current = true
    ws.currentLayer = (ws.currentLayer + 1) % (numLayers - 1)
  }

  function executeSingleRealGradientStep() {
    const nodes = nodesRef.current
    const synapses = synapsesRef.current
    applyMetrics(computeForwardPassMath(nodes, synapses, layerActivations, targetValues))
    for (let l = nodes.length - 1; l >= 1; l--) {
      computeLayerBackprop(nodes, synapses, l, layerActivations, targetValues, learningRate)
    }
    applyMetrics(computeForwardPassMath(nodes, synapses, layerActivations, targetValues))
    setEpochCount(e => e + 1)
    setPhaseLabel('BACKPROPAGATION')
    spawnLayerWave(nodes.length - 1, 'backward')
  }

  function handleInputSliderChange(idx: number, val: number) {
    const updated = [...inputValues]
    updated[idx] = val
    setInputValues(updated)
    if (nodesRef.current[0]?.[idx]) {
      nodesRef.current[0][idx].activation = val
      nodesRef.current[0][idx].z = val
      applyMetrics(computeForwardPassMath(nodesRef.current, synapsesRef.current, layerActivations, targetValues))
    }
  }

  function handleTargetChange(idx: number, val: number) {
    const updated = [...targetValues]
    updated[idx] = val
    setTargetValues(updated)
    const outLayer = nodesRef.current[nodesRef.current.length - 1]
    if (outLayer?.[idx]) {
      outLayer[idx].targetVal = val
      applyMetrics(computeForwardPassMath(nodesRef.current, synapsesRef.current, layerActivations, updated))
    }
  }

  function handleSelectedBiasChange(newBias: number) {
    const activeTarget = selectedNeuron || (inspectData.node ? { layerIdx: inspectData.node.layerIdx, neuronIdx: inspectData.node.neuronIdx } : null)
    if (!activeTarget || activeTarget.layerIdx === 0) return
    const node = nodesRef.current[activeTarget.layerIdx]?.[activeTarget.neuronIdx]
    if (!node) return
    node.bias = Number(newBias.toFixed(4))
    applyMetrics(computeForwardPassMath(nodesRef.current, synapsesRef.current, layerActivations, targetValues))
  }

  function handleSelectedWeightChange(fromNeuronIdx: number, newWeight: number) {
    const activeTarget = selectedNeuron || (inspectData.node ? { layerIdx: inspectData.node.layerIdx, neuronIdx: inspectData.node.neuronIdx } : null)
    if (!activeTarget || activeTarget.layerIdx === 0) return
    const syn = synapsesRef.current.find(
      s => s.toLayer === activeTarget.layerIdx &&
        s.toNeuron === activeTarget.neuronIdx &&
        s.fromLayer === activeTarget.layerIdx - 1 &&
        s.fromNeuron === fromNeuronIdx
    )
    if (!syn) return
    syn.weight = Number(newWeight.toFixed(4))
    applyMetrics(computeForwardPassMath(nodesRef.current, synapsesRef.current, layerActivations, targetValues))
  }

  function setExactLayerCount(layerIdx: number, newCount: number) {
    const clamped = Math.max(1, Math.min(MAX_NEURONS_PER_LAYER, Math.round(newCount) || 1))
    const nextSizes = layerSizes.map((sz, i) => (i === layerIdx ? clamped : sz))
    setLayerSizes(nextSizes)
    rebuildNetwork(nextSizes, layerActivations)
  }

  function updateLayerActivation(layerIdx: number, act: ActivationType) {
    const nextActs = [...layerActivations]
    nextActs[layerIdx] = act
    setLayerActivations(nextActs)
    applyMetrics(computeForwardPassMath(nodesRef.current, synapsesRef.current, nextActs, targetValues))
  }

  function addHiddenLayer() {
    if (layerSizes.length >= 8) return
    const nextSizes = [...layerSizes]
    nextSizes.splice(nextSizes.length - 1, 0, 6)
    const nextActs = [...layerActivations]
    nextActs.splice(nextActs.length - 1, 0, 'relu')
    setLayerSizes(nextSizes)
    setLayerActivations(nextActs)
    rebuildNetwork(nextSizes, nextActs)
  }

  function removeHiddenLayer() {
    if (layerSizes.length <= 3) return
    const nextSizes = [...layerSizes]
    nextSizes.splice(nextSizes.length - 2, 1)
    const nextActs = [...layerActivations]
    nextActs.splice(nextActs.length - 2, 1)
    setLayerSizes(nextSizes)
    setLayerActivations(nextActs)
    setSelectedNeuron(null)
    rebuildNetwork(nextSizes, nextActs)
  }

  function loadDatasetSampleRow(sampleIdx: number) {
    const sample = datasetSamples[sampleIdx]
    if (!sample) return
    setSelectedSampleIdx(sampleIdx)
    const nextInputs = [...inputValues]
    sample.inputs.forEach((v, i) => { nextInputs[i] = v })
    const nextTargets = [...targetValues]
    sample.targets.forEach((v, i) => { nextTargets[i] = v })
    setInputValues(nextInputs)
    setTargetValues(nextTargets)

    if (nodesRef.current[0]) {
      nodesRef.current[0].forEach((n, i) => {
        if (nextInputs[i] !== undefined) {
          n.activation = nextInputs[i]
          n.z = nextInputs[i]
        }
      })
      applyMetrics(computeForwardPassMath(nodesRef.current, synapsesRef.current, layerActivations, nextTargets))
      waveStateRef.current = { currentLayer: 0, direction: 'forward', waitingForArrival: false, holdFrames: 2 }
    }
  }

  async function syncWithRealTrainedModelOrArchitecture() {
    if (!currentProject) return
    try {
      const state = await api.getProjectVisualizerState(currentProject.id, 18)
      if (state.feature_names?.length > 0) {
        setFeatureNames(state.feature_names)
      }
      if (state.samples?.length > 0) {
        setDatasetSamples(state.samples)
      }

      if (state.trained_model) {
        const tm = state.trained_model
        const acts = (tm.layer_activations as ActivationType[]) || tm.layer_sizes.map((_: number, i: number) => i === 0 ? 'linear' : 'relu')
        const firstSampleInputs = state.samples?.[0]?.inputs || inputValues
        const firstSampleTargets = state.samples?.[0]?.targets || targetValues
        setLayerSizes(tm.layer_sizes)
        setLayerActivations(acts)
        setInputValues(firstSampleInputs)
        setTargetValues(firstSampleTargets)
        rebuildNetwork(
          tm.layer_sizes,
          acts,
          tm.weights,
          tm.biases,
          firstSampleInputs,
          firstSampleTargets,
          state.feature_names
        )
        return
      }

      const archs = await api.getProjectArchitectures(currentProject.id)
      if (archs.length > 0) {
        const latest = archs[0]
        const inCount = Math.min(MAX_NEURONS_PER_LAYER, Math.max(1, latest.config.input_shape || 1))
        const denseLayers = latest.config.layers.filter(l => l.type === 'Dense' && l.units)
        const hiddenCounts = denseLayers.map(l => Math.min(MAX_NEURONS_PER_LAYER, Math.max(1, l.units || 6)))
        const hiddenActs = denseLayers.map(l => ((l.activation || 'relu').toLowerCase() as ActivationType))
        const outCount = Math.min(MAX_NEURONS_PER_LAYER, Math.max(1, latest.config.output_dim || 1))
        const outAct = ((latest.config.output_activation || 'sigmoid').toLowerCase() as ActivationType)

        const newSizes = [inCount, ...(hiddenCounts.length > 0 ? hiddenCounts : [6, 4]), outCount]
        const fallbackActs: ActivationType[] = ['relu', 'relu']
        const newActs: ActivationType[] = ['linear', ...(hiddenActs.length > 0 ? hiddenActs : fallbackActs), outAct]
        setLayerSizes(newSizes)
        setLayerActivations(newActs)
        rebuildNetwork(newSizes, newActs)
      }
    } catch {}
  }

  const totalSynapses = layerSizes.slice(0, -1).reduce((acc, cur, idx) => acc + cur * layerSizes[idx + 1], 0)
  const totalNeurons = layerSizes.reduce((a, b) => a + b, 0)

  const content = (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9999] nl-grid-bg flex flex-col gap-3 p-4 overflow-hidden'
          : 'space-y-4'
      }
    >
      <VisualizerToolbar
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(p => !p)}
        onStepWave={triggerSingleStepWave}
        onResetNetwork={() => {
          rebuildNetwork(layerSizes, layerActivations)
          setEpochCount(1)
        }}
        simMode={simMode}
        onSelectSimMode={mode => {
          setSimMode(mode)
          if (mode === 'forward_only') waveStateRef.current.direction = 'forward'
        }}
        hiddenLayerCount={layerSizes.length - 2}
        layerCount={layerSizes.length}
        onRemoveHiddenLayer={removeHiddenLayer}
        onAddHiddenLayer={addHiddenLayer}
        totalNeurons={totalNeurons}
        totalSynapses={totalSynapses}
        liveLoss={liveLoss}
        liveAcc={liveAcc}
        hasProject={Boolean(currentProject)}
        onSyncProject={syncWithRealTrainedModelOrArchitecture}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => {
          resetCamera()
          setIsFullscreen(f => !f)
        }}
      />

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${isFullscreen ? 'flex-1 min-h-0' : ''}`}>
        <div className={`lg:col-span-8 ${isFullscreen ? 'flex flex-col min-h-0 h-full' : ''}`}>
          <div className={`nl-surface rounded-2xl overflow-hidden flex flex-col transition-shadow duration-300 ${isPlaying ? 'nl-accent-glow' : ''} ${isFullscreen ? 'flex-1 min-h-0 h-full' : ''}`}>
            <div className={`relative w-full select-none ${isFullscreen ? 'flex-1 min-h-0' : 'h-[540px] xl:h-[600px]'}`}>
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
                onClick={handleCanvasClick}
                onDoubleClick={resetCamera}
                className={`w-full h-full block ${
                  isPanning
                    ? 'cursor-grabbing'
                    : hoveredNeuron
                      ? 'cursor-pointer'
                      : zoomPct > 100
                        ? 'cursor-grab'
                        : 'cursor-default'
                }`}
              />

              {zoomPct !== 100 && (
                <SystemTooltip label="Restablecer zoom y encuadre (doble clic en el lienzo)" side="top">
                  <button
                    onClick={resetCamera}
                    className="animate-pop-in absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 backdrop-blur text-[11px] font-mono font-bold text-slate-300 transition-all"
                  >
                    <span>{zoomPct}%</span>
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </SystemTooltip>
              )}
            </div>

            <CanvasFooterBar
              speed={speed}
              onChangeSpeed={setSpeed}
              showNumbers={showNumbers}
              onToggleNumbers={setShowNumbers}
              showWeights={showWeights}
              onToggleWeights={setShowWeights}
            />
          </div>
        </div>

        <div className={`lg:col-span-4 ${isFullscreen ? 'min-h-0 h-full' : ''}`}>
          <div className="nl-surface rounded-2xl overflow-hidden flex flex-col h-full">
            <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 p-1 gap-1">
              {([
                { id: 'neuron', label: '1. Neurona', Icon: Eye },
                { id: 'topology', label: '2. Capas', Icon: Layers },
                { id: 'data', label: '3. Datos (X, Y)', Icon: Database },
              ] as const).map(tab => {
                const Icon = tab.Icon
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                      active
                        ? 'nl-accent-bg shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            <div key={activeTab} className="p-4 flex-1 overflow-y-auto space-y-4 animate-card-reveal">
              {activeTab === 'neuron' && (
                <NeuronInspectorTab
                  inspectData={inspectData}
                  layerCount={layerSizes.length}
                  hasSelectedNeuron={Boolean(selectedNeuron)}
                  onClearSelection={() => setSelectedNeuron(null)}
                  onStepGradient={executeSingleRealGradientStep}
                  onBiasChange={handleSelectedBiasChange}
                  onWeightChange={handleSelectedWeightChange}
                />
              )}

              {activeTab === 'topology' && (
                <TopologyInspectorTab
                  layerSizes={layerSizes}
                  layerActivations={layerActivations}
                  onApplyPreset={(sizes, acts) => {
                    setLayerSizes(sizes)
                    setLayerActivations(acts)
                    setSelectedNeuron(null)
                    resetCamera()
                    rebuildNetwork(sizes, acts)
                  }}
                  onUpdateLayerActivation={updateLayerActivation}
                  onSetExactLayerCount={setExactLayerCount}
                />
              )}

              {activeTab === 'data' && (
                <DataInspectorTab
                  datasetSamples={datasetSamples}
                  selectedSampleIdx={selectedSampleIdx}
                  onSelectSample={loadDatasetSampleRow}
                  inputCount={layerSizes[0]}
                  outputCount={layerSizes[layerSizes.length - 1]}
                  inputValues={inputValues}
                  targetValues={targetValues}
                  featureNames={featureNames}
                  learningRate={learningRate}
                  onInputSliderChange={handleInputSliderChange}
                  onTargetChange={handleTargetChange}
                  onLearningRateChange={setLearningRate}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return isFullscreen ? createPortal(content, document.body) : content
}
