import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Database, GitMerge, Search, Upload, X } from 'lucide-react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import type {
  Dataset,
  MissingStrategy,
  OutlierStrategy,
  ScalerStrategy,
  SplitRatioOption,
} from '../../types/index'
import { DatasetUploadPanel } from './components/DatasetUploadPanel'
import { DatasetFusionModal } from './components/DatasetFusionModal'
import { DatasetCardList } from './components/DatasetCardList'
import { DatasetEdaPanel } from './components/DatasetEdaPanel'
import { ModuleStudioHero } from '../../components/ModuleStudioHero'
import { SystemTooltip } from '../../components/InfoTip'
import { useToast } from '../../components/toast/ToastContext'

const WRITE_ROLES = ['Administrador', 'Responsable de proyecto', 'Ingeniero/analista de IA']

export default function DatasetsModule({
  currentProject,
  onNavigate,
}: {
  currentProject: any
  onNavigate?: (module: string) => void
}) {
  const { user } = useAuth()
  const canWrite = Boolean(user && WRITE_ROLES.includes(user.role))
  const { error: notifyError, success: notifySuccess } = useToast()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [edaInitialTab, setEdaInitialTab] = useState<'summary' | 'variables' | 'raw' | 'clean'>('summary')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetColumn, setTargetColumn] = useState('')
  const [scalerType, setScalerType] = useState<ScalerStrategy>('standard')
  const [missingStrategy, setMissingStrategy] = useState<MissingStrategy>('median_mode')
  const [dropDuplicates, setDropDuplicates] = useState(true)
  const [outlierStrategy, setOutlierStrategy] = useState<OutlierStrategy>('none')
  const [dropColumns, setDropColumns] = useState<string[]>([])
  const [splitRatio, setSplitRatio] = useState<SplitRatioOption>('70/15/15')
  const [normalizeText, setNormalizeText] = useState(true)
  const [extractDates, setExtractDates] = useState(true)
  const [groupRareCategories, setGroupRareCategories] = useState(true)
  const [logTransformSkewed, setLogTransformSkewed] = useState(false)
  const [stratifySplit, setStratifySplit] = useState(true)
  const [datasetName, setDatasetName] = useState('')

  const [showFusionModal, setShowFusionModal] = useState(false)
  const [fusionIds, setFusionIds] = useState<string[]>([])
  const [fusionName, setFusionName] = useState('')
  const [fusionStrategy, setFusionStrategy] = useState<'union' | 'intersection'>('union')
  const [deduplicate, setDeduplicate] = useState(true)
  const [fusing, setFusing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!currentProject) return
    setSelectedDataset(null)
    setFusionIds([])
    setSearch('')
    setCurrentPage(1)
    api.getProjectDatasets(currentProject.id)
      .then(setDatasets)
      .catch(e => notifyError('Error al cargar datasets', e.message))
  }, [currentProject, notifyError])

  const filteredDatasets = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return datasets
    return datasets.filter(
      ds =>
        ds.name.toLowerCase().includes(q) ||
        ds.target.toLowerCase().includes(q) ||
        ds.version.toLowerCase().includes(q)
    )
  }, [datasets, search])

  function toggleFusionId(dsId: string) {
    setFusionIds(prev =>
      prev.includes(dsId) ? prev.filter(id => id !== dsId) : [...prev, dsId]
    )
  }

  function handleOpenUpload(droppedFile?: File) {
    if (!canWrite) return
    if (droppedFile) {
      setSelectedFile(droppedFile)
      setTargetColumn('')
      setDropColumns([])
    }
    setShowUploadModal(true)
  }

  function resetUploadForm() {
    setSelectedFile(null)
    setDatasetName('')
    setTargetColumn('')
    setScalerType('standard')
    setMissingStrategy('median_mode')
    setDropDuplicates(true)
    setOutlierStrategy('none')
    setDropColumns([])
    setSplitRatio('70/15/15')
    setNormalizeText(true)
    setExtractDates(true)
    setGroupRareCategories(true)
    setLogTransformSkewed(false)
    setStratifySplit(true)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    try {
      const ds = await api.uploadDataset(
        currentProject.id,
        selectedFile,
        datasetName || undefined,
        targetColumn || undefined,
        scalerType,
        user?.id || 'usr-engineer',
        {
          missing_strategy: missingStrategy,
          drop_duplicates: dropDuplicates,
          outlier_strategy: outlierStrategy,
          drop_columns: dropColumns,
          scaler_type: scalerType,
          split_ratio: splitRatio,
          normalize_text: normalizeText,
          extract_dates: extractDates,
          group_rare_categories: groupRareCategories,
          log_transform_skewed: logTransformSkewed,
          stratify_split: stratifySplit,
        }
      )
      setDatasets(prev => [ds, ...prev])
      setSelectedDataset(ds)
      setEdaInitialTab('summary')
      resetUploadForm()
      setCurrentPage(1)
      setShowUploadModal(false)
      notifySuccess(
        'Dataset limpiado, cargado y analizado',
        ds.metadata
          ? `${ds.name} (${ds.metadata.total_rows.toLocaleString()} filas · ${ds.metadata.total_columns} cols)`
          : ds.name,
        onNavigate
          ? {
              actionLabel: 'Ir al Paso 03: Arquitectura →',
              onAction: () => onNavigate('architectures'),
            }
          : undefined
      )
    } catch (e: any) {
      notifyError('Error al subir dataset', e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteDataset(ds: Dataset) {
    setDeletingId(ds.id)
    try {
      await api.deleteDataset(ds.id)
      setDatasets(prev => prev.filter(item => item.id !== ds.id))
      setFusionIds(prev => prev.filter(id => id !== ds.id))
      if (selectedDataset?.id === ds.id) setSelectedDataset(null)
      notifySuccess('Dataset eliminado', ds.name)
    } catch (e: any) {
      notifyError('Error al eliminar dataset', e.message || 'No se pudo eliminar el dataset')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleFuseDatasets() {
    if (fusionIds.length < 2) {
      notifyError(
        'Selecciona al menos 2 datasets',
        'Marca 2 o más datasets del área para ejecutar la fusión inteligente.'
      )
      return
    }
    setFusing(true)
    try {
      const fused = await api.fuseProjectDatasets(currentProject.id, {
        dataset_ids: fusionIds,
        name: fusionName.trim() || undefined,
        strategy: fusionStrategy,
        deduplicate,
        scaler_type: scalerType === 'minmax' ? 'minmax' : 'standard',
      })
      setDatasets(prev => [fused, ...prev])
      setSelectedDataset(fused)
      setEdaInitialTab('summary')
      setFusionIds([])
      setFusionName('')
      setCurrentPage(1)
      setShowFusionModal(false)
      const rep = fused.fusion_report
      notifySuccess(
        'Fusión Intra-Área completada',
        rep
          ? `${rep.datasets_merged} datasets → ${rep.final_rows.toLocaleString()} filas (${rep.duplicates_removed} duplicados eliminados · Jaccard ${rep.jaccard_compatibility_pct}%)`
          : fused.name,
        onNavigate
          ? {
              actionLabel: 'Entrenar con Dataset Fusionado →',
              onAction: () => onNavigate('training'),
            }
          : undefined
      )
    } catch (e: any) {
      notifyError(
        'Error al fusionar datasets',
        e?.message ?? 'Compatibilidad insuficiente entre columnas o targets'
      )
    } finally {
      setFusing(false)
    }
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <Database className="w-16 h-16 text-slate-600" />
        <p className="text-lg font-medium">Selecciona un proyecto primero</p>
      </div>
    )
  }

  const totalRowsArea = datasets.reduce(
    (acc, d) => acc + d.splits.train_count + d.splits.val_count + d.splits.test_count,
    0
  )
  const activeDs = selectedDataset || datasets[0]

  return (
    <div className="flex-1 flex flex-col gap-5">
      <ModuleStudioHero
        variant="datastream"
        eyebrow="INGESTA CSV · EXPLORADOR ORIGINAL Y LIMPIEZA INTELIGENTE"
        title="Datasets"
        highlight="& Curación de Datos"
        subtitle={`Visualización cruda, limpieza de nulos/duplicados/outliers y fusión inteligente en ${currentProject.name}.`}
        icon={Database}
        metrics={[
          { label: 'Datasets', value: datasets.length, tone: 'cyan' },
          { label: 'Filas', value: totalRowsArea.toLocaleString(), tone: 'emerald' },
          ...(activeDs
            ? [
                {
                  label: 'Objetivo',
                  value: `${activeDs.input_shape} → ${activeDs.target}`,
                  tone: 'violet' as const,
                },
              ]
            : []),
        ]}
        center={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Buscar dataset por nombre, target o versión..."
              className="w-full pl-9 pr-24 py-1.5 rounded-xl bg-slate-950/75 border border-slate-800 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setCurrentPage(1)
                  }}
                  aria-label="Limpiar búsqueda"
                  className="p-0.5 rounded text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="px-2 py-0.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-nowrap">
                {filteredDatasets.length} visibles
              </span>
            </div>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && datasets.length >= 2 && (
              <SystemTooltip
                title="Fusión Intra-Área"
                label="Combina 2 o más datasets de esta área en una sola versión consolidada."
                side="bottom"
              >
                <button
                  type="button"
                  onClick={() => setShowFusionModal(true)}
                  className="nl-btn-shimmer inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-semibold whitespace-nowrap transition-all shadow-md"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Fusionar</span>
                  {fusionIds.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-950/40 text-white">
                      {fusionIds.length}
                    </span>
                  )}
                </button>
              </SystemTooltip>
            )}

            {canWrite && (
              <button
                type="button"
                onClick={() => handleOpenUpload()}
                className="nl-btn-shimmer inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold whitespace-nowrap transition-colors shadow-md"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Subir CSV</span>
              </button>
            )}

            {datasets.length > 0 && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('architectures')}
                className="nl-btn-shimmer inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white text-xs font-semibold whitespace-nowrap transition-all shadow-md"
              >
                <span>Arquitectura (03)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        }
      />

      {fusionIds.length > 0 && canWrite && (
        <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-teal-500/40">
          <div className="flex items-center gap-2.5 text-xs">
            <GitMerge className="w-4 h-4 text-teal-300 shrink-0" />
            <span className="text-slate-200">
              <strong className="font-mono text-teal-300">{fusionIds.length}</strong>{' '}
              {fusionIds.length === 1 ? 'dataset marcado' : 'datasets marcados'} para fusión
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFusionIds(datasets.map(d => d.id))}
              className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition-colors"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={() => setFusionIds([])}
              className="px-3 py-1 rounded-lg border border-slate-800 hover:bg-slate-800 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Limpiar
            </button>
            <button
              type="button"
              disabled={fusionIds.length < 2}
              onClick={() => setShowFusionModal(true)}
              className="nl-btn-shimmer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all shadow-sm"
            >
              <span>Configurar Fusión</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <DatasetCardList
        datasets={filteredDatasets}
        totalDatasetsCount={datasets.length}
        searchQuery={search}
        onClearSearch={() => {
          setSearch('')
          setCurrentPage(1)
        }}
        onOpenUpload={handleOpenUpload}
        selectedDataset={selectedDataset}
        onToggleEda={(ds, tab = 'summary') => {
          if (selectedDataset?.id === ds.id && edaInitialTab === tab) {
            setSelectedDataset(null)
          } else {
            setEdaInitialTab(tab)
            setSelectedDataset(ds)
          }
        }}
        selectedForFusion={fusionIds}
        onToggleFusionSelect={toggleFusionId}
        onDeleteDataset={handleDeleteDataset}
        deletingId={deletingId}
        canWrite={canWrite}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={size => {
          setPageSize(size)
          setCurrentPage(1)
        }}
      />

      {showUploadModal && canWrite && (
        <DatasetUploadPanel
          projectId={currentProject.id}
          projectName={currentProject.name}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          datasetName={datasetName}
          onChangeDatasetName={setDatasetName}
          targetColumn={targetColumn}
          onChangeTargetColumn={setTargetColumn}
          scalerType={scalerType}
          onChangeScalerType={setScalerType}
          missingStrategy={missingStrategy}
          onChangeMissingStrategy={setMissingStrategy}
          dropDuplicates={dropDuplicates}
          onChangeDropDuplicates={setDropDuplicates}
          outlierStrategy={outlierStrategy}
          onChangeOutlierStrategy={setOutlierStrategy}
          dropColumns={dropColumns}
          onChangeDropColumns={setDropColumns}
          splitRatio={splitRatio}
          onChangeSplitRatio={setSplitRatio}
          normalizeText={normalizeText}
          onChangeNormalizeText={setNormalizeText}
          extractDates={extractDates}
          onChangeExtractDates={setExtractDates}
          groupRareCategories={groupRareCategories}
          onChangeGroupRareCategories={setGroupRareCategories}
          logTransformSkewed={logTransformSkewed}
          onChangeLogTransformSkewed={setLogTransformSkewed}
          stratifySplit={stratifySplit}
          onChangeStratifySplit={setStratifySplit}
          uploading={uploading}
          onUpload={handleUpload}
          onClose={() => {
            setShowUploadModal(false)
            resetUploadForm()
          }}
        />
      )}

      {showFusionModal && canWrite && (
        <DatasetFusionModal
          projectName={currentProject.name}
          datasets={datasets}
          fusionIds={fusionIds}
          onToggleFusionId={toggleFusionId}
          onSelectAll={() => setFusionIds(datasets.map(d => d.id))}
          onClearSelection={() => setFusionIds([])}
          fusionStrategy={fusionStrategy}
          onChangeStrategy={setFusionStrategy}
          deduplicate={deduplicate}
          onToggleDeduplicate={() => setDeduplicate(d => !d)}
          fusionName={fusionName}
          onChangeFusionName={setFusionName}
          fusing={fusing}
          onFuse={handleFuseDatasets}
          onClose={() => setShowFusionModal(false)}
        />
      )}

      {selectedDataset && selectedDataset.metadata && (
        <DatasetEdaPanel
          dataset={selectedDataset}
          initialTab={edaInitialTab}
          canWrite={canWrite}
          onClose={() => setSelectedDataset(null)}
          onDatasetCleaned={cleaned => {
            setDatasets(prev => [cleaned, ...prev])
            setSelectedDataset(cleaned)
            setEdaInitialTab('summary')
            notifySuccess(
              'Versión limpia creada',
              `${cleaned.name} (${cleaned.metadata.total_rows.toLocaleString()} filas · v${cleaned.version})`
            )
          }}
          onGoToArchitectures={
            onNavigate
              ? () => {
                  setSelectedDataset(null)
                  onNavigate('architectures')
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
