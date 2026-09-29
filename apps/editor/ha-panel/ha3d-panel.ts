import type { HomeAssistantHassLike } from '../lib/ha3d/hass-adapter'
import { HomeAssistantPanelHostController } from '../lib/ha3d/panel-host-controller'

type HomeAssistantPanelInfo = Readonly<{
  config?: Readonly<Record<string, unknown>>
}>

export class Ha3dDashboardPanel extends HTMLElement {
  private readonly controller = new HomeAssistantPanelHostController()
  private hassValue: HomeAssistantHassLike | null = null
  private narrowValue = false
  private panelValue: HomeAssistantPanelInfo | null = null
  private readonly root: ShadowRoot

  constructor() {
    super()
    this.root = this.attachShadow({ mode: 'open' })
  }

  set hass(value: HomeAssistantHassLike) {
    this.hassValue = value
    this.controller.setHass(value)
    this.render()
  }

  get hass(): HomeAssistantHassLike | null {
    return this.hassValue
  }

  set narrow(value: boolean) {
    this.narrowValue = Boolean(value)
    this.render()
  }

  get narrow(): boolean {
    return this.narrowValue
  }

  set panel(value: HomeAssistantPanelInfo) {
    this.panelValue = value
    this.render()
  }

  get panel(): HomeAssistantPanelInfo | null {
    return this.panelValue
  }

  connectedCallback(): void {
    this.controller.connect()
    this.render()
  }

  disconnectedCallback(): void {
    this.controller.disconnect()
  }

  private render(): void {
    const entityCount = this.hassValue ? Object.keys(this.hassValue.states).length : 0
    const connected = this.hassValue !== null
    const configuredVersion = this.panelValue?.config?.version

    this.root.innerHTML = `
      <style>
        :host {
          display: block;
          box-sizing: border-box;
          min-height: 100%;
          color: var(--primary-text-color, #fff);
          background: var(--primary-background-color, #111);
          font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
        }
        .shell {
          box-sizing: border-box;
          min-height: 100vh;
          padding:
            max(24px, env(safe-area-inset-top))
            max(24px, env(safe-area-inset-right))
            max(24px, env(safe-area-inset-bottom))
            max(24px, env(safe-area-inset-left));
          display: grid;
          place-items: center;
        }
        .card {
          width: min(680px, 100%);
          border: 1px solid var(--divider-color, rgba(255,255,255,.14));
          border-radius: 20px;
          padding: 24px;
          background: var(--card-background-color, rgba(20,20,20,.92));
          box-shadow: 0 18px 60px rgba(0,0,0,.22);
        }
        h1 { margin: 0; font-size: 24px; }
        p { color: var(--secondary-text-color, #aaa); line-height: 1.5; }
        .status { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
        .pill {
          border: 1px solid var(--divider-color, rgba(255,255,255,.14));
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
        }
      </style>
      <div class="shell">
        <section class="card">
          <h1>HA 3D Dashboard</h1>
          <p>
            Native Home Assistant panel host is active. Project storage and
            optimistic-concurrency WebSocket APIs are available; the next checkpoint mounts
            the full editor/dashboard shell here.
          </p>
          <div class="status">
            <span class="pill">hass: ${connected ? 'connected' : 'waiting'}</span>
            <span class="pill">entities: ${entityCount}</span>
            <span class="pill">layout: ${this.narrowValue ? 'narrow' : 'wide'}</span>
            ${configuredVersion ? `<span class="pill">v${configuredVersion}</span>` : ''}
          </div>
        </section>
      </div>
    `
  }
}

if (!customElements.get('ha3d-dashboard-panel')) {
  customElements.define('ha3d-dashboard-panel', Ha3dDashboardPanel)
}
