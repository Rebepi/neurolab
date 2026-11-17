import React, { useRef, useState } from 'react'
import { Database, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import { InfoTip } from '../../../components/InfoTip'
import { SystemSelect } from '../../../components/SystemSelect'

interface DatasetUploadPanelProps {
  selectedFile: File | null
  onSelectFile: (f: File | null) => void
  datasetName: string
  onChangeDatasetName: (v: string) => void
  targetColumn: string
  onChangeTargetColumn: (v: string) => void
  scalerType: 'standard' | 'minmax'
  onChangeScalerType: (v: 'standard' | 'minmax') => void
  uploading: boolean
  onUpload: () => void
  seedingChurn: boolean
  seedingCredit: boolean
  onSeed: (type: 'churn' | 'credit') => void
}

export function DatasetUploadPanel({
  selectedFile,
  onSelectFile,
  datasetName,
  onChangeDatasetName,
  targetColumn,
  onChangeTargetColumn,
  scalerType,
  onChangeScalerType,
  uploading,
  onUpload,
  seedingChurn,
  seedingCredit,
  onSeed,
}: DatasetUploadPanelProps) {
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) onSelectFile(f)
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-5">Cargar Dataset</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          onDragOver={e => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3
            transition-all cursor-pointer select-none
            ${dragActive
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-slate-600 hover:border-indigo-500 hover:bg-slate-800/40'
            }
            ${selectedFile ? 'cursor-default' : ''}
          `}
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
            <div className="flex items-center gap-3 bg-indigo-900/40 border border-indigo-600/50 rounded-lg px-4 py-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400 shrink-0" />
              <span className="text-indigo-200 text-sm font-medium max-w-[200px] truncate">
                {selectedFile.name}
              </span>
              <button
                onClick={e => {
                  e.stopPropagation()
                  onSelectFile(null)
                }}
                className="text-indigo-400 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className={`w-10 h-10 ${dragActive ? 'text-indigo-400' : 'text-slate-500'}`} />
              <div className="text-center">
                <p className="text-slate-300 font-medium text-sm">
                  Arrastra un CSV aquí o haz clic para seleccionar
                </p>
                <p className="text-slate-500 text-xs mt-1">Solo .csv · máx. 50 MB</p>
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
              <span>Nombre del dataset <span className="text-slate-600">(opcional)</span></span>
              <InfoTip
                text="Etiqueta descriptiva para identificar esta versión del conjunto de datos dentro del workspace."
                size="xs"
              />
            </label>
            <input
              type="text"
              value={datasetName}
              onChange={e => onChangeDatasetName(e.target.value)}
              placeholder="Mi Dataset"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
              <span>Columna objetivo <span className="text-slate-600">(opcional)</span></span>
              <InfoTip
                title="Variable Objetivo (Y)"
                text="Nombre de la columna a predecir. Si se omite, el backend toma automáticamente la última columna del CSV e infiere el tipo de problema."
                size="xs"
              />
            </label>
            <input
              type="text"
              value={targetColumn}
              onChange={e => onChangeTargetColumn(e.target.value)}
              placeholder="auto-detectado"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
              <span>Escalado</span>
              <InfoTip
                title="Normalización de Features"
                text="Standard (Z-score) centra en media 0 y desviación 1; Min-Max comprime cada columna al rango [0, 1]. Se ajusta solo sobre Train para evitar fuga de datos."
                size="xs"
              />
            </label>
            <SystemSelect
              value={scalerType}
              onChange={val => onChangeScalerType(val as 'standard' | 'minmax')}
              size="md"
              ariaLabel="Tipo de escalado"
              options={[
                { value: 'standard', label: 'Standard (Z-score)', description: 'Media 0 y desviación estándar 1' },
                { value: 'minmax', label: 'Min-Max', description: 'Escala cada columna al rango [0, 1]' },
              ]}
            />
          </div>

          <button
            onClick={onUpload}
            disabled={!selectedFile || uploading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Procesando...' : 'Cargar y Analizar'}
          </button>

          <div className="pt-2 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2">O usar dataset de muestra:</p>
            <div className="flex gap-2">
              <button
                onClick={() => onSeed('churn')}
                disabled={seedingChurn}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                {seedingChurn ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                Telecom Churn (600 filas)
              </button>
              <button
                onClick={() => onSeed('credit')}
                disabled={seedingCredit}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                {seedingCredit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                Riesgo Crediticio (500 filas)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

