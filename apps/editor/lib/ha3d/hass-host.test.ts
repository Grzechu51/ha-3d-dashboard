import { afterEach, describe, expect, test } from 'bun:test'
import type { HomeAssistantHassLike } from './hass-adapter'
import { createHomeAssistantHassHost } from './hass-host'
import { getHomeAssistantRuntimeSnapshot, setHomeAssistantAdapter } from './runtime'

const openHosts: Array<{ dispose(): void }> = []

function createHost() {
  const host = createHomeAssistantHassHost()
  openHosts.push(host)
  return host
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
  while (openHosts.length > 0) openHosts.pop()?.dispose()
  setHomeAssistantAdapter(null)
})

describe('Home Assistant hass host lifecycle', () => {
  test('installs the native adapter and propagates later hass updates', () => {
    const host = createHost()
    host.setHass(hass('light.salon', 'off'))

    const first = getHomeAssistantRuntimeSnapshot()
    expect(first.connected).toBe(true)
    expect(first.adapter?.id).toBe('home-assistant')
    expect(first.adapter?.getEntity('light.salon')?.state).toBe('off')

    host.setHass(hass('light.salon', 'on'))

    const second = getHomeAssistantRuntimeSnapshot()
    expect(second.adapter).toBe(first.adapter)
    expect(second.revision).toBeGreaterThan(first.revision)
    expect(second.adapter?.getEntity('light.salon')?.state).toBe('on')
  })

  test('falls back to another mounted panel host when the active one unmounts', () => {
    const firstHost = createHost()
    const secondHost = createHost()
    firstHost.setHass(hass('sensor.first', '1'))
    secondHost.setHass(hass('sensor.second', '2'))

    expect(getHomeAssistantRuntimeSnapshot().adapter?.getEntity('sensor.second')?.state).toBe('2')

    secondHost.dispose()

    expect(getHomeAssistantRuntimeSnapshot().connected).toBe(true)
    expect(getHomeAssistantRuntimeSnapshot().adapter?.getEntity('sensor.first')?.state).toBe('1')
  })

  test('disconnects only after the final native host is disposed', () => {
    const host = createHost()
    host.setHass(hass('light.salon', 'on'))
    expect(getHomeAssistantRuntimeSnapshot().connected).toBe(true)

    host.dispose()
    expect(getHomeAssistantRuntimeSnapshot().connected).toBe(false)
  })
})
