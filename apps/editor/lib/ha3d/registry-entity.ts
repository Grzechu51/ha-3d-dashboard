export type HomeAssistantRegistryEntity = Readonly<{
  entityId: string
  platform: string
  name: string | null
  icon: string | null
  areaId: string | null
  deviceId: string | null
  hidden: boolean
}>
