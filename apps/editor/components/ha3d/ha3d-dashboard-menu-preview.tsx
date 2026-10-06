'use client'

import { useEditor } from '@pascal-app/editor'
import { useMemo, useSyncExternalStore } from 'react'
import { buildAutomaticDashboardCard } from '../../lib/ha3d/dashboard-menu'
import {
  getHomeAssistantLovelaceHostSnapshot,
  subscribeHomeAssistantLovelaceHost,
} from '../../lib/ha3d/lovelace-host'
import {
  getHa3dProjectConfigSnapshot,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import { Ha3dLovelaceCard } from './ha3d-lovelace-card'

export function Ha3dDashboardMenuPreview() {
  const activeSidebarPanel = useEditor((state) => state.activeSidebarPanel)
  const project = useSyncExternalStore(
    subscribeHa3dProjectConfig,
    getHa3dProjectConfigSnapshot,
    getHa3dProjectConfigSnapshot,
  )
  const lovelaceHost = useSyncExternalStore(
    subscribeHomeAssistantLovelaceHost,
    getHomeAssistantLovelaceHostSnapshot,
    getHomeAssistantLovelaceHostSnapshot,
  )
  const card = useMemo(
    () =>
      project.dashboardMenu.mode === 'lovelace'
        ? project.dashboardMenu.lovelaceCard
        : buildAutomaticDashboardCard(
            project.bindings
              .filter((binding) => binding.enabled)
              .map((binding) => binding.entityId),
          ),
    [project.bindings, project.dashboardMenu],
  )

  if (activeSidebarPanel !== 'ha-menu') return null

  return (
    <aside
      className="pointer-events-auto absolute top-16 right-3 bottom-3 z-[70] flex flex-col overflow-hidden rounded-[22px] border border-[var(--ha3d-dashboard-border)] bg-[var(--ha3d-dashboard-surface)] text-[var(--ha3d-dashboard-text)] shadow-2xl backdrop-blur-xl"
      data-ha3d-menu-preview
      style={{ width: 'min(21rem, calc(100% - 1.5rem))' }}
    >
      <div className="border-[var(--ha3d-dashboard-border)] border-b px-3.5 py-3">
        <div className="font-semibold text-sm">Menu preview</div>
        <div className="mt-0.5 text-[10px] text-[var(--ha3d-dashboard-muted)]">
          Same native Home Assistant cards used by the final dashboard.
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {lovelaceHost ? (
          <Ha3dLovelaceCard config={card} hass={lovelaceHost} />
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--ha3d-dashboard-border)] px-3 py-5 text-center text-[var(--ha3d-dashboard-muted)] text-xs">
            Home Assistant card runtime is not connected.
          </div>
        )}
      </div>
    </aside>
  )
}
