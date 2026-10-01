# HA 3D Dashboard — Project Status

_Last updated: 2026-09-30_

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

**Checkpoint: project management + Home Assistant structure**

Status: **PR #11 hardened; PR #12 active**

PR #8 (Home Assistant project Store/WebSocket API), PR #9 (frontend project
session/revision coordinator) and PR #10 (native HA project shell with the real
Pascal Editor/Viewer) are merged to `main`.

The active checkpoint is:

`HA Floors/Areas/Devices/Entities -> manual Pascal Level/Zone mapping -> release packaging`

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

### PR #11 — project management and safe switching

Implementation is complete and hardened for the identified data-loss/race edges:

- admin-aware project management,
- revision-checked rename/delete,
- recent-project persistence,
- final configuration flush before leaving a project,
- navigation blocking while scene/config saves are pending or failed,
- explicit revision-conflict recovery,
- lossless config flushes when changes arrive during an in-flight write,
- stale/disposed session protection,
- non-admin users constrained to Dashboard mode.

PR #11 remains a draft until GitHub Actions can execute a fresh gate. The latest
rerun failed before either hosted runner started (runner_id=0, zero steps), so
that failure is currently an Actions execution blocker rather than a test result.

### PR #12 — Home Assistant structure integration

Active implementation:

- native HA WebSocket discovery for Floors, Areas, Devices and display Entities,
- Home Assistant 2026.9 child-device support with parent-area inheritance,
- normalized `Floor -> Area -> Device -> Entity` hierarchy,
- explicit unassigned device/entity handling,
- a native editor-side structure browser,
- manual, non-destructive HA Floor -> Pascal Level mapping,
- manual, non-destructive HA Area -> Pascal Zone mapping,
- mapping persistence in the versioned HA project sidecar,
- one-to-one mapping semantics and removal,
- no automatic HA/Pascal create/delete synchronization.

## Next checkpoints

### Checkpoint A — native project shell

**Completed in PR #10.**

The Home Assistant panel now mounts the real Pascal Editor/Viewer, opens
server-owned projects, switches Dashboard/Edit modes and persists through the
Home Assistant project session.

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
