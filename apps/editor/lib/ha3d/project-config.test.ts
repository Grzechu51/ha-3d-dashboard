import { afterEach, describe, expect, test } from 'bun:test'
import { createEntityBinding } from './entity-binding'
import {
  addDashboardMenuItem,
  getHa3dProjectConfigSnapshot,
  ha3dProjectConfiguration,
  moveDashboardMenuItem,
  removeAreaStructureMapping,
  removeDashboardMenuItem,
  removeEntityBinding,
  removeFloorStructureMapping,
  resetHa3dProjectConfig,
  setDashboardLovelaceCard,
  setDashboardMenuMode,
  updateDashboardMenuItem,
  upsertAreaStructureMapping,
  upsertEntityBinding,
  upsertFloorStructureMapping,
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
        tapAction: 'default',
        holdAction: 'default',
      },
      {
        nodeId: 'item_lamp',
        entityId: 'sensor.temperature',
        domain: 'sensor',
        enabled: true,
        tapAction: 'default',
        holdAction: 'default',
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
        tapAction: 'default',
        holdAction: 'default',
      },
    ])
  })

  test('persists and updates cover motion configuration', () => {
    const cover = createEntityBinding({
      nodeId: 'item_blind',
      entityId: 'cover.salon',
    })
    upsertEntityBinding(cover)
    upsertEntityBinding({
      ...cover,
      coverMotion: {
        axis: 'z',
        openOffsetMeters: -1.6,
        durationMs: 1400,
      },
    })

    const persisted = ha3dProjectConfiguration.getSnapshot()
    resetHa3dProjectConfig()
    ha3dProjectConfiguration.restore(persisted)

    expect(getHa3dProjectConfigSnapshot().bindings).toEqual([
      {
        nodeId: 'item_blind',
        entityId: 'cover.salon',
        domain: 'cover',
        enabled: true,
        tapAction: 'default',
        holdAction: 'default',
        coverMotion: {
          axis: 'z',
          openOffsetMeters: -1.6,
          durationMs: 1400,
        },
      },
    ])
  })

  test('normalizes legacy bindings without interaction actions', () => {
    ha3dProjectConfiguration.restore({
      version: 1,
      bindings: [
        {
          nodeId: 'legacy_lamp',
          entityId: 'light.legacy',
          domain: 'light',
          enabled: true,
        },
      ],
    })

    expect(getHa3dProjectConfigSnapshot().bindings[0]).toMatchObject({
      nodeId: 'legacy_lamp',
      entityId: 'light.legacy',
      tapAction: 'default',
      holdAction: 'default',
    })
  })

  test('loads legacy project config with empty structure mappings', () => {
    ha3dProjectConfiguration.restore({
      version: 1,
      bindings: [],
    })

    expect(getHa3dProjectConfigSnapshot().structureMappings).toEqual({
      floors: [],
      areas: [],
    })
  })

  test('loads legacy project config with automatic dashboard menu', () => {
    ha3dProjectConfiguration.restore({
      version: 1,
      bindings: [],
    })

    expect(getHa3dProjectConfigSnapshot().dashboardMenu).toEqual({
      mode: 'auto',
      items: [],
      lovelaceCard: { type: 'vertical-stack', cards: [] },
    })
  })

  test('persists, resizes and reorders custom dashboard menu tiles', () => {
    addDashboardMenuItem('light.salon')
    addDashboardMenuItem('sensor.temperature')
    updateDashboardMenuItem('light.salon', { span: 1 })
    moveDashboardMenuItem('sensor.temperature', -1)

    const persisted = ha3dProjectConfiguration.getSnapshot()
    resetHa3dProjectConfig()
    ha3dProjectConfiguration.restore(persisted)

    expect(getHa3dProjectConfigSnapshot().dashboardMenu).toEqual({
      mode: 'custom',
      items: [
        { entityId: 'sensor.temperature', span: 2 },
        { entityId: 'light.salon', span: 1 },
      ],
      lovelaceCard: { type: 'vertical-stack', cards: [] },
    })

    removeDashboardMenuItem('sensor.temperature')
    setDashboardMenuMode('auto')
    expect(getHa3dProjectConfigSnapshot().dashboardMenu).toEqual({
      mode: 'auto',
      items: [{ entityId: 'light.salon', span: 1 }],
      lovelaceCard: { type: 'vertical-stack', cards: [] },
    })
  })

  test('persists a native Lovelace dashboard Menu card tree', () => {
    setDashboardLovelaceCard({
      type: 'vertical-stack',
      cards: [
        {
          type: 'custom:mushroom-light-card',
          entity: 'light.cct',
          show_brightness_control: true,
        },
      ],
    })

    const persisted = ha3dProjectConfiguration.getSnapshot()
    resetHa3dProjectConfig()
    ha3dProjectConfiguration.restore(persisted)

    expect(getHa3dProjectConfigSnapshot().dashboardMenu).toMatchObject({
      mode: 'lovelace',
      lovelaceCard: {
        type: 'vertical-stack',
        cards: [
          {
            type: 'custom:mushroom-light-card',
            entity: 'light.cct',
            show_brightness_control: true,
          },
        ],
      },
    })
  })

  test('round-trips manual Home Assistant structure mappings', () => {
    upsertFloorStructureMapping('ground', 'level_ground')
    upsertAreaStructureMapping('living', 'zone_living')

    const persisted = ha3dProjectConfiguration.getSnapshot()
    resetHa3dProjectConfig()
    ha3dProjectConfiguration.restore(persisted)

    expect(getHa3dProjectConfigSnapshot().structureMappings).toEqual({
      floors: [{ floorId: 'ground', levelNodeId: 'level_ground' }],
      areas: [{ areaId: 'living', zoneNodeId: 'zone_living' }],
    })
  })

  test('does not publish a redundant structure mapping update', () => {
    upsertFloorStructureMapping('ground', 'level_ground')
    const before = getHa3dProjectConfigSnapshot()

    upsertFloorStructureMapping('ground', 'level_ground')

    expect(getHa3dProjectConfigSnapshot()).toBe(before)
  })

  test('keeps structure mappings one-to-one and removable', () => {
    upsertFloorStructureMapping('ground', 'level_shared')
    upsertFloorStructureMapping('upper', 'level_shared')
    upsertAreaStructureMapping('living', 'zone_shared')
    upsertAreaStructureMapping('kitchen', 'zone_shared')

    expect(getHa3dProjectConfigSnapshot().structureMappings).toEqual({
      floors: [{ floorId: 'upper', levelNodeId: 'level_shared' }],
      areas: [{ areaId: 'kitchen', zoneNodeId: 'zone_shared' }],
    })

    removeFloorStructureMapping('upper')
    removeAreaStructureMapping('kitchen')
    expect(getHa3dProjectConfigSnapshot().structureMappings).toEqual({
      floors: [],
      areas: [],
    })
  })

  test('rejects duplicate persisted structure mapping targets', () => {
    expect(() =>
      ha3dProjectConfiguration.restore({
        version: 1,
        bindings: [],
        structureMappings: {
          floors: [
            { floorId: 'ground', levelNodeId: 'level_shared' },
            { floorId: 'upper', levelNodeId: 'level_shared' },
          ],
          areas: [],
        },
      }),
    ).toThrow('floor mappings must be one-to-one')
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
            tapAction: 'default',
            holdAction: 'default',
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
