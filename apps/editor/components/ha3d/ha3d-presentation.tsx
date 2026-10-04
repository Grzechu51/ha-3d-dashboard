'use client'

import { type AnyNodeId, sceneRegistry } from '@pascal-app/core'
import { type LightSource, useItemLightPool } from '@pascal-app/viewer'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Group, Object3D, Vector3 } from 'three'
import { resolveCoverOpenOffset, stepCoverOffset } from '../../lib/ha3d/cover-state'
import { DEFAULT_COVER_MOTION, type EntityBinding } from '../../lib/ha3d/entity-binding'
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
const EXTERNAL_POSITION_EPSILON_SQ = 0.00000001

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

function HaCoverBinding({
  binding,
  runtime,
}: {
  binding: EntityBinding
  runtime: ReturnType<typeof getHomeAssistantRuntimeSnapshot>
}) {
  const motion = binding.coverMotion ?? DEFAULT_COVER_MOTION
  const objectRef = useRef<Object3D | null>(null)
  const basePositionRef = useRef<Vector3 | null>(null)
  const expectedPositionRef = useRef<Vector3 | null>(null)
  const currentOffsetRef = useRef(0)

  useEffect(() => {
    return () => {
      const object = objectRef.current
      const basePosition = basePositionRef.current
      if (object && basePosition) object.position.copy(basePosition)
      objectRef.current = null
      basePositionRef.current = null
      expectedPositionRef.current = null
      currentOffsetRef.current = 0
    }
  }, [motion.axis, runtime.adapter])

  useFrame((_, deltaSeconds) => {
    const adapter = runtime.adapter
    if (!adapter || !binding.enabled) return

    const nodeId = binding.nodeId as AnyNodeId
    const object = sceneRegistry.nodes.get(nodeId)
    if (!object) return

    const targetOffset = resolveCoverOpenOffset(adapter.getEntity(binding.entityId), motion)

    if (objectRef.current !== object) {
      objectRef.current = object
      basePositionRef.current = object.position.clone()
      expectedPositionRef.current = object.position.clone()
      currentOffsetRef.current = targetOffset
    } else {
      const expectedPosition = expectedPositionRef.current
      if (
        expectedPosition &&
        object.position.distanceToSquared(expectedPosition) > EXTERNAL_POSITION_EPSILON_SQ
      ) {
        basePositionRef.current = object.position.clone()
      }
      currentOffsetRef.current = stepCoverOffset(
        currentOffsetRef.current,
        targetOffset,
        deltaSeconds,
        motion.durationMs,
      )
    }

    const basePosition = basePositionRef.current
    if (!basePosition) return

    const nextPosition = basePosition.clone()
    nextPosition[motion.axis] += currentOffsetRef.current
    object.position.copy(nextPosition)

    if (expectedPositionRef.current) expectedPositionRef.current.copy(nextPosition)
    else expectedPositionRef.current = nextPosition.clone()
  })

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
      {project.bindings
        .filter((binding) => binding.domain === 'cover' && binding.enabled)
        .map((binding) => (
          <HaCoverBinding
            binding={binding}
            key={`${binding.nodeId}:${binding.domain}`}
            runtime={runtime}
          />
        ))}
    </>
  )
}
