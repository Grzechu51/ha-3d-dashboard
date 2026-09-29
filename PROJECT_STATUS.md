# HA 3D Dashboard — Project Status

_Last updated: 2026-09-29_

This repository is a Home Assistant 3D dashboard/editor project built on top of the open-source Pascal Editor codebase.

## Current goal

Deliver an installable Home Assistant custom integration that provides:

- a native **3D Home** panel inside Home Assistant,
- a full 3D building editor,
- a read-only/operator dashboard mode,
- direct binding of Home Assistant entities to 3D objects,
- live visualization and control of lights, covers, switches, sensors and climate,
- project persistence owned by Home Assistant rather than browser-local storage,
- later: HACS packaging and a reusable Lovelace card.

## Current checkpoint

**Checkpoint: native Home Assistant project shell**

Status: **PR #10 in progress**

PR #8 (Home Assistant project Store/WebSocket API) and PR #9 (frontend project session/revision coordinator) are merged to `main`.

The active checkpoint is the first complete native Home Assistant shell:

`Home Assistant panel -> project selector -> Editor / Dashboard -> HA project Store`

## Completed

### 1. Pascal-based HA 3D runtime

Implemented:

- Home Assistant entity binding model,
- entity browser and binding UI,
- live HA runtime bridge,
- light control and 3D light state,
- cover control with animated physical movement,
- switch control,
- sensor and binary-sensor status display,
- climate controls,
- read-only dashboard mode,
- 3D status badges,
- development HA mock transport.

Supported binding domains at this checkpoint:

- `light`
- `switch`
- `cover`
- `sensor`
- `binary_sensor`
- `climate`

### 2. Native Home Assistant host

Merged to `main`:

- installable `custom_components/ha_3d_dashboard` integration shell,
- Home Assistant config flow,
- registered native custom panel,
- native `hass` lifecycle adapter,
- static frontend bundle generation,
- Polish and English translations,
- integration validation in CI.

The frontend can receive the real Home Assistant `hass` object and react to entity-state changes without polling.

### 3. Home Assistant-owned project storage

Merged in **PR #8**.

Implemented backend storage:

- Home Assistant `Store` API,
- server-side project documents,
- WebSocket CRUD:
  - `ha_3d_dashboard/project/list`
  - `ha_3d_dashboard/project/get`
  - `ha_3d_dashboard/project/create`
  - `ha_3d_dashboard/project/save`
  - `ha_3d_dashboard/project/delete`
- optimistic concurrency via project `revision`,
- Pascal SceneGraph envelope validation,
- HA binding/config validation,
- protection against accidental populated-scene -> empty-scene overwrite,
- explicit `force_empty_scene` escape hatch,
- Store write read-back verification,
- `storage_error` and `version_conflict` error paths,
- frontend `hass.callWS` client.

This replaces browser-only persistence as the target architecture for the native HA panel.

### 4. Project-session layer

Merged in **PR #9** with full green CI.

Implemented:

- one revision owner per open HA 3D project,
- serialized scene/config mutations,
- dirty HA configuration folded into scene saves when possible,
- deferred follow-up write when configuration changes during an in-flight save,
- explicit conflict state,
- no silent overwrite after a stale revision,
- opt-out from Pascal browser presentation persistence for embedded hosts.

## In progress

### PR #10 — native Home Assistant project shell

Current implementation target:

- replace the placeholder custom panel with a real React application,
- list/create/open projects through `hass.callWS`,
- mount Pascal Editor directly in Home Assistant without a Next.js server,
- mount a read-only Dashboard mode from the same server-stored scene,
- wire Editor autosave to `HomeAssistantProjectSession`,
- use external HA-owned presentation/config persistence,
- show save/revision/conflict/error state,
- generate and ship isolated Pascal/Tailwind CSS with the integration bundle.

The custom panel remains Shadow-DOM isolated so editor styles do not leak into the rest of Home Assistant.

## Next checkpoints

### Checkpoint A — native project shell

Build the actual Home Assistant panel application on top of the project session:

1. list projects from Home Assistant,
2. create/open project,
3. switch between **Dashboard** and **Edit**,
4. mount the real Pascal Editor/Viewer,
5. load scene from the HA project Store,
6. autosave scene through the project session,
7. restore/save HA bindings through the same revision stream,
8. surface save/conflict/error state in the UI.

This is the next implementation target.

### Checkpoint B — project UX

- project creation dialog,
- rename/delete,
- recent/default project,
- explicit reload on revision conflict,
- unsaved/save status,
- empty-project bootstrap,
- safer project switching.

### Checkpoint C — Home Assistant structure integration

Map HA registries into the editor:

- HA Floors <-> Pascal Levels,
- HA Areas <-> Pascal Zones,
- Devices/Entities browser grouped by floor/area/device,
- drag/drop or picker binding onto selected 3D objects.

Initial synchronization should be manual/non-destructive. Automatic two-way structure synchronization comes later.

### Checkpoint D — release packaging

- HACS repository metadata,
- release artifacts,
- install/update path,
- production bundle verification,
- mobile/tablet performance profiles,
- optional Lovelace 3D view card.

## Persistence architecture

Target architecture:

```text
Home Assistant
  |
  +-- custom_components/ha_3d_dashboard
  |     |
  |     +-- Home Assistant Store
  |     +-- WebSocket project API
  |     +-- native custom panel registration
  |
  +-- frontend custom panel
        |
        +-- HomeAssistantProjectSession
        |     +-- scene
        |     +-- HA bindings/config
        |     +-- revision/conflict handling
        |
        +-- Pascal Editor / Viewer
        +-- HA runtime adapter
```

The browser is not intended to be the authoritative project database.

## Important design rules

- Do not modify Pascal core semantics just to store Home Assistant data.
- Keep HA bindings in an HA-specific sidecar/config model.
- Persist entity IDs and visualization/action metadata, not HA state snapshots.
- Use the native `hass` object for live state and service calls; no polling.
- One open HA project owns one revision stream.
- Never silently overwrite a newer server revision.
- Never silently replace a populated project with an empty scene after a hydration failure.
- Standalone Pascal development behavior must remain usable.

## Repository lineage

The project is based on the MIT-licensed Pascal Editor codebase. Upstream architecture, packages and attribution remain in the repository; HA-specific work is layered around the reusable Pascal editor/viewer rather than rewriting the rendering/editor core.

## Useful locations

| Path | Purpose |
| --- | --- |
| `custom_components/ha_3d_dashboard/` | Home Assistant integration/backend |
| `apps/editor/lib/ha3d/` | HA adapters, bindings, project API/session |
| `apps/editor/components/ha3d/` | HA editor/dashboard UI |
| `packages/editor/` | reusable Pascal editor |
| `packages/viewer/` | reusable Pascal 3D viewer |
| `docs/ha3d/` | HA 3D architecture documentation |
| `PROJECT_STATUS.md` | current implementation checkpoint |

## Definition of the next usable milestone

The next milestone is reached when a user can install the custom integration, open **3D Home** in Home Assistant, create/open a project, build/edit a scene, bind real HA entities, refresh or open the panel on another client, and see the same server-stored project with live entity states.
