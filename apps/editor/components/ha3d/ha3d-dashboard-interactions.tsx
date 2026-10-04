'use client'

import { emitter, type NodeEvent, sceneRegistry } from '@pascal-app/core'
import { EDITOR_LAYER } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Mesh,
  type Object3D,
} from 'three'
import {
  type EntityBinding,
  resolveDashboardInteractionAction,
} from '../../lib/ha3d/entity-binding'
import { entityFriendlyName, formatHomeAssistantEntityValue } from '../../lib/ha3d/entity-display'
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
    visibleColor: 0x22_d3ee,
    hiddenColor: 0x38_bdf8,
    strength: 5.5,
    pulse: true,
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

  if (
    binding.domain === 'light' ||
    binding.domain === 'switch' ||
    binding.domain === 'input_boolean'
  ) {
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

type HighlightEdgeEntry = Readonly<{
  source: Object3D
  line: LineSegments
}>

function isWorldVisible(object: Object3D): boolean {
  let current: Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}

function InteractiveEntityHighlight({ nodeId, selected }: { nodeId: string; selected: boolean }) {
  const geometryRevision = useViewer((state) => state.geometryRevision)
  const group = useMemo(() => {
    const next = new Group()
    next.name = `ha3d-highlight:${nodeId}`
    next.renderOrder = 10_000
    next.layers.set(EDITOR_LAYER)
    return next
  }, [nodeId])
  const material = useMemo(() => {
    const next = new LineBasicMaterial({
      color: selected ? 0xff_ff_ff : 0x22_d3ee,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    return next
  }, [selected])
  const entriesRef = useRef<HighlightEdgeEntry[]>([])
  const builtRootRef = useRef<Object3D | null>(null)
  const builtRevisionRef = useRef(-1)

  const clearEdges = useCallback(() => {
    for (const entry of entriesRef.current) {
      entry.line.geometry.dispose()
      group.remove(entry.line)
    }
    entriesRef.current = []
    builtRootRef.current = null
  }, [group])

  const rebuildEdges = useCallback(
    (root: Object3D) => {
      clearEdges()
      root.updateWorldMatrix(true, true)

      const entries: HighlightEdgeEntry[] = []
      root.traverse((child) => {
        const mesh = child as Mesh
        if (!(mesh.isMesh && mesh.geometry?.getAttribute('position'))) return

        const geometry = new EdgesGeometry(mesh.geometry, 32)
        const positions = geometry.getAttribute('position')
        if (!positions || positions.count === 0) {
          geometry.dispose()
          return
        }

        const line = new LineSegments(geometry, material)
        line.name = `ha3d-highlight-edge:${nodeId}`
        line.matrixAutoUpdate = false
        line.matrix.copy(mesh.matrixWorld)
        line.matrixWorldNeedsUpdate = true
        line.renderOrder = 10_000
        line.frustumCulled = false
        line.layers.set(EDITOR_LAYER)
        line.raycast = () => {}
        group.add(line)
        entries.push({ source: mesh, line })
      })

      entriesRef.current = entries
      builtRootRef.current = root
      builtRevisionRef.current = geometryRevision
    },
    [clearEdges, geometryRevision, group, material, nodeId],
  )

  useEffect(
    () => () => {
      clearEdges()
      material.dispose()
    },
    [clearEdges, material],
  )

  useFrame(({ clock }) => {
    const root = sceneRegistry.nodes.get(nodeId)
    if (!root) {
      group.visible = false
      builtRootRef.current = null
      return
    }

    if (builtRootRef.current !== root || builtRevisionRef.current !== geometryRevision) {
      rebuildEdges(root)
    }

    root.updateWorldMatrix(true, true)
    for (const entry of entriesRef.current) {
      entry.line.visible = isWorldVisible(entry.source)
      entry.line.matrix.copy(entry.source.matrixWorld)
      entry.line.matrixWorldNeedsUpdate = true
    }

    group.visible = isWorldVisible(root) && entriesRef.current.length > 0
    material.color.setHex(selected ? 0xff_ff_ff : 0x22_d3ee)
    material.opacity = selected ? 1 : 0.64 + ((Math.sin(clock.elapsedTime * 3.2) + 1) / 2) * 0.28
  })

  return <primitive object={group} />
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

  const active = !['off', 'closed', 'idle', 'unavailable', 'unknown'].includes(entity.state)

  return (
    <group ref={groupRef} visible={located}>
      <Html center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <div
          className={
            selected
              ? 'relative whitespace-nowrap rounded-xl border border-cyan-300/90 bg-slate-950/90 px-3 py-2 text-white shadow-2xl ring-1 ring-cyan-300/35 backdrop-blur-md'
              : 'relative whitespace-nowrap rounded-xl border border-white/15 bg-black/75 px-3 py-2 text-white shadow-xl backdrop-blur-md'
          }
        >
          <div className="max-w-44 truncate font-medium text-[11px] leading-none">
            {entityFriendlyName(entity)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/75">
            <span
              className={
                active
                  ? 'inline-block size-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]'
                  : 'inline-block size-1.5 rounded-full bg-slate-400'
              }
            />
            {formatHomeAssistantEntityValue(entity)}
          </div>
          <span className="absolute top-full left-1/2 h-3 w-px -translate-x-1/2 bg-white/30" />
          <span className="absolute top-[calc(100%+0.7rem)] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-white/60" />
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
  onShowMoreInfo,
}: {
  selectedNodeId: string | null
  expandedNodeId?: string | null
  highlightsEnabled: boolean
  markersEnabled: boolean
  onSelectedNodeIdChange: (nodeId: string | null) => void
  onExpandedNodeIdChange?: (nodeId: string | null) => void
  onShowMoreInfo?: (entityId: string) => void
}) {
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    const previousMask = camera.layers.mask
    camera.layers.enable(EDITOR_LAYER)
    return () => {
      camera.layers.mask = previousMask
    }
  }, [camera])

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
      const showMoreInfo = () => {
        if (onShowMoreInfo) {
          onShowMoreInfo(binding.entityId)
          return
        }
        onExpandedNodeIdChange?.(nodeId)
      }
      const action = resolveDashboardInteractionAction(binding, gesture)

      if (action === 'none') return
      if (action === 'more-info') {
        showMoreInfo()
        return
      }

      onExpandedNodeIdChange?.(null)
      void toggleBinding(binding)
        .then((handled) => {
          if (!handled) showMoreInfo()
        })
        .catch((error) => {
          console.error('[ha3d] dashboard entity action failed', error)
        })
    },
    [onExpandedNodeIdChange, onSelectedNodeIdChange, onShowMoreInfo],
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
      {highlightsEnabled
        ? interactiveNodeIds.map((nodeId) => (
            <InteractiveEntityHighlight
              key={`${nodeId}:dashboard-highlight`}
              nodeId={nodeId}
              selected={nodeId === selectedNodeId}
            />
          ))
        : null}
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
