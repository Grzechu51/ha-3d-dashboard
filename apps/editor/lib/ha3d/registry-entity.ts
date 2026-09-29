export type HomeAssistantRegistryEntity = Readonly<{
  entityId: string
  platform: string
  areaId: string | null
  deviceId: string | null
}>
