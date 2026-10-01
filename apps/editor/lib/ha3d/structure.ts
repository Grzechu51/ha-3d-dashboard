import type { HomeAssistantProjectApiHost } from './project-api'
import { loadHomeAssistantStructureRaw } from './structure-api'
import {
  type HomeAssistantStructureSnapshot,
  normalizeHomeAssistantStructure,
} from './structure-snapshot'

export async function loadHomeAssistantStructure(
  hass: HomeAssistantProjectApiHost,
): Promise<HomeAssistantStructureSnapshot> {
  return normalizeHomeAssistantStructure(await loadHomeAssistantStructureRaw(hass))
}
