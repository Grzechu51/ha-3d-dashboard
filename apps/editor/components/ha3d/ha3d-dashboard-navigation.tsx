'use client'

import { getLevelDisplayName, type LevelNode } from '@pascal-app/core'
import type { SceneGraph } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { Camera, Layers, Menu } from 'lucide-react'
import { type CSSProperties, useMemo } from 'react'
import type { Ha3dDashboardCameraPreset } from '../../lib/ha3d/dashboard-camera'

function isLevelNode(node: unknown): node is LevelNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type?: unknown }).type === 'level'
  )
}

const CAMERA_PRESETS: readonly { id: Ha3dDashboardCameraPreset; label: string }[] = [
  { id: 'fit', label: 'Fit' },
  { id: 'iso', label: 'Iso' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'right', label: 'Right' },
]

export function Ha3dDashboardNavigation({
  scene,
  onCameraPreset,
  controlsCollapsed = false,
  controlsPanelHeight = 0,
  onControlsCollapsedChange,
}: {
  scene: SceneGraph
  onCameraPreset: (preset: Ha3dDashboardCameraPreset) => void
  controlsCollapsed?: boolean
  controlsPanelHeight?: number
  onControlsCollapsedChange?: (collapsed: boolean) => void
}) {
  const selection = useViewer((state) => state.selection)
  const levelMode = useViewer((state) => state.levelMode)
  const levels = useMemo(
    () =>
      Object.values(scene.nodes)
        .filter(isLevelNode)
        .sort((left, right) => right.level - left.level),
    [scene.nodes],
  )

  const mobileBottom = controlsCollapsed
    ? 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)'
    : `${Math.max(Math.ceil(controlsPanelHeight) + 24, 88)}px`
  const navigationStyle = {
    '--ha3d-dashboard-nav-bottom': mobileBottom,
  } as CSSProperties

  const showAllFloors = () => {
    const viewer = useViewer.getState()
    viewer.setLevelMode('stacked')
    viewer.setSelection({
      levelId: null,
      zoneId: null,
      selectedIds: [],
    })
    onCameraPreset('fit')
  }

  const showFloor = (level: LevelNode) => {
    const viewer = useViewer.getState()
    viewer.setLevelMode('solo')
    viewer.setSelection({
      levelId: level.id,
      zoneId: null,
      selectedIds: [],
    })
    onCameraPreset('fit')
  }

  return (
    <div
      className={`pointer-events-none absolute right-3 bottom-[var(--ha3d-dashboard-nav-bottom)] left-3 z-40 flex justify-center transition-[bottom] duration-200 md:bottom-3 ${controlsCollapsed ? 'md:right-3' : 'md:right-[22rem]'}`}
      style={navigationStyle}
    >
      <div className="pointer-events-auto flex max-w-full items-center overflow-hidden rounded-full border border-[var(--ha3d-dashboard-border)] bg-[var(--ha3d-dashboard-surface)] p-1.5 text-[var(--ha3d-dashboard-text)] shadow-2xl backdrop-blur-xl">
        {onControlsCollapsedChange ? (
          <>
            <button
              aria-label={controlsCollapsed ? 'Open menu' : 'Close menu'}
              aria-pressed={!controlsCollapsed}
              className={
                controlsCollapsed
                  ? 'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[var(--ha3d-dashboard-muted)] text-xs hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
                  : 'flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--ha3d-dashboard-primary-soft)] px-2.5 font-medium text-[var(--ha3d-dashboard-primary)] text-xs ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
              }
              onClick={() => onControlsCollapsedChange(!controlsCollapsed)}
              type="button"
            >
              <Menu className="h-4 w-4" />
              Menu
            </button>
            <div className="mx-1.5 h-6 w-px shrink-0 bg-[var(--ha3d-dashboard-border)]" />
          </>
        ) : null}

        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-1">
            <span className="flex h-8 w-8 items-center justify-center text-[var(--ha3d-dashboard-muted)]">
              <Layers className="h-4 w-4" />
            </span>
            <button
              aria-pressed={levelMode !== 'solo'}
              className={
                levelMode !== 'solo'
                  ? 'rounded-full bg-[var(--ha3d-dashboard-primary-soft)] px-3 py-2 font-medium text-[var(--ha3d-dashboard-primary)] text-xs ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
                  : 'rounded-full px-3 py-2 text-[var(--ha3d-dashboard-muted)] text-xs hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
              }
              onClick={showAllFloors}
              type="button"
            >
              All
            </button>
            {levels.map((level) => {
              const active = levelMode === 'solo' && selection.levelId === level.id
              return (
                <button
                  aria-pressed={active}
                  className={
                    active
                      ? 'rounded-full bg-[var(--ha3d-dashboard-primary-soft)] px-3 py-2 font-medium text-[var(--ha3d-dashboard-primary)] text-xs ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
                      : 'rounded-full px-3 py-2 text-[var(--ha3d-dashboard-muted)] text-xs hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
                  }
                  key={level.id}
                  onClick={() => showFloor(level)}
                  type="button"
                >
                  {getLevelDisplayName(level)}
                </button>
              )
            })}
          </div>

          <div className="mx-1 h-6 w-px shrink-0 bg-[var(--ha3d-dashboard-border)]" />

          <div className="flex shrink-0 items-center gap-1">
            <span className="flex h-8 w-8 items-center justify-center text-[var(--ha3d-dashboard-muted)]">
              <Camera className="h-4 w-4" />
            </span>
            {CAMERA_PRESETS.map((preset) => (
              <button
                className="rounded-full px-3 py-2 text-[var(--ha3d-dashboard-muted)] text-xs hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]"
                key={preset.id}
                onClick={() => onCameraPreset(preset.id)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
