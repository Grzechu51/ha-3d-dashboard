import { afterEach, describe, expect, test } from 'bun:test'
import type { HomeAssistantHassLike } from './hass-adapter'
import { HomeAssistantPanelHostController } from './panel-host-controller'
import { getHomeAssistantRuntimeSnapshot, setHomeAssistantAdapter } from './runtime'

const controllers: HomeAssistantPanelHostController[] = []

function controller(): HomeAssistantPanelHostController {
  const value = new HomeAssistantPanelHostController()
  controllers.push(value)
  return value
}

function hass(entityId: string, state: string): HomeAssistantHassLike {
  return {
    states: {
      [entityId]: {
        entity_id: entityId,
        state,
        attributes: {},
      },
    },
    callService: async () => {},
  }
}

afterEach(() => {
  while (controllers.length > 0) controllers.pop()?.disconnect()
  setHomeAssistantAdapter(null)
})

describe('Home Assistant custom panel host controller', () => {
  test('accepts hass before connect and attaches it only when mounted', () => {
    const panel = controller()
    panel.setHass(hass('light.salon', 'off'))

    expect(getHomeAssistantRuntimeSnapshot().connected).toBe(false)

    panel.connect()

    expect(panel.isConnected()).toBe(true)
    expect(getHomeAssistantRuntimeSnapshot().adapter?.id).toBe('home-assistant')
    expect(getHomeAssistantRuntimeSnapshot().adapter?.getEntity('light.salon')?.state).toBe('off')
  })

  test('propagates hass updates while mounted', () => {
    const panel = controller()
    panel.connect()
    panel.setHass(hass('light.salon', 'off'))
    const firstRevision = getHomeAssistantRuntimeSnapshot().revision

    panel.setHass(hass('light.salon', 'on'))

    expect(getHomeAssistantRuntimeSnapshot().revision).toBeGreaterThan(firstRevision)
    expect(getHomeAssistantRuntimeSnapshot().adapter?.getEntity('light.salon')?.state).toBe('on')
  })

  test('disconnect disposes the native host and reconnect creates a fresh lease', () => {
    const panel = controller()
    panel.setHass(hass('sensor.temperature', '21'))
    panel.connect()
    panel.disconnect()

    expect(getHomeAssistantRuntimeSnapshot().connected).toBe(false)

    panel.connect()

    expect(getHomeAssistantRuntimeSnapshot().connected).toBe(true)
    expect(getHomeAssistantRuntimeSnapshot().adapter?.getEntity('sensor.temperature')?.state).toBe(
      '21',
    )
  })

  test('multiple mounted panel controllers fall back to the remaining host', () => {
    const first = controller()
    const second = controller()
    first.setHass(hass('sensor.first', '1'))
    second.setHass(hass('sensor.second', '2'))
    first.connect()
    second.connect()

    expect(getHomeAssistantRuntimeSnapshot().adapter?.getEntity('sensor.second')?.state).toBe('2')

    second.disconnect()

    expect(getHomeAssistantRuntimeSnapshot().connected).toBe(true)
    expect(getHomeAssistantRuntimeSnapshot().adapter?.getEntity('sensor.first')?.state).toBe('1')
  })
})
