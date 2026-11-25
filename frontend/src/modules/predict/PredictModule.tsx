import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  FileSpreadsheet,
  Globe2,
  Lightbulb,
  Loader2,
  Play,
  Radio,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { api } from '../../services/api'
import type {
  CatalogModelVersion,
  ColumnSummary,
  PredictionResponse,
} from '../../types/index'
import { InfoTip, SystemTooltip } from '../../components/InfoTip'
import { SystemSelect } from '../../components/SystemSelect'
import { useToast } from '../../components/toast/ToastContext'
import {
  buildCopyableSummary,
  buildDefaultHumanValues,
  buildHumanPreset,
  encodeCorporate360Payload,
  formatCategoryLabel,
  formatCleanNumber,
  formatPredictionClassName,
  getAreaDisplayInfo,
  getFieldMeta,
  getModelBusinessProfile,
  getNumericStep,
  interpretPredictionVerdict,
  type AreaDisplayInfo,
  type ModelBusinessProfile,
} from './fieldDictionary'
import { CsvBatchPredictTab } from './components/CsvBatchPredictTab'
import { SmartNumericField } from './components/SmartNumericField'
import {
  NeuralFlowAnimationOverlay,
  type AnimatedInputItem,
} from './components/NeuralFlowAnimationOverlay'

interface PredictModuleProps {
  onNavigate?: (module: string) => void
}

interface GoalGroup {
  profile: ModelBusinessProfile
  models: CatalogModelVersion[]
}

interface AreaGroup {
  area: AreaDisplayInfo
  goals: GoalGroup[]
  totalModels: number
  bestAccuracyPct: number
  isBestRegression: boolean
}

interface RecentPrediction {
  id: string
  time: string
  modelId: string
  areaCode: string
  goalKey: string
  goalTitle: string
  headline: string
  badgeText: string
  tone: 'safe' | 'warn' | 'danger' | 'info'
  confidencePct: number | null
  numericMetric: number | null
  valuesSnapshot: Record<string, any>
  resultSnapshot: PredictionResponse
}

const GOAL_ORDER = ['retencion', 'noc', 'noc_5g', 'antifraude', 'ltv', 'credito', 'general']

function AreaOrGoalIcon({ id, className = 'w-4 h-4' }: { id: string; className?: string }) {
  const low = id.toLowerCase()
  if (low.includes('retencion')) return <Users className={className} />
  if (low.includes('noc')) return <Radio className={className} />
  if (low.includes('antifraude')) return <ShieldAlert className={className} />
  if (low.includes('credito')) return <Wallet className={className} />
  if (low.includes('comercial') || low.includes('ltv')) return <DollarSign className={className} />
  if (low.includes('general')) return <Globe2 className={className} />
  return <Sparkles className={className} />
}

const ACCENT_STYLES: Record<
  ModelBusinessProfile['accent'],
  { activeCard: string; iconBox: string; badge: string; pillActive: string }
> = {
  cyan: {
    activeCard: 'bg-cyan-500/15 border-cyan-400/65 shadow-[0_0_22px_rgba(34,211,238,0.18)]',
    iconBox: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/45',
    badge: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/35',
    pillActive: 'bg-cyan-500/20 border-cyan-400/60 text-white',
  },
  emerald: {
    activeCard: 'bg-emerald-500/15 border-emerald-400/65 shadow-[0_0_22px_rgba(16,185,129,0.18)]',
    iconBox: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/45',
    badge: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/35',
    pillActive: 'bg-emerald-500/20 border-emerald-400/60 text-white',
  },
  indigo: {
    activeCard: 'bg-indigo-500/15 border-indigo-400/65 shadow-[0_0_22px_rgba(99,102,241,0.18)]',
    iconBox: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/45',
    badge: 'text-indigo-300 bg-indigo-500/15 border-indigo-400/35',
    pillActive: 'bg-indigo-500/20 border-indigo-400/60 text-white',
  },
  rose: {
    activeCard: 'bg-rose-500/15 border-rose-400/65 shadow-[0_0_22px_rgba(244,63,94,0.18)]',
    iconBox: 'bg-rose-500/20 text-rose-300 border-rose-400/45',
    badge: 'text-rose-300 bg-rose-500/15 border-rose-400/35',
    pillActive: 'bg-rose-500/20 border-rose-400/60 text-white',
  },
  amber: {
    activeCard: 'bg-amber-500/15 border-amber-400/65 shadow-[0_0_22px_rgba(245,158,11,0.18)]',
    iconBox: 'bg-amber-500/20 text-amber-300 border-amber-400/45',
    badge: 'text-amber-300 bg-amber-500/15 border-amber-400/35',
    pillActive: 'bg-amber-500/20 border-amber-400/60 text-white',
  },
  violet: {
    activeCard: 'bg-violet-500/15 border-violet-400/65 shadow-[0_0_22px_rgba(139,92,246,0.18)]',
    iconBox: 'bg-violet-500/20 text-violet-300 border-violet-400/45',
    badge: 'text-violet-300 bg-violet-500/15 border-violet-400/35',
    pillActive: 'bg-violet-500/20 border-violet-400/60 text-white',
  },
}

const CORPORATE_AREA_TO_PROFILE: Record<string, string> = {
  retencion: 'retencion',
  noc: 'noc',
  antifraude: 'antifraude',
  comercial: 'ltv',
}

function getColumnsForModel(model: CatalogModelVersion, areaCode?: string): ColumnSummary[] {
  const schemas = model.area_source_schemas
  if (schemas && Object.keys(schemas).length > 0) {
    const chosenArea = areaCode && schemas[areaCode] ? areaCode : Object.keys(schemas)[0]
    return schemas[chosenArea]?.columns_summary || []
  }
  return (model.dataset_metadata?.columns_summary || []).filter(
    c => !c.is_target && !c.excluded_reason
  )
}

