import { Check, Cpu, Dices, Gauge, Lock, RefreshCw, RotateCcw, Server, Sparkles, Zap } from 'lucide-react'
import type { ComputeTelemetry, SystemQuotas } from '../../../types'
import { InfoTip } from '../../../components/InfoTip'
import { NumericStepperField } from './NumericStepperField'
import { ToggleRow } from './ToggleRow'
import { QUOTA_PRESETS, QUOTA_RANGES, applyQuotaPreset, detectQuotaPreset } from '../schema'

interface ComputeQuotasTabProps {
  quotas: SystemQuotas
  serverQuotas: SystemQuotas
  canEdit: boolean
  telemetry: ComputeTelemetry | null
  telemetryLoading: boolean
  onRefreshTelemetry: () => void
  onChange: (updater: (q: SystemQuotas) => SystemQuotas) => void
  onResetToRecommended?: () => void
  onAutoSaveField?: (field: 'gpu_acceleration' | 'mixed_precision', value: boolean, label: string) => void
}

function fmt(value: number | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function UsageBar({ pct }: { pct: number }) {
  const safe = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0
  const tone = safe >= 85 ? 'bg-rose-400' : safe >= 65 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${safe}%` }} />
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
  pct,
}: {
  label: string
  value: string
  sub?: string
  pct?: number
}) {
  return (
    <div className="bg-slate-950/65 border border-slate-800/80 rounded-xl p-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className="text-slate-100 font-mono font-bold text-xs truncate" title={value}>
        {value}
      </p>
      {pct !== undefined && <UsageBar pct={pct} />}
      {sub && <p className="text-[10px] text-slate-500 font-mono">{sub}</p>}
    </div>
  )
}

export function ComputeQuotasTab({
  quotas,
  serverQuotas,
  canEdit,
  telemetry,
  telemetryLoading,
  onRefreshTelemetry,
  onChange,
  onResetToRecommended,
  onAutoSaveField,
}: ComputeQuotasTabProps) {
  const activePresetId = detectQuotaPreset(quotas)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-7 nl-cyber-panel animate-card-reveal rounded-2xl p-6 space-y-4">
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
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Perfil de recursos</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {QUOTA_PRESETS.map(preset => {
              const active = activePresetId === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onChange(q => applyQuotaPreset(q, preset))}
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
                    {preset.values.max_concurrent_jobs} jobs · {preset.values.max_epochs_per_job} épocas ·{' '}
                    {preset.values.max_dataset_mb} MB
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <NumericStepperField
            label="Trabajos concurrentes máximos"
            value={quotas.max_concurrent_jobs}
            baseline={serverQuotas.max_concurrent_jobs}
            {...QUOTA_RANGES.max_concurrent_jobs}
            info="Máximo de entrenamientos simultáneos permitidos en cola."
            disabled={!canEdit}
            onChange={v => onChange(q => ({ ...q, max_concurrent_jobs: v }))}
          />

          <NumericStepperField
            label="Épocas máximas por trabajo"
            value={quotas.max_epochs_per_job}
            baseline={serverQuotas.max_epochs_per_job}
            {...QUOTA_RANGES.max_epochs_per_job}
            info="Tope configurable al lanzar nuevos entrenamientos en Keras."
            disabled={!canEdit}
            onChange={v => onChange(q => ({ ...q, max_epochs_per_job: v }))}
          />

          <NumericStepperField
            label="Tamaño máximo de dataset"
            value={quotas.max_dataset_mb}
            baseline={serverQuotas.max_dataset_mb}
            {...QUOTA_RANGES.max_dataset_mb}
            info="Peso máximo permitido por archivo CSV subido al estudio."
            disabled={!canEdit}
            onChange={v => onChange(q => ({ ...q, max_dataset_mb: v }))}
          />

          <NumericStepperField
            label="Batch Size máximo permitido"
            value={quotas.max_batch_size ?? 128}
            baseline={serverQuotas.max_batch_size ?? 128}
            {...QUOTA_RANGES.max_batch_size}
            info="Límite superior de muestras por lote durante retropropagación."
            disabled={!canEdit}
            onChange={v => onChange(q => ({ ...q, max_batch_size: v }))}
          />
        </div>

        <NumericStepperField
          label="Retención de auditoría y artefactos (.keras)"
          value={quotas.retention_days}
          baseline={serverQuotas.retention_days}
          {...QUOTA_RANGES.retention_days}
          info="Periodo mínimo de conservación de modelos, métricas y registros de auditoría."
          disabled={!canEdit}
          onChange={v => onChange(q => ({ ...q, retention_days: v }))}
        />
      </div>

      <div className="lg:col-span-5 space-y-5">
        <div className="nl-cyber-panel animate-card-reveal nl-stagger-1 rounded-2xl p-6 space-y-3.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-white font-bold text-base">Hardware y Reproducibilidad</h3>
          </div>

          <ToggleRow
            title="Aceleración GPU / AVX2"
            description="Priorizar instrucciones vectoriales y GPU en TensorFlow"
            icon={<Cpu className="w-4 h-4 text-cyan-400" />}
            iconBoxCls="bg-cyan-500/15 border-cyan-500/30"
            checked={quotas.gpu_acceleration}
            baseline={serverQuotas.gpu_acceleration}
            disabled={!canEdit}
            autoSave={Boolean(onAutoSaveField)}
            onChange={next => {
              if (onAutoSaveField) {
                onAutoSaveField('gpu_acceleration', next, 'Aceleración GPU')
              } else {
                onChange(q => ({ ...q, gpu_acceleration: next }))
              }
            }}
          />

          <ToggleRow
            title="Precisión Mixta (FP16)"
            description="Acelera cómputo de tensores manteniendo estabilidad en gradientes"
            icon={<Zap className="w-4 h-4 text-amber-400" />}
            iconBoxCls="bg-amber-500/15 border-amber-500/30"
            checked={quotas.mixed_precision ?? false}
            baseline={serverQuotas.mixed_precision ?? false}
            disabled={!canEdit}
            autoSave={Boolean(onAutoSaveField)}
            onChange={next => {
              if (onAutoSaveField) {
                onAutoSaveField('mixed_precision', next, 'Precisión Mixta FP16')
              } else {
                onChange(q => ({ ...q, mixed_precision: next }))
              }
            }}
          />

          <NumericStepperField
            label="Semilla Aleatoria Global (Random Seed)"
            value={quotas.random_seed ?? 42}
            baseline={serverQuotas.random_seed ?? 42}
            {...QUOTA_RANGES.random_seed}
            showSlider={false}
            info="Fija la reproducibilidad de particiones Train/Val/Test y la inicialización de pesos."
            disabled={!canEdit}
            action={
              <button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  onChange(q => ({ ...q, random_seed: Math.floor(Math.random() * 100000) }))
                }
                title="Generar una semilla aleatoria"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-[10px] font-bold disabled:opacity-45 transition-colors"
              >
                <Dices className="w-3 h-3" />
                <span>Aleatoria</span>
              </button>
            }
            onChange={v => onChange(q => ({ ...q, random_seed: v }))}
          />
        </div>

        <div className="nl-cyber-panel animate-card-reveal nl-stagger-2 rounded-2xl p-6 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <h3 className="text-white font-bold text-base">Capacidad Real del Servidor</h3>
            </div>
            <button
              type="button"
              onClick={onRefreshTelemetry}
              disabled={telemetryLoading}
              title="Actualizar telemetría"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${telemetryLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {telemetry ? (
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="Dispositivo ML" value={telemetry.runtime_device || '—'} />
              <StatTile
                label="CPU"
                value={`${telemetry.cpu_cores ?? '—'} núcleos`}
                sub={`Uso ${fmt(telemetry.cpu_pct, 0)}%`}
                pct={telemetry.cpu_pct}
              />
              <StatTile
                label="Memoria RAM"
                value={`${fmt(telemetry.ram_used_gb)} / ${fmt(telemetry.ram_total_gb)} GB`}
                sub={`Uso ${fmt(telemetry.ram_pct, 0)}%`}
                pct={telemetry.ram_pct}
              />
              <StatTile
                label="Disco"
                value={`${fmt(telemetry.disk_used_gb, 0)} / ${fmt(telemetry.disk_total_gb, 0)} GB`}
                sub={`Uso ${fmt(telemetry.disk_pct, 0)}%`}
                pct={telemetry.disk_pct}
              />
              <StatTile
                label="Datasets almacenados"
                value={`${fmt(telemetry.datasets_storage_mb)} MB`}
                sub={`Tope por CSV ${quotas.max_dataset_mb} MB`}
              />
              <StatTile
                label="Modelos (.keras)"
                value={`${fmt(telemetry.models_storage_mb)} MB`}
                sub={`Retención ${quotas.retention_days} días`}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              {telemetryLoading
                ? 'Consultando telemetría del servidor...'
                : 'Telemetría no disponible en este momento.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
