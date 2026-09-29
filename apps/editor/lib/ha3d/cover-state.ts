import type { CoverMotionConfig } from './entity-binding'
import type { HomeAssistantEntityState } from './home-assistant-adapter'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function resolveHomeAssistantCoverOpenFraction(
  entity: HomeAssistantEntityState | undefined,
): number {
  const currentPosition = entity?.attributes.current_position
  if (typeof currentPosition === 'number' && Number.isFinite(currentPosition)) {
    return clamp(currentPosition / 100, 0, 1)
  }

  if (entity?.state === 'open' || entity?.state === 'opening') return 1
  return 0
}

export function resolveCoverOpenOffset(
  entity: HomeAssistantEntityState | undefined,
  motion: CoverMotionConfig,
): number {
  return resolveHomeAssistantCoverOpenFraction(entity) * motion.openOffsetMeters
}

export function stepCoverOffset(
  current: number,
  target: number,
  deltaSeconds: number,
  durationMs: number,
): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return target
  if (durationMs <= 0) return target
  if (deltaSeconds <= 0) return current

  const durationSeconds = durationMs / 1000
  const factor = 1 - Math.exp((-4.605170186 * deltaSeconds) / durationSeconds)
  const next = current + (target - current) * clamp(factor, 0, 1)
  return Math.abs(target - next) < 0.0001 ? target : next
}
