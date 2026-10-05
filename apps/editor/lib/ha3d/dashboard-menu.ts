export type Ha3dDashboardMenuMode = 'auto' | 'custom' | 'lovelace'
export type Ha3dDashboardMenuSpan = 1 | 2

export type Ha3dDashboardMenuItem = Readonly<{
  entityId: string
  span: Ha3dDashboardMenuSpan
}>

export interface Ha3dJsonObject {
  readonly [key: string]: Ha3dJsonValue
}

export type Ha3dJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly Ha3dJsonValue[]
  | Ha3dJsonObject

export type Ha3dLovelaceCardConfig = Ha3dJsonObject

export type Ha3dDashboardMenuConfig = Readonly<{
  mode: Ha3dDashboardMenuMode
  items: readonly Ha3dDashboardMenuItem[]
  lovelaceCard: Ha3dLovelaceCardConfig
}>

export const DEFAULT_HA3D_LOVELACE_CARD: Ha3dLovelaceCardConfig = {
  type: 'vertical-stack',
  cards: [],
}

export const DEFAULT_HA3D_DASHBOARD_MENU: Ha3dDashboardMenuConfig = {
  mode: 'auto',
  items: [],
  lovelaceCard: DEFAULT_HA3D_LOVELACE_CARD,
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

function parseJsonValue(value: unknown, path: string): Ha3dJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`[ha3d] ${path} contains a non-finite number`)
    return value
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => parseJsonValue(entry, `${path}[${index}]`))
  }
  if (!value || typeof value !== 'object') {
    throw new Error(`[ha3d] ${path} contains a value that cannot be persisted`)
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`[ha3d] ${path} must contain plain YAML/JSON values`)
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      parseJsonValue(entry, `${path}.${key}`),
    ]),
  )
}

export function parseHa3dLovelaceCardConfig(raw: unknown): Ha3dLovelaceCardConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('[ha3d] dashboardMenu lovelaceCard must be an object')
  }

  const parsed = parseJsonValue(raw, 'dashboardMenu.lovelaceCard')
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('[ha3d] dashboardMenu lovelaceCard must be an object')
  }

  const type = parsed.type
  if (typeof type !== 'string' || !type.trim()) {
    throw new Error('[ha3d] dashboardMenu lovelaceCard requires a card type')
  }

  return parsed
}

export function cloneHa3dLovelaceCardConfig(
  config: Ha3dLovelaceCardConfig,
): Ha3dLovelaceCardConfig {
  return parseHa3dLovelaceCardConfig(config)
}

export function parseHa3dDashboardMenu(raw: unknown): Ha3dDashboardMenuConfig {
  if (raw === undefined) return DEFAULT_HA3D_DASHBOARD_MENU
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('[ha3d] dashboardMenu must be an object')
  }

  const value = raw as Record<string, unknown>
  const mode = value.mode
  if (mode !== 'auto' && mode !== 'custom' && mode !== 'lovelace') {
    throw new Error('[ha3d] dashboardMenu mode must be auto, custom or lovelace')
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

    const rawSpan = item.span
    if (rawSpan !== undefined && rawSpan !== 1 && rawSpan !== 2) {
      throw new Error('[ha3d] dashboard menu item span must be 1 or 2')
    }
    const span: Ha3dDashboardMenuSpan = rawSpan === 1 ? 1 : 2

    return { entityId, span }
  })

  const lovelaceCard =
    value.lovelaceCard === undefined
      ? cloneHa3dLovelaceCardConfig(DEFAULT_HA3D_LOVELACE_CARD)
      : parseHa3dLovelaceCardConfig(value.lovelaceCard)

  return { mode, items, lovelaceCard }
}

function jsonValueEqual(left: Ha3dJsonValue, right: Ha3dJsonValue): boolean {
  if (left === right) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!(Array.isArray(left) && Array.isArray(right)) || left.length !== right.length) return false
    return left.every((entry, index) => jsonValueEqual(entry, right[index]!))
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftEntries = Object.entries(left)
    const rightEntries = Object.entries(right)
    if (leftEntries.length !== rightEntries.length) return false
    return leftEntries.every(
      ([key, value]) =>
        Object.hasOwn(right, key) &&
        jsonValueEqual(value, (right as Record<string, Ha3dJsonValue>)[key]!),
    )
  }
  return false
}

export function dashboardMenuEqual(
  left: Ha3dDashboardMenuConfig,
  right: Ha3dDashboardMenuConfig,
): boolean {
  if (left.mode !== right.mode || left.items.length !== right.items.length) return false
  if (
    !left.items.every(
      (item, index) =>
        item.entityId === right.items[index]?.entityId && item.span === right.items[index]?.span,
    )
  ) {
    return false
  }
  return jsonValueEqual(left.lovelaceCard, right.lovelaceCard)
}
