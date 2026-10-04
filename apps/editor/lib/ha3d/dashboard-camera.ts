export type Ha3dDashboardCameraPreset = 'fit' | 'iso' | 'top' | 'front' | 'right'

export type Ha3dDashboardCameraBounds = Readonly<{
  center: readonly [number, number, number]
  size: readonly [number, number, number]
}>

export type Ha3dDashboardCameraPose = Readonly<{
  position: readonly [number, number, number]
  target: readonly [number, number, number]
}>

export function resolveHa3dDashboardCameraPose(
  bounds: Ha3dDashboardCameraBounds,
  preset: Ha3dDashboardCameraPreset,
): Ha3dDashboardCameraPose {
  const [cx, cy, cz] = bounds.center
  const [sx, sy, sz] = bounds.size
  const maxDimension = Math.max(sx, sy, sz, 1)
  const distance = Math.max(maxDimension * 2.2, 8)
  const eyeLevel = cy + Math.max(sy * 0.12, 0.8)
  const target: readonly [number, number, number] = [cx, cy, cz]

  switch (preset) {
    case 'top':
      return {
        position: [cx, cy + distance, cz + 0.001],
        target,
      }
    case 'front':
      return {
        position: [cx, eyeLevel, cz + distance],
        target,
      }
    case 'right':
      return {
        position: [cx + distance, eyeLevel, cz],
        target,
      }
    case 'iso':
      return {
        position: [cx + distance * 0.62, cy + distance * 0.72, cz + distance * 0.62],
        target,
      }
    case 'fit':
      return {
        position: [cx + distance * 0.74, cy + distance * 0.56, cz + distance * 0.74],
        target,
      }
  }
}
