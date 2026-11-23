import { useState, useEffect } from 'react'
import {
  BookmarkCheck,
  CheckCircle2,
  Code,
  Database,
  Layers,
  Network,
  Save,
  Wand2,
} from 'lucide-react'
import { api } from '../../services/api'
import type { LayerSpec, Architecture, Dataset } from '../../types/index'
import { SystemSelect } from '../../components/SystemSelect'
import { SystemTooltip } from '../../components/InfoTip'
import { ARCHITECTURE_PRESETS, type ArchitecturePreset } from './constants'
import {
  areLayersEquivalent,
  buildKerasPythonCode,
  computeArchitectureParams,
  createLayerId,
  evaluateArchitectureHealth,
  recommendOptimalArchitecture,
} from './utils'
import { ArchitectureCatalogPanel } from './components/ArchitectureCatalogPanel'
import { ArchitectureInsightsModal } from './components/ArchitectureInsightsModal'
import { ArchitectureViews } from './components/ArchitectureViews'
import { LayerPropertiesPanel } from './components/LayerPropertiesPanel'
import { SaveArchitectureModal } from './components/SaveArchitectureModal'
import { SavedArchitecturesModal } from './components/SavedArchitecturesModal'
import { useToast } from '../../components/toast/ToastContext'

export default function ArchitecturesModule({
  currentProject,
  onNavigate,
}: {
  currentProject: any
  onNavigate?: (module: string) => void
}) {
  const toast = useToast()
  const [layersList, setLayersList] = useState<LayerSpec[]>([
    { id: 'l-1', type: 'Dense', units: 32, activation: 'relu', use_bias: true },
    { id: 'l-2', type: 'Dropout', rate: 0.2 },
    { id: 'l-3', type: 'Dense', units: 16, activation: 'relu', use_bias: true },
  ])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(0)
  const [archName, setArchName] = useState('MLP Clasificador Robusto')
  const [family, setFamily] = useState<'Feedforward' | 'RNN' | 'CNN' | 'GAN'>('Feedforward')
  const [inputShape, setInputShape] = useState(8)
  const [outputDim, setOutputDim] = useState(1)
  const [outputActivation, setOutputActivation] = useState('sigmoid')
  const [justification, setJustification] = useState(
    'Arquitectura optimizada para clasificación binaria de churn con regularización dropout.'
  )
  const [savedArchitectures, setSavedArchitectures] = useState<Architecture[]>([])
  const [projectDatasets, setProjectDatasets] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [activeView, setActiveView] = useState<'canvas' | 'table' | 'code'>('canvas')
  const [copiedCode, setCopiedCode] = useState(false)
  const [insightsModalTab, setInsightsModalTab] = useState<'reasons' | 'profile' | null>(null)

  useEffect(() => {
    if (!currentProject) return
    api.getProjectDatasets(currentProject.id).then(datasets => {
      setProjectDatasets(datasets)
      if (datasets.length > 0) {
        setSelectedDatasetId(datasets[0].id)
        setInputShape(datasets[0].input_shape)
        setOutputDim(datasets[0].metadata.output_dim || 1)
        setOutputActivation(datasets[0].metadata.output_activation || 'sigmoid')
      }
    }).catch(() => {})

    api.getProjectArchitectures(currentProject.id).then(setSavedArchitectures).catch(() => {})
  }, [currentProject])

  function handleDatasetBindingChange(dsId: string) {
    setSelectedDatasetId(dsId)
    const ds = projectDatasets.find(d => d.id === dsId)
    if (ds) {
      setInputShape(ds.input_shape)
      setOutputDim(ds.metadata.output_dim || 1)
      setOutputActivation(ds.metadata.output_activation || 'sigmoid')
      toast.info(
        'Dimensiones sincronizadas',
        `${ds.name}: ${ds.input_shape} entradas → ${ds.metadata.output_dim || 1} salidas (${ds.metadata.output_activation || 'sigmoid'})`
      )
    }
  }

  const activeDataset = projectDatasets.find(d => d.id === selectedDatasetId) ?? null
  const trainRows =
    activeDataset?.splits?.train_count ??
    activeDataset?.metadata?.splits?.train_count ??
    Math.round((activeDataset?.metadata?.total_rows ?? 0) * 0.7)

  const { total: totalParams, breakdown } = computeArchitectureParams(layersList, inputShape, outputDim, family)
  const recommended = recommendOptimalArchitecture(activeDataset, inputShape, outputDim, outputActivation)
  const health = evaluateArchitectureHealth(layersList, inputShape, outputDim, totalParams, trainRows)
  const isOptimalApplied = areLayersEquivalent(layersList, recommended.layers)

  function buildDefaultLayer(type: LayerSpec['type']): LayerSpec {
    if (type === 'Dense') return { id: createLayerId(), type: 'Dense', units: 32, activation: 'relu', use_bias: true }
    if (type === 'Dropout') return { id: createLayerId(), type: 'Dropout', rate: 0.2 }
    if (type === 'Conv1D') return { id: createLayerId(), type: 'Conv1D', filters: 32, kernel_size: 3, padding: 'same', activation: 'relu', use_bias: true }
    if (type === 'MaxPooling1D') return { id: createLayerId(), type: 'MaxPooling1D', pool_size: 2 }
    if (type === 'Flatten') return { id: createLayerId(), type: 'Flatten' }
    if (type === 'LSTM') return { id: createLayerId(), type: 'LSTM', units: 32, activation: 'tanh' }
    if (type === 'GRU') return { id: createLayerId(), type: 'GRU', units: 32, activation: 'tanh' }
    return { id: createLayerId(), type: 'BatchNormalization' }
  }

  function addLayer(type: LayerSpec['type']) {
    const newL = buildDefaultLayer(type)
    setLayersList(prev => [...prev, newL])
    setSelectedIdx(layersList.length)
  }

  function insertLayerAt(index: number, type: 'Dense' | 'Dropout' | 'BatchNormalization') {
    const newL = buildDefaultLayer(type)
    setLayersList(prev => {
      const next = [...prev]
      next.splice(index, 0, newL)
      return next
    })
    setSelectedIdx(index)
  }

  function handleAutoOptimize() {
    const freshLayers = recommended.layers.map(l => ({ ...l, id: createLayerId() }))
    setLayersList(freshLayers)
    setSelectedIdx(0)
    setArchName(recommended.name)
    setFamily(recommended.family)
    setJustification(recommended.justification)
    setActiveView('canvas')
    toast.success('Arquitectura óptima aplicada', recommended.summary)
  }

  function removeLayer(idx: number) {
    setLayersList(prev => prev.filter((_, i) => i !== idx))
    if (selectedIdx === idx) setSelectedIdx(null)
    else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1)
  }

  function moveLayer(idx: number, direction: -1 | 1) {
    const targetIdx = idx + direction
    if (targetIdx < 0 || targetIdx >= layersList.length) return
    setLayersList(prev => {
      const next = [...prev]
      const temp = next[idx]
      next[idx] = next[targetIdx]
      next[targetIdx] = temp
      return next
    })
    if (selectedIdx === idx) setSelectedIdx(targetIdx)
    else if (selectedIdx === targetIdx) setSelectedIdx(idx)
  }

  function duplicateLayer(idx: number) {
    const source = layersList[idx]
    if (!source) return
    const clone: LayerSpec = { ...source, id: createLayerId() }
    setLayersList(prev => {
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      return next
    })
    setSelectedIdx(idx + 1)
  }

  function loadSavedArchitecture(arch: Architecture) {
    const loadedLayers = (arch.config?.layers || []).map(l => ({ ...l, id: createLayerId() }))
    setLayersList(loadedLayers)
    setArchName(arch.name)
    setFamily(arch.family)
    setJustification(arch.justification || '')
    setSelectedIdx(loadedLayers.length > 0 ? 0 : null)
    toast.info('Arquitectura cargada', `${arch.name} (v${arch.version})`)
  }

  function isPresetActive(preset: ArchitecturePreset): boolean {
    if (preset.layers.length !== layersList.length) return false
    return preset.layers.every((pl, i) => {
      const cl = layersList[i]
      return (
        cl &&
        cl.type === pl.type &&
        cl.units === pl.units &&
        cl.rate === pl.rate &&
        cl.activation === pl.activation
      )
    })
  }

  function applyPreset(preset: ArchitecturePreset) {
    setFamily(preset.family)
    setLayersList(preset.layers.map(l => ({ ...l, id: createLayerId() })))
    setSelectedIdx(0)
    setArchName(preset.name)
    setJustification(preset.desc)
    toast.info('Plantilla aplicada', `${preset.family}: ${preset.name}`)
  }

  async function handleSaveArchitecture(goToTraining: boolean) {
    if (!currentProject) return
    if (!archName.trim()) {
      toast.warning('Nombre requerido', 'Por favor asigna un nombre a la arquitectura.')
      return
    }
    if (layersList.length === 0) {
      toast.warning('Red vacía', 'Añade al menos una capa oculta a la red.')
      return
    }

    setSaving(true)
    try {
      const created = await api.createArchitecture(currentProject.id, {
        name: archName.trim(),
        family,
        justification: justification.trim(),
        input_shape: inputShape,
        output_dim: outputDim,
        output_activation: outputActivation,
        layers: layersList,
        actor_id: 'usr-engineer',
      })
      setSavedArchitectures(prev => [created, ...prev])
      setShowSaveModal(false)
      if (goToTraining && onNavigate) {
        toast.success(
          'Arquitectura guardada',
          `Avanzando al Paso 04: Entrenamiento (${created.name} · ${totalParams.toLocaleString()} parámetros)`
        )
        setTimeout(() => onNavigate('training'), 350)
      } else {
        toast.success(
          'Arquitectura guardada',
          `${created.name} · ${totalParams.toLocaleString()} parámetros`
        )
      }
    } catch (e: any) {
      toast.error('Error al guardar arquitectura', e.message || 'No se pudo registrar la topología')
    } finally {
      setSaving(false)
    }
  }

  const generatedPythonCode = buildKerasPythonCode(inputShape, layersList, outputDim, outputActivation, family)

  function copyCode() {
    navigator.clipboard.writeText(generatedPythonCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
    toast.success('Código Keras copiado', 'Listo para pegar en tu script de Python')
  }

  const selectedLayer = selectedIdx !== null ? layersList[selectedIdx] : null
  const selectedBreakdown = selectedIdx !== null ? (breakdown[selectedIdx] ?? null) : null
  const selectedLayerReason =
    isOptimalApplied && selectedIdx !== null
      ? (recommended.layerReasons.find(r => r.layerIndex === selectedIdx) ?? null)
      : null
  const memoryKb = ((totalParams * 4) / 1024).toFixed(1)

  return (
    <div className="flex-1 flex flex-col gap-2.5 min-h-0">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-3.5 py-2 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {projectDatasets.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-950/75 px-3 py-1.5 rounded-xl border border-slate-800">
              <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="min-w-[195px] max-w-[260px]">
                <SystemSelect
                  value={selectedDatasetId}
                  onChange={handleDatasetBindingChange}
                  size="xs"
                  searchable
                  searchPlaceholder="Buscar dataset o target..."
                  maxVisibleOptions={25}
                  ariaLabel="Dataset de referencia"
                  options={projectDatasets.map(d => ({
                    value: d.id,
                    label: `${d.name} (${d.input_shape} features → ${d.target})`,
                    keywords: `${d.target} v${d.version}`,
                  }))}
                />
              </div>
            </div>
          )}

          <span className="px-2.5 py-1 rounded-full bg-slate-950/75 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-nowrap">
            <strong className="text-cyan-400">{inputShape}D → {outputDim}D</strong> · {totalParams.toLocaleString()} p · {memoryKb} KB
          </span>

          <div className="w-[140px]">
            <SystemSelect
              value={family}
              onChange={val => setFamily(val as 'Feedforward' | 'RNN' | 'CNN' | 'GAN')}
              size="xs"
              ariaLabel="Familia de Red"
              options={[
                { value: 'Feedforward', label: 'Feedforward' },
                { value: 'CNN', label: 'CNN (Conv1D)' },
                { value: 'RNN', label: 'RNN (LSTM/GRU)' },
                { value: 'GAN', label: 'GAN (Adversarial)' },
              ]}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowArchiveModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950/75 hover:border-cyan-500/40 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Archivo</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 border border-slate-800 text-cyan-300">
              {savedArchitectures.length}
            </span>
          </button>
        </div>

        <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveView('canvas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeView === 'canvas'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Estudio Visual
          </button>
          <button
            type="button"
            onClick={() => setActiveView('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeView === 'table'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Tensores
          </button>
          <button
            type="button"
            onClick={() => setActiveView('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeView === 'code'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Python Keras
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SystemTooltip
            title={`Recomendada: ${recommended.name}`}
            label={`${recommended.signals.candidatesEvaluated} topologías evaluadas (${recommended.tierLabel}) · ${recommended.summary}`}
            side="bottom"
          >
            <button
              type="button"
              onClick={handleAutoOptimize}
              className={`nl-btn-shimmer flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
                isOptimalApplied
                  ? 'bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 shadow-sm shadow-emerald-500/10'
                  : 'bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 shadow-md shadow-cyan-500/25'
              }`}
            >
              {isOptimalApplied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span>{isOptimalApplied ? 'Óptima Aplicada' : 'Auto-Diseño Óptimo'}</span>
            </button>
          </SystemTooltip>

          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/25 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[224px_minmax(0,1fr)_264px] xl:grid-cols-[234px_minmax(0,1fr)_274px] gap-3 items-stretch flex-1 min-h-0">
        <ArchitectureCatalogPanel
          onAddLayer={addLayer}
          archName={archName}
          family={family}
          layerCount={layersList.length}
          inputShape={inputShape}
          outputDim={outputDim}
          totalParams={totalParams}
          presets={ARCHITECTURE_PRESETS}
          onApplyPreset={applyPreset}
          isPresetActive={isPresetActive}
          onClearLayers={() => {
            setLayersList([])
            setSelectedIdx(null)
          }}
        />

        <ArchitectureViews
          activeView={activeView}
          inputShape={inputShape}
          outputDim={outputDim}
          outputActivation={outputActivation}
          targetColumn={activeDataset?.target || 'Objetivo'}
          scalerApplied={activeDataset?.metadata?.scaler_applied || 'StandardScaler'}
          layersList={layersList}
          selectedIdx={selectedIdx}
          onSelectLayer={setSelectedIdx}
          onRemoveLayer={removeLayer}
          onMoveLayer={moveLayer}
          onDuplicateLayer={duplicateLayer}
          onInsertLayerAt={insertLayerAt}
          recommended={recommended}
          isOptimalApplied={isOptimalApplied}
          health={health}
          breakdown={breakdown}
          totalParams={totalParams}
          generatedPythonCode={generatedPythonCode}
          copiedCode={copiedCode}
          onCopyCode={copyCode}
          onOpenInsights={setInsightsModalTab}
        />

        <LayerPropertiesPanel
          selectedLayer={selectedLayer}
          selectedIdx={selectedIdx}
          selectedBreakdown={selectedBreakdown}
          selectedLayerReason={selectedLayerReason}
          totalParams={totalParams}
          inputShape={inputShape}
          outputDim={outputDim}
          outputActivation={outputActivation}
          suggestedLoss={activeDataset?.metadata?.suggested_loss}
          scalerApplied={activeDataset?.metadata?.scaler_applied}
          layersCount={layersList.length}
          onUpdateLayer={patch => {
            if (selectedIdx === null) return
            setLayersList(prev => prev.map((l, i) => (i === selectedIdx ? { ...l, ...patch } : l)))
          }}
          onMoveLayer={moveLayer}
          onDuplicateLayer={duplicateLayer}
          onRemoveLayer={removeLayer}
        />
      </div>

      {showSaveModal && (
        <SaveArchitectureModal
          archName={archName}
          onChangeArchName={setArchName}
          family={family}
          onChangeFamily={setFamily}
          justification={justification}
          onChangeJustification={setJustification}
          layersList={layersList}
          inputShape={inputShape}
          outputDim={outputDim}
          outputActivation={outputActivation}
          totalParams={totalParams}
          health={health}
          saving={saving}
          canNavigateToTraining={Boolean(onNavigate)}
          onSave={handleSaveArchitecture}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {showArchiveModal && (
        <SavedArchitecturesModal
          architectures={savedArchitectures}
          onLoad={loadSavedArchitecture}
          onClose={() => setShowArchiveModal(false)}
        />
      )}

      {insightsModalTab !== null && (
        <ArchitectureInsightsModal
          isOpen
          initialTab={insightsModalTab}
          onClose={() => setInsightsModalTab(null)}
          recommended={recommended}
          isOptimalApplied={isOptimalApplied}
          onApplyRecommended={() => {
            handleAutoOptimize()
            setInsightsModalTab(null)
          }}
          health={health}
          breakdown={breakdown}
          totalParams={totalParams}
          inputShape={inputShape}
          outputDim={outputDim}
          outputActivation={outputActivation}
          targetColumn={activeDataset?.target || 'Objetivo'}
          scalerApplied={activeDataset?.metadata?.scaler_applied || 'StandardScaler'}
          layersList={layersList}
          selectedIdx={selectedIdx}
          onSelectLayer={setSelectedIdx}
        />
      )}
    </div>
  )
}
