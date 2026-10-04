'use client'

import { X } from 'lucide-react'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { resolveHomeAssistantCoverOpenFraction } from '../../lib/ha3d/cover-state'
import type { EntityBinding } from '../../lib/ha3d/entity-binding'
import {
  entityFriendlyName,
  formatHomeAssistantEntityDetail,
  formatHomeAssistantEntityValue,
  numericEntityAttribute,
  stringListEntityAttribute,
} from '../../lib/ha3d/entity-display'
import { resolveHomeAssistantLightVisualState } from '../../lib/ha3d/light-state'
import {
  getHa3dProjectConfigSnapshot,
  subscribeHa3dProjectConfig,
} from '../../lib/ha3d/project-config'
import {
  getHomeAssistantRuntimeSnapshot,
  subscribeHomeAssistantRuntime,
} from '../../lib/ha3d/runtime'

function lightColorModes(
  entity: { attributes: Readonly<Record<string, unknown>> } | undefined,
): readonly string[] {
  const raw = entity?.attributes.supported_color_modes
  return Array.isArray(raw) ? raw.filter((mode): mode is string => typeof mode === 'string') : []
}

function lightSupportsBrightness(
  entity: { attributes: Readonly<Record<string, unknown>> } | undefined,
): boolean {
  return lightColorModes(entity).some((mode) => mode !== 'onoff')
}

function lightSupportsColor(
  entity: { attributes: Readonly<Record<string, unknown>> } | undefined,
): boolean {
  const modes = lightColorModes(entity)
  return ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].some((mode) => modes.includes(mode))
}

function lightColorTemperature(
  entity: { attributes: Readonly<Record<string, unknown>> } | undefined,
): { value: number; min: number; max: number } | null {
  if (!entity || !lightColorModes(entity).includes('color_temp')) return null

  const readNumber = (key: string) => {
    const value = entity.attributes[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }
  const min = readNumber('min_color_temp_kelvin') ?? 2000
  const max = readNumber('max_color_temp_kelvin') ?? 6500
  const value = readNumber('color_temp_kelvin') ?? Math.round((min + max) / 2)
  return {
    value: Math.max(Math.min(min, max), Math.min(Math.max(min, max), value)),
    min: Math.min(min, max),
    max: Math.max(min, max),
  }
}

function hexToRgb(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) return null
  const packed = Number.parseInt(match[1]!, 16)
  return [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff]
}

function bindingPriority(binding: EntityBinding): number {
  if (binding.domain === 'light') return 0
  if (binding.domain === 'switch' || binding.domain === 'input_boolean') return 1
  if (binding.domain === 'cover') return 2
  if (binding.domain === 'climate') return 3
  return 4
}

