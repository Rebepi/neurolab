import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Shield, X } from 'lucide-react'
import { ROLE_COLORS, ROLE_OPTIONS, ROLE_PERMISSIONS } from '../constants'

interface RbacMatrixModalProps {
  onClose: () => void
}

export function RbacMatrixModal({ onClose }: RbacMatrixModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rbac-matrix-modal-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl nl-cyber-panel rounded-2xl shadow-2xl overflow-hidden animate-pop-in"
      >
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl nl-accent-bg flex items-center justify-center shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 id="rbac-matrix-modal-title" className="text-white font-bold text-base">
                Matriz de Permisos RBAC
              </h3>
              <p className="text-slate-400 text-xs">
                Política de denegación por defecto aplicada en todos los módulos y endpoints
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar matriz RBAC"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-2.5 max-h-[65vh] overflow-y-auto">
          {ROLE_OPTIONS.map(role => (
            <div key={role} className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5">
              <span className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${ROLE_COLORS[role] ?? ''}`}>
                {role}
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {ROLE_PERMISSIONS[role]}
              </p>
            </div>
          ))}
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

