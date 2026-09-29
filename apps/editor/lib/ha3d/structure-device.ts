import { objectValue, optionalString, stringValue } from './structure-parse'

export type HomeAssistantDevice = Readonly<{
  id: string
  name: string | null
  nameByUser: string | null
  areaId: string | null
  parentDeviceId: string | null
}>

export function parseHomeAssistantDevice(raw: unknown): HomeAssistantDevice {
  const value = objectValue(raw, 'device')
  return {
    id: stringValue(value.id, 'device id'),
    name: optionalString(value.name, 'device name'),
    nameByUser: optionalString(value.name_by_user, 'device user name'),
    areaId: optionalString(value.area_id, 'device area id'),
    parentDeviceId: optionalString(value.parent_device_id, 'device parent id'),
  }
}
