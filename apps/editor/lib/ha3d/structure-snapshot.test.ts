import { expect, test } from 'bun:test'
import { normalizeHomeAssistantStructure } from './structure-snapshot'

test('normalizes current Home Assistant registry payloads', () => {
  const snapshot = normalizeHomeAssistantStructure({
    floors: [{ floor_id: 'ground', name: 'Ground floor', level: 0 }],
    areas: [{ area_id: 'living', name: 'Living room', floor_id: 'ground' }],
    devices: [
      { id: 'parent', name: 'Controller', area_id: 'living', parent_device_id: null },
      { id: 'child', name: 'Channel', area_id: null, parent_device_id: 'parent' },
    ],
    entities: {
      entities: [{ ei: 'light.channel', pl: 'demo', en: 'Channel', di: 'child', hb: true }],
    },
  })

  expect(snapshot.floors[0]).toMatchObject({ id: 'ground', level: 0 })
  expect(snapshot.areas[0]).toMatchObject({ id: 'living', floorId: 'ground' })
  expect(snapshot.deviceAreaIds.get('child')).toBe('living')
  expect(snapshot.entities[0]).toMatchObject({
    entityId: 'light.channel',
    name: 'Channel',
    deviceId: 'child',
    hidden: true,
  })
})
