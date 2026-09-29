import type {
  HomeAssistantAdapter,
  HomeAssistantEntityState,
  HomeAssistantServiceCall,
  HomeAssistantStateListener,
} from './home-assistant-adapter'

function targetEntityIds(call: HomeAssistantServiceCall): readonly string[] {
  const entityId = call.target?.entityId
  if (typeof entityId === 'string') return [entityId]
  return entityId ?? []
}

export class MockHomeAssistantAdapter implements HomeAssistantAdapter {
  readonly id = 'mock'
  private readonly entities = new Map<string, HomeAssistantEntityState>()
  private readonly listeners = new Set<HomeAssistantStateListener>()
  private readonly serviceCalls: HomeAssistantServiceCall[] = []

  constructor(initialEntities: readonly HomeAssistantEntityState[] = []) {
    for (const entity of initialEntities) {
      this.entities.set(entity.entityId, entity)
    }
  }

  getEntity(entityId: string): HomeAssistantEntityState | undefined {
    return this.entities.get(entityId)
  }

  listEntities(): readonly HomeAssistantEntityState[] {
    return Array.from(this.entities.values())
  }

  subscribe(listener: HomeAssistantStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async callService(call: HomeAssistantServiceCall): Promise<void> {
    this.serviceCalls.push(call)

    if (call.domain !== 'light') return
    for (const entityId of targetEntityIds(call)) {
      const current = this.entities.get(entityId)
      if (!current) continue

      let nextState = current.state
      if (call.service === 'turn_on') nextState = 'on'
      else if (call.service === 'turn_off') nextState = 'off'
      else if (call.service === 'toggle') nextState = current.state === 'on' ? 'off' : 'on'
      else continue

      const attributes = { ...current.attributes }
      const brightness = call.data?.brightness
      const rgbColor = call.data?.rgb_color
      const colorTempKelvin = call.data?.color_temp_kelvin
      if (typeof brightness === 'number') attributes.brightness = brightness
      if (Array.isArray(rgbColor)) attributes.rgb_color = [...rgbColor]
      if (typeof colorTempKelvin === 'number') attributes.color_temp_kelvin = colorTempKelvin

      this.setEntity({
        ...current,
        state: nextState,
        attributes,
      })
    }
  }

  setEntity(entity: HomeAssistantEntityState): void {
    this.entities.set(entity.entityId, entity)
    for (const listener of this.listeners) listener([entity.entityId])
  }

  getServiceCalls(): readonly HomeAssistantServiceCall[] {
    return this.serviceCalls.slice()
  }

  clearServiceCalls(): void {
    this.serviceCalls.length = 0
  }
}
