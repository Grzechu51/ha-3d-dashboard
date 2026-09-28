'use client'

import { type AnyNodeId, sceneRegistry } from '@pascal-app/core'
import { type LightSource, useItemLightPool } from '@pascal-app/viewer'
import { useEffect, useSyncExternalStore } from 'react'
import type { EntityBinding } from '../../lib/ha3d/entity-binding'
import { resolveHomeAssistantLightVisualState } from '../../lib/ha3d/light-state'
import {
  getHa3dProjectConfigSnapshot,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'

const MAX_LIGHT_INTENSITY = 2
const LIGHT_DISTANCE = 8

function HaLightBinding({
  binding,
  runtime,
}: {
  binding: EntityBinding
  runtime: ReturnType<typeof getHomeAssistantRuntimeSnapshot>
}) {
  const adapter = runtime.adapter
  const visual = resolveHomeAssistantLightVisualState(adapter?.getEntity(binding.entityId))
  const sourceKey = `ha3d:${binding.nodeId}:${binding.entityId}:${visual.color}`

  useEffect(() => {
    if (!adapter || !binding.enabled) return

    const nodeId = binding.nodeId as AnyNodeId
    const source: LightSource = {
      key: sourceKey,
      nodeId,
      color: visual.color,
      distance: LIGHT_DISTANCE,
      getWorldPosition: (out) => {
        const object = sceneRegistry.nodes.get(nodeId)
        if (!object) return false
        object.getWorldPosition(out)
        return true
      },
      getIntensity: () => {
        const current = resolveHomeAssistantLightVisualState(adapter.getEntity(binding.entityId))
        return current.on ? current.brightness * MAX_LIGHT_INTENSITY : 0
      },
      isEligible: () =>
        resolveHomeAssistantLightVisualState(adapter.getEntity(binding.entityId)).on,
    }

    useItemLightPool.getState().register(source)
    return () => {
      useItemLightPool.getState().unregister(sourceKey)
    }
  }, [adapter, binding.enabled, binding.entityId, binding.nodeId, sourceKey, visual.color])

  return null
}

export default function Ha3dPresentation() {
  const project = useSyncExternalStore(
    subscribeHa3dProjectConfig,
    getHa3dProjectConfigSnapshot,
    getHa3dProjectConfigSnapshot,
  )
  const runtime = useSyncExternalStore(
    subscribeHomeAssistantRuntime,
    getHomeAssistantRuntimeSnapshot,
    getHomeAssistantRuntimeSnapshot,
  )

  return (
    <>
      {project.bindings
        .filter((binding) => binding.domain === 'light' && binding.enabled)
        .map((binding) => (
          <HaLightBinding
            binding={binding}
            key={`${binding.nodeId}:${binding.domain}`}
            runtime={runtime}
          />
        ))}
    </>
  )
}
