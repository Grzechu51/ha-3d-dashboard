'use client'

import { emitter, type NodeEvent, sceneRegistry } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Group } from 'three'
import {
  type EntityBinding,
  resolveDashboardInteractionAction,
} from '../../lib/ha3d/entity-binding'
import {
  entityFriendlyName,
  formatHomeAssistantEntityValue,
} from '../../lib/ha3d/entity-display'
import {
  getHa3dProjectConfigSnapshot,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'

const HOLD_THRESHOLD_MS = 520
const CLICK_SUPPRESS_MS = 450
const MAX_GESTURE_MOVE_PX = 8

export const HA3D_INTERACTIVE_HOVER_STYLES = {
  default: {
    visibleColor: 0x38_bdf8,
    hiddenColor: 0x38_bdf8,
    strength: 1.25,
    pulse: false,
  },
}

function sceneObjectsForNodeIds(nodeIds: readonly string[]) {
  return nodeIds.flatMap((nodeId) => {
    const object = sceneRegistry.nodes.get(nodeId)
    return object ? [object] : []
  })
}

function bindingsForNode(nodeId: string) {
  return getHa3dProjectConfigSnapshot().bindings.filter(
    (binding) => binding.enabled && binding.nodeId === nodeId,
  )
}

function actionableBindingForNode(nodeId: string): EntityBinding | null {
  const bindings = bindingsForNode(nodeId)
  return (
    bindings.find((binding) => binding.domain === 'light') ??
    bindings.find((binding) => binding.domain === 'switch') ??
    bindings.find((binding) => binding.domain === 'cover') ??
    bindings[0] ??
    null
  )
}

async function toggleBinding(binding: EntityBinding): Promise<boolean> {
  const adapter = getHomeAssistantRuntimeSnapshot().adapter
  if (!adapter) return false
  const entity = adapter.getEntity(binding.entityId)
  if (!entity) return false

  if (binding.domain === 'light' || binding.domain === 'switch') {
    await adapter.callService({
      domain: binding.domain,
      service: entity.state === 'on' ? 'turn_off' : 'turn_on',
      target: { entityId: binding.entityId },
    })
    return true
  }

  if (binding.domain === 'cover') {
    const shouldOpen = entity.state === 'closed' || entity.state === 'closing'
    await adapter.callService({
      domain: 'cover',
      service: shouldOpen ? 'open_cover' : 'close_cover',
      target: { entityId: binding.entityId },
    })
    return true
  }

  return false
}

function InteractiveEntityMarker({
  binding,
  selected,
}: {
  binding: EntityBinding
  selected: boolean
}) {
  const groupRef = useRef<Group | null>(null)
  const [located, setLocated] = useState(false)
  const runtime = useSyncExternalStore(
    subscribeHomeAssistantRuntime,
    getHomeAssistantRuntimeSnapshot,
    getHomeAssistantRuntimeSnapshot,
  )
  const entity = runtime.adapter?.getEntity(binding.entityId)

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const object = sceneRegistry.nodes.get(binding.nodeId)
    if (!object) {
      if (located) setLocated(false)
      return
    }

    object.getWorldPosition(group.position)
    group.position.y += 0.42
    if (!located) setLocated(true)
  })

  if (!entity) return null

  return (
    <group ref={groupRef} visible={located}>
      <Html center distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <div
          className={
            selected
              ? 'whitespace-nowrap rounded-lg border border-sky-300/80 bg-sky-950/90 px-2.5 py-1.5 text-sky-50 shadow-xl ring-1 ring-sky-400/30 backdrop-blur-md'
              : 'whitespace-nowrap rounded-lg border border-sky-400/40 bg-background/88 px-2.5 py-1.5 text-foreground shadow-lg backdrop-blur-md'
          }
        >
          <div className="max-w-40 truncate text-[10px] opacity-75">
            {entityFriendlyName(entity)}
          </div>
          <div className="flex items-center gap-1.5 font-medium text-[11px]">
            <span className="inline-block size-1.5 rounded-full bg-sky-400" />
            {formatHomeAssistantEntityValue(entity)}
          </div>
        </div>
      </Html>
    </group>
  )
}

