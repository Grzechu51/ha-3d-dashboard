const LAST_PROJECT_STORAGE_KEY = 'ha3d:last-project-id:v1'

export type ProjectPreferenceStorage = Readonly<{
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}>

function browserStorage(): ProjectPreferenceStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readLastProjectId(
  storage: ProjectPreferenceStorage | null = browserStorage(),
): string | null {
  if (!storage) return null
  try {
    const value = storage.getItem(LAST_PROJECT_STORAGE_KEY)
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

export function writeLastProjectId(
  projectId: string,
  storage: ProjectPreferenceStorage | null = browserStorage(),
): void {
  if (!storage || projectId.length === 0) return
  try {
    storage.setItem(LAST_PROJECT_STORAGE_KEY, projectId)
  } catch {}
}

export function clearLastProjectId(
  projectId?: string,
  storage: ProjectPreferenceStorage | null = browserStorage(),
): void {
  if (!storage) return
  try {
    if (projectId && storage.getItem(LAST_PROJECT_STORAGE_KEY) !== projectId) return
    storage.removeItem(LAST_PROJECT_STORAGE_KEY)
  } catch {}
}
