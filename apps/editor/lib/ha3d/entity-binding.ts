const SUPPORTED_DOMAINS = [
  'light',
  'cover',
  'switch',
  'sensor',
  'binary_sensor',
  'climate',
] as const

export type SupportedHomeAssistantDomain = (typeof SUPPORTED_DOMAINS)[number]

export type EntityBinding = Readonly<{
  nodeId: string
  entityId: string
  domain: SupportedHomeAssistantDomain
  enabled: boolean
}>

export type CreateEntityBindingInput = Readonly<{
  nodeId: string
  entityId: string
  enabled?: boolean
}>

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

  return {
    nodeId,
    entityId,
    domain,
    enabled: input.enabled ?? true,
  }
}

export const supportedHomeAssistantDomains: readonly SupportedHomeAssistantDomain[] =
  SUPPORTED_DOMAINS