export function Ha3dDashboardInteractions({
  selectedNodeId,
  expandedNodeId,
  highlightsEnabled,
  markersEnabled,
  onSelectedNodeIdChange,
  onExpandedNodeIdChange,
}: {
  selectedNodeId: string | null
  expandedNodeId: string | null
  highlightsEnabled: boolean
  markersEnabled: boolean
  onSelectedNodeIdChange: (nodeId: string | null) => void
  onExpandedNodeIdChange: (nodeId: string | null) => void
}) {
  const project = useSyncExternalStore(
    subscribeHa3dProjectConfig,
    getHa3dProjectConfigSnapshot,
    getHa3dProjectConfigSnapshot,
  )
  const interactiveNodeIds = useMemo(
    () =>
      Array.from(
        new Set(
          project.bindings.filter((binding) => binding.enabled).map((binding) => binding.nodeId),
        ),
      ),
    [project.bindings],
  )
  const markerBindings = useMemo(
    () =>
      interactiveNodeIds.flatMap((nodeId) => {
        const binding =
          project.bindings.find(
            (candidate) =>
              candidate.enabled && candidate.nodeId === nodeId && candidate.domain === 'light',
          ) ??
          project.bindings.find(
            (candidate) =>
              candidate.enabled && candidate.nodeId === nodeId && candidate.domain === 'switch',
          ) ??
          project.bindings.find(
            (candidate) =>
              candidate.enabled && candidate.nodeId === nodeId && candidate.domain === 'cover',
          ) ??
          project.bindings.find((candidate) => candidate.enabled && candidate.nodeId === nodeId)
        return binding ? [binding] : []
      }),
    [interactiveNodeIds, project.bindings],
  )

  const pressRef = useRef<{
    nodeId: string
    startedAt: number
    pointerId: number | undefined
    clientX: number
    clientY: number
  } | null>(null)
  const recentPointerActionRef = useRef<{ nodeId: string; at: number } | null>(null)

  const syncOutliner = useCallback(() => {
    const outliner = useViewer.getState().outliner
    const selectedObjects =
      selectedNodeId && interactiveNodeIds.includes(selectedNodeId)
        ? sceneObjectsForNodeIds([selectedNodeId])
        : []
    const highlightedObjects = highlightsEnabled
      ? sceneObjectsForNodeIds(interactiveNodeIds.filter((nodeId) => nodeId !== selectedNodeId))
      : []

    const selectedChanged =
      outliner.selectedObjects.length !== selectedObjects.length ||
      outliner.selectedObjects.some((object, index) => object !== selectedObjects[index])
    if (selectedChanged) {
      outliner.selectedObjects.length = 0
      outliner.selectedObjects.push(...selectedObjects)
    }

    const highlightedChanged =
      outliner.hoveredObjects.length !== highlightedObjects.length ||
      outliner.hoveredObjects.some((object, index) => object !== highlightedObjects[index])
    if (highlightedChanged) {
      outliner.hoveredObjects.length = 0
      outliner.hoveredObjects.push(...highlightedObjects)
    }
  }, [highlightsEnabled, interactiveNodeIds, selectedNodeId])

  useFrame(syncOutliner)

  useEffect(() => {
    syncOutliner()
    return () => {
      const outliner = useViewer.getState().outliner
      outliner.selectedObjects.length = 0
      outliner.hoveredObjects.length = 0
    }
  }, [syncOutliner])

  const executeGesture = useCallback(
    (nodeId: string, gesture: 'tap' | 'hold') => {
      const binding = actionableBindingForNode(nodeId)
      if (!binding) return

      onSelectedNodeIdChange(nodeId)
      const action = resolveDashboardInteractionAction(binding, gesture)

      if (action === 'none') return
      if (action === 'more-info') {
        onExpandedNodeIdChange(nodeId)
        return
      }

      onExpandedNodeIdChange(null)
      void toggleBinding(binding)
        .then((handled) => {
          if (!handled) onExpandedNodeIdChange(nodeId)
        })
        .catch((error) => {
          console.error('[ha3d] dashboard entity action failed', error)
        })
    },
    [onExpandedNodeIdChange, onSelectedNodeIdChange],
  )

  useEffect(() => {
    const onNodePointerDown = (event: NodeEvent) => {
      const nodeId = event.node.id
      if (!actionableBindingForNode(nodeId)) return
      const native = event.nativeEvent
      pressRef.current = {
        nodeId,
        startedAt: performance.now(),
        pointerId: native.pointerId,
        clientX: native.clientX,
        clientY: native.clientY,
      }
    }

    const onNodePointerUp = (event: NodeEvent) => {
      const press = pressRef.current
      pressRef.current = null
      if (!(press && press.nodeId === event.node.id)) return
      if (
        press.pointerId !== undefined &&
        event.nativeEvent.pointerId !== undefined &&
        press.pointerId !== event.nativeEvent.pointerId
      ) {
        return
      }

      const moved = Math.hypot(
        event.nativeEvent.clientX - press.clientX,
        event.nativeEvent.clientY - press.clientY,
      )
      if (moved > MAX_GESTURE_MOVE_PX) return

      event.stopPropagation()
      event.nativeEvent.stopPropagation()
      const gesture = performance.now() - press.startedAt >= HOLD_THRESHOLD_MS ? 'hold' : 'tap'
      recentPointerActionRef.current = { nodeId: press.nodeId, at: performance.now() }
      executeGesture(press.nodeId, gesture)
    }

    const onNodeClick = (event: NodeEvent) => {
      const nodeId = event.node.id
      if (!actionableBindingForNode(nodeId)) return

      event.stopPropagation()
      const recent = recentPointerActionRef.current
      if (recent && recent.nodeId === nodeId && performance.now() - recent.at < CLICK_SUPPRESS_MS) {
        return
      }

      executeGesture(nodeId, 'tap')
    }

    emitter.on('node:pointerdown', onNodePointerDown)
    emitter.on('node:pointerup', onNodePointerUp)
    emitter.on('node:click', onNodeClick)
    return () => {
      emitter.off('node:pointerdown', onNodePointerDown)
      emitter.off('node:pointerup', onNodePointerUp)
      emitter.off('node:click', onNodeClick)
    }
  }, [executeGesture])

  return (
    <>
      {markersEnabled
        ? markerBindings.map((binding) => (
            <InteractiveEntityMarker
              binding={binding}
              key={`${binding.nodeId}:${binding.entityId}:dashboard-marker`}
              selected={binding.nodeId === selectedNodeId || binding.nodeId === expandedNodeId}
            />
          ))
        : null}
    </>
  )
}
