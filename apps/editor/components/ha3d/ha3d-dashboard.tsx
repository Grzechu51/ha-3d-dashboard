'use client'

import {
  acquireSceneReadOnlyLease,
  applySceneGraphToEditor,
  type SceneGraph,
  useScene,
} from '@pascal-app/editor'
import { SceneEnvironment, useViewer, Viewer, ViewerPresentations } from '@pascal-app/viewer'
import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { restoreHa3dDashboardProjectConfig } from '../../lib/ha3d/dashboard-persistence'
import { resetHa3dProjectConfig } from '../../lib/ha3d/project-config'
import {
  Ha3dDashboardCameraControls,
  type Ha3dDashboardCameraRequest,
} from './ha3d-dashboard-camera'
import { Ha3dDashboardControls } from './ha3d-dashboard-controls'
import {
  HA3D_INTERACTIVE_HOVER_STYLES,
  Ha3dDashboardInteractions,
} from './ha3d-dashboard-interactions'
import { Ha3dDashboardNavigation } from './ha3d-dashboard-navigation'
import { type Ha3dEnvironmentMode, Ha3dSunEnvironment } from './ha3d-sun-environment'

export interface Ha3dDashboardSceneMeta {
  id: string
  name: string
  projectId: string | null
  version: number
}

interface Ha3dDashboardProps {
  scene: SceneGraph
  meta: Ha3dDashboardSceneMeta
}

export function Ha3dDashboard({ scene, meta }: Ha3dDashboardProps) {
  const projectId = meta.projectId ?? 'default'
  const [sceneHydrated, setSceneHydrated] = useState(false)
  const [presentationsReady, setPresentationsReady] = useState(false)
  const [viewerReady, setViewerReady] = useState(false)
  const [selectedInteractiveNodeId, setSelectedInteractiveNodeId] = useState<string | null>(null)
  const [expandedInteractiveNodeId, setExpandedInteractiveNodeId] = useState<string | null>(null)
  const [interactiveHighlights, setInteractiveHighlights] = useState(true)
  const [interactiveMarkers, setInteractiveMarkers] = useState(true)
  const [environmentMode, setEnvironmentMode] = useState<Ha3dEnvironmentMode>('auto')
  const [cameraRequest, setCameraRequest] = useState<Ha3dDashboardCameraRequest | null>(null)

  const requestCameraPreset = useCallback((preset: Ha3dDashboardCameraRequest['preset']) => {
    setCameraRequest((current) => ({
      id: (current?.id ?? 0) + 1,
      preset,
    }))
  }, [])

  useLayoutEffect(() => {
    restoreHa3dDashboardProjectConfig(projectId)
    setPresentationsReady(true)

    return () => {
      setPresentationsReady(false)
      resetHa3dProjectConfig()
    }
  }, [projectId])

  useLayoutEffect(() => {
    const releaseReadOnly = acquireSceneReadOnlyLease()
    const previousLevelMode = useViewer.getState().levelMode
    useViewer.getState().setProjectId(projectId)
    useScene.getState().unloadScene()
    applySceneGraphToEditor(scene)
    useViewer.getState().resetSelection()
    useViewer.getState().setLevelMode('stacked')
    setSceneHydrated(true)
    setViewerReady(false)
    setSelectedInteractiveNodeId(null)
    setExpandedInteractiveNodeId(null)

    return () => {
      setSceneHydrated(false)
      setViewerReady(false)
      setSelectedInteractiveNodeId(null)
      setExpandedInteractiveNodeId(null)
      useViewer.getState().resetSelection()
      useScene.getState().unloadScene()
      useViewer.getState().setLevelMode(previousLevelMode)
      useViewer.getState().setProjectId(null)
      releaseReadOnly()
    }
  }, [projectId, scene])

  useEffect(() => {
    if (!viewerReady) return
    requestCameraPreset('fit')
  }, [requestCameraPreset, viewerReady])

  return (
    <main className="dark relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {sceneHydrated ? (
        <Viewer
          defaultRender={{ shading: 'solid' }}
          hoverStyles={HA3D_INTERACTIVE_HOVER_STYLES}
          onSceneReadyChange={setViewerReady}
          renderContext="viewer"
          sceneReadyKey={`${meta.id}:${meta.version}`}
          selectionManager="custom"
        >
          <SceneEnvironment />
          <Ha3dDashboardCameraControls request={cameraRequest} />
          {presentationsReady ? <ViewerPresentations /> : null}
          <Ha3dSunEnvironment mode={environmentMode} />
          <Ha3dDashboardInteractions
            expandedNodeId={expandedInteractiveNodeId}
            highlightsEnabled={interactiveHighlights}
            markersEnabled={interactiveMarkers}
            onExpandedNodeIdChange={setExpandedInteractiveNodeId}
            onSelectedNodeIdChange={setSelectedInteractiveNodeId}
            selectedNodeId={selectedInteractiveNodeId}
          />
        </Viewer>
      ) : null}

      <div className="pointer-events-none absolute top-3 right-3 left-3 z-40 flex items-start justify-between gap-3 md:right-[21rem]">
        <div className="min-w-0 rounded-xl border border-border/70 bg-background/90 px-3 py-2 shadow-lg backdrop-blur">
          <div className="truncate font-semibold text-sm">{meta.name}</div>
          <div className="text-muted-foreground text-[10px]">Dashboard · read-only scene</div>
        </div>
        <Link
          className="pointer-events-auto shrink-0 rounded-xl border border-border/70 bg-background/90 px-3 py-2 font-medium text-xs shadow-lg backdrop-blur hover:bg-accent"
          href={`/scene/${meta.id}`}
        >
          Open editor
        </Link>
      </div>

      <Ha3dDashboardNavigation onCameraPreset={requestCameraPreset} scene={scene} />

      <Ha3dDashboardControls
        environmentMode={environmentMode}
        expandedNodeId={expandedInteractiveNodeId}
        highlightsEnabled={interactiveHighlights}
        markersEnabled={interactiveMarkers}
        onEnvironmentModeChange={setEnvironmentMode}
        onExpandedNodeIdChange={setExpandedInteractiveNodeId}
        onHighlightsEnabledChange={setInteractiveHighlights}
        onMarkersEnabledChange={setInteractiveMarkers}
        selectedNodeId={selectedInteractiveNodeId}
      />

      {!(sceneHydrated && viewerReady && presentationsReady) ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <div className="rounded-xl border border-border/70 bg-background px-4 py-3 text-muted-foreground text-sm shadow-xl">
            Loading dashboard…
          </div>
        </div>
      ) : null}
    </main>
  )
}
