import type { HomeAssistantRegistryEntity } from './registry-entity'
import { parseHomeAssistantRegistryEntity } from './registry-entity-parse'
import type { HomeAssistantStructureRaw } from './structure-api'
import { type HomeAssistantDevice, parseHomeAssistantDevice } from './structure-device'
import { resolveHomeAssistantDeviceAreaIds } from './structure-device-area'
import {
  type HomeAssistantArea,
  type HomeAssistantFloor,
  parseHomeAssistantArea,
  parseHomeAssistantFloor,
} from './structure-floor'
import { arrayValue, objectValue } from './structure-parse'

export type HomeAssistantStructureSnapshot = Readonly<{
  floors: readonly HomeAssistantFloor[]
  areas: readonly HomeAssistantArea[]
  devices: readonly HomeAssistantDevice[]
  entities: readonly HomeAssistantRegistryEntity[]
  deviceAreaIds: ReadonlyMap<string, string | null>
}>

export function normalizeHomeAssistantStructure(
  raw: HomeAssistantStructureRaw,
): HomeAssistantStructureSnapshot {
  const floors = arrayValue(raw.floors, 'floor registry').map(parseHomeAssistantFloor)
  const areas = arrayValue(raw.areas, 'area registry').map(parseHomeAssistantArea)
  const devices = arrayValue(raw.devices, 'device registry').map(parseHomeAssistantDevice)
  const entityResponse = objectValue(raw.entities, 'entity registry')
  const entities = arrayValue(entityResponse.entities, 'entity registry entities').map(
    parseHomeAssistantRegistryEntity,
  )
  return {
    floors,
    areas,
    devices,
    entities,
    deviceAreaIds: resolveHomeAssistantDeviceAreaIds(devices),
  }
}
