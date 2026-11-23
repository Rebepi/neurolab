import { useState } from 'react'
import { CheckCircle2, Code, Copy, Download, Layers } from 'lucide-react'
import { PaginationBar } from '../../../components/PaginationBar'
import { useTheme } from '../../../context/ThemeContext'
import type { LayerSpec } from '../../../types/index'
import type {
  ArchitectureHealth,
  LayerParamBreakdown,
  RecommendedArchitecture,
} from '../utils'
import { ArchitectureFlowStudio } from './ArchitectureFlowStudio'

interface ArchitectureViewsProps {
  activeView: 'canvas' | 'table' | 'code'
  inputShape: number
  outputDim: number
  outputActivation: string
  targetColumn: string
  scalerApplied: string
  layersList: LayerSpec[]
  selectedIdx: number | null
  onSelectLayer: (idx: number) => void
  onRemoveLayer: (idx: number) => void
  onMoveLayer: (idx: number, direction: -1 | 1) => void
  onDuplicateLayer: (idx: number) => void
  onInsertLayerAt: (index: number, type: 'Dense' | 'Dropout' | 'BatchNormalization') => void
  recommended: RecommendedArchitecture
  isOptimalApplied: boolean
  health: ArchitectureHealth
  breakdown: LayerParamBreakdown[]
  totalParams: number
  generatedPythonCode: string
  copiedCode: boolean
  onCopyCode: () => void
  onOpenInsights: (tab: 'reasons' | 'profile') => void
}

const PYTHON_KEYWORDS = new Set(['import', 'from', 'as', 'def', 'return', 'if', 'in', 'True', 'False'])
const KERAS_SYMBOLS = new Set([
  'tf',
  'keras',
  'layers',
  'Sequential',
  'Input',
  'Dense',
  'Dropout',
  'BatchNormalization',
  'Adam',
  'compile',
  'summary',
  'create_model',
])

function renderHighlightedLine(line: string, isLight: boolean) {
  const parts = line.split(/('[^']*'|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b)/g)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith("'") && part.endsWith("'")) {
      return (
        <span key={i} className={isLight ? 'text-emerald-700' : 'text-emerald-300'}>
          {part}
        </span>
      )
    }
    if (PYTHON_KEYWORDS.has(part)) {
      return (
        <span key={i} className={isLight ? 'text-violet-700 font-semibold' : 'text-violet-300 font-semibold'}>
          {part}
        </span>
      )
    }
    if (KERAS_SYMBOLS.has(part)) {
      return (
        <span key={i} className={isLight ? 'text-sky-700 font-semibold' : 'text-cyan-300 font-semibold'}>
          {part}
        </span>
      )
    }
    if (/^\d+(?:\.\d+)?$/.test(part)) {
      return (
        <span key={i} className={isLight ? 'text-amber-700' : 'text-amber-300'}>
          {part}
        </span>
      )
    }
    return (
      <span key={i} className={isLight ? 'text-slate-800' : 'text-slate-200'}>
        {part}
      </span>
    )
  })
}

