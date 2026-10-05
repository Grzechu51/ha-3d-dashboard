'use client'

import { useEffect, useRef, useState } from 'react'
import type { HomeAssistantLovelaceHost } from '../../lib/ha3d/lovelace-host'
import {
  createHomeAssistantLovelaceCard,
  type Ha3dLovelaceCardConfig,
} from '../../lib/ha3d/lovelace-runtime'

export function Ha3dLovelaceCard({
  config,
  hass,
  preview = false,
}: {
  config: Ha3dLovelaceCardConfig
  hass: HomeAssistantLovelaceHost
  preview?: boolean
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<(HTMLElement & { hass?: HomeAssistantLovelaceHost }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cardRef.current) cardRef.current.hass = hass
  }, [hass])

  useEffect(() => {
    let cancelled = false
    const mount = mountRef.current
    if (!mount) return

    setError(null)
    mount.replaceChildren()
    cardRef.current = null

    void createHomeAssistantLovelaceCard(hass, config, preview)
      .then((card) => {
        if (cancelled) return
        card.style.display = 'block'
        card.style.width = '100%'
        cardRef.current = card
        mount.replaceChildren(card)
      })
      .catch((cause) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : String(cause))
      })

    return () => {
      cancelled = true
      cardRef.current = null
      mount.replaceChildren()
    }
  }, [config, hass, preview])

  return (
    <>
      {error ? (
        <div className="rounded-xl border border-[var(--ha3d-dashboard-error-ring)] bg-[var(--ha3d-dashboard-error-soft)] p-3 text-[var(--ha3d-dashboard-error)] text-xs">
          {error}
        </div>
      ) : null}
      <div
        className="ha3d-lovelace-card min-w-0 [&>hui-card]:block [&>hui-card]:w-full"
        ref={mountRef}
      />
    </>
  )
}
