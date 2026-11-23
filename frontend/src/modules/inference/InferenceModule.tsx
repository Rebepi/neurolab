import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Clock,
  Cpu,
  Play,
  Radar,
  RotateCw,
  ShieldCheck,
  Shuffle,
  Sliders,
  Sparkles,
  TrendingDown,
  Wand2,
  Zap,
} from 'lucide-react'
import { api } from '../../services/api'
import type {
  BatchPredictionItem,
  BatchPredictionResponse,
  ColumnSummary,
  LayerTrace,
  ModelVersion,
  PredictionResponse,
} from '../../types/index'
import { InfoTip } from '../../components/InfoTip'
import { ModuleStudioHero } from '../../components/ModuleStudioHero'
import { SystemSelect } from '../../components/SystemSelect'
import { useToast } from '../../components/toast/ToastContext'
import { InferenceBatchRadarModal } from './components/InferenceBatchRadarModal'
import { InferenceHistoryModal, type InferenceHistoryEntry } from './components/InferenceHistoryModal'
import { InferenceVariablesModal } from './components/InferenceVariablesModal'
import { TelecomTwin3DCanvas, type EnterpriseAreaKind } from './components/TelecomTwin3DCanvas'

interface CounterfactualResult {
  actionLabel: string
  beforeText: string
  afterText: string
  deltaText: string
  improved: boolean
  latencyMs: number
}

function detectAreaKind(projectId?: string, targetCol?: string): EnterpriseAreaKind {
  const pid = (projectId || '').toLowerCase()
  const tgt = (targetCol || '').toLowerCase()
  if (pid.includes('general') || tgt.includes('alerta_corporativa')) return 'general'
  if (pid.includes('noc') || tgt.includes('estado_nodo')) return 'noc'
  if (pid.includes('antifraude') || tgt.includes('fraude')) return 'antifraude'
  if (pid.includes('comercial') || tgt.includes('valor_anual')) return 'comercial'
  return 'retencion'
}

