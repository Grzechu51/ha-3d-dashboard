export type HomeAssistantFloor = Readonly<{
  id: string
  name: string
  aliases: readonly string[]
  icon: string | null
  level: number | null
}>

export type HomeAssistantArea = Readonly<{
  id: string
  name: string
  floorId: string | null
}>
