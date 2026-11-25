import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MotionConfig } from 'motion/react'
import { Toaster, sileo, type SileoOptions } from 'sileo'
import { X } from 'lucide-react'
import type { ToastItem } from './ToastContext'
import './sileo.css'
import {
  getToastPosition,
  getToastDurationMs,
  TOAST_POSITION_EVENT,
  type ToastPosition,
} from './preferences'

function getToastDuration(toast: ToastItem): number | null {
  if (toast.type === 'loading' || toast.persistent || (toast.type === 'error' && toast.persistent !== false)) {
    return null
  }
  const duration = toast.duration ?? getToastDurationMs()
  return duration > 0 ? duration : null
}

function ToastLifetime({
  toast,
  paused,
  onDismiss,
}: {
  toast: ToastItem
  paused: boolean
  onDismiss: (id: string) => void
}) {
  const duration = getToastDuration(toast)
  const remaining = useRef(duration)

  useEffect(() => {
    remaining.current = duration
  }, [duration, toast.type, toast.count])

  useEffect(() => {
    if (paused || duration === null) return
    const started = Date.now()
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current ?? duration)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, (remaining.current ?? duration) - (Date.now() - started))
    }
  }, [duration, paused, toast.id, toast.type, toast.count, onDismiss])

  return null
}

