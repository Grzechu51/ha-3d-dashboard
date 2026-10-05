import type { ViewerPresentationConfiguration } from '@pascal-app/viewer'
import {
  DEFAULT_HA3D_DASHBOARD_MENU,
  dashboardMenuEqual,
  type Ha3dDashboardMenuConfig,
  type Ha3dDashboardMenuItem,
  parseHa3dDashboardMenu,
} from './dashboard-menu'
import {
  createEntityBinding,
  type EntityBinding,
  entityDomain,
  normalizeCoverMotionConfig,
  normalizeDashboardInteractionAction,
  type SupportedHomeAssistantDomain,
} from './entity-binding'

export const HA3D_PROJECT_CONFIG_VERSION = 1 as const

export type Ha3dStructureMappings = Readonly<{
  floors: readonly Readonly<{ floorId: string; levelNodeId: string }>[]
  areas: readonly Readonly<{ areaId: string; zoneNodeId: string }>[]
}>

export type Ha3dProjectConfig = Readonly<{
  version: typeof HA3D_PROJECT_CONFIG_VERSION
  bindings: readonly EntityBinding[]
  structureMappings: Ha3dStructureMappings
  dashboardMenu: Ha3dDashboardMenuConfig
}>

const listeners = new Set<() => void>()

let snapshot: Ha3dProjectConfig = {
  version: HA3D_PROJECT_CONFIG_VERSION,
  bindings: [],
  structureMappings: { floors: [], areas: [] },
  dashboardMenu: DEFAULT_HA3D_DASHBOARD_MENU,
}

function bindingKey(binding: Pick<EntityBinding, 'nodeId' | 'domain'>): string {
  return `${binding.nodeId}\u0000${binding.domain}`
}

function coverMotionEqual(left: EntityBinding, right: EntityBinding): boolean {
  if (left.coverMotion === undefined || right.coverMotion === undefined) {
    return left.coverMotion === right.coverMotion
  }
  return (
    left.coverMotion.axis === right.coverMotion.axis &&
    left.coverMotion.openOffsetMeters === right.coverMotion.openOffsetMeters &&
    left.coverMotion.durationMs === right.coverMotion.durationMs
  )
}

function bindingsEqual(left: EntityBinding, right: EntityBinding): boolean {
  return (
    left.nodeId === right.nodeId &&
    left.entityId === right.entityId &&
    left.domain === right.domain &&
    left.enabled === right.enabled &&
    left.tapAction === right.tapAction &&
    left.holdAction === right.holdAction &&
    coverMotionEqual(left, right)
  )
}

function cloneBinding(binding: EntityBinding): EntityBinding {
  return binding.coverMotion
    ? {
        ...binding,
        coverMotion: { ...binding.coverMotion },
      }
    : { ...binding }
}

function cloneDashboardMenu(menu: Ha3dDashboardMenuConfig): Ha3dDashboardMenuConfig {
  return {
    mode: menu.mode,
    items: menu.items.map((item) => ({ ...item })),
  }
}

function sortBindings(bindings: readonly EntityBinding[]): EntityBinding[] {
  return [...bindings].sort(
    (left, right) =>
      left.nodeId.localeCompare(right.nodeId) ||
      left.domain.localeCompare(right.domain) ||
      left.entityId.localeCompare(right.entityId),
  )
}

function parseStructureMappings(raw: unknown): Ha3dStructureMappings {
  if (raw === undefined) return { floors: [], areas: [] }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('[ha3d] structureMappings must be an object')
  }
  const value = raw as Record<string, unknown>
  if (!Array.isArray(value.floors) || !Array.isArray(value.areas)) {
    throw new Error('[ha3d] structureMappings floors and areas must be arrays')
  }

  const floors = value.floors.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('[ha3d] floor mapping must be an object')
    }
    const mapping = entry as Record<string, unknown>
    if (
      typeof mapping.floorId !== 'string' ||
      !mapping.floorId.trim() ||
      typeof mapping.levelNodeId !== 'string' ||
      !mapping.levelNodeId.trim()
    ) {
      throw new Error('[ha3d] floor mapping ids must be strings')
    }
    return { floorId: mapping.floorId, levelNodeId: mapping.levelNodeId }
  })
  const areas = value.areas.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('[ha3d] area mapping must be an object')
    }
    const mapping = entry as Record<string, unknown>
    if (
      typeof mapping.areaId !== 'string' ||
      !mapping.areaId.trim() ||
      typeof mapping.zoneNodeId !== 'string' ||
      !mapping.zoneNodeId.trim()
    ) {
      throw new Error('[ha3d] area mapping ids must be strings')
    }
    return { areaId: mapping.areaId, zoneNodeId: mapping.zoneNodeId }
  })

  const floorIds = new Set<string>()
  const levelNodeIds = new Set<string>()
  for (const mapping of floors) {
    if (floorIds.has(mapping.floorId) || levelNodeIds.has(mapping.levelNodeId)) {
      throw new Error('[ha3d] floor mappings must be one-to-one')
    }
    floorIds.add(mapping.floorId)
    levelNodeIds.add(mapping.levelNodeId)
  }

  const areaIds = new Set<string>()
  const zoneNodeIds = new Set<string>()
  for (const mapping of areas) {
    if (areaIds.has(mapping.areaId) || zoneNodeIds.has(mapping.zoneNodeId)) {
      throw new Error('[ha3d] area mappings must be one-to-one')
    }
    areaIds.add(mapping.areaId)
    zoneNodeIds.add(mapping.zoneNodeId)
  }

  return { floors, areas }
}

