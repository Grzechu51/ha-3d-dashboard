'use client'

import {
  emitter,
  getLevelDisplayName,
  type LevelNode,
  sceneRegistry,
  useScene,
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { Box3, Vector3 } from 'three'
import {
  type Ha3dDashboardCameraPreset,
  resolveHa3dDashboardCameraPose,
} from '../../lib/ha3d/dashboard-camera'
import type { Ha3dEnvironmentMode } from './ha3d-sun-environment'

const CAMERA_PRESETS: readonly { id: Ha3dDashboardCameraPreset; label: string }[] = [
  { id: 'fit', label: 'Fit' },
  { id: 'iso', label: 'Iso' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'right', label: 'Right' },
]

const ENVIRONMENT_MODES: readonly { id: Ha3dEnvironmentMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'day', label: 'Day' },
  { id: 'twilight', label: 'Dusk' },
  { id: 'night', label: 'Night' },
]

function resolveEditorBounds(levelId: string | null, solo: boolean): Box3 | null {
  const bounds = new Box3()

  if (solo && levelId) {
    const levelObject = sceneRegistry.nodes.get(levelId)
    if (levelObject) bounds.setFromObject(levelObject, true)
  } else {
    for (const [nodeId, object] of sceneRegistry.nodes) {
      if (sceneRegistry.byType.site?.has(nodeId)) continue
      bounds.expandByObject(object, true)
    }
  }

  return bounds.isEmpty() ? null : bounds
}

function levelBuildingId(level: LevelNode, nodes: ReturnType<typeof useScene.getState>['nodes']) {
  const parent = level.parentId
    ? Object.values(nodes).find((node) => node.id === level.parentId)
    : undefined
  return parent?.type === 'building' ? parent.id : null
}

export function Ha3dEditorViewportToolbar({
  environmentMode,
  onEnvironmentModeChange,
}: {
  environmentMode: Ha3dEnvironmentMode
  onEnvironmentModeChange: (mode: Ha3dEnvironmentMode) => void
}) {
  const selectedLevelId = useViewer((state) => state.selection.levelId)
  const levelMode = useViewer((state) => state.levelMode)
  const levelSignature = useSyncExternalStore(
    useScene.subscribe,
    () =>
      Object.values(useScene.getState().nodes)
        .filter((node): node is LevelNode => node.type === 'level')
        .map((level) => `${level.id}:${level.level}:${level.name ?? ''}:${level.parentId ?? ''}`)
        .sort()
        .join('|'),
    () => '',
  )

  const levels = useMemo(
    () =>
      Object.values(useScene.getState().nodes)
        .filter((node): node is LevelNode => node.type === 'level')
        .sort((left, right) => right.level - left.level),
    [levelSignature],
  )

  const requestCameraPreset = useCallback((preset: Ha3dDashboardCameraPreset) => {
    const viewer = useViewer.getState()
    const bounds = resolveEditorBounds(viewer.selection.levelId, viewer.levelMode === 'solo')
    if (!bounds) {
      emitter.emit('camera-controls:fit-scene', {})
      return
    }

    const center = bounds.getCenter(new Vector3())
    const size = bounds.getSize(new Vector3())
    const pose = resolveHa3dDashboardCameraPose(
      {
        center: [center.x, center.y, center.z],
        size: [size.x, size.y, size.z],
      },
      preset,
    )

    emitter.emit('camera-controls:apply-pose', {
      position: [...pose.position],
      target: [...pose.target],
      projection: viewer.cameraMode,
    })
  }, [])

  const showAllLevels = () => {
    useViewer.getState().setLevelMode('stacked')
    window.requestAnimationFrame(() => requestCameraPreset('fit'))
  }

  const showLevel = (level: LevelNode) => {
    const viewer = useViewer.getState()
    viewer.setSelection({
      buildingId: levelBuildingId(level, useScene.getState().nodes),
      levelId: level.id,
      zoneId: null,
      selectedIds: [],
    })
    viewer.setLevelMode('solo')
    window.requestAnimationFrame(() => requestCameraPreset('fit'))
  }

  const soloLevel = levelMode === 'solo' ? selectedLevelId : null

  return (
    <div className="pointer-events-auto flex max-w-[min(72vw,900px)] items-center gap-1.5 overflow-x-auto rounded-full border border-[var(--ha3d-dashboard-border)] bg-[var(--ha3d-dashboard-surface)] p-1.5 text-[var(--ha3d-dashboard-text)] shadow-xl backdrop-blur-xl">
      <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--ha3d-dashboard-hover)] p-1">
        <button
          aria-pressed={soloLevel === null}
          className={
            soloLevel === null
              ? 'rounded-full bg-[var(--ha3d-dashboard-primary-soft)] px-2.5 py-1.5 font-medium text-[10px] text-[var(--ha3d-dashboard-primary)] ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
              : 'rounded-full px-2.5 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
          }
          onClick={showAllLevels}
          type="button"
        >
          All
        </button>
        {levels.map((level) => {
          const active = soloLevel === level.id
          return (
            <button
              aria-pressed={active}
              className={
                active
                  ? 'rounded-full bg-[var(--ha3d-dashboard-primary-soft)] px-2.5 py-1.5 font-medium text-[10px] text-[var(--ha3d-dashboard-primary)] ring-1 ring-[var(--ha3d-dashboard-primary-ring)]'
                  : 'rounded-full px-2.5 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
              }
              key={level.id}
              onClick={() => showLevel(level)}
              type="button"
            >
              {getLevelDisplayName(level)}
            </button>
          )
        })}
      </div>

      <span className="h-5 w-px shrink-0 bg-[var(--ha3d-dashboard-border)]" />

      <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--ha3d-dashboard-hover)] p-1">
        {CAMERA_PRESETS.map((preset) => (
          <button
            className="rounded-full px-2.5 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]"
            key={preset.id}
            onClick={() => requestCameraPreset(preset.id)}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <span className="h-5 w-px shrink-0 bg-[var(--ha3d-dashboard-border)]" />

      <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--ha3d-dashboard-hover)] p-1">
        {ENVIRONMENT_MODES.map((mode) => {
          const active = environmentMode === mode.id
          return (
            <button
              aria-pressed={active}
              className={
                active
                  ? 'rounded-full bg-[var(--ha3d-dashboard-warning-soft)] px-2.5 py-1.5 font-medium text-[10px] text-[var(--ha3d-dashboard-warning)] ring-1 ring-[var(--ha3d-dashboard-warning-ring)]'
                  : 'rounded-full px-2.5 py-1.5 text-[10px] text-[var(--ha3d-dashboard-muted)] hover:bg-[var(--ha3d-dashboard-hover)] hover:text-[var(--ha3d-dashboard-text)]'
              }
              key={mode.id}
              onClick={() => onEnvironmentModeChange(mode.id)}
              type="button"
            >
              {mode.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