function ToastControl({
  children,
  onClick,
  className = '',
  ...props
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'> & { onClick: () => void }) {
  return (
    <a
      {...props}
      href="#"
      role="button"
      data-sileo-button="true"
      className={`nl-toast-control ${className}`}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      onKeyDown={event => {
        if (event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      {children}
    </a>
  )
}

function ToastDescription({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const detailsId = useId()
  const hasDetails = !!(toast.expandedDetail || toast.incidentId)

  const undo = async () => {
    if (!toast.undo || busy) return
    setBusy(true)
    setFeedback('')
    try {
      await toast.undo.execute()
      onDismiss(toast.id)
    } catch {
      setFeedback('No se pudo deshacer la operación. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  const copyIncident = async () => {
    try {
      await navigator.clipboard.writeText(toast.incidentId!)
      setFeedback('ID copiado')
    } catch {
      setFeedback('No se pudo copiar el ID. Puedes seleccionarlo en el detalle.')
    }
  }

  return (
    <div
      className="nl-toast-content"
      data-toast-id={toast.id}
      data-testid={`toast-${toast.type}`}
      data-priority={toast.priority ?? 'normal'}
    >
      <ToastControl
        className="nl-toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
      >
        <X size={14} aria-hidden="true" />
      </ToastControl>
      <p className="nl-toast-message">{toast.message || toast.title}</p>
      {(hasDetails || toast.undo || (toast.actionLabel && toast.onAction)) && (
        <div className="nl-toast-actions">
          {toast.actionLabel && toast.onAction && (
            <ToastControl onClick={toast.onAction}>{toast.actionLabel}</ToastControl>
          )}
          {toast.undo && (
            <ToastControl
              onClick={() => {
                void undo()
              }}
              aria-disabled={busy}
            >
              {busy ? 'Deshaciendo…' : toast.undo.label}
            </ToastControl>
          )}
          {hasDetails && (
            <ToastControl
              onClick={() => setExpanded(value => !value)}
              aria-expanded={expanded}
              aria-controls={detailsId}
            >
              {expanded ? 'Ocultar detalle' : 'Ver detalle'}
            </ToastControl>
          )}
        </div>
      )}
      {expanded && (
        <div id={detailsId} className="nl-toast-details">
          {toast.expandedDetail && <p>{toast.expandedDetail}</p>}
          {toast.incidentId && (
            <div className="nl-toast-incident">
              <span>ID: {toast.incidentId}</span>
              <ToastControl
                onClick={() => {
                  void copyIncident()
                }}
              >
                Copiar
              </ToastControl>
            </div>
          )}
        </div>
      )}
      {feedback && (
        <p role="status" className="nl-toast-feedback">
          {feedback}
        </p>
      )}
    </div>
  )
}

export function SileoToasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  const [mounted] = useState(() => typeof document !== 'undefined')
  const [position, setPosition] = useState<ToastPosition>(getToastPosition)
  const [isLightTheme, setIsLightTheme] = useState(
    () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
  )
  const previousPosition = useRef(position)
  const previousTheme = useRef(isLightTheme)

  useEffect(() => {
    const update = (event: Event) =>
      setPosition(event instanceof CustomEvent ? (event.detail as ToastPosition) : getToastPosition())
    window.addEventListener(TOAST_POSITION_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(TOAST_POSITION_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  useEffect(() => {
    const syncTheme = () => {
      setIsLightTheme(document.documentElement.getAttribute('data-theme') === 'light')
    }
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shown = useRef(new Map<string, ToastItem>())
  const swipe = useRef<{ id: string; y: number } | null>(null)

  useEffect(() => {
    const shownMap = shown.current
    const updateHost = () => {
      const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
      setPortalHost(dialogs[dialogs.length - 1] ?? document.body)
    }
    updateHost()
    const observer = new MutationObserver(updateHost)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    })
    return () => {
      observer.disconnect()
      sileo.clear()
      shownMap.clear()
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current?.contains(document.activeElement)) setFocused(false)
    if (!containerRef.current?.matches(':hover')) setHovered(false)
  }, [toasts])

  useEffect(() => {
    if (!mounted) return
    if (previousPosition.current !== position || previousTheme.current !== isLightTheme) {
      shown.current.clear()
      previousPosition.current = position
      previousTheme.current = isLightTheme
    }
    const current = new Set(toasts.map(toast => toast.id))
    for (const id of shown.current.keys()) {
      if (!current.has(id)) {
        sileo.dismiss(id)
        shown.current.delete(id)
      }
    }
    for (const toast of toasts) {
      if (shown.current.get(toast.id) === toast) continue
      const options: SileoOptions & { id: string } = {
        id: toast.id,
        type: toast.type,
        title: `${toast.title}${toast.count && toast.count > 1 ? ` ×${toast.count}` : ''}`,
        description: <ToastDescription toast={toast} onDismiss={onDismiss} />,
        position,
        duration: null,
        fill: isLightTheme ? '#ffffff' : '#1a1a1a',
        roundness: 16,
        autopilot: { expand: 150, collapse: 0 },
        styles: { title: 'nl-toast-title', description: 'nl-toast-description' },
      }
      sileo.show(options)
      shown.current.set(toast.id, toast)
    }
  }, [mounted, toasts, onDismiss, position, isLightTheme])

  const findToast = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('[data-sileo-toast]') : null
  const toastId = (target: EventTarget | null) =>
    findToast(target)?.querySelector<HTMLElement>('[data-toast-id]')?.dataset.toastId

  const content = (
    <div
      ref={containerRef}
      className="nl-toasts"
      data-testid="toast-container"
      aria-live="polite"
      aria-relevant="additions removals"
      style={{
        position: 'fixed',
        top: 'calc(1rem + env(safe-area-inset-top, 0px))',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={event => {
        setFocused(true)
        findToast(event.target)?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      }}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
      onKeyDownCapture={event => {
        if (event.key === 'Escape') {
          const id = toastId(event.target)
          if (id) {
            event.preventDefault()
            event.stopPropagation()
            onDismiss(id)
          }
        }
      }}
      onPointerDownCapture={event => {
        const target = event.target as Element
        const id = target.closest('[data-sileo-button], .nl-toast-details') ? undefined : toastId(target)
        swipe.current = id ? { id, y: event.clientY } : null
      }}
      onPointerUpCapture={event => {
        const start = swipe.current
        swipe.current = null
        if (start && Math.abs(event.clientY - start.y) > 30) onDismiss(start.id)
      }}
      onPointerCancelCapture={() => {
        swipe.current = null
      }}
    >
      {mounted && (
        <MotionConfig reducedMotion="user">
          <Toaster
            position={position}
            offset={{
              top: 'calc(1rem + env(safe-area-inset-top, 0px))',
              bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
              right: 'env(safe-area-inset-right, 0px)',
            }}
          />
        </MotionConfig>
      )}
      <div className="sr-only" role="alert" aria-atomic="true">
        {toasts
          .filter(toast => toast.type === 'error')
          .map(toast => `${toast.title}. ${toast.message || ''}`)
          .join(' ')}
      </div>
      {toasts.map(toast => (
        <ToastLifetime
          key={toast.id}
          toast={toast}
          paused={hovered || focused}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  )

  return mounted && portalHost ? createPortal(content, portalHost) : content
}
