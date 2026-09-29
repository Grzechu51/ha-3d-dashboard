export type HomeAssistantStructureApiHost = Readonly<{ callWS: <T>(message: Readonly<Record<string, unknown>>) => Promise<T> }>
