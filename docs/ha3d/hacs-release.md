# HACS and GitHub Release

HA 3D Dashboard is prepared for HACS-style releases. HACS can only access
**public GitHub repositories**, so the repository must be public for the beta
test. `v0.3.0-beta.1` verified the install/backend/config-flow path. `v0.3.0-beta.2`
fixed the panel host sizing but exposed a browser-runtime `process is not
defined` crash. PR #20 is merged with an always-on browser `process.env`
compatibility prelude; the next release target is `v0.3.0-beta.3`. These are
custom-repository beta tests, not HACS-default or stable production releases.

## Repository prerequisites

Before testing installation through HACS, the GitHub repository must meet these
external repository requirements:

- repository visibility: **public**,
- a short repository description,
- at least one GitHub topic,
- Issues enabled,
- at least one published GitHub Release when release-based installation is used.

Recommended repository metadata:

- description: `Native 3D Home Assistant dashboard and editor based on Pascal`
- topics: `home-assistant`, `hacs`, `3d-dashboard`, `smart-home`

Changing a repository to public makes its contents visible and forkable on
GitHub. The beta evaluation license limits the rights granted for HA 3D
Dashboard-specific code, but it is not a technical anti-copy mechanism.
Upstream Pascal/third-party MIT code remains usable under its original license.

Manual installation remains supported for private development and recovery.

## Public beta guardrails

The repository contains `BETA_RELEASE_LOCK`. While that file exists:

- the integration source version must contain a `-beta.` prerelease suffix,
- the **HA Release** workflow refuses `prerelease=false`,
- the release preflight fails if a stable HA version is prepared,
- release ZIPs must include `LICENSE.txt` and `THIRD_PARTY_NOTICES.txt`.

Removing the lock is a separate production-readiness decision and should happen
only after install/update, persistence and rollback tests have passed.

The HA-specific source is covered by
[`HA3D_EVALUATION_LICENSE.md`](../../HA3D_EVALUATION_LICENSE.md). Pascal
Editor-derived and other third-party code keeps its original license terms.

## HACS repository layout

The repository contains exactly one integration under:

```text
custom_components/ha_3d_dashboard/
```

The root `hacs.json` configures release ZIP installation:

```json
{
  "name": "HA 3D Dashboard",
  "zip_release": true,
  "filename": "ha_3d_dashboard.zip",
  "hide_default_branch": true,
  "homeassistant": "2026.9.0",
  "hacs": "2.0.0"
}
```

`hide_default_branch` is intentional. Normal HACS installs should use a reviewed
release rather than an arbitrary development snapshot.

## Why the HACS ZIP differs from the manual ZIP

The manual ZIP is meant to be extracted into the Home Assistant configuration
directory and therefore starts with:

```text
custom_components/ha_3d_dashboard/
```

HACS already installs into:

```text
/config/custom_components/ha_3d_dashboard/
```

so the release asset `ha_3d_dashboard.zip` must contain the integration files
at the ZIP root:

```text
__init__.py
manifest.json
config_flow.py
frontend/
translations/
brand/
...
```

Build it locally with:

```bash
bun run ha:package:hacs
```

The normal manual package remains:

```bash
bun run ha:package
```

## Offline release preflight

Before spending GitHub Actions minutes, run the same package/metadata preflight locally:

```bash
bun install
bun run ha:release:preflight
```

The preflight validates:

- the HACS-required manifest keys,
- `manifest.json` / `const.py` version agreement,
- the one-integration `custom_components/` repository shape,
- the release-oriented `hacs.json` settings,
- both manual and HACS ZIP layouts,
- brand/runtime files through the package builder,
- SHA256 checksums for both release assets.

It writes:

```text
dist/ha_3d_dashboard.zip
dist/ha_3d_dashboard-v<version>.zip
dist/SHA256SUMS
```

To verify an explicit release version:

```bash
python3 scripts/preflight-ha-release.py --version 0.3.0-beta.2
```

## Brand assets

The integration ships local Home Assistant brand assets in:

```text
custom_components/ha_3d_dashboard/brand/
├── icon.png
├── dark_icon.png
├── icon@2x.png
└── dark_icon@2x.png
```

The normal icons are 256×256 px and the hDPI variants are 512×512 px. The
package builder validates these dimensions before producing either ZIP layout.

Home Assistant 2026.3+ supports local brand assets directly from the custom
integration, so a separate brand-repository contribution is not required for the
integration UI itself.

## HACS validation

A deliberately manual workflow exists:

```text
.github/workflows/ha-hacs-validate.yml
```

It uses the official HACS validation action for an `integration` repository.

For the current custom-repository beta, the workflow intentionally passes
`ignore: license`. HACS added an action-only license validator that requires
GitHub to identify an **OSI-approved** repository license. The HA-specific beta
layer deliberately uses a source-available evaluation license instead, while
the upstream Pascal code keeps its MIT terms. The HACS action's validation
manager runs these validators only in action mode; this ignored check therefore
does not alter the integration package or its runtime behavior.

This means the beta workflow is suitable only for **custom repository testing**.
It is not evidence that the project qualifies for the HACS default catalogue:
HACS requires default submissions to pass the action without errors or ignores.

Run it only after the repository is public and the GitHub description/topics
have been configured. It is intentionally not scheduled and does not run on
every PR because GitHub Actions minutes are treated as a constrained resource.

## HA release workflow

The Home Assistant integration has its own workflow, separate from Pascal's npm
release workflow:

```text
.github/workflows/ha-release.yml
```

It is **workflow_dispatch only**.

Inputs:

- `version` — version being released,
- `prerelease` — whether the GitHub Release is marked prerelease,
- `dry-run` — defaults to `true`; when true no tag or release is created.

The workflow refuses to release if the requested version does not already match
both:

- `custom_components/ha_3d_dashboard/manifest.json`,
- `custom_components/ha_3d_dashboard/const.py`.

That means release versions are reviewed in source before publication instead of
being silently rewritten by CI.

The workflow then:

1. installs locked repository dependencies,
2. runs the same offline release preflight with the requested version,
3. enforces `BETA_RELEASE_LOCK` when present,
4. rebuilds the HA panel and produces both ZIP layouts plus SHA256 checksums,
5. verifies the generated frontend matches the committed frontend,
6. checks that the release/tag does not already exist,
7. creates a GitHub Release only when `dry-run=false`.

No package is published by a push to `main`.

## First release procedure

Before the first public HACS beta release:

1. merge the public-beta safeguard PR and require green normal PR CI,
2. verify `bun run ha:release:preflight` for `0.3.0-beta.1`,
3. make the repository public and set its description/topics,
4. run **HACS Validate** manually once; for this custom beta the license check
   is intentionally ignored and every other check must pass,
5. run **HA Release** with `version=0.3.0-beta.1`, `prerelease=true`,
   `dry-run=true`,
6. inspect the workflow result and package checksums,
7. run **HA Release** again with the same version and `dry-run=false`,
8. in HACS, enable prerelease/beta versions for this custom repository if
   required, then install and test on a non-production Home Assistant instance.

Do not create a stable release while `BETA_RELEASE_LOCK` exists.

## Adding as a custom HACS repository

After the repository is public and has a release:

1. Open HACS.
2. Add `Grzechu51/ha-3d-dashboard` as a custom repository.
3. Select repository type **Integration**.
4. Install the desired release.
5. Restart Home Assistant.
6. Add **HA 3D Dashboard** from **Settings → Devices & services**.
7. Open the **HA 3D** sidebar panel.

Project data is stored through the Home Assistant Store and is not kept inside
the integration package, so updating the integration package is not intended to
remove projects.
