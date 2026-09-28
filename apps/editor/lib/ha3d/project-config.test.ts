import { afterEach, describe, expect, test } from 'bun:test'
import { createEntityBinding } from './entity-binding'
import {
  getHa3dProjectConfigSnapshot,
  ha3dProjectConfiguration,
  removeEntityBinding,
  resetHa3dProjectConfig,
  upsertEntityBinding,
} from './project-config'

afterEach(() => {
  resetHa3dProjectConfig()
})

describe('HA 3D project configuration', () => {
  test('keeps at most one binding per node and domain', () => {
    upsertEntityBinding(createEntityBinding({ nodeId: 'item_lamp', entityId: 'light.first' }))
    upsertEntityBinding(createEntityBinding({ nodeId: 'item_lamp', entityId: 'light.second' }))
    upsertEntityBinding(
      createEntityBinding({ nodeId: 'item_lamp', entityId: 'sensor.temperature' }),
    )

    expect(getHa3dProjectConfigSnapshot().bindings).toEqual([
      {
        nodeId: 'item_lamp',
        entityId: 'light.second',
        domain: 'light',
        enabled: true,
      },
      {
        nodeId: 'item_lamp',
        entityId: 'sensor.temperature',
        domain: 'sensor',
        enabled: true,
      },
    ])
  })

  test('round-trips through the Pascal presentation configuration seam', () => {
    upsertEntityBinding(createEntityBinding({ nodeId: 'item_lamp', entityId: 'light.salon' }))
    const persisted = ha3dProjectConfiguration.getSnapshot()

    resetHa3dProjectConfig()
    expect(getHa3dProjectConfigSnapshot().bindings).toEqual([])

    ha3dProjectConfiguration.restore(persisted)
    expect(getHa3dProjectConfigSnapshot().bindings).toEqual([
      {
        nodeId: 'item_lamp',
        entityId: 'light.salon',
        domain: 'light',
        enabled: true,
      },
    ])
  })

  test('rejects corrupted persisted data instead of partially restoring it', () => {
    expect(() =>
      ha3dProjectConfiguration.restore({
        version: 1,
        bindings: [
          {
            nodeId: 'item_lamp',
            entityId: 'light.salon',
            domain: 'cover',
            enabled: true,
          },
        ],
      }),
    ).toThrow()

    expect(getHa3dProjectConfigSnapshot().bindings).toEqual([])
  })

  test('removes one domain without touching other bindings on the node', () => {
    upsertEntityBinding(createEntityBinding({ nodeId: 'item_lamp', entityId: 'light.salon' }))
    upsertEntityBinding(
      createEntityBinding({ nodeId: 'item_lamp', entityId: 'sensor.temperature' }),
    )

    removeEntityBinding('item_lamp', 'light')

    expect(getHa3dProjectConfigSnapshot().bindings.map((binding) => binding.domain)).toEqual([
      'sensor',
    ])
  })
})
