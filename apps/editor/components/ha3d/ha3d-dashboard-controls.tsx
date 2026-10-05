'use client'

import { Eye, EyeOff, Tags, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { buildAutomaticDashboardCard } from '../../lib/ha3d/dashboard-menu'
import {
  getHomeAssistantLovelaceHostSnapshot,
  subscribeHomeAssistantLovelaceHost,
} from '../../lib/ha3d/lovelace-host'
import {
  getHa3dProjectConfigSnapshot,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'
import { Ha3dLovelaceCard } from './ha3d-lovelace-card'
import type { Ha3dEnvironmentMode } from './ha3d-sun-environment'

export function Ha3dDashboardControls({
  highlightsEnabled = true,
  markersEnabled = true,
  onHighlightsEnabledChange,
  onMarkersEnabledChange,
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
  const runtime = useSyncExternalStore(
    subscribeHomeAssistantRuntime,
    getHomeAssistantRuntimeSnapshot,
    getHomeAssistantRuntimeSnapshot,
  )
  const lovelaceHost = useSyncExternalStore(
    subscribeHomeAssistantLovelaceHost,
    getHomeAssistantLovelaceHostSnapshot,
    getHomeAssistantLovelaceHostSnapshot,
  )
  const project = useSyncExternalStore(
    subscribeHa3dProjectConfig,
    getHa3dProjectConfigSnapshot,
    getHa3dProjectConfigSnapshot,
  )

  const activeCard = useMemo(
    () =>
      project.dashboardMenu.mode === 'lovelace'
        ? project.dashboardMenu.lovelaceCard
        : buildAutomaticDashboardCard(
            project.bindings
              .filter((binding) => binding.enabled)
              .map((binding) => binding.entityId),
          ),
    [project.bindings, project.dashboardMenu],
  )

  const setCollapsedState = (next: boolean) => {
    setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

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

  if (collapsed) return null

  return (
    <aside
      className="pointer-events-auto absolute right-3 bottom-3 left-3 z-40 max-h-[48vh] overflow-hidden rounded-[22px] border border-[var(--ha3d-dashboard-border)] bg-[var(--ha3d-dashboard-surface)] text-[var(--ha3d-dashboard-text)] shadow-2xl backdrop-blur-xl md:top-3 md:bottom-3 md:left-auto md:w-[21rem] md:max-h-none"
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
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]"
            onClick={() => setCollapsedState(true)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-full bg-[var(--ha3d-dashboard-hover)] p-1">
          {onHighlightsEnabledChange ? (
            <button
              aria-pressed={highlightsEnabled}
              className={
                highlightsEnabled
                  ? 'flex items-center justify-center gap-1.5 rounded-full bg-[var(--ha3d-dashboard-primary-soft)] px-2 py-1.5 text-[var(--ha3d-dashboard-primary)] text-[10px] ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
                  : 'flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
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
                  ? 'flex items-center justify-center gap-1.5 rounded-full bg-[var(--ha3d-dashboard-primary-soft)] px-2 py-1.5 text-[var(--ha3d-dashboard-primary)] text-[10px] ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
                  : 'flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
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
          <div className="mt-2 grid grid-cols-4 gap-1 rounded-full bg-[var(--ha3d-dashboard-hover)] p-1">
            {(['auto', 'day', 'twilight', 'night'] as const).map((mode) => (
              <button
                aria-pressed={environmentMode === mode}
                className={
                  environmentMode === mode
                    ? 'rounded-full bg-[var(--ha3d-dashboard-warning-soft)] px-1.5 py-1.5 font-medium text-[10px] text-[var(--ha3d-dashboard-warning)] ring-1 ring-[var(--ha3d-dashboard-warning-ring)]'
                    : 'rounded-full px-1.5 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
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

      <div className="max-h-[calc(48vh-8.5rem)] overflow-y-auto p-2.5 md:max-h-[calc(100vh-11.5rem)]">
        {lovelaceHost ? (
          <Ha3dLovelaceCard config={activeCard} hass={lovelaceHost} />
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--ha3d-dashboard-border)] px-3 py-5 text-center text-[var(--ha3d-dashboard-muted)] text-xs">
            Home Assistant card runtime is not connected.
          </div>
        )}
      </div>
    </aside>
  )
}
