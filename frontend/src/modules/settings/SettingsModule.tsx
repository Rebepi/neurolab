import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  AlertTriangle,
  Cpu,
  Download,
  Palette,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import { api } from '../../services/api'
import type { ComputeTelemetry, SystemPolicies, SystemQuotas, User } from '../../types'
import { ComputeQuotasTab } from './components/ComputeQuotasTab'
import { PipelinePoliciesTab } from './components/PipelinePoliciesTab'
import { AppearanceSettingsCard } from './components/AppearanceSettingsCard'
import { SettingsActionBar } from './components/SettingsActionBar'
import {
  POLICY_LABELS,
  QUOTA_LABELS,
  RECOMMENDED_POLICIES,
  RECOMMENDED_QUOTAS,
  buildSettingsBundle,
  diffSettings,
  downloadSettingsBundle,
  parseSettingsBundle,
} from './schema'
import { useToast } from '../../components/toast/ToastContext'

type SettingsTab = 'compute' | 'pipeline' | 'appearance'

const TABS: Array<{ id: SettingsTab; label: string; Icon: typeof Cpu }> = [
  { id: 'compute', label: 'Cómputo & Cuotas', Icon: Cpu },
  { id: 'pipeline', label: 'Pipeline & Seguridad', Icon: SlidersHorizontal },
  { id: 'appearance', label: 'Apariencia & Entorno', Icon: Palette },
]

