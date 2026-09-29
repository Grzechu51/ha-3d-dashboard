import type { Ha3dProjectConfig } from './project-config'
import { parseHa3dProjectConfig } from './project-config'

const PROJECT_DOCUMENT_VERSION = 1 as const

export type HomeAssistantProjectApiHost = Readonly<{
  callWS: <T>(message: Readonly<Record<string, unknown>>) => Promise<T>
}>

export type Ha3dProjectMetadata = Readonly<{
  id: string
  name: string
  revision: number
  createdAt: string
  updatedAt: string
}>

export type Ha3dStoredProject = Ha3dProjectMetadata &
  Readonly<{
    schemaVersion: typeof PROJECT_DOCUMENT_VERSION
    scene: Readonly<Record<string, unknown>> | null
    haConfig: Ha3dProjectConfig
  }>

export type CreateHomeAssistantProjectInput = Readonly<{
  projectId?: string
  name: string
  scene?: Readonly<Record<string, unknown>> | null
  haConfig?: Ha3dProjectConfig
}>

export type SaveHomeAssistantProjectInput = Readonly<{
  projectId: string
  expectedRevision: number
  name?: string
  scene?: Readonly<Record<string, unknown>> | null
  haConfig?: Ha3dProjectConfig
}>

function record(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`[ha3d] ${label} must be an object`)
  }
  return raw as Record<string, unknown>
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[ha3d] ${label} must be a non-empty string`)
  }
  return value
}

function revisionField(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error('[ha3d] project revision must be a positive integer')
  }
  return value
}

function parseProjectSummary(raw: unknown): Ha3dProjectMetadata {
  const value = record(raw, 'project metadata')
  return {
    id: stringField(value.id, 'project id'),
    name: stringField(value.name, 'project name'),
    revision: revisionField(value.revision),
    createdAt: stringField(value.created_at, 'project created_at'),
    updatedAt: stringField(value.updated_at, 'project updated_at'),
  }
}

function parseStoredProject(raw: unknown): Ha3dStoredProject {
  const value = record(raw, 'project')
  if (value.schema_version !== PROJECT_DOCUMENT_VERSION) {
    throw new Error('[ha3d] unsupported Home Assistant project document version')
  }

  const scene =
    value.scene === null
      ? null
      : (record(value.scene, 'project scene') as Readonly<Record<string, unknown>>)

  return {
    ...parseProjectSummary(value),
    schemaVersion: PROJECT_DOCUMENT_VERSION,
    scene,
    haConfig: parseHa3dProjectConfig(value.ha_config),
  }
}

function withOptional(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) target[key] = value
}

export async function listHomeAssistantProjects(
  hass: HomeAssistantProjectApiHost,
): Promise<readonly Ha3dProjectMetadata[]> {
  const response = record(
    await hass.callWS<unknown>({ type: 'ha_3d_dashboard/project/list' }),
    'project list response',
  )
  if (!Array.isArray(response.projects)) {
    throw new Error('[ha3d] project list response is missing projects')
  }
  return response.projects.map(parseProjectSummary)
}

export async function getHomeAssistantProject(
  hass: HomeAssistantProjectApiHost,
  projectId: string,
): Promise<Ha3dStoredProject> {
  return parseStoredProject(
    await hass.callWS<unknown>({
      type: 'ha_3d_dashboard/project/get',
      project_id: projectId,
    }),
  )
}

export async function createHomeAssistantProject(
  hass: HomeAssistantProjectApiHost,
  input: CreateHomeAssistantProjectInput,
): Promise<Ha3dStoredProject> {
  const message: Record<string, unknown> = {
    type: 'ha_3d_dashboard/project/create',
    name: input.name,
  }
  withOptional(message, 'project_id', input.projectId)
  withOptional(message, 'scene', input.scene)
  withOptional(message, 'ha_config', input.haConfig)

  return parseStoredProject(await hass.callWS<unknown>(message))
}

export async function saveHomeAssistantProject(
  hass: HomeAssistantProjectApiHost,
  input: SaveHomeAssistantProjectInput,
): Promise<Ha3dStoredProject> {
  const message: Record<string, unknown> = {
    type: 'ha_3d_dashboard/project/save',
    project_id: input.projectId,
    expected_revision: input.expectedRevision,
  }
  withOptional(message, 'name', input.name)
  withOptional(message, 'scene', input.scene)
  withOptional(message, 'ha_config', input.haConfig)

  return parseStoredProject(await hass.callWS<unknown>(message))
}

export async function deleteHomeAssistantProject(
  hass: HomeAssistantProjectApiHost,
  projectId: string,
  expectedRevision: number,
): Promise<void> {
  const response = record(
    await hass.callWS<unknown>({
      type: 'ha_3d_dashboard/project/delete',
      project_id: projectId,
      expected_revision: expectedRevision,
    }),
    'project delete response',
  )
  if (response.deleted !== true || response.project_id !== projectId) {
    throw new Error('[ha3d] invalid project delete response')
  }
}
