'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { resolveHomeAssistantCoverOpenFraction } from '../../lib/ha3d/cover-state'
import {
  entityFriendlyName,
  formatHomeAssistantEntityDetail,
  formatHomeAssistantEntityValue,
  numericEntityAttribute,
  stringListEntityAttribute,
} from '../../lib/ha3d/entity-display'
import {
  getHa3dProjectConfigSnapshot,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'

function actionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Home Assistant service call failed'
}

export function Ha3dDashboardControls({
  selectedNodeId = null,
  highlightsEnabled = true,
  onHighlightsEnabledChange,
}: {
  selectedNodeId?: string | null
  highlightsEnabled?: boolean
  onHighlightsEnabledChange?: (enabled: boolean) => void
} = {}) {
  const [collapsed, setCollapsed] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const runtime = useSyncExternalStore(
    subscribeHomeAssistantRuntime,
    getHomeAssistantRuntimeSnapshot,
    getHomeAssistantRuntimeSnapshot,
  )
  const project = useSyncExternalStore(
    subscribeHa3dProjectConfig,
    getHa3dProjectConfigSnapshot,
    getHa3dProjectConfigSnapshot,
  )

  useEffect(() => {
    if (selectedNodeId) setCollapsed(false)
  }, [selectedNodeId])

  const bindings = project.bindings
    .filter((binding) => binding.enabled)
    .map((binding) => ({
      binding,
      entity: runtime.adapter?.getEntity(binding.entityId),
    }))
    .sort((left, right) => {
      const leftSelected = left.binding.nodeId === selectedNodeId
      const rightSelected = right.binding.nodeId === selectedNodeId
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1

      const leftName = left.entity ? entityFriendlyName(left.entity) : left.binding.entityId
      const rightName = right.entity ? entityFriendlyName(right.entity) : right.binding.entityId
      return leftName.localeCompare(rightName)
    })

  const callService = async (
    domain: string,
    service: string,
    entityId: string,
    data?: Readonly<Record<string, unknown>>,
  ) => {
    const adapter = runtime.adapter
    if (!adapter) return

    setActionError(null)
    try {
      await adapter.callService({
        domain,
        service,
        data,
        target: { entityId },
      })
    } catch (error) {
      setActionError(actionErrorMessage(error))
    }
  }

  if (collapsed) {
    return (
      <button
        className="pointer-events-auto absolute right-3 bottom-3 z-40 rounded-full border border-border/70 bg-background/90 px-4 py-2 font-medium text-sm shadow-lg backdrop-blur md:top-3 md:bottom-auto"
        onClick={() => setCollapsed(false)}
        type="button"
      >
        Home Assistant
      </button>
    )
  }

  return (
    <aside className="pointer-events-auto absolute right-3 bottom-3 left-3 z-40 max-h-[46vh] overflow-hidden rounded-2xl border border-border/70 bg-background/92 shadow-xl backdrop-blur md:top-3 md:bottom-3 md:left-auto md:w-80 md:max-h-none">
      <div className="flex items-center justify-between gap-3 border-border/70 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm">Home Assistant</div>
          <div className="truncate text-muted-foreground text-xs">
            {runtime.connected ? runtime.adapter?.id : 'not connected'}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onHighlightsEnabledChange ? (
            <button
              aria-pressed={highlightsEnabled}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              onClick={() => onHighlightsEnabledChange(!highlightsEnabled)}
              type="button"
            >
              Highlights {highlightsEnabled ? 'on' : 'off'}
            </button>
          ) : null}
          <button
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={() => setCollapsed(true)}
            type="button"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="max-h-[calc(46vh-3.4rem)] space-y-2 overflow-y-auto p-3 md:max-h-[calc(100vh-6rem)]">
        {actionError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs">
            {actionError}
          </div>
        ) : null}

        {bindings.length === 0 ? (
          <div className="rounded-lg border border-border/70 p-3 text-muted-foreground text-xs">
            No Home Assistant entities are bound to this scene yet. Add bindings in the editor.
          </div>
        ) : null}

        {bindings.map(({ binding, entity }) => {
          const coverPosition = Math.round(resolveHomeAssistantCoverOpenFraction(entity) * 100)
          const climateTarget = numericEntityAttribute(entity, 'temperature')
          const climateModes = stringListEntityAttribute(entity, 'hvac_modes')
          const detail = entity ? formatHomeAssistantEntityDetail(entity) : null

          return (
            <section
              className={`rounded-xl border bg-card/70 p-3 ${
                binding.nodeId === selectedNodeId
                  ? 'border-sky-400/70 ring-1 ring-sky-400/30'
                  : 'border-border/70'
              }`}
              key={`${binding.nodeId}:${binding.domain}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate font-medium text-sm">
                      {entity ? entityFriendlyName(entity) : binding.entityId}
                    </div>
                    {binding.nodeId === selectedNodeId ? (
                      <span className="shrink-0 rounded bg-sky-400/15 px-1.5 py-0.5 text-[9px] text-sky-300">
                        selected
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-muted-foreground text-[10px]">
                    {binding.entityId}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-medium text-xs">
                    {entity ? formatHomeAssistantEntityValue(entity) : 'Unavailable'}
                  </div>
                  {detail ? (
                    <div className="text-muted-foreground text-[10px]">{detail}</div>
                  ) : null}
                </div>
              </div>

              {entity && (binding.domain === 'light' || binding.domain === 'switch') ? (
                <button
                  className="mt-3 w-full rounded-md border border-border px-3 py-2 font-medium text-xs hover:bg-accent"
                  onClick={() =>
                    void callService(
                      binding.domain,
                      entity.state === 'on' ? 'turn_off' : 'turn_on',
                      binding.entityId,
                    )
                  }
                  type="button"
                >
                  {entity.state === 'on' ? 'Turn off' : 'Turn on'}
                </button>
              ) : null}

              {entity && binding.domain === 'cover' ? (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-md border border-border px-2 py-2 text-xs hover:bg-accent"
                      onClick={() => void callService('cover', 'close_cover', binding.entityId)}
                      type="button"
                    >
                      Close
                    </button>
                    <button
                      className="flex-1 rounded-md border border-border px-2 py-2 text-xs hover:bg-accent"
                      onClick={() => void callService('cover', 'open_cover', binding.entityId)}
                      type="button"
                    >
                      Open
                    </button>
                  </div>
                  <label className="block text-muted-foreground text-[10px]">
                    Position · {coverPosition}%
                    <input
                      className="mt-1 block w-full"
                      max="100"
                      min="0"
                      onChange={(event) =>
                        void callService('cover', 'set_cover_position', binding.entityId, {
                          position: Number(event.target.value),
                        })
                      }
                      type="range"
                      value={coverPosition}
                    />
                  </label>
                </div>
              ) : null}

              {entity && binding.domain === 'climate' ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-muted-foreground text-[10px]">
                    Target
                    <input
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground text-xs"
                      onChange={(event) => {
                        if (!event.target.value.trim()) return
                        const temperature = Number(event.target.value)
                        if (!Number.isFinite(temperature)) return
                        void callService('climate', 'set_temperature', binding.entityId, {
                          temperature,
                        })
                      }}
                      step="0.5"
                      type="number"
                      value={climateTarget ?? ''}
                    />
                  </label>
                  <label className="text-muted-foreground text-[10px]">
                    Mode
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground text-xs"
                      onChange={(event) =>
                        void callService('climate', 'set_hvac_mode', binding.entityId, {
                          hvac_mode: event.target.value,
                        })
                      }
                      value={entity.state}
                    >
                      {climateModes.length > 0 ? (
                        climateModes.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))
                      ) : (
                        <option value={entity.state}>{entity.state}</option>
                      )}
                    </select>
                  </label>
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
