import type { HomeAssistantHassLike } from './hass-adapter'
import { createHomeAssistantHassHost, type HomeAssistantHassHost } from './hass-host'

export class HomeAssistantPanelHostController {
  private host: HomeAssistantHassHost | null = null
  private hassValue: HomeAssistantHassLike | null = null
  private connectedValue = false

  setHass(hass: HomeAssistantHassLike): void {
    this.hassValue = hass
    if (this.connectedValue) this.ensureHost().setHass(hass)
  }

  connect(): void {
    if (this.connectedValue) return
    this.connectedValue = true
    if (this.hassValue) this.ensureHost().setHass(this.hassValue)
  }

  disconnect(): void {
    if (!this.connectedValue) return
    this.connectedValue = false
    this.host?.dispose()
    this.host = null
  }

  isConnected(): boolean {
    return this.connectedValue
  }

  private ensureHost(): HomeAssistantHassHost {
    this.host ??= createHomeAssistantHassHost()
    return this.host
  }
}
