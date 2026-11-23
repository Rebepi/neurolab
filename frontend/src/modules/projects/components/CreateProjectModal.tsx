import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  Box,
  CheckCircle2,
  FolderPlus,
  Loader2,
  Play,
  RotateCw,
  Sparkles,
  Tag,
  User as UserIcon,
  X,
} from 'lucide-react'
import { api } from '../../../services/api'
import type { Project, User } from '../../../types'
import { SystemSelect } from '../../../components/SystemSelect'
import { useToast } from '../../../components/toast/ToastContext'
import { StatusDot, TagChip } from './ProjectBadges'
import { getAreaVisual, splitProjectTitle } from './ProjectCard'

interface CreateProjectModalProps {
  users: User[]
  onClose: () => void
  onCreated: (createdProject: Project) => void
}

const PROJECT_PRESETS = [
  {
    id: 'retencion',
    label: 'Retención / Churn',
    name: 'Área 05 · Retención Preventiva Fibra & Móvil',
    description:
      'Red neuronal para anticipar riesgo de baja voluntaria mediante historial de facturación, calidad de servicio y tickets de soporte.',
    tags: ['Retención', 'Clasificación Binaria', 'Producción'],
  },
  {
    id: 'noc',
    label: 'Red 5G & NOC',
    name: 'Área 06 · Monitoreo Predictivo NOC 5G',
    description:
      'Clasificador neuronal multiclase para detectar degradación térmica, potencia óptica anómala y congestión en nodos 5G.',
    tags: ['Ingeniería NOC', '5G/Fibra', 'Tiempo Real'],
  },
  {
    id: 'antifraude',
    label: 'Seguridad Antifraude',
    name: 'Área 07 · Escudo Antifraude & SIM-Swap',
    description:
      'Motor neuronal de baja latencia para interceptar recargas sospechosas, roaming anómalo y suplantación de identidad.',
    tags: ['Antifraude', 'Ciberseguridad', 'Tiempo Real'],
  },
  {
    id: 'comercial',
    label: 'Comercial LTV',
    name: 'Área 08 · Proyección Comercial & LTV',
    description:
      'Modelo neuronal de regresión continua para estimar valor proyectado de clientes residenciales y corporativos.',
    tags: ['Comercial', 'Regresión', 'Producción'],
  },
] as const

const TAG_SUGGESTIONS = [
  'Clasificación',
  'Regresión',
  '5G/Fibra',
  'Antifraude',
  'Producción',
  'Tiempo Real',
] as const

const MAX_TAGS = 8

function mergeUniqueTags(existing: string[], extraRaw: string): string[] {
  const result = [...existing]
  const seen = new Set(existing.map(t => t.toLowerCase()))
  const incoming = extraRaw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
  for (const item of incoming) {
    if (result.length >= MAX_TAGS) break
    const key = item.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }
  return result
}

