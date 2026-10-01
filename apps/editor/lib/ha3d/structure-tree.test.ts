import { expect, test } from 'bun:test'
import { normalizeHomeAssistantStructure } from './structure-snapshot'
import { groupHomeAssistantStructure } from './structure-tree'

test('groups floors, areas, devices and entities', () => {
  const snapshot = normalizeHomeAssistantStructure({
    floors: [{ floor_id: 'ground', name: 'Ground', level: 0 }],
    areas: [{ area_id: 'living', name: 'Living', floor_id: 'ground' }],
    devices: [{ id: 'lamp', name: 'Lamp', area_id: 'living', parent_device_id: null }],
    entities: { entities: [{ ei: 'light.lamp', pl: 'demo', di: 'lamp' }] },
  })
  const tree = groupHomeAssistantStructure(snapshot)

  expect(tree.floors[0]?.areas[0]?.devices[0]?.device.id).toBe('lamp')
  expect(tree.floors[0]?.areas[0]?.devices[0]?.entities[0]?.entityId).toBe('light.lamp')
})
