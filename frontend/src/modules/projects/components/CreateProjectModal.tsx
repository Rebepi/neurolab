import { useState } from 'react'
import { api } from '../../../services/api'
import type { User } from '../../../types'
import { SystemSelect } from '../../../components/SystemSelect'
import { useToast } from '../../../components/toast/ToastContext'

interface CreateProjectModalProps {
  users: User[]
  onClose: () => void
  onCreated: () => void
}

export function CreateProjectModal({ users, onClose, onCreated }: CreateProjectModalProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? '')
  const [tagsRaw, setTagsRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) {
      setError('El nombre es requerido')
      toast.warning('Nombre requerido', 'Ingresa un nombre para crear el proyecto')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      await api.createProject({ name: name.trim(), description: description.trim(), owner_id: ownerId, tags })
      onCreated()
    } catch (e: any) {
      const msg = e.message ?? 'Error al crear proyecto'
      setError(msg)
      toast.error('Error al crear proyecto', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-950/70">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-7 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-5">Crear Nuevo Proyecto</h2>
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-900/40 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre</label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="Nombre del proyecto"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Descripción</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              rows={3}
              placeholder="Descripción del proyecto"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Propietario</label>
            <SystemSelect
              value={ownerId}
              onChange={setOwnerId}
              size="md"
              ariaLabel="Propietario del proyecto"
              options={users.map(u => ({
                value: u.id,
                label: u.display_name,
                description: u.role,
              }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (separados por coma)</label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="ia, clasificación, producción"
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}

