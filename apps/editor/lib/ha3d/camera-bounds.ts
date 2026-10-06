import { sceneRegistry, useScene } from '@pascal-app/core'
import { getLevelPresentationY } from '@pascal-app/viewer'
import { Box3, Vector3 } from 'three'

const resolvedBounds = new Box3()
const levelBounds = new Box3()
const levelOffset = new Vector3()

function hasFiniteBounds(bounds: Box3) {
  return (
    Number.isFinite(bounds.min.x) &&
    Number.isFinite(bounds.min.y) &&
    Number.isFinite(bounds.min.z) &&
    Number.isFinite(bounds.max.x) &&
    Number.isFinite(bounds.max.y) &&
    Number.isFinite(bounds.max.z)
  )
}

function expandLevelAtPresentationY(target: Box3, levelId: string, solo: boolean) {
  const levelObject = sceneRegistry.nodes.get(levelId)
  if (!levelObject) return false

  levelBounds.makeEmpty()
  levelBounds.setFromObject(levelObject, true)
  if (levelBounds.isEmpty() || !hasFiniteBounds(levelBounds)) return false

  const targetY = getLevelPresentationY(
    levelId,
    useScene.getState().nodes,
    solo ? 'solo' : 'stacked',
  )
  if (Number.isFinite(targetY) && Number.isFinite(levelObject.position.y)) {
    levelBounds.translate(levelOffset.set(0, targetY - levelObject.position.y, 0))
  }

  target.union(levelBounds)
  return true
}

/**
 * Camera framing must follow the level's analytic presentation position rather
 * than the level group's transient animated Y. This keeps Fit/Iso/Top/Front/Right
 * stable while LevelSystem is settling and prevents a stale level transform from
 * sending the camera far away.
 */
export function resolveHa3dSceneCameraBounds(levelId: string | null, solo: boolean): Box3 | null {
  resolvedBounds.makeEmpty()

  if (solo && levelId && expandLevelAtPresentationY(resolvedBounds, levelId, true)) {
    return resolvedBounds
  }

  // If the selected level is not registered yet, fall back to all authored
  // levels instead of the whole Three.js scene (which may include Site/terrain).
  resolvedBounds.makeEmpty()
  for (const candidateId of sceneRegistry.byType.level ?? []) {
    expandLevelAtPresentationY(resolvedBounds, candidateId, false)
  }

  if (!resolvedBounds.isEmpty() && hasFiniteBounds(resolvedBounds)) {
    return resolvedBounds
  }

  // Older / partial scenes may not have registered level groups yet.
  for (const buildingId of sceneRegistry.byType.building ?? []) {
    const buildingObject = sceneRegistry.nodes.get(buildingId)
    if (buildingObject) resolvedBounds.expandByObject(buildingObject, true)
  }

  if (resolvedBounds.isEmpty()) {
    for (const [nodeId, object] of sceneRegistry.nodes) {
      if (sceneRegistry.byType.site?.has(nodeId)) continue
      resolvedBounds.expandByObject(object, true)
    }
  }

  return resolvedBounds.isEmpty() || !hasFiniteBounds(resolvedBounds) ? null : resolvedBounds
}
