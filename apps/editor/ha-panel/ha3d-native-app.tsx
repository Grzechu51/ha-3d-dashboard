import { validateBuildJson } from '@pascal-app/core'
import {
  acquireSceneReadOnlyLease,
  applySceneGraphToEditor,
  Editor,
  ItemsPanel,
  type SaveStatus,
  type SceneGraph,
  type SidebarTab,
  useScene,
} from '@pascal-app/editor'
import { SceneEnvironment, useViewer, Viewer, ViewerPresentations } from '@pascal-app/viewer'
import { Hammer, Layers, Package, Settings } from 'lucide-react'
import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { BuildTab } from '../components/build-tab'
import {
  Ha3dDashboardCameraControls,
  type Ha3dDashboardCameraRequest,
} from '../components/ha3d/ha3d-dashboard-camera'
import { Ha3dDashboardControls } from '../components/ha3d/ha3d-dashboard-controls'
import {
  HA3D_INTERACTIVE_HOVER_STYLES,
  Ha3dDashboardInteractions,
} from '../components/ha3d/ha3d-dashboard-interactions'
import { Ha3dDashboardNavigation } from '../components/ha3d/ha3d-dashboard-navigation'
import { Ha3dCustomObjectTile } from '../components/ha3d/ha3d-custom-object-tile'
import { Ha3dEditorSettings } from '../components/ha3d/ha3d-editor-settings'
import { Ha3dEditorViewportToolbar } from '../components/ha3d/ha3d-editor-viewport-toolbar'
import { Ha3dStructureManager } from '../components/ha3d/ha3d-structure-manager'
import {
  type Ha3dEnvironmentMode,
  Ha3dSunEnvironment,
} from '../components/ha3d/ha3d-sun-environment'
import type { HomeAssistantHassLike } from '../lib/ha3d/hass-adapter'
import {
  createHomeAssistantProject,
  deleteHomeAssistantProject,
  type Ha3dProjectMetadata,
  type HomeAssistantProjectApiHost,
  homeAssistantProjectApiErrorCode,
  listHomeAssistantProjects,
  saveHomeAssistantProject,
} from '../lib/ha3d/project-api'
import {
  clearLastProjectId,
  readLastProjectId,
  writeLastProjectId,
} from '../lib/ha3d/project-preferences'
import {
  createHomeAssistantProjectSession,
  type HomeAssistantProjectSession,
} from '../lib/ha3d/project-session'

type NativeHomeAssistantUser = Readonly<{
  is_admin?: boolean
}>

export type NativeHomeAssistant = HomeAssistantHassLike &
  HomeAssistantProjectApiHost &
  Readonly<{
    user?: NativeHomeAssistantUser
  }>

type PanelMode = 'dashboard' | 'edit'

type Ha3dNativeAppProps = Readonly<{
  hass: NativeHomeAssistant | null
  narrow: boolean
  onShowMoreInfo: (entityId: string) => void
}>

const EmptyEditorSidebarPanel = () => null

function HaEditorItemsPanel() {
  return (
    <ItemsPanel
      leadingTile={<Ha3dCustomObjectTile />}
      showSourceFilter={false}
      showTagFilters={false}
    />
  )
}

const HA_EDITOR_SIDEBAR_TABS: (SidebarTab & { component: ComponentType })[] = [
  {
    id: 'site',
    label: 'Scene',
    component: EmptyEditorSidebarPanel,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Layers className="h-5 w-5" />,
    icon: <Layers className="h-5 w-5" />,
  },
  {
    id: 'build',
    label: 'Build',
    component: BuildTab,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Hammer className="h-5 w-5" />,
    icon: <Hammer className="h-5 w-5" />,
  },
  {
    id: 'items',
    label: 'Items',
    component: HaEditorItemsPanel,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Package className="h-5 w-5" />,
    icon: <Package className="h-5 w-5" />,
  },
  {
    id: 'ha-settings',
    label: 'Settings',
    component: Ha3dEditorSettings,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Settings className="h-5 w-5" />,
    icon: <Settings className="h-5 w-5" />,
  },
]

type EditorCrashBoundaryProps = Readonly<{
  children: ReactNode
  onProjects: () => void
  onRetry: () => void
}>

type EditorCrashBoundaryState = Readonly<{
  error: Error | null
  componentStack: string
}>

class EditorCrashBoundary extends Component<EditorCrashBoundaryProps, EditorCrashBoundaryState> {
  state: EditorCrashBoundaryState = {
    error: null,
    componentStack: '',
  }

