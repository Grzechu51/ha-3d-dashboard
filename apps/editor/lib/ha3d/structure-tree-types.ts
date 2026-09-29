import type { HomeAssistantRegistryEntity } from './registry-entity'
import type { HomeAssistantDevice } from './structure-device'
import type { HomeAssistantArea, HomeAssistantFloor } from './structure-floor'

export type HomeAssistantDeviceGroup = Readonly<{
  device: HomeAssistantDevice
  entities: readonly HomeAssistantRegistryEntity[]
}>

export type HomeAssistantAreaGroup = Readonly<{
  area: HomeAssistantArea
  devices: readonly HomeAssistantDeviceGroup[]
  entities: readonly HomeAssistantRegistryEntity[]
}>

export type HomeAssistantFloorGroup = Readonly<{
  floor: HomeAssistantFloor
  areas: readonly HomeAssistantAreaGroup[]
}>

export type HomeAssistantStructureTree = Readonly<{
  floors: readonly HomeAssistantFloorGroup[]
  unassignedAreas: readonly HomeAssistantAreaGroup[]
  unassignedDevices: readonly HomeAssistantDeviceGroup[]
  unassignedEntities: readonly HomeAssistantRegistryEntity[]
}>
