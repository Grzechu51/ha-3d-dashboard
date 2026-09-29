import { afterEach, describe, expect, test } from 'bun:test'
import { MockHomeAssistantAdapter } from './mock-home-assistant-adapter'
import {
  getHomeAssistantRuntimeSnapshot,
  setHomeAssistantAdapter,
  subscribeHomeAssistantRuntime,
} from './runtime'

afterEach(() => {
  setHomeAssistantAdapter(null)
})

describe('Home Assistant runtime', () => {
  test('publishes adapter lifecycle and entity-state changes', () => {
    const adapter = new MockHomeAssistantAdapter()
    let notifications = 0
    const unsubscribe = subscribeHomeAssistantRuntime(() => {
      notifications += 1
    })

    setHomeAssistantAdapter(adapter)
    const connectedRevision = getHomeAssistantRuntimeSnapshot().revision

    expect(getHomeAssistantRuntimeSnapshot()).toEqual({
      adapter,
      connected: true,
      revision: connectedRevision,
    })
    expect(notifications).toBe(1)

    adapter.setEntity({
      entityId: 'light.salon',
      state: 'on',
      attributes: { brightness: 180 },
    })
    expect(getHomeAssistantRuntimeSnapshot().revision).toBe(connectedRevision + 1)
    expect(notifications).toBe(2)

    setHomeAssistantAdapter(adapter)
    expect(notifications).toBe(2)

    setHomeAssistantAdapter(null)
    expect(getHomeAssistantRuntimeSnapshot().connected).toBe(false)
    expect(notifications).toBe(3)

    unsubscribe()
  })

  test('mock adapter simulates light services and records the calls', async () => {
    const adapter = new MockHomeAssistantAdapter([
      {
        entityId: 'light.salon',
        state: 'off',
        attributes: {},
      },
    ])
    const changed: string[][] = []
    const unsubscribe = adapter.subscribe((entityIds) => {
      changed.push([...entityIds])
    })

    await adapter.callService({
      domain: 'light',
      service: 'turn_on',
      data: { brightness: 180 },
      target: { entityId: 'light.salon' },
    })

    expect(adapter.getEntity('light.salon')).toEqual({
      entityId: 'light.salon',
      state: 'on',
      attributes: { brightness: 180 },
    })
    expect(changed).toEqual([['light.salon']])
    expect(adapter.getServiceCalls()).toEqual([
      {
        domain: 'light',
        service: 'turn_on',
        data: { brightness: 180 },
        target: { entityId: 'light.salon' },
      },
    ])

    unsubscribe()
  })

  test('mock adapter simulates cover position services', async () => {
    const adapter = new MockHomeAssistantAdapter([
      {
        entityId: 'cover.salon',
        state: 'closed',
        attributes: { current_position: 0 },
      },
    ])

    await adapter.callService({
      domain: 'cover',
      service: 'set_cover_position',
      data: { position: 37 },
      target: { entityId: 'cover.salon' },
    })

    expect(adapter.getEntity('cover.salon')).toEqual({
      entityId: 'cover.salon',
      state: 'open',
      attributes: { current_position: 37 },
    })

    await adapter.callService({
      domain: 'cover',
      service: 'close_cover',
      target: { entityId: 'cover.salon' },
    })

    expect(adapter.getEntity('cover.salon')?.attributes.current_position).toBe(0)
    expect(adapter.getEntity('cover.salon')?.state).toBe('closed')
  })

  test('mock adapter simulates switch and climate services', async () => {
    const adapter = new MockHomeAssistantAdapter([
      {
        entityId: 'switch.salon_tv',
        state: 'off',
        attributes: {},
      },
      {
        entityId: 'climate.salon',
        state: 'heat',
        attributes: {
          current_temperature: 21.5,
          temperature: 22,
          hvac_modes: ['off', 'heat', 'cool'],
        },
      },
    ])

    await adapter.callService({
      domain: 'switch',
      service: 'turn_on',
      target: { entityId: 'switch.salon_tv' },
    })
    expect(adapter.getEntity('switch.salon_tv')?.state).toBe('on')

    await adapter.callService({
      domain: 'climate',
      service: 'set_temperature',
      data: { temperature: 23.5 },
      target: { entityId: 'climate.salon' },
    })
    expect(adapter.getEntity('climate.salon')?.attributes.temperature).toBe(23.5)

    await adapter.callService({
      domain: 'climate',
      service: 'set_hvac_mode',
      data: { hvac_mode: 'cool' },
      target: { entityId: 'climate.salon' },
    })
    expect(adapter.getEntity('climate.salon')?.state).toBe('cool')
  })
})
