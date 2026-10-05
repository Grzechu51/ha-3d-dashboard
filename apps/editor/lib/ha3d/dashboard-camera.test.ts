import { describe, expect, test } from 'bun:test'
import { resolveHa3dDashboardCameraPose } from './dashboard-camera'

const bounds = {
  center: [5, 2, -3] as const,
  size: [10, 4, 6] as const,
}

describe('HA 3D dashboard camera presets', () => {
  test('all presets keep the scene center as their target', () => {
    for (const preset of ['fit', 'iso', 'top', 'front', 'right'] as const) {
      expect(resolveHa3dDashboardCameraPose(bounds, preset).target).toEqual([5, 2, -3])
    }
  })

  test('front and right presets sit on the expected world axes', () => {
    const front = resolveHa3dDashboardCameraPose(bounds, 'front')
    const right = resolveHa3dDashboardCameraPose(bounds, 'right')

    expect(front.position[0]).toBe(5)
    expect(front.position[2]).toBeGreaterThan(-3)
    expect(right.position[0]).toBeGreaterThan(5)
    expect(right.position[2]).toBe(-3)
  })

  test('fit preset stays close enough for a building-scale dashboard view', () => {
    const fit = resolveHa3dDashboardCameraPose(bounds, 'fit')
    const dx = fit.position[0] - bounds.center[0]
    const dy = fit.position[1] - bounds.center[1]
    const dz = fit.position[2] - bounds.center[2]
    const distance = Math.hypot(dx, dy, dz)

    expect(distance).toBeGreaterThan(10)
    expect(distance).toBeLessThan(22)
  })

  test('top preset stays almost directly above the target', () => {
    const top = resolveHa3dDashboardCameraPose(bounds, 'top')

    expect(top.position[0]).toBe(5)
    expect(top.position[1]).toBeGreaterThan(2)
    expect(top.position[2]).toBeCloseTo(-2.999, 6)
  })
})
