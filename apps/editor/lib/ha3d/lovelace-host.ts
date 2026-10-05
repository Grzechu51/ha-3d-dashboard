import type { HomeAssistantHassLike } from './hass-adapter'

export type HomeAssistantLovelaceHost = HomeAssistantHassLike &
  Readonly<Record<string, unknown>>

const listeners = new Set<() => void>()
let snapshot: HomeAssistantLovelaceHost | null = null

export function getHomeAssistantLovelaceHostSnapshot(): HomeAssistantLovelaceHost | null {
  return snapshot
}

export function subscribeHomeAssistantLovelaceHost(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setHomeAssistantLovelaceHost(host: HomeAssistantLovelaceHost | null): void {
  if (snapshot === host) return
  snapshot = host
  for (const listener of listeners) listener()
}
