'use client'

import { LayoutDashboard, PanelsTopLeft } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import {
  getHa3dProjectConfigSnapshot,
  setDashboardLovelaceCard,
  setDashboardMenuMode,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import { Ha3dLovelaceMenuEditor } from './ha3d-lovelace-menu-editor'

export function Ha3dDashboardMenuPanel() {
  const projectConfig = useSyncExternalStore(
    subscribeHa3dProjectConfig,
    getHa3dProjectConfigSnapshot,
    getHa3dProjectConfigSnapshot,
  )
  const custom = projectConfig.dashboardMenu.mode === 'lovelace'

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <PanelsTopLeft className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold text-base">Menu</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Build the operator panel with normal Home Assistant cards.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          aria-pressed={!custom}
          className={
            custom
              ? 'rounded-xl border border-border bg-background/60 px-3 py-2 text-left text-muted-foreground text-sm hover:bg-accent hover:text-foreground'
              : 'rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-left text-primary text-sm'
          }
          onClick={() => setDashboardMenuMode('auto')}
          type="button"
        >
          Automatic HA tiles
        </button>
        <button
          aria-pressed={custom}
          className={
            custom
              ? 'rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-left text-primary text-sm'
              : 'rounded-xl border border-border bg-background/60 px-3 py-2 text-left text-muted-foreground text-sm hover:bg-accent hover:text-foreground'
          }
          onClick={() => setDashboardMenuMode('lovelace')}
          type="button"
        >
          HA cards
        </button>
      </div>

      {custom ? (
        <div className="mt-4">
          <Ha3dLovelaceMenuEditor
            config={projectConfig.dashboardMenu.lovelaceCard}
            onChange={setDashboardLovelaceCard}
          />
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-card/70 p-4">
          <div className="flex items-start gap-3">
            <LayoutDashboard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">Automatic Home Assistant tiles</div>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                Every unique Home Assistant entity linked to the 3D scene is rendered as a native
                Tile card. Choose HA cards to edit the generated card set with Home Assistant's
                normal card editor.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
