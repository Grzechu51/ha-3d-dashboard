import type { HomeAssistantAdapter } from './home-assistant-adapter'

export type HomeAssistantRuntimeSnapshot = Readonly<{
  adapter: HomeAssistantAdapter | null
  connected: boolean
  revision: number
}>

const listeners = new Set<() => void>()

let adapterUnsubscribe: (() => void) | null = null
let snapshot: HomeAssistantRuntimeSnapshot = {
  adapter: null,
  connected: false,
  revision: 0,
}

function publish(adapter: HomeAssistantAdapter | null): void {
  snapshot = {
    adapter,
    connected: adapter !== null,
    revision: snapshot.revision + 1,
  }
  for (const listener of listeners) listener()
}

export function setHomeAssistantAdapter(adapter: HomeAssistantAdapter | null): void {
  if (snapshot.adapter === adapter) return

  adapterUnsubscribe?.()
  adapterUnsubscribe = null
  publish(adapter)

  if (adapter) {
    adapterUnsubscribe = adapter.subscribe(() => {
      if (snapshot.adapter === adapter) publish(adapter)
    })
  }
}

export function getHomeAssistantRuntimeSnapshot(): HomeAssistantRuntimeSnapshot {
  return snapshot
}

export function subscribeHomeAssistantRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
