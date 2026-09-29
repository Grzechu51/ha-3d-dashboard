import { describe, expect, test } from 'bun:test'
import { HomeAssistantHassAdapter, type HomeAssistantHassLike } from './hass-adapter'

function hass(
  states: HomeAssistantHassLike['states'],
  calls: unknown[][] = [],
): HomeAssistantHassLike {
  return {
    states,
    callService: async (...args) => {
      calls.push(args)
    },
  }
}

describe('Home Assistant hass adapter', () => {
  test('maps native hass state objects to the transport-independent entity shape', () => {
    const adapter = new HomeAssistantHassAdapter(
      hass({
        'sensor.salon_temperature': {
          entity_id: 'sensor.salon_temperature',
          state: '22.4',
          attributes: {
            friendly_name: 'Salon temperature',
            unit_of_measurement: '°C',
          },
          last_changed: '2026-09-29T09:00:00+00:00',
          last_updated: '2026-09-29T09:01:00+00:00',
        },
      }),
    )

    expect(adapter.getEntity('sensor.salon_temperature')).toEqual({
      entityId: 'sensor.salon_temperature',
      state: '22.4',
      attributes: {
        friendly_name: 'Salon temperature',
        unit_of_measurement: '°C',
      },
      lastChanged: '2026-09-29T09:00:00+00:00',
      lastUpdated: '2026-09-29T09:01:00+00:00',
    })
  })

  test('uses Home Assistant state object identity to publish only changed entities', () => {
    const light = {
      entity_id: 'light.salon',
      state: 'off',
      attributes: {},
    }
    const sensor = {
      entity_id: 'sensor.salon_temperature',
      state: '22',
      attributes: {},
    }
    const adapter = new HomeAssistantHassAdapter(
      hass({
        'light.salon': light,
        'sensor.salon_temperature': sensor,
      }),
    )
    const changes: string[][] = []
    const unsubscribe = adapter.subscribe((ids) => {
      changes.push([...ids].sort())
    })

    const updatedLight = {
      ...light,
      state: 'on',
    }
    adapter.updateHass(
      hass({
        'light.salon': updatedLight,
        'sensor.salon_temperature': sensor,
      }),
    )
    adapter.updateHass(
      hass({
        'light.salon': updatedLight,
        'sensor.salon_temperature': sensor,
      }),
    )

    expect(changes).toEqual([['light.salon']])
    unsubscribe()
  })

  test('forwards service calls with HA entity targets', async () => {
    const calls: unknown[][] = []
    const adapter = new HomeAssistantHassAdapter(hass({}, calls))

    await adapter.callService({
      domain: 'cover',
      service: 'set_cover_position',
      data: { position: 42 },
      target: { entityId: 'cover.salon' },
    })

    expect(calls).toEqual([
      ['cover', 'set_cover_position', { position: 42 }, { entity_id: 'cover.salon' }],
    ])
  })

  test('rejects service calls after disconnect', async () => {
    const adapter = new HomeAssistantHassAdapter(hass({}))
    adapter.disconnect()

    await expect(
      adapter.callService({
        domain: 'light',
        service: 'turn_on',
        target: { entityId: 'light.salon' },
      }),
    ).rejects.toThrow('disconnected')
  })
})
