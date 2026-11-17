import { CheckCircle2, Cpu, Dices, Gauge, Loader2, Lock, RotateCcw, Save, Zap } from 'lucide-react'
import type { SystemQuotas } from '../../../types'
import { InfoTip } from '../../../components/InfoTip'
import { NumericStepperField } from './NumericStepperField'

interface ComputeQuotasTabProps {
  quotas: SystemQuotas
  dirty: boolean
  canEdit: boolean
  saving: boolean
  savedSuccess: boolean
  onChange: (updater: (q: SystemQuotas) => SystemQuotas) => void
  onReset: () => void
  onSave: () => Promise<void>
}

export function ComputeQuotasTab({
  quotas,
  dirty,
  canEdit,
  saving,
  savedSuccess,
  onChange,
  onReset,
  onSave,
}: ComputeQuotasTabProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 nl-surface rounded-2xl border border-slate-700/50 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-indigo-400" />
              <h3 className="text-white font-bold text-base">Límites de Cómputo y Almacenamiento</h3>
              <InfoTip
                title="Cuotas Operativas"
                text="Topes globales para evitar saturación de memoria/CPU, cargas excesivas o ejecuciones sin límite."
                size="xs"
              />
            </div>
            {!canEdit && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                <Lock className="w-3 h-3" />
                Solo lectura
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <NumericStepperField
              label="Trabajos concurrentes máximos"
              value={quotas.max_concurrent_jobs}
              min={1}
              max={20}
              step={1}
              unit="jobs"
              info="Máximo de entrenamientos simultáneos permitidos en cola."
              disabled={!canEdit}
              onChange={v => onChange(q => ({ ...q, max_concurrent_jobs: v }))}
            />

            <NumericStepperField
              label="Épocas máximas por trabajo"
              value={quotas.max_epochs_per_job}
              min={10}
              max={500}
              step={10}
              unit="épocas"
              info="Tope configurable al lanzar nuevos entrenamientos en Keras."
              disabled={!canEdit}
              onChange={v => onChange(q => ({ ...q, max_epochs_per_job: v }))}
            />

            <NumericStepperField
              label="Tamaño máximo de dataset"
              value={quotas.max_dataset_mb}
              min={5}
              max={500}
              step={5}
              unit="MB"
              info="Peso máximo permitido por archivo CSV subido al estudio."
              disabled={!canEdit}
              onChange={v => onChange(q => ({ ...q, max_dataset_mb: v }))}
            />

            <NumericStepperField
              label="Batch Size máximo permitido"
              value={quotas.max_batch_size ?? 128}
              min={16}
              max={512}
              step={16}
              unit="muestras"
              info="Límite superior de muestras por lote durante retropropagación."
              disabled={!canEdit}
              onChange={v => onChange(q => ({ ...q, max_batch_size: v }))}
            />
          </div>

          <NumericStepperField
            label="Retención de auditoría y artefactos (.keras)"
            value={quotas.retention_days}
            min={30}
            max={365}
            step={15}
            unit="días"
            info="Periodo mínimo de conservación de modelos, métricas y registros de auditoría."
            disabled={!canEdit}
            onChange={v => onChange(q => ({ ...q, retention_days: v }))}
          />
        </div>

        <div className="lg:col-span-5 nl-surface rounded-2xl border border-slate-700/50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-white font-bold text-base">Hardware y Reproducibilidad</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold">Aceleración GPU / AVX2</p>
                  <p className="text-slate-400 text-[11px]">Priorizar instrucciones vectoriales y GPU en TensorFlow</p>
                </div>
              </div>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onChange(q => ({ ...q, gpu_acceleration: !q.gpu_acceleration }))}
                aria-label="Alternar aceleración GPU"
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${quotas.gpu_acceleration ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${quotas.gpu_acceleration ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold">Precisión Mixta (FP16)</p>
                  <p className="text-slate-400 text-[11px]">Acelera cómputo de tensores manteniendo estabilidad en gradientes</p>
                </div>
              </div>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onChange(q => ({ ...q, mixed_precision: !(quotas.mixed_precision ?? false) }))}
                aria-label="Alternar precisión mixta"
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${quotas.mixed_precision ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${quotas.mixed_precision ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="pt-1">
              <NumericStepperField
                label="Semilla Aleatoria Global (Random Seed)"
                value={quotas.random_seed ?? 42}
                min={0}
                max={99999}
                step={1}
                info="Fija la reproducibilidad de particiones Train/Val/Test y la inicialización de pesos."
                disabled={!canEdit}
                onChange={v => onChange(q => ({ ...q, random_seed: v }))}
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
              <Dices className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Semilla actual garantiza reproducibilidad entre corridas Keras.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="nl-surface rounded-2xl border border-slate-700/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs">
          {!canEdit ? (
            <span className="text-amber-300/90">Solo el Administrador puede modificar cuotas de cómputo.</span>
          ) : dirty ? (
            <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Tienes cambios pendientes por guardar
            </span>
          ) : savedSuccess ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Configuración guardada en el servidor
            </span>
          ) : (
            <span className="text-slate-400">Parámetros sincronizados con el backend.</span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={!canEdit}
            onClick={onReset}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Valores Recomendados</span>
          </button>

          <button
            type="button"
            disabled={!canEdit || saving || !dirty}
            onClick={onSave}
            className="nl-btn-shimmer nl-accent-bg nl-accent-glow flex items-center gap-2 px-5 py-2 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl text-white text-xs font-bold transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Guardando...' : 'Guardar Cómputo y Cuotas'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

