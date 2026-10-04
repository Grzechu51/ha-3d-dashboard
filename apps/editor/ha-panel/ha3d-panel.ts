import './bootstrap'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { HomeAssistantPanelHostController } from '../lib/ha3d/panel-host-controller'
import { Ha3dNativeApp, type NativeHomeAssistant } from './ha3d-native-app'
import type { HomeAssistantPanelInfo } from './panel-types'

const STYLESHEET_PATH = '/ha3d_static/ha3d-panel.css'

export class Ha3dDashboardPanel extends HTMLElement {
  private readonly controller = new HomeAssistantPanelHostController()
  private hassValue: NativeHomeAssistant | null = null
  private narrowValue = false
  private panelValue: HomeAssistantPanelInfo | null = null
  private readonly root: ShadowRoot
  private readonly reactHost: HTMLDivElement
  private readonly stylesheet: HTMLLinkElement
  private readonly hostStyles: HTMLStyleElement
  private reactRoot: Root | null = null
  private resizeObserver: ResizeObserver | null = null
  private resizeFrame: number | null = null

  private readonly handleViewportResize = () => {
    this.scheduleBoundsSync()
  }

  private readonly showMoreInfo = (entityId: string) => {
    this.dispatchEvent(
      new CustomEvent('hass-more-info', {
        detail: { entityId },
        bubbles: true,
        composed: true,
      }),
    )
  }

  constructor() {
    super()
    this.root = this.attachShadow({ mode: 'open' })

    this.hostStyles = document.createElement('style')
    this.hostStyles.textContent = `
      :host {
        display: block;
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        box-sizing: border-box;
        contain: inline-size layout paint;
      }

      #ha3d-root {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }
    `

    this.stylesheet = document.createElement('link')
    this.stylesheet.rel = 'stylesheet'
    this.stylesheet.href = STYLESHEET_PATH

    this.reactHost = document.createElement('div')
    this.reactHost.id = 'ha3d-root'

    this.root.append(this.hostStyles, this.stylesheet, this.reactHost)
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

    this.resizeObserver = new ResizeObserver(() => this.scheduleBoundsSync())
    if (this.parentElement) this.resizeObserver.observe(this.parentElement)
    window.addEventListener('resize', this.handleViewportResize)
    this.scheduleBoundsSync()
  }

  disconnectedCallback(): void {
    this.controller.disconnect()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    window.removeEventListener('resize', this.handleViewportResize)
    if (this.resizeFrame !== null) {
      cancelAnimationFrame(this.resizeFrame)
      this.resizeFrame = null
    }
    this.reactRoot?.unmount()
    this.reactRoot = null
  }

  private scheduleBoundsSync(): void {
    if (this.resizeFrame !== null) return
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null
      this.syncBoundsToViewport()
    })
  }

  private syncBoundsToViewport(): void {
    if (!this.isConnected) return

    const rect = this.getBoundingClientRect()
    const documentLeft = rect.left + window.scrollX
    const documentTop = rect.top + window.scrollY
    const availableWidth = Math.max(1, window.innerWidth - Math.max(0, documentLeft))
    const availableHeight = Math.max(1, window.innerHeight - Math.max(0, documentTop))

    this.style.width = `${Math.floor(availableWidth)}px`
    this.style.maxWidth = `${Math.floor(availableWidth)}px`
    this.style.height = `${Math.floor(availableHeight)}px`
    this.style.maxHeight = `${Math.floor(availableHeight)}px`
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
        onShowMoreInfo: this.showMoreInfo,
      }),
    )
  }
}

if (!customElements.get('ha3d-dashboard-panel')) {
  customElements.define('ha3d-dashboard-panel', Ha3dDashboardPanel)
}
