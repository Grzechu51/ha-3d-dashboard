'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { resolveHomeAssistantCoverOpenFraction } from '../../lib/ha3d/cover-state'
import {
  createEntityBinding,
  type DashboardInteractionAction,
  DEFAULT_COVER_MOTION,
  type EntityBinding,
  isSupportedHomeAssistantDomain,
} from '../../lib/ha3d/entity-binding'
import {
  entityFriendlyName,
  formatHomeAssistantEntityValue,
  numericEntityAttribute,
  stringListEntityAttribute,
} from '../../lib/ha3d/entity-display'
import {
  getHa3dProjectConfigSnapshot,
  removeEntityBinding,
  subscribeHa3dProjectConfig,
  upsertEntityBinding,
} from '../../lib/ha3d/project-config'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'

export default function Ha3dPanel() {
  const [query, setQuery] = useState('')
  const [refreshingEntities, setRefreshingEntities] = useState(false)
  const [refreshEntitiesError, setRefreshEntitiesError] = useState<string | null>(null)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const selectedNodeId = selectedIds.length === 1 ? (selectedIds[0] as AnyNodeId) : null
  const selectedNode = useScene((state) =>
    selectedNodeId ? state.nodes[selectedNodeId] : undefined,
  )
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

  const allEntities = runtime.adapter?.listEntities() ?? []
  const needle = query.trim().toLocaleLowerCase()
  const entities = allEntities
    .filter((entity) => {
      const domain = entity.entityId.split('.')[0] ?? ''
      return isSupportedHomeAssistantDomain(domain)
    })
    .filter((entity) => {
      if (!needle) return true
      return (
        entity.entityId.toLocaleLowerCase().includes(needle) ||
        entityFriendlyName(entity).toLocaleLowerCase().includes(needle)
      )
    })
    .sort((left, right) => entityFriendlyName(left).localeCompare(entityFriendlyName(right)))

  const selectedBindings = selectedNodeId
    ? project.bindings.filter((binding) => binding.nodeId === selectedNodeId)
    : []

  const refreshEntities = useCallback(async () => {
    const adapter = runtime.adapter
    const refresh = adapter?.refreshEntities
    if (!refresh || refreshingEntities) return

    setRefreshingEntities(true)
    setRefreshEntitiesError(null)
    try {
      await refresh.call(adapter)
    } catch (error) {
      setRefreshEntitiesError(error instanceof Error ? error.message : 'Entity refresh failed')
    } finally {
      setRefreshingEntities(false)
    }
  }, [refreshingEntities, runtime.adapter])

  useEffect(() => {
    const adapter = runtime.adapter
    if (!adapter?.refreshEntities) return

    setRefreshingEntities(true)
    setRefreshEntitiesError(null)
    void adapter
      .refreshEntities()
      .catch((error) => {
        setRefreshEntitiesError(error instanceof Error ? error.message : 'Entity refresh failed')
      })
      .finally(() => setRefreshingEntities(false))
  }, [runtime.adapter])

  const togglePowerEntity = async (
    domain: 'light' | 'switch' | 'input_boolean',
    entityId: string,
  ) => {
    const adapter = runtime.adapter
    const entity = adapter?.getEntity(entityId)
    if (!(adapter && entity)) return
    await adapter.callService({
      domain,
      service: entity.state === 'on' ? 'turn_off' : 'turn_on',
      target: { entityId },
    })
  }

  const callCoverService = async (entityId: string, service: 'open_cover' | 'close_cover') => {
    await runtime.adapter?.callService({
      domain: 'cover',
      service,
      target: { entityId },
    })
  }

  const setCoverPosition = async (entityId: string, position: number) => {
    await runtime.adapter?.callService({
      domain: 'cover',
      service: 'set_cover_position',
      data: { position },
      target: { entityId },
    })
  }

  const setClimateTemperature = async (entityId: string, temperature: number) => {
    await runtime.adapter?.callService({
      domain: 'climate',
      service: 'set_temperature',
      data: { temperature },
      target: { entityId },
    })
  }

  const setClimateMode = async (entityId: string, hvacMode: string) => {
    await runtime.adapter?.callService({
      domain: 'climate',
      service: 'set_hvac_mode',
      data: { hvac_mode: hvacMode },
      target: { entityId },
    })
  }

  const updateCoverMotion = (
    binding: EntityBinding,
    patch: Partial<NonNullable<EntityBinding['coverMotion']>>,
  ) => {
    upsertEntityBinding({
      ...binding,
      coverMotion: {
        ...(binding.coverMotion ?? DEFAULT_COVER_MOTION),
        ...patch,
      },
    })
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="font-semibold text-base">Home Assistant</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Bind scene objects to live Home Assistant entities.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-sm">Home Assistant entities</div>
            <div className="mt-0.5 text-muted-foreground text-xs">
              {runtime.connected
                ? `${entities.length} bindable · ${allEntities.length} total`
                : 'Bridge not connected'}
            </div>
          </div>
          <button
            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!runtime.adapter?.refreshEntities || refreshingEntities}
            onClick={() => void refreshEntities()}
            type="button"
          >
            {refreshingEntities ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {refreshEntitiesError ? (
          <div className="mt-2 text-destructive text-xs">{refreshEntitiesError}</div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="font-medium text-sm">Selected object</div>
        {selectedNode ? (
          <div className="mt-2">
            <div className="text-sm">{selectedNode.name ?? selectedNode.type}</div>
            <div className="break-all text-muted-foreground text-xs">{selectedNode.id}</div>
          </div>
        ) : (
          <p className="mt-2 text-muted-foreground text-xs">
            Select exactly one object in the 2D or 3D scene to bind it.
          </p>
        )}
      </div>

      {selectedBindings.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="font-medium text-sm">Bindings</div>
          <div className="mt-2 space-y-2">
            {selectedBindings.map((binding) => {
              const entity = runtime.adapter?.getEntity(binding.entityId)
              const motion = binding.coverMotion ?? DEFAULT_COVER_MOTION
              const coverPosition = Math.round(resolveHomeAssistantCoverOpenFraction(entity) * 100)
              const climateTarget = numericEntityAttribute(entity, 'temperature')
              const climateModes = stringListEntityAttribute(entity, 'hvac_modes')

              return (
                <div
                  className="rounded-md border border-border/70 p-2"
                  key={`${binding.nodeId}:${binding.domain}`}
                >
                  <div className="text-sm">
                    {entity ? entityFriendlyName(entity) : binding.entityId}
                  </div>
                  {entity && entityFriendlyName(entity) !== entity.entityId ? (
                    <div className="truncate text-muted-foreground text-[10px]">
                      {entity.entityId}
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2 border-border/70 border-t pt-3">
                    <label className="text-muted-foreground text-xs">
                      Tap action
                      <select
                        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                        onChange={(event) =>
                          upsertEntityBinding({
                            ...binding,
                            tapAction: event.target.value as DashboardInteractionAction,
                          })
                        }
                        value={binding.tapAction}
                      >
                        <option value="default">Default</option>
                        {binding.domain === 'light' ||
                        binding.domain === 'switch' ||
                        binding.domain === 'cover' ||
                        binding.domain === 'input_boolean' ? (
                          <option value="toggle">Toggle</option>
                        ) : null}
                        <option value="more-info">More info</option>
                        <option value="none">None</option>
                      </select>
                    </label>
                    <label className="text-muted-foreground text-xs">
                      Hold action
                      <select
                        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                        onChange={(event) =>
                          upsertEntityBinding({
                            ...binding,
                            holdAction: event.target.value as DashboardInteractionAction,
                          })
                        }
                        value={binding.holdAction}
                      >
                        <option value="default">Default</option>
                        {binding.domain === 'light' ||
                        binding.domain === 'switch' ||
                        binding.domain === 'cover' ? (
                          <option value="toggle">Toggle</option>
                        ) : null}
                        <option value="more-info">More info</option>
                        <option value="none">None</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">
                      {binding.domain} ·{' '}
                      {entity ? formatHomeAssistantEntityValue(entity) : 'unavailable'}
                    </span>
                    <div className="flex gap-1">
                      {binding.domain === 'light' && entity ? (
                        <button
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                          onClick={() => void togglePowerEntity('light', binding.entityId)}
                          type="button"
                        >
                          {entity.state === 'on' ? 'Turn off' : 'Turn on'}
                        </button>
                      ) : null}
                      {binding.domain === 'switch' && entity ? (
                        <button
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                          onClick={() => void togglePowerEntity('switch', binding.entityId)}
                          type="button"
                        >
                          {entity.state === 'on' ? 'Turn off' : 'Turn on'}
                        </button>
                      ) : null}
                      {binding.domain === 'input_boolean' && entity ? (
                        <button
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                          onClick={() => void togglePowerEntity('input_boolean', binding.entityId)}
                          type="button"
                        >
                          {entity.state === 'on' ? 'Turn off' : 'Turn on'}
                        </button>
                      ) : null}
                      <button
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                        onClick={() => removeEntityBinding(binding.nodeId, binding.domain)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {binding.domain === 'cover' && entity ? (
                    <div className="mt-3 space-y-3 border-border/70 border-t pt-3">
                      <div className="flex gap-2">
                        <button
                          className="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                          onClick={() => void callCoverService(binding.entityId, 'close_cover')}
                          type="button"
                        >
                          Close
                        </button>
                        <button
                          className="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                          onClick={() => void callCoverService(binding.entityId, 'open_cover')}
                          type="button"
                        >
                          Open
                        </button>
                      </div>

                      <label className="block text-muted-foreground text-xs">
                        Position · {coverPosition}%
                        <input
                          className="mt-1 block w-full"
                          max="100"
                          min="0"
                          onChange={(event) =>
                            void setCoverPosition(binding.entityId, Number(event.target.value))
                          }
                          type="range"
                          value={coverPosition}
                        />
                      </label>

                      <div className="grid grid-cols-3 gap-2">
                        <label className="text-muted-foreground text-xs">
                          Axis
                          <select
                            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                            onChange={(event) =>
                              updateCoverMotion(binding, {
                                axis: event.target.value as 'x' | 'y' | 'z',
                              })
                            }
                            value={motion.axis}
                          >
                            <option value="x">X</option>
                            <option value="y">Y</option>
                            <option value="z">Z</option>
                          </select>
                        </label>

                        <label className="text-muted-foreground text-xs">
                          Open offset
                          <input
                            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                            onChange={(event) => {
                              const value = Number(event.target.value)
                              if (Number.isFinite(value)) {
                                updateCoverMotion(binding, { openOffsetMeters: value })
                              }
                            }}
                            step="0.1"
                            type="number"
                            value={motion.openOffsetMeters}
                          />
                        </label>

                        <label className="text-muted-foreground text-xs">
                          Time ms
                          <input
                            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                            max="60000"
                            min="0"
                            onChange={(event) => {
                              const value = Number(event.target.value)
                              if (Number.isFinite(value)) {
                                updateCoverMotion(binding, { durationMs: value })
                              }
                            }}
                            step="100"
                            type="number"
                            value={motion.durationMs}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {binding.domain === 'climate' && entity ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-border/70 border-t pt-3">
                      <label className="text-muted-foreground text-xs">
                        Target temperature
                        <input
                          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                          onChange={(event) => {
                            if (!event.target.value.trim()) return
                            const value = Number(event.target.value)
                            if (Number.isFinite(value)) {
                              void setClimateTemperature(binding.entityId, value)
                            }
                          }}
                          step="0.5"
                          type="number"
                          value={climateTarget ?? ''}
                        />
                      </label>

                      <label className="text-muted-foreground text-xs">
                        HVAC mode
                        <select
                          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                          onChange={(event) =>
                            void setClimateMode(binding.entityId, event.target.value)
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
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="font-medium text-sm">Entities</div>
        <input
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search entity or friendly name…"
          type="search"
          value={query}
        />
        <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
          {entities.map((entity) => {
            const domain = entity.entityId.split('.')[0] ?? ''
            if (!isSupportedHomeAssistantDomain(domain)) return null
            const current = selectedBindings.find((binding) => binding.domain === domain)
            const isBound = current?.entityId === entity.entityId
            return (
              <button
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedNodeId}
                key={entity.entityId}
                onClick={() => {
                  if (!selectedNodeId) return
                  upsertEntityBinding(
                    createEntityBinding({
                      nodeId: selectedNodeId,
                      entityId: entity.entityId,
                    }),
                  )
                }}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{entityFriendlyName(entity)}</span>
                  <span className="block truncate text-muted-foreground text-xs">
                    {entity.entityId}
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {isBound ? 'Bound' : formatHomeAssistantEntityValue(entity)}
                </span>
              </button>
            )
          })}
          {runtime.connected && entities.length === 0 ? (
            <p className="py-3 text-center text-muted-foreground text-xs">
              No supported entities match this search.
            </p>
          ) : null}
          {!runtime.connected ? (
            <p className="py-3 text-center text-muted-foreground text-xs">
              Home Assistant bridge is not connected.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
