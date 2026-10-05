export type Ha3dDashboardMenuMode = 'auto' | 'custom'
export type Ha3dDashboardMenuSpan = 1 | 2

export type Ha3dDashboardMenuItem = Readonly<{
  entityId: string
  span: Ha3dDashboardMenuSpan
}>

export type Ha3dDashboardMenuConfig = Readonly<{
  mode: Ha3dDashboardMenuMode
  items: readonly Ha3dDashboardMenuItem[]
}>

export const DEFAULT_HA3D_DASHBOARD_MENU: Ha3dDashboardMenuConfig = {
  mode: 'auto',
  items: [],
}

function parseEntityId(value: unknown): string {
  if (typeof value !== 'string') throw new Error('[ha3d] dashboard menu entityId must be a string')
  const entityId = value.trim()
  const separator = entityId.indexOf('.')
  if (separator <= 0 || separator === entityId.length - 1) {
    throw new Error('[ha3d] dashboard menu entityId is invalid')
  }
  return entityId
}

export function parseHa3dDashboardMenu(raw: unknown): Ha3dDashboardMenuConfig {
  if (raw === undefined) return DEFAULT_HA3D_DASHBOARD_MENU
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('[ha3d] dashboardMenu must be an object')
  }

  const value = raw as Record<string, unknown>
  const mode = value.mode
  if (mode !== 'auto' && mode !== 'custom') {
    throw new Error('[ha3d] dashboardMenu mode must be auto or custom')
  }
  if (!Array.isArray(value.items)) {
    throw new Error('[ha3d] dashboardMenu items must be an array')
  }
  if (value.items.length > 48) {
    throw new Error('[ha3d] dashboardMenu supports at most 48 items')
  }

  const seen = new Set<string>()
  const items = value.items.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('[ha3d] dashboard menu item must be an object')
    }

    const item = entry as Record<string, unknown>
    const entityId = parseEntityId(item.entityId)
    if (seen.has(entityId)) {
      throw new Error('[ha3d] dashboard menu entity ids must be unique')
    }
    seen.add(entityId)

    const span = item.span === undefined ? 2 : item.span
    if (span !== 1 && span !== 2) {
      throw new Error('[ha3d] dashboard menu item span must be 1 or 2')
    }

    return { entityId, span }
  })

  return { mode, items }
}

export function dashboardMenuEqual(
  left: Ha3dDashboardMenuConfig,
  right: Ha3dDashboardMenuConfig,
): boolean {
  if (left.mode !== right.mode || left.items.length !== right.items.length) return false
  return left.items.every(
    (item, index) =>
      item.entityId === right.items[index]?.entityId && item.span === right.items[index]?.span,
  )
}
