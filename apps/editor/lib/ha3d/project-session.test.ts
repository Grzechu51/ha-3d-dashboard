import { describe, expect, test } from 'bun:test'
import type { SceneGraph } from '@pascal-app/editor'
import type { HomeAssistantProjectApiHost } from './project-api'
import {
  createHomeAssistantProjectSession,
  type HomeAssistantProjectConfigurationPort,
} from './project-session'

const EMPTY_SCENE: SceneGraph = {
  nodes: {},
  rootNodeIds: [],
}

function wireProject(
  options: { revision?: number; scene?: SceneGraph | null; haConfig?: unknown } = {},
): Record<string, unknown> {
  return {
    schema_version: 1,
    id: 'main_house',
    name: 'Main house',
    revision: options.revision ?? 1,
    scene: options.scene ?? EMPTY_SCENE,
    ha_config: options.haConfig ?? { version: 1, bindings: [] },
    created_at: '2026-09-29T10:00:00+00:00',
    updated_at: '2026-09-29T10:00:00+00:00',
  }
}

class TestConfiguration implements HomeAssistantProjectConfigurationPort {
  private snapshot: unknown = { version: 1, bindings: [] }
  private readonly listeners = new Set<() => void>()
  readonly restored: unknown[] = []

  getSnapshot = (): unknown => this.snapshot

  restore = (raw: unknown): void => {
    this.snapshot = raw
    this.restored.push(raw)
    for (const listener of this.listeners) listener()
  }

  reset = (): void => {
    this.snapshot = { version: 1, bindings: [] }
    for (const listener of this.listeners) listener()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  set(raw: unknown): void {
    this.snapshot = raw
    for (const listener of this.listeners) listener()
  }
}

function sequentialServer(
  options: {
    initialConfig?: unknown
    onSave?: (
      message: Readonly<Record<string, unknown>>,
      saveNumber: number,
    ) => Promise<void> | void
  } = {},
): {
  host: HomeAssistantProjectApiHost
  messages: Readonly<Record<string, unknown>>[]
} {
  let revision = 1
  let scene: SceneGraph | null = EMPTY_SCENE
  let haConfig = options.initialConfig ?? { version: 1, bindings: [] }
  let saveNumber = 0
  const messages: Readonly<Record<string, unknown>>[] = []

  const host: HomeAssistantProjectApiHost = {
    callWS: async <T>(message: Readonly<Record<string, unknown>>) => {
      messages.push(message)

      if (message.type === 'ha_3d_dashboard/project/get') {
        return wireProject({ revision, scene, haConfig }) as T
      }

      if (message.type === 'ha_3d_dashboard/project/save') {
        saveNumber += 1
        await options.onSave?.(message, saveNumber)
        expect(message.expected_revision).toBe(revision)
        if (message.scene !== undefined) scene = message.scene as SceneGraph
        if (message.ha_config !== undefined) haConfig = message.ha_config
        revision += 1
        return wireProject({ revision, scene, haConfig }) as T
      }

      throw new Error(`unexpected command: ${String(message.type)}`)
    },
  }

  return { host, messages }
}

describe('Home Assistant project session', () => {
  test('load restores HA configuration without writing it back', async () => {
    const configuration = new TestConfiguration()
    const server = sequentialServer({
      initialConfig: {
        version: 1,
        bindings: [
          {
            nodeId: 'lamp',
            entityId: 'light.salon',
            domain: 'light',
            enabled: true,
          },
        ],
      },
    })
    const session = createHomeAssistantProjectSession(server.host, 'main_house', {
      configuration,
      configurationFlushDelayMs: 60_000,
    })

    const scene = await session.load()

    expect(scene).toEqual(EMPTY_SCENE)
    expect(configuration.restored).toHaveLength(1)
    expect(server.messages.map((message) => message.type)).toEqual(['ha_3d_dashboard/project/get'])
    expect(session.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 1,
    })
    session.dispose()
  })

  test('scene save folds a pending HA config into the same revision', async () => {
    const configuration = new TestConfiguration()
    const server = sequentialServer()
    const session = createHomeAssistantProjectSession(server.host, 'main_house', {
      configuration,
      configurationFlushDelayMs: 60_000,
    })
    await session.load()

    configuration.set({
      version: 1,
      bindings: [
        {
          nodeId: 'blind',
          entityId: 'cover.salon',
          domain: 'cover',
          enabled: true,
          coverMotion: {
            axis: 'y',
            openOffsetMeters: 1.8,
            durationMs: 800,
          },
        },
      ],
    })

    const scene: SceneGraph = {
      nodes: { site: { id: 'site', type: 'site' } },
      rootNodeIds: ['site'],
    }
    await session.saveScene(scene)

    const save = server.messages.find((message) => message.type === 'ha_3d_dashboard/project/save')
    expect(save).toMatchObject({
      expected_revision: 1,
      scene,
      ha_config: {
        version: 1,
        bindings: [
          {
            nodeId: 'blind',
            entityId: 'cover.salon',
          },
        ],
      },
    })
    expect(session.getSnapshot().revision).toBe(2)
    session.dispose()
  })

  test('config save and following scene save serialize through fresh revisions', async () => {
    const configuration = new TestConfiguration()
    let releaseFirstSave: (() => void) | null = null
    const firstSaveBlocked = new Promise<void>((resolve) => {
      releaseFirstSave = resolve
    })
    const server = sequentialServer({
      onSave: async (_message, saveNumber) => {
        if (saveNumber === 1) await firstSaveBlocked
      },
    })
    const session = createHomeAssistantProjectSession(server.host, 'main_house', {
      configuration,
      configurationFlushDelayMs: 60_000,
    })
    await session.load()

    configuration.set({
      version: 1,
      bindings: [
        {
          nodeId: 'lamp',
          entityId: 'light.salon',
          domain: 'light',
          enabled: true,
        },
      ],
    })

    const configSave = session.flushConfiguration()
    const sceneSave = session.saveScene({
      nodes: { site: { id: 'site', type: 'site' } },
      rootNodeIds: ['site'],
    })

    releaseFirstSave?.()
    await Promise.all([configSave, sceneSave])

    const saves = server.messages.filter(
      (message) => message.type === 'ha_3d_dashboard/project/save',
    )
    expect(saves).toHaveLength(2)
    expect(saves[0]?.expected_revision).toBe(1)
    expect(saves[1]?.expected_revision).toBe(2)
    expect(session.getSnapshot().revision).toBe(3)
    session.dispose()
  })

  test('version conflict blocks subsequent writes until reload', async () => {
    const configuration = new TestConfiguration()
    let firstSave = true
    const host: HomeAssistantProjectApiHost = {
      callWS: async <T>(message: Readonly<Record<string, unknown>>) => {
        if (message.type === 'ha_3d_dashboard/project/get') {
          return wireProject() as T
        }
        if (message.type === 'ha_3d_dashboard/project/save' && firstSave) {
          firstSave = false
          throw { code: 'version_conflict', message: 'stale writer' }
        }
        return wireProject({ revision: 2 }) as T
      },
    }
    const session = createHomeAssistantProjectSession(host, 'main_house', {
      configuration,
      configurationFlushDelayMs: 60_000,
    })
    await session.load()

    await expect(session.saveScene(EMPTY_SCENE)).rejects.toEqual({
      code: 'version_conflict',
      message: 'stale writer',
    })
    expect(session.getSnapshot()).toMatchObject({
      status: 'conflict',
      revision: 1,
      errorCode: 'version_conflict',
    })

    await expect(session.saveScene(EMPTY_SCENE)).rejects.toThrow(
      'must reload after a version conflict',
    )

    await session.load()
    expect(session.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 1,
      errorCode: null,
    })
    session.dispose()
  })

