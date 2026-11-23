import { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Undo2,
} from 'lucide-react'
import type { ChangeItem } from '../schema'

interface SettingsActionBarProps {
  canEdit: boolean
  dirty: boolean
  saving: boolean
  changes: ChangeItem[]
  readOnlyMessage: string
  idleMessage: string
  saveLabel: string
  onDiscard: () => void
  onReset: () => void
  onSave: () => Promise<void>
  otherPendingCount?: number
  onSaveAll?: () => Promise<void>
}

export function SettingsActionBar({
  canEdit,
  dirty,
  saving,
  changes,
  readOnlyMessage,
  idleMessage,
  saveLabel,
  onDiscard,
  onReset,
  onSave,
  otherPendingCount = 0,
  onSaveAll,
}: SettingsActionBarProps) {
  const [detailOpen, setDetailOpen] = useState(false)

  if (!dirty && !saving) {
    return null
  }

  const showDetail = dirty && detailOpen && changes.length > 0

  return (
    <div className="nl-cyber-panel animate-card-reveal rounded-2xl mt-auto shrink-0 sticky bottom-0 z-10 overflow-hidden">
      {showDetail && (
        <div className="px-5 py-3 border-b border-slate-800/70 bg-slate-950/50 grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
          {changes.map(change => (
            <div
              key={change.key}
              className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800"
            >
              <span className="text-slate-300 font-semibold truncate">{change.label}</span>
              <span className="font-mono shrink-0">
                <span className="text-slate-500">{change.from}</span>
                <span className="text-slate-600"> → </span>
                <span className="text-amber-200">{change.to}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {!canEdit ? (
            <span className="inline-flex items-center gap-1.5 text-amber-300/90">
              <Lock className="w-3.5 h-3.5" />
              {readOnlyMessage}
            </span>
          ) : dirty ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                {changes.length} {changes.length === 1 ? 'cambio pendiente' : 'cambios pendientes'}
              </span>
              <button
                type="button"
                onClick={() => setDetailOpen(open => !open)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-[11px] font-semibold transition-colors"
              >
                {detailOpen ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronUp className="w-3 h-3" />
                )}
                <span>{detailOpen ? 'Ocultar detalle' : 'Ver detalle'}</span>
              </button>
              {otherPendingCount > 0 && (
                <span className="text-[11px] text-slate-400">
                  + {otherPendingCount} en otra pestaña
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {idleMessage}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canEdit}
            onClick={onReset}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Valores Recomendados</span>
          </button>

          <button
            type="button"
            disabled={!canEdit || !dirty || saving}
            onClick={onDiscard}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Descartar</span>
          </button>

          {onSaveAll && otherPendingCount > 0 && dirty && (
            <button
              type="button"
              disabled={!canEdit || saving}
              onClick={onSaveAll}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar todo</span>
            </button>
          )}

          <button
            type="button"
            disabled={!canEdit || saving || !dirty}
            onClick={onSave}
            className="nl-btn-shimmer nl-accent-bg nl-accent-glow flex items-center gap-2 px-5 py-2 disabled:opacity-45 disabled:cursor-not-allowed rounded-xl text-white text-xs font-bold transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Guardando...' : saveLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function InstantApplyBar({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="nl-cyber-panel animate-card-reveal rounded-2xl mt-auto shrink-0 sticky bottom-0 z-10 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        {message}
      </span>
      <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 border border-slate-800 text-[11px] font-mono text-slate-400">
        {detail}
      </span>
    </div>
  )
}
