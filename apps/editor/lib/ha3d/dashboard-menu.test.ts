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
    })
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
      }),
    ).toBe(false)
  })
})
