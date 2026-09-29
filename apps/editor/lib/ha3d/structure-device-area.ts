import type { HomeAssistantDevice } from './structure-device'

export function resolveHomeAssistantDeviceAreaIds(
  devices: readonly HomeAssistantDevice[],
): ReadonlyMap<string, string | null> {
  const byId = new Map(devices.map((device) => [device.id, device]))
  const result = new Map<string, string | null>()
  const resolving = new Set<string>()
  const resolve = (id: string): string | null => {
    if (result.has(id)) return result.get(id) ?? null
    const device = byId.get(id)
    if (!device || resolving.has(id)) return null
    if (device.areaId) return device.areaId
    if (!device.parentDeviceId) return null
    resolving.add(id)
    const areaId = resolve(device.parentDeviceId)
    resolving.delete(id)
    return areaId
  }
  for (const device of devices) result.set(device.id, resolve(device.id))
  return result
}
