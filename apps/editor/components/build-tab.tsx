'use client'

import { RoofType as RoofTypeSchema, useRegistryVersion } from '@pascal-app/core'
import {
  MaterialPaintPanel,
  TerrainSculptPanel,
  ToolOptionsPanel,
  triggerSFX,
  useEditor,
  useFloorplanMode,
} from '@pascal-app/editor'
import { useLiquidLineToolOptions } from '@pascal-app/nodes'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/toolbar-tooltip'
import {
  activateBuildTool,
  activateModularCabinetTool,
  activatePaintMode,
  activateRoofFeatureTool,
  activateRoofType,
  activateTerrainSculptMode,
  BASE_BUILD_TYPES,
  type BuildType,
  collectBuildTypes,
  collectRoofFeatures,
  MEP_ITEMS,
  MEP_TOOL_KINDS,
  type MepItem,
  MODULAR_CABINET_ICON,
} from '@/lib/build-palette'
import { getActiveRoofFeatureId, ROOF_TYPE_OPTIONS } from '@/lib/build-tab-state'
import { cn } from '@/lib/utils'

const subscribeToClientMount = () => () => {}

const WINDOW_PLACEMENT_PRESETS = [
  { label: 'Fixed', value: 'fixed' },
  { label: 'Sliding', value: 'sliding' },
  { label: 'Casement', value: 'casement' },
  { label: 'Awning', value: 'awning' },
  { label: 'Single Hung', value: 'single-hung' },
  { label: 'Double Hung', value: 'double-hung' },
  { label: 'Bay', value: 'bay' },
  { label: 'Bow', value: 'bow' },
  { label: 'Louvered', value: 'louvered' },
] as const

const STAIR_PLACEMENT_PRESETS = [
  { label: 'Straight', value: 'straight' },
  { label: 'Curved', value: 'curved' },
  { label: 'Spiral', value: 'spiral' },
] as const

