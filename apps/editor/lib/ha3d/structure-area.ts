import type { HomeAssistantRegistryEntity } from './registry-entity'

export function resolveHomeAssistantEntityAreaId(
  entity: HomeAssistantRegistryEntity,
  deviceAreaIds: ReadonlyMap<string, string | null>,
): string | null {
  if (entity.areaId) return entity.areaId
  if (!entity.deviceId) return null
  return deviceAreaIds.get(entity.deviceId) ?? null
}
