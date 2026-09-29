import {
  acquireSceneReadOnlyLease,
  applySceneGraphToEditor,
  Editor,
  type SaveStatus,
  type SceneGraph,
  useScene,
} from '@pascal-app/editor'
import { SceneEnvironment, useViewer, Viewer, ViewerPresentations } from '@pascal-app/viewer'
import { OrbitControls } from '@react-three/drei'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Ha3dDashboardControls } from '../components/ha3d/ha3d-dashboard-controls'
import type { HomeAssistantHassLike } from '../lib/ha3d/hass-adapter'
import {
  createHomeAssistantProject,
  type Ha3dProjectMetadata,
  type HomeAssistantProjectApiHost,
  listHomeAssistantProjects,
} from '../lib/ha3d/project-api'
import {
  createHomeAssistantProjectSession,
  type HomeAssistantProjectSession,
} from '../lib/ha3d/project-session'

export type NativeHomeAssistant = HomeAssistantHassLike & HomeAssistantProjectApiHost

type PanelMode = 'dashboard' | 'edit'

type Ha3dNativeAppProps = Readonly<{
  hass: NativeHomeAssistant | null
  narrow: boolean
}>

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
  onOpen,
  onCreate,
  onRefresh,
}: Readonly<{
  projects: readonly Ha3dProjectMetadata[]
  loading: boolean
  error: string | null
  onOpen: (projectId: string) => void
  onCreate: (name: string) => Promise<void>
  onRefresh: () => Promise<void>
}>) {
  const [name, setName] = useState('My home')
  const [creating, setCreating] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || creating) return
    setCreating(true)
    try {
      await onCreate(trimmed)
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background p-4 text-foreground md:p-8">
      <section className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-border border-b px-5 py-4">
          <div>
            <h1 className="font-semibold text-xl">HA 3D Dashboard</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Projects are stored by Home Assistant and shared by every client.
            </p>
          </div>
          <button
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            disabled={loading}
            onClick={() => void onRefresh()}
            type="button"
          >
            Refresh
          </button>
        </header>

        <div className="grid gap-5 p-5 md:grid-cols-[1fr_22rem]">
          <div>
            <div className="mb-3 font-medium text-sm">Projects</div>
            {loading ? (
              <div className="rounded-xl border border-border p-5 text-muted-foreground text-sm">
                Loading projects…
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-muted-foreground text-sm">
                No HA 3D projects yet. Create the first one.
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-background/60 p-4 text-left hover:bg-accent"
                    key={project.id}
                    onClick={() => onOpen(project.id)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{project.name}</span>
                      <span className="mt-1 block truncate text-muted-foreground text-xs">
                        {project.id}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted-foreground text-xs">
                      rev {project.revision}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {error ? (
              <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                {error}
              </div>
            ) : null}
          </div>

          <form className="rounded-xl border border-border bg-background/60 p-4" onSubmit={submit}>
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
              disabled={creating || !name.trim()}
              type="submit"
            >
              {creating ? 'Creating…' : 'Create and open'}
            </button>
            <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
              New projects start without a scene. Open Edit mode to build the site, building and
              levels with Pascal.
            </p>
          </form>
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
        : saveStatus === 'saving' || snapshot.status === 'saving'
          ? 'Saving…'
          : saveStatus === 'pending'
            ? 'Pending…'
            : `Saved · rev ${snapshot.revision ?? '—'}`

  return (
    <span
      className={
        snapshot.status === 'conflict' || snapshot.status === 'error'
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
}: Readonly<{
  projectName: string
  session: HomeAssistantProjectSession
  onEdit: () => void
  onProjects: () => void
}>) {
  const [scene, setScene] = useState<SceneGraph | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [viewerReady, setViewerReady] = useState(false)

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
    useViewer.getState().setProjectId(session.getSnapshot().projectId)
    useScene.getState().unloadScene()
    applySceneGraphToEditor(scene)
    useViewer.getState().resetSelection()
    setViewerReady(false)

    return () => {
      setViewerReady(false)
      useViewer.getState().resetSelection()
      useScene.getState().unloadScene()
      useViewer.getState().setProjectId(null)
      releaseReadOnly()
    }
  }, [scene, session])

  if (error) {
    return (
      <main className="dark flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
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
            <button
              className="rounded-lg bg-primary px-3 py-2 text-primary-foreground text-sm"
              onClick={onEdit}
              type="button"
            >
              Open editor
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (scene === undefined) {
    return (
      <main className="dark flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading project…
      </main>
    )
  }

  if (!scene || scene.rootNodeIds.length === 0 || Object.keys(scene.nodes).length === 0) {
    return (
      <main className="dark flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
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
            <button
              className="rounded-lg bg-primary px-3 py-2 text-primary-foreground text-sm"
              onClick={onEdit}
              type="button"
            >
              Build in editor
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="dark relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <Viewer
        defaultRender={{ shading: 'solid' }}
        onSceneReadyChange={setViewerReady}
        renderContext="viewer"
        sceneReadyKey={`${session.getSnapshot().projectId}:${session.getSnapshot().revision ?? 0}`}
        selectionManager="custom"
      >
        <SceneEnvironment />
        <OrbitControls enableDamping makeDefault />
        <ViewerPresentations />
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
          <button
            className="rounded-xl border border-border/70 bg-background/90 px-3 py-2 font-medium text-xs shadow-lg backdrop-blur hover:bg-accent"
            onClick={onEdit}
            type="button"
          >
            Edit
          </button>
        </div>
      </div>

      <Ha3dDashboardControls />

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
  mode,
  onModeChange,
  onProjects,
}: Readonly<{
  metadata: Ha3dProjectMetadata
  session: HomeAssistantProjectSession
  mode: PanelMode
  onModeChange: (mode: PanelMode) => void
  onProjects: () => void
}>) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [editorEpoch, setEditorEpoch] = useState(0)
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)

  const reloadEditor = useCallback(() => {
    setEditorEpoch((value) => value + 1)
  }, [])

  if (mode === 'dashboard') {
    return (
      <NativeDashboard
        onEdit={() => onModeChange('edit')}
        onProjects={onProjects}
        projectName={metadata.name}
        session={session}
      />
    )
  }

  return (
    <main className="dark relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <Editor
        key={editorEpoch}
        layoutVersion="v1"
        manageDocumentDarkClass={false}
        onLoad={() => session.load()}
        onSave={(scene) => session.saveScene(scene)}
        onSaveStatusChange={setSaveStatus}
        presentationPersistenceMode="external"
        projectId={metadata.id}
      />

      <div className="pointer-events-none absolute top-3 right-3 z-[90] flex max-w-[calc(100%-1.5rem)] items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border/70 bg-background/92 px-3 py-2 text-xs shadow-xl backdrop-blur">
          <span className="max-w-40 truncate font-medium">{metadata.name}</span>
          <span className="text-border">|</span>
          <SessionStatus saveStatus={saveStatus} session={session} />
          <button
            className="rounded-md border border-border px-2 py-1 hover:bg-accent"
            onClick={() => onModeChange('dashboard')}
            type="button"
          >
            Dashboard
          </button>
          <button
            className="rounded-md border border-border px-2 py-1 hover:bg-accent"
            onClick={onProjects}
            type="button"
          >
            Projects
          </button>
        </div>
      </div>

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
            Reload project
          </button>
        </div>
      ) : null}
    </main>
  )
}

export function Ha3dNativeApp({ hass, narrow }: Ha3dNativeAppProps) {
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [mode, setMode] = useState<PanelMode>('dashboard')

  const refreshProjects = useCallback(async () => {
    if (!hassRef.current) return
    setLoadingProjects(true)
    setProjectError(null)
    try {
      const result = await listHomeAssistantProjects(api)
      setProjects(result)
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

  const openProject = useCallback((projectId: string) => {
    setMode('dashboard')
    setSelectedProjectId(projectId)
  }, [])

  const createProject = useCallback(
    async (name: string) => {
      setProjectError(null)
      try {
        const project = await createHomeAssistantProject(api, { name })
        setProjects((current) => [
          ...current.filter((candidate) => candidate.id !== project.id),
          project,
        ])
        setMode('edit')
        setSelectedProjectId(project.id)
      } catch (error) {
        setProjectError(projectErrorMessage(error))
        throw error
      }
    },
    [api],
  )

  const returnToProjects = useCallback(() => {
    void session?.flushConfiguration().catch(() => undefined)
    setSelectedProjectId(null)
    setMode('dashboard')
    void refreshProjects()
  }, [refreshProjects, session])

  if (!hass) {
    return (
      <main className="dark flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Waiting for Home Assistant…
      </main>
    )
  }

  if (!(selectedProjectId && session)) {
    return (
      <ProjectPicker
        error={projectError}
        loading={loadingProjects}
        onCreate={createProject}
        onOpen={openProject}
        onRefresh={refreshProjects}
        projects={projects}
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
    <div data-ha3d-layout={narrow ? 'narrow' : 'wide'}>
      <NativeProject
        metadata={metadata}
        mode={mode}
        onModeChange={setMode}
        onProjects={returnToProjects}
        session={session}
      />
    </div>
  )
}
