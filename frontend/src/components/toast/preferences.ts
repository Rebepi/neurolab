export const TOAST_POSITIONS = [
  { value: 'bottom-right', label: 'Abajo a la derecha' },
  { value: 'top-right', label: 'Arriba a la derecha' },
  { value: 'top-center', label: 'Arriba al centro' },
] as const

export type ToastPosition = (typeof TOAST_POSITIONS)[number]['value']
export const TOAST_POSITION_EVENT = 'nl-toast-position-changed'
const STORAGE_KEY = 'nl_toast_position'

export function getToastPosition(): ToastPosition {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return TOAST_POSITIONS.find(position => position.value === stored)?.value ?? 'bottom-right'
  } catch {
    return 'bottom-right'
  }
}

export function setToastPosition(position: ToastPosition): void {
  try {
    localStorage.setItem(STORAGE_KEY, position)
  } catch {}
  window.dispatchEvent(new CustomEvent(TOAST_POSITION_EVENT, { detail: position }))
}

export const TOAST_DURATIONS = [
  { value: 'very-fast', label: 'Muy rápida · 1 segundo', milliseconds: 1000 },
  { value: 'fast', label: 'Rápida · 3 segundos', milliseconds: 3000 },
  { value: 'medium', label: 'Media · 5 segundos', milliseconds: 5000 },
  { value: 'slow', label: 'Lenta · 8 segundos', milliseconds: 8000 },
] as const

export type ToastDurationPreference = (typeof TOAST_DURATIONS)[number]['value']
const DURATION_STORAGE_KEY = 'nl_toast_duration'

export function getToastDurationPreference(): ToastDurationPreference {
  try {
    return (
      TOAST_DURATIONS.find(option => option.value === localStorage.getItem(DURATION_STORAGE_KEY))?.value ?? 'medium'
    )
  } catch {
    return 'medium'
  }
}

export function getToastDurationMs(): number {
  return TOAST_DURATIONS.find(option => option.value === getToastDurationPreference())!.milliseconds
}

export function setToastDurationPreference(value: ToastDurationPreference): void {
  try {
    localStorage.setItem(DURATION_STORAGE_KEY, value)
  } catch {}
}

