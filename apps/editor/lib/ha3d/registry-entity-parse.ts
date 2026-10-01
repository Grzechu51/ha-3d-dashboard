import type { HomeAssistantRegistryEntity } from './registry-entity'
import { objectValue, optionalString, stringValue } from './structure-parse'

export function parseHomeAssistantRegistryEntity(raw: unknown): HomeAssistantRegistryEntity {
  const value = objectValue(raw, 'entity')
  return {
    entityId: stringValue(value.ei, 'entity id'),
    platform: stringValue(value.pl, 'entity platform'),
    name: optionalString(value.en, 'entity name'),
    icon: optionalString(value.ic, 'entity icon'),
    areaId: optionalString(value.ai, 'entity area id'),
    deviceId: optionalString(value.di, 'entity device id'),
    hidden: value.hb === true,
  }
}
