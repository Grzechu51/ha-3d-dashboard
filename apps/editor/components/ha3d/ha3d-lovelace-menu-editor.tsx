'use client'

import { Code2, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  getHomeAssistantLovelaceHostSnapshot,
  subscribeHomeAssistantLovelaceHost,
} from '../../lib/ha3d/lovelace-host'
import {
  createLovelaceEditorContext,
  ensureHomeAssistantCardEditor,
  type Ha3dLovelaceCardConfig,
} from '../../lib/ha3d/lovelace-runtime'

type CardEditorElement = HTMLElement & {
  hass?: unknown
  lovelace?: Readonly<Record<string, unknown>>
  value?: Ha3dLovelaceCardConfig
  GUImode?: boolean
  showVisibilityTab?: boolean
  toggleMode?: () => void
}

type ConfigChangedEvent = CustomEvent<{
  config?: Ha3dLovelaceCardConfig
  error?: string
}>

export function Ha3dLovelaceMenuEditor({
  config,
  onChange,
}: {
  config: Ha3dLovelaceCardConfig
  onChange: (config: Ha3dLovelaceCardConfig) => void
}) {
  const hass = useSyncExternalStore(
    subscribeHomeAssistantLovelaceHost,
    getHomeAssistantLovelaceHostSnapshot,
    getHomeAssistantLovelaceHostSnapshot,
  )
  const mountRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<CardEditorElement | null>(null)
  const hassRef = useRef(hass)
  const configRef = useRef(config)
  const onChangeRef = useRef(onChange)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  hassRef.current = hass
  configRef.current = config
  onChangeRef.current = onChange

  const connected = hass !== null

  useEffect(() => {
    if (!hass || !editorRef.current) return
    editorRef.current.hass = hass
  }, [hass])

  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.value = config
    editorRef.current.showVisibilityTab = config.type !== 'conditional'
  }, [config])

  useEffect(() => {
    if (!connected) return
    const mount = mountRef.current
    const host = hassRef.current
    if (!(mount && host)) return

    let cancelled = false
    setLoading(true)
    setLoadError(null)
    mount.replaceChildren()

    void ensureHomeAssistantCardEditor(host)
      .then(() => {
        if (cancelled) return

        const editor = document.createElement('hui-card-element-editor') as CardEditorElement
        const initialConfig = configRef.current
        editor.hass = hassRef.current ?? host
        editor.lovelace = createLovelaceEditorContext()
        editor.value = initialConfig
        editor.showVisibilityTab = initialConfig.type !== 'conditional'
        editor.style.display = 'block'
        editor.style.width = '100%'

        const handleChanged = (event: Event) => {
          const detail = (event as ConfigChangedEvent).detail
          if (detail?.error || !detail?.config) return
          onChangeRef.current(detail.config)
        }

        editor.addEventListener('config-changed', handleChanged)
        editorRef.current = editor
        mount.replaceChildren(editor)
      })
      .catch((cause) => {
        if (cancelled) return
        setLoadError(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      editorRef.current = null
      mount.replaceChildren()
    }
  }, [connected])

  if (!hass) {
    return (
      <div className="rounded-xl border border-border bg-background/60 p-4 text-muted-foreground text-xs">
        Home Assistant is not connected.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-muted-foreground text-xs leading-relaxed">
          This is Home Assistant's native Lovelace card editor. Built-in cards, stacks and installed
          cards such as Mushroom use the same editors and YAML configuration as a normal HA dashboard.
        </p>
        <button
          className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1.5 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
          onClick={() => editorRef.current?.toggleMode?.()}
          type="button"
        >
          <Code2 className="h-3.5 w-3.5" />
          Visual / YAML
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-4 text-muted-foreground text-xs">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading Home Assistant card editor…
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs">
          {loadError}
        </div>
      ) : null}

      <div
        className="min-h-28 rounded-2xl border border-border bg-background/45 p-3 [&>hui-card-element-editor]:w-full"
        ref={mountRef}
      />
    </div>
  )
}
