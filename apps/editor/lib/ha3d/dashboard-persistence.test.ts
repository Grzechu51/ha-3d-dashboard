import { afterEach, describe, expect, test } from 'bun:test'
import { restoreHa3dDashboardProjectConfig } from './dashboard-persistence'
import { createEntityBinding } from './entity-binding'
import {
  getHa3dProjectConfigSnapshot,
  resetHa3dProjectConfig,
  upsertEntityBinding,
} from './project-config'

afterEach(() => {
  resetHa3dProjectConfig()
})

describe('HA 3D dashboard persistence', () => {
  test('restores the HA contribution from the editor presentation sidecar', () => {
    let requestedKey = ''
    const restored = restoreHa3dDashboardProjectConfig('client/house 1', {
      getItem: (key) => {
        requestedKey = key
        return JSON.stringify({
          version: 1,
          projectId: 'client/house 1',
          contributions: {
            'ha3d:home-assistant:presentation': {
              version: 1,
              bindings: [
                {
                  nodeId: 'item_lamp',
                  entityId: 'light.salon',
                  domain: 'light',
                  enabled: true,
                },
              ],
            },
          },
        })
      },
    })

    expect(restored).toBe(true)
    expect(requestedKey).toBe('pascal:project-presentation:v1:client%2Fhouse%201')
    expect(getHa3dProjectConfigSnapshot().bindings).toEqual([
      {
        nodeId: 'item_lamp',
        entityId: 'light.salon',
        domain: 'light',
        enabled: true,
      },
    ])
  })

  test('resets stale bindings when the sidecar is absent', () => {
    upsertEntityBinding(
      createEntityBinding({
        nodeId: 'item_lamp',
        entityId: 'light.salon',
      }),
    )

    expect(
      restoreHa3dDashboardProjectConfig('missing', {
        getItem: () => null,
      }),
    ).toBe(false)
    expect(getHa3dProjectConfigSnapshot().bindings).toEqual([])
  })

  test('fails closed on malformed or mismatched sidecars', () => {
    for (const raw of [
      '{',
      JSON.stringify({
        version: 1,
        projectId: 'other-project',
        contributions: {},
      }),
      JSON.stringify({
        version: 1,
        projectId: 'project',
        contributions: {
          'ha3d:home-assistant:presentation': {
            version: 1,
            bindings: [{ nodeId: 'x', entityId: 'camera.x', enabled: true }],
          },
        },
      }),
    ]) {
      expect(
        restoreHa3dDashboardProjectConfig('project', {
          getItem: () => raw,
        }),
      ).toBe(false)
      expect(getHa3dProjectConfigSnapshot().bindings).toEqual([])
    }
  })
})
