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
  const active = projectConfig.dashboardMenu.mode === 'lovelace'

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <PanelsTopLeft className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold text-base">Menu</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Edit the operator panel with normal Home Assistant cards.
          </p>
        </div>
      </div>

      {!active ? (
        <div className="mt-4 rounded-2xl border border-border bg-card/70 p-4">
          <div className="flex items-start gap-3">
            <LayoutDashboard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">Use native HA cards</div>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                The current Menu uses{' '}
                {projectConfig.dashboardMenu.mode === 'auto'
                  ? 'automatic 3D bindings'
                  : 'HA3D tiles'}
                . Switch to native Lovelace cards to add Mushroom, Tile, stacks and other installed
                Home Assistant cards.
              </p>
              <button
                className="mt-3 rounded-full bg-primary px-3 py-2 font-medium text-primary-foreground text-xs"
                onClick={() => setDashboardMenuMode('lovelace')}
                type="button"
              >
                Use HA cards
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Ha3dLovelaceMenuEditor
            config={projectConfig.dashboardMenu.lovelaceCard}
            onChange={setDashboardLovelaceCard}
          />
        </div>
      )}
    </div>
  )
}
