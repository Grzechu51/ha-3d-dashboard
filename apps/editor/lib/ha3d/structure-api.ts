import type { HomeAssistantProjectApiHost } from './project-api'

export type HomeAssistantStructureRaw = Readonly<{
  floors: unknown
  areas: unknown
  devices: unknown
  entities: unknown
}>

export async function loadHomeAssistantStructureRaw(
  hass: HomeAssistantProjectApiHost,
): Promise<HomeAssistantStructureRaw> {
  const [floors, areas, devices, entities] = await Promise.all([
    hass.callWS<unknown>({ type: 'config/floor_registry/list' }),
    hass.callWS<unknown>({ type: 'config/area_registry/list' }),
    hass.callWS<unknown>({ type: 'config/device_registry/list' }),
    hass.callWS<unknown>({ type: 'config/entity_registry/list_for_display' }),
  ])
  return { floors, areas, devices, entities }
}
