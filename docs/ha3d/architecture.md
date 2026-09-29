# HA 3D Dashboard architecture

HA 3D Dashboard extends Pascal without moving Home Assistant concerns into Pascal core packages.

## Boundary

Pascal remains responsible for authored building data, editing, rendering, scene interaction, and plugin dispatch.

HA 3D owns:

- Home Assistant connection adapters.
- Entity-to-node bindings.
- Live entity state outside the persisted Pascal scene graph.
- Runtime reactions such as light output and cover animation.
- Home Assistant-specific editor panels.
- Project sidecar persistence for HA configuration.
- The future Home Assistant custom integration and custom panel host.

The first implementation lives under `apps/editor/lib/ha3d` so it participates in the existing app test/type-check pipeline without changing the workspace or lockfile. Once the contracts stabilize, the HA-specific layer can be extracted into a dedicated package without changing the Pascal core API.

## Rules

1. Do not add Home Assistant state to `useScene`, `useViewer`, or `useEditor`.
2. Do not modify `packages/core` for HA-specific behavior.
3. Do not make `packages/viewer` depend on Home Assistant.
4. Pascal node ids are the stable scene-side binding key.
5. Home Assistant entity ids are the stable automation-side binding key.
6. Live HA state is runtime state, not authored scene state.
7. HA project configuration is versioned separately from Pascal scene JSON.
8. Device animation and lighting are implemented through public Pascal plugin/presentation seams.
9. The Home Assistant adapter hides the concrete transport. The standalone editor can use a mock adapter; the HA custom panel will use the native `hass` object.
10. Service calls always pass through the adapter rather than being issued from Three.js systems directly.

## Runtime flow

```text
Home Assistant
    |
    | state updates / service calls
    v
HomeAssistantAdapter
    |
    v
HA 3D runtime
    |
    +--> entity bindings --> Pascal node ids
    |
    +--> light runtime  --> emissive material / scene light
    +--> cover runtime  --> animated object transform
    +--> other domains  --> presentation / interaction
```

## Planned persistence

Pascal scene JSON stays compatible with upstream. HA configuration is a sidecar:

```json
{
  "version": 1,
  "bindings": [
    {
      "nodeId": "item_example",
      "entityId": "light.salon",
      "domain": "light",
      "enabled": true
    }
  ]
}
```

The future Home Assistant backend will persist both project metadata and HA-specific configuration. It will not rewrite Pascal node schemas merely to store entity ids.

## Delivery sequence

1. Foundation: adapter contract, runtime registration, binding model, host panel.
2. Entity browser and binding editor.
3. Light binding with on/off, brightness, RGB, color temperature, emissive output, and real scene light.
4. Cover binding with position synchronization and physical animation.
5. Switch, sensor, binary sensor, and climate behavior.
6. Editor/dashboard mode split.
7. Home Assistant custom integration, storage API, and custom panel registration.
8. HACS packaging and mobile performance profiles.


## Current delivery status

Steps 1–5 are implemented in the standalone editor. Step 6 now has a dedicated read-only operator surface at `/dashboard/[sceneId]`. It loads the same Pascal scene and presentation sidecar as the editor, keeps the semantic scene under a read-only lease, mounts HA 3D presentation contributions, and exposes only runtime Home Assistant controls. The next checkpoint replaces the development mock transport with the Home Assistant custom-panel host and native `hass` adapter.
