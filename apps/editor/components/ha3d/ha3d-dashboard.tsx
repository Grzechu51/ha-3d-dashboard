'use client'

import {
  acquireSceneReadOnlyLease,
  applySceneGraphToEditor,
  createLocalProjectPresentationPersistence,
  type SceneGraph,
  useScene,
} from '@pascal-app/editor'
import {
  SceneEnvironment,
  useViewer,
  Viewer,
  ViewerPresentations,
} from '@pascal-app/viewer'
import { OrbitControls } from '@react-three/drei'
import Link from 'next/link'
import { useLayoutEffect, useState } from 'react'
import { Ha3dDashboardControls } from './ha3d-dashboard-controls'

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

  useLayoutEffect(() => {
    const persistence = createLocalProjectPresentationPersistence()
    persistence.switchProject(projectId)
    setPresentationsReady(true)

    return () => {
      setPresentationsReady(false)
      persistence.dispose()
    }
  }, [projectId])

  useLayoutEffect(() => {
    const releaseReadOnly = acquireSceneReadOnlyLease()
    useViewer.getState().setProjectId(projectId)
    useScene.getState().unloadScene()
    applySceneGraphToEditor(scene)
    useViewer.getState().resetSelection()
    setSceneHydrated(true)
    setViewerReady(false)

    return () => {
      setSceneHydrated(false)
      setViewerReady(false)
      useViewer.getState().resetSelection()
      useScene.getState().unloadScene()
      useViewer.getState().setProjectId(null)
      releaseReadOnly()
    }
  }, [projectId, scene])

  return (
    <main className="dark relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {sceneHydrated ? (
        <Viewer
          defaultRender={{ shading: 'solid' }}
          onSceneReadyChange={setViewerReady}
          renderContext="viewer"
          sceneReadyKey={`${meta.id}:${meta.version}`}
          selectionManager="custom"
        >
          <SceneEnvironment />
          <OrbitControls enableDamping makeDefault />
          {presentationsReady ? <ViewerPresentations /> : null}
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

      <Ha3dDashboardControls />

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
