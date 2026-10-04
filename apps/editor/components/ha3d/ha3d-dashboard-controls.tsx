'use client'

import { ChevronRight, Eye, EyeOff, Tags, X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { entityFriendlyName, formatHomeAssistantEntityValue } from '../../lib/ha3d/entity-display'
import {
  getHa3dProjectConfigSnapshot,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'
import { Ha3dMoreInfoPopup } from './ha3d-more-info-popup'
import type { Ha3dEnvironmentMode } from './ha3d-sun-environment'

function actionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Home Assistant service call failed'
}

export function Ha3dDashboardControls({
  selectedNodeId = null,
  expandedNodeId = null,
  highlightsEnabled = true,
  markersEnabled = true,
  onHighlightsEnabledChange,
  onMarkersEnabledChange,
  onExpandedNodeIdChange,
  environmentMode = 'auto',
  onEnvironmentModeChange,
}: {
  selectedNodeId?: string | null
  expandedNodeId?: string | null
  highlightsEnabled?: boolean
  markersEnabled?: boolean
  onHighlightsEnabledChange?: (enabled: boolean) => void
  onMarkersEnabledChange?: (enabled: boolean) => void
  onExpandedNodeIdChange?: (nodeId: string | null) => void
  environmentMode?: Ha3dEnvironmentMode
  onEnvironmentModeChange?: (mode: Ha3dEnvironmentMode) => void
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
    if (selectedNodeId || expandedNodeId) setCollapsed(false)
  }, [expandedNodeId, selectedNodeId])

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

  const quickAction = async (binding: (typeof bindings)[number]['binding']) => {
    const adapter = runtime.adapter
    const entity = adapter?.getEntity(binding.entityId)
    if (!(adapter && entity)) return

    let service: string | null = null
    if (
      binding.domain === 'light' ||
      binding.domain === 'switch' ||
      binding.domain === 'input_boolean'
    ) {
      service = entity.state === 'on' ? 'turn_off' : 'turn_on'
    } else if (binding.domain === 'cover') {
      service =
        entity.state === 'closed' || entity.state === 'closing' ? 'open_cover' : 'close_cover'
    }
    if (!service) {
      onExpandedNodeIdChange?.(binding.nodeId)
      return
    }

    setActionError(null)
    try {
      await adapter.callService({
        domain: binding.domain,
        service,
        target: { entityId: binding.entityId },
      })
    } catch (error) {
      setActionError(actionErrorMessage(error))
    }
  }

  const panel = collapsed ? (
    <button
      className="pointer-events-auto absolute right-3 bottom-3 z-40 rounded-full border border-white/10 bg-black/70 px-4 py-2 font-medium text-sm text-white shadow-xl backdrop-blur-xl md:top-3 md:bottom-auto"
      onClick={() => setCollapsed(false)}
      type="button"
    >
      HA controls
    </button>
  ) : (
    <aside className="pointer-events-auto absolute right-3 bottom-3 left-3 z-40 max-h-[46vh] overflow-hidden rounded-2xl border border-white/10 bg-black/72 text-white shadow-2xl backdrop-blur-xl md:top-3 md:bottom-3 md:left-auto md:w-[19rem] md:max-h-none">
      <div className="border-white/10 border-b px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span
            className={
              runtime.connected
                ? 'size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]'
                : 'size-2 rounded-full bg-slate-500'
            }
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm">Home Assistant</div>
            <div className="truncate text-[10px] text-white/45">
              {bindings.length} bound entities
            </div>
          </div>
          <button
            aria-label="Hide Home Assistant controls"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 hover:bg-white/10 hover:text-white"
            onClick={() => setCollapsed(true)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {onHighlightsEnabledChange ? (
            <button
              aria-pressed={highlightsEnabled}
              className={
                highlightsEnabled
                  ? 'flex items-center justify-center gap-1.5 rounded-xl bg-cyan-400/15 px-2 py-2 text-cyan-200 text-xs ring-1 ring-cyan-300/20'
                  : 'flex items-center justify-center gap-1.5 rounded-xl bg-white/5 px-2 py-2 text-white/50 text-xs hover:bg-white/10'
              }
              onClick={() => onHighlightsEnabledChange(!highlightsEnabled)}
              type="button"
            >
              {highlightsEnabled ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              Highlights
            </button>
          ) : null}
          {onMarkersEnabledChange ? (
            <button
              aria-pressed={markersEnabled}
              className={
                markersEnabled
                  ? 'flex items-center justify-center gap-1.5 rounded-xl bg-cyan-400/15 px-2 py-2 text-cyan-200 text-xs ring-1 ring-cyan-300/20'
                  : 'flex items-center justify-center gap-1.5 rounded-xl bg-white/5 px-2 py-2 text-white/50 text-xs hover:bg-white/10'
              }
              onClick={() => onMarkersEnabledChange(!markersEnabled)}
              type="button"
            >
              <Tags className="h-3.5 w-3.5" />
              Labels
            </button>
          ) : null}
        </div>

        {onEnvironmentModeChange ? (
          <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-white/5 p-1">
            {(['auto', 'day', 'twilight', 'night'] as const).map((mode) => (
              <button
                aria-pressed={environmentMode === mode}
                className={
                  environmentMode === mode
                    ? 'rounded-lg bg-white/12 px-1.5 py-1.5 font-medium text-[10px] text-white'
                    : 'rounded-lg px-1.5 py-1.5 text-[10px] text-white/45 hover:bg-white/8 hover:text-white'
                }
                key={mode}
                onClick={() => onEnvironmentModeChange(mode)}
                type="button"
              >
                {mode === 'auto' ? 'Auto' : mode[0]!.toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="max-h-[calc(46vh-8rem)] overflow-y-auto p-2 md:max-h-[calc(100vh-11rem)]">
        {actionError ? (
          <div className="mb-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-red-200 text-xs">
            {actionError}
          </div>
        ) : null}

        {bindings.length === 0 ? (
          <div className="rounded-xl border border-white/10 px-3 py-4 text-center text-white/45 text-xs">
            No entities are bound to this scene.
          </div>
        ) : (
          <div className="space-y-1">
            {bindings.map(({ binding, entity }) => {
              const selected = binding.nodeId === selectedNodeId
              const hasQuickAction =
                binding.domain === 'light' ||
                binding.domain === 'switch' ||
                binding.domain === 'input_boolean' ||
                binding.domain === 'cover'

              return (
                <div
                  className={
                    selected
                      ? 'flex items-center gap-2 rounded-xl bg-cyan-400/12 p-2 ring-1 ring-cyan-300/25'
                      : 'flex items-center gap-2 rounded-xl p-2 hover:bg-white/6'
                  }
                  key={`${binding.nodeId}:${binding.domain}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-xs">
                      {entity ? entityFriendlyName(entity) : binding.entityId}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/40">
                      <span className="truncate">
                        {entity ? formatHomeAssistantEntityValue(entity) : 'Unavailable'}
                      </span>
                      <span>·</span>
                      <span>{binding.domain}</span>
                    </div>
                  </div>

                  {hasQuickAction && entity ? (
                    <button
                      className="rounded-lg bg-white/7 px-2 py-1.5 text-[10px] text-white/70 hover:bg-white/12 hover:text-white"
                      onClick={() => void quickAction(binding)}
                      type="button"
                    >
                      {binding.domain === 'cover'
                        ? entity.state === 'closed' || entity.state === 'closing'
                          ? 'Open'
                          : 'Close'
                        : entity.state === 'on'
                          ? 'Off'
                          : 'On'}
                    </button>
                  ) : null}

                  {onExpandedNodeIdChange ? (
                    <button
                      aria-label={`More info for ${binding.entityId}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"
                      onClick={() => onExpandedNodeIdChange(binding.nodeId)}
                      type="button"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )

  return (
    <>
      {panel}
      {onExpandedNodeIdChange ? (
        <Ha3dMoreInfoPopup nodeId={expandedNodeId} onClose={() => onExpandedNodeIdChange(null)} />
      ) : null}
    </>
  )
}