export default function PredictModule({ onNavigate }: PredictModuleProps) {
  const toast = useToast()
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  }, [toast])
  const [catalog, setCatalog] = useState<CatalogModelVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'single' | 'csv'>('single')

  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [corporateAreaCode, setCorporateAreaCode] = useState<string>('retencion')
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [fieldSearch, setFieldSearch] = useState('')
  const [activeFieldGroup, setActiveFieldGroup] = useState<string>('ALL')
  const [autoPredict, setAutoPredict] = useState(false)
  const [animateInference, setAnimateInference] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nl_predict_anim_enabled') !== '0'
    } catch {
      return true
    }
  })
  const [showAnimOverlay, setShowAnimOverlay] = useState(false)
  const [animInputsSnapshot, setAnimInputsSnapshot] = useState<AnimatedInputItem[]>([])

  const [predicting, setPredicting] = useState(false)
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [previousMetric, setPreviousMetric] = useState<{ goalKey: string; value: number; isRegression: boolean } | null>(null)
  const [recentHistory, setRecentHistory] = useState<RecentPrediction[]>([])
  const [copiedSummary, setCopiedSummary] = useState(false)

  const autoTimerRef = useRef<number | null>(null)

  // Agrupar modelos por las 5 Áreas (4 áreas + Modelo General 360° + proyectos personalizados)
  const areaGroups = useMemo<AreaGroup[]>(() => {
    const byArea = new Map<string, { area: AreaDisplayInfo; goalMap: Map<string, GoalGroup> }>()

    for (const m of catalog) {
      const areaInfo = getAreaDisplayInfo(m)
      const profile = getModelBusinessProfile(m)

      let entry = byArea.get(areaInfo.id)
      if (!entry) {
        entry = { area: areaInfo, goalMap: new Map() }
        byArea.set(areaInfo.id, entry)
      }

      const existingGoal = entry.goalMap.get(profile.key)
      if (!existingGoal) {
        entry.goalMap.set(profile.key, { profile, models: [m] })
      } else {
        existingGoal.models.push(m)
      }
    }

    const resultList: AreaGroup[] = []
    for (const { area, goalMap } of byArea.values()) {
      const goals = Array.from(goalMap.values())
      for (const g of goals) {
        g.models.sort(
          (a, b) => (b.test_metrics?.test_accuracy ?? 0) - (a.test_metrics?.test_accuracy ?? 0)
        )
      }
      goals.sort((a, b) => {
        const idxA = GOAL_ORDER.indexOf(a.profile.key)
        const idxB = GOAL_ORDER.indexOf(b.profile.key)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return a.profile.shortTitle.localeCompare(b.profile.shortTitle)
      })

      const allAreaModels = goals.flatMap(g => g.models)
      const bestModel = [...allAreaModels].sort(
        (a, b) => (b.test_metrics?.test_accuracy ?? 0) - (a.test_metrics?.test_accuracy ?? 0)
      )[0]
      resultList.push({
        area,
        goals,
        totalModels: allAreaModels.length,
        bestAccuracyPct: Math.round((bestModel?.test_metrics?.test_accuracy ?? 0) * 100),
        isBestRegression: bestModel?.dataset_metadata?.problem_type === 'regression',
      })
    }

    resultList.sort((a, b) => a.area.order - b.area.order || a.area.shortName.localeCompare(b.area.shortName))
    return resultList
  }, [catalog])

  const selectedModel = useMemo(
    () => catalog.find(m => m.id === selectedModelId) || areaGroups[0]?.goals[0]?.models[0] || null,
    [areaGroups, catalog, selectedModelId]
  )

  const selectedAreaGroup = useMemo(() => {
    if (!selectedModel) return null
    return areaGroups.find(a => a.area.id === selectedModel.project_id) || areaGroups[0] || null
  }, [areaGroups, selectedModel])

  const selectedGoalGroup = useMemo(() => {
    if (!selectedModel || !selectedAreaGroup) return null
    const key = getModelBusinessProfile(selectedModel).key
    return selectedAreaGroup.goals.find(g => g.profile.key === key) || selectedAreaGroup.goals[0] || null
  }, [selectedAreaGroup, selectedModel])

  const isCorporate360 = Boolean(
    selectedModel?.area_source_schemas && Object.keys(selectedModel.area_source_schemas).length > 0
  )

  const corporateAreaCodes = useMemo(
    () => Object.keys(selectedModel?.area_source_schemas || {}),
    [selectedModel]
  )

  const activeCorporateArea = useMemo(() => {
    if (!isCorporate360) return ''
    return corporateAreaCodes.includes(corporateAreaCode)
      ? corporateAreaCode
      : corporateAreaCodes[0] || ''
  }, [corporateAreaCode, corporateAreaCodes, isCorporate360])

  const activeColumns: ColumnSummary[] = useMemo(() => {
    if (!selectedModel) return []
    return getColumnsForModel(selectedModel, activeCorporateArea)
  }, [activeCorporateArea, selectedModel])

  const defaultValues = useMemo(() => buildDefaultHumanValues(activeColumns), [activeColumns])

  const activePreviewRows = useMemo(() => {
    if (!selectedModel) return []
    if (isCorporate360 && activeCorporateArea && selectedModel.area_source_schemas?.[activeCorporateArea]) {
      return selectedModel.area_source_schemas[activeCorporateArea].preview || []
    }
    return selectedModel.dataset_metadata?.preview || []
  }, [activeCorporateArea, isCorporate360, selectedModel])

  const modifiedCount = useMemo(() => {
    let count = 0
    for (const col of activeColumns) {
      const curr = formValues[col.name]
      const base = defaultValues[col.name]
      if (col.dtype === 'numeric') {
        if (typeof curr === 'number' && Math.abs(curr - Number(base)) > 1e-6) count++
      } else if (String(curr ?? '') !== String(base ?? '')) {
        count++
      }
    }
    return count
  }, [activeColumns, defaultValues, formValues])

  const availableGroupNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const col of activeColumns) {
      const g = getFieldMeta(col.name).group
      counts.set(g, (counts.get(g) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
  }, [activeColumns])

  const effectiveFieldGroup = useMemo(() => {
    if (activeFieldGroup === 'ALL') return 'ALL'
    return availableGroupNames.some(g => g.name === activeFieldGroup) ? activeFieldGroup : 'ALL'
  }, [activeFieldGroup, availableGroupNames])

  const groupedFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase()
    const filtered = activeColumns.filter(col => {
      const meta = getFieldMeta(col.name)
      if (!q && effectiveFieldGroup !== 'ALL' && meta.group !== effectiveFieldGroup) {
        return false
      }
      if (!q) return true
      return (
        meta.label.toLowerCase().includes(q) ||
        meta.group.toLowerCase().includes(q) ||
        (meta.help || '').toLowerCase().includes(q) ||
        col.name.toLowerCase().includes(q)
      )
    })

    const groups: Array<{ groupName: string; cols: ColumnSummary[] }> = []
    const byName = new Map<string, ColumnSummary[]>()
    for (const col of filtered) {
      const meta = getFieldMeta(col.name)
      const list = byName.get(meta.group) || []
      list.push(col)
      byName.set(meta.group, list)
    }
    for (const [groupName, cols] of byName.entries()) {
      groups.push({ groupName, cols })
    }
    return groups
  }, [activeColumns, effectiveFieldGroup, fieldSearch])

  function handleSelectModel(model: CatalogModelVersion, overrideArea?: string) {
    if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current)
    setSelectedModelId(model.id)
    setResult(null)
    setPreviousMetric(null)
    setFieldSearch('')
    setActiveFieldGroup('ALL')
    const schemas = model.area_source_schemas
    const nextArea =
      schemas && Object.keys(schemas).length > 0
        ? overrideArea && schemas[overrideArea]
          ? overrideArea
          : Object.keys(schemas)[0]
        : 'retencion'
    setCorporateAreaCode(nextArea)
    const cols = getColumnsForModel(model, nextArea)
    setFormValues(buildDefaultHumanValues(cols))
  }

  function handleSelectCorporateArea(areaCode: string) {
    if (!selectedModel) return
    if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current)
    setCorporateAreaCode(areaCode)
    setResult(null)
    setPreviousMetric(null)
    setFieldSearch('')
    setActiveFieldGroup('ALL')
    const cols = getColumnsForModel(selectedModel, areaCode)
    setFormValues(buildDefaultHumanValues(cols))
  }

  useEffect(() => {
    let active = true
    api
      .getModelsCatalog()
      .then(items => {
        if (!active) return
        setCatalog(items)
        if (items.length > 0) {
          const sorted = [...items].sort((a, b) => {
            const areaA = getAreaDisplayInfo(a).order
            const areaB = getAreaDisplayInfo(b).order
            if (areaA !== areaB) return areaA - areaB
            return (b.test_metrics?.test_accuracy ?? 0) - (a.test_metrics?.test_accuracy ?? 0)
          })
          const first = sorted[0]
          setSelectedModelId(first.id)
          const schemas = first.area_source_schemas
          const firstArea = schemas && Object.keys(schemas).length > 0 ? Object.keys(schemas)[0] : 'retencion'
          setCorporateAreaCode(firstArea)
          setFormValues(buildDefaultHumanValues(getColumnsForModel(first, firstArea)))
        }
      })
      .catch(e => {
        if (active) {
          toastRef.current.error('No se pudieron cargar los modelos', e instanceof Error ? e.message : 'Error de conexión')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current)
    }
  }, [])

  const toggleAnimateInference = useCallback((forced?: boolean) => {
    setAnimateInference(prev => {
      const next = typeof forced === 'boolean' ? forced : !prev
      try {
        localStorage.setItem('nl_predict_anim_enabled', next ? '1' : '0')
      } catch {}
      return next
    })
  }, [])

  const buildAnimatedInputs = useCallback(
    (vals: Record<string, any>): AnimatedInputItem[] => {
      const prioritized = [...activeColumns].sort((a, b) => {
        const aMod =
          a.dtype === 'numeric'
            ? Math.abs(Number(vals[a.name] ?? defaultValues[a.name]) - Number(defaultValues[a.name])) > 1e-6
            : String(vals[a.name] ?? '') !== String(defaultValues[a.name] ?? '')
        const bMod =
          b.dtype === 'numeric'
            ? Math.abs(Number(vals[b.name] ?? defaultValues[b.name]) - Number(defaultValues[b.name])) > 1e-6
            : String(vals[b.name] ?? '') !== String(defaultValues[b.name] ?? '')
        if (aMod !== bMod) return aMod ? -1 : 1
        return 0
      })

      return prioritized.map(col => {
        const meta = getFieldMeta(col.name)
        const raw = vals[col.name] ?? defaultValues[col.name]
        const displayValue = `${meta.prefix || ''}${formatCategoryLabel(String(raw ?? ''))}${
          meta.unit && !meta.prefix ? ` ${meta.unit}` : ''
        }`
        let scaledValue = 0
        if (col.dtype === 'numeric') {
          const num = Number(raw ?? col.mean ?? 0)
          const mu = col.mean ?? 0
          const sd = col.std && col.std > 0 ? col.std : 1
          scaledValue = Math.max(-4, Math.min(4, (num - mu) / sd))
        } else {
          const cats = Object.keys(col.top_values || {})
          scaledValue = String(raw) === cats[0] ? 1 : 0
        }
        return {
          key: col.name,
          label: meta.label,
          displayValue,
          scaledValue: Number(scaledValue.toFixed(2)),
        }
      })
    },
    [activeColumns, defaultValues]
  )

  const runPrediction = useCallback(
    async (valuesOverride?: Record<string, any>, options?: { showOverlay?: boolean }) => {
      if (!selectedModel || !selectedGoalGroup) return
      const currentVals = valuesOverride || formValues
      const shouldShowOverlay = options?.showOverlay ?? animateInference

      if (shouldShowOverlay) {
        setAnimInputsSnapshot(buildAnimatedInputs(currentVals))
        setShowAnimOverlay(true)
      }

      setPredicting(true)

      try {
        let payload = currentVals
        if (isCorporate360 && activeCorporateArea && selectedModel.area_source_schemas?.[activeCorporateArea]) {
          const allModelCols = (selectedModel.dataset_metadata?.columns_summary || []).filter(
            c => !c.is_target && !c.excluded_reason
          )
          payload = encodeCorporate360Payload(
            activeCorporateArea,
            currentVals,
            selectedModel.area_source_schemas[activeCorporateArea],
            allModelCols
          )
        }

        const res = await api.predictModel(selectedModel.id, payload)

        // Guardar métrica anterior para mostrar el cambio (delta) si es la misma consulta
        if (result) {
          const prevVal =
            result.problem_type === 'regression'
              ? Number(result.prediction)
              : result.probability !== null
                ? Math.round(result.probability * 100)
                : null
          if (prevVal !== null && Number.isFinite(prevVal)) {
            setPreviousMetric({
              goalKey: selectedGoalGroup.profile.key,
              value: prevVal,
              isRegression: result.problem_type === 'regression',
            })
          }
        }

        setResult(res)

        const verdict = interpretPredictionVerdict(res, selectedGoalGroup.profile)
        const currentNumeric =
          res.problem_type === 'regression'
            ? Number(res.prediction)
            : res.probability !== null
              ? Math.round(res.probability * 100)
              : null

        setRecentHistory(prev => [
          {
            id: `pred-${Date.now()}`,
            time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            modelId: selectedModel.id,
            areaCode: activeCorporateArea,
            goalKey: selectedGoalGroup.profile.key,
            goalTitle: selectedGoalGroup.profile.shortTitle,
            headline: verdict.headline,
            badgeText: verdict.badgeText,
            tone: verdict.tone,
            confidencePct: verdict.confidencePct,
            numericMetric: currentNumeric,
            valuesSnapshot: { ...currentVals },
            resultSnapshot: res,
          },
          ...prev.slice(0, 5),
        ])
      } catch (e: unknown) {
        if (shouldShowOverlay) {
          setShowAnimOverlay(false)
        }
        toastRef.current.error(
          'Error al ejecutar la predicción',
          e instanceof Error ? e.message : 'No se pudo consultar el modelo'
        )
      } finally {
        setPredicting(false)
      }
    },
    [
      activeCorporateArea,
      animateInference,
      buildAnimatedInputs,
      formValues,
      isCorporate360,
      result,
      selectedGoalGroup,
      selectedModel,
    ]
  )

  const scheduleAutoPredict = useCallback(
    (nextVals: Record<string, any>) => {
      if (!autoPredict) return
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current)
      autoTimerRef.current = window.setTimeout(() => {
        runPrediction(nextVals, { showOverlay: false })
      }, 380)
    },
    [autoPredict, runPrediction]
  )

  function handleFieldChange(name: string, value: any) {
    setFormValues(prev => {
      const next = { ...prev, [name]: value }
      scheduleAutoPredict(next)
      return next
    })
  }

  function handleQuickPreset(slot: 'safe' | 'risk') {
    if (!selectedGoalGroup) return
    if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current)
    const presetKey = isCorporate360
      ? CORPORATE_AREA_TO_PROFILE[activeCorporateArea] || 'retencion'
      : selectedGoalGroup.profile.key
    const nextVals = buildHumanPreset(presetKey, activeColumns, slot, activePreviewRows)
    setFormValues(nextVals)
    runPrediction(nextVals)
  }

  function handleResetForm() {
    if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current)
    setFormValues(defaultValues)
    setResult(null)
    setPreviousMetric(null)
  }

  function handleRestoreHistory(entry: RecentPrediction) {
    const model = catalog.find(m => m.id === entry.modelId)
    if (!model) return
    setSelectedModelId(model.id)
    if (entry.areaCode) setCorporateAreaCode(entry.areaCode)
    setFormValues({ ...entry.valuesSnapshot })
    setResult(entry.resultSnapshot)
    setPreviousMetric(null)
    setMode('single')
  }

  // Atajo Ctrl + Enter para predecir desde cualquier campo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && mode === 'single' && !predicting) {
        e.preventDefault()
        runPrediction()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, predicting, runPrediction])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
        <p className="text-xs text-slate-400">Cargando modelos entrenados disponibles...</p>
      </div>
    )
  }

  if (catalog.length === 0 || !selectedModel || !selectedAreaGroup || !selectedGoalGroup) {
    return (
      <div className="nl-cyber-panel rounded-2xl p-10 text-center max-w-xl mx-auto my-8 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6 text-cyan-300" />
        </div>
        <h2 className="text-lg font-bold text-white">Aún no hay modelos entrenados para usar</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Primero entrena al menos un modelo en el <strong>Pipeline IA</strong> y aparecerá automáticamente aquí listo para recibir datos reales y generar predicciones.
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('training')}
            className="px-4 py-2 rounded-xl nl-accent-bg nl-accent-glow text-white text-xs font-bold inline-flex items-center gap-2"
          >
            <span>Ir a Entrenamiento</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  const profile = selectedGoalGroup.profile
  const accent = ACCENT_STYLES[selectedAreaGroup.area.accent]
  const verdict = result ? interpretPredictionVerdict(result, profile) : null
  const accPct = Math.round((selectedModel.test_metrics?.test_accuracy ?? 0) * 100)

  const topHumanFactors = (result?.feature_contributions || [])
    .filter(
      f =>
        !f.name.startsWith('indice_') &&
        f.name !== 'area_corporativa' &&
        (!isCorporate360 || f.name.startsWith(`${activeCorporateArea}__`))
    )
    .slice(0, 5)
    .map(factor => {
      const cleanKey = factor.name.includes('__')
        ? factor.name.split('__').slice(1).join('__')
        : factor.name
      const baseCol = activeColumns.find(
        c => c.name === cleanKey || cleanKey.startsWith(`${c.name}_`)
      )
      const meta = getFieldMeta(baseCol?.name || cleanKey)
      const humanEntered = baseCol ? formValues[baseCol.name] : undefined
      const displayVal =
        humanEntered !== undefined && humanEntered !== ''
          ? `${meta.prefix || ''}${formatCategoryLabel(String(humanEntered))}${meta.unit && !meta.prefix ? ` ${meta.unit}` : ''}`
          : formatCategoryLabel(factor.raw_value)
      return {
        key: factor.name,
        label: meta.label,
        value: displayVal,
        pct: factor.importance_pct,
      }
    })

  // Cálculo del cambio (delta) respecto a la consulta anterior
  const deltaBadge = (() => {
    if (!result || !previousMetric || previousMetric.goalKey !== profile.key) return null
    if (result.problem_type === 'regression' && previousMetric.isRegression) {
      const diff = Number(result.prediction) - previousMetric.value
      if (Math.abs(diff) < 1) return null
      return {
        up: diff > 0,
        text: `${diff > 0 ? '+' : ''}${profile.unitPrefix || ''}${diff.toLocaleString('es-ES', {
          maximumFractionDigits: 0,
        })} respecto al caso anterior`,
      }
    }
    if (result.problem_type !== 'regression' && !previousMetric.isRegression && result.probability !== null) {
      const currPct = Math.round(result.probability * 100)
      const diff = currPct - previousMetric.value
      if (diff === 0) return null
      return {
        up: diff > 0,
        text: `${diff > 0 ? '+' : ''}${diff}% prob. respecto al caso anterior`,
      }
    }
    return null
  })()

  async function handleCopySummary() {
    if (!verdict) return
    const text = buildCopyableSummary({
      areaName: selectedAreaGroup!.area.fullName,
      goalTitle: profile.shortTitle,
      modelLabel: `${selectedModel!.arch_name || selectedModel!.version} (${accPct}%)`,
      verdict,
      topFactors: topHumanFactors.map(f => ({ label: f.label, value: f.value, pct: f.pct })),
    })
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopiedSummary(true)
    toast.success('Resumen copiado', 'Listo para pegar en correo, reporte o chat')
    window.setTimeout(() => setCopiedSummary(false), 1800)
  }

  return (
    <div className="flex-1 flex flex-col gap-3 lg:min-h-0 lg:overflow-hidden">
      {/* PASO 1: Barra superior compacta con las 5 Áreas + consultas/arquitectura */}
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-3.5 py-2.5 space-y-2.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-[11px] font-mono font-bold text-cyan-300 flex items-center justify-center shrink-0">
              1
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-white">
              Área y Consulta
            </p>
            <InfoTip
              title="¿Cómo se organizan los modelos?"
              text="Aquí aparecen tus 4 áreas operativas y el Modelo General Corporativo 360° (más cualquier proyecto nuevo que entrenes). Algunas áreas como Red NOC y Comercial incluyen 2 consultas especializadas con formularios diferentes."
              hint="Haz clic o pasa el cursor en cada icono (i) para ver qué predice cada área."
              size="xs"
            />
            <SystemTooltip
              title={profile.shortTitle}
              label={profile.subtitle}
              hint={`Dataset base: ${selectedModel.dataset_name || 'Entrenado'}`}
              side="bottom"
              className="hidden md:inline-flex"
            >
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold cursor-help ${accent.badge}`}>
                <span>{profile.question}</span>
              </span>
            </SystemTooltip>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectedAreaGroup.goals.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-950/85 border border-slate-800 rounded-xl p-0.5">
                {selectedAreaGroup.goals.map(g => {
                  const gActive = g.profile.key === profile.key
                  return (
                    <SystemTooltip
                      key={g.profile.key}
                      title={g.profile.shortTitle}
                      label={g.profile.subtitle}
                      side="bottom"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectModel(g.models[0])}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all inline-flex items-center gap-1 ${
                          gActive
                            ? accent.pillActive
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        <AreaOrGoalIcon id={g.profile.key} className="w-3 h-3" />
                        <span>{g.profile.shortTitle}</span>
                      </button>
                    </SystemTooltip>
                  )
                })}
              </div>
            )}

            {selectedGoalGroup.models.length > 1 && (
              <SystemTooltip
                title="Arquitecturas entrenadas"
                label="Esta consulta tiene varias redes neuronales entrenadas (MLP, CNN, RNN o GAN). Por defecto se usa la más precisa en Test, pero puedes cambiarla aquí."
                side="bottom"
              >
                <SystemSelect
                  value={selectedModel.id}
                  onChange={id => {
                    const found = selectedGoalGroup.models.find(m => m.id === id)
                    if (found) handleSelectModel(found)
                  }}
                  size="xs"
                  className="w-52"
                  ariaLabel="Seleccionar versión o arquitectura del modelo"
                  options={selectedGoalGroup.models.map(m => ({
                    value: m.id,
                    label: `${m.arch_name || m.version} (${Math.round((m.test_metrics?.test_accuracy ?? 0) * 100)}%)`,
                  }))}
                />
              </SystemTooltip>
            )}

            <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-0.5">
              <SystemTooltip
                title="Evaluar 1 caso en vivo"
                label="Ingresa los datos manualmente o usa los ejemplos rápidos para ver la predicción, los factores clave y el recorrido neuronal."
                side="bottom"
              >
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 transition-all ${
                    mode === 'single'
                      ? 'bg-cyan-500/20 text-white border border-cyan-400/40'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                  <span>1 caso</span>
                </button>
              </SystemTooltip>
              <SystemTooltip
                title="Evaluación masiva por CSV"
                label="Sube un archivo CSV con hasta 2,000 registros nuevos para predecirlos de golpe y descargar los resultados listos."
                side="bottom"
              >
                <button
                  type="button"
                  onClick={() => setMode('csv')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 transition-all ${
                    mode === 'csv'
                      ? 'bg-cyan-500/20 text-white border border-cyan-400/40'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                  <span>Archivo CSV</span>
                </button>
              </SystemTooltip>
            </div>
          </div>
        </div>

        {/* 5 tarjetas compactas en una sola fila */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {areaGroups.map(ag => {
            const isActive = ag.area.id === selectedAreaGroup.area.id
            const aStyle = ACCENT_STYLES[ag.area.accent]
            return (
              <SystemTooltip
                key={ag.area.id}
                title={ag.area.infoTitle}
                label={ag.area.infoText}
                hint={
                  ag.goals.length > 1
                    ? `Consultas: ${ag.goals.map(g => g.profile.shortTitle).join(' · ')}`
                    : `Consulta: ${ag.goals[0].profile.shortTitle} · ${ag.totalModels} modelo(s)`
                }
                side="bottom"
                className="flex w-full"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectModel(ag.goals[0].models[0])}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelectModel(ag.goals[0].models[0])
                    }
                  }}
                  className={`group relative w-full text-left px-2.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isActive
                      ? aStyle.activeCard
                      : 'bg-slate-950/60 hover:bg-slate-900/80 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? aStyle.iconBox : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <AreaOrGoalIcon id={ag.area.id} className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400 leading-none">
                          {ag.area.badge}
                        </span>
                        {ag.goals.length > 1 && (
                          <span className="text-[9px] font-mono px-1 rounded bg-slate-800/90 text-cyan-300 leading-tight">
                            {ag.goals.length}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-extrabold text-white truncate leading-tight mt-0.5">
                        {ag.area.shortName}
                      </p>
                    </div>
                  </div>

                  <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono font-bold text-emerald-300 shrink-0">
                    {ag.bestAccuracyPct}%
                  </span>
                </div>
              </SystemTooltip>
            )
          })}
        </div>
      </div>

      {mode === 'csv' ? (
        <CsvBatchPredictTab
          model={selectedModel}
          profile={profile}
          inputColumns={activeColumns}
          previewRows={activePreviewRows}
          isCorporate360={isCorporate360}
        />
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* PASO 2: Formulario con cabecera fija, scroll INTERNO solo en los campos y botón siempre visible */}
          <form
            onSubmit={e => {
              e.preventDefault()
              runPrediction()
            }}
            className="lg:col-span-8 nl-cyber-panel animate-card-reveal rounded-2xl overflow-hidden flex flex-col lg:min-h-0"
          >
            {/* Cabecera fija del formulario */}
            <div className="px-4 py-2.5 border-b border-slate-800/80 space-y-2 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-[11px] font-mono font-bold text-cyan-300 flex items-center justify-center">
                    2
                  </span>
                  <p className="text-xs font-bold uppercase tracking-wider text-white">
                    Ingresa los datos ({activeColumns.length})
                  </p>
                  <InfoTip
                    title="Atajos para llenar datos rápido"
                    text="Puedes escribir el número, mover el deslizador, mantener pulsados (− / +) o colocar el cursor encima de cualquier número y girar la rueda del ratón para subir o bajar el valor sin mover la página."
                    hint="Shift + rueda = saltos ×5 · Ctrl + Enter = predecir"
                    size="xs"
                  />
                  {modifiedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/35 text-[10px] font-mono font-bold text-cyan-300">
                      {modifiedCount} {modifiedCount === 1 ? 'editado' : 'editados'}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <SystemTooltip
                    title="Cargar perfil saludable"
                    label="Rellena los campos con un caso típico sin alertas y ejecuta la predicción automáticamente."
                    side="bottom"
                  >
                    <button
                      type="button"
                      onClick={() => handleQuickPreset('safe')}
                      disabled={predicting}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold transition-colors disabled:opacity-50"
                    >
                      Ejemplo normal
                    </button>
                  </SystemTooltip>
                  <SystemTooltip
                    title={profile.key === 'ltv' ? 'Cargar perfil base' : 'Cargar caso crítico de riesgo'}
                    label="Rellena los campos con señales fuertes de alerta para comprobar cómo responde el modelo."
                    side="bottom"
                  >
                    <button
                      type="button"
                      onClick={() => handleQuickPreset('risk')}
                      disabled={predicting}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[11px] font-bold transition-colors disabled:opacity-50"
                    >
                      {profile.key === 'ltv' ? 'Ejemplo básico' : 'Ejemplo en riesgo'}
                    </button>
                  </SystemTooltip>
                  <SystemTooltip
                    title="Predicción automática en vivo"
                    label="Cuando está en ON, cada vez que giras la rueda del ratón, mueves un deslizador o pulsas Sí/No, el modelo recalcula automáticamente sin abrir la animación."
                    side="bottom"
                  >
                    <button
                      type="button"
                      onClick={() => setAutoPredict(v => !v)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-all ${
                        autoPredict
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Zap className={`w-3 h-3 ${autoPredict ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span>Auto: {autoPredict ? 'ON' : 'OFF'}</span>
                    </button>
                  </SystemTooltip>
                  <SystemTooltip
                    title="Restaurar valores base"
                    label="Devuelve todos los campos de este formulario al promedio original del dataset."
                    side="bottom"
                  >
                    <button
                      type="button"
                      onClick={handleResetForm}
                      disabled={predicting}
                      aria-label="Restaurar todos los campos a su promedio base"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </SystemTooltip>
                </div>
              </div>

              {/* Pestañas de grupo de campos + buscador en una sola línea */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {availableGroupNames.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveFieldGroup('ALL')}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                        effectiveFieldGroup === 'ALL'
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Todos ({activeColumns.length})
                    </button>
                    {availableGroupNames.map(g => (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => {
                          setActiveFieldGroup(g.name)
                          setFieldSearch('')
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all ${
                          effectiveFieldGroup === g.name
                            ? 'bg-cyan-500/20 border-cyan-400/50 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {g.name} ({g.count})
                      </button>
                    ))}
                  </div>
                )}

                {activeColumns.length >= 8 && (
                  <div className="relative w-full sm:w-52">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fieldSearch}
                      onChange={e => setFieldSearch(e.target.value)}
                      placeholder="Buscar campo..."
                      className="w-full bg-slate-950/75 border border-slate-800 focus:border-cyan-500 rounded-lg pl-8 pr-2.5 py-1 text-[11px] text-white placeholder-slate-500 outline-none transition-colors"
                    />
                  </div>
                )}
              </div>
            </div>

            {isCorporate360 && corporateAreaCodes.length > 0 && (
              <div className="px-4 py-2 border-b border-slate-800/80 bg-violet-500/5 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <span className="text-[11px] font-semibold text-violet-200 flex items-center gap-1.5">
                  <span>Área a evaluar con valores reales:</span>
                  <InfoTip
                    title="Conversión automática a formato 360°"
                    text="El Modelo General Corporativo trabaja internamente con puntajes estandarizados. Aquí solo ingresas valores normales del área que elijas y el sistema realiza la conversión matemática por ti."
                    size="xs"
                  />
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {corporateAreaCodes.map(code => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleSelectCorporateArea(code)}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                        activeCorporateArea === code
                          ? 'bg-violet-500/25 border-violet-400/60 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {formatCategoryLabel(code)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cuerpo con scroll INTERNO solo para los campos */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
              {groupedFields.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <p>No se encontraron campos que coincidan con «{fieldSearch}».</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFieldSearch('')
                      setActiveFieldGroup('ALL')
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                  >
                    Mostrar todos los campos
                  </button>
                </div>
              ) : (
                groupedFields.map(group => (
                  <div key={group.groupName} className="space-y-2">
                    {(effectiveFieldGroup === 'ALL' || fieldSearch.trim().length > 0) && (
                      <div className="flex items-center gap-2">
                        <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                          {group.groupName}
                        </h4>
                        <div className="flex-1 h-px bg-slate-800/80" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {group.cols.map(col => {
                        const meta = getFieldMeta(col.name)
                        const rawVal = formValues[col.name]
                        const defVal = defaultValues[col.name]

                        if (col.dtype === 'categorical') {
                          const options = Object.keys(col.top_values || {})
                          const isYesNo =
                            options.length === 2 &&
                            options.every(
                              o =>
                                o.toLowerCase() === 'si' ||
                                o.toLowerCase() === 'sí' ||
                                o.toLowerCase() === 'no'
                            )
                          const catModified = String(rawVal ?? '') !== String(defVal ?? '')

                          return (
                            <div
                              key={col.name}
                              className={`p-2.5 rounded-xl bg-slate-950/65 border transition-colors flex flex-col justify-between gap-2 ${
                                catModified
                                  ? 'border-cyan-500/45 bg-cyan-500/[0.04]'
                                  : 'border-slate-800/90 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <label className="text-[11.5px] font-semibold text-slate-200 flex items-center gap-1 min-w-0">
                                  {catModified && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                                  )}
                                  <span className="truncate">{meta.label}</span>
                                  <InfoTip
                                    title={meta.label}
                                    text={
                                      meta.help ||
                                      `Variable categórica con ${options.length} opciones disponibles.`
                                    }
                                    hint={`Valor más frecuente: ${formatCategoryLabel(String(defVal || options[0] || ''))}`}
                                    size="xs"
                                  />
                                </label>

                                {catModified && (
                                  <button
                                    type="button"
                                    onClick={() => handleFieldChange(col.name, defVal)}
                                    title={`Restaurar a ${formatCategoryLabel(String(defVal))}`}
                                    className="p-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-cyan-300 transition-colors"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>

                              {isYesNo ? (
                                <div className="grid grid-cols-2 gap-1.5">
                                  {options.map(opt => {
                                    const active = String(rawVal) === opt
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => handleFieldChange(col.name, opt)}
                                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                          active
                                            ? 'bg-cyan-500/20 border-cyan-400/60 text-white'
                                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                      >
                                        {formatCategoryLabel(opt)}
                                      </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <SystemSelect
                                  value={String(rawVal ?? options[0] ?? '')}
                                  onChange={val => handleFieldChange(col.name, val)}
                                  size="xs"
                                  ariaLabel={meta.label}
                                  options={options.map(opt => ({
                                    value: opt,
                                    label: formatCategoryLabel(opt),
                                  }))}
                                />
                              )}
                            </div>
                          )
                        }

                        const minVal = col.min !== undefined ? formatCleanNumber(col.min, col) : 0
                        const maxVal = col.max !== undefined ? formatCleanNumber(col.max, col) : 100
                        const step = getNumericStep(col)

                        return (
                          <SmartNumericField
                            key={col.name}
                            id={`field-${col.name}`}
                            label={meta.label}
                            value={rawVal === '' ? '' : Number(rawVal ?? defVal)}
                            defaultValue={Number(defVal ?? minVal)}
                            min={minVal}
                            max={maxVal}
                            step={step}
                            isInteger={meta.isInteger}
                            unit={meta.unit}
                            prefix={meta.prefix}
                            help={meta.help}
                            onChange={val => handleFieldChange(col.name, val)}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pie fijo: botón Obtener Predicción SIEMPRE visible sin scroll */}
            <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-950/75 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">
                  <strong className="text-slate-200">{selectedModel.arch_name || selectedModel.version}</strong> · Test{' '}
                  <strong className="text-emerald-300 font-mono">{accPct}%</strong>
                </span>
                <InfoTip
                  title="Calidad del modelo activo"
                  text="Indica qué tan bien acertó esta red neuronal sobre el 15% de datos de prueba que nunca vio durante el entrenamiento."
                  size="xs"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <SystemTooltip
                  title="Animación neuronal en pantalla completa"
                  label="Activado por defecto. Al pulsar «Obtener Predicción», muestra a pantalla completa cómo tus datos se convierten en tensores y atraviesan cada neurona hasta generar el resultado. Puedes desactivarlo aquí u omitir la animación con Esc."
                  side="top"
                >
                  <button
                    type="button"
                    onClick={() => toggleAnimateInference()}
                    className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1.5 transition-all ${
                      animateInference
                        ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${animateInference ? 'text-cyan-300' : 'text-slate-500'}`} />
                    <span>Animación: {animateInference ? 'ON' : 'OFF'}</span>
                  </button>
                </SystemTooltip>

                <SystemTooltip
                  title="Ejecutar modelo neuronal (.keras)"
                  label="Envía los valores ingresados al servidor TensorFlow para calcular la predicción real."
                  hint="Atajo rápido: Ctrl + Enter"
                  side="top"
                >
                  <button
                    type="submit"
                    disabled={predicting}
                    className="px-4 py-2 rounded-xl nl-accent-bg nl-accent-glow text-white text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50 shrink-0"
                  >
                    {predicting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{predicting ? 'Calculando...' : 'Obtener Predicción'}</span>
                    <span className="hidden sm:inline text-[10px] font-mono opacity-75">Ctrl+↵</span>
                  </button>
                </SystemTooltip>
              </div>
            </div>
          </form>

          {/* PASO 3: Panel de Resultado con scroll INTERNO alineado a la misma altura */}
          <div className="lg:col-span-4 nl-cyber-panel animate-card-reveal rounded-2xl overflow-hidden flex flex-col lg:min-h-0">
            <div className="px-3.5 py-2.5 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-[11px] font-mono font-bold text-cyan-300 flex items-center justify-center shrink-0">
                  3
                </span>
                <p className="text-xs font-bold uppercase tracking-wider text-white whitespace-nowrap">
                  Resultado IA
                </p>
                <InfoTip
                  title="Interpretación de la salida"
                  text="El veredicto se calcula ejecutando en vivo el archivo binario .keras entrenado en el servidor. Incluye confianza, factores clave y recomendación práctica."
                  size="xs"
                />
              </div>

              {result && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <SystemTooltip
                    title="Recorrido Neuronal en Pantalla Completa"
                    label="Vuelve a reproducir paso a paso cómo tus datos actuales activaron cada capa de la red neuronal."
                    side="bottom"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAnimInputsSnapshot(buildAnimatedInputs(formValues))
                        setShowAnimOverlay(true)
                      }}
                      className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-[10.5px] font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-300" />
                      <span>Ver red</span>
                    </button>
                  </SystemTooltip>
                  <SystemTooltip
                    title="Copiar resumen ejecutivo"
                    label="Copia el veredicto, confianza, factores clave y recomendación listos para pegar en correo o chat."
                    side="bottom"
                  >
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[10.5px] font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      {copiedSummary ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-cyan-400" />
                      )}
                      <span>{copiedSummary ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </SystemTooltip>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
              {!result || !verdict ? (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center p-5 text-center space-y-3 rounded-xl bg-slate-950/55 border border-slate-800/80">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-cyan-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">Listo para evaluar tu caso</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                      Ajusta los datos a la izquierda (puedes usar la <strong>rueda del ratón</strong> sobre cada número) y pulsa <strong>«Obtener Predicción»</strong>, o prueba con <strong>Ejemplo normal / en riesgo</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Tarjeta principal de veredicto */}
                  <div
                    className={`p-3.5 rounded-2xl border space-y-2 ${
                      verdict.tone === 'danger'
                        ? 'bg-rose-500/12 border-rose-400/45'
                        : verdict.tone === 'warn'
                          ? 'bg-amber-500/12 border-amber-400/45'
                          : verdict.tone === 'safe'
                            ? 'bg-emerald-500/12 border-emerald-400/45'
                            : 'bg-cyan-500/12 border-cyan-400/45'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 ${
                          verdict.tone === 'danger'
                            ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                            : verdict.tone === 'warn'
                              ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                              : verdict.tone === 'safe'
                                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                                : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                        }`}
                      >
                        {verdict.tone === 'danger' ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : verdict.tone === 'safe' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Activity className="w-3.5 h-3.5" />
                        )}
                        <span>{verdict.badgeText}</span>
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-slate-400 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          {result.latency_ms} ms
                        </span>
                        {verdict.confidencePct !== null && (
                          <span className="text-lg font-extrabold font-mono text-white">
                            {verdict.confidencePct}%
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-lg font-extrabold text-white tracking-tight">
                      {verdict.headline}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {verdict.subheadline}
                    </p>

                    {deltaBadge && (
                      <div className="pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/70 border border-slate-700/80 text-[10px] font-mono text-slate-200">
                          {deltaBadge.up ? (
                            <ArrowUpRight className="w-3 h-3 text-cyan-300" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 text-emerald-300" />
                          )}
                          <span>{deltaBadge.text}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Probabilidades por escenario */}
                  {result.probabilities && Object.keys(result.probabilities).length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                          Probabilidad por escenario
                        </p>
                        <InfoTip
                          title="Distribución de probabilidades"
                          text="Muestra qué porcentaje de certeza asigna la red neuronal a cada posible resultado (todas las barras suman 100%)."
                          size="xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(result.probabilities)
                          .sort((a, b) => b[1] - a[1])
                          .map(([cls, prob]) => {
                            const pct = Math.round(prob * 100)
                            const isSelected = String(result.prediction) === String(cls)
                            return (
                              <div key={cls} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className={isSelected ? 'font-bold text-white' : 'text-slate-400'}>
                                    {formatPredictionClassName(cls, profile)}
                                  </span>
                                  <span className="font-mono font-bold text-slate-200">{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isSelected
                                        ? verdict.tone === 'danger'
                                          ? 'bg-rose-400'
                                          : verdict.tone === 'warn'
                                            ? 'bg-amber-400'
                                            : 'bg-emerald-400'
                                        : 'bg-slate-600'
                                    }`}
                                    style={{ width: `${Math.max(2, pct)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Acción recomendada */}
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-400/30 flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-200">
                          Acción recomendada
                        </p>
                        <InfoTip
                          title="Guía operativa sugerida"
                          text="Recomendación práctica asociada al nivel de riesgo o monto estimado por el modelo."
                          size="xs"
                        />
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {verdict.recommendation}
                      </p>
                    </div>
                  </div>

                  {/* Factores que más influyeron */}
                  {topHumanFactors.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                        <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                          ¿Qué datos influyeron más?
                        </p>
                        <InfoTip
                          title="Explicabilidad del resultado"
                          text="Peso relativo estimado de los campos que más activaron la red neuronal en este caso."
                          size="xs"
                        />
                      </div>
                      <div className="space-y-1">
                        {topHumanFactors.map(factor => (
                          <div
                            key={factor.key}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/65 border border-slate-800/80 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-200 truncate block text-[11.5px]">
                                {factor.label}
                              </span>
                              <span className="text-[10.5px] text-slate-400 font-mono">
                                {factor.value}
                              </span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10.5px] font-mono font-bold text-cyan-300 shrink-0">
                              {factor.pct}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historial clicable de consultas */}
                  {recentHistory.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                          Últimas consultas ({recentHistory.length})
                        </p>
                        <InfoTip
                          title="Comparar y restaurar consultas"
                          text="Haz clic en cualquier consulta reciente para recargar sus datos en el formulario."
                          size="xs"
                        />
                      </div>
                      <div className="space-y-1">
                        {recentHistory.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleRestoreHistory(item)}
                            className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-cyan-500/40 transition-colors text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate text-[11.5px]">
                                {item.headline}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {item.goalTitle} · {item.time}
                              </p>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                                item.tone === 'danger'
                                  ? 'bg-rose-500/15 border-rose-400/40 text-rose-300'
                                  : item.tone === 'warn'
                                    ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                                    : item.tone === 'safe'
                                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                                      : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
                              }`}
                            >
                              {item.confidencePct !== null ? `${item.confidencePct}%` : item.badgeText}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <NeuralFlowAnimationOverlay
        open={showAnimOverlay}
        areaName={selectedAreaGroup.area.fullName}
        goalTitle={profile.shortTitle}
        modelName={selectedModel.arch_name || selectedModel.version}
        inputItems={animInputsSnapshot}
        result={result}
        verdict={verdict}
        onSkip={() => setShowAnimOverlay(false)}
        onDisableAutoAnimation={() => {
          toggleAnimateInference(false)
          setShowAnimOverlay(false)
          toast.info(
            'Animación automática desactivada',
            'Puedes volver a activarla con el botón «Animación» junto a Obtener Predicción'
          )
        }}
      />
    </div>
  )
}
