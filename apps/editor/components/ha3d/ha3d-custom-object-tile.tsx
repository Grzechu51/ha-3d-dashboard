'use client'

import { type AssetInput, saveAsset } from '@pascal-app/core'
import { activateCatalogItem } from '@pascal-app/editor'
import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Box3, type Material, type Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MAX_CUSTOM_GLB_BYTES = 50 * 1024 * 1024
const CUSTOM_OBJECT_THUMBNAIL =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22256%22 height=%22256%22 viewBox=%220 0 256 256%22%3E%3Crect width=%22256%22 height=%22256%22 rx=%2232%22 fill=%22%23111827%22/%3E%3Cpath d=%22M128 48 198 88v80l-70 40-70-40V88l70-40Zm0 18-52 30 52 30 52-30-52-30Zm-58 46v46l49 28v-46l-49-28Zm67 28v46l49-28v-46l-49 28Z%22 fill=%22%2367e8f9%22/%3E%3C/svg%3E'

function disposeMaterial(material: Material | Material[]) {
  if (Array.isArray(material)) {
    for (const entry of material) entry.dispose()
    return
  }
  material.dispose()
}

async function inspectGlb(file: File): Promise<{
  dimensions: [number, number, number]
  offset: [number, number, number]
}> {
  const loader = new GLTFLoader()
  const gltf = await loader.parseAsync(await file.arrayBuffer(), '')
  const box = new Box3().setFromObject(gltf.scene, true)

  try {
    if (box.isEmpty()) {
      return { dimensions: [1, 1, 1], offset: [0, 0, 0] }
    }

    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const safe = (value: number) => Math.max(Number.isFinite(value) ? value : 0, 0.01)

    return {
      dimensions: [safe(size.x), safe(size.y), safe(size.z)],
      offset: [-center.x, -box.min.y, -center.z],
    }
  } finally {
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      mesh.geometry?.dispose()
      if (mesh.material) disposeMaterial(mesh.material)
    })
  }
}

export function Ha3dCustomObjectTile() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importGlb = async (file: File | undefined) => {
    if (!(file && !busy)) return
    setError(null)

    if (!file.name.toLowerCase().endsWith('.glb')) {
      setError('Choose a .glb file.')
      return
    }
    if (file.size > MAX_CUSTOM_GLB_BYTES) {
      setError('GLB is larger than 50 MB.')
      return
    }

    setBusy(true)
    try {
      const { dimensions, offset } = await inspectGlb(file)
      const src = await saveAsset(file)
      const baseName = file.name.replace(/\.glb$/i, '').trim() || 'Custom object'
      const asset: AssetInput = {
        id: `ha3d-custom-${Date.now().toString(36)}`,
        category: 'furniture',
        name: baseName,
        thumbnail: CUSTOM_OBJECT_THUMBNAIL,
        src,
        dimensions,
        offset,
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        tags: ['custom'],
        source: 'mine',
      }

      activateCatalogItem(asset)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this GLB.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="relative">
      <input
        accept=".glb,model/gltf-binary"
        className="hidden"
        onChange={(event) => void importGlb(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      <button
        className="group flex w-full flex-col gap-1.5 rounded-xl border border-dashed border-cyan-400/35 bg-cyan-400/5 p-1.5 text-left transition-colors hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-wait disabled:opacity-60"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title="Import a local GLB and place it in this project"
        type="button"
      >
        <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-background/70">
          <Upload className="h-7 w-7 text-cyan-300" />
        </span>
        <span className="truncate px-0.5 font-medium text-[11px] text-cyan-100">
          {busy ? 'Reading GLB…' : 'Add GLB'}
        </span>
        <span className="px-0.5 text-[9px] leading-tight text-muted-foreground">Custom object</span>
      </button>
      {error ? (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border border-destructive/30 bg-background/95 p-2 text-destructive text-[10px] shadow-xl">
          {error}
        </div>
      ) : null}
    </div>
  )
}
