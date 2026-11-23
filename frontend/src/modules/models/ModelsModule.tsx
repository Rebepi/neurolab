import { useEffect, useState } from 'react'
import { Package, RefreshCw, Search, X } from 'lucide-react'
import { api } from '../../services/api'
import type { ModelVersion } from '../../types/index'
import { ModuleStudioHero } from '../../components/ModuleStudioHero'
import { PaginationBar } from '../../components/PaginationBar'
import { SystemSelect } from '../../components/SystemSelect'
import { useToast } from '../../components/toast/ToastContext'
import { InferenceSimulatorPanel } from './components/InferenceSimulatorPanel'
import { ModelVersionsGrid, normalizeModelStatus } from './components/ModelVersionsGrid'
import { SelectedModelPanel } from './components/SelectedModelPanel'

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'APPROVED', label: 'Aprobados' },
  { value: 'IN_REVIEW', label: 'En Revisión' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'RETIRED', label: 'Retirados' },
]

const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'accuracy', label: 'Mayor Exactitud' },
  { value: 'f1', label: 'Mayor F1-Score' },
  { value: 'loss', label: 'Menor Loss' },
]

export default function ModelsModule({
  currentProject,
  onNavigate,
}: {
  currentProject: any
  onNavigate?: (module: string) => void
}) {
  const { error: notifyError, success: notifySuccess } = useToast()
  const [models, setModels] = useState<ModelVersion[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelVersion | null>(null)
  const [detailModel, setDetailModel] = useState<ModelVersion | null>(null)
  const [simulatorModel, setSimulatorModel] = useState<ModelVersion | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('recent')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)

  const loadModels = () => {
    if (!currentProject) return
    setLoading(true)
    api
      .getProjectModels(currentProject.id)
      .then(ms => {
        setModels(ms)
        if (ms.length > 0) {
          setSelectedModel(prev => (prev ? ms.find(m => m.id === prev.id) ?? ms[0] : ms[0]))
        } else {
          setSelectedModel(null)
        }
      })
      .catch(e => notifyError('Error al cargar modelos', e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setSearch('')
    setStatusFilter('ALL')
    setCurrentPage(1)
    loadModels()
  }, [currentProject])

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4 text-slate-500">
        <Package size={56} className="opacity-30" />
        <p className="text-lg">Selecciona un proyecto para ver el Registro de Modelos</p>
      </div>
    )
  }

  const approved = models.filter(m => normalizeModelStatus(m.status).code === 'APPROVED').length
  const inReview = models.filter(m => normalizeModelStatus(m.status).code === 'IN_REVIEW').length
  const retired = models.filter(m => normalizeModelStatus(m.status).code === 'RETIRED').length

  const bestModel =
    models.length > 0
      ? [...models].sort(
          (a, b) => (b.test_metrics?.test_accuracy ?? 0) - (a.test_metrics?.test_accuracy ?? 0)
        )[0]
      : null

  async function handleStatusChange(modelId: string, newStatus: string) {
    setUpdatingId(modelId)
    try {
      await api.updateModelStatus(modelId, newStatus, 'Actualización desde Model Registry', 'usr-reviewer')
      loadModels()
      if (selectedModel?.id === modelId) {
        setSelectedModel(prev => (prev ? { ...prev, status: newStatus as any } : null))
      }
      if (detailModel?.id === modelId) {
        setDetailModel(prev => (prev ? { ...prev, status: newStatus as any } : null))
      }
      const norm = normalizeModelStatus(newStatus)
      notifySuccess('Estado del modelo actualizado', `Nuevo estado: ${norm.label}`)
    } catch (e: any) {
      notifyError('Error al actualizar modelo', e.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const query = search.trim().toLowerCase()
  const filteredModels = models
    .filter(m => {
      if (statusFilter !== 'ALL' && normalizeModelStatus(m.status).code !== statusFilter) {
        return false
      }
      if (!query) return true
      const haystack = `${m.version} ${m.arch_name ?? ''} ${m.dataset_name ?? ''} ${m.target_column ?? ''} ${m.checksum}`.toLowerCase()
      return haystack.includes(query)
    })
    .sort((a, b) => {
      if (sortBy === 'accuracy') {
        return (b.test_metrics?.test_accuracy ?? 0) - (a.test_metrics?.test_accuracy ?? 0)
      }
      if (sortBy === 'f1') {
        return (b.test_metrics?.f1_score ?? 0) - (a.test_metrics?.f1_score ?? 0)
      }
      if (sortBy === 'loss') {
        return (a.test_metrics?.test_loss ?? 999) - (b.test_metrics?.test_loss ?? 999)
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalPages = Math.max(1, Math.ceil(filteredModels.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedModels = filteredModels.slice((safePage - 1) * pageSize, safePage * pageSize)
  const hasFilters = query.length > 0 || statusFilter !== 'ALL'

  function clearFilters() {
    setSearch('')
    setStatusFilter('ALL')
    setCurrentPage(1)
  }

  return (
    <div className="flex-1 flex flex-col gap-3.5 min-h-0">
      <ModuleStudioHero
        variant="vault"
        eyebrow="GOBERNANZA DE ARTEFACTOS .KERAS & FIRMAS SHA-256"
        title="Model"
        highlight="Registry"
        subtitle={`Versionado inmutable, verificación criptográfica y despliegue al Gemelo 3D en ${currentProject.name}.`}
        icon={Package}
        tipTitle="Versionado Inmutable de Binarios"
        tipText="Cada entrenamiento certificado sella sus pesos en formato .keras con hash SHA-256 verificable y estados de aprobación."
        metrics={[
          { label: 'Versiones', value: models.length, tone: 'cyan' },
          { label: 'Aprobados', value: approved, tone: 'emerald' },
          { label: 'En Revisión', value: inReview, tone: 'amber' },
          { label: 'Retirados', value: retired, tone: 'teal' },
          ...(bestModel
            ? [
                {
                  label: 'Mejor',
                  value: `${bestModel.version} · ${(bestModel.test_metrics.test_accuracy * 100).toFixed(1)}%`,
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
              placeholder="Buscar versión, arquitectura, dataset o hash SHA-256..."
              aria-label="Buscar versiones de modelo"
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
                {filteredModels.length} visibles
              </span>
            </div>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <SystemSelect
                value={statusFilter}
                onChange={val => {
                  setStatusFilter(val)
                  setCurrentPage(1)
                }}
                size="xs"
                ariaLabel="Filtrar por estado de gobernanza"
                options={STATUS_FILTER_OPTIONS}
              />
            </div>

            <div className="w-40">
              <SystemSelect
                value={sortBy}
                onChange={val => {
                  setSortBy(val)
                  setCurrentPage(1)
                }}
                size="xs"
                ariaLabel="Ordenar versiones"
                options={SORT_OPTIONS}
              />
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-200 transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadModels}
              aria-label="Refrescar registro de modelos"
              className="p-2 rounded-xl bg-slate-950/75 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        }
      />

      <ModelVersionsGrid
        models={paginatedModels}
        totalModelsCount={models.length}
        bestModelId={bestModel?.id ?? null}
        selectedModel={selectedModel}
        updatingId={updatingId}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
        onSelectModel={setSelectedModel}
        onOpenDetail={model => {
          setSelectedModel(model)
          setDetailModel(model)
        }}
        onOpenSimulator={model => {
          setSelectedModel(model)
          setSimulatorModel(model)
        }}
        onUseIn3D={
          onNavigate
            ? model => {
                setSelectedModel(model)
                onNavigate('inference')
              }
            : undefined
        }
        onOpenReport={
          onNavigate
            ? model => {
                setSelectedModel(model)
                onNavigate('reports')
              }
            : undefined
        }
        onStatusChange={handleStatusChange}
      />

      {!loading && filteredModels.length > 0 && (
        <div className="nl-cyber-panel rounded-2xl overflow-hidden mt-auto">
          <PaginationBar
            currentPage={safePage}
            totalItems={filteredModels.length}
            pageSize={pageSize}
            pageSizeOptions={[3, 6, 9, 12]}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            itemLabel="versiones registradas"
          />
        </div>
      )}

      {detailModel && (
        <SelectedModelPanel
          selectedModel={detailModel}
          updatingId={updatingId}
          onStatusChange={handleStatusChange}
          onOpenSimulator={() => {
            const target = detailModel
            setDetailModel(null)
            setSimulatorModel(target)
          }}
          onUseIn3D={
            onNavigate
              ? () => {
                  setDetailModel(null)
                  onNavigate('inference')
                }
              : undefined
          }
          onOpenReport={
            onNavigate
              ? () => {
                  setDetailModel(null)
                  onNavigate('reports')
                }
              : undefined
          }
          onClose={() => setDetailModel(null)}
        />
      )}

      {simulatorModel && (
        <InferenceSimulatorPanel
          selectedModel={simulatorModel}
          onClose={() => setSimulatorModel(null)}
        />
      )}
    </div>
  )
}
