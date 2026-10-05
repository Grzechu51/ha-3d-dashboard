'use client'

import { sceneRegistry } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { CameraControls, type CameraControlsImpl } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { Box3, type Object3D, Vector3 } from 'three'
import {
  type Ha3dDashboardCameraPreset,
  resolveHa3dDashboardCameraPose,
} from '../../lib/ha3d/dashboard-camera'

export type Ha3dDashboardCameraRequest = Readonly<{
  id: number
  preset: Ha3dDashboardCameraPreset
}>

const dashboardBounds = new Box3()
const dashboardCenter = new Vector3()
const dashboardSize = new Vector3()

function belongsToSiteSubtree(object: Object3D, siteObjects: ReadonlySet<Object3D>): boolean {
  let current: Object3D | null = object
  while (current) {
    if (siteObjects.has(current)) return true
    current = current.parent
  }
  return false
}

function resolveDashboardBounds(levelId: string | null, solo: boolean): Box3 | null {
  dashboardBounds.makeEmpty()

  if (solo && levelId) {
    const levelObject = sceneRegistry.nodes.get(levelId)
    if (levelObject) dashboardBounds.setFromObject(levelObject)
  } else {
    const siteObjects = new Set<Object3D>()
    for (const siteId of sceneRegistry.byType.site ?? []) {
      const siteObject = sceneRegistry.nodes.get(siteId)
      if (siteObject) siteObjects.add(siteObject)
    }

    for (const object of sceneRegistry.nodes.values()) {
      if (belongsToSiteSubtree(object, siteObjects)) continue
      dashboardBounds.expandByObject(object)
    }
  }

  return dashboardBounds.isEmpty() ? null : dashboardBounds
}

export function Ha3dDashboardCameraControls({
  request,
}: {
  request: Ha3dDashboardCameraRequest | null
}) {
  const controls = useRef<CameraControlsImpl | null>(null)
  const selectedLevelId = useViewer((state) => state.selection.levelId)
  const levelMode = useViewer((state) => state.levelMode)

  useEffect(() => {
    if (!(request && controls.current)) return

    const bounds = resolveDashboardBounds(selectedLevelId, levelMode === 'solo')
    if (!bounds) {
      void controls.current.setLookAt(10, 10, 10, 0, 0, 0, true)
      return
    }

    bounds.getCenter(dashboardCenter)
    bounds.getSize(dashboardSize)
    const pose = resolveHa3dDashboardCameraPose(
      {
        center: [dashboardCenter.x, dashboardCenter.y, dashboardCenter.z],
        size: [dashboardSize.x, dashboardSize.y, dashboardSize.z],
      },
      request.preset,
    )

    void controls.current.setLookAt(
      pose.position[0],
      pose.position[1],
      pose.position[2],
      pose.target[0],
      pose.target[1],
      pose.target[2],
      true,
    )
  }, [levelMode, request, selectedLevelId])

  return (
    <CameraControls
      makeDefault
      maxDistance={250}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minDistance={0.5}
      ref={controls}
      smoothTime={0.35}
    />
  )
}
