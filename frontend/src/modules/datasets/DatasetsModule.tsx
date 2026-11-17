import { useState, useEffect } from 'react'
import { Database } from 'lucide-react'
import { api } from '../../services/api'
import type { Dataset } from '../../types/index'
import { DatasetUploadPanel } from './components/DatasetUploadPanel'
import { DatasetCardList } from './components/DatasetCardList'
import { DatasetEdaPanel } from './components/DatasetEdaPanel'
import { useToast } from '../../components/toast/ToastContext'

export default function DatasetsModule({ currentProject }: { currentProject: any }) {
  const { error: notifyError, success: notifySuccess } = useToast()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetColumn, setTargetColumn] = useState('')
  const [scalerType, setScalerType] = useState<'standard' | 'minmax'>('standard')
  const [datasetName, setDatasetName] = useState('')
  const [seedingChurn, setSeedingChurn] = useState(false)
  const [seedingCredit, setSeedingCredit] = useState(false)

  useEffect(() => {
    if (!currentProject) return
    api.getProjectDatasets(currentProject.id)
      .then(setDatasets)
      .catch(e => notifyError('Error al cargar datasets', e.message))
  }, [currentProject, notifyError])

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <Database className="w-16 h-16 text-slate-600" />
        <p className="text-lg font-medium">Selecciona un proyecto primero</p>
      </div>
    )
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
        scalerType
      )
      setDatasets(prev => [ds, ...prev])
      setSelectedFile(null)
      setDatasetName('')
      setTargetColumn('')
      notifySuccess(
        'Dataset cargado',
        ds.metadata
          ? `${ds.name} (${ds.metadata.total_rows} filas · ${ds.metadata.total_columns} cols)`
          : ds.name
      )
    } catch (e: any) {
      notifyError('Error al subir dataset', e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSeed(type: 'churn' | 'credit') {
    if (type === 'churn') setSeedingChurn(true)
    else setSeedingCredit(true)
    try {
      const ds = await api.seedSampleDataset(currentProject.id, type)
      setDatasets(prev => [ds, ...prev])
      notifySuccess('Dataset de ejemplo cargado', ds.name)
    } catch (e: any) {
      notifyError('Error al generar dataset', e.message)
    } finally {
      if (type === 'churn') setSeedingChurn(false)
      else setSeedingCredit(false)
    }
  }

  return (
    <div className="space-y-6">

      <DatasetUploadPanel
        selectedFile={selectedFile}
        onSelectFile={setSelectedFile}
        datasetName={datasetName}
        onChangeDatasetName={setDatasetName}
        targetColumn={targetColumn}
        onChangeTargetColumn={setTargetColumn}
        scalerType={scalerType}
        onChangeScalerType={setScalerType}
        uploading={uploading}
        onUpload={handleUpload}
        seedingChurn={seedingChurn}
        seedingCredit={seedingCredit}
        onSeed={handleSeed}
      />

      <DatasetCardList
        datasets={datasets}
        selectedDataset={selectedDataset}
        onToggleEda={ds => setSelectedDataset(selectedDataset?.id === ds.id ? null : ds)}
      />

      {selectedDataset && selectedDataset.metadata && (
        <DatasetEdaPanel
          dataset={selectedDataset}
          onClose={() => setSelectedDataset(null)}
        />
      )}
    </div>
  )
}
