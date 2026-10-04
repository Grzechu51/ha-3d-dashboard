'use client'

import { type AnyNodeId, emitter, type NodeEvent, sceneRegistry } from '@pascal-app/core'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import {
  getHa3dProjectConfigSnapshot,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'

type Ha3dDashboardInteractionsProps = {
  selectedNodeId?: string | null
  onSelectNode?: (nodeId: string | null) => void
}

function InteractiveBindingMarker({
  nodeId,
  active,
  hovered,
}: {
  nodeId: string
  active: boolean
  hovered: boolean
}) {
  const anchorRef = useRef<THREE.Group>(null)
  const helperRef = useRef<THREE.Box3Helper>(null)
  const box = useMemo(() => new THREE.Box3(), [])
  const center = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const object = sceneRegistry.nodes.get(nodeId as AnyNodeId)
    const anchor = anchorRef.current
    const helper = helperRef.current

    if (!object) {
      if (anchor) anchor.visible = false
      if (helper) helper.visible = false
      return
    }

    box.setFromObject(object)
    if (box.isEmpty()) {
      if (anchor) anchor.visible = false
      if (helper) helper.visible = false
      return
    }

    box.getCenter(center)
    center.y = box.max.y + 0.12

    if (anchor) {
      anchor.visible = true
      anchor.position.copy(center)
    }
    if (helper) {
      helper.visible = active || hovered
      helper.updateMatrixWorld(true)
    }
  })

  return (
    <>
      <box3Helper
        args={[box, active ? 0x38bdf8 : 0x93c5fd]}
        ref={helperRef}
        visible={active || hovered}
      />
      <group ref={anchorRef}>
        <Html center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            className={
              active
                ? 'rounded-full border border-sky-300 bg-sky-500/90 px-1.5 py-0.5 font-semibold text-[9px] text-white shadow-lg ring-2 ring-sky-300/40'
                : hovered
                  ? 'rounded-full border border-sky-300 bg-sky-500/80 px-1.5 py-0.5 font-semibold text-[9px] text-white shadow-lg'
                  : 'rounded-full border border-white/25 bg-black/65 px-1.5 py-0.5 font-semibold text-[9px] text-white/85 shadow-md'
            }
          >
            HA
          </div>
        </Html>
      </group>
    </>
  )
}

export function Ha3dDashboardInteractions({
  selectedNodeId = null,
  onSelectNode,
}: Ha3dDashboardInteractionsProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const gl = useThree((state) => state.gl)
  const runtime = useSyncExternalStore(
    subscribeHomeAssistantRuntime,
    getHomeAssistantRuntimeSnapshot,
    getHomeAssistantRuntimeSnapshot,
  )
  const project = useSyncExternalStore(
    subscribeHa3dProjectConfig,
    getHa3dProjectConfigSnapshot,
    getHa3dProjectConfigSnapshot,
  )

  const activeBindings = useMemo(
    () => project.bindings.filter((binding) => binding.enabled),
    [project.bindings],
  )
  const boundNodeIds = useMemo(
    () => Array.from(new Set(activeBindings.map((binding) => binding.nodeId))),
    [activeBindings],
  )

  useEffect(() => {
    const bindingsForNode = (nodeId: string) =>
      activeBindings.filter((binding) => binding.nodeId === nodeId)

    const onEnter = (event: NodeEvent) => {
      if (bindingsForNode(event.node.id).length === 0) return
      setHoveredNodeId(event.node.id)
      gl.domElement.style.cursor = 'pointer'
    }

    const onLeave = (event: NodeEvent) => {
      if (event.node.id !== hoveredNodeId) return
      setHoveredNodeId(null)
      gl.domElement.style.cursor = ''
    }

    const onClick = (event: NodeEvent) => {
      const bindings = bindingsForNode(event.node.id)
      if (bindings.length === 0) return

      event.stopPropagation()
      onSelectNode?.(event.node.id)

      const adapter = runtime.adapter
      if (!adapter) return

      for (const binding of bindings) {
        if (binding.domain !== 'light' && binding.domain !== 'switch') continue
        const entity = adapter.getEntity(binding.entityId)
        if (!entity) continue
        void adapter
          .callService({
            domain: binding.domain,
            service: entity.state === 'on' ? 'turn_off' : 'turn_on',
            target: { entityId: binding.entityId },
          })
          .catch((error) => {
            console.error('[ha3d] dashboard entity click failed', error)
          })
      }
    }

    emitter.on('node:enter' as never, onEnter as never)
    emitter.on('node:leave' as never, onLeave as never)
    emitter.on('node:click' as never, onClick as never)

    return () => {
      emitter.off('node:enter' as never, onEnter as never)
      emitter.off('node:leave' as never, onLeave as never)
      emitter.off('node:click' as never, onClick as never)
      gl.domElement.style.cursor = ''
    }
  }, [activeBindings, gl, hoveredNodeId, onSelectNode, runtime.adapter])

  return (
    <>
      {boundNodeIds.map((nodeId) => (
        <InteractiveBindingMarker
          active={selectedNodeId === nodeId}
          hovered={hoveredNodeId === nodeId}
          key={nodeId}
          nodeId={nodeId}
        />
      ))}
    </>
  )
}
