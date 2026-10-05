import type { Ha3dLovelaceCardConfig } from './dashboard-menu'
import type { HomeAssistantLovelaceHost } from './lovelace-host'

export type { Ha3dLovelaceCardConfig } from './dashboard-menu'

type LovelaceCardElement = HTMLElement & {
  hass?: HomeAssistantLovelaceHost
  config?: Ha3dLovelaceCardConfig
  preview?: boolean
  load?: () => void
}

type LovelaceCardHelpers = Readonly<{
  createCardElement: (config: Ha3dLovelaceCardConfig) => LovelaceCardElement
}>

type PartialPanelResolver = HTMLElement & {
  _getRoutes?: (routes: readonly Record<string, unknown>[]) => {
    routes?: Record<string, { load?: () => Promise<unknown> }>
  }
}

type LovelacePanel = HTMLElement & {
  hass?: HomeAssistantLovelaceHost
  panel?: Readonly<Record<string, unknown>>
  _fetchConfig?: (force: boolean) => Promise<unknown>
}

type CardElementConstructor = CustomElementConstructor & {
  getConfigElement?: () => Promise<unknown>
}

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<LovelaceCardHelpers>
  }
}

const LOVELACE_ROUTE = 'ha3d-card-runtime'
const LOAD_TIMEOUT_MS = 10_000
let runtimePromise: Promise<LovelaceCardHelpers> | null = null
let editorPromise: Promise<void> | null = null

function waitForDefinition(name: string): Promise<void> {
  if (customElements.get(name)) return Promise.resolve()

  return Promise.race([
    customElements.whenDefined(name).then(() => undefined),
    new Promise<void>((_, reject) => {
      window.setTimeout(
        () => reject(new Error(`[ha3d] timed out loading Home Assistant element ${name}`)),
        LOAD_TIMEOUT_MS,
      )
    }),
  ])
}

async function loadLovelaceRoute(): Promise<void> {
  if (window.loadCardHelpers) return

  await waitForDefinition('partial-panel-resolver')
  const resolver = document.createElement('partial-panel-resolver') as PartialPanelResolver
  const routes = resolver._getRoutes?.([
    {
      component_name: 'lovelace',
      url_path: LOVELACE_ROUTE,
    },
  ])
  await routes?.routes?.[LOVELACE_ROUTE]?.load?.()

  if (!window.loadCardHelpers) {
    throw new Error('[ha3d] Home Assistant did not expose loadCardHelpers')
  }
}

async function loadRegisteredLovelaceResources(host: HomeAssistantLovelaceHost): Promise<void> {
  try {
    if (!customElements.get('ha-panel-lovelace')) return
    const panel = document.createElement('ha-panel-lovelace') as LovelacePanel
    panel.hass = host
    panel.panel = { config: { mode: 'yaml' } }
    await panel._fetchConfig?.(false)
  } catch (error) {
    console.warn('[ha3d] Lovelace resources could not be preloaded', error)
  }
}

export function ensureHomeAssistantLovelaceRuntime(
  host: HomeAssistantLovelaceHost,
): Promise<LovelaceCardHelpers> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await loadLovelaceRoute()
      await loadRegisteredLovelaceResources(host)
      const helpers = await window.loadCardHelpers?.()
      if (!helpers) throw new Error('[ha3d] Home Assistant card helpers are unavailable')
      return helpers
    })().catch((error) => {
      runtimePromise = null
      throw error
    })
  }
  return runtimePromise
}

export async function ensureHomeAssistantCardEditor(
  host: HomeAssistantLovelaceHost,
): Promise<void> {
  if (!editorPromise) {
    editorPromise = (async () => {
      const helpers = await ensureHomeAssistantLovelaceRuntime(host)
      if (customElements.get('hui-card-element-editor')) return

      const stack = helpers.createCardElement({ type: 'vertical-stack', cards: [] })
      await waitForDefinition(stack.localName)
      const constructor = customElements.get(stack.localName) as CardElementConstructor | undefined
      await constructor?.getConfigElement?.()
      await waitForDefinition('hui-card-element-editor')
    })().catch((error) => {
      editorPromise = null
      throw error
    })
  }
  return editorPromise
}

export async function createHomeAssistantLovelaceCard(
  host: HomeAssistantLovelaceHost,
  config: Ha3dLovelaceCardConfig,
  preview = false,
): Promise<LovelaceCardElement> {
  await ensureHomeAssistantLovelaceRuntime(host)
  await waitForDefinition('hui-card')

  const wrapper = document.createElement('hui-card') as LovelaceCardElement
  wrapper.hass = host
  wrapper.config = config
  wrapper.preview = preview
  wrapper.load?.()
  return wrapper
}

export function createLovelaceEditorContext(): Readonly<Record<string, unknown>> {
  return {
    views: [],
  }
}
