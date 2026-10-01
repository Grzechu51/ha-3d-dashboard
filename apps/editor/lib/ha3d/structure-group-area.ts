import { resolveHomeAssistantEntityAreaId } from './structure-area'
import type { HomeAssistantDevice } from './structure-device'
import type { HomeAssistantArea } from './structure-floor'
import type { HomeAssistantStructureSnapshot } from './structure-snapshot'
import type { HomeAssistantAreaGroup, HomeAssistantDeviceGroup } from './structure-tree-types'

export function createHomeAssistantDeviceGroup(
  snapshot: HomeAssistantStructureSnapshot,
  device: HomeAssistantDevice,
): HomeAssistantDeviceGroup {
  const areaId = snapshot.deviceAreaIds.get(device.id) ?? null
  return {
    device,
    entities: snapshot.entities.filter(
      (entity) =>
        entity.deviceId === device.id &&
        resolveHomeAssistantEntityAreaId(entity, snapshot.deviceAreaIds) === areaId,
    ),
  }
}

export function createHomeAssistantAreaGroup(
  snapshot: HomeAssistantStructureSnapshot,
  area: HomeAssistantArea,
): HomeAssistantAreaGroup {
  const devices = snapshot.devices.filter(
    (device) => snapshot.deviceAreaIds.get(device.id) === area.id,
  )
  const deviceIds = new Set(devices.map((device) => device.id))
  return {
    area,
    devices: devices.map((device) => createHomeAssistantDeviceGroup(snapshot, device)),
    entities: snapshot.entities.filter(
      (entity) =>
        resolveHomeAssistantEntityAreaId(entity, snapshot.deviceAreaIds) === area.id &&
        (!entity.deviceId || !deviceIds.has(entity.deviceId)),
    ),
  }
}
