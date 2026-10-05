import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_HA3D_DASHBOARD_MENU,
  dashboardMenuEqual,
  parseHa3dDashboardMenu,
} from './dashboard-menu'

describe('HA 3D dashboard menu config', () => {
  test('uses automatic bound-entity mode for legacy projects', () => {
    expect(parseHa3dDashboardMenu(undefined)).toEqual(DEFAULT_HA3D_DASHBOARD_MENU)
  })

  test('normalizes custom menu items and defaults old items to full width', () => {
    expect(
      parseHa3dDashboardMenu({
        mode: 'custom',
        items: [{ entityId: ' light.salon ' }, { entityId: 'sensor.co2', span: 1 }],
      }),
    ).toEqual({
      mode: 'custom',
      items: [
        { entityId: 'light.salon', span: 2 },
        { entityId: 'sensor.co2', span: 1 },
      ],
      lovelaceCard: { type: 'vertical-stack', cards: [] },
    })
  })

  test('round-trips a native Lovelace card tree', () => {
    const menu = parseHa3dDashboardMenu({
      mode: 'lovelace',
      items: [],
      lovelaceCard: {
        type: 'vertical-stack',
        cards: [
          {
            type: 'custom:mushroom-light-card',
            entity: 'light.cct',
            show_brightness_control: true,
          },
          {
            type: 'horizontal-stack',
            cards: [
              { type: 'tile', entity: 'switch.adaptive_lighting_cct_adaptive' },
              { type: 'tile', entity: 'switch.adaptive_lighting_wled_parapet' },
            ],
          },
        ],
        visibility: [
          {
            condition: 'state',
            entity: 'input_select.urzadzenia',
            state: 'Oświetlenie',
          },
        ],
      },
    })

    expect(menu.mode).toBe('lovelace')
    expect(menu.lovelaceCard).toMatchObject({
      type: 'vertical-stack',
      cards: [{ type: 'custom:mushroom-light-card', entity: 'light.cct' }],
    })
  })

  test('rejects non-persistable Lovelace values and missing card type', () => {
    expect(() =>
      parseHa3dDashboardMenu({
        mode: 'lovelace',
        items: [],
        lovelaceCard: { cards: [] },
      }),
    ).toThrow('card type')

    expect(() =>
      parseHa3dDashboardMenu({
        mode: 'lovelace',
        items: [],
        lovelaceCard: { type: 'markdown', content: new Date() },
      }),
    ).toThrow('plain YAML/JSON')
  })

  test('rejects duplicate and malformed entities', () => {
    expect(() =>
      parseHa3dDashboardMenu({
        mode: 'custom',
        items: [
          { entityId: 'light.salon', span: 1 },
          { entityId: 'light.salon', span: 2 },
        ],
      }),
    ).toThrow('unique')

    expect(() =>
      parseHa3dDashboardMenu({
        mode: 'custom',
        items: [{ entityId: 'invalid', span: 1 }],
      }),
    ).toThrow('invalid')
  })

  test('compares menu order and width', () => {
    const menu = parseHa3dDashboardMenu({
      mode: 'custom',
      items: [{ entityId: 'light.salon', span: 1 }],
    })
    expect(dashboardMenuEqual(menu, menu)).toBe(true)
    expect(
      dashboardMenuEqual(menu, {
        mode: 'custom',
        items: [{ entityId: 'light.salon', span: 2 }],
        lovelaceCard: { type: 'vertical-stack', cards: [] },
      }),
    ).toBe(false)
  })
})
