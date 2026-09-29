import type { HomeAssistantProjectApiHost } from './project-api'
import { loadHomeAssistantStructureRaw } from './structure-api'
import { normalizeHomeAssistantStructure, type HomeAssistantStructureSnapshot } from './structure-snapshot'

export async function loadHomeAssistantStructure(
  hass: HomeAssistantProjectApiHost,
): Promise<HomeAssistantStructureSnapshot> {
  return normalizeHomeAssistantStructure(await loadHomeAssistantStructureRaw(hass))
}
