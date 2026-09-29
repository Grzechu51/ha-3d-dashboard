import type { SceneGraph } from '@pascal-app/editor'
import {
  getHomeAssistantProject,
  type Ha3dStoredProject,
  type HomeAssistantProjectApiHost,
  homeAssistantProjectApiErrorCode,
  saveHomeAssistantProject,
} from './project-api'
import {
  getHa3dProjectConfigSnapshot,
  ha3dProjectConfiguration,
  parseHa3dProjectConfig,
  subscribeHa3dProjectConfig,
} from './project-config'

const DEFAULT_CONFIGURATION_FLUSH_DELAY_MS = 250

export type HomeAssistantProjectSessionStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'conflict'
  | 'error'
  | 'disposed'

export type HomeAssistantProjectSessionSnapshot = Readonly<{
  projectId: string
  status: HomeAssistantProjectSessionStatus
  revision: number | null
  errorCode: string | null
  errorMessage: string | null
}>

export type HomeAssistantProjectConfigurationPort = Readonly<{
  getSnapshot: () => unknown
  restore: (raw: unknown) => void
  reset: () => void
  subscribe: (listener: () => void) => () => void
}>

export type HomeAssistantProjectSessionOptions = Readonly<{
  configuration?: HomeAssistantProjectConfigurationPort
  configurationFlushDelayMs?: number
}>

export type SaveHomeAssistantProjectSceneOptions = Readonly<{
  forceEmptyScene?: boolean
}>

export type HomeAssistantProjectSession = Readonly<{
  getSnapshot: () => HomeAssistantProjectSessionSnapshot
  subscribe: (listener: () => void) => () => void
  load: () => Promise<SceneGraph | null>
  saveScene: (scene: SceneGraph, options?: SaveHomeAssistantProjectSceneOptions) => Promise<void>
  flushConfiguration: () => Promise<void>
  getProject: () => Ha3dStoredProject | null
  dispose: () => void
}>

