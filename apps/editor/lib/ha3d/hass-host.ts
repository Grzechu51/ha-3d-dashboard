import type { HomeAssistantHassLike } from './hass-adapter'
import { HomeAssistantHassAdapter } from './hass-adapter'
import {
  getHomeAssistantRuntimeSnapshot,
  setHomeAssistantAdapter,
} from './runtime'

export type HomeAssistantHassHost = Readonly<{
  setHass(hass: HomeAssistantHassLike): void
  dispose(): void
}>

const hosts = new Map<symbol, HomeAssistantHassLike>()
const adapter = new HomeAssistantHassAdapter()
let activeHost: symbol | null = null

function latestHost(): [symbol, HomeAssistantHassLike] | null {
  const entries = Array.from(hosts.entries())
  return entries.length > 0 ? (entries[entries.length - 1] ?? null) : null
}

function activate(token: symbol, hass: HomeAssistantHassLike): void {
  hosts.delete(token)
  hosts.set(token, hass)
  activeHost = token
  adapter.updateHass(hass)

  if (getHomeAssistantRuntimeSnapshot().adapter !== adapter) {
    setHomeAssistantAdapter(adapter)
  }
}

function deactivate(token: symbol): void {
  const wasActive = activeHost === token
  hosts.delete(token)
  if (!wasActive) return

  const fallback = latestHost()
  if (fallback) {
    activeHost = fallback[0]
    adapter.updateHass(fallback[1])
    return
  }

  activeHost = null
  adapter.disconnect()
  if (getHomeAssistantRuntimeSnapshot().adapter === adapter) {
    setHomeAssistantAdapter(null)
  }
}

export function createHomeAssistantHassHost(): HomeAssistantHassHost {
  const token = Symbol('ha3d-hass-host')
  let disposed = false

  return {
    setHass: (hass) => {
      if (disposed) throw new Error('[ha3d] Home Assistant hass host is disposed')
      activate(token, hass)
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      deactivate(token)
    },
  }
}
