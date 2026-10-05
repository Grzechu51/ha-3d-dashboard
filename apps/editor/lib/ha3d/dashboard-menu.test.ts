import { describe, expect, test } from 'bun:test'
import {
  buildAutomaticDashboardCard,
  DEFAULT_HA3D_DASHBOARD_MENU,
  dashboardMenuEqual,
  parseHa3dDashboardMenu,
} from './dashboard-menu'

describe('HA 3D dashboard menu config', () => {
  test('uses automatic native HA tiles for legacy projects', () => {
    expect(parseHa3dDashboardMenu(undefined)).toEqual(DEFAULT_HA3D_DASHBOARD_MENU)
  })

  test('builds one native Tile card per unique bound entity', () => {
    expect(buildAutomaticDashboardCard(['light.salon', 'sensor.co2', 'light.salon'])).toEqual({
      type: 'vertical-stack',
      cards: [
        { type: 'tile', entity: 'light.salon' },
        { type: 'tile', entity: 'sensor.co2' },
      ],
    })
  })

  test('migrates legacy HA3D custom tiles to native Home Assistant Tile cards', () => {
    expect(
      parseHa3dDashboardMenu({
        mode: 'custom',
        items: [{ entityId: ' light.salon ' }, { entityId: 'sensor.co2', span: 1 }],
      }),
    ).toEqual({
      mode: 'lovelace',
      lovelaceCard: {
        type: 'vertical-stack',
        cards: [
          { type: 'tile', entity: 'light.salon' },
          { type: 'tile', entity: 'sensor.co2' },
        ],
      },
    })
  })

  test('round-trips a native Lovelace card tree', () => {
    const menu = parseHa3dDashboardMenu({
      mode: 'lovelace',
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

    expect(menu).toEqual({
      mode: 'lovelace',
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
  })

  test('rejects non-persistable Lovelace values and missing card type', () => {
    expect(() =>
      parseHa3dDashboardMenu({
        mode: 'lovelace',
        lovelaceCard: { cards: [] },
      }),
    ).toThrow('card type')

    expect(() =>
      parseHa3dDashboardMenu({
        mode: 'lovelace',
        lovelaceCard: { type: 'markdown', content: new Date() },
      }),
    ).toThrow('plain YAML/JSON')
  })

  test('rejects duplicate and malformed legacy custom entities', () => {
    expect(() =>
      parseHa3dDashboardMenu({
        mode: 'custom',
        items: [{ entityId: 'light.salon' }, { entityId: 'light.salon' }],
      }),
    ).toThrow('unique')

    expect(() =>
      parseHa3dDashboardMenu({
        mode: 'custom',
        items: [{ entityId: 'invalid' }],
      }),
    ).toThrow('invalid')
  })

  test('compares native menu mode and card config', () => {
    const menu = parseHa3dDashboardMenu({
      mode: 'lovelace',
      lovelaceCard: { type: 'tile', entity: 'light.salon' },
    })
    expect(dashboardMenuEqual(menu, menu)).toBe(true)
    expect(
      dashboardMenuEqual(menu, {
        mode: 'auto',
        lovelaceCard: { type: 'tile', entity: 'light.salon' },
      }),
    ).toBe(false)
  })
})
