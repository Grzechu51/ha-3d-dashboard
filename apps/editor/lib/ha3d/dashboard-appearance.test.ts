import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_HA3D_DASHBOARD_APPEARANCE,
  normalizeHa3dDashboardAppearance,
} from './dashboard-appearance'

describe('HA 3D dashboard appearance', () => {
  test('uses stable defaults for missing preferences', () => {
    expect(normalizeHa3dDashboardAppearance(undefined)).toEqual(DEFAULT_HA3D_DASHBOARD_APPEARANCE)
  })

  test('clamps user-facing label preferences to supported ranges', () => {
    expect(
      normalizeHa3dDashboardAppearance({
        labelOpacity: 2,
        labelRadiusPx: -5,
      }),
    ).toEqual({
      labelOpacity: 0.95,
      labelRadiusPx: 4,
    })

    expect(
      normalizeHa3dDashboardAppearance({
        labelOpacity: 0.52,
        labelRadiusPx: 15.6,
      }),
    ).toEqual({
      labelOpacity: 0.52,
      labelRadiusPx: 16,
    })
  })
})
