'use client'

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  createEntityBinding,
  isSupportedHomeAssistantDomain,
} from '../../lib/ha3d/entity-binding'
import type { HomeAssistantEntityState } from '../../lib/ha3d/home-assistant-adapter'
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

function friendlyName(entity: HomeAssistantEntityState): string {
  const name = entity.attributes.friendly_name
  return typeof name === 'string' && name.trim() ? name : entity.entityId
}

export default function Ha3dPanel() {
  const [query, setQuery] = useState('')
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const selectedNodeId = selectedIds.length === 1 ? selectedIds[0] : null
  const selectedNode = useScene((state) => (selectedNodeId ? state.nodes[selectedNodeId] : undefined))
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

  const entities = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return (runtime.adapter?.listEntities() ?? [])
      .filter((entity) => {
        const domain = entity.entityId.split('.')[0] ?? ''
        return isSupportedHomeAssistantDomain(domain)
      })
      .filter((entity) => {
        if (!needle) return true
        return (
          entity.entityId.toLocaleLowerCase().includes(needle) ||
          friendlyName(entity).toLocaleLowerCase().includes(needle)
        )
      })
      .sort((left, right) => friendlyName(left).localeCompare(friendlyName(right)))
  }, [query, runtime.adapter, runtime.revision])

  const selectedBindings = selectedNodeId
    ? project.bindings.filter((binding) => binding.nodeId === selectedNodeId)
    : []

  const toggleLight = async (entityId: string) => {
    const adapter = runtime.adapter
    const entity = adapter?.getEntity(entityId)
    if (!(adapter && entity)) return
    await adapter.callService({
      domain: 'light',
      service: entity.state === 'on' ? 'turn_off' : 'turn_on',
      target: { entityId },
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
          <span className="font-medium text-sm">Bridge</span>
          <span className="text-muted-foreground text-xs">
            {runtime.connected ? runtime.adapter?.id : 'not connected'}
          </span>
        </div>
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
              return (
                <div
                  className="rounded-md border border-border/70 p-2"
                  key={`${binding.nodeId}:${binding.domain}`}
                >
                  <div className="text-sm">{binding.entityId}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">
                      {binding.domain} · {entity?.state ?? 'unavailable'}
                    </span>
                    <div className="flex gap-1">
                      {binding.domain === 'light' && entity ? (
                        <button
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                          onClick={() => void toggleLight(binding.entityId)}
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
                  <span className="block truncate text-sm">{friendlyName(entity)}</span>
                  <span className="block truncate text-muted-foreground text-xs">
                    {entity.entityId}
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {isBound ? 'Bound' : entity.state}
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
