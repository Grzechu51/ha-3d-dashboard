'use client'

import { ChevronRight, Eye, EyeOff, Tags, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
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
  onShowMoreInfo,
  environmentMode = 'auto',
  onEnvironmentModeChange,
  collapsed: collapsedProp,
  onCollapsedChange,
  onPanelHeightChange,
}: {
  selectedNodeId?: string | null
  expandedNodeId?: string | null
  highlightsEnabled?: boolean
  markersEnabled?: boolean
  onHighlightsEnabledChange?: (enabled: boolean) => void
  onMarkersEnabledChange?: (enabled: boolean) => void
  onExpandedNodeIdChange?: (nodeId: string | null) => void
  onShowMoreInfo?: (entityId: string) => void
  environmentMode?: Ha3dEnvironmentMode
  onEnvironmentModeChange?: (mode: Ha3dEnvironmentMode) => void
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  onPanelHeightChange?: (height: number) => void
} = {}) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const panelRef = useRef<HTMLElement | null>(null)
  const collapsed = collapsedProp ?? internalCollapsed

  const setCollapsedState = (next: boolean) => {
    setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }
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
    if (!(selectedNodeId || expandedNodeId)) return
    setInternalCollapsed(false)
    onCollapsedChange?.(false)
  }, [expandedNodeId, onCollapsedChange, selectedNodeId])

  useEffect(() => {
    if (!onPanelHeightChange) return
    if (collapsed) {
      onPanelHeightChange(0)
      return
    }

    const panel = panelRef.current
    if (!panel) return

    const reportHeight = () => {
      onPanelHeightChange(panel.getBoundingClientRect().height)
    }
    reportHeight()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(reportHeight)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [collapsed, onPanelHeightChange])

  const rows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        bindings: (typeof project.bindings)[number][]
        entity: ReturnType<NonNullable<typeof runtime.adapter>['getEntity']> | undefined
      }
    >()

    for (const binding of project.bindings) {
      if (!binding.enabled) continue
      const existing = grouped.get(binding.entityId)
      if (existing) {
        existing.bindings.push(binding)
        continue
      }
      grouped.set(binding.entityId, {
        bindings: [binding],
        entity: runtime.adapter?.getEntity(binding.entityId),
      })
    }

    return Array.from(grouped.entries())
      .map(([entityId, row]) => ({ entityId, ...row }))
      .sort((left, right) => {
        const leftSelected = left.bindings.some((binding) => binding.nodeId === selectedNodeId)
        const rightSelected = right.bindings.some((binding) => binding.nodeId === selectedNodeId)
        if (leftSelected !== rightSelected) return leftSelected ? -1 : 1
        const leftName = left.entity ? entityFriendlyName(left.entity) : left.entityId
        const rightName = right.entity ? entityFriendlyName(right.entity) : right.entityId
        return leftName.localeCompare(rightName)
      })
  }, [project.bindings, runtime.adapter, runtime.revision, selectedNodeId])

  const showMoreInfo = (entityId: string, fallbackNodeId: string) => {
    if (onShowMoreInfo) {
      onShowMoreInfo(entityId)
      return
    }
    onExpandedNodeIdChange?.(fallbackNodeId)
  }

  const quickAction = async (row: (typeof rows)[number]) => {
    const binding = row.bindings[0]
    const adapter = runtime.adapter
    const entity = row.entity
    if (!(binding && adapter && entity)) return

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
      showMoreInfo(row.entityId, binding.nodeId)
      return
    }

    setActionError(null)
    try {
      await adapter.callService({
        domain: binding.domain,
        service,
        target: { entityId: row.entityId },
      })
    } catch (error) {
      setActionError(actionErrorMessage(error))
    }
  }

  const panel = collapsed ? null : (
    <aside
      className="pointer-events-auto absolute right-3 bottom-3 left-3 z-40 max-h-[48vh] overflow-hidden rounded-2xl border border-[var(--ha3d-dashboard-border)] bg-[var(--ha3d-dashboard-surface)] text-[var(--ha3d-dashboard-text)] shadow-2xl backdrop-blur-xl md:top-3 md:bottom-3 md:left-auto md:w-[20rem] md:max-h-none"
      ref={panelRef}
    >
      <div className="border-[var(--ha3d-dashboard-border)] border-b p-3">
        <div className="flex items-center gap-2.5">
          <span
            className={
              runtime.connected
                ? 'size-2 rounded-full bg-[var(--ha3d-dashboard-success)]'
                : 'size-2 rounded-full bg-[var(--ha3d-dashboard-disabled)]'
            }
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm">Menu</div>
          </div>
          <button
            aria-label="Hide Home Assistant controls"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]"
            onClick={() => setCollapsedState(true)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-[var(--ha3d-dashboard-hover)] p-1">
          {onHighlightsEnabledChange ? (
            <button
              aria-pressed={highlightsEnabled}
              className={
                highlightsEnabled
                  ? 'flex items-center justify-center gap-1.5 rounded-lg bg-[var(--ha3d-dashboard-primary-soft)] px-2 py-1.5 text-[var(--ha3d-dashboard-primary)] text-[10px] ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
                  : 'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
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
                  ? 'flex items-center justify-center gap-1.5 rounded-lg bg-[var(--ha3d-dashboard-primary-soft)] px-2 py-1.5 text-[var(--ha3d-dashboard-primary)] text-[10px] ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
                  : 'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
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
          <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-[var(--ha3d-dashboard-hover)] p-1">
            {(['auto', 'day', 'twilight', 'night'] as const).map((mode) => (
              <button
                aria-pressed={environmentMode === mode}
                className={
                  environmentMode === mode
                    ? 'rounded-lg bg-[var(--ha3d-dashboard-warning-soft)] px-1.5 py-1.5 font-medium text-[10px] text-[var(--ha3d-dashboard-warning)] ring-1 ring-[var(--ha3d-dashboard-warning)]/20'
                    : 'rounded-lg px-1.5 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
                }
                key={mode}
                onClick={() => onEnvironmentModeChange(mode)}
                type="button"
              >
                {mode === 'auto'
                  ? 'Auto'
                  : mode === 'twilight'
                    ? 'Dusk'
                    : mode[0]!.toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="max-h-[calc(48vh-8.5rem)] overflow-y-auto p-2 md:max-h-[calc(100vh-11.5rem)]">
        {actionError ? (
          <div className="mb-2 rounded-xl border border-[var(--ha3d-dashboard-error)]/30 bg-[var(--ha3d-dashboard-error-soft)] px-3 py-2 text-[var(--ha3d-dashboard-error)] text-xs">
            {actionError}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="rounded-xl border border-[var(--ha3d-dashboard-border)] px-3 py-5 text-center text-[var(--ha3d-dashboard-muted)] text-xs">
            No entities are linked to this scene.
          </div>
        ) : (
          <div className="space-y-1">
            {rows.map((row) => {
              const binding = row.bindings[0]
              if (!binding) return null
              const selected = row.bindings.some((entry) => entry.nodeId === selectedNodeId)
              const hasQuickAction =
                binding.domain === 'light' ||
                binding.domain === 'switch' ||
                binding.domain === 'input_boolean' ||
                binding.domain === 'cover'

              return (
                <div
                  className={
                    selected
                      ? 'flex items-center gap-2 rounded-xl bg-[var(--ha3d-dashboard-primary-soft)] p-2 ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
                      : 'flex items-center gap-2 rounded-xl p-2 transition-colors hover:bg-[var(--ha3d-dashboard-hover)]'
                  }
                  key={row.entityId}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-xs">
                      {row.entity ? entityFriendlyName(row.entity) : row.entityId}
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)]">
                      <span className="truncate">
                        {row.entity ? formatHomeAssistantEntityValue(row.entity) : 'Unavailable'}
                      </span>
                      <span>·</span>
                      <span>{binding.domain}</span>
                      {row.bindings.length > 1 ? (
                        <>
                          <span>·</span>
                          <span className="shrink-0">{row.bindings.length} objects</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {hasQuickAction && row.entity ? (
                    <button
                      className="min-w-9 rounded-lg bg-[var(--ha3d-dashboard-hover)] px-2 py-1.5 text-[10px] text-[var(--ha3d-dashboard-text)] hover:bg-[var(--ha3d-dashboard-primary-soft)] hover:text-[var(--ha3d-dashboard-primary)]"
                      onClick={() => void quickAction(row)}
                      type="button"
                    >
                      {binding.domain === 'cover'
                        ? row.entity.state === 'closed' || row.entity.state === 'closing'
                          ? 'Open'
                          : 'Close'
                        : row.entity.state === 'on'
                          ? 'Off'
                          : 'On'}
                    </button>
                  ) : null}

                  {onShowMoreInfo || onExpandedNodeIdChange ? (
                    <button
                      aria-label={`More info for ${row.entityId}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]"
                      onClick={() => showMoreInfo(row.entityId, binding.nodeId)}
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
      {!onShowMoreInfo && onExpandedNodeIdChange ? (
        <Ha3dMoreInfoPopup nodeId={expandedNodeId} onClose={() => onExpandedNodeIdChange(null)} />
      ) : null}
    </>
  )
}
