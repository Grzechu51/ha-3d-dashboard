import { describe, expect, test } from 'bun:test'
import {
  createEntityBinding,
  entityDomain,
  isSupportedHomeAssistantDomain,
  supportedHomeAssistantDomains,
} from './entity-binding'

describe('Home Assistant entity bindings', () => {
  test('derives a supported domain from a valid entity id', () => {
    expect(entityDomain('light.salon')).toBe('light')
    expect(isSupportedHomeAssistantDomain('light')).toBe(true)
  })

  test('creates a normalized binding', () => {
    expect(
      createEntityBinding({
        nodeId: '  item_lamp  ',
        entityId: '  light.salon  ',
      }),
    ).toEqual({
      nodeId: 'item_lamp',
      entityId: 'light.salon',
      domain: 'light',
      enabled: true,
    })
  })

  test('rejects malformed and unsupported entity ids', () => {
    expect(() => createEntityBinding({ nodeId: 'item_lamp', entityId: 'light' })).toThrow()
    expect(() => createEntityBinding({ nodeId: 'item_lamp', entityId: 'camera.salon' })).toThrow()
  })

  test('pins the first supported domain set', () => {
    expect(supportedHomeAssistantDomains).toEqual([
      'light',
      'cover',
      'switch',
      'sensor',
      'binary_sensor',
      'climate',
    ])
  })
})
