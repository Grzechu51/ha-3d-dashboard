import type {
  HomeAssistantAdapter,
  HomeAssistantEntityState,
  HomeAssistantServiceCall,
  HomeAssistantStateListener,
} from './home-assistant-adapter'

export type HomeAssistantHassState = Readonly<{
  entity_id: string
  state: string
  attributes: Readonly<Record<string, unknown>>
  last_changed?: string
  last_updated?: string
}>

export type HomeAssistantHassServiceTarget = Readonly<{
  entity_id?: string | readonly string[]
}>

export type HomeAssistantHassLike = Readonly<{
  states: Readonly<Record<string, HomeAssistantHassState>>
  callService: (
    domain: string,
    service: string,
    serviceData?: Readonly<Record<string, unknown>>,
    target?: HomeAssistantHassServiceTarget,
  ) => Promise<unknown>
  callWS?: <T>(message: Readonly<Record<string, unknown>>) => Promise<T>
}>

function toEntityState(state: HomeAssistantHassState): HomeAssistantEntityState {
  return {
    entityId: state.entity_id,
    state: state.state,
    attributes: state.attributes,
    ...(state.last_changed ? { lastChanged: state.last_changed } : {}),
    ...(state.last_updated ? { lastUpdated: state.last_updated } : {}),
  }
}

function changedEntityIds(
  previous: HomeAssistantHassLike | null,
  next: HomeAssistantHassLike,
): string[] {
  if (!previous) return Object.keys(next.states)

  const ids = new Set([...Object.keys(previous.states), ...Object.keys(next.states)])
  return Array.from(ids).filter((entityId) => previous.states[entityId] !== next.states[entityId])
}

function serviceTarget(call: HomeAssistantServiceCall): HomeAssistantHassServiceTarget | undefined {
  const entityId = call.target?.entityId
  if (entityId === undefined) return undefined
  return { entity_id: entityId }
}

export class HomeAssistantHassAdapter implements HomeAssistantAdapter {
  readonly id = 'home-assistant'
  private hass: HomeAssistantHassLike | null
  private readonly listeners = new Set<HomeAssistantStateListener>()

  constructor(hass: HomeAssistantHassLike | null = null) {
    this.hass = hass
  }

  updateHass(hass: HomeAssistantHassLike): void {
    const changed = changedEntityIds(this.hass, hass)
    this.hass = hass
    if (changed.length === 0) return
    for (const listener of this.listeners) listener(changed)
  }

  disconnect(): void {
    this.hass = null
  }

  getEntity(entityId: string): HomeAssistantEntityState | undefined {
    const state = this.hass?.states[entityId]
    return state ? toEntityState(state) : undefined
  }

  listEntities(): readonly HomeAssistantEntityState[] {
    if (!this.hass) return []
    return Object.values(this.hass.states).map(toEntityState)
  }

  subscribe(listener: HomeAssistantStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async refreshEntities(): Promise<void> {
    const hass = this.hass
    if (!hass?.callWS) return

    const states = await hass.callWS<HomeAssistantHassState[]>({ type: 'get_states' })
    const nextStates = Object.fromEntries(states.map((state) => [state.entity_id, state]))
    this.updateHass({
      ...hass,
      states: nextStates,
    })
  }

  async callService(call: HomeAssistantServiceCall): Promise<void> {
    const hass = this.hass
    if (!hass) throw new Error('[ha3d] Home Assistant host is disconnected')

    await hass.callService(call.domain, call.service, call.data, serviceTarget(call))
  }
}
