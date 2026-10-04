import type { HomeAssistantEntityState } from './home-assistant-adapter'

function stringAttribute(entity: HomeAssistantEntityState, key: string): string | null {
  const value = entity.attributes[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function unitForEntity(entity: HomeAssistantEntityState): string {
  return (
    stringAttribute(entity, 'unit_of_measurement') ??
    stringAttribute(entity, 'temperature_unit') ??
    ''
  )
}

function withUnit(value: string | number, unit: string): string {
  return unit ? `${value} ${unit}` : String(value)
}

function binarySensorLabel(entity: HomeAssistantEntityState): string {
  const isOn = entity.state === 'on'
  const deviceClass = stringAttribute(entity, 'device_class')

  if (deviceClass === 'motion' || deviceClass === 'occupancy' || deviceClass === 'presence') {
    return isOn ? 'Detected' : 'Clear'
  }
  if (
    deviceClass === 'door' ||
    deviceClass === 'window' ||
    deviceClass === 'opening' ||
    deviceClass === 'garage_door'
  ) {
    return isOn ? 'Open' : 'Closed'
  }
  if (deviceClass === 'moisture') return isOn ? 'Wet' : 'Dry'
  if (deviceClass === 'connectivity') return isOn ? 'Connected' : 'Disconnected'
  return isOn ? 'On' : 'Off'
}

export function entityFriendlyName(entity: HomeAssistantEntityState): string {
  const name = entity.attributes.friendly_name
  return typeof name === 'string' && name.trim() ? name : entity.entityId
}

export function numericEntityAttribute(
  entity: HomeAssistantEntityState | undefined,
  key: string,
): number | null {
  const value = entity?.attributes[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function stringListEntityAttribute(
  entity: HomeAssistantEntityState | undefined,
  key: string,
): readonly string[] {
  const value = entity?.attributes[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function formatHomeAssistantEntityValue(entity: HomeAssistantEntityState): string {
  const domain = entity.entityId.split('.')[0] ?? ''

  if (entity.state === 'unavailable' || entity.state === 'unknown') return entity.state
  if (domain === 'binary_sensor') return binarySensorLabel(entity)
  if (domain === 'switch' || domain === 'light' || domain === 'input_boolean') {
    if (entity.state === 'on') return 'On'
    if (entity.state === 'off') return 'Off'
  }
  if (domain === 'climate') {
    const currentTemperature = numericEntityAttribute(entity, 'current_temperature')
    if (currentTemperature !== null) return withUnit(currentTemperature, unitForEntity(entity))
  }

  return withUnit(entity.state, unitForEntity(entity))
}

export function formatHomeAssistantEntityDetail(entity: HomeAssistantEntityState): string | null {
  const domain = entity.entityId.split('.')[0] ?? ''
  if (domain !== 'climate') return null

  const targetTemperature = numericEntityAttribute(entity, 'temperature')
  if (targetTemperature === null) return entity.state

  return `Target ${withUnit(targetTemperature, unitForEntity(entity))} · ${entity.state}`
}
