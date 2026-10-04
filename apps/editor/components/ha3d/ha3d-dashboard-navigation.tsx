'use client'

import { getLevelDisplayName, type LevelNode } from '@pascal-app/core'
import type { SceneGraph } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { Camera, Layers } from 'lucide-react'
import { useMemo } from 'react'
import type { Ha3dDashboardCameraPreset } from '../../lib/ha3d/dashboard-camera'

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
}: {
  scene: SceneGraph
  onCameraPreset: (preset: Ha3dDashboardCameraPreset) => void
}) {
  const selection = useViewer((state) => state.selection)
  const levelMode = useViewer((state) => state.levelMode)
  const levels = useMemo(
    () =>
      Object.values(scene.nodes)
        .filter((node): node is LevelNode => node.type === 'level')
        .sort((left, right) => right.level - left.level),
    [scene.nodes],
  )

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
    <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-40 flex justify-center md:right-[21rem]">
      <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-black/70 p-1.5 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex h-8 w-8 items-center justify-center text-white/60">
            <Layers className="h-4 w-4" />
          </span>
          <button
            aria-pressed={levelMode !== 'solo'}
            className={
              levelMode !== 'solo'
                ? 'rounded-xl bg-white/10 px-3 py-2 font-medium text-xs text-white'
                : 'rounded-xl px-3 py-2 text-white/65 text-xs hover:bg-white/10 hover:text-white'
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
                    : 'rounded-xl px-3 py-2 text-white/65 text-xs hover:bg-white/10 hover:text-white'
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
              className="rounded-xl px-3 py-2 text-white/65 text-xs hover:bg-white/10 hover:text-white"
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
