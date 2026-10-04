'use client'

import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'

export type Ha3dEnvironmentMode = 'auto' | 'day' | 'twilight' | 'night'

function finiteAttribute(
  entity: { attributes: Readonly<Record<string, unknown>> } | undefined,
  key: string,
): number | null {
  const value = entity?.attributes[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function environmentThemeFor(
  mode: Ha3dEnvironmentMode,
  solarElevation: number | null,
): 'studio' | 'sunset' | 'twilight' | 'night' {
  if (mode === 'day') return 'studio'
  if (mode === 'twilight') return 'twilight'
  if (mode === 'night') return 'night'

  if (solarElevation === null) return 'studio'
  if (solarElevation <= -6) return 'night'
  if (solarElevation <= 2) return 'twilight'
  if (solarElevation <= 9) return 'sunset'
  return 'studio'
}

function solarDirection(azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const azimuth = (azimuthDeg * Math.PI) / 180
  const elevation = (elevationDeg * Math.PI) / 180
  const horizontal = Math.cos(elevation)
  // Home Assistant: 0° north, 90° east. Pascal world: north = -Z, east = +X.
  return [Math.sin(azimuth) * horizontal, Math.sin(elevation), -Math.cos(azimuth) * horizontal]
}

export function Ha3dSunEnvironment({ mode }: { mode: Ha3dEnvironmentMode }) {
  const runtime = useSyncExternalStore(
    subscribeHomeAssistantRuntime,
    getHomeAssistantRuntimeSnapshot,
    getHomeAssistantRuntimeSnapshot,
  )
  const previousThemeRef = useRef<string | null>(null)
  const sun = runtime.adapter?.getEntity('sun.sun')
  const elevation = finiteAttribute(sun, 'elevation')
  const azimuth = finiteAttribute(sun, 'azimuth')
  const theme = environmentThemeFor(mode, elevation)

  useEffect(() => {
    const viewer = useViewer.getState()
    if (previousThemeRef.current === null) previousThemeRef.current = viewer.sceneTheme
    if (viewer.sceneTheme !== theme) viewer.setSceneTheme(theme)
  }, [theme])

  useEffect(
    () => () => {
      const previous = previousThemeRef.current
      if (previous) useViewer.getState().setSceneTheme(previous)
    },
    [],
  )

  const light = useMemo(() => {
    if (mode !== 'auto' || elevation === null || azimuth === null) return null
    if (elevation <= -6) return null

    const direction = solarDirection(azimuth, elevation)
    const distance = 45
    const twilight = elevation < 6
    return {
      position: direction.map((value) => value * distance) as [number, number, number],
      intensity: twilight ? 0.55 : 1.35,
      color: twilight ? '#ffb47a' : '#fff3d2',
    }
  }, [azimuth, elevation, mode])

  return light ? (
    <directionalLight
      castShadow
      color={light.color}
      intensity={light.intensity}
      position={light.position}
    />
  ) : null
}
