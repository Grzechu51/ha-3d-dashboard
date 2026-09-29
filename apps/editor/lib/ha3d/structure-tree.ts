import { resolveHomeAssistantEntityAreaId } from './structure-area'
import {
  createHomeAssistantAreaGroup,
  createHomeAssistantDeviceGroup,
} from './structure-group-area'
import type { HomeAssistantStructureSnapshot } from './structure-snapshot'
import type { HomeAssistantStructureTree } from './structure-tree-types'

export function groupHomeAssistantStructure(
  snapshot: HomeAssistantStructureSnapshot,
): HomeAssistantStructureTree {
  const areaIds = new Set(snapshot.areas.map((area) => area.id))
  const floorIds = new Set(snapshot.floors.map((floor) => floor.id))
  const unassignedDevices = snapshot.devices.filter((device) => !snapshot.deviceAreaIds.get(device.id) || !areaIds.has(snapshot.deviceAreaIds.get(device.id) ?? ''))
  const unassignedDeviceIds = new Set(unassignedDevices.map((device) => device.id))
  return {
    floors: snapshot.floors.map((floor) => ({ floor, areas: snapshot.areas.filter((area) => area.floorId === floor.id).map((area) => createHomeAssistantAreaGroup(snapshot, area)) })),
    unassignedAreas: snapshot.areas.filter((area) => !area.floorId || !floorIds.has(area.floorId)).map((area) => createHomeAssistantAreaGroup(snapshot, area)),
    unassignedDevices: unassignedDevices.map((device) => createHomeAssistantDeviceGroup(snapshot, device)),
    unassignedEntities: snapshot.entities.filter((entity) => {
      const areaId = resolveHomeAssistantEntityAreaId(entity, snapshot.deviceAreaIds)
      if (areaId && areaIds.has(areaId)) return false
      return !entity.deviceId || !unassignedDeviceIds.has(entity.deviceId)
    }),
  }
}
