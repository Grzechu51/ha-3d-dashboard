'use client'

import {
  Activity,
  Blinds,
  ChevronRight,
  Eye,
  EyeOff,
  Gauge,
  Lightbulb,
  Power,
  SlidersHorizontal,
  Tags,
  Thermometer,
  ToggleLeft,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { EntityBinding } from '../../lib/ha3d/entity-binding'
import { entityDomain } from '../../lib/ha3d/entity-binding'
import { entityFriendlyName, formatHomeAssistantEntityValue } from '../../lib/ha3d/entity-display'
import type { HomeAssistantEntityState } from '../../lib/ha3d/home-assistant-adapter'
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

type DashboardRow = Readonly<{
  entityId: string
  domain: string
  entity: HomeAssistantEntityState | undefined
  bindings: readonly EntityBinding[]
  span: 1 | 2
}>

type DashboardRangeControl = Readonly<{
  min: number
  max: number
  step: number
  value: number
  label: string
}>

function actionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Home Assistant service call failed'
}

function numericAttribute(
  entity: HomeAssistantEntityState | undefined,
  key: string,
): number | null {
  const value = entity?.attributes[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function numericState(entity: HomeAssistantEntityState | undefined): number | null {
  if (!entity) return null
  const value = Number(entity.state)
  return Number.isFinite(value) ? value : null
}

function rangeControl(row: DashboardRow): DashboardRangeControl | null {
  const { domain, entity } = row
  if (!entity || row.span !== 2) return null

  if (domain === 'light' && entity.state === 'on') {
    const brightness = numericAttribute(entity, 'brightness')
    if (brightness === null) return null
    return {
      min: 1,
      max: 255,
      step: 1,
      value: brightness,
      label: `${Math.round((brightness / 255) * 100)}%`,
    }
  }

  if (domain === 'cover') {
    const position = numericAttribute(entity, 'current_position')
    if (position === null) return null
    return {
      min: 0,
      max: 100,
      step: 1,
      value: position,
      label: `${Math.round(position)}%`,
    }
  }

  if (domain === 'number' || domain === 'input_number') {
    const value = numericState(entity)
    if (value === null) return null
    const min = numericAttribute(entity, 'min') ?? 0
    const max = numericAttribute(entity, 'max') ?? 100
    const step = numericAttribute(entity, 'step') ?? 1
    return {
      min,
      max,
      step,
      value,
      label: formatHomeAssistantEntityValue(entity),
    }
  }

  return null
}

function DashboardEntityIcon({ domain }: { domain: string }) {
  const className = 'h-4 w-4'
  if (domain === 'light') return <Lightbulb className={className} />
  if (domain === 'cover') return <Blinds className={className} />
  if (domain === 'climate') return <Thermometer className={className} />
  if (domain === 'switch') return <Power className={className} />
  if (domain === 'input_boolean' || domain === 'binary_sensor') {
    return <ToggleLeft className={className} />
  }
  if (domain === 'number' || domain === 'input_number') {
    return <SlidersHorizontal className={className} />
  }
  if (domain === 'sensor') return <Gauge className={className} />
  return <Activity className={className} />
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

  const rows = useMemo<readonly DashboardRow[]>(() => {
    if (project.dashboardMenu.mode === 'custom') {
      return project.dashboardMenu.items.map((item) => ({
        entityId: item.entityId,
        domain: entityDomain(item.entityId) ?? 'entity',
        entity: runtime.adapter?.getEntity(item.entityId),
        bindings: project.bindings.filter(
          (binding) => binding.enabled && binding.entityId === item.entityId,
        ),
        span: item.span,
      }))
    }

    const grouped = new Map<
      string,
      {
        bindings: EntityBinding[]
        entity: HomeAssistantEntityState | undefined
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
      .map(([entityId, row]) => ({
        entityId,
        domain: entityDomain(entityId) ?? 'entity',
        span: 2 as const,
        ...row,
      }))
      .sort((left, right) => {
        const leftSelected = left.bindings.some((binding) => binding.nodeId === selectedNodeId)
        const rightSelected = right.bindings.some((binding) => binding.nodeId === selectedNodeId)
        if (leftSelected !== rightSelected) return leftSelected ? -1 : 1
        const leftName = left.entity ? entityFriendlyName(left.entity) : left.entityId
        const rightName = right.entity ? entityFriendlyName(right.entity) : right.entityId
        return leftName.localeCompare(rightName)
      })
  }, [project.bindings, project.dashboardMenu, runtime.adapter, runtime.revision, selectedNodeId])

  const showMoreInfo = (row: DashboardRow) => {
    if (onShowMoreInfo) {
      onShowMoreInfo(row.entityId)
      return
    }
    const fallbackNodeId = row.bindings[0]?.nodeId
    if (fallbackNodeId) onExpandedNodeIdChange?.(fallbackNodeId)
  }

  const quickAction = async (row: DashboardRow) => {
    const adapter = runtime.adapter
    const entity = row.entity
    if (!(adapter && entity)) return

    let service: string | null = null
    if (row.domain === 'light' || row.domain === 'switch' || row.domain === 'input_boolean') {
      service = entity.state === 'on' ? 'turn_off' : 'turn_on'
    } else if (row.domain === 'cover') {
      service =
        entity.state === 'closed' || entity.state === 'closing' ? 'open_cover' : 'close_cover'
    }

    if (!service) {
      showMoreInfo(row)
      return
    }

    setActionError(null)
    try {
      await adapter.callService({
        domain: row.domain,
        service,
        target: { entityId: row.entityId },
      })
    } catch (error) {
      setActionError(actionErrorMessage(error))
    }
  }

  const setRange = async (row: DashboardRow, value: number) => {
    const adapter = runtime.adapter
    if (!adapter) return

    let service: string | null = null
    let data: Readonly<Record<string, unknown>> | undefined

    if (row.domain === 'light') {
      service = 'turn_on'
      data = { brightness: Math.round(value) }
    } else if (row.domain === 'cover') {
      service = 'set_cover_position'
      data = { position: Math.round(value) }
    } else if (row.domain === 'number' || row.domain === 'input_number') {
      service = 'set_value'
      data = { value }
    }

    if (!service) return

    setActionError(null)
    try {
      await adapter.callService({
        domain: row.domain,
        service,
        data,
        target: { entityId: row.entityId },
      })
    } catch (error) {
      setActionError(actionErrorMessage(error))
    }
  }

  const panel = collapsed ? null : (
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
        {actionError ? (
          <div className="mb-2 rounded-2xl border border-[var(--ha3d-dashboard-error-ring)] bg-[var(--ha3d-dashboard-error-soft)] px-3 py-2 text-[var(--ha3d-dashboard-error)] text-xs">
            {actionError}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--ha3d-dashboard-border)] px-3 py-5 text-center text-[var(--ha3d-dashboard-muted)] text-xs">
            {project.dashboardMenu.mode === 'custom'
              ? 'No custom Menu tiles yet. Add them in Edit → Settings → Dashboard menu.'
              : 'No entities are linked to this scene.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {rows.map((row) => {
              const selected = row.bindings.some((entry) => entry.nodeId === selectedNodeId)
              const hasQuickAction =
                row.domain === 'light' ||
                row.domain === 'switch' ||
                row.domain === 'input_boolean' ||
                row.domain === 'cover'
              const activeLight = row.domain === 'light' && row.entity?.state === 'on'
              const range = rangeControl(row)

              return (
                <div
                  className={`${row.span === 2 ? 'col-span-2' : 'col-span-1'} rounded-2xl border p-2.5 transition-colors ${
                    selected
                      ? 'border-[var(--ha3d-dashboard-primary-ring)] bg-[var(--ha3d-dashboard-primary-soft)]'
                      : 'border-[var(--ha3d-dashboard-border)] bg-[var(--ha3d-dashboard-hover)]'
                  }`}
                  key={row.entityId}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => showMoreInfo(row)}
                      type="button"
                    >
                      <span
                        className={
                          activeLight
                            ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ha3d-dashboard-light-active-soft)] text-[var(--ha3d-dashboard-light-active)] ring-1 ring-[var(--ha3d-dashboard-light-active-ring)]'
                            : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ha3d-dashboard-surface)] text-[var(--ha3d-dashboard-muted)]'
                        }
                      >
                        <DashboardEntityIcon domain={row.domain} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-xs">
                          {row.entity ? entityFriendlyName(row.entity) : row.entityId}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--ha3d-dashboard-muted)]">
                          {row.entity ? formatHomeAssistantEntityValue(row.entity) : 'Unavailable'}
                        </span>
                      </span>
                    </button>

                    {hasQuickAction && row.entity ? (
                      <button
                        className={
                          activeLight
                            ? 'min-w-10 rounded-full bg-[var(--ha3d-dashboard-light-active-soft)] px-2.5 py-1.5 font-medium text-[10px] text-[var(--ha3d-dashboard-light-active)] ring-1 ring-[var(--ha3d-dashboard-light-active-ring)]'
                            : 'min-w-10 rounded-full bg-[var(--ha3d-dashboard-surface)] px-2.5 py-1.5 font-medium text-[10px] text-[var(--ha3d-dashboard-text)] hover:bg-[var(--ha3d-dashboard-primary-soft)] hover:text-[var(--ha3d-dashboard-primary)]'
                        }
                        onClick={() => void quickAction(row)}
                        type="button"
                      >
                        {row.domain === 'cover'
                          ? row.entity.state === 'closed' || row.entity.state === 'closing'
                            ? 'Open'
                            : 'Close'
                          : row.entity.state === 'on'
                            ? 'Off'
                            : 'On'}
                      </button>
                    ) : null}

                    {onShowMoreInfo || row.bindings[0] ? (
                      <button
                        aria-label={`More info for ${row.entityId}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-surface)] hover:text-[var(--ha3d-dashboard-text)]"
                        onClick={() => showMoreInfo(row)}
                        type="button"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  {range ? (
                    <div className="mt-2.5">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[9px] text-[var(--ha3d-dashboard-muted)]">
                        <span>
                          {row.domain === 'light'
                            ? 'Brightness'
                            : row.domain === 'cover'
                              ? 'Position'
                              : 'Value'}
                        </span>
                        <span>{range.label}</span>
                      </div>
                      <input
                        aria-label={`${row.entityId} value`}
                        className="w-full accent-[var(--ha3d-dashboard-primary)]"
                        max={range.max}
                        min={range.min}
                        onChange={(event) => void setRange(row, Number(event.currentTarget.value))}
                        step={range.step}
                        type="range"
                        value={range.value}
                      />
                    </div>
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