function WindowPresetIcon({
  type,
}: {
  type: (typeof WINDOW_PLACEMENT_PRESETS)[number]['value']
}) {
  const splitHorizontal = type === 'single-hung' || type === 'double-hung'
  const splitVertical = type === 'sliding'
  const angled = type === 'casement' || type === 'awning'
  const projected = type === 'bay' || type === 'bow'

  return (
    <svg aria-hidden className="h-8 w-10" viewBox="0 0 40 32">
      <rect fill="none" height="25" rx="1.5" stroke="currentColor" strokeWidth="1.6" width="32" x="4" y="3.5" />
      {splitVertical ? <line stroke="currentColor" strokeWidth="1.4" x1="20" x2="20" y1="4.5" y2="27.5" /> : null}
      {splitHorizontal ? <line stroke="currentColor" strokeWidth="1.4" x1="5" x2="35" y1="16" y2="16" /> : null}
      {type === 'double-hung' ? (
        <>
          <path d="M17 12h6l-2-2m2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <path d="M23 20h-6l2 2m-2-2 2-2" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </>
      ) : null}
      {angled ? (
        type === 'awning' ? (
          <path d="M6 6l28 8v12" fill="none" stroke="currentColor" strokeWidth="1.4" />
        ) : (
          <path d="M6 5l18 11-18 11" fill="none" stroke="currentColor" strokeWidth="1.4" />
        )
      ) : null}
      {projected ? (
        <path
          d={type === 'bay' ? 'M7 25l7-18h12l7 18' : 'M7 25c3-12 8-18 13-18s10 6 13 18'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      ) : null}
      {type === 'louvered'
        ? [9, 13, 17, 21].map((y) => (
            <line key={y} stroke="currentColor" strokeWidth="1.2" x1="9" x2="31" y1={y} y2={y - 2} />
          ))
        : null}
      {type === 'fixed' ? <path d="M7 7l26 18M33 7L7 25" opacity=".55" stroke="currentColor" strokeWidth="1" /> : null}
    </svg>
  )
}

function DoorPresetIcon({ type }: { type: (typeof DOOR_PLACEMENT_PRESETS)[number]['value'] }) {
  const doubleLeaf = type === 'double' || type === 'french' || type === 'sliding'
  return (
    <svg aria-hidden className="h-8 w-10" viewBox="0 0 40 32">
      <rect fill="none" height="27" rx="1" stroke="currentColor" strokeWidth="1.6" width="22" x="9" y="2.5" />
      {doubleLeaf ? <line stroke="currentColor" strokeWidth="1.3" x1="20" x2="20" y1="3.5" y2="28.5" /> : null}
      {type === 'hinged' || type === 'double' || type === 'french' ? (
        <path d="M10 29A19 19 0 0 1 29 10" fill="none" opacity=".7" stroke="currentColor" strokeWidth="1.1" />
      ) : null}
      {type === 'sliding' || type === 'pocket' || type === 'barn' ? (
        <path d="M7 16h26m-4-3 4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      ) : null}
      {type === 'folding' ? (
        <path d="M10 4l5 12-5 12m5-24 5 12-5 12m5-24 5 12-5 12m5-24 5 12-5 12" fill="none" stroke="currentColor" strokeWidth="1" />
      ) : null}
      {type.startsWith('garage-') ? (
        [8, 13, 18, 23].map((y) => (
          <line key={y} stroke="currentColor" strokeWidth="1.1" x1="10" x2="30" y1={y} y2={y} />
        ))
      ) : null}
    </svg>
  )
}

function StairPresetIcon({ type }: { type: (typeof STAIR_PLACEMENT_PRESETS)[number]['value'] }) {
  if (type === 'spiral') {
    return (
      <svg aria-hidden className="h-8 w-10" viewBox="0 0 40 32">
        <path d="M20 16c0-6 10-6 10 0 0 9-16 11-21 3-5-9 7-18 18-14" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="20" cy="16" fill="currentColor" r="1.5" />
      </svg>
    )
  }
  if (type === 'curved') {
    return (
      <svg aria-hidden className="h-8 w-10" viewBox="0 0 40 32">
        <path d="M7 25c4-13 12-19 26-18" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 23l5 1m-2-7 5 2m0-8 4 3m3-7 3 4" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  }
  return (
    <svg aria-hidden className="h-8 w-10" viewBox="0 0 40 32">
      <path d="M5 26h7v-6h7v-6h7V8h9" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const DOOR_PLACEMENT_PRESETS = [
  { label: 'Hinged', value: 'hinged', width: 0.9, height: 2.1, leafCount: 1 },
  { label: 'Double', value: 'double', width: 1.5, height: 2.1, leafCount: 2 },
  { label: 'French', value: 'french', width: 1.5, height: 2.1, leafCount: 2 },
  { label: 'Folding', value: 'folding', width: 1.8, height: 2.1, leafCount: 4 },
  { label: 'Pocket', value: 'pocket', width: 0.9, height: 2.1, leafCount: 1 },
  { label: 'Barn', value: 'barn', width: 1, height: 2.1, leafCount: 1 },
  { label: 'Sliding', value: 'sliding', width: 1.5, height: 2.1, leafCount: 2 },
  {
    label: 'Garage sectional',
    value: 'garage-sectional',
    width: 2.7,
    height: 2.4,
    leafCount: 1,
  },
  { label: 'Garage roll-up', value: 'garage-rollup', width: 2.7, height: 2.4, leafCount: 1 },
  { label: 'Garage tilt-up', value: 'garage-tiltup', width: 2.7, height: 2.4, leafCount: 1 },
] as const

/**
 * Build tab for the open-source standalone editor — a preset-less replica of
 * the community Build sidebar. Clicking a type activates its raw tool, drawn
 * with the kind's own `def.defaults()`. The "Painting" type swaps in the
 * material-paint panel.
 */
export function BuildTab() {
  const [mepOpen, setMepOpen] = useState(false)
  const activeTool = useEditor((s) => s.tool)
  const mode = useEditor((s) => s.mode)
  const roofDefaults = useEditor((s) => s.toolDefaults.roof)
  const windowDefaults = useEditor((s) => s.toolDefaults.window)
  const doorDefaults = useEditor((s) => s.toolDefaults.door)
  const stairDefaults = useEditor((s) => s.toolDefaults.stair)
  const floorplanMode = useFloorplanMode((s) => s.mode)
  const follow = useLiquidLineToolOptions((s) => s.follow)
  const toggleFollow = useLiquidLineToolOptions((s) => s.toggleFollow)
  useRegistryVersion()
  const registryReady = useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false,
  )
  const buildTypes = registryReady ? collectBuildTypes(floorplanMode) : BASE_BUILD_TYPES

  const ductContext =
    mode === 'build' && (activeTool === 'duct-segment' || activeTool === 'duct-fitting')
  const pipeContext =
    mode === 'build' &&
    (activeTool === 'pipe-segment' || activeTool === 'pipe-fitting' || activeTool === 'pipe-trap')
  const liquidLineContext = mode === 'build' && activeTool === 'liquid-line'

  const isMepItemActive = (item: MepItem) => mode === 'build' && activeTool === item.kind

  // Read at render time (not module scope): the registry is populated by the
  // app bootstrap, so enumerating earlier would race it and see no kinds.
  const roofFeatures = registryReady ? collectRoofFeatures() : []

  // Tile highlight derives from the single source of truth (the active tool /
  // mode), never a separate local selection — so keyboard shortcuts and panel
  // clicks always agree on which tile is lit.
  // The roof Features sub-grid arms roof-accessory tools (skylight, chimney,
  // …); keep the Roof tile lit (and its panel open) while any of them is the
  // active tool, the same way MEP stays lit for its sub-grid tools.
  const activeRoofFeatureId = getActiveRoofFeatureId(roofFeatures, activeTool)
  const isRoofFeatureActive = mode === 'build' && activeRoofFeatureId !== null
  const isMepActive =
    (mode === 'build' && !!activeTool && MEP_TOOL_KINDS.has(activeTool)) ||
    (mode === 'select' && mepOpen)
  const isKitchenActive = mode === 'build' && activeTool === 'cabinet'
  const parsedRoofType = RoofTypeSchema.safeParse(roofDefaults?.roofType)
  const activeRoofType = parsedRoofType.success ? parsedRoofType.data : 'gable'

  const isTypeActive = (type: BuildType) => {
    if (type.mode) return mode === type.mode
    if (type.id === 'mep') return isMepActive
    if (type.id === 'kitchen') return isKitchenActive
    if (type.id === 'roof')
      return mode === 'build' && (activeTool === 'roof' || isRoofFeatureActive)
    return mode === 'build' && activeTool === type.kind
  }

  const handleTypeClick = useCallback((type: BuildType) => {
    setMepOpen(type.id === 'mep')
    if (type.mode === 'material-paint') {
      activatePaintMode()
    } else if (type.mode === 'terrain-sculpt') {
      activateTerrainSculptMode()
    } else if (type.id === 'mep') {
      const ed = useEditor.getState()
      ed.setPhase('structure')
      ed.setStructureLayer('elements')
      ed.setCatalogCategory(null)
      ed.setMode('build')
      ed.setTool(null)
    } else if (type.id === 'kitchen') {
      activateModularCabinetTool()
    } else if (type.kind) {
      activateBuildTool(type.kind)
    }
  }, [])

  // On open, land on the first build tool — parity with the community Build
  // sidebar, so switching to Build immediately arms a usable tool. Skip when a
  // Build-tab tool or special mode is already active: the current editor state
  // is the source of truth, including entry from another panel.
  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    const ed = useEditor.getState()
    if (ed.mode === 'material-paint' || ed.mode === 'terrain-sculpt') return
    if (ed.mode === 'build' && ed.tool) return
    const firstType = buildTypes.find((t) => t.kind)
    if (firstType) handleTypeClick(firstType)
  }, [buildTypes, handleTypeClick])

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <TooltipProvider delayDuration={0} disableHoverableContent>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}
        >
          {buildTypes.map((type) => {
            const active = isTypeActive(type)
            return (
              <Tooltip key={type.id}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'group relative flex aspect-square items-center justify-center rounded-xl p-1 transition-all duration-200',
                      active
                        ? 'bg-primary/10 ring-1 ring-primary/50'
                        : 'bg-muted/40 opacity-70 grayscale hover:bg-muted hover:opacity-100 hover:grayscale-0',
                    )}
                    onClick={() => {
                      triggerSFX('sfx:menu-click')
                      handleTypeClick(type)
                    }}
                    onMouseEnter={() => triggerSFX('sfx:menu-hover')}
                    type="button"
                  >
                    <Image
                      alt={type.label}
                      className="size-full object-contain transition-transform duration-200 group-hover:scale-110"
                      height={48}
                      src={type.iconSrc}
                      width={48}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="pointer-events-none" side="top">
                  {type.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>

      {mode === 'material-paint' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MaterialPaintPanel />
        </div>
      ) : mode === 'terrain-sculpt' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TerrainSculptPanel />
        </div>
      ) : mode === 'build' && activeTool === 'window' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <div className="px-0.5 pt-1 font-medium text-muted-foreground text-xs">Window type</div>
          <div className="grid grid-cols-2 gap-1.5">
            {WINDOW_PLACEMENT_PRESETS.map((preset) => {
              const selected = (windowDefaults?.windowType ?? 'fixed') === preset.value
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    'rounded-lg px-2.5 py-2 text-left font-medium text-xs transition-colors',
                    selected
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/50'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  key={preset.value}
                  onClick={() => {
                    triggerSFX('sfx:menu-click')
                    const current = useEditor.getState().toolDefaults.window ?? {}
                    useEditor.getState().setToolDefaults('window', {
                      ...current,
                      windowType: preset.value,
                      operationState: 0,
                      ...(preset.value === 'awning' ? { awningDirection: 'up' } : {}),
                      ...(preset.value === 'casement'
                        ? { casementStyle: 'single', hingesSide: 'left' }
                        : {}),
                    })
                  }}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <WindowPresetIcon type={preset.value} />
                    <span>{preset.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="px-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Choose the construction first, then click a wall to place it. Detailed dimensions, shape
            and operation remain editable after placement.
          </p>
        </div>
      ) : mode === 'build' && activeTool === 'door' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <div className="px-0.5 pt-1 font-medium text-muted-foreground text-xs">Door type</div>
          <div className="grid grid-cols-2 gap-1.5">
            {DOOR_PLACEMENT_PRESETS.map((preset) => {
              const selected = (doorDefaults?.doorType ?? 'hinged') === preset.value
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    'rounded-lg px-2.5 py-2 text-left font-medium text-xs transition-colors',
                    selected
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/50'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  key={preset.value}
                  onClick={() => {
                    triggerSFX('sfx:menu-click')
                    const current = useEditor.getState().toolDefaults.door ?? {}
                    const garage = preset.value.startsWith('garage-')
                    useEditor.getState().setToolDefaults('door', {
                      ...current,
                      doorType: preset.value,
                      doorCategory: garage ? 'garage' : 'interior',
                      width: preset.width,
                      height: preset.height,
                      leafCount: preset.leafCount,
                      operationState: 0,
                    })
                  }}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <DoorPresetIcon type={preset.value} />
                    <span>{preset.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="px-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Choose a door construction, then place it on a wall. Detailed hardware and opening
            behaviour remain editable after placement.
          </p>
        </div>
      ) : mode === 'build' && activeTool === 'stair' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <div className="px-0.5 pt-1 font-medium text-muted-foreground text-xs">Stair type</div>
          <div className="grid grid-cols-3 gap-1.5">
            {STAIR_PLACEMENT_PRESETS.map((preset) => {
              const selected = (stairDefaults?.stairType ?? 'straight') === preset.value
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    'rounded-lg px-2 py-2 font-medium text-xs transition-colors',
                    selected
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/50'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  key={preset.value}
                  onClick={() => {
                    triggerSFX('sfx:menu-click')
                    const current = useEditor.getState().toolDefaults.stair ?? {}
                    useEditor.getState().setToolDefaults('stair', {
                      ...current,
                      stairType: preset.value,
                      ...(preset.value === 'spiral'
                        ? { sweepAngle: Math.PI * 2, innerRadius: 0.15 }
                        : preset.value === 'curved'
                          ? { sweepAngle: Math.PI / 2, innerRadius: 0.9 }
                          : {}),
                    })
                  }}
                  type="button"
                >
                  <span className="flex flex-col items-center gap-1">
                    <StairPresetIcon type={preset.value} />
                    <span>{preset.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="px-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Choose the stair geometry before placement. Detailed rise, destination, railing and
            dimensions remain editable after placement.
          </p>
        </div>
      ) : mode === 'build' && (activeTool === 'roof' || isRoofFeatureActive) ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <div className="px-0.5 pt-1 font-medium text-muted-foreground text-xs">Roof type</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ROOF_TYPE_OPTIONS.map((roofType) => {
                const active = activeTool === 'roof' && activeRoofType === roofType.value
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      'rounded-lg px-2.5 py-2 text-left font-medium text-xs transition-colors',
                      active
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/50'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    key={roofType.value}
                    onClick={() => {
                      triggerSFX('sfx:menu-click')
                      activateRoofType(roofType.value)
                    }}
                    onMouseEnter={() => triggerSFX('sfx:menu-hover')}
                    type="button"
                  >
                    {roofType.label}
                  </button>
                )
              })}
            </div>
          </div>

          <ToolOptionsPanel
            className="border-border/50 border-t pt-3"
            kind="roof"
            onSelect={() => {
              const editor = useEditor.getState()
              if (!(editor.mode === 'build' && editor.tool === 'roof')) activateBuildTool('roof')
            }}
          />
          {activeRoofType === 'conical' && (
            <p className="border-border/50 border-t px-0.5 pt-3 text-[11px] text-muted-foreground leading-relaxed">
              Select a curved wall to match its radius and arc.
            </p>
          )}

          {roofFeatures.length > 0 ? (
            <div className="flex flex-col gap-2 border-border/50 border-t pt-3">
              <div className="px-0.5 font-medium text-muted-foreground text-xs">
                Features & extensions
              </div>
              <TooltipProvider delayDuration={0} disableHoverableContent>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}
                >
                  {roofFeatures.map((feature) => {
                    const active = mode === 'build' && feature.id === activeRoofFeatureId
                    return (
                      <Tooltip key={feature.id}>
                        <TooltipTrigger asChild>
                          <button
                            aria-pressed={active}
                            className={cn(
                              'group relative flex aspect-square items-center justify-center rounded-xl p-1 transition-all duration-200',
                              active
                                ? 'bg-primary/10 ring-1 ring-primary/50'
                                : 'bg-muted/40 opacity-70 grayscale hover:bg-muted hover:opacity-100 hover:grayscale-0',
                            )}
                            onClick={() => {
                              triggerSFX('sfx:menu-click')
                              activateRoofFeatureTool(feature)
                            }}
                            onMouseEnter={() => triggerSFX('sfx:menu-hover')}
                            type="button"
                          >
                            <Image
                              alt={feature.label}
                              className="size-full object-contain transition-transform duration-200 group-hover:scale-110"
                              height={48}
                              src={feature.iconSrc}
                              width={48}
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="pointer-events-none" side="top">
                          {feature.label}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </TooltipProvider>
            </div>
          ) : null}
        </div>
      ) : isKitchenActive ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <div className="px-0.5 pt-1 font-medium text-muted-foreground text-xs">Kitchen</div>
          <TooltipProvider delayDuration={0} disableHoverableContent>
            <div
              className="grid gap-1.5 px-0.5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="group relative flex aspect-square items-center justify-center rounded-xl bg-primary/10 p-1 ring-1 ring-primary/50 transition-all duration-200"
                    onClick={() => {
                      triggerSFX('sfx:menu-click')
                      activateModularCabinetTool()
                    }}
                    onMouseEnter={() => triggerSFX('sfx:menu-hover')}
                    type="button"
                  >
                    <Image
                      alt="Modular Cabinet"
                      className="size-full object-contain transition-transform duration-200 group-hover:scale-110"
                      height={48}
                      src={MODULAR_CABINET_ICON}
                      width={48}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="pointer-events-none" side="top">
                  Modular Cabinet
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      ) : isMepActive ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <div className="px-0.5 pt-1 font-medium text-muted-foreground text-xs">MEP</div>
          <TooltipProvider delayDuration={0} disableHoverableContent>
            <div
              className="grid gap-1.5 px-0.5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}
            >
              {MEP_ITEMS.map((item) => {
                const active = isMepItemActive(item)
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        aria-pressed={active}
                        className={cn(
                          'group relative flex aspect-square items-center justify-center rounded-xl transition-all duration-200',
                          active
                            ? 'bg-primary/10 ring-1 ring-primary/50'
                            : 'bg-muted/40 opacity-70 grayscale hover:bg-muted hover:opacity-100 hover:grayscale-0',
                        )}
                        onClick={() => {
                          triggerSFX('sfx:menu-click')
                          activateBuildTool(item.kind)
                        }}
                        onMouseEnter={() => triggerSFX('sfx:menu-hover')}
                        type="button"
                      >
                        <Image
                          alt={item.label}
                          className="size-full object-contain transition-transform duration-200 group-hover:scale-110"
                          height={48}
                          src={item.iconSrc}
                          width={48}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="pointer-events-none" side="top">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </TooltipProvider>

          {(['duct-fitting', 'pipe-fitting'] as const)
            .filter((kind) => (kind === 'duct-fitting' ? ductContext : pipeContext))
            .map((kind) => (
              <ToolOptionsPanel
                active={activeTool === kind}
                key={kind}
                getChoiceThumbnail={(option, value) => {
                  if (option.id !== 'fittingType') return undefined
                  if (kind === 'duct-fitting' && value === 'elbow')
                    return '/icons/duct-fitting.webp'
                  return `/icons/fittings/${kind === 'duct-fitting' ? 'duct' : 'pipe'}-${value}.webp`
                }}
                kind={kind}
                onSelect={(option, value) => {
                  if (activeTool !== kind) {
                    const defaults = useEditor.getState().toolDefaults[kind]
                    activateBuildTool(kind)
                    if (defaults) useEditor.getState().setToolDefaults(kind, defaults)
                  }
                  option.set(value)
                }}
              />
            ))}

          {liquidLineContext ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">Liquid Line</span>
              <button
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                  follow ? 'bg-primary/10 ring-1 ring-primary/50' : 'bg-muted/40 hover:bg-muted',
                )}
                onClick={() => {
                  triggerSFX('sfx:menu-click')
                  toggleFollow()
                }}
                onMouseEnter={() => triggerSFX('sfx:menu-hover')}
                type="button"
              >
                <span>Follow lineset</span>
                <span className="text-muted-foreground text-xs">{follow ? 'On' : 'Off'}</span>
              </button>
              <span className="px-1 text-[11px] text-muted-foreground">
                {follow
                  ? 'Click a lineset to lay the line beside it.'
                  : 'Trace a line alongside an existing lineset (F).'}
              </span>
            </div>
          ) : null}
        </div>
      ) : mode === 'build' && activeTool ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ToolOptionsPanel
            kind={activeTool}
            onSelect={() => {
              if (!(useEditor.getState().mode === 'build' && useEditor.getState().tool === activeTool)) {
                activateBuildTool(activeTool)
              }
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
