import { CheckCircle2, Clock, FileCheck2, Loader2, Lock, RotateCcw, Save, ShieldCheck, Sparkles } from 'lucide-react'
import type { SystemPolicies } from '../../../types'
import { SystemSelect } from '../../../components/SystemSelect'
import { NumericStepperField } from './NumericStepperField'

interface PipelinePoliciesTabProps {
  policies: SystemPolicies
  dirty: boolean
  canEdit: boolean
  saving: boolean
  savedSuccess: boolean
  onChange: (updater: (p: SystemPolicies) => SystemPolicies) => void
  onReset: () => void
  onSave: () => Promise<void>
}

export function PipelinePoliciesTab({
  policies,
  dirty,
  canEdit,
  saving,
  savedSuccess,
  onChange,
  onReset,
  onSave,
}: PipelinePoliciesTabProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-6 nl-surface rounded-2xl border border-slate-700/50 p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-white font-bold text-base">Políticas del Pipeline ML</h3>
            </div>
            {!canEdit && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                <Lock className="w-3 h-3" />
                Solo lectura
              </span>
            )}
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
            <label className="text-slate-200 text-xs font-semibold block">
              Partición Estándar (Train / Validación / Test)
            </label>
            <SystemSelect
              value={policies.dataset_split_ratio}
              disabled={!canEdit}
              size="sm"
              ariaLabel="Proporción estándar de partición del dataset"
              onChange={val => onChange(p => ({ ...p, dataset_split_ratio: val }))}
              options={[
                { value: '70/15/15', label: '70% Train · 15% Val · 15% Test', description: 'Balance recomendado para aislamiento estricto' },
                { value: '80/10/10', label: '80% Train · 10% Val · 10% Test', description: 'Prioriza volumen de entrenamiento' },
                { value: '60/20/20', label: '60% Train · 20% Val · 20% Test', description: 'Validación y test reforzados' },
              ]}
            />
          </div>

          <NumericStepperField
            label="Umbral mínimo de Accuracy para certificación"
            value={policies.min_certification_accuracy}
            min={50}
            max={99}
            step={1}
            unit="%"
            info="Accuracy mínimo requerido en la partición Test sellada para sugerir aprobación."
            disabled={!canEdit}
            onChange={v => onChange(p => ({ ...p, min_certification_accuracy: v }))}
          />

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-xs font-bold">Early Stopping por defecto</p>
                <p className="text-slate-400 text-[11px]">Detiene entrenamientos si val_loss deja de mejorar</p>
              </div>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onChange(p => ({ ...p, early_stopping_enabled: !p.early_stopping_enabled }))}
                aria-label="Alternar Early Stopping por defecto"
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${policies.early_stopping_enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${policies.early_stopping_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {policies.early_stopping_enabled && (
              <NumericStepperField
                label="Paciencia de Early Stopping"
                value={policies.early_stopping_patience}
                min={2}
                max={30}
                step={1}
                unit="épocas"
                disabled={!canEdit}
                onChange={v => onChange(p => ({ ...p, early_stopping_patience: v }))}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div>
              <p className="text-white text-xs font-bold">Aprobación automática de modelos</p>
              <p className="text-slate-400 text-[11px]">Publicar automáticamente al superar el umbral sin revisión manual</p>
            </div>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onChange(p => ({ ...p, auto_approve_models: !p.auto_approve_models }))}
              aria-label="Alternar aprobación automática de modelos"
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${policies.auto_approve_models ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${policies.auto_approve_models ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 nl-surface rounded-2xl border border-slate-700/50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-white font-bold text-base">Seguridad, Sesión y Trazabilidad</h3>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
            <label className="text-slate-200 text-xs font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Expiración de sesión por inactividad</span>
            </label>
            <SystemSelect
              value={String(policies.session_timeout_minutes)}
              disabled={!canEdit}
              size="sm"
              ariaLabel="Tiempo de expiración de sesión"
              onChange={val => onChange(p => ({ ...p, session_timeout_minutes: Number(val) }))}
              options={[
                { value: '30', label: '30 minutos', description: 'Alta seguridad para estaciones compartidas' },
                { value: '120', label: '2 horas', description: 'Balance estándar de oficina' },
                { value: '480', label: '8 horas (Jornada)', description: 'Recomendado para sesiones largas de entrenamiento' },
                { value: '1440', label: '24 horas', description: 'Monitoreo continuo sin cierre frecuente' },
              ]}
            />
          </div>

          <div className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-bold">Exigir verificación SHA-256 al exportar</p>
                <p className="text-slate-400 text-[11px]">Valida integridad criptográfica antes de descargar artefactos .keras</p>
              </div>
            </div>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onChange(p => ({ ...p, require_sha256_export: !p.require_sha256_export }))}
              aria-label="Exigir firma SHA-256"
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${policies.require_sha256_export ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${policies.require_sha256_export ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-bold">Auditoría estricta de inferencias y PDF</p>
                <p className="text-slate-400 text-[11px]">Registrar cada simulación de inferencia y exportación ejecutiva en bitácora</p>
              </div>
            </div>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onChange(p => ({ ...p, strict_inference_audit: !p.strict_inference_audit }))}
              aria-label="Alternar auditoría estricta"
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${policies.strict_inference_audit ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${policies.strict_inference_audit ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="nl-surface rounded-2xl border border-slate-700/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs">
          {!canEdit ? (
            <span className="text-amber-300/90">Solo el Administrador puede modificar políticas globales.</span>
          ) : dirty ? (
            <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Tienes cambios pendientes por guardar
            </span>
          ) : savedSuccess ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Políticas guardadas en el servidor
            </span>
          ) : (
            <span className="text-slate-400">Políticas sincronizadas con el backend.</span>
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
            <span>{saving ? 'Guardando...' : 'Guardar Políticas'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

