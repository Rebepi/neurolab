import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { getToastDurationMs } from './preferences'
import { SileoToasts } from './SileoToasts'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'
export type ToastPriority = 'normal' | 'critical'

export interface UndoPayload {
  label: string
  execute: () => Promise<void>
}

export interface ToastItem {
  id: string
  title: string
  message?: string
  type: ToastType
  priority?: ToastPriority
  duration?: number
  actionLabel?: string
  onAction?: () => void
  undo?: UndoPayload
  incidentId?: string
  expandedDetail?: string
  dedupKey?: string
  count?: number
  persistent?: boolean
}

export interface ToastContextProps {
  toasts: ToastItem[]
  showToast: (toast: Omit<ToastItem, 'id'>) => string
  updateToast: (id: string, patch: Partial<Omit<ToastItem, 'id'>>) => void
  dismissToast: (id: string) => void
  dismissAll: () => void
  promiseToast: <T>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((v: T) => string)
      error: string | ((e: unknown) => string)
    },
    opts?: { dedupKey?: string; successDetail?: string; expandedDetail?: string }
  ) => Promise<T>
  success: (
    title: string,
    message?: string,
    opts?: Partial<Omit<ToastItem, 'id' | 'title' | 'message' | 'type'>>
  ) => string
  error: (
    title: string,
    message?: string,
    opts?: Partial<Omit<ToastItem, 'id' | 'title' | 'message' | 'type'>>
  ) => string
  warning: (
    title: string,
    message?: string,
    opts?: Partial<Omit<ToastItem, 'id' | 'title' | 'message' | 'type'>>
  ) => string
  info: (
    title: string,
    message?: string,
    opts?: Partial<Omit<ToastItem, 'id' | 'title' | 'message' | 'type'>>
  ) => string
}

const MAX_VISIBLE = 3

const ToastContext = createContext<ToastContextProps | undefined>(undefined)

let toastCounter = 0
function generateId(): string {
  toastCounter += 1
  return `toast-${Date.now()}-${toastCounter}`
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToastItems] = useState<ToastItem[]>([])
  const toastsRef = useRef<ToastItem[]>([])
  const setToasts = useCallback((update: (items: ToastItem[]) => ToastItem[]) => {
    const next = update(toastsRef.current)
    toastsRef.current = next
    setToastItems(next)
  }, [])

  const dismissToast = useCallback(
    (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id))
    },
    [setToasts]
  )

  const dismissAll = useCallback(() => {
    setToasts(() => [])
  }, [setToasts])

  const showToast = useCallback(
    (toastData: Omit<ToastItem, 'id'>) => {
      const id =
        (toastData.dedupKey
          ? toastsRef.current.find(item => item.dedupKey === toastData.dedupKey)?.id
          : undefined) ?? generateId()

      setToasts(prev => {
        if (toastData.dedupKey) {
          const existing = prev.find(t => t.dedupKey === toastData.dedupKey)
          if (existing) {
            return prev.map(t =>
              t.dedupKey === toastData.dedupKey
                ? { ...t, ...toastData, id: t.id, count: (t.count ?? 1) + 1 }
                : t
            )
          }
        }

        const critical = prev.filter(t => t.priority === 'critical' || t.persistent)
        const normal = prev.filter(t => t.priority !== 'critical' && !t.persistent)
        const trimmedNormal =
          normal.length >= MAX_VISIBLE ? normal.slice(normal.length - (MAX_VISIBLE - 1)) : normal
        const newItem: ToastItem = { ...toastData, id }
        return [...critical, ...trimmedNormal, newItem]
      })

      return id
    },
    [setToasts]
  )

  const updateToast = useCallback(
    (id: string, patch: Partial<Omit<ToastItem, 'id'>>) => {
      setToasts(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
    },
    [setToasts]
  )

  const success = useCallback(
    (
      title: string,
      message?: string,
      opts?: Partial<Omit<ToastItem, 'id' | 'title' | 'message' | 'type'>>
    ) => showToast({ ...opts, title, message, type: 'success', duration: opts?.duration ?? getToastDurationMs() }),
    [showToast]
  )

  const error = useCallback(
    (
      title: string,
      message?: string,
      opts?: Partial<Omit<ToastItem, 'id' | 'title' | 'message' | 'type'>>
    ) =>
      showToast({
        ...opts,
        title,
        message,
        type: 'error',
        duration: opts?.duration ?? getToastDurationMs(),
        persistent: opts?.persistent ?? true,
      }),
    [showToast]
  )

  const warning = useCallback(
    (
      title: string,
      message?: string,
      opts?: Partial<Omit<ToastItem, 'id' | 'title' | 'message' | 'type'>>
    ) => showToast({ ...opts, title, message, type: 'warning', duration: opts?.duration ?? getToastDurationMs() }),
    [showToast]
  )

  const info = useCallback(
    (
      title: string,
      message?: string,
      opts?: Partial<Omit<ToastItem, 'id' | 'title' | 'message' | 'type'>>
    ) => showToast({ ...opts, title, message, type: 'info', duration: opts?.duration ?? getToastDurationMs() }),
    [showToast]
  )

  const promiseToast = useCallback(
    function runPromiseToast<T>(
      promise: Promise<T>,
      messages: {
        loading: string
        success: string | ((v: T) => string)
        error: string | ((e: unknown) => string)
      },
      opts?: { dedupKey?: string; successDetail?: string; expandedDetail?: string }
    ): Promise<T> {
      const id = showToast({
        title: messages.loading,
        type: 'loading',
        persistent: true,
        dedupKey: opts?.dedupKey,
        priority: 'normal',
      })

      return promise.then(
        result => {
          const successTitle =
            typeof messages.success === 'function' ? messages.success(result) : messages.success
          updateToast(id, {
            type: 'success',
            title: successTitle,
            message: opts?.successDetail,
            expandedDetail: opts?.expandedDetail,
            persistent: false,
            duration: getToastDurationMs(),
          })
          return result
        },
        (e: unknown) => {
          const errorTitle =
            typeof messages.error === 'function' ? messages.error(e) : messages.error
          const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`
          updateToast(id, {
            type: 'error',
            title: errorTitle,
            incidentId,
            persistent: true,
            expandedDetail: e instanceof Error ? e.message : String(e),
          })
          return Promise.reject(e)
        }
      )
    },
    [showToast, updateToast]
  ) as ToastContextProps['promiseToast']

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        updateToast,
        dismissToast,
        dismissAll,
        promiseToast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
      <SileoToasts toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextProps => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
