import { useState, useEffect } from 'react'
import { Cpu, Palette, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { api } from '../../services/api'
import type { SystemPolicies, SystemQuotas, User } from '../../types'
import { ComputeQuotasTab } from './components/ComputeQuotasTab'
import { PipelinePoliciesTab } from './components/PipelinePoliciesTab'
import { AppearanceSettingsCard } from './components/AppearanceSettingsCard'
import { useToast } from '../../components/toast/ToastContext'

type SettingsTab = 'compute' | 'pipeline' | 'appearance'

const DEFAULT_QUOTAS: SystemQuotas = {
  max_concurrent_jobs: 4,
  max_epochs_per_job: 100,
  max_dataset_mb: 50,
  gpu_acceleration: true,
  retention_days: 90,
  max_batch_size: 128,
  mixed_precision: false,
  random_seed: 42,
}

const DEFAULT_POLICIES: SystemPolicies = {
  dataset_split_ratio: '70/15/15',
  min_certification_accuracy: 75,
  auto_approve_models: false,
  early_stopping_enabled: true,
  early_stopping_patience: 5,
  session_timeout_minutes: 480,
  strict_inference_audit: true,
  require_sha256_export: true,
}

const TABS: Array<{ id: SettingsTab; label: string; Icon: typeof Cpu }> = [
  { id: 'compute', label: 'Cómputo & Cuotas', Icon: Cpu },
  { id: 'pipeline', label: 'Pipeline & Seguridad', Icon: SlidersHorizontal },
  { id: 'appearance', label: 'Apariencia & Entorno', Icon: Palette },
]

export default function SettingsModule({ currentUser }: { currentUser: User | null }) {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<SettingsTab>('compute')
  const [serverQuotas, setServerQuotas] = useState<SystemQuotas>(DEFAULT_QUOTAS)
  const [localQuotas, setLocalQuotas] = useState<SystemQuotas>(DEFAULT_QUOTAS)
  const [savingQuotas, setSavingQuotas] = useState(false)

  const [serverPolicies, setServerPolicies] = useState<SystemPolicies>(DEFAULT_POLICIES)
  const [localPolicies, setLocalPolicies] = useState<SystemPolicies>(DEFAULT_POLICIES)
  const [savingPolicies, setSavingPolicies] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      api.getSystemQuotas().catch(() => DEFAULT_QUOTAS),
      api.getSystemPolicies().catch(() => DEFAULT_POLICIES),
    ]).then(([q, p]) => {
      if (!active) return
      const mergedQ = { ...DEFAULT_QUOTAS, ...q }
      const mergedP = { ...DEFAULT_POLICIES, ...p }
      setServerQuotas(mergedQ)
      setLocalQuotas(mergedQ)
      setServerPolicies(mergedP)
      setLocalPolicies(mergedP)
    })
    return () => {
      active = false
    }
  }, [])

  const canEdit = currentUser?.role === 'Administrador'
  const quotasDirty = JSON.stringify(localQuotas) !== JSON.stringify(serverQuotas)
  const policiesDirty = JSON.stringify(localPolicies) !== JSON.stringify(serverPolicies)

  async function handleSaveQuotas() {
    if (!canEdit) return
    setSavingQuotas(true)
    try {
      const saved = await api.updateSystemQuotas(localQuotas)
      const merged = { ...DEFAULT_QUOTAS, ...saved }
      setServerQuotas(merged)
      setLocalQuotas(merged)
      toast.success('Cuotas guardadas', 'Parámetros de cómputo sincronizados con el servidor')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'No se pudieron guardar las cuotas de cómputo'
      toast.error('Error al guardar cuotas', message)
    } finally {
      setSavingQuotas(false)
    }
  }

  async function handleSavePolicies() {
    if (!canEdit) return
    setSavingPolicies(true)
    try {
      const saved = await api.updateSystemPolicies(localPolicies)
      const merged = { ...DEFAULT_POLICIES, ...saved }
      setServerPolicies(merged)
      setLocalPolicies(merged)
      toast.success('Políticas guardadas', 'Reglas de pipeline y seguridad sincronizadas')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'No se pudieron guardar las políticas globales'
      toast.error('Error al guardar políticas', message)
    } finally {
      setSavingPolicies(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-slate-900/60 rounded-xl border border-slate-700/50 w-fit">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === id
                  ? 'nl-accent-bg nl-accent-glow text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {id === 'compute' && quotasDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />}
              {id === 'pipeline' && policiesDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Split {serverPolicies.dataset_split_ratio} · Seed {serverQuotas.random_seed ?? 42} · {serverQuotas.gpu_acceleration ? 'GPU/AVX2 ON' : 'CPU'}</span>
        </div>
      </div>

      {activeTab === 'compute' && (
        <ComputeQuotasTab
          quotas={localQuotas}
          dirty={quotasDirty}
          canEdit={canEdit}
          saving={savingQuotas}
          savedSuccess={false}
          onChange={setLocalQuotas}
          onReset={() => {
            setLocalQuotas(DEFAULT_QUOTAS)
            toast.info('Valores recomendados cargados', 'Pulsa Guardar Cuotas para aplicar en el servidor')
          }}
          onSave={handleSaveQuotas}
        />
      )}

      {activeTab === 'pipeline' && (
        <PipelinePoliciesTab
          policies={localPolicies}
          dirty={policiesDirty}
          canEdit={canEdit}
          saving={savingPolicies}
          savedSuccess={false}
          onChange={setLocalPolicies}
          onReset={() => {
            setLocalPolicies(DEFAULT_POLICIES)
            toast.info('Valores recomendados cargados', 'Pulsa Guardar Políticas para aplicar en el servidor')
          }}
          onSave={handleSavePolicies}
        />
      )}

      {activeTab === 'appearance' && (
        <AppearanceSettingsCard currentUser={currentUser} />
      )}
    </div>
  )
}