function publish(
  bindings: readonly EntityBinding[],
  structureMappings: Ha3dStructureMappings = snapshot.structureMappings,
  dashboardMenu: Ha3dDashboardMenuConfig = snapshot.dashboardMenu,
): void {
  snapshot = {
    version: HA3D_PROJECT_CONFIG_VERSION,
    bindings: sortBindings(bindings).map(cloneBinding),
    structureMappings,
    dashboardMenu: cloneDashboardMenu(dashboardMenu),
  }
  for (const listener of listeners) listener()
}

function parsePersistedBinding(raw: unknown): EntityBinding {
  if (!raw || typeof raw !== 'object') throw new Error('[ha3d] binding must be an object')
  const record = raw as Record<string, unknown>
  if (typeof record.nodeId !== 'string' || typeof record.entityId !== 'string') {
    throw new Error('[ha3d] binding nodeId and entityId must be strings')
  }
  if (record.enabled !== undefined && typeof record.enabled !== 'boolean') {
    throw new Error('[ha3d] binding enabled must be a boolean')
  }

  const domain = entityDomain(record.entityId.trim())
  if (domain !== 'cover' && record.coverMotion !== undefined) {
    throw new Error('[ha3d] persisted cover motion belongs to a non-cover entity')
  }

  const binding = createEntityBinding({
    nodeId: record.nodeId,
    entityId: record.entityId,
    enabled: record.enabled as boolean | undefined,
    tapAction: normalizeDashboardInteractionAction(record.tapAction),
    holdAction: normalizeDashboardInteractionAction(record.holdAction),
    coverMotion: domain === 'cover' ? normalizeCoverMotionConfig(record.coverMotion) : undefined,
  })
  if (record.domain !== undefined && record.domain !== binding.domain) {
    throw new Error('[ha3d] persisted binding domain does not match entity id')
  }
  return binding
}

export function parseHa3dProjectConfig(raw: unknown): Ha3dProjectConfig {
  if (!raw || typeof raw !== 'object') throw new Error('[ha3d] project config must be an object')
  const record = raw as Record<string, unknown>
  if (record.version !== HA3D_PROJECT_CONFIG_VERSION) {
    throw new Error('[ha3d] unsupported project config version')
  }
  if (!Array.isArray(record.bindings)) throw new Error('[ha3d] project bindings must be an array')

  const byKey = new Map<string, EntityBinding>()
  for (const value of record.bindings) {
    const binding = parsePersistedBinding(value)
    byKey.set(bindingKey(binding), binding)
  }
  return {
    version: HA3D_PROJECT_CONFIG_VERSION,
    bindings: sortBindings(Array.from(byKey.values())),
    structureMappings: parseStructureMappings(record.structureMappings),
    dashboardMenu: parseHa3dDashboardMenu(record.dashboardMenu),
  }
}

export function getHa3dProjectConfigSnapshot(): Ha3dProjectConfig {
  return snapshot
}

export function subscribeHa3dProjectConfig(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function upsertEntityBinding(binding: EntityBinding): void {
  const key = bindingKey(binding)
  const current = snapshot.bindings.find((candidate) => bindingKey(candidate) === key)
  if (current && bindingsEqual(current, binding)) return

  publish([...snapshot.bindings.filter((candidate) => bindingKey(candidate) !== key), binding])
}

export function removeEntityBinding(nodeId: string, domain: SupportedHomeAssistantDomain): void {
  const next = snapshot.bindings.filter(
    (binding) => !(binding.nodeId === nodeId && binding.domain === domain),
  )
  if (next.length === snapshot.bindings.length) return
  publish(next)
}

export function setDashboardMenuMode(mode: Ha3dDashboardMenuConfig['mode']): void {
  if (snapshot.dashboardMenu.mode === mode) return
  publish(snapshot.bindings, snapshot.structureMappings, {
    ...snapshot.dashboardMenu,
    mode,
  })
}

export function addDashboardMenuItem(entityId: string): void {
  const trimmed = entityId.trim()
  if (snapshot.dashboardMenu.items.some((item) => item.entityId === trimmed)) return
  const next = parseHa3dDashboardMenu({
    mode: 'custom',
    items: [...snapshot.dashboardMenu.items, { entityId: trimmed, span: 2 }],
  })
  publish(snapshot.bindings, snapshot.structureMappings, next)
}

export function updateDashboardMenuItem(
  entityId: string,
  patch: Partial<Pick<Ha3dDashboardMenuItem, 'span'>>,
): void {
  const index = snapshot.dashboardMenu.items.findIndex((item) => item.entityId === entityId)
  if (index < 0) return

  const items = snapshot.dashboardMenu.items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...patch } : item,
  )
  const next = parseHa3dDashboardMenu({ mode: 'custom', items })
  if (dashboardMenuEqual(snapshot.dashboardMenu, next)) return
  publish(snapshot.bindings, snapshot.structureMappings, next)
}

