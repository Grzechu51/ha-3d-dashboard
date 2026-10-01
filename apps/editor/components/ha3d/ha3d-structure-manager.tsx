import { useScene } from '@pascal-app/editor'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { HomeAssistantProjectApiHost } from '../../lib/ha3d/project-api'
import {
  getHa3dProjectConfigSnapshot,
  removeAreaStructureMapping,
  removeFloorStructureMapping,
  subscribeHa3dProjectConfig,
  upsertAreaStructureMapping,
  upsertFloorStructureMapping,
} from '../../lib/ha3d/project-config'
import { loadHomeAssistantStructure } from '../../lib/ha3d/structure'
import type { HomeAssistantStructureSnapshot } from '../../lib/ha3d/structure-snapshot'
import { groupHomeAssistantStructure } from '../../lib/ha3d/structure-tree'

function structureErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  return 'Home Assistant structure operation failed'
}

export function Ha3dStructureManager({
  host,
  onClose,
}: Readonly<{
  host: HomeAssistantProjectApiHost
  onClose: () => void
}>) {
  const [structure, setStructure] = useState<HomeAssistantStructureSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levels, setLevels] = useState<
    readonly Readonly<{ id: string; name: string; level: number }>[]
  >([])
  const [zones, setZones] = useState<
    readonly Readonly<{ id: string; name: string; parentId: string | null }>[]
  >([])
  const projectConfig = useSyncExternalStore(
    subscribeHa3dProjectConfig,
    getHa3dProjectConfigSnapshot,
    getHa3dProjectConfigSnapshot,
  )

  const tree = useMemo(
    () => (structure ? groupHomeAssistantStructure(structure) : null),
    [structure],
  )
  const floorMappings = useMemo(
    () =>
      new Map(
        projectConfig.structureMappings.floors.map((mapping) => [
          mapping.floorId,
          mapping.levelNodeId,
        ]),
      ),
    [projectConfig.structureMappings.floors],
  )
  const areaMappings = useMemo(
    () =>
      new Map(
        projectConfig.structureMappings.areas.map((mapping) => [
          mapping.areaId,
          mapping.zoneNodeId,
        ]),
      ),
    [projectConfig.structureMappings.areas],
  )
  const staleFloorMappings = useMemo(() => {
    if (!structure) return []
    const floorIds = new Set(structure.floors.map((floor) => floor.id))
    const levelIds = new Set(levels.map((level) => level.id))
    return projectConfig.structureMappings.floors.filter(
      (mapping) => !floorIds.has(mapping.floorId) || !levelIds.has(mapping.levelNodeId),
    )
  }, [levels, projectConfig.structureMappings.floors, structure])
  const staleAreaMappings = useMemo(() => {
    if (!structure) return []
    const areasById = new Map(structure.areas.map((area) => [area.id, area]))
    const zonesById = new Map(zones.map((zone) => [zone.id, zone]))
    return projectConfig.structureMappings.areas.filter((mapping) => {
      const area = areasById.get(mapping.areaId)
      const zone = zonesById.get(mapping.zoneNodeId)
      if (!area || !zone) return true
      if (!area.floorId) return false
      const mappedLevelNodeId = floorMappings.get(area.floorId)
      return mappedLevelNodeId ? zone.parentId !== mappedLevelNodeId : false
    })
  }, [floorMappings, projectConfig.structureMappings.areas, structure, zones])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    const sceneNodes = useScene.getState().nodes
    setLevels(
      Object.values(sceneNodes)
        .flatMap((node) =>
          node.type === 'level'
            ? [{ id: node.id, name: node.name ?? `Level ${node.level}`, level: node.level }]
            : [],
        )
        .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name)),
    )
    setZones(
      Object.values(sceneNodes)
        .flatMap((node) =>
          node.type === 'zone' ? [{ id: node.id, name: node.name, parentId: node.parentId }] : [],
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    )

    try {
      setStructure(await loadHomeAssistantStructure(host))
    } catch (cause) {
      setError(structureErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [host])

  useEffect(() => {
    void reload()
  }, [reload])

  const structureSummary = structure
    ? [
        `${structure.floors.length} floors`,
        `${structure.areas.length} areas`,
        `${structure.devices.length} devices`,
        `${structure.entities.length} entities`,
      ].join(' · ')
    : 'Registry snapshot not loaded'

  const zonesForFloor = (floorId: string) => {
    const levelNodeId = floorMappings.get(floorId)
    return levelNodeId ? zones.filter((zone) => zone.parentId === levelNodeId) : zones
  }

  return (
    <div className="absolute inset-0 z-[100] flex justify-end bg-black/35">
      <button
        aria-label="Close Home Assistant structure"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="relative z-10 flex h-full w-full max-w-xl flex-col border-border border-l bg-background shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-border border-b px-5 py-4">
          <div>
            <h2 className="font-semibold text-base">Home Assistant structure</h2>
            <p className="mt-1 text-muted-foreground text-xs">
              Map HA Floors and Areas to existing Pascal Levels and Zones. This does not modify the
              Home Assistant registries or generate building geometry.
            </p>
          </div>
          <button
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="flex items-center justify-between border-border border-b px-5 py-3">
          <div className="text-muted-foreground text-xs">{structureSummary}</div>
          <button
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            disabled={loading}
            onClick={() => void reload()}
            type="button"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive text-sm">
              {error}
            </div>
          ) : null}

          {levels.length === 0 || zones.length === 0 ? (
            <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-muted-foreground text-xs">
              Pascal scene: {levels.length} Levels · {zones.length} Zones. Create the missing
              Levels/Zones in the editor before mapping the corresponding HA structure.
            </div>
          ) : null}

          {loading && !tree ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              Reading Home Assistant registries…
            </div>
          ) : null}

          {tree ? (
            <div className="space-y-5">
              {tree.floors.map((floorGroup) => (
                <section
                  className="rounded-xl border border-border bg-card/60 p-4"
                  key={floorGroup.floor.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-sm">{floorGroup.floor.name}</div>
                      <div className="text-muted-foreground text-[11px]">
                        HA floor · level {floorGroup.floor.level ?? '—'}
                      </div>
                    </div>
                    <select
                      className="max-w-52 rounded-md border border-border bg-background px-2 py-1 text-xs"
                      onChange={(event) => {
                        const levelNodeId = event.currentTarget.value
                        if (levelNodeId) {
                          upsertFloorStructureMapping(floorGroup.floor.id, levelNodeId)
                        } else {
                          removeFloorStructureMapping(floorGroup.floor.id)
                        }
                      }}
                      value={floorMappings.get(floorGroup.floor.id) ?? ''}
                    >
                      <option value="">Not mapped</option>
                      {levels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 space-y-2">
                    {floorGroup.areas.map((areaGroup) => (
                      <div
                        className="rounded-lg border border-border/70 bg-background/60 p-3"
                        key={areaGroup.area.id}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-xs">
                              {areaGroup.area.name}
                            </div>
                            <div className="text-muted-foreground text-[10px]">
                              {areaGroup.devices.length} devices ·{' '}
                              {areaGroup.entities.length +
                                areaGroup.devices.reduce(
                                  (count, device) => count + device.entities.length,
                                  0,
                                )}{' '}
                              entities
                            </div>
                          </div>
                          <select
                            className="max-w-48 rounded-md border border-border bg-background px-2 py-1 text-xs"
                            onChange={(event) => {
                              const zoneNodeId = event.currentTarget.value
                              if (zoneNodeId) {
                                upsertAreaStructureMapping(areaGroup.area.id, zoneNodeId)
                              } else {
                                removeAreaStructureMapping(areaGroup.area.id)
                              }
                            }}
                            value={areaMappings.get(areaGroup.area.id) ?? ''}
                          >
                            <option value="">Not mapped</option>
                            {zonesForFloor(floorGroup.floor.id).map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {areaGroup.devices.length > 0 || areaGroup.entities.length > 0 ? (
                          <div className="mt-3 space-y-2 border-border/60 border-t pt-3">
                            {areaGroup.devices.map((deviceGroup) => (
                              <div
                                className="rounded-md bg-muted/35 p-2"
                                key={deviceGroup.device.id}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-[11px]">
                                      {deviceGroup.device.nameByUser ??
                                        deviceGroup.device.name ??
                                        deviceGroup.device.id}
                                    </div>
                                    {deviceGroup.device.manufacturer || deviceGroup.device.model ? (
                                      <div className="truncate text-muted-foreground text-[9px]">
                                        {[deviceGroup.device.manufacturer, deviceGroup.device.model]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="text-muted-foreground text-[9px]">
                                    {deviceGroup.entities.length} entities
                                  </div>
                                </div>
                                {deviceGroup.entities.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {deviceGroup.entities.map((entity) => (
                                      <span
                                        className="max-w-full truncate rounded bg-background px-1.5 py-0.5 text-[9px]"
                                        key={entity.entityId}
                                        title={entity.entityId}
                                      >
                                        {entity.name ?? entity.entityId}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                            {areaGroup.entities.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {areaGroup.entities.map((entity) => (
                                  <span
                                    className="max-w-full truncate rounded border border-border/60 bg-background px-1.5 py-0.5 text-[9px]"
                                    key={entity.entityId}
                                    title={entity.entityId}
                                  >
                                    {entity.name ?? entity.entityId}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {tree.unassignedAreas.length > 0 ? (
                <section className="rounded-xl border border-border bg-card/60 p-4">
                  <div className="font-medium text-sm">Areas without a valid HA floor</div>
                  <div className="mt-3 space-y-2">
                    {tree.unassignedAreas.map((areaGroup) => (
                      <div
                        className="flex items-center justify-between gap-3"
                        key={areaGroup.area.id}
                      >
                        <span className="text-xs">{areaGroup.area.name}</span>
                        <select
                          className="max-w-48 rounded-md border border-border bg-background px-2 py-1 text-xs"
                          onChange={(event) => {
                            const zoneNodeId = event.currentTarget.value
                            if (zoneNodeId) {
                              upsertAreaStructureMapping(areaGroup.area.id, zoneNodeId)
                            } else {
                              removeAreaStructureMapping(areaGroup.area.id)
                            }
                          }}
                          value={areaMappings.get(areaGroup.area.id) ?? ''}
                        >
                          <option value="">Not mapped</option>
                          {zones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {tree.unassignedDevices.length > 0 || tree.unassignedEntities.length > 0 ? (
                <section className="rounded-xl border border-border bg-card/60 p-4">
                  <div className="font-medium text-sm">Unassigned in Home Assistant</div>
                  <p className="mt-1 text-muted-foreground text-[10px]">
                    These entries have no valid Area. Nothing is changed in Home Assistant.
                  </p>
                  <div className="mt-3 space-y-2">
                    {tree.unassignedDevices.map((deviceGroup) => (
                      <div className="rounded-md bg-muted/35 p-2" key={deviceGroup.device.id}>
                        <div className="font-medium text-[11px]">
                          {deviceGroup.device.nameByUser ??
                            deviceGroup.device.name ??
                            deviceGroup.device.id}
                        </div>
                        {deviceGroup.entities.length > 0 ? (
                          <div className="mt-1 text-muted-foreground text-[9px]">
                            {deviceGroup.entities.map((entity) => entity.entityId).join(' · ')}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {tree.unassignedEntities.map((entity) => (
                      <div
                        className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-[10px]"
                        key={entity.entityId}
                      >
                        {entity.name ?? entity.entityId}
                        {entity.name ? (
                          <span className="ml-2 text-muted-foreground">{entity.entityId}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {staleFloorMappings.length > 0 || staleAreaMappings.length > 0 ? (
                <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                  <div className="font-medium text-sm">Mappings that need attention</div>
                  <p className="mt-1 text-muted-foreground text-[10px]">
                    A Home Assistant source, Pascal target, or Floor/Level relationship changed.
                    Remove the stale mapping and select a current target.
                  </p>
                  <div className="mt-3 space-y-2">
                    {staleFloorMappings.map((mapping) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-md bg-background/70 p-2 text-[10px]"
                        key={mapping.floorId}
                      >
                        <span className="truncate">
                          Floor {mapping.floorId} → {mapping.levelNodeId}
                        </span>
                        <button
                          className="rounded border border-border px-2 py-1 hover:bg-accent"
                          onClick={() => removeFloorStructureMapping(mapping.floorId)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {staleAreaMappings.map((mapping) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-md bg-background/70 p-2 text-[10px]"
                        key={mapping.areaId}
                      >
                        <span className="truncate">
                          Area {mapping.areaId} → {mapping.zoneNodeId}
                        </span>
                        <button
                          className="rounded border border-border px-2 py-1 hover:bg-accent"
                          onClick={() => removeAreaStructureMapping(mapping.areaId)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {tree.floors.length === 0 && tree.unassignedAreas.length === 0 ? (
                <div className="rounded-lg border border-border p-4 text-muted-foreground text-sm">
                  Home Assistant has no Floors or Areas to map yet.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
