import type { ViewerPresentationConfiguration } from '@pascal-app/viewer'
import {
  createEntityBinding,
  type EntityBinding,
  entityDomain,
  normalizeCoverMotionConfig,
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
}>

const listeners = new Set<() => void>()

let snapshot: Ha3dProjectConfig = {
  version: HA3D_PROJECT_CONFIG_VERSION,
  bindings: [],
  structureMappings: { floors: [], areas: [] },
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
    if (typeof mapping.floorId !== 'string' || typeof mapping.levelNodeId !== 'string') {
      throw new Error('[ha3d] floor mapping ids must be strings')
    }
    return { floorId: mapping.floorId, levelNodeId: mapping.levelNodeId }
  })
  const areas = value.areas.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('[ha3d] area mapping must be an object')
    }
    const mapping = entry as Record<string, unknown>
    if (typeof mapping.areaId !== 'string' || typeof mapping.zoneNodeId !== 'string') {
      throw new Error('[ha3d] area mapping ids must be strings')
    }
    return { areaId: mapping.areaId, zoneNodeId: mapping.zoneNodeId }
  })
  return { floors, areas }
}

function publish(
  bindings: readonly EntityBinding[],
  structureMappings: Ha3dStructureMappings = snapshot.structureMappings,
): void {
  snapshot = {
    version: HA3D_PROJECT_CONFIG_VERSION,
    bindings: sortBindings(bindings).map(cloneBinding),
    structureMappings,
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

export function upsertFloorStructureMapping(floorId: string, levelNodeId: string): void {
  if (!floorId || !levelNodeId) throw new Error('[ha3d] floor mapping ids must not be empty')
  const floors = [
    ...snapshot.structureMappings.floors.filter((mapping) => mapping.floorId !== floorId),
    { floorId, levelNodeId },
  ]
  publish(snapshot.bindings, { ...snapshot.structureMappings, floors })
}

export function upsertAreaStructureMapping(areaId: string, zoneNodeId: string): void {
  if (!areaId || !zoneNodeId) throw new Error('[ha3d] area mapping ids must not be empty')
  const areas = [
    ...snapshot.structureMappings.areas.filter((mapping) => mapping.areaId !== areaId),
    { areaId, zoneNodeId },
  ]
  publish(snapshot.bindings, { ...snapshot.structureMappings, areas })
}

export function resetHa3dProjectConfig(): void {
  if (
    snapshot.bindings.length === 0 &&
    snapshot.structureMappings.floors.length === 0 &&
    snapshot.structureMappings.areas.length === 0
  ) {
    return
  }
  publish([], { floors: [], areas: [] })
}

export const ha3dProjectConfiguration: ViewerPresentationConfiguration = {
  getSnapshot: () => ({
    version: HA3D_PROJECT_CONFIG_VERSION,
    bindings: snapshot.bindings.map(cloneBinding),
    structureMappings: snapshot.structureMappings,
  }),
  restore: (raw) => {
    const restored = parseHa3dProjectConfig(raw)
    publish(restored.bindings, restored.structureMappings)
  },
  reset: resetHa3dProjectConfig,
  subscribe: subscribeHa3dProjectConfig,
}
