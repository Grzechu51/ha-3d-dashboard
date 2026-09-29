import '../lib/bootstrap'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { HomeAssistantPanelInfo } from './panel-types'
import { Ha3dNativeApp, type NativeHomeAssistant } from './ha3d-native-app'
import { HomeAssistantPanelHostController } from '../lib/ha3d/panel-host-controller'

const STYLESHEET_PATH = '/ha3d_static/ha3d-panel.css'

export class Ha3dDashboardPanel extends HTMLElement {
  private readonly controller = new HomeAssistantPanelHostController()
  private hassValue: NativeHomeAssistant | null = null
  private narrowValue = false
  private panelValue: HomeAssistantPanelInfo | null = null
  private readonly root: ShadowRoot
  private readonly reactHost: HTMLDivElement
  private readonly stylesheet: HTMLLinkElement
  private reactRoot: Root | null = null

  constructor() {
    super()
    this.root = this.attachShadow({ mode: 'open' })

    this.stylesheet = document.createElement('link')
    this.stylesheet.rel = 'stylesheet'
    this.stylesheet.href = STYLESHEET_PATH

    this.reactHost = document.createElement('div')
    this.reactHost.id = 'ha3d-root'

    this.root.append(this.stylesheet, this.reactHost)
  }

  set hass(value: NativeHomeAssistant) {
    this.hassValue = value
    this.controller.setHass(value)
    this.renderReact()
  }

  get hass(): NativeHomeAssistant | null {
    return this.hassValue
  }

  set narrow(value: boolean) {
    this.narrowValue = Boolean(value)
    this.renderReact()
  }

  get narrow(): boolean {
    return this.narrowValue
  }

  set panel(value: HomeAssistantPanelInfo) {
    this.panelValue = value
    this.refreshStylesheet()
    this.renderReact()
  }

  get panel(): HomeAssistantPanelInfo | null {
    return this.panelValue
  }

  connectedCallback(): void {
    this.controller.connect()
    this.reactRoot ??= createRoot(this.reactHost)
    this.refreshStylesheet()
    this.renderReact()
  }

  disconnectedCallback(): void {
    this.controller.disconnect()
    this.reactRoot?.unmount()
    this.reactRoot = null
  }

  private refreshStylesheet(): void {
    const version = this.panelValue?.config?.version
    this.stylesheet.href =
      typeof version === 'string' && version.length > 0
        ? `${STYLESHEET_PATH}?v=${encodeURIComponent(version)}`
        : STYLESHEET_PATH
  }

  private renderReact(): void {
    if (!this.isConnected) return
    this.reactRoot ??= createRoot(this.reactHost)
    this.reactRoot.render(
      createElement(Ha3dNativeApp, {
        hass: this.hassValue,
        narrow: this.narrowValue,
      }),
    )
  }
}

if (!customElements.get('ha3d-dashboard-panel')) {
  customElements.define('ha3d-dashboard-panel', Ha3dDashboardPanel)
}
