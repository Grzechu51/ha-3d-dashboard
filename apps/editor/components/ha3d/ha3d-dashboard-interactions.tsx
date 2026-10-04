'use client'

import { emitter, type NodeEvent, sceneRegistry } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  getHa3dProjectConfigSnapshot,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import { getHomeAssistantRuntimeSnapshot } from '../../lib/ha3d/runtime'

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

function actionableBindingForNode(nodeId: string) {
  const bindings = getHa3dProjectConfigSnapshot().bindings.filter(
    (binding) => binding.enabled && binding.nodeId === nodeId,
  )
  return (
    bindings.find((binding) => binding.domain === 'light') ??
    bindings.find((binding) => binding.domain === 'switch') ??
    bindings.find((binding) => binding.domain === 'cover') ??
    bindings[0] ??
    null
  )
}

async function runDefaultDashboardAction(nodeId: string): Promise<void> {
  const binding = actionableBindingForNode(nodeId)
  if (!binding) return

  const adapter = getHomeAssistantRuntimeSnapshot().adapter
  if (!adapter) return
  const entity = adapter.getEntity(binding.entityId)
  if (!entity) return

  if (binding.domain === 'light' || binding.domain === 'switch') {
    await adapter.callService({
      domain: binding.domain,
      service: entity.state === 'on' ? 'turn_off' : 'turn_on',
      target: { entityId: binding.entityId },
    })
    return
  }

  if (binding.domain === 'cover') {
    const shouldOpen = entity.state === 'closed' || entity.state === 'closing'
    await adapter.callService({
      domain: 'cover',
      service: shouldOpen ? 'open_cover' : 'close_cover',
      target: { entityId: binding.entityId },
    })
  }
}

export function Ha3dDashboardInteractions({
  selectedNodeId,
  highlightsEnabled,
  onSelectedNodeIdChange,
}: {
  selectedNodeId: string | null
  highlightsEnabled: boolean
  onSelectedNodeIdChange: (nodeId: string | null) => void
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
          project.bindings
            .filter((binding) => binding.enabled)
            .map((binding) => binding.nodeId),
        ),
      ),
    [project.bindings],
  )

  const syncOutliner = useCallback(() => {
    const outliner = useViewer.getState().outliner
    const selectedObjects =
      selectedNodeId && interactiveNodeIds.includes(selectedNodeId)
        ? sceneObjectsForNodeIds([selectedNodeId])
        : []
    const highlightedObjects = highlightsEnabled
      ? sceneObjectsForNodeIds(
          interactiveNodeIds.filter((nodeId) => nodeId !== selectedNodeId),
        )
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

  useEffect(() => {
    const onNodeClick = (event: NodeEvent) => {
      const nodeId = event.node.id
      if (!actionableBindingForNode(nodeId)) return

      event.stopPropagation()
      onSelectedNodeIdChange(nodeId)
      void runDefaultDashboardAction(nodeId).catch((error) => {
        console.error('[ha3d] dashboard entity action failed', error)
      })
    }

    emitter.on('node:click', onNodeClick)
    return () => emitter.off('node:click', onNodeClick)
  }, [onSelectedNodeIdChange])

  return null
}
