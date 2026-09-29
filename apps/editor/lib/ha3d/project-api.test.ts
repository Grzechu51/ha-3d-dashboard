import { describe, expect, test } from 'bun:test'
import {
  createHomeAssistantProject,
  deleteHomeAssistantProject,
  getHomeAssistantProject,
  type HomeAssistantProjectApiHost,
  listHomeAssistantProjects,
  saveHomeAssistantProject,
} from './project-api'
import { loadHomeAssistantStructure } from './structure'
import { groupHomeAssistantStructure } from './structure-tree'

function wireProject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    id: 'main_house',
    name: 'Main house',
    revision: 1,
    scene: { nodes: {}, rootNodeIds: [] },
    ha_config: { version: 1, bindings: [] },
    created_at: '2026-09-29T10:00:00+00:00',
    updated_at: '2026-09-29T10:00:00+00:00',
    ...overrides,
  }
}

function host(
  responder: (message: Readonly<Record<string, unknown>>) => unknown | Promise<unknown>,
): HomeAssistantProjectApiHost {
  return {
    callWS: async <T>(message: Readonly<Record<string, unknown>>) =>
      (await responder(message)) as T,
  }
}

describe('Home Assistant project WebSocket client', () => {
  test('lists lightweight project metadata', async () => {
    const projects = await listHomeAssistantProjects(
      host((message) => {
        expect(message).toEqual({ type: 'ha_3d_dashboard/project/list' })
        return {
          projects: [
            {
              id: 'main_house',
              name: 'Main house',
              revision: 3,
              created_at: '2026-09-29T10:00:00+00:00',
              updated_at: '2026-09-29T10:05:00+00:00',
            },
          ],
        }
      }),
    )

    expect(projects).toEqual([
      {
        id: 'main_house',
        name: 'Main house',
        revision: 3,
        createdAt: '2026-09-29T10:00:00+00:00',
        updatedAt: '2026-09-29T10:05:00+00:00',
      },
    ])
  })

  test('loads and validates a stored project and HA sidecar', async () => {
    const project = await getHomeAssistantProject(
      host((message) => {
        expect(message).toEqual({
          type: 'ha_3d_dashboard/project/get',
          project_id: 'main_house',
        })
        return wireProject()
      }),
      'main_house',
    )

    expect(project.id).toBe('main_house')
    expect(project.schemaVersion).toBe(1)
    expect(project.haConfig).toEqual({ version: 1, bindings: [] })
  })

  test('creates a project without sending absent optional fields', async () => {
    const seen: Readonly<Record<string, unknown>>[] = []
    const project = await createHomeAssistantProject(
      host((message) => {
        seen.push(message)
        return wireProject()
      }),
      { name: 'Main house' },
    )

    expect(seen).toEqual([
      {
        type: 'ha_3d_dashboard/project/create',
        name: 'Main house',
      },
    ])
    expect(project.revision).toBe(1)
  })

  test('save sends expected_revision and only requested changes', async () => {
    const project = await saveHomeAssistantProject(
      host((message) => {
        expect(message).toEqual({
          type: 'ha_3d_dashboard/project/save',
          project_id: 'main_house',
          expected_revision: 4,
          ha_config: { version: 1, bindings: [] },
          force_empty_scene: true,
        })
        return wireProject({ revision: 5 })
      }),
      {
        projectId: 'main_house',
        expectedRevision: 4,
        haConfig: { version: 1, bindings: [] },
        forceEmptyScene: true,
      },
    )

    expect(project.revision).toBe(5)
  })

  test('delete requires the caller revision and validates acknowledgement', async () => {
    await deleteHomeAssistantProject(
      host((message) => {
        expect(message).toEqual({
          type: 'ha_3d_dashboard/project/delete',
          project_id: 'main_house',
          expected_revision: 7,
        })
        return { project_id: 'main_house', deleted: true }
      }),
      'main_house',
      7,
    )
  })

  test('loads Home Assistant structure registries', async () => {
    const calls: string[] = []
    const structure = await loadHomeAssistantStructure(
      host((message) => {
        calls.push(String(message.type))
        return message.type === 'config/entity_registry/list_for_display' ? { entities: [] } : []
      }),
    )

    expect(structure.floors).toEqual([])
    expect(calls).toEqual([
      'config/floor_registry/list',
      'config/area_registry/list',
      'config/device_registry/list',
      'config/entity_registry/list_for_display',
    ])
  })

  test('rejects malformed backend HA project configuration', async () => {
    await expect(
      getHomeAssistantProject(
        host(() => wireProject({ ha_config: { version: 999, bindings: [] } })),
        'main_house',
      ),
    ).rejects.toThrow('unsupported project config version')
  })
})
