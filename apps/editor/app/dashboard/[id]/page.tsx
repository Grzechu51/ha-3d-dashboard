import type { SceneGraph } from '@pascal-app/editor'
import { headers } from 'next/headers'
import Link from 'next/link'
import { Ha3dDashboard, type Ha3dDashboardSceneMeta } from '@/components/ha3d/ha3d-dashboard'

export const dynamic = 'force-dynamic'

interface DashboardScene extends Ha3dDashboardSceneMeta {
  graph: SceneGraph
}

async function resolveBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

async function fetchScene(id: string): Promise<DashboardScene | null> {
  const base = await resolveBaseUrl()
  const response = await fetch(`${base}/api/scenes/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  })

  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Failed to load dashboard scene: ${response.status}`)
  return (await response.json()) as DashboardScene
}

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scene = await fetchScene(id)

  if (!scene) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background p-6 text-center shadow-xl">
          <p className="font-mono text-muted-foreground text-xs uppercase tracking-wide">404</p>
          <h1 className="mt-2 font-semibold text-lg">Dashboard scene not found</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            No saved scene exists with id <code className="font-mono">{id}</code>.
          </p>
          <Link
            className="mt-4 inline-flex rounded-md border border-border bg-accent px-3 py-2 font-medium text-sm hover:bg-accent/80"
            href="/scenes"
          >
            Browse scenes
          </Link>
        </div>
      </div>
    )
  }

  const { graph, ...meta } = scene
  return <Ha3dDashboard scene={graph} meta={meta} />
}
