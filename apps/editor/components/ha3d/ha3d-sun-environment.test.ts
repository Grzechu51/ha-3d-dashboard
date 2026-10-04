import { describe, expect, test } from 'bun:test'
import { environmentThemeFor } from './ha3d-sun-environment'

describe('HA 3D sun environment', () => {
  test('maps explicit environment modes directly', () => {
    expect(environmentThemeFor('day', -20)).toBe('studio')
    expect(environmentThemeFor('twilight', 30)).toBe('twilight')
    expect(environmentThemeFor('night', 30)).toBe('night')
  })

  test('maps Home Assistant solar elevation to automatic themes', () => {
    expect(environmentThemeFor('auto', null)).toBe('studio')
    expect(environmentThemeFor('auto', 35)).toBe('studio')
    expect(environmentThemeFor('auto', 8)).toBe('sunset')
    expect(environmentThemeFor('auto', 1)).toBe('twilight')
    expect(environmentThemeFor('auto', -7)).toBe('night')
  })
})
