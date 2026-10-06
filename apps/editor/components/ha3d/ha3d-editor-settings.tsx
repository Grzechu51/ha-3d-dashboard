'use client'

import { useScene } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import {
  Box,
  Download,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import { type ReactNode, useState, useSyncExternalStore } from 'react'
import {
  getHa3dDashboardAppearanceServerSnapshot,
  getHa3dDashboardAppearanceSnapshot,
  resetHa3dDashboardAppearance,
  subscribeHa3dDashboardAppearance,
  updateHa3dDashboardAppearance,
} from '../../lib/ha3d/dashboard-appearance'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className={
        active
          ? 'rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-left text-primary text-sm'
          : 'rounded-xl border border-border bg-background/60 px-3 py-2 text-left text-muted-foreground text-sm hover:bg-accent hover:text-foreground'
      }
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function exportPascalJson() {
  const scene = useScene.getState()
  const graph = {
    nodes: scene.nodes,
    rootNodeIds: scene.rootNodeIds,
    collections: scene.collections,
    materials: scene.materials,
    installedPlugins: scene.installedPlugins,
  }
  const projectId = useViewer.getState().projectId ?? 'project'
  const safeId = projectId.replace(/[^a-z0-9_-]+/gi, '-')
  downloadBlob(
    new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' }),
    `ha3d-${safeId}.json`,
  )
}

export function Ha3dEditorSettings() {
  const shadows = useViewer((state) => state.shadows)
  const textures = useViewer((state) => state.textures)
  const cameraMode = useViewer((state) => state.cameraMode)
  const modelExport = useEditor((state) => state.modelExport)
  const runtime = useSyncExternalStore(
    subscribeHomeAssistantRuntime,
    getHomeAssistantRuntimeSnapshot,
    getHomeAssistantRuntimeSnapshot,
  )
  const dashboardAppearance = useSyncExternalStore(
    subscribeHa3dDashboardAppearance,
    getHa3dDashboardAppearanceSnapshot,
    getHa3dDashboardAppearanceServerSnapshot,
  )
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const entityCount = runtime.adapter?.listEntities().length ?? 0

  const refreshEntities = async () => {
    const refresh = runtime.adapter?.refreshEntities
    if (!refresh || refreshing) return

    setRefreshing(true)
    setRefreshError(null)
    try {
      await refresh.call(runtime.adapter)
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Entity refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const exportModel = async (format: 'glb' | 'obj' | 'stl') => {
    if (!(modelExport && !exporting)) return

    setExporting(format)
    setExportError(null)
    try {
      await modelExport(format, { download: true, onlyVisible: false })
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : `${format.toUpperCase()} export failed`,
      )
    } finally {
      setExporting(null)
    }
  }

  const openCustomObjects = () => {
    const editor = useEditor.getState()
    editor.setPhase('furnish')
    editor.setActiveSidebarPanel('items')
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div>
        <h2 className="font-semibold text-base">Settings</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Project tools and display options for the Home Assistant editor.
        </p>
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card/70 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium text-sm">Home Assistant</div>
            <div className="mt-1 text-muted-foreground text-xs">
              {runtime.connected ? `Connected · ${entityCount} live entities` : 'Not connected'}
            </div>
          </div>
          <button
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!runtime.adapter?.refreshEntities || refreshing}
            onClick={() => void refreshEntities()}
            type="button"
          >
            <RefreshCw className={refreshing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
          Entity states update live. Refresh forces a new entity inventory after adding or renaming
          helpers and integrations.
        </p>
        {refreshError ? <p className="mt-2 text-destructive text-xs">{refreshError}</p> : null}
      </section>

      <section className="mt-3 rounded-xl border border-border bg-card/70 p-3">
        <div className="font-medium text-sm">Editor view</div>
        <p className="mt-1 text-muted-foreground text-xs">
          Rendering controls that affect the working 3D view.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ToggleButton active={shadows} onClick={() => useViewer.getState().setShadows(!shadows)}>
            Shadows
          </ToggleButton>
          <ToggleButton
            active={textures}
            onClick={() => useViewer.getState().setTextures(!textures)}
          >
            Materials
          </ToggleButton>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-muted-foreground text-[10px] uppercase tracking-wide">
            Camera projection
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ToggleButton
              active={cameraMode === 'perspective'}
              onClick={() => useViewer.getState().setCameraMode('perspective')}
            >
              Perspective
            </ToggleButton>
            <ToggleButton
              active={cameraMode === 'orthographic'}
              onClick={() => useViewer.getState().setCameraMode('orthographic')}
            >
              Orthographic
            </ToggleButton>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-border bg-card/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <div className="font-medium text-sm">Dashboard labels</div>
          </div>
          <button
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
            onClick={resetHa3dDashboardAppearance}
            type="button"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          Tune the floating Home Assistant labels shown over linked 3D objects.
        </p>

        <label className="mt-3 block">
          <span className="flex items-center justify-between gap-3 text-xs">
            <span>Background opacity</span>
            <span className="text-muted-foreground">
              {Math.round(dashboardAppearance.labelOpacity * 100)}%
            </span>
          </span>
          <input
            className="mt-2 w-full accent-primary"
            max="0.95"
            min="0.35"
            onChange={(event) =>
              updateHa3dDashboardAppearance({ labelOpacity: Number(event.currentTarget.value) })
            }
            step="0.05"
            type="range"
            value={dashboardAppearance.labelOpacity}
          />
        </label>

        <label className="mt-3 block">
          <span className="flex items-center justify-between gap-3 text-xs">
            <span>Corner radius</span>
            <span className="text-muted-foreground">{dashboardAppearance.labelRadiusPx}px</span>
          </span>
          <input
            className="mt-2 w-full accent-primary"
            max="24"
            min="4"
            onChange={(event) =>
              updateHa3dDashboardAppearance({ labelRadiusPx: Number(event.currentTarget.value) })
            }
            step="1"
            type="range"
            value={dashboardAppearance.labelRadiusPx}
          />
        </label>

        <p className="mt-2 text-muted-foreground text-[10px] leading-relaxed">
          These display preferences are stored locally in this browser and do not alter the shared
          HA project.
        </p>
      </section>

      <section className="mt-3 rounded-xl border border-border bg-card/70 p-3">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <div className="font-medium text-sm">Export</div>
        </div>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          Pascal JSON keeps the editable scene structure and can be imported into Pascal. Model
          exports are flattened geometry for other 3D software.
        </p>

        <button
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left text-sm hover:bg-primary/10"
          onClick={exportPascalJson}
          type="button"
        >
          <span>
            <span className="block font-medium text-primary">Pascal project JSON</span>
            <span className="block text-[10px] text-muted-foreground">Editable scene graph</span>
          </span>
          <Download className="h-4 w-4 text-primary" />
        </button>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {(['glb', 'obj', 'stl'] as const).map((format) => (
            <button
              className="rounded-lg border border-border bg-background/60 px-2 py-2 font-medium text-xs uppercase hover:bg-accent disabled:cursor-wait disabled:opacity-50"
              disabled={!modelExport || exporting !== null}
              key={format}
              onClick={() => void exportModel(format)}
              type="button"
            >
              {exporting === format ? 'Exporting…' : format}
            </button>
          ))}
        </div>
        {exportError ? <p className="mt-2 text-destructive text-xs">{exportError}</p> : null}
      </section>

      <section className="mt-3 rounded-xl border border-border bg-card/70 p-3">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-primary" />
          <div className="font-medium text-sm">Custom objects</div>
        </div>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          Open Items and use the first <strong>Add GLB</strong> tile to place your own model. The
          imported GLB is cached in this browser; the scene keeps its reference when the HA project
          is saved.
        </p>
        <button
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm hover:bg-accent"
          onClick={openCustomObjects}
          type="button"
        >
          <PackagePlus className="h-4 w-4" />
          Open Items / Add GLB
        </button>
      </section>

      <section className="mt-3 rounded-xl border border-border bg-card/70 p-3">
        <div className="font-medium text-sm">Project storage</div>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          The editable scene and Home Assistant bindings are stored by the HA 3D integration.
          Project export is available above; Pascal cloud sharing and internal scene diagnostics
          remain hidden from this embedded interface.
        </p>
      </section>
    </div>
  )
}