  static getDerivedStateFromError(error: unknown): Partial<EditorCrashBoundaryState> {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ha3d] Pascal editor render failed', error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? '' })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="absolute inset-0 z-[120] flex items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-2xl rounded-xl border border-destructive/50 bg-card p-5 shadow-2xl">
          <h2 className="font-semibold text-lg">3D editor failed to render</h2>
          <p className="mt-2 text-destructive text-sm">{this.state.error.message}</p>
          {this.state.componentStack ? (
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-background/70 p-3 text-[11px] text-muted-foreground">
              {this.state.componentStack}
            </pre>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-sm"
              onClick={this.props.onRetry}
              type="button"
            >
              Retry editor
            </button>
            <button
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              onClick={this.props.onProjects}
              type="button"
            >
              Projects
            </button>
          </div>
        </div>
      </div>
    )
  }
}

function projectErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  return 'Home Assistant project operation failed'
}

function ProjectPicker({
  projects,
  loading,
  error,
  canManage,
  recentProjectId,
  busyProjectId,
  onOpen,
  onCreate,
  onImport,
  onRename,
  onDelete,
  onRefresh,
}: Readonly<{
  projects: readonly Ha3dProjectMetadata[]
  loading: boolean
  error: string | null
  canManage: boolean
  recentProjectId: string | null
  busyProjectId: string | null
  onOpen: (projectId: string) => void
  onCreate: (name: string) => Promise<void>
  onImport: (file: File) => Promise<void>
  onRename: (project: Ha3dProjectMetadata, name: string) => Promise<void>
  onDelete: (project: Ha3dProjectMetadata) => Promise<void>
  onRefresh: () => Promise<void>
}>) {
  const [name, setName] = useState('My home')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)

  const orderedProjects =
    recentProjectId === null
      ? projects
      : [
          ...projects.filter((project) => project.id === recentProjectId),
          ...projects.filter((project) => project.id !== recentProjectId),
        ]

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || creating) return
    setCreating(true)
    try {
      await onCreate(trimmed)
      setName('My home')
    } catch {
      // The parent already surfaces the Home Assistant error in the picker.
    } finally {
      setCreating(false)
    }
  }

  const importPascalProject = async (file: File | undefined) => {
    if (!file || importing || busyProjectId) return
    setImporting(true)
    try {
      await onImport(file)
      if (importInputRef.current) importInputRef.current.value = ''
    } catch {
      // The parent surfaces the validation / Home Assistant error.
    } finally {
      setImporting(false)
    }
  }

  const submitRename = async (event: FormEvent, project: Ha3dProjectMetadata) => {
    event.preventDefault()
    const trimmed = renameValue.trim()
    if (!trimmed || busyProjectId) return
    try {
      await onRename(project, trimmed)
      setEditingProjectId(null)
      setRenameValue('')
    } catch {
      // Keep the rename form open; the parent surfaces the Home Assistant error.
    }
  }

  const confirmDelete = async (project: Ha3dProjectMetadata) => {
    if (busyProjectId) return
    try {
      await onDelete(project)
      setDeleteProjectId(null)
    } catch {
      // Keep the confirmation open; the parent surfaces the Home Assistant error.
    }
  }

  return (
    <main className="dark flex min-h-full w-full min-w-0 items-center justify-center overflow-x-hidden bg-background p-4 text-foreground md:p-8">
      <section className="w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-border border-b px-5 py-4">
          <div>
            <h1 className="font-semibold text-xl">HA 3D Dashboard</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Projects are stored by Home Assistant and shared by every client.
            </p>
          </div>
          <button
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            disabled={loading || busyProjectId !== null}
            onClick={() => void onRefresh()}
            type="button"
          >
            Refresh
          </button>
        </header>

        <div className="grid gap-5 p-5 md:grid-cols-[1fr_22rem]">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-medium text-sm">Projects</div>
              {!canManage ? (
                <span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">
                  read-only project management
                </span>
              ) : null}
            </div>

            {loading ? (
              <div className="rounded-xl border border-border p-5 text-muted-foreground text-sm">
                Loading projects…
              </div>
            ) : orderedProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-muted-foreground text-sm">
                {canManage
                  ? 'No HA 3D projects yet. Create the first one.'
                  : 'No HA 3D projects are available.'}
              </div>
            ) : (
              <div className="space-y-2">
                {orderedProjects.map((project) => {
                  const isBusy = busyProjectId === project.id
                  const isEditing = editingProjectId === project.id
                  const isDeleting = deleteProjectId === project.id
                  const isRecent = recentProjectId === project.id

                  return (
                    <div
                      className="rounded-xl border border-border bg-background/60 p-3"
                      key={project.id}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          className="min-w-0 flex-1 rounded-lg p-2 text-left hover:bg-accent disabled:opacity-50"
                          disabled={isBusy}
                          onClick={() => onOpen(project.id)}
                          type="button"
                        >
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium">{project.name}</span>
                            {isRecent ? (
                              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                                last opened
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 block truncate text-muted-foreground text-xs">
                            {project.id} · rev {project.revision}
                          </span>
                        </button>

                        {canManage && !isEditing && !isDeleting ? (
                          <div className="flex shrink-0 gap-1">
                            <button
                              className="rounded-lg border border-border px-2.5 py-2 text-xs hover:bg-accent disabled:opacity-50"
                              disabled={isBusy}
                              onClick={() => {
                                setDeleteProjectId(null)
                                setEditingProjectId(project.id)
                                setRenameValue(project.name)
                              }}
                              type="button"
                            >
                              Rename
                            </button>
                            <button
                              className="rounded-lg border border-destructive/40 px-2.5 py-2 text-destructive text-xs hover:bg-destructive/10 disabled:opacity-50"
                              disabled={isBusy}
                              onClick={() => {
                                setEditingProjectId(null)
                                setDeleteProjectId(project.id)
                              }}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {isEditing ? (
                        <form
                          className="mt-2 flex gap-2 border-border border-t pt-3"
                          onSubmit={(event) => void submitRename(event, project)}
                        >
                          <input
                            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                            maxLength={120}
                            onChange={(event) => setRenameValue(event.target.value)}
                            value={renameValue}
                          />
                          <button
                            className="rounded-lg bg-primary px-3 py-2 text-primary-foreground text-xs disabled:opacity-50"
                            disabled={isBusy || !renameValue.trim()}
                            type="submit"
                          >
                            {isBusy ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                            onClick={() => {
                              setEditingProjectId(null)
                              setRenameValue('')
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : null}

                      {isDeleting ? (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-border border-t pt-3">
                          <p className="text-muted-foreground text-xs">
                            Delete{' '}
                            <span className="font-medium text-foreground">{project.name}</span>?
                            This removes the server-stored 3D project.
                          </p>
                          <div className="flex gap-2">
                            <button
                              className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                              onClick={() => setDeleteProjectId(null)}
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              className="rounded-lg bg-destructive px-3 py-2 text-destructive-foreground text-xs disabled:opacity-50"
                              disabled={isBusy}
                              onClick={() => void confirmDelete(project)}
                              type="button"
                            >
                              {isBusy ? 'Deleting…' : 'Delete project'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}

            {error ? (
              <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                {error}
              </div>
            ) : null}
          </div>

          {canManage ? (
            <form
              className="rounded-xl border border-border bg-background/60 p-4"
              onSubmit={submit}
            >
              <div className="font-medium text-sm">Create project</div>
              <label className="mt-4 block text-muted-foreground text-xs">
                Name
                <input
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:border-ring"
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              <button
                className="mt-3 w-full rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-sm disabled:opacity-50"
                disabled={creating || !name.trim() || busyProjectId !== null}
                type="submit"
              >
                {creating ? 'Creating…' : 'Create and open'}
              </button>
              <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
                New projects are created in Home Assistant Store and open directly in Edit mode.
              </p>

              <div className="mt-4 border-border/70 border-t pt-4">
                <div className="font-medium text-sm">Import Pascal project</div>
                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                  Import a native Pascal Build JSON export as a new HA 3D project.
                </p>
                <input
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(event) => void importPascalProject(event.currentTarget.files?.[0])}
                  ref={importInputRef}
                  type="file"
                />
                <button
                  className="mt-3 w-full rounded-lg border border-border px-3 py-2 font-medium text-sm hover:bg-accent disabled:opacity-50"
                  disabled={importing || creating || busyProjectId !== null}
                  onClick={() => importInputRef.current?.click()}
                  type="button"
                >
                  {importing ? 'Importing…' : 'Import Pascal JSON'}
                </button>
              </div>
            </form>
          ) : (
            <aside className="rounded-xl border border-border bg-background/60 p-4">
              <div className="font-medium text-sm">Project management</div>
              <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
                Your Home Assistant account can open and use existing projects. Creating, renaming
                and deleting projects requires an administrator account.
              </p>
            </aside>
          )}
        </div>
      </section>
    </main>
  )
}

function SessionStatus({
  session,
  saveStatus,
}: Readonly<{
  session: HomeAssistantProjectSession
  saveStatus: SaveStatus
}>) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)

  const label =
    snapshot.status === 'conflict'
      ? 'Conflict — reload required'
      : snapshot.status === 'error'
        ? 'Project error'
        : saveStatus === 'error'
          ? 'Scene save error'
          : saveStatus === 'saving' || snapshot.status === 'saving'
            ? 'Saving…'
            : saveStatus === 'pending'
              ? 'Pending…'
              : saveStatus === 'paused'
                ? 'Save paused'
                : `Saved · rev ${snapshot.revision ?? '—'}`

  return (
    <span
      className={
        snapshot.status === 'conflict' || snapshot.status === 'error' || saveStatus === 'error'
          ? 'text-destructive'
          : 'text-muted-foreground'
      }
    >
      {label}
    </span>
  )
}

function NativeDashboard({
  projectName,
  session,
  onEdit,
  onProjects,
  onShowMoreInfo,
  environmentMode,
  onEnvironmentModeChange,
}: Readonly<{
  projectName: string
  session: HomeAssistantProjectSession
  onEdit?: () => void
  onProjects: () => void
  onShowMoreInfo: (entityId: string) => void
  environmentMode: Ha3dEnvironmentMode
  onEnvironmentModeChange: (mode: Ha3dEnvironmentMode) => void
}>) {
  const [scene, setScene] = useState<SceneGraph | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [selectedInteractiveNodeId, setSelectedInteractiveNodeId] = useState<string | null>(null)
  const [interactiveHighlights, setInteractiveHighlights] = useState(true)
  const [interactiveMarkers, setInteractiveMarkers] = useState(true)
  const [cameraRequest, setCameraRequest] = useState<Ha3dDashboardCameraRequest | null>(null)

  const requestCameraPreset = useCallback((preset: Ha3dDashboardCameraRequest['preset']) => {
    setCameraRequest((current) => ({
      id: (current?.id ?? 0) + 1,
      preset,
    }))
  }, [])

  useEffect(() => {
    let cancelled = false
    setScene(undefined)
    setError(null)

    void session
      .load()
      .then((loaded) => {
        if (!cancelled) setScene(loaded)
      })
      .catch((cause) => {
        if (!cancelled) setError(projectErrorMessage(cause))
      })

    return () => {
      cancelled = true
    }
  }, [session])

  useEffect(() => {
    if (scene === undefined) return

    const releaseReadOnly = acquireSceneReadOnlyLease()
    const previousLevelMode = useViewer.getState().levelMode
    useViewer.getState().setProjectId(session.getSnapshot().projectId)
    useScene.getState().unloadScene()
    applySceneGraphToEditor(scene)
    useViewer.getState().resetSelection()
    useViewer.getState().setLevelMode('stacked')
    setViewerReady(false)
    setSelectedInteractiveNodeId(null)

    return () => {
      setViewerReady(false)
      setSelectedInteractiveNodeId(null)
      useViewer.getState().resetSelection()
      useScene.getState().unloadScene()
      useViewer.getState().setLevelMode(previousLevelMode)
      useViewer.getState().setProjectId(null)
      releaseReadOnly()
    }
  }, [scene, session])

  useEffect(() => {
    if (!viewerReady) return
    requestCameraPreset('fit')
  }, [requestCameraPreset, viewerReady])

  if (error) {
    return (
      <main className="dark flex min-h-full w-full min-w-0 items-center justify-center overflow-x-hidden bg-background p-6 text-foreground">
        <div className="max-w-lg rounded-xl border border-destructive/40 bg-card p-5">
          <h2 className="font-semibold">Project could not be loaded</h2>
          <p className="mt-2 text-destructive text-sm">{error}</p>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg border border-border px-3 py-2 text-sm"
              onClick={onProjects}
              type="button"
            >
              Projects
            </button>
            {onEdit ? (
              <button
                className="rounded-lg bg-primary px-3 py-2 text-primary-foreground text-sm"
                onClick={onEdit}
                type="button"
              >
                Open editor
              </button>
            ) : null}
          </div>
        </div>
      </main>
    )
  }

  if (scene === undefined) {
    return (
      <main className="dark flex min-h-full w-full min-w-0 items-center justify-center overflow-x-hidden bg-background text-muted-foreground">
        Loading project…
      </main>
    )
  }

  if (!scene || scene.rootNodeIds.length === 0 || Object.keys(scene.nodes).length === 0) {
    return (
      <main className="dark flex min-h-full w-full min-w-0 items-center justify-center overflow-x-hidden bg-background p-6 text-foreground">
        <div className="max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
          <h2 className="font-semibold text-lg">{projectName}</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            This project does not have a 3D scene yet.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              onClick={onProjects}
              type="button"
            >
              Projects
            </button>
            {onEdit ? (
              <button
                className="rounded-lg bg-primary px-3 py-2 text-primary-foreground text-sm"
                onClick={onEdit}
                type="button"
              >
                Build in editor
              </button>
            ) : null}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="dark relative h-full w-full min-w-0 overflow-hidden bg-background text-foreground">
      <Viewer
        defaultRender={{ shading: 'solid' }}
        hoverStyles={HA3D_INTERACTIVE_HOVER_STYLES}
        onSceneReadyChange={setViewerReady}
        renderContext="viewer"
        sceneReadyKey={`${session.getSnapshot().projectId}:${session.getSnapshot().revision ?? 0}`}
        selectionManager="custom"
      >
        <SceneEnvironment />
        <Ha3dDashboardCameraControls request={cameraRequest} />
        <ViewerPresentations />
        <Ha3dSunEnvironment mode={environmentMode} />
        <Ha3dDashboardInteractions
          highlightsEnabled={interactiveHighlights}
          markersEnabled={interactiveMarkers}
          onSelectedNodeIdChange={setSelectedInteractiveNodeId}
          onShowMoreInfo={onShowMoreInfo}
          selectedNodeId={selectedInteractiveNodeId}
        />
      </Viewer>

      <div className="pointer-events-none absolute top-3 right-3 left-3 z-40 flex items-start justify-between gap-3 md:right-[21rem]">
        <div className="min-w-0 rounded-xl border border-border/70 bg-background/90 px-3 py-2 shadow-lg backdrop-blur">
          <div className="truncate font-semibold text-sm">{projectName}</div>
          <div className="text-muted-foreground text-[10px]">
            Dashboard · rev {session.getSnapshot().revision ?? '—'}
          </div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            className="rounded-xl border border-border/70 bg-background/90 px-3 py-2 font-medium text-xs shadow-lg backdrop-blur hover:bg-accent"
            onClick={onProjects}
            type="button"
          >
            Projects
          </button>
          {onEdit ? (
            <button
              className="rounded-xl border border-border/70 bg-background/90 px-3 py-2 font-medium text-xs shadow-lg backdrop-blur hover:bg-accent"
              onClick={onEdit}
              type="button"
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      <Ha3dDashboardNavigation onCameraPreset={requestCameraPreset} scene={scene} />

      <Ha3dDashboardControls
        environmentMode={environmentMode}
        highlightsEnabled={interactiveHighlights}
        markersEnabled={interactiveMarkers}
        onEnvironmentModeChange={onEnvironmentModeChange}
        onHighlightsEnabledChange={setInteractiveHighlights}
        onMarkersEnabledChange={setInteractiveMarkers}
        onShowMoreInfo={onShowMoreInfo}
        selectedNodeId={selectedInteractiveNodeId}
      />

      {!viewerReady ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/85 text-muted-foreground backdrop-blur-sm">
          Loading 3D scene…
        </div>
      ) : null}
    </main>
  )
}

function NativeProject({
  metadata,
  session,
  host,
  mode,
  canManageProjects,
  leavingProject,
  navigationError,
  onClearNavigationError,
  onModeChange,
  onProjects,
  onShowMoreInfo,
}: Readonly<{
  metadata: Ha3dProjectMetadata
  session: HomeAssistantProjectSession
  host: HomeAssistantProjectApiHost
  mode: PanelMode
  canManageProjects: boolean
  leavingProject: boolean
  navigationError: string | null
  onClearNavigationError: () => void
  onModeChange: (mode: PanelMode) => void
  onProjects: () => Promise<void>
  onShowMoreInfo: (entityId: string) => void
}>) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [editorEpoch, setEditorEpoch] = useState(0)
  const [editorReady, setEditorReady] = useState(false)
  const [structureOpen, setStructureOpen] = useState(false)
  const [environmentMode, setEnvironmentMode] = useState<Ha3dEnvironmentMode>('auto')
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const sceneSaveBlocked =
    saveStatus === 'pending' ||
    saveStatus === 'saving' ||
    saveStatus === 'error' ||
    snapshot.status === 'saving' ||
    snapshot.status === 'error' ||
    snapshot.status === 'conflict'

  // Keep Editor callback identities stable. Editor's scene-load effect depends on
  // onLoad; session.load() publishes snapshot updates that re-render this parent.
  // An inline onLoad callback would therefore retrigger the load effect forever.
  const loadScene = useCallback(() => session.load(), [session])
  const saveScene = useCallback((scene: SceneGraph) => session.saveScene(scene), [session])
  const handleLoaderChange = useCallback((visible: boolean) => {
    setEditorReady(!visible)
  }, [])

  const reloadEditor = useCallback(() => {
    onClearNavigationError()
    setStructureOpen(false)
    setEditorReady(false)
    setEditorEpoch((value) => value + 1)
  }, [onClearNavigationError])

  useEffect(() => {
    if (snapshot.status === 'conflict' || snapshot.status === 'error') {
      setStructureOpen(false)
    }
  }, [snapshot.status])

  if (mode === 'dashboard' || !canManageProjects) {
    return (
      <NativeDashboard
        onEdit={
          canManageProjects
            ? () => {
                setEditorReady(false)
                onModeChange('edit')
              }
            : undefined
        }
        onProjects={() => {
          void onProjects()
        }}
        environmentMode={environmentMode}
        onEnvironmentModeChange={setEnvironmentMode}
        projectName={metadata.name}
        session={session}
        onShowMoreInfo={onShowMoreInfo}
      />
    )
  }

  return (
    <main className="dark relative h-full w-full min-w-0 overflow-hidden bg-background text-foreground">
      <EditorCrashBoundary
        key={`editor-boundary:${editorEpoch}`}
        onProjects={() => {
          void onProjects()
        }}
        onRetry={reloadEditor}
      >
        <Editor
          key={editorEpoch}
          layoutVersion="v2"
          manageDocumentDarkClass={false}
          onLoad={loadScene}
          onLoaderChange={handleLoaderChange}
          onSave={saveScene}
          onSaveStatusChange={setSaveStatus}
          presentationPersistenceMode="external"
          projectId={metadata.id}
          sidebarTabs={HA_EDITOR_SIDEBAR_TABS}
          viewerSceneSlot={<Ha3dSunEnvironment mode={environmentMode} />}
          viewerToolbarRight={
            <Ha3dEditorViewportToolbar
              environmentMode={environmentMode}
              onEnvironmentModeChange={setEnvironmentMode}
            />
          }
        />
      </EditorCrashBoundary>

      <div className="pointer-events-none absolute top-3 right-3 z-[90] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-2">
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-end gap-2 rounded-xl border border-border/70 bg-background/92 px-3 py-2 text-xs shadow-xl backdrop-blur">
          <span className="max-w-40 truncate font-medium">{metadata.name}</span>
          <span className="text-border">|</span>
          <SessionStatus saveStatus={saveStatus} session={session} />
          <button
            className="rounded-md border border-border px-2 py-1 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!editorReady || sceneSaveBlocked || leavingProject}
            onClick={() => setStructureOpen(true)}
            title={editorReady ? undefined : 'Wait for the Pascal scene to finish loading'}
            type="button"
          >
            HA structure
          </button>
          <button
            className="rounded-md border border-border px-2 py-1 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
            disabled={sceneSaveBlocked || leavingProject}
            onClick={() => {
              setStructureOpen(false)
              onModeChange('dashboard')
            }}
            title={
              saveStatus === 'error' || snapshot.status === 'error'
                ? 'Resolve or retry the save error before leaving the editor'
                : sceneSaveBlocked
                  ? 'Wait for the current scene save to finish'
                  : undefined
            }
            type="button"
          >
            Dashboard
          </button>
          <button
            className="rounded-md border border-border px-2 py-1 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
            disabled={sceneSaveBlocked || leavingProject}
            onClick={() => {
              setStructureOpen(false)
              void onProjects()
            }}
            title={
              saveStatus === 'error' || snapshot.status === 'error'
                ? 'Resolve or retry the save error before leaving the editor'
                : sceneSaveBlocked
                  ? 'Wait for the current scene save to finish'
                  : undefined
            }
            type="button"
          >
            {leavingProject ? 'Saving…' : 'Projects'}
          </button>
        </div>
      </div>

      {structureOpen ? (
        <Ha3dStructureManager host={host} onClose={() => setStructureOpen(false)} />
      ) : null}

      {snapshot.status === 'conflict' ? (
        <div className="absolute inset-x-3 bottom-3 z-[95] mx-auto max-w-xl rounded-xl border border-destructive/50 bg-background/95 p-4 shadow-2xl backdrop-blur">
          <div className="font-semibold text-sm">This project changed in another client.</div>
          <p className="mt-1 text-muted-foreground text-xs">
            Further writes are blocked. Reload the server copy before continuing.
          </p>
          <button
            className="mt-3 rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-sm"
            onClick={reloadEditor}
            type="button"
          >
            Reload server copy
          </button>
        </div>
      ) : snapshot.status === 'error' || saveStatus === 'error' ? (
        <div className="absolute inset-x-3 bottom-3 z-[95] mx-auto max-w-xl rounded-xl border border-destructive/50 bg-background/95 p-4 shadow-2xl backdrop-blur">
          <div className="font-semibold text-sm">The project has unsaved changes.</div>
          <p className="mt-1 text-destructive text-xs">
            {snapshot.errorMessage ?? 'The scene save was rejected before reaching Home Assistant.'}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Navigation is blocked to avoid discarding local edits. Resolve the cause and press
            Ctrl/Cmd+S to retry the save.
          </p>
        </div>
      ) : navigationError ? (
        <div className="absolute inset-x-3 bottom-3 z-[95] mx-auto max-w-xl rounded-xl border border-destructive/50 bg-background/95 p-4 shadow-2xl backdrop-blur">
          <div className="font-semibold text-sm">Could not safely leave the project.</div>
          <p className="mt-1 text-destructive text-xs">{navigationError}</p>
          <p className="mt-1 text-muted-foreground text-xs">
            The project stays open so unsaved Home Assistant configuration is not discarded.
          </p>
          <button
            className="mt-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            onClick={onClearNavigationError}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </main>
  )
}

export function Ha3dNativeApp({ hass, narrow, onShowMoreInfo }: Ha3dNativeAppProps) {
  const hassRef = useRef(hass)
  hassRef.current = hass

  const api = useMemo<HomeAssistantProjectApiHost>(
    () => ({
      callWS: async <T,>(message: Readonly<Record<string, unknown>>) => {
        const current = hassRef.current
        if (!current) throw new Error('[ha3d] Home Assistant is not connected')
        return current.callWS<T>(message)
      },
    }),
    [],
  )

  const [projects, setProjects] = useState<readonly Ha3dProjectMetadata[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null)
  const [recentProjectId, setRecentProjectId] = useState<string | null>(() => readLastProjectId())
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [mode, setMode] = useState<PanelMode>('dashboard')
  const [leavingProject, setLeavingProject] = useState(false)
  const [navigationError, setNavigationError] = useState<string | null>(null)

  const refreshProjects = useCallback(async () => {
    if (!hassRef.current) return
    setLoadingProjects(true)
    setProjectError(null)
    try {
      const result = await listHomeAssistantProjects(api)
      setProjects(result)

      const lastProjectId = readLastProjectId()
      if (lastProjectId && !result.some((project) => project.id === lastProjectId)) {
        clearLastProjectId(lastProjectId)
        setRecentProjectId(null)
      } else {
        setRecentProjectId(lastProjectId)
      }
    } catch (error) {
      setProjectError(projectErrorMessage(error))
    } finally {
      setLoadingProjects(false)
    }
  }, [api])

  const connected = hass !== null

  useEffect(() => {
    if (!connected) return
    void refreshProjects()
  }, [connected, refreshProjects])

  const session = useMemo(
    () => (selectedProjectId ? createHomeAssistantProjectSession(api, selectedProjectId) : null),
    [api, selectedProjectId],
  )

  useEffect(
    () => () => {
      session?.dispose()
    },
    [session],
  )

  const rememberProject = useCallback((projectId: string) => {
    writeLastProjectId(projectId)
    setRecentProjectId(projectId)
  }, [])

  const openProject = useCallback(
    (projectId: string) => {
      setProjectError(null)
      setNavigationError(null)
      rememberProject(projectId)
      setMode('dashboard')
      setSelectedProjectId(projectId)
    },
    [rememberProject],
  )

  const createProject = useCallback(
    async (name: string) => {
      setProjectError(null)
      try {
        const project = await createHomeAssistantProject(api, { name })
        setProjects((current) => [
          ...current.filter((candidate) => candidate.id !== project.id),
          project,
        ])
        rememberProject(project.id)
        setMode('edit')
        setSelectedProjectId(project.id)
      } catch (error) {
        setProjectError(projectErrorMessage(error))
        throw error
      }
    },
    [api, rememberProject],
  )

  const importPascalProject = useCallback(
    async (file: File) => {
      setProjectError(null)
      try {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Pascal project is larger than the 10 MB project import limit.')
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(await file.text()) as unknown
        } catch {
          throw new Error('The selected file is not valid JSON.')
        }

        const validation = validateBuildJson(parsed)
        if (!validation.ok || !validation.parsed) {
          const firstIssue = validation.errors[0] ?? validation.schemaIssues[0]
          throw new Error(
            firstIssue?.message
              ? `Pascal project validation failed: ${firstIssue.message}`
              : 'Pascal project validation failed.',
          )
        }

        const sourceName = file.name.replace(/\.json$/i, '').trim()
        const name = sourceName || 'Imported Pascal project'
        const project = await createHomeAssistantProject(api, {
          name,
          scene: validation.parsed as unknown as Readonly<Record<string, unknown>>,
        })

        setProjects((current) => [
          ...current.filter((candidate) => candidate.id !== project.id),
          project,
        ])
        rememberProject(project.id)
        setMode('edit')
        setSelectedProjectId(project.id)
      } catch (error) {
        setProjectError(projectErrorMessage(error))
        throw error
      }
    },
    [api, rememberProject],
  )

  const renameProject = useCallback(
    async (project: Ha3dProjectMetadata, name: string) => {
      setBusyProjectId(project.id)
      setProjectError(null)
      try {
        const updated = await saveHomeAssistantProject(api, {
          projectId: project.id,
          expectedRevision: project.revision,
          name,
        })
        setProjects((current) =>
          current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
        )
      } catch (error) {
        setProjectError(projectErrorMessage(error))
        if (homeAssistantProjectApiErrorCode(error) === 'version_conflict') {
          await refreshProjects()
        }
        throw error
      } finally {
        setBusyProjectId(null)
      }
    },
    [api, refreshProjects],
  )

  const deleteProject = useCallback(
    async (project: Ha3dProjectMetadata) => {
      setBusyProjectId(project.id)
      setProjectError(null)
      try {
        await deleteHomeAssistantProject(api, project.id, project.revision)
        setProjects((current) => current.filter((candidate) => candidate.id !== project.id))
        if (recentProjectId === project.id) {
          clearLastProjectId(project.id)
          setRecentProjectId(null)
        }
      } catch (error) {
        setProjectError(projectErrorMessage(error))
        if (
          homeAssistantProjectApiErrorCode(error) === 'version_conflict' ||
          homeAssistantProjectApiErrorCode(error) === 'not_found'
        ) {
          await refreshProjects()
        }
        throw error
      } finally {
        setBusyProjectId(null)
      }
    },
    [api, recentProjectId, refreshProjects],
  )

  const returnToProjects = useCallback(async () => {
    if (leavingProject) return
    setLeavingProject(true)
    setNavigationError(null)

    try {
      await session?.flushConfiguration()
    } catch (error) {
      setNavigationError(projectErrorMessage(error))
      setLeavingProject(false)
      return
    }

    setSelectedProjectId(null)
    setMode('dashboard')
    setLeavingProject(false)
    await refreshProjects()
  }, [leavingProject, refreshProjects, session])

  if (!hass) {
    return (
      <main className="dark flex min-h-full w-full min-w-0 items-center justify-center overflow-x-hidden bg-background text-muted-foreground">
        Waiting for Home Assistant…
      </main>
    )
  }

  const canManageProjects = hass.user?.is_admin === true

  if (!(selectedProjectId && session)) {
    return (
      <ProjectPicker
        busyProjectId={busyProjectId}
        canManage={canManageProjects}
        error={projectError}
        loading={loadingProjects}
        onCreate={createProject}
        onDelete={deleteProject}
        onImport={importPascalProject}
        onOpen={openProject}
        onRefresh={refreshProjects}
        onRename={renameProject}
        projects={projects}
        recentProjectId={recentProjectId}
      />
    )
  }

  const metadata = projects.find((project) => project.id === selectedProjectId) ?? {
    id: selectedProjectId,
    name: selectedProjectId,
    revision: 1,
    createdAt: '',
    updatedAt: '',
  }

  return (
    <div
      className="h-full w-full min-w-0 overflow-hidden"
      data-ha3d-layout={narrow ? 'narrow' : 'wide'}
    >
      <NativeProject
        key={selectedProjectId}
        canManageProjects={canManageProjects}
        host={api}
        leavingProject={leavingProject}
        metadata={metadata}
        mode={mode}
        navigationError={navigationError}
        onClearNavigationError={() => setNavigationError(null)}
        onModeChange={setMode}
        onProjects={returnToProjects}
        onShowMoreInfo={onShowMoreInfo}
        session={session}
      />
    </div>
  )
}
