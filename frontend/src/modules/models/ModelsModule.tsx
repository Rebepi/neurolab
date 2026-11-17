import { useEffect, useState } from 'react'
import { Package, Loader2 } from 'lucide-react'
import { api } from '../../services/api'
import type { ModelVersion } from '../../types/index'
import { SelectedModelPanel } from './components/SelectedModelPanel'
import { ModelVersionsGrid } from './components/ModelVersionsGrid'
import { useToast } from '../../components/toast/ToastContext'

export default function ModelsModule({ currentProject }: { currentProject: any }) {
  const { error: notifyError, success: notifySuccess } = useToast()
  const [models, setModels] = useState<ModelVersion[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelVersion | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadModels = () => {
    if (!currentProject) return
    setLoading(true)
    api.getProjectModels(currentProject.id)
      .then(ms => {
        setModels(ms)
        if (ms.length > 0) {
          setSelectedModel(prev => prev ?? ms[0])
        }
      })
      .catch(e => notifyError('Error al cargar modelos', e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
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

  const approved = models.filter(m => m.status === 'Aprobado' || m.status === 'APPROVED').length
  const inReview = models.filter(m => m.status === 'En Revisión' || m.status === 'IN_REVIEW').length
  const retired = models.filter(m => m.status === 'Retirado' || m.status === 'RETIRED').length

  async function handleStatusChange(modelId: string, newStatus: string) {
    setUpdatingId(modelId)
    try {
      await api.updateModelStatus(modelId, newStatus, 'Actualización desde Model Registry', 'usr-reviewer')
      loadModels()
      if (selectedModel?.id === modelId) {
        setSelectedModel(prev => prev ? { ...prev, status: newStatus as any } : null)
      }
      notifySuccess('Estado del modelo actualizado', `Nuevo estado: ${newStatus}`)
    } catch (e: any) {
      notifyError('Error al actualizar modelo', e.message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 text-xs">
        {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 mr-1" />}
        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
          {approved} Aprobados
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
          {inReview} En Revisión
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 font-semibold">
          {retired} Retirados
        </span>
      </div>

      {selectedModel && <SelectedModelPanel selectedModel={selectedModel} />}

      <ModelVersionsGrid
        models={models}
        selectedModel={selectedModel}
        updatingId={updatingId}
        onSelectModel={setSelectedModel}
        onRefresh={loadModels}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
