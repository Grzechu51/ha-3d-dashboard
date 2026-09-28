'use client'

import { useSyncExternalStore } from 'react'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'

export default function Ha3dPanel() {
  const runtime = useSyncExternalStore(
    subscribeHomeAssistantRuntime,
    getHomeAssistantRuntimeSnapshot,
    getHomeAssistantRuntimeSnapshot,
  )

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="font-semibold text-base">Home Assistant</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Bind scene objects to live Home Assistant entities.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-sm">Bridge</span>
          <span className="text-muted-foreground text-xs">
            {runtime.connected ? runtime.adapter?.id : 'not connected'}
          </span>
        </div>
        <p className="mt-2 text-muted-foreground text-xs">
          The standalone editor currently exposes the HA 3D runtime seam. The Home Assistant custom
          panel adapter will attach here in the integration stage.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="font-medium text-sm">Foundation</div>
        <ul className="mt-2 space-y-1 text-muted-foreground text-xs">
          <li>Entity-to-node binding contract</li>
          <li>Transport-independent Home Assistant adapter</li>
          <li>Mock adapter for development and tests</li>
          <li>Runtime adapter registration outside Pascal stores</li>
        </ul>
      </div>
    </div>
  )
}
