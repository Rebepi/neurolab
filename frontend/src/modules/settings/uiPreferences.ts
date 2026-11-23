const MOTION_KEY = 'nl_reduced_motion'
const DENSITY_KEY = 'nl_density'

export type UiDensity = 'comfortable' | 'compact'

export function readReducedMotion(): boolean {
  try {
    return localStorage.getItem(MOTION_KEY) === 'true'
  } catch {
    return false
  }
}

export function readDensity(): UiDensity {
  try {
    return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

export function applyReducedMotion(enabled: boolean): void {
  try {
    localStorage.setItem(MOTION_KEY, String(enabled))
  } catch {}
  document.documentElement.dataset.motion = enabled ? 'reduced' : 'normal'
}

export function applyDensity(density: UiDensity): void {
  try {
    localStorage.setItem(DENSITY_KEY, density)
  } catch {}
  document.documentElement.dataset.density = density
}

export function applyStoredUiPreferences(): void {
  applyReducedMotion(readReducedMotion())
  applyDensity(readDensity())
}
