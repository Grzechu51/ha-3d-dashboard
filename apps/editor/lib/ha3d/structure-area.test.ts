import { expect, test } from 'bun:test'
import { resolveHomeAssistantEntityAreaId } from './structure-area'

test('entity area overrides device area', () => {
  const entity = {
    entityId: 'light.lamp',
    platform: 'demo',
    name: 'Lamp',
    icon: null,
    areaId: 'desk',
    deviceId: 'device-1',
    hidden: false,
  }
  const deviceAreas = new Map([['device-1', 'living']])
  expect(resolveHomeAssistantEntityAreaId(entity, deviceAreas)).toBe('desk')
})

test('entity inherits its device area', () => {
  const entity = { entityId: 'light.lamp', platform: 'demo', areaId: null, deviceId: 'device-1' }
  const deviceAreas = new Map([['device-1', 'living']])
  expect(resolveHomeAssistantEntityAreaId(entity, deviceAreas)).toBe('living')
})