  test('flushConfiguration preserves a failed scene write when there is no config dirt', async () => {
    const configuration = new TestConfiguration()
    let failNextSave = true
    const host: HomeAssistantProjectApiHost = {
      callWS: async <T>(message: Readonly<Record<string, unknown>>) => {
        if (message.type === 'ha_3d_dashboard/project/get') {
          return wireProject() as T
        }
        if (message.type === 'ha_3d_dashboard/project/save' && failNextSave) {
          failNextSave = false
          throw { code: 'storage_error', message: 'disk unavailable' }
        }
        if (message.type === 'ha_3d_dashboard/project/save') {
          return wireProject({ revision: 2 }) as T
        }
        throw new Error(`unexpected command: ${String(message.type)}`)
      },
    }
    const session = createHomeAssistantProjectSession(host, 'main_house', {
      configuration,
      configurationFlushDelayMs: 60_000,
    })
    await session.load()

    await expect(session.saveScene(EMPTY_SCENE)).rejects.toEqual({
      code: 'storage_error',
      message: 'disk unavailable',
    })
    expect(session.getSnapshot()).toMatchObject({
      status: 'error',
      revision: 1,
      errorCode: 'storage_error',
    })

    await expect(session.flushConfiguration()).rejects.toEqual({
      code: 'storage_error',
      message: 'disk unavailable',
    })

    await session.saveScene(EMPTY_SCENE)
    await session.flushConfiguration()
    expect(session.getSnapshot()).toMatchObject({
      status: 'ready',
      revision: 2,
      errorCode: null,
    })
    session.dispose()
  })

test('configuration changes during a save schedule a follow-up revision', async () => {
    const configuration = new TestConfiguration()
    let releaseSave: (() => void) | null = null
    let markSaveStarted: (() => void) | null = null
    const blocked = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    const saveStarted = new Promise<void>((resolve) => {
      markSaveStarted = resolve
    })
    const server = sequentialServer({
      onSave: async (_message, saveNumber) => {
        if (saveNumber === 1) {
          markSaveStarted?.()
          await blocked
        }
      },
    })
    const session = createHomeAssistantProjectSession(server.host, 'main_house', {
      configuration,
      configurationFlushDelayMs: 1,
    })
    await session.load()

    configuration.set({
      version: 1,
      bindings: [
        {
          nodeId: 'lamp',
          entityId: 'light.salon',
          domain: 'light',
          enabled: true,
        },
      ],
    })

    const first = session.saveScene({
      nodes: { site: { id: 'site', type: 'site' } },
      rootNodeIds: ['site'],
    })

    await saveStarted
    configuration.set({
      version: 1,
      bindings: [
        {
          nodeId: 'lamp',
          entityId: 'light.kitchen',
          domain: 'light',
          enabled: true,
        },
      ],
    })
    releaseSave?.()
    await first
    await new Promise((resolve) => setTimeout(resolve, 10))
    await session.flushConfiguration()

    const saves = server.messages.filter(
      (message) => message.type === 'ha_3d_dashboard/project/save',
    )
    expect(saves.length).toBeGreaterThanOrEqual(2)
    expect(saves.at(-1)?.ha_config).toMatchObject({
      bindings: [{ entityId: 'light.kitchen' }],
    })
    session.dispose()
  })
})
