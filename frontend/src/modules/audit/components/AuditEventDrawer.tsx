import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Fingerprint,
  Flag,
  FolderKanban,
  ScrollText,
  ShieldAlert,
  User,
  X,
} from 'lucide-react'
import type { AuditEvent } from '../../../types'
import {
  AUDIT_SEVERITY_META,
  type AuditMark,
  computeEventSha256,
  formatRelativeTime,
  getActionMeta,
  summarizeAuditMetadata,
} from '../constants'
import { useToast } from '../../../components/toast/ToastContext'

interface AuditEventDrawerProps {
  event: AuditEvent
  eventIndex: number
  totalCount: number
  projectName: string
  actorRole?: string
  mark?: AuditMark
  relatedEvents: AuditEvent[]
  projectMap: Map<string, string>
  onClose: () => void
  onSelectEvent: (ev: AuditEvent) => void
  onPrev: () => void
  onNext: () => void
  onSaveMark: (eventId: string, mark: AuditMark | null) => void
}

export function AuditEventDrawer({
  event,
  eventIndex,
  totalCount,
  projectName,
  actorRole,
  mark,
  relatedEvents,
  projectMap,
  onClose,
  onSelectEvent,
  onPrev,
  onNext,
  onSaveMark,
}: AuditEventDrawerProps) {
  const toast = useToast()
  const [showRawJson, setShowRawJson] = useState(false)
  const [sha256, setSha256] = useState<string>('')
  const [copiedKey, setCopiedKey] = useState<'json' | 'sha' | null>(null)
  const [markStatus, setMarkStatus] = useState<'flagged' | 'reviewed' | null>(mark?.status ?? null)
  const [noteText, setNoteText] = useState<string>(mark?.note ?? '')

  useEffect(() => {
    setMarkStatus(mark?.status ?? null)
    setNoteText(mark?.note ?? '')
  }, [event.id, mark?.note, mark?.status])

  useEffect(() => {
    let active = true
    computeEventSha256(event).then(hash => {
      if (active) setSha256(hash)
    })
    return () => {
      active = false
    }
  }, [event])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      const tag = (document.activeElement?.tagName || '').toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft' && eventIndex > 0) {
        e.preventDefault()
        onPrev()
      } else if (e.key === 'ArrowRight' && eventIndex < totalCount - 1) {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [eventIndex, onClose, onNext, onPrev, totalCount])

  const metaInfo = getActionMeta(event.action)
  const severityInfo = AUDIT_SEVERITY_META[metaInfo.severity]
  const structuredFields = summarizeAuditMetadata(event, projectMap)
  const rawMetadataEntries = Object.entries(event.metadata || {})
  const formattedJson = JSON.stringify(event.metadata ?? {}, null, 2)

  async function handleCopyJson() {
    await navigator.clipboard.writeText(JSON.stringify(event, null, 2)).catch(() => {})
    setCopiedKey('json')
    setTimeout(() => setCopiedKey(null), 1600)
    toast.success('Evento copiado al portapapeles', `${metaInfo.label} (${event.id})`)
  }

  async function handleCopySha() {
    if (!sha256) return
    await navigator.clipboard.writeText(sha256).catch(() => {})
    setCopiedKey('sha')
    setTimeout(() => setCopiedKey(null), 1600)
    toast.success('Huella SHA-256 copiada')
  }

  function handleSaveMark(nextStatus: 'flagged' | 'reviewed' | null, nextNote: string) {
    setMarkStatus(nextStatus)
    if (!nextStatus && !nextNote.trim()) {
      onSaveMark(event.id, null)
      return
    }
    onSaveMark(event.id, {
      status: nextStatus || 'reviewed',
      note: nextNote.trim(),
      updatedAt: new Date().toISOString(),
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex justify-end bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-drawer-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl h-full bg-[#061024] border-l border-cyan-500/35 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/65 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-400/35 flex items-center justify-center shrink-0">
              <ScrollText className="w-5 h-5 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="audit-drawer-title" className="text-white font-bold text-base truncate">
                  {metaInfo.label}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${severityInfo.pillCls}`}>
                  {severityInfo.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-slate-400">
                <span className={`px-2 py-0.5 rounded-md ${metaInfo.badgeCls}`}>
                  {event.action}
                </span>
                <span>· {event.id}</span>
                {eventIndex >= 0 && totalCount > 0 && (
                  <span className="text-cyan-300">
                    · {eventIndex + 1} de {totalCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar inspección de evento"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                <User className="w-3 h-3 text-cyan-400" />
                <span>Actor Responsable</span>
              </p>
              <p className="text-white font-bold">{event.actor_name}</p>
              <p className="text-[11px] text-slate-400 font-mono">
                {actorRole ? `${actorRole} · ` : ''}
                {event.actor_id}
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                <FolderKanban className="w-3 h-3 text-indigo-400" />
                <span>Área / Proyecto</span>
              </p>
              <p className="text-white font-bold truncate" title={projectName}>
                {projectName}
              </p>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {event.project_id || 'Nivel Sistema'}
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Marca Temporal</span>
              </p>
              <p className="text-slate-100 font-mono font-semibold">
                {new Date(event.created_at).toLocaleString('es-ES')}
              </p>
              <p className="text-[11px] text-cyan-300/90">
                {formatRelativeTime(event.created_at)}
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                <Fingerprint className="w-3 h-3 text-emerald-400" />
                <span>Integridad SHA-256 del Evento</span>
              </p>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] font-mono text-emerald-300 truncate">
                  {sha256 || 'Calculando huella...'}
                </span>
                {sha256 && (
                  <button
                    type="button"
                    onClick={handleCopySha}
                    title="Copiar SHA-256"
                    className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 shrink-0"
                  >
                    {copiedKey === 'sha' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500">
                Huella determinista de inmutabilidad forense
              </p>
            </div>
          </div>

          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {showRawJson ? 'Payload JSON Crudo' : 'Detalle Estructurado'}
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRawJson(v => !v)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  <Code2 className="w-3 h-3" />
                  <span>{showRawJson ? 'Ver estructurado' : 'Ver JSON crudo'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  {copiedKey === 'json' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-indigo-400" />
                  )}
                  <span>{copiedKey === 'json' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {showRawJson ? (
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-64 overflow-y-auto">
                {formattedJson}
              </pre>
            ) : (
              <div className="rounded-xl bg-slate-950/75 border border-slate-800 divide-y divide-slate-800/60">
                {structuredFields.length === 0 && rawMetadataEntries.length === 0 ? (
                  <p className="p-4 text-xs text-slate-400">
                    Este evento no registró metadatos adicionales.
                  </p>
                ) : (
                  (structuredFields.length > 0
                    ? structuredFields
                    : rawMetadataEntries.map(([k, v]) => ({
                        label: k,
                        value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—'),
                      }))
                  ).map(row => (
                    <div
                      key={`${row.label}-${row.value}`}
                      className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                    >
                      <span className="text-slate-400 font-semibold shrink-0">{row.label}</span>
                      <span className="text-white font-mono break-all sm:text-right">
                        {row.value}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          <section className="p-4 rounded-2xl bg-slate-950/65 border border-slate-800/90 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Revisión y Marcado Forense</span>
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSaveMark('flagged', noteText)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                    markStatus === 'flagged'
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <Flag className="w-3 h-3" />
                  <span>Seguimiento</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveMark('reviewed', noteText)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                    markStatus === 'reviewed'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Revisado</span>
                </button>
                {(markStatus || noteText.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setNoteText('')
                      handleSaveMark(null, '')
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-white"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Añade una nota de auditoría o hallazgo..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                className="flex-1 bg-slate-900/80 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => handleSaveMark(markStatus || 'reviewed', noteText)}
                className="nl-accent-bg px-3.5 py-2 rounded-xl text-white text-xs font-bold shrink-0"
              >
                Guardar nota
              </button>
            </div>
          </section>

          {relatedEvents.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Eventos Relacionados ({relatedEvents.length})
              </h4>
              <div className="space-y-1.5">
                {relatedEvents.map(rel => {
                  const relMeta = getActionMeta(rel.action)
                  return (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => onSelectEvent(rel)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-slate-950/65 hover:bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${relMeta.badgeCls}`}
                        >
                          {relMeta.label}
                        </span>
                        <span className="text-xs text-slate-300 truncate">{rel.actor_name}</span>
                      </div>
                      <span className="text-[10.5px] font-mono text-slate-500 shrink-0">
                        {formatRelativeTime(rel.created_at)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/75 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={eventIndex <= 0}
              onClick={onPrev}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              disabled={eventIndex < 0 || eventIndex >= totalCount - 1}
              onClick={onNext}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </aside>
    </div>,
    document.body
  )
}
