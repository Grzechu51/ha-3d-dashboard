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
  test('publishes adapter lifecycle changes', () => {
    const adapter = new MockHomeAssistantAdapter()
    let notifications = 0
    const unsubscribe = subscribeHomeAssistantRuntime(() => {
      notifications += 1
    })

    setHomeAssistantAdapter(adapter)

    expect(getHomeAssistantRuntimeSnapshot()).toEqual({
      adapter,
      connected: true,
    })
    expect(notifications).toBe(1)

    setHomeAssistantAdapter(adapter)
    expect(notifications).toBe(1)

    setHomeAssistantAdapter(null)
    expect(getHomeAssistantRuntimeSnapshot().connected).toBe(false)
    expect(notifications).toBe(2)

    unsubscribe()
  })

  test('mock adapter exposes state changes and records service calls', async () => {
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

    adapter.setEntity({
      entityId: 'light.salon',
      state: 'on',
      attributes: { brightness: 180 },
    })

    expect(adapter.getEntity('light.salon')?.state).toBe('on')
    expect(changed).toEqual([['light.salon']])

    await adapter.callService({
      domain: 'light',
      service: 'turn_off',
      target: { entityId: 'light.salon' },
    })

    expect(adapter.getServiceCalls()).toEqual([
      {
        domain: 'light',
        service: 'turn_off',
        target: { entityId: 'light.salon' },
      },
    ])

    unsubscribe()
  })
})