const INPUT_GLASS_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-[#071123]/90 hover:bg-[#0b1933]/95 border border-cyan-500/25 focus:border-teal-400/80 focus:ring-2 focus:ring-teal-400/20 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all'

export function CreateProjectModal({
  users,
  onClose,
  onCreated,
}: CreateProjectModalProps) {
  const toast = useToast()
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? '')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => nameInputRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving && !document.querySelector('[role="listbox"]')) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])

  useEffect(() => {
    if (!ownerId && users.length > 0) {
      setOwnerId(users[0].id)
    }
  }, [ownerId, users])

  const selectedOwner = useMemo(
    () => users.find(u => u.id === ownerId) ?? users[0] ?? null,
    [ownerId, users]
  )

  const previewTags = useMemo(
    () => mergeUniqueTags(tags, tagDraft),
    [tags, tagDraft]
  )

  const previewName = name.trim() || 'Área IA · Nuevo Workspace'
  const { code: previewCode, title: previewTitle } = splitProjectTitle(previewName)
  const previewVisual = getAreaVisual({
    id: activePresetId ?? '',
    name: previewName,
  })
  const PreviewIcon = previewVisual.icon

  const hasAnyContent =
    Boolean(name.trim()) ||
    Boolean(description.trim()) ||
    tags.length > 0 ||
    Boolean(tagDraft.trim())

  function applyPreset(preset: (typeof PROJECT_PRESETS)[number]) {
    setActivePresetId(preset.id)
    setName(preset.name)
    setDescription(preset.description)
    setTags([...preset.tags])
    setTagDraft('')
    setFieldError(null)
    setServerError(null)
    nameInputRef.current?.focus()
  }

  function clearForm() {
    setActivePresetId(null)
    setName('')
    setDescription('')
    setTags([])
    setTagDraft('')
    setFieldError(null)
    setServerError(null)
    nameInputRef.current?.focus()
  }

  function commitTagDraft() {
    if (!tagDraft.trim()) return
    setTags(prev => mergeUniqueTags(prev, tagDraft))
    setTagDraft('')
  }

  function handleTagKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTagDraft()
      return
    }
    if (e.key === 'Backspace' && !tagDraft && tags.length > 0) {
      e.preventDefault()
      setTags(prev => prev.slice(0, -1))
    }
  }

  function removeTag(tagToRemove: string) {
    setTags(prev => prev.filter(t => t !== tagToRemove))
  }

  function toggleSuggestedTag(suggestion: string) {
    const exists = tags.some(t => t.toLowerCase() === suggestion.toLowerCase())
    if (exists) {
      setTags(prev => prev.filter(t => t.toLowerCase() !== suggestion.toLowerCase()))
    } else if (tags.length < MAX_TAGS) {
      setTags(prev => mergeUniqueTags(prev, suggestion))
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFieldError('Ingresa un nombre para identificar el proyecto o área.')
      toast.warning('Nombre requerido', 'Ingresa un nombre para crear el proyecto')
      nameInputRef.current?.focus()
      return
    }
    const finalTags = mergeUniqueTags(tags, tagDraft)
    setSaving(true)
    setFieldError(null)
    setServerError(null)
    try {
      const created = await api.createProject({
        name: trimmedName,
        description: description.trim(),
        owner_id: ownerId,
        tags: finalTags,
      })
      onCreated(created)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear proyecto'
      setServerError(msg)
      toast.error('Error al crear proyecto', msg)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-backdrop-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div className="relative nl-cyber-panel rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-pop-in">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-400/85 via-cyan-400/80 to-teal-400/85" />

        <div className="shrink-0 px-6 py-4 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-cyan-500/35 flex items-center justify-center shrink-0">
              <FolderPlus className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h2
                id="create-project-modal-title"
                className="text-base sm:text-lg font-bold text-white leading-tight"
              >
                Crear Nuevo Proyecto
              </h2>
              <p className="text-xs text-slate-400">
                Crea un workspace aislado para datasets, arquitecturas Keras, entrenamientos y modelos.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/45 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="w-3.5 h-3.5" />
                Plantillas rápidas por dominio
              </span>
              {hasAnyContent && (
                <button
                  type="button"
                  onClick={clearForm}
                  className="text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  Limpiar campos
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_PRESETS.map(preset => {
                const isSelected = activePresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-cyan-500/35 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          {serverError && (
            <div className="px-3.5 py-2.5 rounded-xl bg-red-900/35 border border-red-700/50 text-red-300 text-xs sm:text-sm">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              id="create-project-form"
              onSubmit={handleSubmit}
              className="lg:col-span-7 space-y-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="create-project-name" className="font-medium text-slate-200">
                    Nombre del proyecto <span className="text-cyan-400">*</span>
                  </label>
                  <span className="font-mono text-[11px] text-slate-500">{name.length}/80</span>
                </div>
                <input
                  id="create-project-name"
                  ref={nameInputRef}
                  type="text"
                  maxLength={80}
                  value={name}
                  onChange={e => {
                    setName(e.target.value)
                    if (fieldError && e.target.value.trim()) setFieldError(null)
                  }}
                  placeholder="Ej: Área 05 · Detección de Anomalías FTTH"
                  className={`${INPUT_GLASS_CLASS} ${
                    fieldError ? 'border-red-500/70 focus:border-red-400 focus:ring-red-400/20' : ''
                  }`}
                />
                {fieldError ? (
                  <p className="text-[11px] text-red-400">{fieldError}</p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Usa "Área 05 · Nombre" para generar insignia de área automática.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="create-project-desc" className="font-medium text-slate-200">
                    Descripción operativa
                  </label>
                  <span className="font-mono text-[11px] text-slate-500">
                    {description.length}/240
                  </span>
                </div>
                <textarea
                  id="create-project-desc"
                  rows={3}
                  maxLength={240}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe el problema de negocio, variables clave y objetivo del modelo..."
                  className={`${INPUT_GLASS_CLASS} resize-none`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-200">
                  Propietario responsable
                </label>
                <SystemSelect
                  value={ownerId}
                  onChange={setOwnerId}
                  size="md"
                  searchable
                  searchPlaceholder="Buscar por nombre, correo o rol..."
                  maxVisibleOptions={25}
                  ariaLabel="Propietario del proyecto"
                  options={users.map(u => ({
                    value: u.id,
                    label: u.display_name,
                    description: `${u.role} · ${u.email}`,
                    keywords: `${u.email} ${u.role}`,
                  }))}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                    <Tag className="w-3.5 h-3.5 text-cyan-400" />
                    Etiquetas
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {tags.length}/{MAX_TAGS}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl bg-[#071123]/90 hover:bg-[#0b1933]/95 border border-cyan-500/25 focus-within:border-teal-400/80 focus-within:ring-2 focus-within:ring-teal-400/20 transition-all">
                  {tags.map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs bg-indigo-900/60 border border-indigo-600/50 text-indigo-200"
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        aria-label={`Quitar etiqueta ${t}`}
                        className="p-0.5 rounded-full hover:bg-indigo-700/60 text-indigo-300 hover:text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length < MAX_TAGS && (
                    <input
                      type="text"
                      value={tagDraft}
                      onChange={e => setTagDraft(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      onBlur={commitTagDraft}
                      placeholder={
                        tags.length === 0
                          ? 'Escribe una etiqueta y presiona Enter...'
                          : 'Añadir otra...'
                      }
                      className="flex-1 min-w-32 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none"
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 mr-0.5">Sugerencias:</span>
                  {TAG_SUGGESTIONS.map(sugg => {
                    const active = tags.some(t => t.toLowerCase() === sugg.toLowerCase())
                    return (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => toggleSuggestedTag(sugg)}
                        className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                          active
                            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {active ? `✓ ${sugg}` : `+ ${sugg}`}
                      </button>
                    )
                  })}
                </div>
              </div>
            </form>

            <div className="lg:col-span-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Vista previa en vivo
                </span>
                <span className="text-[11px] font-mono text-slate-500">Tarjeta 3D</span>
              </div>

              <div className="relative nl-cyber-panel rounded-2xl p-4 flex flex-col justify-between gap-3.5 overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/80 via-teal-400/70 to-violet-500/80" />
                <div
                  className={`pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl ${previewVisual.glowClass}`}
                />

                <div className="space-y-3 relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${previewVisual.boxClass}`}
                      >
                        <PreviewIcon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 truncate">
                        {previewCode}
                      </span>
                    </div>
                    <StatusDot status="ACTIVE" />
                  </div>

                  <h3 className="font-bold text-sm sm:text-[15px] text-white leading-snug line-clamp-2 min-h-[2.4rem]">
                    {previewTitle}
                  </h3>

                  {previewTags.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {previewTags.slice(0, 3).map(t => (
                        <TagChip key={t} tag={t} />
                      ))}
                      {previewTags.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800/80 border border-slate-700/70 text-slate-300">
                          +{previewTags.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] border border-dashed border-slate-700 text-slate-500">
                      Sin etiquetas aún
                    </span>
                  )}
                </div>

                <div className="space-y-2 pt-2.5 border-t border-slate-800/75 relative">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-800/80 text-[11px]">
                      <Play className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="font-mono font-semibold text-white">0</span>
                      <span className="text-slate-400 truncate">ejecuciones</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-800/80 text-[11px]">
                      <Box className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="font-mono font-semibold text-white">0</span>
                      <span className="text-slate-400 truncate">modelos</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-slate-400 min-w-0">
                      <UserIcon className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {selectedOwner?.display_name ?? 'Sin asignar'}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-cyan-300/80 font-medium shrink-0">
                      <span>Ver descripción</span>
                      <RotateCw className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-900/45 p-3.5 space-y-1.5">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                  Reverso al girar
                </p>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {description.trim() ||
                    'La descripción operativa aparecerá en el reverso de la tarjeta.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5 space-y-2">
                {[
                  'Propietario asignado como Responsable de proyecto',
                  'Evento inicial registrado en Auditoría',
                  'Transición directa al Paso 02 · Datasets & Auto-EDA',
                ].map(item => (
                  <div key={item} className="flex items-start gap-2 text-[11px] text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                name.trim() ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'
              }`}
            />
            <span className={name.trim() ? 'text-emerald-300 font-medium' : 'text-slate-400'}>
              {name.trim() ? 'Listo para crear workspace' : 'Ingresa un nombre para continuar'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs sm:text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="create-project-form"
              disabled={saving || !name.trim()}
              className="nl-btn-shimmer inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creando...</span>
                </>
              ) : (
                <>
                  <span>Crear Proyecto</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
