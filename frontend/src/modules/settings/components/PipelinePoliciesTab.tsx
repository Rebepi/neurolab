import { Check, Clock, FileCheck2, Lock, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import type { SystemPolicies } from '../../../types'
import { SystemSelect } from '../../../components/SystemSelect'
import { NumericStepperField } from './NumericStepperField'
import { ModifiedBadge, ToggleRow } from './ToggleRow'
import {
  POLICY_PRESETS,
  POLICY_RANGES,
  SESSION_OPTIONS,
  SPLIT_OPTIONS,
  computeSecurityPosture,
  detectPolicyPreset,
  formatSessionMinutes,
} from '../schema'

interface PipelinePoliciesTabProps {
  policies: SystemPolicies
  serverPolicies: SystemPolicies
  canEdit: boolean
  onChange: (updater: (p: SystemPolicies) => SystemPolicies) => void
  onResetToRecommended?: () => void
  onAutoSaveField?: (field: keyof SystemPolicies, value: any, label: string) => void
}

function SplitPreview({ ratio }: { ratio: string }) {
  const parts = ratio.split('/').map(Number)
  const [train, val, test] = parts.length === 3 && parts.every(Number.isFinite) ? parts : [70, 15, 15]
  return (
    <div className="space-y-1.5">
      <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-slate-900">
        <div className="h-full bg-indigo-400" style={{ width: `${train}%` }} />
        <div className="h-full bg-amber-400" style={{ width: `${val}%` }} />
        <div className="h-full bg-emerald-400" style={{ width: `${test}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          Train {train}%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Val {val}%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Test sellado {test}%
        </span>
      </div>
    </div>
  )
}

export function PipelinePoliciesTab({
  policies,
  serverPolicies,
  canEdit,
  onChange,
  onResetToRecommended,
  onAutoSaveField,
}: PipelinePoliciesTabProps) {
  const activePresetId = detectPolicyPreset(policies)
  const posture = computeSecurityPosture(policies)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-6 nl-cyber-panel animate-card-reveal rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-white font-bold text-base">Políticas del Pipeline ML</h3>
          </div>
          <div className="flex items-center gap-2">
            {!canEdit ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                <Lock className="w-3 h-3" />
                Solo lectura
              </span>
            ) : onResetToRecommended ? (
              <button
                type="button"
                onClick={onResetToRecommended}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-cyan-400" />
                <span>Valores Recomendados</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-cyan-400" />
            <span>Perfil de gobernanza</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {POLICY_PRESETS.map(preset => {
              const active = activePresetId === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onChange(() => ({ ...preset.values }))}
                  className={`text-left p-2.5 rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? 'bg-cyan-500/15 border-cyan-400/50'
                      : 'bg-slate-950/70 border-slate-800 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{preset.label}</span>
                    {active && <Check className="w-3.5 h-3.5 text-cyan-300" />}
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">{preset.subtitle}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-1">
                    {preset.values.dataset_split_ratio} · ≥{preset.values.min_certification_accuracy}% ·{' '}
                    {formatSessionMinutes(preset.values.session_timeout_minutes)}
                  </p>
                </button>
              )
            })}
          </div>
          {activePresetId === null && (
            <p className="text-[10.5px] text-amber-300/90">
              Perfil personalizado: los valores no coinciden con ningún perfil predefinido.
            </p>
          )}
        </div>

        <div
          className={`bg-slate-950/60 border rounded-xl p-3.5 space-y-2.5 transition-colors ${
            policies.dataset_split_ratio !== serverPolicies.dataset_split_ratio
              ? 'border-amber-500/40'
              : 'border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <label className="text-slate-200 text-xs font-semibold block">
              Partición Estándar (Train / Validación / Test)
            </label>
            {policies.dataset_split_ratio !== serverPolicies.dataset_split_ratio && (
              <ModifiedBadge
                disabled={!canEdit}
                onRevert={() =>
                  onChange(p => ({ ...p, dataset_split_ratio: serverPolicies.dataset_split_ratio }))
                }
              />
            )}
          </div>
          <SystemSelect
            value={policies.dataset_split_ratio}
            disabled={!canEdit}
            size="sm"
            ariaLabel="Proporción estándar de partición del dataset"
            onChange={val => onChange(p => ({ ...p, dataset_split_ratio: val }))}
            options={SPLIT_OPTIONS}
          />
          <SplitPreview ratio={policies.dataset_split_ratio} />
        </div>

        <NumericStepperField
          label="Umbral mínimo de Accuracy para certificación"
          value={policies.min_certification_accuracy}
          baseline={serverPolicies.min_certification_accuracy}
          {...POLICY_RANGES.min_certification_accuracy}
          info="Accuracy mínimo requerido en la partición Test sellada para sugerir aprobación."
          disabled={!canEdit}
          onChange={v => onChange(p => ({ ...p, min_certification_accuracy: v }))}
        />

        <ToggleRow
          title="Early Stopping por defecto"
          description="Detiene entrenamientos si val_loss deja de mejorar"
          checked={policies.early_stopping_enabled}
          baseline={serverPolicies.early_stopping_enabled}
          disabled={!canEdit}
          autoSave={Boolean(onAutoSaveField)}
          onChange={next => {
            if (onAutoSaveField) {
              onAutoSaveField('early_stopping_enabled', next, 'Early Stopping')
            } else {
              onChange(p => ({ ...p, early_stopping_enabled: next }))
            }
          }}
        />

        {policies.early_stopping_enabled && (
          <NumericStepperField
            label="Paciencia de Early Stopping"
            value={policies.early_stopping_patience}
            baseline={serverPolicies.early_stopping_patience}
            {...POLICY_RANGES.early_stopping_patience}
            disabled={!canEdit}
            onChange={v => onChange(p => ({ ...p, early_stopping_patience: v }))}
          />
        )}

        <ToggleRow
          title="Aprobación automática de modelos"
          description="Publicar automáticamente al superar el umbral sin revisión manual"
          checked={policies.auto_approve_models}
          baseline={serverPolicies.auto_approve_models}
          tone="amber"
          disabled={!canEdit}
          autoSave={Boolean(onAutoSaveField)}
          onChange={next => {
            if (onAutoSaveField) {
              onAutoSaveField('auto_approve_models', next, 'Aprobación automática')
            } else {
              onChange(p => ({ ...p, auto_approve_models: next }))
            }
          }}
        />
      </div>

      <div className="lg:col-span-6 space-y-5">
        <div className="nl-cyber-panel animate-card-reveal nl-stagger-1 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-white font-bold text-base">Seguridad, Sesión y Trazabilidad</h3>
          </div>

          <div
            className={`bg-slate-950/60 border rounded-xl p-3.5 space-y-2 transition-colors ${
              policies.session_timeout_minutes !== serverPolicies.session_timeout_minutes
                ? 'border-amber-500/40'
                : 'border-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <label className="text-slate-200 text-xs font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Expiración de sesión por inactividad</span>
                {onAutoSaveField && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[9.5px] font-mono border border-cyan-500/20">
                    Auto
                  </span>
                )}
              </label>
              {!onAutoSaveField && policies.session_timeout_minutes !== serverPolicies.session_timeout_minutes && (
                <ModifiedBadge
                  disabled={!canEdit}
                  onRevert={() =>
                    onChange(p => ({
                      ...p,
                      session_timeout_minutes: serverPolicies.session_timeout_minutes,
                    }))
                  }
                />
              )}
            </div>
            <SystemSelect
              value={String(policies.session_timeout_minutes)}
              disabled={!canEdit}
              size="sm"
              ariaLabel="Tiempo de expiración de sesión"
              onChange={val => {
                const num = Number(val)
                if (onAutoSaveField) {
                  onAutoSaveField('session_timeout_minutes', num, 'Tiempo de sesión')
                } else {
                  onChange(p => ({ ...p, session_timeout_minutes: num }))
                }
              }}
              options={SESSION_OPTIONS.map(o => ({
                value: String(o.value),
                label: o.label,
                description: o.description,
              }))}
            />
          </div>

          <ToggleRow
            title="Exigir verificación SHA-256 al exportar"
            description="Valida integridad criptográfica antes de descargar artefactos .keras"
            icon={<FileCheck2 className="w-4 h-4 text-emerald-400" />}
            iconBoxCls="bg-emerald-500/15 border-emerald-500/30"
            checked={policies.require_sha256_export}
            baseline={serverPolicies.require_sha256_export}
            disabled={!canEdit}
            autoSave={Boolean(onAutoSaveField)}
            onChange={next => {
              if (onAutoSaveField) {
                onAutoSaveField('require_sha256_export', next, 'Verificación SHA-256')
              } else {
                onChange(p => ({ ...p, require_sha256_export: next }))
              }
            }}
          />

          <ToggleRow
            title="Auditoría estricta de inferencias y PDF"
            description="Registrar cada simulación de inferencia y exportación ejecutiva en bitácora"
            icon={<ShieldCheck className="w-4 h-4 text-indigo-400" />}
            iconBoxCls="bg-indigo-500/15 border-indigo-500/30"
            checked={policies.strict_inference_audit}
            baseline={serverPolicies.strict_inference_audit}
            disabled={!canEdit}
            autoSave={Boolean(onAutoSaveField)}
            onChange={next => {
              if (onAutoSaveField) {
                onAutoSaveField('strict_inference_audit', next, 'Auditoría estricta')
              } else {
                onChange(p => ({ ...p, strict_inference_audit: next }))
              }
            }}
          />
        </div>

        <div className="nl-cyber-panel animate-card-reveal nl-stagger-2 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-white font-bold text-base">Postura de Seguridad</h3>
            <span className={`text-xs font-bold ${posture.toneCls}`}>
              {posture.label} · {posture.score}/{posture.total}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: posture.total }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full ${i < posture.score ? posture.barCls : 'bg-slate-800'}`}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            Se calcula con la configuración en pantalla: auditoría estricta, SHA-256 al exportar,
            revisión manual de modelos, sesión de 8 h o menos y umbral de accuracy de 75% o más.
          </p>
        </div>
      </div>
    </div>
  )
}
