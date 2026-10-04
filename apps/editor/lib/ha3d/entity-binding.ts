const SUPPORTED_DOMAINS = [
  'light',
  'cover',
  'switch',
  'sensor',
  'binary_sensor',
  'climate',
  'input_boolean',
  'input_number',
  'input_select',
  'input_text',
  'input_datetime',
  'number',
  'select',
  'text',
] as const

const COVER_MOTION_AXES = ['x', 'y', 'z'] as const
const INTERACTION_ACTIONS = ['default', 'toggle', 'more-info', 'none'] as const

export type SupportedHomeAssistantDomain = (typeof SUPPORTED_DOMAINS)[number]
export type CoverMotionAxis = (typeof COVER_MOTION_AXES)[number]
export type DashboardInteractionAction = (typeof INTERACTION_ACTIONS)[number]
export type ResolvedDashboardInteractionAction = Exclude<DashboardInteractionAction, 'default'>

export type CoverMotionConfig = Readonly<{
  axis: CoverMotionAxis
  openOffsetMeters: number
  durationMs: number
}>

export const DEFAULT_COVER_MOTION: CoverMotionConfig = {
  axis: 'y',
  openOffsetMeters: 1.8,
  durationMs: 800,
}

export type EntityBinding = Readonly<{
  nodeId: string
  entityId: string
  domain: SupportedHomeAssistantDomain
  enabled: boolean
  tapAction: DashboardInteractionAction
  holdAction: DashboardInteractionAction
  coverMotion?: CoverMotionConfig
}>

export type CreateEntityBindingInput = Readonly<{
  nodeId: string
  entityId: string
  enabled?: boolean
  tapAction?: DashboardInteractionAction
  holdAction?: DashboardInteractionAction
  coverMotion?: CoverMotionConfig
}>

export function normalizeDashboardInteractionAction(
  value: unknown,
  fallback: DashboardInteractionAction = 'default',
): DashboardInteractionAction {
  return typeof value === 'string' && (INTERACTION_ACTIONS as readonly string[]).includes(value)
    ? (value as DashboardInteractionAction)
    : fallback
}

export function resolveDashboardInteractionAction(
  binding: Pick<EntityBinding, 'domain' | 'tapAction' | 'holdAction'>,
  gesture: 'tap' | 'hold',
): ResolvedDashboardInteractionAction {
  const configured = gesture === 'tap' ? binding.tapAction : binding.holdAction
  if (configured !== 'default') return configured

  if (gesture === 'hold') return 'more-info'
  return binding.domain === 'light' ||
    binding.domain === 'switch' ||
    binding.domain === 'cover' ||
    binding.domain === 'input_boolean'
    ? 'toggle'
    : 'more-info'
}

export function entityDomain(entityId: string): string | null {
  const separator = entityId.indexOf('.')
  if (separator <= 0 || separator === entityId.length - 1) return null
  return entityId.slice(0, separator)
}

export function isSupportedHomeAssistantDomain(
  domain: string,
): domain is SupportedHomeAssistantDomain {
  return (SUPPORTED_DOMAINS as readonly string[]).includes(domain)
}

export function normalizeCoverMotionConfig(value: unknown): CoverMotionConfig {
  if (value === undefined) return { ...DEFAULT_COVER_MOTION }
  if (!value || typeof value !== 'object') {
    throw new Error('[ha3d] cover motion must be an object')
  }

  const record = value as Record<string, unknown>
  const axis = record.axis
  const openOffsetMeters = record.openOffsetMeters
  const durationMs = record.durationMs

  if (typeof axis !== 'string' || !(COVER_MOTION_AXES as readonly string[]).includes(axis)) {
    throw new Error('[ha3d] cover motion axis must be x, y, or z')
  }
  if (typeof openOffsetMeters !== 'number' || !Number.isFinite(openOffsetMeters)) {
    throw new Error('[ha3d] cover motion openOffsetMeters must be finite')
  }
  if (
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs < 0 ||
    durationMs > 60_000
  ) {
    throw new Error('[ha3d] cover motion durationMs must be between 0 and 60000')
  }

  return {
    axis: axis as CoverMotionAxis,
    openOffsetMeters,
    durationMs,
  }
}

export function createEntityBinding(input: CreateEntityBindingInput): EntityBinding {
  const nodeId = input.nodeId.trim()
  const entityId = input.entityId.trim()

  if (!nodeId) throw new Error('[ha3d] nodeId must be a non-empty string')

  const domain = entityDomain(entityId)
  if (!domain) {
    throw new Error(`[ha3d] invalid Home Assistant entity id: "${entityId}"`)
  }
  if (!isSupportedHomeAssistantDomain(domain)) {
    throw new Error(`[ha3d] unsupported Home Assistant domain: "${domain}"`)
  }
  if (domain !== 'cover' && input.coverMotion !== undefined) {
    throw new Error('[ha3d] cover motion is only valid for cover entities')
  }

  const base = {
    nodeId,
    entityId,
    domain,
    enabled: input.enabled ?? true,
    tapAction: normalizeDashboardInteractionAction(input.tapAction),
    holdAction: normalizeDashboardInteractionAction(input.holdAction),
  }

  return domain === 'cover'
    ? {
        ...base,
        coverMotion: normalizeCoverMotionConfig(input.coverMotion),
      }
    : base
}

export const supportedHomeAssistantDomains: readonly SupportedHomeAssistantDomain[] =
  SUPPORTED_DOMAINS
