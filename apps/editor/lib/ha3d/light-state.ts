import type { HomeAssistantEntityState } from './home-assistant-adapter'

export type HomeAssistantLightVisualState = Readonly<{
  on: boolean
  brightness: number
  color: string
}>

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function byteHex(value: number): string {
  return Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, '0')
}

function rgbColor(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < 3) return null
  const [red, green, blue] = value
  if (
    typeof red !== 'number' ||
    typeof green !== 'number' ||
    typeof blue !== 'number' ||
    !Number.isFinite(red) ||
    !Number.isFinite(green) ||
    !Number.isFinite(blue)
  ) {
    return null
  }
  return `#${byteHex(red)}${byteHex(green)}${byteHex(blue)}`
}

function kelvinColor(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const kelvin = clamp(value, 1000, 40_000) / 100

  const red = kelvin <= 66 ? 255 : 329.698727446 * (kelvin - 60) ** -0.1332047592
  const green =
    kelvin <= 66
      ? 99.4708025861 * Math.log(kelvin) - 161.1195681661
      : 288.1221695283 * (kelvin - 60) ** -0.0755148492
  const blue =
    kelvin >= 66 ? 255 : kelvin <= 19 ? 0 : 138.5177312231 * Math.log(kelvin - 10) - 305.0447927307

  return `#${byteHex(red)}${byteHex(green)}${byteHex(blue)}`
}

export function resolveHomeAssistantLightVisualState(
  entity: HomeAssistantEntityState | undefined,
): HomeAssistantLightVisualState {
  const on = entity?.state === 'on'
  const rawBrightness = entity?.attributes.brightness
  const brightness =
    on && typeof rawBrightness === 'number' && Number.isFinite(rawBrightness)
      ? clamp(rawBrightness / 255, 0, 1)
      : on
        ? 1
        : 0

  return {
    on,
    brightness,
    color:
      rgbColor(entity?.attributes.rgb_color) ??
      kelvinColor(entity?.attributes.color_temp_kelvin) ??
      '#ffffff',
  }
}
