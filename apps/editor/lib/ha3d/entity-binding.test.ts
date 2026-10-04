import { describe, expect, test } from 'bun:test'
import {
  createEntityBinding,
  DEFAULT_COVER_MOTION,
  entityDomain,
  isSupportedHomeAssistantDomain,
  normalizeCoverMotionConfig,
  resolveDashboardInteractionAction,
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
      tapAction: 'default',
      holdAction: 'default',
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
      tapAction: 'default',
      holdAction: 'default',
      coverMotion: DEFAULT_COVER_MOTION,
    })
  })

  test('resolves dashboard tap and hold defaults and overrides', () => {
    const light = createEntityBinding({ nodeId: 'lamp', entityId: 'light.salon' })
    const sensor = createEntityBinding({ nodeId: 'temp', entityId: 'sensor.temperature' })

    expect(resolveDashboardInteractionAction(light, 'tap')).toBe('toggle')
    expect(resolveDashboardInteractionAction(light, 'hold')).toBe('more-info')
    expect(resolveDashboardInteractionAction(sensor, 'tap')).toBe('more-info')
    expect(resolveDashboardInteractionAction({ ...light, tapAction: 'more-info' }, 'tap')).toBe(
      'more-info',
    )
    expect(resolveDashboardInteractionAction({ ...light, holdAction: 'none' }, 'hold')).toBe('none')
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