export function moveDashboardMenuItem(entityId: string, offset: -1 | 1): void {
  const index = snapshot.dashboardMenu.items.findIndex((item) => item.entityId === entityId)
  const target = index + offset
  if (index < 0 || target < 0 || target >= snapshot.dashboardMenu.items.length) return

  const items = [...snapshot.dashboardMenu.items]
  const [item] = items.splice(index, 1)
  if (!item) return
  items.splice(target, 0, item)
  publish(snapshot.bindings, snapshot.structureMappings, {
    mode: 'custom',
    items,
  })
}

export function removeDashboardMenuItem(entityId: string): void {
  const items = snapshot.dashboardMenu.items.filter((item) => item.entityId !== entityId)
  if (items.length === snapshot.dashboardMenu.items.length) return
  publish(snapshot.bindings, snapshot.structureMappings, {
    mode: 'custom',
    items,
  })
}

export function upsertFloorStructureMapping(floorId: string, levelNodeId: string): void {
  if (!floorId || !levelNodeId) throw new Error('[ha3d] floor mapping ids must not be empty')
  const current = snapshot.structureMappings.floors.find((mapping) => mapping.floorId === floorId)
  if (current?.levelNodeId === levelNodeId) return
  const floors = [
    ...snapshot.structureMappings.floors.filter(
      (mapping) => mapping.floorId !== floorId && mapping.levelNodeId !== levelNodeId,
    ),
    { floorId, levelNodeId },
  ]
  publish(snapshot.bindings, { ...snapshot.structureMappings, floors })
}

export function upsertAreaStructureMapping(areaId: string, zoneNodeId: string): void {
  if (!areaId || !zoneNodeId) throw new Error('[ha3d] area mapping ids must not be empty')
  const current = snapshot.structureMappings.areas.find((mapping) => mapping.areaId === areaId)
  if (current?.zoneNodeId === zoneNodeId) return
  const areas = [
    ...snapshot.structureMappings.areas.filter(
      (mapping) => mapping.areaId !== areaId && mapping.zoneNodeId !== zoneNodeId,
    ),
    { areaId, zoneNodeId },
  ]
  publish(snapshot.bindings, { ...snapshot.structureMappings, areas })
}

export function removeFloorStructureMapping(floorId: string): void {
  const floors = snapshot.structureMappings.floors.filter((mapping) => mapping.floorId !== floorId)
  if (floors.length === snapshot.structureMappings.floors.length) return
  publish(snapshot.bindings, { ...snapshot.structureMappings, floors })
}

export function removeAreaStructureMapping(areaId: string): void {
  const areas = snapshot.structureMappings.areas.filter((mapping) => mapping.areaId !== areaId)
  if (areas.length === snapshot.structureMappings.areas.length) return
  publish(snapshot.bindings, { ...snapshot.structureMappings, areas })
}

export function resetHa3dProjectConfig(): void {
  if (
    snapshot.bindings.length === 0 &&
    snapshot.structureMappings.floors.length === 0 &&
    snapshot.structureMappings.areas.length === 0 &&
    dashboardMenuEqual(snapshot.dashboardMenu, DEFAULT_HA3D_DASHBOARD_MENU)
  ) {
    return
  }
  publish([], { floors: [], areas: [] }, DEFAULT_HA3D_DASHBOARD_MENU)
}

export const ha3dProjectConfiguration: ViewerPresentationConfiguration = {
  getSnapshot: () => ({
    version: HA3D_PROJECT_CONFIG_VERSION,
    bindings: snapshot.bindings.map(cloneBinding),
    structureMappings: snapshot.structureMappings,
    dashboardMenu: cloneDashboardMenu(snapshot.dashboardMenu),
  }),
  restore: (raw) => {
    const restored = parseHa3dProjectConfig(raw)
    publish(restored.bindings, restored.structureMappings, restored.dashboardMenu)
  },
  reset: resetHa3dProjectConfig,
  subscribe: subscribeHa3dProjectConfig,
}
