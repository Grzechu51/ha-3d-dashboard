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

Status: **PR #20 merged; browser-runtime fix ready for beta.3 release**

PR #8 through PR #20 are merged to `main`. The native project shell,
project management, Home Assistant structure mapping, GitHub Actions cost
controls, manual/HACS packaging, release tooling, brand hardening, shared
offline release preflight and public-beta safeguards are complete. The latest
runtime fix prepends a browser-safe `process.env` shim to the generated HA
panel bundle before bundled dependencies execute.

The active checkpoint is:

`v0.3.0-beta.5 portable image/assets fix -> HACS editor retest`

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

The second manual **HACS Validate** run passed all eight enabled checks after
intentionally skipping only the action-only license validator for the
source-available beta. The guarded **HA Release** dry-run then passed from
commit `909b197c`, and the same commit was published as GitHub prerelease
`v0.3.0-beta.1`.

The release contains the HACS package, manual-install package and SHA256
checksums. The first real HACS install of `v0.3.0-beta.1` succeeded: HACS
installed the integration, Home Assistant loaded the config flow, the integration
entry was created and the **HA 3D** sidebar panel registered. The panel content
itself was blank.

Inspection against the current Home Assistant frontend found a host-contract
mismatch: the integration registered `handle_safe_area=True`, which tells
Home Assistant not to apply its normal block/sizing wrapper for a non-iframe
custom panel, while the HA 3D web component did not provide equivalent host
sizing itself. The fix removes that opt-out and gives the web component an explicit
full-viewport block host. PR #19 passed CI, was merged to `main`, and
`v0.3.0-beta.2` was published from commit `04fd7a6e` after a successful
release dry-run. Updating the test instance to beta.2 confirmed that the panel
module itself loads with HTTP 200, but browser execution stops before custom
element registration with `ReferenceError: process is not defined`.

Inspection of the generated browser bundle found 33 `process.env` references
from bundled Pascal/Next-compatible dependencies (including
`NEXT_PUBLIC_ASSETS_CDN_URL` and `NEXT_PUBLIC_SUPABASE_URL`). The HA panel
build now prepends a minimal browser `process.env` compatibility shim before
the bundle executes. `v0.3.0-beta.3` was published and installed through HACS;
the real Home Assistant smoke test now renders the native **HA 3D Dashboard**
project shell correctly instead of a blank panel. The real test instance has now also created and opened the first project
(`My home`) through the native HA project flow. The project survives a browser
refresh and is listed again at revision 1, confirming browser-refresh persistence
through Home Assistant Store. The empty-scene project shell renders correctly.

The beta.3 editor-launch diagnostic is now isolated: pressing **Build in editor**
throws React production error #130 (invalid element type: an object was rendered
as a component) from the legacy Pascal `layoutVersion="v1"` shell. The same
repository's current standalone editor uses `layoutVersion="v2"`, while the HA
embed was still pinned to the older v1 path.

The beta.4 fix moved the HA embed onto the current v2 editor shell with native
Scene/Settings tabs and kept an HA-local render error boundary. The real HA
retest still failed with React production error #130. The captured component
stack and direct inspection of the emitted bundle now isolate the first invalid
element to `ControlModes` inside `ActionMenu`: the standalone HA bundle is
trying to render the `next/image` module object as a React component.

The same beta.4 retest exposed Pascal public assets such as
`/icons/settings.webp`, `/icons/level.webp`, `/icons/site-flag.webp` and
`/icons/building.webp` as 404 because the Next app public directory is not part
of the HACS integration package.

The beta.5 fix replaces the always-mounted ActionMenu `next/image` usages with
browser-native `<img>`, rewrites emitted `/icons/` references to
`/ha3d_static/icons/`, and adds Pascal icon assets to both HACS and manual
release ZIPs without duplicating them in the committed integration source tree.
The editor error boundary remains active for the next real HA smoke test.

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
7. HACS validation — **completed**,
8. `v0.3.0-beta.1` release dry-run + prerelease — **completed**,
9. production-like install/update validation on a test Home Assistant instance — **in progress; beta.4 isolated next/image + missing public assets, beta.5 fix pending**,
10. mobile/tablet performance profiles,
11. optional Lovelace 3D view card.

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
