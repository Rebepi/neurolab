import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, ScrollText, X } from 'lucide-react'
import type { AuditEvent } from '../../../types'
import { ACTION_BADGE } from '../constants'
import { useToast } from '../../../components/toast/ToastContext'

interface AuditDetailModalProps {
  event: AuditEvent
  onClose: () => void
}

export function AuditDetailModal({ event, onClose }: AuditDetailModalProps) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const formattedJson = JSON.stringify(event.metadata ?? {}, null, 2)

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
    toast.success('Evento copiado al portapapeles', `Acción: ${event.action}`)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-modal-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl nl-surface rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden animate-pop-in"
      >
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <ScrollText className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 id="audit-detail-modal-title" className="text-white font-bold text-base">
                Detalle del Evento de Auditoría
              </h3>
              <p className="text-slate-400 text-xs font-mono">{event.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle de auditoría"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Acción</p>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold ${ACTION_BADGE[event.action] || 'bg-slate-700 text-slate-300'}`}>
                {event.action}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Marca Temporal</p>
              <p className="text-slate-200 font-mono mt-1">
                {new Date(event.created_at).toLocaleString('es-ES')}
              </p>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Actor Responsable</p>
              <p className="text-white font-semibold mt-1">{event.actor_name}</p>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Proyecto Asociado</p>
              <p className="text-slate-300 font-mono mt-1 truncate">{event.project_id || 'Nivel Sistema'}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Payload / Metadatos JSON</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'JSON Copiado' : 'Copiar Evento'}</span>
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-60 overflow-y-auto">
              {formattedJson}
            </pre>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