export function ArchitectureViews({
  activeView,
  inputShape,
  outputDim,
  outputActivation,
  targetColumn,
  scalerApplied,
  layersList,
  selectedIdx,
  onSelectLayer,
  onRemoveLayer,
  onMoveLayer,
  onDuplicateLayer,
  onInsertLayerAt,
  recommended,
  isOptimalApplied,
  health,
  breakdown,
  totalParams,
  generatedPythonCode,
  copiedCode,
  onCopyCode,
  onOpenInsights,
}: ArchitectureViewsProps) {
  const { mode } = useTheme()
  const isLight = mode === 'light'

  const [tablePage, setTablePage] = useState(1)
  const [tablePageSize, setTablePageSize] = useState(8)

  const memoryKb = ((totalParams * 4) / 1024).toFixed(2)
  const codeLines = generatedPythonCode.trimEnd().split('\n')

  const tableTotalPages = Math.max(1, Math.ceil(breakdown.length / tablePageSize))
  const safeTablePage = Math.min(tablePage, tableTotalPages)
  const paginatedBreakdown =
    breakdown.length > 8
      ? breakdown.slice((safeTablePage - 1) * tablePageSize, safeTablePage * tablePageSize)
      : breakdown

  function handleDownloadPy() {
    const blob = new Blob([generatedPythonCode], { type: 'text/x-python;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'tensorflow_keras_model.py'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div key={activeView} className="animate-module-enter flex flex-col min-w-0 h-full">
      {activeView === 'canvas' && (
        <ArchitectureFlowStudio
          inputShape={inputShape}
          outputDim={outputDim}
          outputActivation={outputActivation}
          targetColumn={targetColumn}
          scalerApplied={scalerApplied}
          layersList={layersList}
          selectedIdx={selectedIdx}
          breakdown={breakdown}
          totalParams={totalParams}
          health={health}
          recommended={recommended}
          isOptimalApplied={isOptimalApplied}
          onOpenInsights={onOpenInsights}
          onSelectLayer={onSelectLayer}
          onMoveLayer={onMoveLayer}
          onDuplicateLayer={onDuplicateLayer}
          onRemoveLayer={onRemoveLayer}
          onInsertLayerAt={onInsertLayerAt}
        />
      )}

      {activeView === 'table' && (
        <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-5 space-y-4 flex-1 flex flex-col">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#071123]/80 border border-cyan-500/20">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Capas Totales</p>
              <p className="text-lg font-mono font-extrabold text-cyan-400">{breakdown.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#071123]/80 border border-cyan-500/20">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Parámetros</p>
              <p className="text-lg font-mono font-extrabold text-emerald-400">
                {totalParams.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#071123]/80 border border-cyan-500/20">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Memoria FP32</p>
              <p className="text-lg font-mono font-extrabold text-indigo-400">{memoryKb} KB</p>
            </div>
            <div className="p-3 rounded-xl bg-[#071123]/80 border border-cyan-500/20">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Salida</p>
              <p className="text-lg font-mono font-extrabold text-violet-400 truncate">
                {outputDim}D · {outputActivation}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <h4 className="text-white font-bold text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Desglose de Tensores y Parámetros</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              Haz clic en una capa oculta para editarla
            </span>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/35 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/60">
                  <tr>
                    <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">#</th>
                    <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">Capa</th>
                    <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">Flujo Tensor</th>
                    <th className="py-2.5 px-3 text-right text-slate-400 font-semibold">Pesos W</th>
                    <th className="py-2.5 px-3 text-right text-slate-400 font-semibold">Sesgos b</th>
                    <th className="py-2.5 px-3 text-right text-slate-400 font-semibold">Total</th>
                    <th className="py-2.5 px-3 text-left text-slate-400 font-semibold">Distribución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedBreakdown.map(row => {
                    const hiddenIdx = row.layerIndex - 1
                    const isHiddenRow =
                      row.type !== 'Salida (Dense)' &&
                      hiddenIdx >= 0 &&
                      hiddenIdx < layersList.length
                    const isSelectedRow = isHiddenRow && selectedIdx === hiddenIdx
                    const pct = totalParams > 0 ? (row.total / totalParams) * 100 : 0
                    const typeBadgeCls =
                      row.type === 'Dense'
                        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                        : row.type === 'Dropout'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : row.type === 'BatchNormalization'
                            ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                            : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                    return (
                      <tr
                        key={row.layerIndex}
                        onClick={() => {
                          if (isHiddenRow) onSelectLayer(hiddenIdx)
                        }}
                        className={`transition-colors ${
                          isHiddenRow ? 'cursor-pointer' : ''
                        } ${
                          isSelectedRow
                            ? 'bg-cyan-500/12 hover:bg-cyan-500/18'
                            : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-400">{row.layerIndex}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeBadgeCls}`}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                          ({row.inShape}) → ({row.outShape})
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-400">
                          {row.weights.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-400">
                          {row.biases.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right font-bold text-cyan-400">
                          {row.total.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 min-w-[110px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                                style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] tabular-nums text-slate-400 w-10 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-slate-950/80 font-bold border-t-2 border-slate-700">
                    <td colSpan={5} className="py-3 px-3 text-right text-slate-300">
                      Suma Total de Parámetros Entrenables:
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right text-emerald-400 text-sm">
                      {totalParams.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-emerald-400">100.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {breakdown.length > 8 && (
              <PaginationBar
                currentPage={safeTablePage}
                totalItems={breakdown.length}
                pageSize={tablePageSize}
                pageSizeOptions={[5, 8, 15, 30]}
                onPageChange={setTablePage}
                onPageSizeChange={size => {
                  setTablePageSize(size)
                  setTablePage(1)
                }}
                itemLabel="capas"
              />
            )}
          </div>
        </div>
      )}

      {activeView === 'code' && (
        <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-4 space-y-3 flex-1 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-mono text-slate-300 font-semibold">
                tensorflow_keras_model.py
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400">
                {codeLines.length} líneas
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Descargar .py</span>
              </button>
              <button
                type="button"
                onClick={onCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-lg text-xs font-semibold text-white transition-all shadow-sm shadow-indigo-500/20"
              >
                {copiedCode ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode ? 'Copiado' : 'Copiar Código'}</span>
              </button>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl text-xs font-mono overflow-auto max-h-[480px] leading-relaxed border flex-1 ${
              isLight
                ? 'bg-slate-50 border-slate-300/80'
                : 'bg-slate-950/95 border-slate-800'
            }`}
          >
            {codeLines.map((line, lIdx) => (
              <div key={lIdx} className="flex gap-4 hover:bg-cyan-500/5 px-1 rounded">
                <span className="select-none w-6 text-right shrink-0 text-[11px] text-slate-500">
                  {lIdx + 1}
                </span>
                <pre className="whitespace-pre">{renderHighlightedLine(line, isLight)}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
