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

function clampPosition(value: number): number {
  return Math.min(100, Math.max(0, value))
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

    if (call.domain === 'light') {
      this.simulateLightService(call)
      return
    }
    if (call.domain === 'cover') {
      this.simulateCoverService(call)
      return
    }
    if (call.domain === 'switch') {
      this.simulateSwitchService(call)
      return
    }
    if (call.domain === 'climate') this.simulateClimateService(call)
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

  private simulateLightService(call: HomeAssistantServiceCall): void {
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

  private simulateCoverService(call: HomeAssistantServiceCall): void {
    for (const entityId of targetEntityIds(call)) {
      const current = this.entities.get(entityId)
      if (!current) continue

      const currentPosition =
        typeof current.attributes.current_position === 'number'
          ? clampPosition(current.attributes.current_position)
          : current.state === 'open'
            ? 100
            : 0

      let nextPosition = currentPosition
      if (call.service === 'open_cover') nextPosition = 100
      else if (call.service === 'close_cover') nextPosition = 0
      else if (call.service === 'toggle') nextPosition = currentPosition > 0 ? 0 : 100
      else if (
        call.service === 'set_cover_position' &&
        typeof call.data?.position === 'number' &&
        Number.isFinite(call.data.position)
      ) {
        nextPosition = clampPosition(call.data.position)
      } else {
        continue
      }

      this.setEntity({
        ...current,
        state: nextPosition === 0 ? 'closed' : 'open',
        attributes: {
          ...current.attributes,
          current_position: nextPosition,
        },
      })
    }
  }

  private simulateSwitchService(call: HomeAssistantServiceCall): void {
    for (const entityId of targetEntityIds(call)) {
      const current = this.entities.get(entityId)
      if (!current) continue

      let nextState = current.state
      if (call.service === 'turn_on') nextState = 'on'
      else if (call.service === 'turn_off') nextState = 'off'
      else if (call.service === 'toggle') nextState = current.state === 'on' ? 'off' : 'on'
      else continue

      this.setEntity({
        ...current,
        state: nextState,
      })
    }
  }

  private simulateClimateService(call: HomeAssistantServiceCall): void {
    for (const entityId of targetEntityIds(call)) {
      const current = this.entities.get(entityId)
      if (!current) continue

      if (
        call.service === 'set_temperature' &&
        typeof call.data?.temperature === 'number' &&
        Number.isFinite(call.data.temperature)
      ) {
        this.setEntity({
          ...current,
          attributes: {
            ...current.attributes,
            temperature: call.data.temperature,
          },
        })
        continue
      }

      if (call.service === 'set_hvac_mode' && typeof call.data?.hvac_mode === 'string') {
        this.setEntity({
          ...current,
          state: call.data.hvac_mode,
        })
      }
    }
  }
}
