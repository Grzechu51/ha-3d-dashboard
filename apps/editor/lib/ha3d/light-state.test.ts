import { describe, expect, test } from 'bun:test'
import { resolveHomeAssistantLightVisualState } from './light-state'

describe('Home Assistant light visual state', () => {
  test('maps brightness and RGB color', () => {
    expect(
      resolveHomeAssistantLightVisualState({
        entityId: 'light.salon',
        state: 'on',
        attributes: {
          brightness: 128,
          rgb_color: [255, 64, 0],
        },
      }),
    ).toEqual({
      on: true,
      brightness: 128 / 255,
      color: '#ff4000',
    })
  })

  test('keeps an off light dark even when brightness is retained by HA', () => {
    expect(
      resolveHomeAssistantLightVisualState({
        entityId: 'light.salon',
        state: 'off',
        attributes: { brightness: 230, rgb_color: [10, 20, 30] },
      }),
    ).toEqual({
      on: false,
      brightness: 0,
      color: '#0a141e',
    })
  })

  test('falls back to color temperature and then white', () => {
    const warm = resolveHomeAssistantLightVisualState({
      entityId: 'light.salon',
      state: 'on',
      attributes: { color_temp_kelvin: 2700 },
    })
    expect(warm.color).not.toBe('#ffffff')

    expect(resolveHomeAssistantLightVisualState(undefined)).toEqual({
      on: false,
      brightness: 0,
      color: '#ffffff',
    })
  })
})
