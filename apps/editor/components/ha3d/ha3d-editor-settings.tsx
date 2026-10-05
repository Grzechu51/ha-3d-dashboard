'use client'

import { useScene } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import {
  ArrowDown,
  ArrowUp,
  Box,
  Columns2,
  Download,
  LayoutGrid,
  PackagePlus,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { type ReactNode, useMemo, useState, useSyncExternalStore } from 'react'
import { entityFriendlyName } from '../../lib/ha3d/entity-display'
import {
  addDashboardMenuItem,
  getHa3dProjectConfigSnapshot,
  moveDashboardMenuItem,
  removeDashboardMenuItem,
  setDashboardMenuMode,
  subscribeHa3dProjectConfig,
  updateDashboardMenuItem,
} from '../../lib/ha3d/project-config'
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
          ? 'rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-left text-cyan-100 text-sm'
          : 'rounded-lg border border-border bg-background/60 px-3 py-2 text-left text-muted-foreground text-sm hover:bg-accent hover:text-foreground'
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
  const projectConfig = useSyncExternalStore(
    subscribeHa3dProjectConfig,
    getHa3dProjectConfigSnapshot,
    getHa3dProjectConfigSnapshot,
  )
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [menuEntityId, setMenuEntityId] = useState('')

  const entities = useMemo(
    () =>
      [...(runtime.adapter?.listEntities() ?? [])].sort((left, right) =>
        entityFriendlyName(left).localeCompare(entityFriendlyName(right)),
      ),
    [runtime.adapter, runtime.revision],
  )
  const entityCount = entities.length
  const menuEntityIds = useMemo(
    () => new Set(projectConfig.dashboardMenu.items.map((item) => item.entityId)),
    [projectConfig.dashboardMenu.items],
  )
  const availableMenuEntities = useMemo(
    () => entities.filter((entity) => !menuEntityIds.has(entity.entityId)),
    [entities, menuEntityIds],
  )

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
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-cyan-300" />
          <div className="font-medium text-sm">Dashboard menu</div>
        </div>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          Automatic mode lists entities bound to 3D objects. Custom mode builds a Home
          Assistant-style tile grid from any live HA entities, even when they are not linked to a
          3D object.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ToggleButton
            active={projectConfig.dashboardMenu.mode === 'auto'}
            onClick={() => setDashboardMenuMode('auto')}
          >
            Automatic
          </ToggleButton>
          <ToggleButton
            active={projectConfig.dashboardMenu.mode === 'custom'}
            onClick={() => setDashboardMenuMode('custom')}
          >
            Custom tiles
          </ToggleButton>
        </div>

        {projectConfig.dashboardMenu.mode === 'custom' ? (
          <>
            <div className="mt-3 flex gap-2">
              <select
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
                onChange={(event) => setMenuEntityId(event.currentTarget.value)}
                value={menuEntityId}
              >
                <option value="">Choose Home Assistant entity…</option>
                {availableMenuEntities.map((entity) => (
                  <option key={entity.entityId} value={entity.entityId}>
                    {entityFriendlyName(entity)} · {entity.entityId}
                  </option>
                ))}
              </select>
              <button
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-xs disabled:opacity-40"
                disabled={!menuEntityId}
                onClick={() => {
                  if (!menuEntityId) return
                  addDashboardMenuItem(menuEntityId)
                  setMenuEntityId('')
                }}
                type="button"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {projectConfig.dashboardMenu.items.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground text-xs">
                Add entities to build the Menu tile layout.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {projectConfig.dashboardMenu.items.map((item, index) => {
                  const entity = runtime.adapter?.getEntity(item.entityId)
                  return (
                    <div
                      className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-2"
                      key={item.entityId}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-xs">
                          {entity ? entityFriendlyName(entity) : item.entityId}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {item.entityId}
                        </div>
                      </div>

                      <button
                        aria-label="Use half width tile"
                        aria-pressed={item.span === 1}
                        className={
                          item.span === 1
                            ? 'flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25'
                            : 'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground'
                        }
                        onClick={() => updateDashboardMenuItem(item.entityId, { span: 1 })}
                        title="Half width"
                        type="button"
                      >
                        <Columns2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label="Use full width tile"
                        aria-pressed={item.span === 2}
                        className={
                          item.span === 2
                            ? 'flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary/15 px-2 text-primary ring-1 ring-primary/25'
                            : 'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-muted-foreground hover:bg-accent hover:text-foreground'
                        }
                        onClick={() => updateDashboardMenuItem(item.entityId, { span: 2 })}
                        title="Full width"
                        type="button"
                      >
                        2
                      </button>
                      <button
                        aria-label="Move tile up"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-25"
                        disabled={index === 0}
                        onClick={() => moveDashboardMenuItem(item.entityId, -1)}
                        type="button"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label="Move tile down"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-25"
                        disabled={index === projectConfig.dashboardMenu.items.length - 1}
                        onClick={() => moveDashboardMenuItem(item.entityId, 1)}
                        type="button"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label="Remove tile"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeDashboardMenuItem(item.entityId)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="mt-3 text-muted-foreground text-[10px] leading-relaxed">
              Half-width tiles can sit side by side. Full-width tiles expose richer inline controls
              where the entity supports them.
            </p>
          </>
        ) : null}
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
            <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
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
            className="mt-2 w-full accent-cyan-400"
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
            className="mt-2 w-full accent-cyan-400"
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
          <Download className="h-4 w-4 text-cyan-300" />
          <div className="font-medium text-sm">Export</div>
        </div>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          Pascal JSON keeps the editable scene structure and can be imported into Pascal. Model
          exports are flattened geometry for other 3D software.
        </p>

        <button
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-cyan-400/30 bg-cyan-400/5 px-3 py-2 text-left text-sm hover:bg-cyan-400/10"
          onClick={exportPascalJson}
          type="button"
        >
          <span>
            <span className="block font-medium text-cyan-100">Pascal project JSON</span>
            <span className="block text-[10px] text-muted-foreground">Editable scene graph</span>
          </span>
          <Download className="h-4 w-4 text-cyan-300" />
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
          <Box className="h-4 w-4 text-cyan-300" />
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
