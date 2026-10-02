# HA 3D Dashboard — Project Status

_Last updated: 2026-10-02_

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

**Checkpoint: release readiness**

Status: **PR #18 merged; public-beta safeguards complete**

PR #8 through PR #18 are merged to `main`. The native project shell,
project management, Home Assistant structure mapping, GitHub Actions cost
controls, manual/HACS packaging, release tooling, brand hardening, shared
offline release preflight and public-beta safeguards are complete.

The active checkpoint is:

`HACS validation -> v0.3.0-beta.1 prerelease -> install/update testing`

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

### HACS and GitHub Release readiness

The manual-install baseline was completed in **PR #14** and HACS/GitHub
Release tooling was completed in **PR #15**.

Brand/release hardening was completed in **PR #16**.

The shared offline release preflight was completed in **PR #17**. It validates
HACS-required repository metadata, source version agreement, repository shape,
both package layouts, brand/runtime assets and SHA256 checksums, and is reused by
the manual **HA Release** workflow.

The current work hardens the public-beta boundary: mixed licensing, release
notices, prerelease versioning and `BETA_RELEASE_LOCK` before the repository is
made public for custom-HACS testing.

The repository owner has approved a public test phase, but publication is
gated behind explicit beta safeguards. The HA-specific code is separated from
the upstream Pascal MIT license by a beta evaluation license, release packages
carry both the beta terms and third-party notices, and `BETA_RELEASE_LOCK`
prevents an accidental stable HA release.

The safeguards are merged, PR #18 passed both normal CI jobs, and the
repository is now **public** with the required GitHub description/topics.
Public visibility is intended only for the custom-HACS beta test phase, not as
a declaration that the whole repository is open source.

No HA GitHub Release exists yet. The next gate is one manual **HACS Validate**
run, followed by the guarded `v0.3.0-beta.1` release dry-run.

## Next checkpoints

### Checkpoint A — native project shell

**Completed in PR #10.**

The Home Assistant panel now mounts the real Pascal Editor/Viewer, opens
server-owned projects, switches Dashboard/Edit modes and persists through the
Home Assistant project session.

### Checkpoint B — project UX

**Completed in PR #11.**

Implemented project creation, rename/delete, recent-project persistence,
revision-conflict recovery, save/error status, empty-project bootstrap and safe
project switching.

### Checkpoint C — Home Assistant structure integration

**Completed in PR #12.**

Implemented HA Floor/Area/Device/Entity discovery, child-device area inheritance,
the grouped structure browser, manual non-destructive Floor -> Level and
Area -> Zone mappings, persisted mapping state, stale mapping detection and
existing entity binding onto selected 3D objects.

Automatic two-way HA/Pascal structure creation/deletion remains a later feature.

### Checkpoint D — release packaging

**Active.**

Progress:

1. repeatable manual-install ZIP and documentation — **completed in PR #14**,
2. HACS repository metadata and GitHub Release tooling — **completed in PR #15**,
3. brand/release hardening — **completed in PR #16**,
4. offline release preflight shared by local tooling/CI/release — **completed in PR #17**,
5. public-beta licensing and stable-release lock — **completed in PR #18**,
6. public visibility — **completed**,
7. HACS validation + `v0.3.0-beta.1` prerelease — **current checkpoint**,
8. production-like install/update validation on a test Home Assistant instance,
9. mobile/tablet performance profiles,
10. optional Lovelace 3D view card.

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
