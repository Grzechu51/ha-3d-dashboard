export type Ha3dDashboardAppearance = Readonly<{
  labelOpacity: number
  labelRadiusPx: number
}>

export const DEFAULT_HA3D_DASHBOARD_APPEARANCE: Ha3dDashboardAppearance = {
  labelOpacity: 0.68,
  labelRadiusPx: 10,
}

const STORAGE_KEY = 'ha3d:dashboard-appearance:v1'
const listeners = new Set<() => void>()

let hydrated = false
let snapshot: Ha3dDashboardAppearance = DEFAULT_HA3D_DASHBOARD_APPEARANCE

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeHa3dDashboardAppearance(raw: unknown): Ha3dDashboardAppearance {
  const value =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}

  return {
    labelOpacity: clamp(
      finiteNumber(value.labelOpacity, DEFAULT_HA3D_DASHBOARD_APPEARANCE.labelOpacity),
      0.35,
      0.95,
    ),
    labelRadiusPx: Math.round(
      clamp(
        finiteNumber(value.labelRadiusPx, DEFAULT_HA3D_DASHBOARD_APPEARANCE.labelRadiusPx),
        4,
        24,
      ),
    ),
  }
}

function hydrate(): void {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) snapshot = normalizeHa3dDashboardAppearance(JSON.parse(raw))
  } catch {
    snapshot = DEFAULT_HA3D_DASHBOARD_APPEARANCE
  }
}

function persist(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Display preferences may remain session-only when browser storage is unavailable.
  }
}

function publish(next: Ha3dDashboardAppearance): void {
  if (
    next.labelOpacity === snapshot.labelOpacity &&
    next.labelRadiusPx === snapshot.labelRadiusPx
  ) {
    return
  }

  snapshot = next
  persist()
  for (const listener of listeners) listener()
}

export function getHa3dDashboardAppearanceSnapshot(): Ha3dDashboardAppearance {
  hydrate()
  return snapshot
}

export function getHa3dDashboardAppearanceServerSnapshot(): Ha3dDashboardAppearance {
  return DEFAULT_HA3D_DASHBOARD_APPEARANCE
}

export function subscribeHa3dDashboardAppearance(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updateHa3dDashboardAppearance(updates: Partial<Ha3dDashboardAppearance>): void {
  hydrate()
  publish(normalizeHa3dDashboardAppearance({ ...snapshot, ...updates }))
}

export function resetHa3dDashboardAppearance(): void {
  hydrate()
  publish(DEFAULT_HA3D_DASHBOARD_APPEARANCE)
}
