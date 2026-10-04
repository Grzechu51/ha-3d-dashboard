'use client'

import { useViewer } from '@pascal-app/viewer'
import { RefreshCw } from 'lucide-react'
import { type ReactNode, useState, useSyncExternalStore } from 'react'
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

export function Ha3dEditorSettings() {
  const shadows = useViewer((state) => state.shadows)
  const textures = useViewer((state) => state.textures)
  const cameraMode = useViewer((state) => state.cameraMode)
  const runtime = useSyncExternalStore(
    subscribeHomeAssistantRuntime,
    getHomeAssistantRuntimeSnapshot,
    getHomeAssistantRuntimeSnapshot,
  )
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

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

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div>
        <h2 className="font-semibold text-base">Settings</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Home Assistant and editor options used by HA 3D Dashboard.
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
            {refreshing ? 'Refreshing…' : 'Refresh entities'}
          </button>
        </div>
        <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
          Entity states update live. Use refresh after creating, renaming or removing helpers and
          integrations in Home Assistant to force a fresh `get_states` inventory.
        </p>
        {refreshError ? <p className="mt-2 text-destructive text-xs">{refreshError}</p> : null}
      </section>

      <section className="mt-3 rounded-xl border border-border bg-card/70 p-3">
        <div className="font-medium text-sm">Editor view</div>
        <p className="mt-1 text-muted-foreground text-xs">
          Only the display controls useful in the HA editor are exposed here.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ToggleButton
            active={shadows}
            onClick={() => useViewer.getState().setShadows(!shadows)}
          >
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
        <div className="font-medium text-sm">Project storage</div>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          Scene data and Home Assistant bindings are stored by the HA 3D integration. Pascal cloud
          sharing, Blender handoff, Pascal project IDs, scene-graph diagnostics and standalone
          save/load controls are intentionally hidden from this embedded interface.
        </p>
      </section>
    </div>
  )
}
