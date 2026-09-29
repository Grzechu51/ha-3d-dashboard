import { expect, test } from 'bun:test'
import { resolveHomeAssistantDeviceAreaIds } from './structure-device-area'

test('child devices inherit the parent area', () => {
  const areas = resolveHomeAssistantDeviceAreaIds([
    { id: 'parent', name: 'Controller', nameByUser: null, areaId: 'living', parentDeviceId: null },
    { id: 'child', name: 'Left channel', nameByUser: null, areaId: null, parentDeviceId: 'parent' },
  ])

  expect(areas.get('child')).toBe('living')
})