const defaultConfiguration: HomeAssistantProjectConfigurationPort = {
  getSnapshot: getHa3dProjectConfigSnapshot,
  restore: (raw) => ha3dProjectConfiguration.restore(raw),
  reset: () => ha3dProjectConfiguration.reset(),
  subscribe: subscribeHa3dProjectConfig,
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

class HomeAssistantProjectSessionImpl implements HomeAssistantProjectSession {
  private readonly api: HomeAssistantProjectApiHost
  private readonly projectId: string
  private readonly configuration: HomeAssistantProjectConfigurationPort
  private readonly configurationFlushDelayMs: number
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribeConfiguration: () => void

  private project: Ha3dStoredProject | null = null
  private snapshot: HomeAssistantProjectSessionSnapshot
  private writeTail: Promise<void> = Promise.resolve()
  private configurationDirty = false
  private configurationGeneration = 0
  private configurationTimer: ReturnType<typeof setTimeout> | undefined
  private suppressConfigurationWrites = false
  private disposed = false

  constructor(
    api: HomeAssistantProjectApiHost,
    projectId: string,
    options: HomeAssistantProjectSessionOptions,
  ) {
    this.api = api
    this.projectId = projectId
    this.configuration = options.configuration ?? defaultConfiguration
    this.configurationFlushDelayMs =
      options.configurationFlushDelayMs ?? DEFAULT_CONFIGURATION_FLUSH_DELAY_MS
    this.snapshot = {
      projectId,
      status: 'idle',
      revision: null,
      errorCode: null,
      errorMessage: null,
    }
    this.unsubscribeConfiguration = this.configuration.subscribe(this.handleConfigurationChange)
  }

  getSnapshot = (): HomeAssistantProjectSessionSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getProject = (): Ha3dStoredProject | null => this.project

  load = async (): Promise<SceneGraph | null> => {
    this.assertActive()
    this.clearConfigurationTimer()
    const recoveringFromConflict = this.snapshot.status === 'conflict'

    if (recoveringFromConflict) {
      await this.writeTail.catch(() => undefined)
    } else {
      await this.writeTail
      if (this.configurationDirty) await this.flushConfiguration()
    }

    this.assertActive()
    this.publish('loading')

    try {
      const project = await getHomeAssistantProject(this.api, this.projectId)
      this.assertActive()
      this.suppressConfigurationWrites = true
      try {
        this.configuration.restore(project.haConfig)
      } finally {
        this.suppressConfigurationWrites = false
      }
      this.project = project
      this.configurationDirty = false
      this.configurationGeneration = 0
      this.publish('ready')
      return project.scene as SceneGraph | null
    } catch (error) {
      this.publishError(error)
      throw error
    }
  }

  saveScene = (
    scene: SceneGraph,
    options: SaveHomeAssistantProjectSceneOptions = {},
  ): Promise<void> =>
    this.enqueueWrite(() =>
      this.persistMutation({
        scene,
        forceEmptyScene: options.forceEmptyScene,
      }),
    )

  flushConfiguration = async (): Promise<void> => {
    this.clearConfigurationTimer()
    await this.writeTail
    if (!this.configurationDirty) return

    await this.enqueueWrite(async () => {
      while (this.configurationDirty) {
        await this.persistMutation({})
      }
      this.clearConfigurationTimer()
    })
  }

  dispose = (): void => {
    if (this.disposed) return
    this.disposed = true
    this.clearConfigurationTimer()
    this.unsubscribeConfiguration()
    this.publish('disposed')
    this.listeners.clear()
  }

  private readonly handleConfigurationChange = (): void => {
    if (this.disposed || this.suppressConfigurationWrites || !this.project) return
    this.configurationGeneration += 1
    this.configurationDirty = true
    this.scheduleConfigurationFlush()
  }

  private scheduleConfigurationFlush(): void {
    if (this.disposed || !this.configurationDirty) return
    this.clearConfigurationTimer()
    this.configurationTimer = setTimeout(() => {
      this.configurationTimer = undefined
      void this.flushConfiguration().catch(() => undefined)
    }, this.configurationFlushDelayMs)
  }

  private clearConfigurationTimer(): void {
    if (this.configurationTimer === undefined) return
    clearTimeout(this.configurationTimer)
    this.configurationTimer = undefined
  }

  private enqueueWrite(operation: () => Promise<void>): Promise<void> {
    this.assertActive()
    const run = this.writeTail
      .catch(() => undefined)
      .then(async () => {
        this.assertWritable()
        await operation()
      })
    this.writeTail = run
    return run
  }

  private async persistMutation(input: {
    scene?: SceneGraph
    forceEmptyScene?: boolean
  }): Promise<void> {
    const project = this.project
    if (!project) throw new Error('[ha3d] project session has not been loaded')

    const configurationGeneration = this.configurationGeneration
    const includeConfiguration = this.configurationDirty
    const haConfig = includeConfiguration
      ? parseHa3dProjectConfig(this.configuration.getSnapshot())
      : undefined

    this.publish('saving')

    try {
      const updated = await saveHomeAssistantProject(this.api, {
        projectId: this.projectId,
        expectedRevision: project.revision,
        scene: input.scene,
        haConfig,
        forceEmptyScene: input.forceEmptyScene,
      })
      this.project = updated

      if (includeConfiguration && configurationGeneration === this.configurationGeneration) {
        this.configurationDirty = false
      }

      this.publish('ready')
      if (this.configurationDirty) this.scheduleConfigurationFlush()
    } catch (error) {
      this.publishError(error)
      throw error
    }
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('[ha3d] project session is disposed')
  }

  private assertWritable(): void {
    this.assertActive()
    if (this.snapshot.status === 'conflict') {
      throw new Error('[ha3d] project session must reload after a version conflict')
    }
    if (!this.project) {
      throw new Error('[ha3d] project session has not been loaded')
    }
  }

  private publish(
    status: HomeAssistantProjectSessionStatus,
    errorCode: string | null = null,
    message: string | null = null,
  ): void {
    if (this.disposed && status !== 'disposed') return
    this.snapshot = {
      projectId: this.projectId,
      status,
      revision: this.project?.revision ?? null,
      errorCode,
      errorMessage: message,
    }
    for (const listener of this.listeners) listener()
  }

  private publishError(error: unknown): void {
    const code = homeAssistantProjectApiErrorCode(error)
    this.publish(code === 'version_conflict' ? 'conflict' : 'error', code, errorMessage(error))
  }
}

export function createHomeAssistantProjectSession(
  api: HomeAssistantProjectApiHost,
  projectId: string,
  options: HomeAssistantProjectSessionOptions = {},
): HomeAssistantProjectSession {
  return new HomeAssistantProjectSessionImpl(api, projectId, options)
}
