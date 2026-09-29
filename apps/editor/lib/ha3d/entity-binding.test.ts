import { describe, expect, test } from 'bun:test'
import {
  createEntityBinding,
  DEFAULT_COVER_MOTION,
  entityDomain,
  isSupportedHomeAssistantDomain,
  normalizeCoverMotionConfig,
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

  test('adds default physical motion to cover bindings', () => {
    expect(
      createEntityBinding({
        nodeId: 'item_blind',
        entityId: 'cover.salon',
      }),
    ).toEqual({
      nodeId: 'item_blind',
      entityId: 'cover.salon',
      domain: 'cover',
      enabled: true,
      coverMotion: DEFAULT_COVER_MOTION,
    })
  })

  test('validates custom cover motion', () => {
    expect(
      normalizeCoverMotionConfig({
        axis: 'z',
        openOffsetMeters: -2.4,
        durationMs: 1200,
      }),
    ).toEqual({
      axis: 'z',
      openOffsetMeters: -2.4,
      durationMs: 1200,
    })
    expect(() =>
      normalizeCoverMotionConfig({
        axis: 'w',
        openOffsetMeters: 1,
        durationMs: 500,
      }),
    ).toThrow()
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
