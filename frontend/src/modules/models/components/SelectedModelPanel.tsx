import { useState } from 'react'
import { Download, ShieldCheck, Copy, CheckCircle2 } from 'lucide-react'
import type { ModelVersion } from '../../../types/index'
import { InfoTip } from '../../../components/InfoTip'
import { InferenceSimulatorPanel } from './InferenceSimulatorPanel'
import { useToast } from '../../../components/toast/ToastContext'

const BASE_URL = 'http://localhost:8000/api/v1'

interface SelectedModelPanelProps {
  selectedModel: ModelVersion
}

export function SelectedModelPanel({ selectedModel }: SelectedModelPanelProps) {
  const toast = useToast()
  const [copiedHash, setCopiedHash] = useState(false)

  function copyHash(checksum: string) {
    navigator.clipboard.writeText(checksum)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
    toast.success('Firma SHA-256 copiada', `Modelo ${selectedModel.version}`)
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-indigo-700/50 rounded-2xl p-6 shadow-2xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white">Modelo {selectedModel.version}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              selectedModel.status === 'Aprobado' || selectedModel.status === 'APPROVED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : selectedModel.status === 'En Revisión' || selectedModel.status === 'IN_REVIEW'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {selectedModel.status}
            </span>
            <span className="text-xs text-slate-500 font-mono inline-flex items-center gap-1">
              <span>Inmutable</span>
              <InfoTip
                title="Registro Inmutable"
                text="Los pesos de una versión registrada no pueden sobrescribirse; cualquier reentrenamiento genera una nueva versión auditada."
                size="xs"
              />
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Entrenado para: <strong className="text-slate-200">{selectedModel.dataset_name || 'Telecom Customer Churn'}</strong> | Topología: <strong className="text-slate-200">{selectedModel.arch_name || 'MLP Standard'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`${BASE_URL}/models/${selectedModel.id}/download`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-xs font-semibold transition-all shadow-md shadow-indigo-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar .keras
          </button>
          <button
            onClick={() => window.open(`${BASE_URL}/models/${selectedModel.id}/download-spec`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 text-xs font-semibold transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            JSON Spec
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-800">
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <p className="text-slate-500 text-[11px] flex items-center gap-1">
            <span>Exactitud Test (Accuracy)</span>
            <InfoTip text="Tasa de acierto verificada sobre la partición de prueba sellada (15%)." size="xs" />
          </p>
          <p className="text-emerald-400 text-lg font-bold font-mono mt-0.5">
            {(selectedModel.test_metrics.test_accuracy * 100).toFixed(2)}%
          </p>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <p className="text-slate-500 text-[11px] flex items-center gap-1">
            <span>Pérdida en Test (Loss)</span>
            <InfoTip text="Error evaluado al finalizar el entrenamiento sobre datos no vistos." size="xs" />
          </p>
          <p className="text-amber-400 text-lg font-bold font-mono mt-0.5">
            {selectedModel.test_metrics.test_loss.toFixed(4)}
          </p>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <p className="text-slate-500 text-[11px] flex items-center gap-1">
            <span>F1-Score Ponderado</span>
            <InfoTip text="Media armónica entre Precision y Recall ponderada por soporte de cada clase." size="xs" />
          </p>
          <p className="text-indigo-400 text-lg font-bold font-mono mt-0.5">
            {(selectedModel.test_metrics.f1_score * 100).toFixed(2)}%
          </p>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <p className="text-slate-500 text-[11px] flex items-center gap-1">
            <span>Precision / Recall</span>
            <InfoTip text="Equilibrio entre falsos positivos (Precision) y falsos negativos (Recall)." size="xs" />
          </p>
          <p className="text-cyan-400 text-sm font-bold font-mono mt-1">
            {(selectedModel.test_metrics.precision * 100).toFixed(1)}% / {(selectedModel.test_metrics.recall * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="py-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400 flex items-center gap-1">
            <span>Checksum SHA-256:</span>
            <InfoTip
              title="Firma Criptográfica SHA-256"
              text="Huella digital única del archivo .keras que garantiza integridad bit a bit ante auditorías o despliegues."
              size="xs"
            />
          </span>
          <span className="font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            {selectedModel.checksum}
          </span>
        </div>
        <button
          onClick={() => copyHash(selectedModel.checksum)}
          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          {copiedHash ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedHash ? 'Hash copiado' : 'Copiar Hash'}
        </button>
      </div>

      <InferenceSimulatorPanel />
    </div>
  )
}

