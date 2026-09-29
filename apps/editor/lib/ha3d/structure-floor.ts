import { objectValue, optionalString, stringValue } from './structure-parse'

export type HomeAssistantFloor = Readonly<{
  id: string
  name: string
  level: number | null
}>

export type HomeAssistantArea = Readonly<{
  id: string
  name: string
  floorId: string | null
}>

export function parseHomeAssistantFloor(raw: unknown): HomeAssistantFloor {
  const value = objectValue(raw, 'floor')
  const level = value.level
  if (level !== null && level !== undefined && (typeof level !== 'number' || !Number.isInteger(level))) {
    throw new Error('[ha3d] floor level must be an integer or null')
  }
  return { id: stringValue(value.floor_id, 'floor id'), name: stringValue(value.name, 'floor name'), level: typeof level === 'number' ? level : null }
}

export function parseHomeAssistantArea(raw: unknown): HomeAssistantArea {
  const value = objectValue(raw, 'area')
  return { id: stringValue(value.area_id, 'area id'), name: stringValue(value.name, 'area name'), floorId: optionalString(value.floor_id, 'area floor id') }
}
