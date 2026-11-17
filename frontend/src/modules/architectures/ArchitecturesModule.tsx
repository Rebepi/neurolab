import { useState, useEffect } from 'react'
import {
  Network,
  Code,
  Layers,
  CheckCircle2,
  Sparkles,
  Save,
  RefreshCw,
} from 'lucide-react'
import { api } from '../../services/api'
import type { LayerSpec, Architecture } from '../../types/index'
import { InfoTip } from '../../components/InfoTip'
import { ARCHITECTURE_PRESETS, type ArchitecturePreset } from './constants'
import { buildKerasPythonCode, computeArchitectureParams, createLayerId } from './utils'
import { ArchitectureCatalogPanel } from './components/ArchitectureCatalogPanel'
import { ArchitectureViews } from './components/ArchitectureViews'
import { LayerPropertiesPanel } from './components/LayerPropertiesPanel'
import { useToast } from '../../components/toast/ToastContext'

export default function ArchitecturesModule({ currentProject }: { currentProject: any }) {
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
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeView, setActiveView] = useState<'canvas' | 'table' | 'code'>('canvas')
  const [copiedCode, setCopiedCode] = useState(false)

  useEffect(() => {
    if (!currentProject) return
    api.getProjectDatasets(currentProject.id).then(datasets => {
      if (datasets.length > 0) {
        setInputShape(datasets[0].input_shape)
        setOutputDim(datasets[0].metadata.output_dim || 1)
        setOutputActivation(datasets[0].metadata.output_activation || 'sigmoid')
      }
    }).catch(() => {})

    api.getProjectArchitectures(currentProject.id).then(setSavedArchitectures).catch(() => {})
  }, [currentProject])

  const { total: totalParams, breakdown } = computeArchitectureParams(layersList, inputShape, outputDim)

  function addLayer(type: 'Dense' | 'Dropout' | 'BatchNormalization') {
    let newL: LayerSpec
    if (type === 'Dense') newL = { id: createLayerId(), type: 'Dense', units: 32, activation: 'relu', use_bias: true }
    else if (type === 'Dropout') newL = { id: createLayerId(), type: 'Dropout', rate: 0.2 }
    else newL = { id: createLayerId(), type: 'BatchNormalization' }

    setLayersList(prev => [...prev, newL])
    setSelectedIdx(layersList.length)
  }

  function removeLayer(idx: number) {
    setLayersList(prev => prev.filter((_, i) => i !== idx))
    if (selectedIdx === idx) setSelectedIdx(null)
    else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1)
  }

  function applyPreset(preset: ArchitecturePreset) {
    setLayersList(preset.layers.map(l => ({ ...l, id: createLayerId() })))
    setSelectedIdx(0)
    setArchName(preset.name)
    setJustification(preset.desc)
    toast.info('Plantilla aplicada', preset.name)
  }

  async function handleSaveArchitecture() {
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
        name: archName,
        family,
        justification,
        input_shape: inputShape,
        output_dim: outputDim,
        output_activation: outputActivation,
        layers: layersList,
        actor_id: 'usr-engineer',
      })
      setSavedArchitectures(prev => [created, ...prev])
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
      toast.success('Arquitectura guardada', `${created.name} · ${totalParams.toLocaleString()} parámetros`)
    } catch (e: any) {
      toast.error('Error al guardar arquitectura', e.message || 'No se pudo registrar la topología')
    } finally {
      setSaving(false)
    }
  }

  const generatedPythonCode = buildKerasPythonCode(inputShape, layersList, outputDim, outputActivation)

  function copyCode() {
    navigator.clipboard.writeText(generatedPythonCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
    toast.success('Código Keras copiado', 'Listo para pegar en tu script de Python')
  }

  const selectedLayer = selectedIdx !== null ? layersList[selectedIdx] : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/50">
            <button
              onClick={() => setActiveView('canvas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeView === 'canvas' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Lienzo Gráfico
            </button>
            <button
              onClick={() => setActiveView('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeView === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Desglose de Tensores
            </button>
            <button
              onClick={() => setActiveView('code')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeView === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Python Keras
            </button>
          </div>

          <button
            onClick={handleSaveArchitecture}
            disabled={saving}
            className="nl-btn-shimmer flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            ) : (
              <Save className="w-4 h-4" />
            )}
          {saveSuccess ? 'Guardado' : 'Guardar Arquitectura'}
        </button>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Plantillas Preconfiguradas (Presets):</span>
          <InfoTip
            title="Plantillas Preconfiguradas"
            text="Topologías listas para usar según la complejidad del problema: desde redes compactas hasta redes profundas con regularización."
            size="xs"
          />
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ARCHITECTURE_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(preset)}
              style={{ animationDelay: `${idx * 60}ms` }}
              className="nl-card-interactive animate-card-reveal text-left p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/40 transition-all group"
            >
              <p className="text-white text-xs font-bold group-hover:text-indigo-300 transition-colors">{preset.name}</p>
              <p className="text-slate-400 text-[11px] mt-1 line-clamp-2">{preset.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ArchitectureCatalogPanel
          onAddLayer={addLayer}
          archName={archName}
          onChangeArchName={setArchName}
          family={family}
          onChangeFamily={setFamily}
          inputShape={inputShape}
          outputDim={outputDim}
          totalParams={totalParams}
        />

        <ArchitectureViews
          activeView={activeView}
          inputShape={inputShape}
          outputDim={outputDim}
          outputActivation={outputActivation}
          layersList={layersList}
          selectedIdx={selectedIdx}
          onSelectLayer={setSelectedIdx}
          onRemoveLayer={removeLayer}
          breakdown={breakdown}
          totalParams={totalParams}
          generatedPythonCode={generatedPythonCode}
          copiedCode={copiedCode}
          onCopyCode={copyCode}
        />

        <LayerPropertiesPanel
          selectedLayer={selectedLayer}
          onUpdateLayer={patch => {
            if (selectedIdx === null) return
            setLayersList(prev => prev.map((l, i) => (i === selectedIdx ? { ...l, ...patch } : l)))
          }}
          savedArchitectures={savedArchitectures}
        />
      </div>
    </div>
  )
}
