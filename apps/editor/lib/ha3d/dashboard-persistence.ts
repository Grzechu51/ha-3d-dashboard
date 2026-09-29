import { ha3dProjectConfiguration, resetHa3dProjectConfig } from './project-config'

const LOCAL_PROJECT_PRESENTATION_STORAGE_KEY_PREFIX = 'pascal:project-presentation:v1:'
const LOCAL_PROJECT_PRESENTATION_VERSION = 1
const HA3D_PRESENTATION_ID = 'ha3d:home-assistant:presentation'

type ReadStorage = {
  getItem(key: string): string | null
}

function getBrowserStorage(): ReadStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function storageKey(projectId: string): string {
  return `${LOCAL_PROJECT_PRESENTATION_STORAGE_KEY_PREFIX}${encodeURIComponent(projectId)}`
}

export function restoreHa3dDashboardProjectConfig(
  projectId: string,
  storage: ReadStorage | null = getBrowserStorage(),
): boolean {
  resetHa3dProjectConfig()
  if (!storage) return false

  let raw: string | null
  try {
    raw = storage.getItem(storageKey(projectId))
  } catch {
    return false
  }
  if (raw === null) return false

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!(parsed && typeof parsed === 'object' && !Array.isArray(parsed))) return false

    const record = parsed as Record<string, unknown>
    if (
      record.version !== LOCAL_PROJECT_PRESENTATION_VERSION ||
      record.projectId !== projectId ||
      !record.contributions ||
      typeof record.contributions !== 'object' ||
      Array.isArray(record.contributions)
    ) {
      return false
    }

    const contributions = record.contributions as Record<string, unknown>
    if (!Object.hasOwn(contributions, HA3D_PRESENTATION_ID)) return false

    ha3dProjectConfiguration.restore(contributions[HA3D_PRESENTATION_ID])
    return true
  } catch {
    resetHa3dProjectConfig()
    return false
  }
}
