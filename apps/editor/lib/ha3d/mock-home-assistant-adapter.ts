import type {
  HomeAssistantAdapter,
  HomeAssistantEntityState,
  HomeAssistantServiceCall,
  HomeAssistantStateListener,
} from './home-assistant-adapter'

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
