import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Search,
  Upload,
} from 'lucide-react'
import { api } from '../../../services/api'
import type {
  CatalogModelVersion,
  ColumnSummary,
  CsvPredictionResponse,
} from '../../../types/index'
import { PaginationBar } from '../../../components/PaginationBar'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'
import { useToast } from '../../../components/toast/ToastContext'
import {
  buildCsvTemplateText,
  formatCategoryLabel,
  formatPredictionClassName,
  getFieldMeta,
  type ModelBusinessProfile,
} from '../fieldDictionary'

interface CsvBatchPredictTabProps {
  model: CatalogModelVersion
  profile: ModelBusinessProfile
  inputColumns: ColumnSummary[]
  previewRows: Record<string, any>[]
  isCorporate360: boolean
}

export function CsvBatchPredictTab({
  model,
  profile,
  inputColumns,
  previewRows,
  isCorporate360,
}: CsvBatchPredictTabProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CsvPredictionResponse | null>(null)
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  function handleDownloadTemplate() {
    const csv = buildCsvTemplateText(inputColumns, previewRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantilla_${profile.key}_${model.version.replace(/\./g, '_')}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success('Plantilla CSV descargada', 'Complétala con tus casos nuevos y súbela aquí')
  }

  function handleDownloadResults() {
    if (!result) return
    const blob = new Blob([result.csv_content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const baseName = result.filename.replace(/\.csv$/i, '')
    a.download = `${baseName}_predicciones.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Formato no admitido', 'Sube un archivo con extensión .csv')
      return
    }
    setRunning(true)
    try {
      const res = await api.predictModelCsv(model.id, file)
      setResult(res)
      setPage(1)
      setRiskFilter('ALL')
      setSearch('')
      toast.success(
        'Evaluación masiva completada',
        `${res.total_rows} filas evaluadas en ${res.latency_ms} ms`
      )
    } catch (e: unknown) {
      toast.error(
        'No se pudo evaluar el archivo',
        e instanceof Error ? e.message : 'Verifica las columnas de tu CSV'
      )
    } finally {
      setRunning(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const filteredItems = useMemo(() => {
    if (!result) return []
    const q = search.trim().toLowerCase()
    return result.items.filter(item => {
      if (riskFilter !== 'ALL' && item.risk_level !== riskFilter) return false
      if (!q) return true
      const text = [
        `#${item.row_index}`,
        formatPredictionClassName(String(item.prediction), profile),
        ...Object.entries(item.features)
          .slice(0, 6)
          .map(([k, v]) => `${k} ${v}`),
      ]
        .join(' ')
        .toLowerCase()
      return text.includes(q)
    })
  }, [profile, result, riskFilter, search])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize)

  const previewFeatureCols = useMemo(() => {
    if (!result || result.items.length === 0) return []
    const matched = result.matched_columns.slice(0, 4)
    if (matched.length > 0) return matched
    return Object.keys(result.items[0].features).slice(0, 4)
  }, [result])

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {isCorporate360 && (
        <div className="nl-cyber-panel rounded-2xl px-4 py-3 border border-amber-500/35 bg-amber-500/5 flex items-start gap-3 text-xs text-amber-200 shrink-0">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            Para evaluar un archivo CSV con columnas normales (sin valores normalizados), te recomendamos seleccionar directamente el modelo del área específica (por ejemplo <strong>Fuga de Clientes</strong>, <strong>Diagnóstico Red NOC</strong>, <strong>Detección Antifraude</strong> o <strong>Valor Comercial LTV</strong>).
          </p>
        </div>
      )}

      <div className="nl-cyber-panel rounded-2xl px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Evaluar varios casos desde un archivo CSV
            </h3>
            <InfoTip
              title="Predicción masiva con CSV nuevo"
              text="Sube una tabla con datos reales sin la columna objetivo. Si falta alguna columna opcional, el sistema la completa automáticamente con el valor promedio del modelo. Soporta hasta 2,000 registros por carga."
              hint="Usa «Descargar plantilla CSV» para obtener un archivo ya listo con 3 filas de ejemplo."
              size="xs"
            />
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Sube un CSV con datos nuevos (sin columna de resultado). El modelo evaluará hasta 2,000 registros a la vez y te permitirá descargar el archivo con las predicciones agregadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <SystemTooltip
            title="Descargar plantilla lista"
            label="Genera un archivo CSV con las columnas exactas de este modelo y 3 filas reales de ejemplo para que solo llenes tus casos."
            side="bottom"
          >
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Descargar plantilla CSV</span>
            </button>
          </SystemTooltip>

          <SystemTooltip
            title="Evaluación masiva (.csv)"
            label="Sube hasta 2,000 filas sin columna objetivo. Las columnas opcionales faltantes se completan con el promedio del modelo."
            side="bottom"
          >
            <button
              type="button"
              disabled={running}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl nl-accent-bg nl-accent-glow text-white text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>{running ? 'Evaluando CSV...' : 'Subir CSV para predecir'}</span>
            </button>
          </SystemTooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) processFile(f)
            }}
          />
        </div>
      </div>

      {!result && (
        <div
          onDragOver={e => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f) processFile(f)
          }}
          onClick={() => !running && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ' ') && !running) {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          className={`flex-1 min-h-[220px] flex flex-col items-center justify-center nl-cyber-panel rounded-2xl p-8 border-2 border-dashed text-center cursor-pointer transition-all ${
            dragging
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-slate-700/80 hover:border-cyan-500/50'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center mx-auto mb-3">
            {running ? (
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-cyan-400" />
            )}
          </div>
          <p className="text-sm font-bold text-white">
            {running ? 'Ejecutando predicciones sobre tu archivo...' : 'Arrastra tu archivo CSV aquí o haz clic para seleccionarlo'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Si no tienes el formato exacto, usa el botón «Descargar plantilla CSV» de arriba.
          </p>
        </div>
      )}

      {result && (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
            <div className="nl-cyber-panel rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Casos evaluados
              </p>
              <p className="text-2xl font-extrabold text-white font-mono mt-1">
                {result.total_rows.toLocaleString('es-ES')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={result.filename}>
                {result.filename} · {result.latency_ms} ms
              </p>
            </div>

            {result.problem_type === 'regression' ? (
              <>
                <div className="nl-cyber-panel rounded-2xl p-4 col-span-2 lg:col-span-2">
                  <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
                    Promedio proyectado
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-300 font-mono mt-1">
                    {profile.unitPrefix || ''}
                    {(result.avg_prediction ?? 0).toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    {profile.unitSuffix ? ` ${profile.unitSuffix}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Calculado sobre {result.total_rows} registros
                  </p>
                </div>
                <div className="nl-cyber-panel rounded-2xl p-4 flex flex-col justify-center">
                  <button
                    type="button"
                    onClick={handleDownloadResults}
                    className="w-full px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar CSV</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="nl-cyber-panel rounded-2xl p-4">
                  <p className="text-[11px] uppercase tracking-wider text-rose-300 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Riesgo Alto</span>
                  </p>
                  <p className="text-2xl font-extrabold text-rose-300 font-mono mt-1">
                    {result.high_risk_count}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {Math.round((result.high_risk_count / Math.max(1, result.total_rows)) * 100)}% del total
                  </p>
                </div>

                <div className="nl-cyber-panel rounded-2xl p-4">
                  <p className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">
                    Riesgo Medio
                  </p>
                  <p className="text-2xl font-extrabold text-amber-300 font-mono mt-1">
                    {result.medium_risk_count}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {Math.round((result.medium_risk_count / Math.max(1, result.total_rows)) * 100)}% del total
                  </p>
                </div>

                <div className="nl-cyber-panel rounded-2xl p-4">
                  <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Riesgo Bajo</span>
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-300 font-mono mt-1">
                    {result.low_risk_count}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {Math.round((result.low_risk_count / Math.max(1, result.total_rows)) * 100)}% del total
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="nl-cyber-panel rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative min-w-[200px] max-w-xs flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                    placeholder="Buscar fila o resultado..."
                    className="w-full bg-slate-950/75 border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>

                {result.problem_type !== 'regression' && (
                  <SystemSelect
                    value={riskFilter}
                    onChange={val => {
                      setRiskFilter(val)
                      setPage(1)
                    }}
                    size="xs"
                    className="w-40"
                    ariaLabel="Filtrar por nivel de riesgo"
                    options={[
                      { value: 'ALL', label: 'Todos los niveles' },
                      { value: 'ALTO', label: 'Solo Riesgo Alto' },
                      { value: 'MEDIO', label: 'Solo Riesgo Medio' },
                      { value: 'BAJO', label: 'Solo Riesgo Bajo' },
                    ]}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleDownloadResults}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar CSV con Predicciones</span>
              </button>
            </div>

            {result.missing_columns.length > 0 && (
              <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-200">
                Se completaron automáticamente {result.missing_columns.length} columnas no presentes en el CSV con valores base del modelo.
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-slate-950/95 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      Fila
                    </th>
                    {previewFeatureCols.map(col => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wider text-slate-400 font-bold whitespace-nowrap"
                      >
                        {getFieldMeta(col).label}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wider text-cyan-300 font-bold">
                      Predicción IA
                    </th>
                    {result.problem_type !== 'regression' && (
                      <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                        Nivel
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pageItems.map(item => (
                    <tr key={item.row_index} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-mono text-slate-400">#{item.row_index}</td>
                      {previewFeatureCols.map(col => (
                        <td key={col} className="px-4 py-2.5 text-slate-200 whitespace-nowrap">
                          {formatCategoryLabel(String(item.features[col] ?? '—'))}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">
                        {result.problem_type === 'regression'
                          ? `${profile.unitPrefix || ''}${Number(item.prediction).toLocaleString('es-ES', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : formatPredictionClassName(String(item.prediction), profile)}
                        {item.probability !== null && (
                          <span className="ml-2 text-[11px] font-mono text-slate-400">
                            ({Math.round(item.probability * 100)}%)
                          </span>
                        )}
                      </td>
                      {result.problem_type !== 'regression' && (
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
                              item.risk_level === 'ALTO'
                                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                : item.risk_level === 'MEDIO'
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            }`}
                          >
                            {item.risk_level}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar
              variant="attached"
              currentPage={safePage}
              totalItems={filteredItems.length}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50]}
              onPageChange={setPage}
              onPageSizeChange={size => {
                setPageSize(size)
                setPage(1)
              }}
              itemLabel="filas"
            />
          </div>
        </div>
      )}
    </div>
  )
}