export default function SettingsModule({ currentUser }: { currentUser: User | null }) {
  const { success: notifySuccess, error: notifyError, info: notifyInfo } = useToast()
  const [activeTab, setActiveTab] = useState<SettingsTab>('compute')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [serverQuotas, setServerQuotas] = useState<SystemQuotas>(RECOMMENDED_QUOTAS)
  const [localQuotas, setLocalQuotas] = useState<SystemQuotas>(RECOMMENDED_QUOTAS)
  const [savingQuotas, setSavingQuotas] = useState(false)

  const [serverPolicies, setServerPolicies] = useState<SystemPolicies>(RECOMMENDED_POLICIES)
  const [localPolicies, setLocalPolicies] = useState<SystemPolicies>(RECOMMENDED_POLICIES)
  const [savingPolicies, setSavingPolicies] = useState(false)

  const [telemetry, setTelemetry] = useState<ComputeTelemetry | null>(null)
  const [telemetryLoading, setTelemetryLoading] = useState(false)

  const importInputRef = useRef<HTMLInputElement | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const [q, p] = await Promise.all([api.getSystemQuotas(), api.getSystemPolicies()])
      const mergedQ = { ...RECOMMENDED_QUOTAS, ...q }
      const mergedP = { ...RECOMMENDED_POLICIES, ...p }
      setServerQuotas(mergedQ)
      setLocalQuotas(mergedQ)
      setServerPolicies(mergedP)
      setLocalPolicies(mergedP)
      setLoadError(false)
    } catch (e: unknown) {
      setLoadError(true)
      notifyError(
        'No se pudo cargar la configuración',
        e instanceof Error ? e.message : 'El servidor no respondió'
      )
    } finally {
      setLoading(false)
    }
  }, [notifyError])

  const refreshTelemetry = useCallback(async () => {
    setTelemetryLoading(true)
    try {
      const overview = await api.getOverview()
      setTelemetry(overview.compute_telemetry ?? null)
    } catch {
      setTelemetry(null)
    } finally {
      setTelemetryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
    refreshTelemetry()
  }, [loadSettings, refreshTelemetry])

  const isAdmin = currentUser?.role === 'Administrador'
  const canEdit = isAdmin && !loadError && !loading

  const quotaChanges = useMemo(
    () => diffSettings(serverQuotas, localQuotas, QUOTA_LABELS),
    [serverQuotas, localQuotas]
  )
  const policyChanges = useMemo(
    () => diffSettings(serverPolicies, localPolicies, POLICY_LABELS),
    [serverPolicies, localPolicies]
  )
  const quotasDirty = quotaChanges.length > 0
  const policiesDirty = policyChanges.length > 0

  async function handleAutoSaveQuotaField<K extends keyof SystemQuotas>(
    field: K,
    value: SystemQuotas[K],
    label: string
  ) {
    if (!canEdit) return
    const prevServer = serverQuotas
    const nextServer = { ...serverQuotas, [field]: value }
    setServerQuotas(nextServer)
    setLocalQuotas(prev => ({ ...prev, [field]: value }))
    try {
      await api.updateSystemQuotas(nextServer)
      notifySuccess('Guardado automático', `${label} actualizado`)
    } catch (e: unknown) {
      setServerQuotas(prevServer)
      setLocalQuotas(prev => ({ ...prev, [field]: prevServer[field] }))
      notifyError(
        'Error al guardar',
        e instanceof Error ? e.message : 'No se pudo actualizar el parámetro'
      )
    }
  }

  async function handleAutoSavePolicyField<K extends keyof SystemPolicies>(
    field: K,
    value: SystemPolicies[K],
    label: string
  ) {
    if (!canEdit) return
    const prevServer = serverPolicies
    const nextServer = { ...serverPolicies, [field]: value }
    setServerPolicies(nextServer)
    setLocalPolicies(prev => ({ ...prev, [field]: value }))
    try {
      await api.updateSystemPolicies(nextServer)
      notifySuccess('Guardado automático', `${label} actualizado`)
    } catch (e: unknown) {
      setServerPolicies(prevServer)
      setLocalPolicies(prev => ({ ...prev, [field]: prevServer[field] }))
      notifyError(
        'Error al guardar',
        e instanceof Error ? e.message : 'No se pudo actualizar la política'
      )
    }
  }

  function handleResetQuotasToRecommended() {
    setLocalQuotas(RECOMMENDED_QUOTAS)
    notifyInfo('Valores recomendados cargados', 'Revisa los cambios y pulsa Guardar para aplicarlos')
  }

  function handleResetPoliciesToRecommended() {
    setLocalPolicies(RECOMMENDED_POLICIES)
    notifyInfo('Valores recomendados cargados', 'Revisa los cambios y pulsa Guardar para aplicarlos')
  }

  async function handleSaveQuotas() {
    if (!canEdit) return
    setSavingQuotas(true)
    try {
      const saved = await api.updateSystemQuotas(localQuotas)
      const merged = { ...RECOMMENDED_QUOTAS, ...saved }
      setServerQuotas(merged)
      setLocalQuotas(merged)
      notifySuccess('Cuotas guardadas', 'Parámetros de cómputo sincronizados con el servidor')
    } catch (e: unknown) {
      notifyError(
        'Error al guardar cuotas',
        e instanceof Error ? e.message : 'No se pudieron guardar las cuotas de cómputo'
      )
    } finally {
      setSavingQuotas(false)
    }
  }

  async function handleSavePolicies() {
    if (!canEdit) return
    setSavingPolicies(true)
    try {
      const saved = await api.updateSystemPolicies(localPolicies)
      const merged = { ...RECOMMENDED_POLICIES, ...saved }
      setServerPolicies(merged)
      setLocalPolicies(merged)
      notifySuccess('Políticas guardadas', 'Reglas de pipeline y seguridad sincronizadas')
    } catch (e: unknown) {
      notifyError(
        'Error al guardar políticas',
        e instanceof Error ? e.message : 'No se pudieron guardar las políticas globales'
      )
    } finally {
      setSavingPolicies(false)
    }
  }

  async function handleSaveAll() {
    if (quotasDirty) await handleSaveQuotas()
    if (policiesDirty) await handleSavePolicies()
  }

  function handleExport() {
    downloadSettingsBundle(buildSettingsBundle(serverQuotas, serverPolicies))
    notifySuccess('Configuración exportada', 'Se descargó el archivo con los valores guardados')
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !canEdit) return
    try {
      const text = await file.text()
      const parsed = parseSettingsBundle(text, localQuotas, localPolicies)
      setLocalQuotas(parsed.quotas)
      setLocalPolicies(parsed.policies)
      notifySuccess('Configuración importada', 'Revisa los cambios pendientes y pulsa Guardar')
    } catch (err: unknown) {
      notifyError(
        'No se pudo importar',
        err instanceof Error ? err.message : 'El archivo no es válido'
      )
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl p-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap gap-1 w-fit">
          {TABS.map(({ id, label, Icon }) => {
            const count = id === 'compute' ? quotaChanges.length : id === 'pipeline' ? policyChanges.length : 0
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  activeTab === id
                    ? 'nl-accent-bg nl-accent-glow text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-400/90 text-slate-950 text-[10px] font-mono font-bold">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-950/75 border border-slate-800 rounded-xl px-3 py-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Split {serverPolicies.dataset_split_ratio} · Seed {serverQuotas.random_seed ?? 42} ·{' '}
              {serverQuotas.gpu_acceleration ? 'GPU/AVX2 ON' : 'CPU'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={loading || loadError}
            className="px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Exportar</span>
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={!canEdit}
                className="px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Importar</span>
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFile}
              />
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div className="nl-cyber-panel rounded-2xl px-5 py-3.5 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="inline-flex items-center gap-2 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            No se pudo leer la configuración del servidor. Los valores mostrados son solo de
            referencia y el guardado está deshabilitado.
          </span>
          <button
            type="button"
            onClick={loadSettings}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 shrink-0">
          <div className="lg:col-span-7 nl-skeleton rounded-2xl h-96" />
          <div className="lg:col-span-5 nl-skeleton rounded-2xl h-96" />
        </div>
      ) : (
        <div key={activeTab} className="animate-module-enter shrink-0">
          {activeTab === 'compute' && (
            <ComputeQuotasTab
              quotas={localQuotas}
              serverQuotas={serverQuotas}
              canEdit={canEdit}
              telemetry={telemetry}
              telemetryLoading={telemetryLoading}
              onRefreshTelemetry={refreshTelemetry}
              onChange={setLocalQuotas}
              onResetToRecommended={handleResetQuotasToRecommended}
              onAutoSaveField={handleAutoSaveQuotaField}
            />
          )}

          {activeTab === 'pipeline' && (
            <PipelinePoliciesTab
              policies={localPolicies}
              serverPolicies={serverPolicies}
              canEdit={canEdit}
              onChange={setLocalPolicies}
              onResetToRecommended={handleResetPoliciesToRecommended}
              onAutoSaveField={handleAutoSavePolicyField}
            />
          )}

          {activeTab === 'appearance' && (
            <AppearanceSettingsCard currentUser={currentUser} telemetry={telemetry} />
          )}
        </div>
      )}

      {activeTab === 'compute' && (
        <SettingsActionBar
          canEdit={canEdit}
          dirty={quotasDirty}
          saving={savingQuotas}
          changes={quotaChanges}
          readOnlyMessage="Solo el Administrador puede modificar cuotas de cómputo."
          idleMessage="Parámetros sincronizados con el backend."
          saveLabel="Guardar Cómputo y Cuotas"
          onDiscard={() => setLocalQuotas(serverQuotas)}
          onReset={handleResetQuotasToRecommended}
          onSave={handleSaveQuotas}
          otherPendingCount={policyChanges.length}
          onSaveAll={handleSaveAll}
        />
      )}

      {activeTab === 'pipeline' && (
        <SettingsActionBar
          canEdit={canEdit}
          dirty={policiesDirty}
          saving={savingPolicies}
          changes={policyChanges}
          readOnlyMessage="Solo el Administrador puede modificar políticas globales."
          idleMessage="Políticas sincronizadas con el backend."
          saveLabel="Guardar Políticas"
          onDiscard={() => setLocalPolicies(serverPolicies)}
          onReset={handleResetPoliciesToRecommended}
          onSave={handleSavePolicies}
          otherPendingCount={quotaChanges.length}
          onSaveAll={handleSaveAll}
        />
      )}
    </div>
  )
}