export default function InferenceModule({
  currentProject,
  onNavigate,
}: {
  currentProject: any
  onNavigate?: (module: string) => void
  onSelectProject?: (p: any) => void
}) {
  const toast = useToast()
  const [models, setModels] = useState<ModelVersion[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelVersion | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [features, setFeatures] = useState<Record<string, any>>({})
  const [sampleIdx, setSampleIdx] = useState(0)

  const [inferring, setInferring] = useState(false)
  const [animStage, setAnimStage] = useState<number>(-1)
  const [phaseText, setPhaseText] = useState<string>('Grafo neuronal sincronizado · Listo para inferencia Keras')
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [displayedProb, setDisplayedProb] = useState<number>(0)
  const [history, setHistory] = useState<InferenceHistoryEntry[]>([])
  const [autoLoop, setAutoLoop] = useState(false)

  const [runningWhatIf, setRunningWhatIf] = useState<string | null>(null)
  const [counterfactual, setCounterfactual] = useState<CounterfactualResult | null>(null)

  const [scanningBatch, setScanningBatch] = useState(false)
  const [batchOffset, setBatchOffset] = useState(0)
  const [batchData, setBatchData] = useState<BatchPredictionResponse | null>(null)

  const [showVarsModal, setShowVarsModal] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const timersRef = useRef<number[]>([])

  const clearTimers = () => {
    timersRef.current.forEach(t => window.clearTimeout(t))
    timersRef.current = []
  }

  useEffect(() => {
    return () => clearTimers()
  }, [])

  useEffect(() => {
    if (!currentProject) return
    setLoadingModels(true)
    api
      .getProjectModels(currentProject.id)
      .then(ms => {
        setModels(ms)
        if (ms.length > 0) {
          setSelectedModel(ms[0])
        } else {
          setSelectedModel(null)
        }
      })
      .catch(e => toast.error('Error al cargar modelos', e.message))
      .finally(() => setLoadingModels(false))
  }, [currentProject?.id])

  const eda = selectedModel?.dataset_metadata
  const inputColumns: ColumnSummary[] = (eda?.columns_summary || []).filter(
    c => !c.is_target && !c.excluded_reason
  )
  const previewRows = eda?.preview || []
  const targetCol = selectedModel?.target_column || eda?.target_column || 'fuga'
  const areaKind = detectAreaKind(currentProject?.id, targetCol)

  const visualLayers: LayerTrace[] = (() => {
    if (result?.layer_traces && result.layer_traces.length > 0) {
      return result.layer_traces
    }
    const archLayers = selectedModel?.architecture_config?.layers || [
      { type: 'Dense', units: 64, activation: 'relu' },
      { type: 'Dense', units: 32, activation: 'relu' },
      { type: 'Dense', units: 16, activation: 'relu' },
    ]
    const inUnits = eda?.input_shape || inputColumns.length || 12
    const outUnits = eda?.output_dim || 1
    const outAct = eda?.output_activation || 'sigmoid'

    const list: LayerTrace[] = [
      {
        name: 'Capa de Entrada',
        type: 'Input',
        units: inUnits,
        activation: 'z-score',
        neurons: Array.from({ length: Math.min(8, inUnits) }, (_, i) => 0.35 + ((i * 19) % 50) / 100),
        mean_activation: 0.48,
        max_activation: 0.92,
        active_ratio: 1,
      },
    ]
    archLayers.forEach((l, idx) => {
      const u = l.units || 16
      list.push({
        name: `Capa ${idx + 1} (${l.type})`,
        type: l.type,
        units: u,
        activation: l.activation || (l.type === 'Dropout' ? `rate ${l.rate ?? 0.2}` : 'norm'),
        neurons: Array.from({ length: Math.min(8, u) }, (_, i) => 0.3 + ((i * 23 + idx * 13) % 65) / 100),
        mean_activation: 0.52,
        max_activation: 0.88,
        active_ratio: 0.85,
      })
    })
    list.push({
      name: 'Capa de Salida',
      type: 'Output',
      units: outUnits,
      activation: outAct,
      neurons: Array.from({ length: Math.min(6, outUnits) }, () => 0.75),
      mean_activation: 0.75,
      max_activation: 0.75,
      active_ratio: 1,
    })
    return list
  })()

  function buildDefaultFeatures(): Record<string, any> {
    const initial: Record<string, any> = {}
    for (const col of inputColumns) {
      if (col.dtype === 'numeric') {
        initial[col.name] = Number((col.mean ?? 0).toFixed(2))
      } else {
        const cats = Object.keys(col.top_values || {})
        initial[col.name] = cats[0] || ''
      }
    }
    return initial
  }

  useEffect(() => {
    if (!selectedModel) return
    clearTimers()
    setResult(null)
    setCounterfactual(null)
    setBatchData(null)
    setBatchOffset(0)
    setAnimStage(-1)
    setDisplayedProb(0)
    setSampleIdx(0)

    const initial = buildDefaultFeatures()
    const row0 = previewRows[0]
    if (row0) {
      for (const col of inputColumns) {
        if (row0[col.name] !== undefined && row0[col.name] !== null) {
          initial[col.name] = row0[col.name]
        }
      }
    }
    setFeatures(initial)
  }, [selectedModel?.id])

  useEffect(() => {
    if (!result || result.probability === null) {
      setDisplayedProb(0)
      return
    }
    const targetPct = result.probability * 100
    let frameId: number
    const start = performance.now()
    const duration = 620

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayedProb(targetPct * eased)
      if (t < 1) {
        frameId = requestAnimationFrame(step)
      }
    }
    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [result])

  function loadSampleRow(customIdx?: number) {
    if (previewRows.length === 0) return features
    const nextIdx = customIdx !== undefined ? customIdx : (sampleIdx + 1) % previewRows.length
    setSampleIdx(nextIdx)
    const row = previewRows[nextIdx]
    const nextFeatures: Record<string, any> = { ...features }
    for (const col of inputColumns) {
      if (row[col.name] !== undefined && row[col.name] !== null) {
        nextFeatures[col.name] = row[col.name]
      }
    }
    setFeatures(nextFeatures)
    setCounterfactual(null)
    return nextFeatures
  }

  function applyAreaPreset(slot: 'safe' | 'critical' | 'stress') {
    const next = { ...features }
    const setKey = (k: string, v: any) => {
      if (inputColumns.some(c => c.name === k)) next[k] = v
    }

    if (areaKind === 'retencion') {
      if (slot === 'safe') {
        setKey('meses_antiguedad', 64)
        setKey('cargo_mensual', 54.9)
        setKey('llamadas_soporte', 0)
        setKey('atrasos_pago', 0)
        setKey('puntaje_satisfaccion', 9.4)
        setKey('latencia_promedio_ms', 14.2)
        setKey('perdida_paquetes_pct', 0.05)
        setKey('dispositivos_conectados', 6)
        setKey('tipo_contrato', 'Dos anios')
        setKey('servicio_internet', 'Fibra Optica')
        setKey('soporte_tecnico', 'Si')
      } else if (slot === 'critical') {
        setKey('meses_antiguedad', 3)
        setKey('cargo_mensual', 134.5)
        setKey('llamadas_soporte', 6)
        setKey('atrasos_pago', 3)
        setKey('puntaje_satisfaccion', 2.8)
        setKey('latencia_promedio_ms', 68.5)
        setKey('perdida_paquetes_pct', 3.8)
        setKey('dispositivos_conectados', 2)
        setKey('tipo_contrato', 'Mes a mes')
        setKey('servicio_internet', 'ADSL')
        setKey('soporte_tecnico', 'No')
      } else {
        setKey('meses_antiguedad', 14)
        setKey('cargo_mensual', 96.0)
        setKey('llamadas_soporte', 4)
        setKey('atrasos_pago', 1)
        setKey('puntaje_satisfaccion', 4.2)
        setKey('latencia_promedio_ms', 94.0)
        setKey('perdida_paquetes_pct', 5.4)
        setKey('dispositivos_conectados', 8)
        setKey('tipo_contrato', 'Mes a mes')
        setKey('servicio_internet', 'Inalambrico 5G')
        setKey('soporte_tecnico', 'No')
      }
    } else if (areaKind === 'noc') {
      if (slot === 'safe') {
        setKey('temperatura_equipo_c', 36.5)
        setKey('uso_cpu_pct', 34.0)
        setKey('uso_memoria_pct', 42.0)
        setKey('potencia_optica_dbm', -12.5)
        setKey('errores_crc_hora', 0)
        setKey('reinicios_ultimos_7d', 0)
        setKey('voltaje_fuente_v', 48.0)
        setKey('respaldo_energia', 'UPS + Generador')
      } else if (slot === 'critical') {
        setKey('temperatura_equipo_c', 84.0)
        setKey('uso_cpu_pct', 95.0)
        setKey('uso_memoria_pct', 91.0)
        setKey('potencia_optica_dbm', -29.5)
        setKey('errores_crc_hora', 14)
        setKey('reinicios_ultimos_7d', 4)
        setKey('voltaje_fuente_v', 42.5)
        setKey('respaldo_energia', 'Sin Respaldo')
      } else {
        setKey('temperatura_equipo_c', 61.0)
        setKey('uso_cpu_pct', 74.0)
        setKey('uso_memoria_pct', 72.0)
        setKey('potencia_optica_dbm', -22.8)
        setKey('errores_crc_hora', 5)
        setKey('reinicios_ultimos_7d', 1)
        setKey('voltaje_fuente_v', 46.2)
        setKey('respaldo_energia', 'Solo Baterias')
      }
    } else if (areaKind === 'antifraude') {
      if (slot === 'safe') {
        setKey('monto_operacion_usd', 38.0)
        setKey('hora_transaccion', 14)
        setKey('distancia_ult_ubicacion_km', 4.5)
        setKey('cambios_sim_30d', 0)
        setKey('intentos_fallidos_pin', 0)
        setKey('llamadas_internacionales_24h', 0)
        setKey('edad_linea_meses', 48)
        setKey('pais_destino_riesgo', 'Bajo')
        setKey('dispositivo_nuevo', 'No')
        setKey('verificacion_biometrica', 'Si')
      } else if (slot === 'critical') {
        setKey('monto_operacion_usd', 1450.0)
        setKey('hora_transaccion', 3)
        setKey('distancia_ult_ubicacion_km', 2400.0)
        setKey('cambios_sim_30d', 3)
        setKey('intentos_fallidos_pin', 4)
        setKey('llamadas_internacionales_24h', 9)
        setKey('edad_linea_meses', 2)
        setKey('pais_destino_riesgo', 'Alto')
        setKey('dispositivo_nuevo', 'Si')
        setKey('verificacion_biometrica', 'No')
      } else {
        setKey('monto_operacion_usd', 420.0)
        setKey('hora_transaccion', 23)
        setKey('distancia_ult_ubicacion_km', 680.0)
        setKey('cambios_sim_30d', 1)
        setKey('intentos_fallidos_pin', 2)
        setKey('llamadas_internacionales_24h', 3)
        setKey('pais_destino_riesgo', 'Medio')
        setKey('dispositivo_nuevo', 'Si')
        setKey('verificacion_biometrica', 'No')
      }
    } else if (areaKind === 'general') {
      if (slot === 'safe') {
        setKey('area_corporativa', 'retencion')
        setKey('indice_magnitud_area', -0.45)
        setKey('indice_volatilidad_area', 0.42)
        setKey('indice_pico_maximo_area', 0.95)
      } else if (slot === 'critical') {
        setKey('area_corporativa', 'antifraude')
        setKey('indice_magnitud_area', 1.85)
        setKey('indice_volatilidad_area', 1.92)
        setKey('indice_pico_maximo_area', 3.45)
      } else {
        setKey('area_corporativa', 'red_noc')
        setKey('indice_magnitud_area', 0.95)
        setKey('indice_volatilidad_area', 1.38)
        setKey('indice_pico_maximo_area', 2.45)
      }
    } else {
      if (slot === 'safe') {
        setKey('gasto_mensual_usd', 210.0)
        setKey('servicios_activos', 5)
        setKey('antiguedad_meses', 72)
        setKey('puntaje_fidelidad', 95.0)
        setKey('upgrades_plan', 3)
        setKey('segmento_cliente', 'Corporativo')
        setKey('tipo_plan', 'Empresarial Dedicado')
      } else if (slot === 'critical') {
        setKey('gasto_mensual_usd', 28.0)
        setKey('servicios_activos', 1)
        setKey('antiguedad_meses', 4)
        setKey('puntaje_fidelidad', 35.0)
        setKey('upgrades_plan', 0)
        setKey('segmento_cliente', 'Residencial')
        setKey('tipo_plan', 'Basico')
      } else {
        setKey('gasto_mensual_usd', 115.0)
        setKey('servicios_activos', 3)
        setKey('antiguedad_meses', 36)
        setKey('puntaje_fidelidad', 78.0)
        setKey('upgrades_plan', 1)
        setKey('segmento_cliente', 'PYME')
        setKey('tipo_plan', 'Fibra Ultra')
      }
    }

    setFeatures(next)
    setCounterfactual(null)
    executeAnimatedInference(next)
  }

  async function executeAnimatedInference(overrideFeatures?: Record<string, any>) {
    if (!selectedModel || inferring) return
    clearTimers()
    const payload = overrideFeatures || features
    setInferring(true)
    setAnimStage(0)
    setPhaseText('Fase 1/3 · Escalando tensores de entrada (Z-Score) y activando capa L0...')

    try {
      const apiPromise = api.predictModel(selectedModel.id, payload)
      const totalLayers = visualLayers.length

      for (let i = 1; i < totalLayers; i++) {
        const delay = i * 125
        const t = window.setTimeout(() => {
          setAnimStage(i)
          if (i < totalLayers - 1) {
            setPhaseText(
              `Fase 2/3 · Propagando activaciones por ${visualLayers[i]?.name || `Capa Oculta L${i}`}...`
            )
          } else {
            setPhaseText(
              `Fase 3/3 · Evaluando capa de salida (${visualLayers[i]?.activation || 'sigmoid'})...`
            )
          }
        }, delay)
        timersRef.current.push(t)
      }

      const res = await apiPromise
      const finishDelay = totalLayers * 125
      const finishTimer = window.setTimeout(() => {
        setResult(res)
        setAnimStage(-1)
        setInferring(false)
        setPhaseText(`Decisión Keras en ${res.latency_ms} ms → ${res.predicted_label}`)

        const top3 = inputColumns
          .slice(0, 3)
          .map(c => `${c.name}=${payload[c.name]}`)
          .join(' · ')

        setHistory(prev => [
          {
            id: `inf-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            modelVersion: selectedModel.version,
            targetColumn: res.target_column,
            predictedLabel: res.predicted_label,
            probability: res.probability,
            latencyMs: res.latency_ms,
            summaryInputs: top3,
          },
          ...prev.slice(0, 29),
        ])
      }, finishDelay)
      timersRef.current.push(finishTimer)
    } catch (e: any) {
      setInferring(false)
      setAnimStage(-1)
      setPhaseText('Error durante la inferencia')
      toast.error('Error en inferencia', e.message || 'No se pudo ejecutar el modelo')
    }
  }

  async function runCounterfactual(actionId: string, actionLabel: string) {
    if (!selectedModel || !result) return
    setRunningWhatIf(actionId)
    const modified = { ...features }
    const setKey = (k: string, fn: (curr: any) => any) => {
      if (inputColumns.some(c => c.name === k)) modified[k] = fn(modified[k])
    }

    if (areaKind === 'retencion') {
      if (actionId === 'a1') {
        setKey('tipo_contrato', () => 'Un anio')
        setKey('soporte_tecnico', () => 'Si')
        setKey('llamadas_soporte', v => Math.max(0, Number(v || 0) - 2))
      } else if (actionId === 'a2') {
        setKey('cargo_mensual', v => Number((Number(v || 80) * 0.78).toFixed(2)))
        setKey('atrasos_pago', () => 0)
      } else {
        setKey('servicio_internet', () => 'Fibra Optica')
        setKey('latencia_promedio_ms', () => 14.5)
        setKey('perdida_paquetes_pct', () => 0.08)
        setKey('puntaje_satisfaccion', () => 9.1)
      }
    } else if (areaKind === 'noc') {
      if (actionId === 'a1') {
        setKey('temperatura_equipo_c', () => 39.0)
        setKey('humedad_gabinete_pct', () => 44.0)
      } else if (actionId === 'a2') {
        setKey('uso_cpu_pct', () => 42.0)
        setKey('uso_memoria_pct', () => 48.0)
        setKey('carga_trafico_gbps', v => Number((Number(v || 60) * 0.65).toFixed(1)))
      } else {
        setKey('potencia_optica_dbm', () => -13.0)
        setKey('errores_crc_hora', () => 0)
        setKey('reinicios_ultimos_7d', () => 0)
      }
    } else if (areaKind === 'antifraude') {
      if (actionId === 'a1') {
        setKey('verificacion_biometrica', () => 'Si')
        setKey('intentos_fallidos_pin', () => 0)
      } else if (actionId === 'a2') {
        setKey('cambios_sim_30d', () => 0)
        setKey('dispositivo_nuevo', () => 'No')
      } else {
        setKey('pais_destino_riesgo', () => 'Bajo')
        setKey('distancia_ult_ubicacion_km', () => 12.0)
      }
    } else if (areaKind === 'general') {
      if (actionId === 'a1') {
        setKey('indice_magnitud_area', v => Number((Number(v || 0.5) * 0.45).toFixed(2)))
      } else if (actionId === 'a2') {
        setKey('indice_pico_maximo_area', () => 0.85)
      } else {
        setKey('indice_volatilidad_area', () => 0.35)
        setKey('indice_magnitud_area', () => -0.3)
      }
    } else {
      if (actionId === 'a1') {
        setKey('servicios_activos', v => Math.min(5, Number(v || 2) + 2))
        setKey('upgrades_plan', v => Number(v || 0) + 1)
      } else if (actionId === 'a2') {
        setKey('tipo_plan', () => 'Empresarial Dedicado')
        setKey('gasto_mensual_usd', v => Number((Number(v || 80) * 1.35).toFixed(2)))
      } else {
        setKey('puntaje_fidelidad', () => 94.0)
        setKey('referidos_exitosos', v => Number(v || 0) + 2)
      }
    }

    try {
      const afterRes = await api.predictModel(selectedModel.id, modified)
      let beforeText = ''
      let afterText = ''
      let deltaText = ''
      let improved = true

      if (areaKind === 'comercial' && result.probability === null) {
        const bVal = Number(result.prediction)
        const aVal = Number(afterRes.prediction)
        const diff = aVal - bVal
        beforeText = `$${bVal.toFixed(0)} USD`
        afterText = `$${aVal.toFixed(0)} USD`
        deltaText = `${diff >= 0 ? '+' : ''}$${diff.toFixed(0)}`
        improved = diff >= 0
      } else {
        const bP = (result.probability ?? 0) * 100
        const aP = (afterRes.probability ?? 0) * 100
        const diff = aP - bP
        beforeText = `${bP.toFixed(1)}%`
        afterText = `${aP.toFixed(1)}%`
        deltaText = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`
        improved = areaKind === 'noc' ? afterRes.prediction === 'Operativo' || diff <= 0 : diff <= 0
      }

      setCounterfactual({
        actionLabel,
        beforeText,
        afterText,
        deltaText,
        improved,
        latencyMs: afterRes.latency_ms,
      })
      setFeatures(modified)
      setResult(afterRes)
      setPhaseText(`Intervención ejecutada en Keras (${afterRes.latency_ms} ms): ${beforeText} → ${afterText}`)
      toast.success('Simulación What-If real ejecutada', `${actionLabel}: ${beforeText} → ${afterText}`)
    } catch (e: any) {
      toast.error('Error en simulación What-If', e.message)
    } finally {
      setRunningWhatIf(null)
    }
  }

  async function handleRunBatchScan(nextOffset?: number) {
    if (!selectedModel) return
    const off = nextOffset !== undefined ? nextOffset : batchOffset
    setScanningBatch(true)
    try {
      const res = await api.predictModelBatch(selectedModel.id, 25, off)
      setBatchData(res)
      setBatchOffset(off + 25)
      toast.success(
        'Radar Batch Keras completado',
        `${res.total_scanned} registros reales evaluados en ${res.latency_ms} ms`
      )
    } catch (e: any) {
      toast.error('Error en escaneo batch', e.message || 'No se pudo evaluar el lote')
    } finally {
      setScanningBatch(false)
    }
  }

  function handleInspectBatchItem(item: BatchPredictionItem) {
    setFeatures(item.features)
    setCounterfactual(null)
    executeAnimatedInference(item.features)
    toast.info('Registro cargado en Gemelo 3D', `Fila #${item.row_index} sincronizada`)
  }

  useEffect(() => {
    if (!autoLoop || !selectedModel || previewRows.length === 0) return
    const interval = window.setInterval(() => {
      if (!inferring) {
        const nextIdx = (sampleIdx + 1) % previewRows.length
        const nextFeats = loadSampleRow(nextIdx)
        executeAnimatedInference(nextFeats)
      }
    }, 3400)
    return () => window.clearInterval(interval)
  }, [autoLoop, selectedModel?.id, sampleIdx, inferring])

  const presetLabels =
    areaKind === 'general'
      ? [
          {
            id: 'safe' as const,
            title: 'Corporativo Estable',
            sub: 'Magnitud -0.45 · Pico 0.95σ',
            cls: 'bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-500/30 text-emerald-300',
          },
          {
            id: 'critical' as const,
            title: 'Alerta Crítica 360°',
            sub: 'Magnitud 1.85 · Pico 3.45σ',
            cls: 'bg-rose-950/40 hover:bg-rose-900/40 border-rose-500/30 text-rose-300',
          },
          {
            id: 'stress' as const,
            title: 'Estrés Transversal NOC',
            sub: 'Volatilidad 1.38 · Pico 2.45σ',
            cls: 'bg-amber-950/40 hover:bg-amber-900/40 border-amber-500/30 text-amber-300',
          },
        ]
      : areaKind === 'noc'
        ? [
            {
              id: 'safe' as const,
              title: 'Nodo 5G Óptimo',
              sub: '36.5°C · -12.5 dBm · 0 CRC',
              cls: 'bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-500/30 text-emerald-300',
            },
            {
              id: 'critical' as const,
              title: 'Falla Crítica Térmica',
              sub: '84°C · 95% CPU · 14 CRC',
              cls: 'bg-rose-950/40 hover:bg-rose-900/40 border-rose-500/30 text-rose-300',
            },
            {
              id: 'stress' as const,
              title: 'Enlace Degradado',
              sub: '61°C · -22.8 dBm · Batería',
              cls: 'bg-amber-950/40 hover:bg-amber-900/40 border-amber-500/30 text-amber-300',
            },
          ]
        : areaKind === 'antifraude'
          ? [
              {
                id: 'safe' as const,
                title: 'Operación Legítima',
                sub: '$38 · 4.5km · Biometría OK',
                cls: 'bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-500/30 text-emerald-300',
              },
              {
                id: 'critical' as const,
                title: 'Ataque SIM-Swap',
                sub: '$1450 · 3AM · 3 cambios SIM',
                cls: 'bg-rose-950/40 hover:bg-rose-900/40 border-rose-500/30 text-rose-300',
              },
              {
                id: 'stress' as const,
                title: 'Roaming Sospechoso',
                sub: '$420 · 680km · Sin Biometría',
                cls: 'bg-amber-950/40 hover:bg-amber-900/40 border-amber-500/30 text-amber-300',
              },
            ]
          : areaKind === 'comercial'
            ? [
                {
                  id: 'safe' as const,
                  title: 'Cuenta Corporativa Top',
                  sub: '$210/mes · 5 serv. · 95 fid.',
                  cls: 'bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-500/30 text-emerald-300',
                },
                {
                  id: 'critical' as const,
                  title: 'Plan Básico Inicial',
                  sub: '$28/mes · 1 serv. · 4 meses',
                  cls: 'bg-rose-950/40 hover:bg-rose-900/40 border-rose-500/30 text-rose-300',
                },
                {
                  id: 'stress' as const,
                  title: 'PYME Fibra Ultra',
                  sub: '$115/mes · 3 serv. · 36m',
                  cls: 'bg-amber-950/40 hover:bg-amber-900/40 border-amber-500/30 text-amber-300',
                },
              ]
            : [
                {
                  id: 'safe' as const,
                  title: 'Cliente VIP Leal',
                  sub: 'Fibra · 2 años · 0 reclamos',
                  cls: 'bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-500/30 text-emerald-300',
                },
                {
                  id: 'critical' as const,
                  title: 'Riesgo Crítico Fuga',
                  sub: 'Mes a mes · 6 reclamos · Mora',
                  cls: 'bg-rose-950/40 hover:bg-rose-900/40 border-rose-500/30 text-rose-300',
                },
                {
                  id: 'stress' as const,
                  title: 'Falla Técnica Red',
                  sub: '5G · 94ms ping · 5.4% pérdida',
                  cls: 'bg-amber-950/40 hover:bg-amber-900/40 border-amber-500/30 text-amber-300',
                },
              ]

  const whatIfActions =
    areaKind === 'general'
      ? [
          { id: 'a1', label: 'Mitigar Magnitud Transversal (-55%)' },
          { id: 'a2', label: 'Contener Pico Máximo Corporativo (0.85σ)' },
          { id: 'a3', label: 'Estabilizar Volatilidad Multi-Área (0.35)' },
        ]
      : areaKind === 'noc'
        ? [
            { id: 'a1', label: 'Activar Climatización de Emergencia (39°C)' },
            { id: 'a2', label: 'Balancear Tráfico MPLS y Liberar CPU (42%)' },
            { id: 'a3', label: 'Conmutar Enlace Óptico Redundante (-13 dBm)' },
          ]
        : areaKind === 'antifraude'
          ? [
              { id: 'a1', label: 'Exigir Verificación Biométrica Facial en Vivo' },
              { id: 'a2', label: 'Validar IMSI Original y Bloquear SIM Nueva' },
              { id: 'a3', label: 'Restringir Roaming Internacional de Alto Riesgo' },
            ]
          : areaKind === 'comercial'
            ? [
                { id: 'a1', label: 'Paquete Cross-Sell (+2 Servicios Adicionales)' },
                { id: 'a2', label: 'Migrar a Plan Empresarial Dedicado (+35%)' },
                { id: 'a3', label: 'Programa de Fidelización + Referidos VIP' },
              ]
            : [
                { id: 'a1', label: 'Ofrecer Contrato Anual + Soporte Prioritario' },
                { id: 'a2', label: 'Aplicar Descuento Comercial (-22%)' },
                { id: 'a3', label: 'Migrar a Fibra Óptica + Optimizar Latencia' },
              ]

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-72 gap-3 text-slate-400">
        <Cpu className="w-12 h-12 text-slate-600" />
        <p className="text-base">Selecciona un área corporativa para abrir su Gemelo Digital 3D</p>
      </div>
    )
  }

  if (!loadingModels && models.length === 0) {
    return (
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
          <Cpu className="w-7 h-7 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-lg">
            Aún no hay modelos Keras entrenados en {currentProject.name}
          </h3>
          <p className="text-slate-400 text-xs mt-1 max-w-md">
            Entrena el dataset de esta área en el Paso 04 para generar su binario{' '}
            <code className="text-indigo-300">.keras</code> y operarlo aquí en su Gemelo Digital 3D.
          </p>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('training')}
            className="nl-btn-shimmer flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
          >
            <span>Ir al Paso 04: Entrenar Modelo de esta Área</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  const gaugeRadius = 42
  const gaugeCircumference = 2 * Math.PI * gaugeRadius
  const gaugeOffset =
    gaugeCircumference - (Math.min(100, Math.max(0, displayedProb)) / 100) * gaugeCircumference

  return (
    <div className="flex-1 flex flex-col gap-3.5 min-h-0">
      <ModuleStudioHero
        variant="twin5g"
        eyebrow="SIMULACIÓN 3D TELECOM · INFERENCIA EN VIVO .KERAS"
        title="Gemelo Digital 3D"
        highlight="& Uso Real"
        subtitle="Opera modelos reales TensorFlow/Keras por área corporativa con simulación What-If y escaneo masivo."
        icon={Cpu}
        liveBadge="TENSORFLOW / KERAS EN VIVO"
        tipTitle="Centro Operativo de Modelos Entrenados"
        tipText="Opera en vivo los modelos .keras entrenados junto al Gemelo Digital 3D, ejecuta escenarios rápidos, ajusta variables o lanza escaneos por lote."
        metrics={[
          { label: 'Modelos', value: models.length, tone: 'cyan' },
          { label: 'Variables', value: inputColumns.length, tone: 'teal' },
          { label: 'Objetivo', value: targetCol || '—', tone: 'violet' },
          { label: 'Predicciones', value: history.length, tone: 'emerald' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {models.length > 0 && selectedModel && (
              <div className="w-52">
                <SystemSelect
                  value={selectedModel.id}
                  onChange={id => {
                    const found = models.find(m => m.id === id)
                    if (found) setSelectedModel(found)
                  }}
                  size="xs"
                  searchable={models.length > 4}
                  searchPlaceholder="Buscar versión..."
                  maxVisibleOptions={25}
                  ariaLabel="Seleccionar Modelo Entrenado"
                  options={models.map(m => ({
                    value: m.id,
                    label: `Modelo ${m.version} · ${(m.test_metrics.test_accuracy * 100).toFixed(1)}% Acc`,
                    keywords: `${m.version} ${m.status}`,
                  }))}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowVarsModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Variables ({inputColumns.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowBatchModal(true)
                if (!batchData && !scanningBatch) {
                  handleRunBatchScan(0)
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 text-xs font-semibold transition-colors"
            >
              <Radar className="w-3.5 h-3.5 text-cyan-300" />
              <span>Radar Batch</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-300 text-xs font-semibold transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Bitácora ({history.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoLoop(a => !a)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                autoLoop
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/85 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${autoLoop ? 'animate-spin text-amber-400' : ''}`} />
              <span>{autoLoop ? 'Auto Activo' : 'Auto-Monitor'}</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0">
        <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
          <TelecomTwin3DCanvas
            areaKind={areaKind}
            features={features}
            visualLayers={visualLayers}
            animStage={animStage}
            inferring={inferring}
            result={result}
            phaseText={phaseText}
          />

          <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-3.5 relative overflow-hidden space-y-2.5">
            <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
              <div className="h-[2px] w-full bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-500" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Escenarios Rápidos &amp; Disparo Keras</span>
                  <InfoTip
                    title="Control Directo del Gemelo 3D"
                    text="Selecciona un perfil operativo o carga una fila real del CSV para disparar la propagación neuronal en 3D sin salir de la vista."
                    size="xs"
                  />
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {previewRows.length > 0 && (
                  <button
                    type="button"
                    disabled={inferring}
                    onClick={() => {
                      const nextFeats = loadSampleRow()
                      executeAnimatedInference(nextFeats)
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/35 text-teal-300 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Fila Real #{sampleIdx + 1}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => executeAnimatedInference()}
                  disabled={inferring}
                  className="nl-btn-shimmer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md transition-all disabled:opacity-60"
                >
                  {inferring ? <Zap className="w-3.5 h-3.5 animate-bounce" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{inferring ? 'Propagando...' : 'Ejecutar Inferencia (.keras)'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {presetLabels.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyAreaPreset(p.id)}
                  disabled={inferring}
                  className={`text-left px-3 py-2 rounded-xl border transition-all ${p.cls}`}
                >
                  <p className="text-xs font-bold truncate">{p.title}</p>
                  <p className="text-[10px] text-slate-400 truncate">{p.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 nl-cyber-panel animate-card-reveal rounded-2xl p-4 flex flex-col justify-between gap-3 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
            <div className="h-[2px] w-full bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                <span>Veredicto Keras &amp; Simulador What-If</span>
                <InfoTip
                  title="Predicción y Contrafactuales Reales"
                  text="Muestra la salida directa calculada por TensorFlow/Keras, su confianza porcentual, el impacto de cada variable (W₁) y acciones What-If que re-ejecutan el modelo."
                  size="xs"
                />
              </h3>

              {selectedModel && (
                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10.5px] font-mono text-cyan-300">
                  {selectedModel.version}
                </span>
              )}
            </div>

            {result ? (
              <div className="space-y-3 animate-card-reveal">
                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-950/85 border border-indigo-500/30">
                  {result.probability !== null && (
                    <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r={gaugeRadius} fill="none" stroke="#1e293b" strokeWidth="8" />
                        <circle
                          cx="50"
                          cy="50"
                          r={gaugeRadius}
                          fill="none"
                          stroke={
                            displayedProb >= 60 ? '#f43f5e' : displayedProb >= 38 ? '#f59e0b' : '#10b981'
                          }
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={gaugeCircumference}
                          strokeDashoffset={gaugeOffset}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-sm font-extrabold text-white font-mono">
                          {displayedProb.toFixed(1)}%
                        </span>
                        <span className="text-[8px] uppercase tracking-wider text-slate-400">
                          Confianza
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-[9.5px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Salida Directa Keras
                    </span>
                    <p className="text-base font-extrabold text-white font-mono truncate">
                      {result.predicted_label}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      Latencia: <strong className="text-emerald-400 font-mono">{result.latency_ms} ms</strong>
                    </p>
                  </div>
                </div>

                {result.probabilities && (
                  <div className="space-y-1">
                    {Object.entries(result.probabilities).map(([cls, prob]) => {
                      const pct = Math.round(prob * 1000) / 10
                      const isWinner = String(cls) === String(result.prediction)
                      return (
                        <div key={cls} className="space-y-0.5">
                          <div className="flex justify-between text-[10.5px] font-mono">
                            <span className={isWinner ? 'text-teal-300 font-bold' : 'text-slate-400'}>
                              Clase {cls} {isWinner ? '★' : ''}
                            </span>
                            <span className="text-slate-200 font-bold">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isWinner ? 'bg-gradient-to-r from-teal-400 to-indigo-500' : 'bg-slate-600'
                              }`}
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950/75 border border-teal-500/30 space-y-2">
                  <p className="text-[10.5px] font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Simulador Contrafactual What-If</span>
                    <InfoTip
                      title="Intervenciones Contrafactuales"
                      text="Aplica una acción preventiva sobre las variables actuales y re-ejecuta el modelo .keras en vivo para medir la reducción de riesgo."
                      size="xs"
                    />
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {whatIfActions.map((act, idx) => (
                      <button
                        key={act.id}
                        type="button"
                        disabled={runningWhatIf !== null}
                        onClick={() => runCounterfactual(act.id, act.label)}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-200 transition-colors text-left"
                      >
                        <span className="truncate pr-2">{act.label}</span>
                        {idx === 0 ? (
                          <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        ) : idx === 1 ? (
                          <TrendingDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {counterfactual && (
                    <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-[10.5px] font-mono flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-emerald-300 font-bold truncate">{counterfactual.actionLabel}</p>
                        <p className="text-slate-300">
                          {counterfactual.beforeText} →{' '}
                          <strong className="text-white">{counterfactual.afterText}</strong>
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-bold shrink-0 ${
                          counterfactual.improved
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {counterfactual.deltaText}
                      </span>
                    </div>
                  )}
                </div>

                {result.feature_contributions && result.feature_contributions.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Explicabilidad Neuronal (Pesos W₁)</span>
                        <InfoTip
                          title="Impacto de Variables (Pesos W₁)"
                          text="Muestra las 4 variables que tuvieron mayor peso relativo en la decisión actual de la red neuronal."
                          size="xs"
                        />
                      </span>
                      <span className="text-[10px] font-mono text-teal-400">Top 4</span>
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {result.feature_contributions.slice(0, 4).map(fc => (
                        <div
                          key={fc.name}
                          className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono gap-1">
                            <span className="text-slate-200 truncate" title={fc.name}>
                              {fc.name}
                            </span>
                            <span className="text-teal-300 font-bold shrink-0">{fc.importance_pct}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-400"
                              style={{ width: `${Math.min(100, Math.max(6, fc.importance_pct * 2.2))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-3 text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <Play className="w-5 h-5 text-teal-400" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  Gemelo 3D listo para evaluación en vivo
                </p>
                <p className="text-xs max-w-xs leading-relaxed text-slate-400">
                  Elige uno de los <strong className="text-white">Escenarios Rápidos</strong> debajo del lienzo 3D o pulsa{' '}
                  <strong className="text-cyan-300">«Ejecutar Inferencia (.keras)»</strong> para activar el diagnóstico y los contrafactuales What-If.
                </p>
                <button
                  type="button"
                  onClick={() => executeAnimatedInference()}
                  disabled={inferring}
                  className="nl-btn-shimmer mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md transition-all"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Disparar Inferencia Ahora</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>SHA-256: {selectedModel?.checksum.slice(0, 14)}…</span>
            </span>

            {selectedModel && (
              <span className="inline-flex items-center gap-2 text-[10.5px]">
                <span className="text-teal-300">
                  Acc: <strong>{(selectedModel.test_metrics.test_accuracy * 100).toFixed(1)}%</strong>
                </span>
                <span>·</span>
                <span className="text-indigo-300">
                  F1: <strong>{(selectedModel.test_metrics.f1_score * 100).toFixed(1)}%</strong>
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {showVarsModal && selectedModel && (
        <InferenceVariablesModal
          selectedModel={selectedModel}
          targetCol={targetCol}
          inputColumns={inputColumns}
          features={features}
          sampleIdx={sampleIdx}
          hasPreviewRows={previewRows.length > 0}
          inferring={inferring}
          onChangeFeature={(name, val) => setFeatures(prev => ({ ...prev, [name]: val }))}
          onResetDefaults={() => {
            setFeatures(buildDefaultFeatures())
            setCounterfactual(null)
            toast.info('Valores restablecidos', 'Se cargaron los promedios base del dataset')
          }}
          onLoadSampleRow={() => {
            const nextFeats = loadSampleRow()
            executeAnimatedInference(nextFeats)
          }}
          onExecuteInference={() => executeAnimatedInference()}
          onClose={() => setShowVarsModal(false)}
        />
      )}

      {showBatchModal && (
        <InferenceBatchRadarModal
          batchData={batchData}
          scanningBatch={scanningBatch}
          onScanBatch={() => handleRunBatchScan(batchData ? batchOffset : 0)}
          onInspectItem={handleInspectBatchItem}
          onClose={() => setShowBatchModal(false)}
        />
      )}

      {showHistoryModal && (
        <InferenceHistoryModal
          history={history}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  )
}