export function Ha3dMoreInfoPopup({
  nodeId,
  onClose,
}: {
  nodeId: string | null
  onClose: () => void
}) {
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
  const [error, setError] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState('')

  const binding = useMemo(() => {
    if (!nodeId) return null
    return (
      project.bindings
        .filter((candidate) => candidate.enabled && candidate.nodeId === nodeId)
        .sort((left, right) => bindingPriority(left) - bindingPriority(right))[0] ?? null
    )
  }, [nodeId, project.bindings])

  const entity = binding ? runtime.adapter?.getEntity(binding.entityId) : undefined

  useEffect(() => {
    if (!nodeId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nodeId, onClose])

  useEffect(() => {
    setError(null)
    setTextDraft(entity?.state ?? '')
  }, [entity?.state])

  if (!(nodeId && binding)) return null

  const callService = async (
    domain: string,
    service: string,
    data?: Readonly<Record<string, unknown>>,
  ) => {
    const adapter = runtime.adapter
    if (!adapter) return
    setError(null)
    try {
      await adapter.callService({
        domain,
        service,
        data,
        target: { entityId: binding.entityId },
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Home Assistant service call failed')
    }
  }

  const detail = entity ? formatHomeAssistantEntityDetail(entity) : null
  const value = entity ? formatHomeAssistantEntityValue(entity) : 'Unavailable'
  const isOn = entity?.state === 'on'
  const brightness = numericEntityAttribute(entity, 'brightness')
  const brightnessPct =
    entity && binding.domain === 'light' && lightSupportsBrightness(entity)
      ? brightness == null
        ? 100
        : Math.max(0, Math.min(100, Math.round((brightness / 255) * 100)))
      : null
  const lightColor =
    entity && binding.domain === 'light' && lightSupportsColor(entity)
      ? resolveHomeAssistantLightVisualState(entity).color
      : null
  const colorTemperature =
    entity && binding.domain === 'light' ? lightColorTemperature(entity) : null
  const coverPosition = entity ? Math.round(resolveHomeAssistantCoverOpenFraction(entity) * 100) : 0
  const climateTarget = numericEntityAttribute(entity, 'temperature')
  const climateModes = stringListEntityAttribute(entity, 'hvac_modes')
  const numberValue = Number.parseFloat(entity?.state ?? '')
  const numberMin = numericEntityAttribute(entity, 'min') ?? 0
  const numberMax = numericEntityAttribute(entity, 'max') ?? 100
  const numberStep = numericEntityAttribute(entity, 'step') ?? 1
  const selectOptions = stringListEntityAttribute(entity, 'options')

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <section
        aria-label="Home Assistant more info"
        aria-modal="true"
        className="max-h-[min(78vh,760px)] w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/10 bg-[#1d1f20]/96 text-white shadow-2xl backdrop-blur-2xl"
        role="dialog"
      >
        <header className="flex items-start gap-3 border-white/10 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-[17px]">
              {entity ? entityFriendlyName(entity) : binding.entityId}
            </div>
            <div className="mt-1 truncate text-white/45 text-xs">{binding.entityId}</div>
          </div>
          <button
            aria-label="Close more info"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/7 text-white/75 hover:bg-white/12 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[calc(min(78vh,760px)-74px)] overflow-y-auto px-5 py-5">
          <div className="text-center">
            <div className="font-semibold text-4xl tracking-tight">{value}</div>
            {detail ? <div className="mt-1 text-white/45 text-xs">{detail}</div> : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-200 text-xs">
              {error}
            </div>
          ) : null}

          {entity &&
          (binding.domain === 'light' ||
            binding.domain === 'switch' ||
            binding.domain === 'input_boolean') ? (
            <button
              className={
                isOn
                  ? 'mt-5 w-full rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-black text-sm'
                  : 'mt-5 w-full rounded-2xl bg-white/8 px-4 py-3 font-semibold text-sm text-white hover:bg-white/12'
              }
              onClick={() => void callService(binding.domain, isOn ? 'turn_off' : 'turn_on')}
              type="button"
            >
              {isOn ? 'Turn off' : 'Turn on'}
            </button>
          ) : null}

          {entity && binding.domain === 'light' ? (
            <div className="mt-5 space-y-5">
              {brightnessPct !== null ? (
                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-white/55">Brightness</span>
                    <span>{brightnessPct}%</span>
                  </div>
                  <input
                    className="block w-full"
                    max="100"
                    min="1"
                    onChange={(event) =>
                      void callService('light', 'turn_on', {
                        brightness_pct: Number(event.target.value),
                      })
                    }
                    type="range"
                    value={Math.max(1, brightnessPct)}
                  />
                </label>
              ) : null}

              {lightColor ? (
                <label className="flex items-center justify-between rounded-2xl bg-white/6 px-4 py-3">
                  <span className="text-white/65 text-sm">Color</span>
                  <input
                    aria-label="Light color"
                    className="h-9 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    onChange={(event) => {
                      const rgb = hexToRgb(event.target.value)
                      if (rgb) void callService('light', 'turn_on', { rgb_color: rgb })
                    }}
                    type="color"
                    value={lightColor}
                  />
                </label>
              ) : null}

              {colorTemperature ? (
                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-white/55">Color temperature</span>
                    <span>{Math.round(colorTemperature.value)} K</span>
                  </div>
                  <input
                    className="block w-full"
                    max={colorTemperature.max}
                    min={colorTemperature.min}
                    onChange={(event) =>
                      void callService('light', 'turn_on', {
                        color_temp_kelvin: Number(event.target.value),
                      })
                    }
                    step="50"
                    type="range"
                    value={colorTemperature.value}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {entity && binding.domain === 'cover' ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="rounded-2xl bg-white/8 px-4 py-3 text-sm hover:bg-white/12"
                  onClick={() => void callService('cover', 'close_cover')}
                  type="button"
                >
                  Close
                </button>
                <button
                  className="rounded-2xl bg-white/8 px-4 py-3 text-sm hover:bg-white/12"
                  onClick={() => void callService('cover', 'open_cover')}
                  type="button"
                >
                  Open
                </button>
              </div>
              <label className="block">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-white/55">Position</span>
                  <span>{coverPosition}%</span>
                </div>
                <input
                  className="block w-full"
                  max="100"
                  min="0"
                  onChange={(event) =>
                    void callService('cover', 'set_cover_position', {
                      position: Number(event.target.value),
                    })
                  }
                  type="range"
                  value={coverPosition}
                />
              </label>
            </div>
          ) : null}

          {entity && binding.domain === 'climate' ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="rounded-2xl bg-white/6 p-3 text-xs text-white/55">
                Target temperature
                <input
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                  onChange={(event) => {
                    if (!event.target.value.trim()) return
                    const temperature = Number(event.target.value)
                    if (Number.isFinite(temperature)) {
                      void callService('climate', 'set_temperature', { temperature })
                    }
                  }}
                  step="0.5"
                  type="number"
                  value={climateTarget ?? ''}
                />
              </label>
              <label className="rounded-2xl bg-white/6 p-3 text-xs text-white/55">
                HVAC mode
                <select
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#252728] px-3 py-2 text-white outline-none"
                  onChange={(event) =>
                    void callService('climate', 'set_hvac_mode', { hvac_mode: event.target.value })
                  }
                  value={entity.state}
                >
                  {climateModes.length > 0 ? (
                    climateModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))
                  ) : (
                    <option value={entity.state}>{entity.state}</option>
                  )}
                </select>
              </label>
            </div>
          ) : null}

          {entity &&
          (binding.domain === 'input_number' || binding.domain === 'number') &&
          Number.isFinite(numberValue) ? (
            <label className="mt-5 block">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-white/55">Value</span>
                <span>{entity.state}</span>
              </div>
              <input
                className="block w-full"
                max={numberMax}
                min={numberMin}
                onChange={(event) =>
                  void callService(binding.domain, 'set_value', {
                    value: Number(event.target.value),
                  })
                }
                step={numberStep}
                type="range"
                value={numberValue}
              />
            </label>
          ) : null}

          {entity && (binding.domain === 'input_select' || binding.domain === 'select') ? (
            <label className="mt-5 block rounded-2xl bg-white/6 p-3 text-xs text-white/55">
              Option
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#252728] px-3 py-2 text-white outline-none"
                onChange={(event) =>
                  void callService(binding.domain, 'select_option', { option: event.target.value })
                }
                value={entity.state}
              >
                {selectOptions.length > 0 ? (
                  selectOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))
                ) : (
                  <option value={entity.state}>{entity.state}</option>
                )}
              </select>
            </label>
          ) : null}

          {entity && (binding.domain === 'input_text' || binding.domain === 'text') ? (
            <form
              className="mt-5 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void callService(binding.domain, 'set_value', { value: textDraft })
              }}
            >
              <input
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
                onChange={(event) => setTextDraft(event.target.value)}
                value={textDraft}
              />
              <button
                className="rounded-2xl bg-white/10 px-4 py-3 font-medium text-sm hover:bg-white/15"
                type="submit"
              >
                Set
              </button>
            </form>
          ) : null}

          <div className="mt-5 rounded-2xl bg-white/5 px-4 py-3">
            <div className="text-white/40 text-[10px] uppercase tracking-wider">Entity</div>
            <div className="mt-1 break-all text-white/70 text-xs">{binding.entityId}</div>
            <div className="mt-2 text-white/40 text-[10px] uppercase tracking-wider">Domain</div>
            <div className="mt-1 text-white/70 text-xs">{binding.domain}</div>
          </div>
        </div>
      </section>
    </div>
  )
}
