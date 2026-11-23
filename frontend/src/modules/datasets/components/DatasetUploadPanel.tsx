import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  CheckCircle2,
  CopyMinus,
  FileSpreadsheet,
  FilterX,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { api } from '../../../services/api'
import { InfoTip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'
import { AutoCleanSummaryCard } from './AutoCleanSummaryCard'
import { SmartCleaningToggles } from './SmartCleaningToggles'
import type {
  AutoCleanPlanResponse,
  MissingStrategy,
  OutlierStrategy,
  ScalerStrategy,
  SplitRatioOption,
} from '../../../types/index'

interface DatasetUploadPanelProps {
  projectId: string
  projectName?: string
  selectedFile: File | null
  onSelectFile: (f: File | null) => void
  datasetName: string
  onChangeDatasetName: (v: string) => void
  targetColumn: string
  onChangeTargetColumn: (v: string) => void
  scalerType: ScalerStrategy
  onChangeScalerType: (v: ScalerStrategy) => void
  missingStrategy: MissingStrategy
  onChangeMissingStrategy: (v: MissingStrategy) => void
  dropDuplicates: boolean
  onChangeDropDuplicates: (v: boolean) => void
  outlierStrategy: OutlierStrategy
  onChangeOutlierStrategy: (v: OutlierStrategy) => void
  dropColumns: string[]
  onChangeDropColumns: (cols: string[]) => void
  splitRatio: SplitRatioOption
  onChangeSplitRatio: (v: SplitRatioOption) => void
  normalizeText: boolean
  onChangeNormalizeText: (v: boolean) => void
  extractDates: boolean
  onChangeExtractDates: (v: boolean) => void
  groupRareCategories: boolean
  onChangeGroupRareCategories: (v: boolean) => void
  logTransformSkewed: boolean
  onChangeLogTransformSkewed: (v: boolean) => void
  stratifySplit: boolean
  onChangeStratifySplit: (v: boolean) => void
  uploading: boolean
  onUpload: () => void
  onClose: () => void
}

interface ParsedCsvSample {
  headers: string[]
  rows: string[][]
  sampleRowCount: number
  sampleNullCells: number
  sampleNullRows: number
  sampleDuplicates: number
  columnNullCounts: Record<string, number>
  isPartialSample: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function isNullToken(cell: string | undefined): boolean {
  if (cell === undefined) return true
  const norm = cell.trim().toLowerCase()
  return norm === '' || norm === 'null' || norm === 'nan' || norm === 'na' || norm === 'none'
}

const INPUT_GLASS_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-[#071123]/90 hover:bg-[#0b1933]/95 border border-cyan-500/25 focus:border-teal-400/80 focus:ring-2 focus:ring-teal-400/20 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all'

export function DatasetUploadPanel({
  projectId,
  projectName,
  selectedFile,
  onSelectFile,
  datasetName,
  onChangeDatasetName,
  targetColumn,
  onChangeTargetColumn,
  scalerType,
  onChangeScalerType,
  missingStrategy,
  onChangeMissingStrategy,
  dropDuplicates,
  onChangeDropDuplicates,
  outlierStrategy,
  onChangeOutlierStrategy,
  dropColumns,
  onChangeDropColumns,
  splitRatio,
  onChangeSplitRatio,
  normalizeText,
  onChangeNormalizeText,
  extractDates,
  onChangeExtractDates,
  groupRareCategories,
  onChangeGroupRareCategories,
  logTransformSkewed,
  onChangeLogTransformSkewed,
  stratifySplit,
  onChangeStratifySplit,
  uploading,
  onUpload,
  onClose,
}: DatasetUploadPanelProps) {
  const [dragActive, setDragActive] = useState(false)
  const [csvSample, setCsvSample] = useState<ParsedCsvSample | null>(null)
  const [autoPlan, setAutoPlan] = useState<AutoCleanPlanResponse | null>(null)
  const [analyzingAuto, setAnalyzingAuto] = useState(false)
  const [autoError, setAutoError] = useState('')
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !uploading && !document.querySelector('[role="listbox"]')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, uploading])

  useEffect(() => {
    setAutoPlan(null)
    setAutoError('')
    setManuallyAdjusted(false)
    if (!selectedFile) {
      setCsvSample(null)
      return
    }
    const maxSampleBytes = 262144
    const isPartialSample = selectedFile.size > maxSampleBytes
    selectedFile
      .slice(0, maxSampleBytes)
      .text()
      .then(chunk => {
        const cleaned = chunk.replace(/^\uFEFF/, '')
        const rawLines = cleaned.split(/\r?\n/)
        if (isPartialSample && rawLines.length > 1) {
          rawLines.pop()
        }
        const nonEmptyLines = rawLines.filter(l => l.trim().length > 0)
        if (nonEmptyLines.length === 0) {
          setCsvSample(null)
          return
        }
        const headers = parseCsvLine(nonEmptyLines[0]).filter(Boolean)
        const dataLines = nonEmptyLines.slice(1, 251)
        const seenRows = new Set<string>()
        let sampleDuplicates = 0
        let sampleNullCells = 0
        let sampleNullRows = 0
        const columnNullCounts: Record<string, number> = {}
        headers.forEach(h => {
          columnNullCounts[h] = 0
        })
        const parsedRows: string[][] = []

        for (const line of dataLines) {
          const cells = parseCsvLine(line)
          const normalizedKey = cells.join('\u0001')
          if (seenRows.has(normalizedKey)) {
            sampleDuplicates++
          } else {
            seenRows.add(normalizedKey)
          }
          let rowHasNull = false
          headers.forEach((h, idx) => {
            if (isNullToken(cells[idx])) {
              rowHasNull = true
              sampleNullCells++
              columnNullCounts[h] = (columnNullCounts[h] ?? 0) + 1
            }
          })
          if (rowHasNull) sampleNullRows++
          if (parsedRows.length < 5) {
            parsedRows.push(headers.map((_, idx) => cells[idx] ?? ''))
          }
        }

        setCsvSample({
          headers,
          rows: parsedRows,
          sampleRowCount: dataLines.length,
          sampleNullCells,
          sampleNullRows,
          sampleDuplicates,
          columnNullCounts,
          isPartialSample,
        })

        onChangeDropColumns([])
        if (headers.length > 0 && (!targetColumn || !headers.includes(targetColumn))) {
          const autoCandidates = [
            'fuga',
            'objetivo',
            'etiqueta',
            'clase',
            'morosidad',
            'fraude',
            'resultado',
            'estado',
            'estado_nodo',
            'valor_anual_usd',
            'churn',
            'target',
            'label',
            'class',
            'default',
            'outcome',
            'y',
          ]
          const found = headers.find(c => autoCandidates.includes(c.toLowerCase()))
          onChangeTargetColumn(found || headers[headers.length - 1])
        }
      })
      .catch(() => setCsvSample(null))
  }, [selectedFile])

  useEffect(() => {
    if (targetColumn && dropColumns.includes(targetColumn)) {
      onChangeDropColumns(dropColumns.filter(c => c !== targetColumn))
    }
  }, [targetColumn, dropColumns, onChangeDropColumns])

  const detectedColumns = csvSample?.headers ?? []

  function markAdjusted() {
    if (autoPlan) {
      setManuallyAdjusted(true)
    }
  }

  async function handleAutoConfigure() {
    if (!selectedFile || !projectId) return
    setAnalyzingAuto(true)
    setAutoError('')
    try {
      const plan = await api.analyzeUploadDataset(
        projectId,
        selectedFile,
        targetColumn || undefined
      )
      setAutoPlan(plan)
      setManuallyAdjusted(false)
      onChangeTargetColumn(plan.recommended.target_column)
      onChangeMissingStrategy(plan.recommended.missing_strategy)
      onChangeDropDuplicates(plan.recommended.drop_duplicates)
      onChangeOutlierStrategy(plan.recommended.outlier_strategy)
      onChangeDropColumns(plan.recommended.drop_columns)
      onChangeScalerType(plan.recommended.scaler_type)
      onChangeSplitRatio(plan.recommended.split_ratio)
      if (typeof plan.recommended.normalize_text === 'boolean') {
        onChangeNormalizeText(plan.recommended.normalize_text)
      }
      if (typeof plan.recommended.extract_dates === 'boolean') {
        onChangeExtractDates(plan.recommended.extract_dates)
      }
      if (typeof plan.recommended.group_rare_categories === 'boolean') {
        onChangeGroupRareCategories(plan.recommended.group_rare_categories)
      }
      if (typeof plan.recommended.log_transform_skewed === 'boolean') {
        onChangeLogTransformSkewed(plan.recommended.log_transform_skewed)
      }
      if (typeof plan.recommended.stratify_split === 'boolean') {
        onChangeStratifySplit(plan.recommended.stratify_split)
      }
    } catch (err: any) {
      setAutoError(err?.message || 'No se pudo analizar el CSV automáticamente')
    } finally {
      setAnalyzingAuto(false)
    }
  }

  function handleResetDefaults() {
    setAutoPlan(null)
    setAutoError('')
    setManuallyAdjusted(false)
    onChangeScalerType('standard')
    onChangeSplitRatio('70/15/15')
    onChangeMissingStrategy('median_mode')
    onChangeDropDuplicates(true)
    onChangeOutlierStrategy('none')
    onChangeDropColumns([])
    onChangeNormalizeText(true)
    onChangeExtractDates(true)
    onChangeGroupRareCategories(true)
    onChangeLogTransformSkewed(false)
    onChangeStratifySplit(true)
  }

  const isAtDefaultConfig =
    !autoPlan &&
    scalerType === 'standard' &&
    splitRatio === '70/15/15' &&
    missingStrategy === 'median_mode' &&
    dropDuplicates === true &&
    outlierStrategy === 'none' &&
    dropColumns.length === 0 &&
    normalizeText === true &&
    extractDates === true &&
    groupRareCategories === true &&
    logTransformSkewed === false &&
    stratifySplit === true

  function toggleDropColumn(col: string) {
    if (col === targetColumn) return
    markAdjusted()
    if (dropColumns.includes(col)) {
      onChangeDropColumns(dropColumns.filter(c => c !== col))
    } else {
      onChangeDropColumns([...dropColumns, col])
    }
  }

  function clearSelectedFile() {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onSelectFile(null)
    onChangeDropColumns([])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) onSelectFile(f)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-backdrop-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dataset-upload-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !uploading) onClose()
      }}
    >
      <div className="relative nl-cyber-panel rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-pop-in">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/85 via-teal-400/80 to-indigo-500/85" />

        <div className="shrink-0 px-6 py-4 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/35 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2
                id="dataset-upload-modal-title"
                className="text-base sm:text-lg font-bold text-white leading-tight"
              >
                Cargar CSV · Inspección y Limpieza Automática
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Workspace activo:{' '}
                <span className="text-teal-300 font-medium">{projectName ?? 'Área Corporativa'}</span>{' '}
                · El archivo original crudo se conserva intacto para auditoría y visualización.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            aria-label="Cerrar modal de carga"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div
              onDragOver={e => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => !selectedFile && fileInputRef.current?.click()}
              className={`lg:col-span-5 border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-3 transition-all select-none ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : selectedFile
                    ? 'border-teal-400/50 bg-[#071123]/80 cursor-default'
                    : 'border-cyan-500/35 hover:border-cyan-400/70 hover:bg-[#0b1933]/60 cursor-pointer'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0]) onSelectFile(e.target.files[0])
                }}
              />

              {selectedFile ? (
                <div className="w-full space-y-3 text-center">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-400/40 flex items-center justify-center mx-auto">
                    <FileSpreadsheet className="w-5 h-5 text-teal-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white break-words line-clamp-2">
                      {selectedFile.name}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                        {formatFileSize(selectedFile.size)}
                      </span>
                      {detectedColumns.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-500/15 border border-teal-500/35 text-teal-300">
                          {detectedColumns.length} cols
                        </span>
                      )}
                      {csvSample && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-cyan-300">
                          {csvSample.isPartialSample
                            ? `${csvSample.sampleRowCount} filas muestra`
                            : `${csvSample.sampleRowCount} filas`}
                        </span>
                      )}
                    </div>
                  </div>

                  {csvSample && (
                    <div className="grid grid-cols-2 gap-2 text-left pt-1">
                      <div
                        className={`rounded-xl px-3 py-2 border text-[11px] ${
                          csvSample.sampleNullCells > 0
                            ? 'bg-amber-500/10 border-amber-500/35 text-amber-200'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        <p className="text-[10px] opacity-80">Valores nulos</p>
                        <p className="font-mono font-bold">
                          {csvSample.sampleNullCells} celdas ({csvSample.sampleNullRows} filas)
                        </p>
                      </div>
                      <div
                        className={`rounded-xl px-3 py-2 border text-[11px] ${
                          csvSample.sampleDuplicates > 0
                            ? 'bg-amber-500/10 border-amber-500/35 text-amber-200'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        <p className="text-[10px] opacity-80">Filas duplicadas</p>
                        <p className="font-mono font-bold">{csvSample.sampleDuplicates} detectadas</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
                    >
                      Cambiar archivo
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        clearSelectedFile()
                      }}
                      aria-label="Quitar archivo seleccionado"
                      className="p-1.5 rounded-xl border border-slate-800 hover:border-red-500/50 hover:bg-red-900/30 text-slate-400 hover:text-red-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Upload className={`w-6 h-6 ${dragActive ? 'text-cyan-300' : 'text-cyan-400'}`} />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-slate-200 font-semibold text-sm">Arrastra un CSV aquí</p>
                    <p className="text-slate-400 text-xs">o haz clic para explorar archivos</p>
                    <p className="text-[11px] font-mono text-slate-500 pt-1">Solo .csv · máx. 50 MB</p>
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-7 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="upload-dataset-name" className="block text-xs font-medium text-slate-200">
                    Nombre del dataset <span className="text-slate-500">(opcional)</span>
                  </label>
                  <input
                    id="upload-dataset-name"
                    type="text"
                    value={datasetName}
                    onChange={e => onChangeDatasetName(e.target.value)}
                    placeholder="Ej: Clientes Fibra Q4 2026"
                    className={INPUT_GLASS_CLASS}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                      <span>Columna objetivo (Y)</span>
                      <InfoTip
                        title="Variable Objetivo (Y)"
                        text="Es la columna que la red neuronal aprenderá a predecir. Queda protegida frente a exclusiones o transformaciones de entrada."
                        side="right"
                      />
                    </span>
                    {detectedColumns.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-teal-400">
                        <Sparkles className="w-3 h-3" />
                        {detectedColumns.length} detectadas
                      </span>
                    )}
                  </div>

                  {detectedColumns.length > 0 ? (
                    <SystemSelect
                      value={targetColumn || detectedColumns[detectedColumns.length - 1]}
                      onChange={onChangeTargetColumn}
                      size="md"
                      searchable
                      searchPlaceholder="Buscar columna del CSV..."
                      maxVisibleOptions={25}
                      ariaLabel="Columna objetivo del CSV"
                      options={detectedColumns.map((col, idx) => ({
                        value: col,
                        label: col,
                        description:
                          idx === detectedColumns.length - 1
                            ? 'Última columna del CSV (Target sugerido)'
                            : `Columna #${idx + 1} del dataset`,
                      }))}
                    />
                  ) : (
                    <input
                      type="text"
                      value={targetColumn}
                      onChange={e => onChangeTargetColumn(e.target.value)}
                      placeholder="Se detectará al seleccionar tu CSV..."
                      className={INPUT_GLASS_CLASS}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <span>Escalado de variables</span>
                    <InfoTip
                      title="Normalización / Escalado Numérico"
                      text="Standard (Z-score) centra en media 0; Min-Max comprime en [0, 1]; Robust usa mediana e IQR para resistir valores atípicos extremos."
                      hint="Se ajusta solo sobre Train para evitar fuga de datos."
                      side="top"
                    />
                  </label>
                  <SystemSelect
                    value={scalerType}
                    onChange={val => {
                      markAdjusted()
                      onChangeScalerType(val as ScalerStrategy)
                    }}
                    size="sm"
                    ariaLabel="Tipo de escalado"
                    options={[
                      {
                        value: 'standard',
                        label: 'Standard (Z-score)',
                        description: 'Media 0 y desviación estándar 1',
                      },
                      {
                        value: 'robust',
                        label: 'Robust (Mediana / IQR)',
                        description: 'Inmune a valores extremos y colas largas',
                      },
                      {
                        value: 'minmax',
                        label: 'Min-Max [0, 1]',
                        description: 'Escala valores entre 0 y 1',
                      },
                      {
                        value: 'none',
                        label: 'Sin escalado',
                        description: 'Conserva magnitudes numéricas crudas',
                      },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <span>Partición Train / Val / Test</span>
                    <InfoTip
                      title="Partición Sellada de Entrenamiento"
                      text="Train ajusta pesos; Validación vigila sobreajuste por época; Test permanece completamente aislado para evaluación imparcial."
                      side="top"
                    />
                  </label>
                  <SystemSelect
                    value={splitRatio}
                    onChange={val => {
                      markAdjusted()
                      onChangeSplitRatio(val as SplitRatioOption)
                    }}
                    size="sm"
                    ariaLabel="Ratio de partición"
                    options={[
                      {
                        value: '70/15/15',
                        label: '70% / 15% / 15%',
                        description: 'Estándar equilibrado corporativo',
                      },
                      {
                        value: '80/10/10',
                        label: '80% / 10% / 10%',
                        description: 'Mayor volumen para entrenamiento',
                      },
                      {
                        value: '60/20/20',
                        label: '60% / 20% / 20%',
                        description: 'Validación y test reforzados',
                      },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-500/25 bg-[#071123]/75 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                    Limpieza y Preprocesamiento de Datos
                  </h3>
                  <InfoTip
                    title="AutoML de Curación Inteligente"
                    text="Analiza formatos sucios, fuga de datos (Target Leakage), multicolinealidad, asimetría, fechas y desbalanceo para elegir la configuración óptima."
                    side="right"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Configura manualmente o usa <strong className="text-teal-300">Automático</strong> para diagnosticar el CSV completo y elegir las reglas óptimas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isAtDefaultConfig || analyzingAuto || uploading}
                  onClick={handleResetDefaults}
                  title="Quitar configuración automática y volver a valores predeterminados"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs font-medium transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer</span>
                </button>

                <button
                  type="button"
                  disabled={!selectedFile || analyzingAuto || uploading}
                  onClick={handleAutoConfigure}
                  className="nl-btn-shimmer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md transition-all"
                >
                  {analyzingAuto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{analyzingAuto ? 'Diagnosticando CSV...' : 'Automático'}</span>
                </button>
              </div>
            </div>

            {autoError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
                {autoError}
              </div>
            )}

            {autoPlan && (
              <AutoCleanSummaryCard plan={autoPlan} manuallyAdjusted={manuallyAdjusted} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                  <span>Estrategia para valores nulos</span>
                  <InfoTip
                    title="Tratamiento de Celdas Vacías"
                    text="Mediana/Moda resiste outliers; Media/Moda funciona mejor en datos simétricos; Eliminar filas descarta registros incompletos (ideal si son < 3%)."
                    side="top"
                  />
                </label>
                <SystemSelect
                  value={missingStrategy}
                  onChange={val => {
                    markAdjusted()
                    onChangeMissingStrategy(val as MissingStrategy)
                  }}
                  size="sm"
                  ariaLabel="Estrategia para valores nulos"
                  options={[
                    {
                      value: 'median_mode',
                      label: 'Imputar Mediana / Moda',
                      description: 'Mediana en numéricas y moda en categorías',
                    },
                    {
                      value: 'mean_mode',
                      label: 'Imputar Media / Moda',
                      description: 'Promedio aritmético en numéricas',
                    },
                    {
                      value: 'drop_rows',
                      label: 'Eliminar filas con nulos',
                      description: 'Descarta toda fila incompleta (listwise)',
                    },
                    {
                      value: 'zero',
                      label: 'Rellenar con 0 / Desconocido',
                      description: 'Sustitución directa explícita',
                    },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                  <span>Tratamiento de outliers (IQR)</span>
                  <InfoTip
                    title="Detección por Rango Intercuartílico (IQR)"
                    text="Usa Q1 - 1.5·IQR y Q3 + 1.5·IQR. Winsorize recorta extremos al borde válido sin perder filas; Eliminar descarta anomalías extremas."
                    side="top"
                  />
                </label>
                <SystemSelect
                  value={outlierStrategy}
                  onChange={val => {
                    markAdjusted()
                    onChangeOutlierStrategy(val as OutlierStrategy)
                  }}
                  size="sm"
                  ariaLabel="Tratamiento de valores atípicos"
                  options={[
                    {
                      value: 'none',
                      label: 'Sin cambios (conservar)',
                      description: 'Mantiene valores extremos tal cual',
                    },
                    {
                      value: 'iqr_clip',
                      label: 'Recortar al rango IQR (Winsorize)',
                      description: 'Acota valores fuera de [Q1-1.5·IQR, Q3+1.5·IQR]',
                    },
                    {
                      value: 'iqr_drop',
                      label: 'Eliminar filas atípicas (IQR)',
                      description: 'Remueve registros con anomalías extremas',
                    },
                  ]}
                />
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => {
                    markAdjusted()
                    onChangeDropDuplicates(!dropDuplicates)
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                    dropDuplicates
                      ? 'bg-teal-500/15 border-teal-400/60 text-teal-200'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CopyMinus className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate flex items-center gap-1">
                        <span>Eliminar duplicados</span>
                      </p>
                      <p className="text-[10px] opacity-75 truncate">Evita fuga entre Train y Test</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <InfoTip
                      title="Deduplicación Exacta"
                      text="Si una misma fila está en Train y Test el modelo memoriza y falsifica su precisión. Eliminarla garantiza evaluación honesta."
                      side="top"
                    />
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                        dropDuplicates
                          ? 'bg-teal-400/20 text-teal-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {dropDuplicates ? 'ACTIVO' : 'NO'}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <SmartCleaningToggles
              normalizeText={normalizeText}
              onChangeNormalizeText={v => {
                markAdjusted()
                onChangeNormalizeText(v)
              }}
              extractDates={extractDates}
              onChangeExtractDates={v => {
                markAdjusted()
                onChangeExtractDates(v)
              }}
              groupRareCategories={groupRareCategories}
              onChangeGroupRareCategories={v => {
                markAdjusted()
                onChangeGroupRareCategories(v)
              }}
              logTransformSkewed={logTransformSkewed}
              onChangeLogTransformSkewed={v => {
                markAdjusted()
                onChangeLogTransformSkewed(v)
              }}
              stratifySplit={stratifySplit}
              onChangeStratifySplit={v => {
                markAdjusted()
                onChangeStratifySplit(v)
              }}
            />

            {detectedColumns.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <FilterX className="w-3.5 h-3.5 text-amber-300" />
                    <span>Excluir columnas manualmente antes de entrenar:</span>
                    <InfoTip
                      title="Selección de Características"
                      text="Descarta IDs únicos, columnas constantes, fuga de datos (Target Leakage) o variables redundantes que degradan la generalización."
                      side="right"
                    />
                  </span>
                  {dropColumns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChangeDropColumns([])}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      Restaurar todas ({dropColumns.length} excluidas)
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2.5 rounded-xl bg-slate-950/75 border border-slate-800/80">
                  {detectedColumns.map(col => {
                    const isTarget = col === targetColumn
                    const isDropped = dropColumns.includes(col)
                    const colNulls = csvSample?.columnNullCounts[col] ?? 0
                    return (
                      <button
                        key={col}
                        type="button"
                        disabled={isTarget}
                        onClick={() => toggleDropColumn(col)}
                        title={
                          isTarget
                            ? 'Variable objetivo protegida'
                            : isDropped
                              ? 'Clic para volver a incluir'
                              : 'Clic para excluir del entrenamiento'
                        }
                        className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all ${
                          isTarget
                            ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-semibold cursor-not-allowed'
                            : isDropped
                              ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 line-through'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span>{col}</span>
                        {isTarget && <span className="text-[10px] text-cyan-300">(Y)</span>}
                        {!isTarget && colNulls > 0 && (
                          <span className="px-1 rounded bg-amber-500/20 text-amber-300 text-[10px] no-underline">
                            {colNulls} null
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {csvSample && csvSample.rows.length > 0 && (
            <div className="rounded-2xl border border-slate-800/90 bg-slate-950/55 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-slate-900/50">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  {csvSample.sampleNullCells > 0 ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Vista Previa Original del CSV (Primeras 5 filas sin limpiar)</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {csvSample.headers.length} columnas
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-900/70 border-b border-slate-800/80">
                      <th className="px-2.5 py-2 text-left text-slate-500 font-mono">#</th>
                      {csvSample.headers.map(h => (
                        <th
                          key={h}
                          className={`px-2.5 py-2 text-left font-mono ${
                            dropColumns.includes(h)
                              ? 'text-rose-400 line-through opacity-60'
                              : h === targetColumn
                                ? 'text-cyan-300 font-bold'
                                : 'text-slate-400'
                          }`}
                        >
                          {h === targetColumn ? `${h} (Y)` : h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {csvSample.rows.map((r, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-800/30">
                        <td className="px-2.5 py-1.5 text-slate-500 font-mono">{rIdx + 1}</td>
                        {r.map((cell, cIdx) => {
                          const emptyCell = isNullToken(cell)
                          return (
                            <td
                              key={cIdx}
                              className={`px-2.5 py-1.5 font-mono ${
                                dropColumns.includes(csvSample.headers[cIdx]) ? 'opacity-40' : ''
                              }`}
                            >
                              {emptyCell ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px]">
                                  NULL
                                </span>
                              ) : (
                                <span className="text-slate-300">{cell}</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                selectedFile ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'
              }`}
            />
            <span className={selectedFile ? 'text-emerald-300 font-medium' : 'text-slate-400'}>
              {selectedFile
                ? `Listo para limpiar (${missingStrategy}${dropDuplicates ? ' · sin duplicados' : ''}) y generar Auto-EDA`
                : 'Selecciona un CSV para continuar'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={uploading}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onUpload}
              disabled={!selectedFile || uploading}
              className="nl-btn-shimmer inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold shadow-md transition-all"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? 'Limpiando y Analizando...' : 'Cargar, Limpiar y Analizar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
