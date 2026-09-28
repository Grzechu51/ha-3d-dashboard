export type HomeAssistantAttributes = Readonly<Record<string, unknown>>

export type HomeAssistantEntityState = Readonly<{
  entityId: string
  state: string
  attributes: HomeAssistantAttributes
  lastChanged?: string
  lastUpdated?: string
}>

export type HomeAssistantServiceTarget = Readonly<{
  entityId?: string | readonly string[]
}>

export type HomeAssistantServiceCall = Readonly<{
  domain: string
  service: string
  data?: Readonly<Record<string, unknown>>
  target?: HomeAssistantServiceTarget
}>

export type HomeAssistantStateListener = (changedEntityIds: readonly string[]) => void

export interface HomeAssistantAdapter {
  readonly id: string
  getEntity(entityId: string): HomeAssistantEntityState | undefined
  listEntities(): readonly HomeAssistantEntityState[]
  subscribe(listener: HomeAssistantStateListener): () => void
  callService(call: HomeAssistantServiceCall): Promise<void>
}
