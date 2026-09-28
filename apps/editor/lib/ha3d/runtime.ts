import type { HomeAssistantAdapter } from './home-assistant-adapter'

export type HomeAssistantRuntimeSnapshot = Readonly<{
  adapter: HomeAssistantAdapter | null
  connected: boolean
}>

const listeners = new Set<() => void>()

let snapshot: HomeAssistantRuntimeSnapshot = {
  adapter: null,
  connected: false,
}

export function setHomeAssistantAdapter(adapter: HomeAssistantAdapter | null): void {
  if (snapshot.adapter === adapter) return
  snapshot = {
    adapter,
    connected: adapter !== null,
  }
  for (const listener of listeners) listener()
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
