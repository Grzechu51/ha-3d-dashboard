'use client'

import { getLevelDisplayName, type LevelNode } from '@pascal-app/core'
import type { SceneGraph } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { Camera, Layers } from 'lucide-react'
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
}: {
  scene: SceneGraph
  onCameraPreset: (preset: Ha3dDashboardCameraPreset) => void
  controlsCollapsed?: boolean
  controlsPanelHeight?: number
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
    ? '4.75rem'
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
      className="pointer-events-none absolute right-3 bottom-[var(--ha3d-dashboard-nav-bottom)] left-3 z-40 flex justify-center transition-[bottom] duration-200 md:right-[22rem] md:bottom-3"
      style={navigationStyle}
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/75 p-1.5 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex h-8 w-8 items-center justify-center text-white/60">
            <Layers className="h-4 w-4" />
          </span>
          <button
            aria-pressed={levelMode !== 'solo'}
            className={
              levelMode !== 'solo'
                ? 'rounded-xl bg-cyan-400/15 px-3 py-2 font-medium text-cyan-100 text-xs ring-1 ring-cyan-300/20'
                : 'rounded-xl px-3 py-2 text-white/55 text-xs hover:bg-white/10 hover:text-white'
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
                    ? 'rounded-xl bg-cyan-400/20 px-3 py-2 font-medium text-cyan-200 text-xs ring-1 ring-cyan-300/30'
                    : 'rounded-xl px-3 py-2 text-white/55 text-xs hover:bg-white/10 hover:text-white'
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

        <div className="mx-1 h-6 w-px shrink-0 bg-white/10" />

        <div className="flex shrink-0 items-center gap-1">
          <span className="flex h-8 w-8 items-center justify-center text-white/60">
            <Camera className="h-4 w-4" />
          </span>
          {CAMERA_PRESETS.map((preset) => (
            <button
              className="rounded-xl px-3 py-2 text-white/55 text-xs hover:bg-white/10 hover:text-white"
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
  )
}
