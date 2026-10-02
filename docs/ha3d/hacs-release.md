# HACS and GitHub Release

HA 3D Dashboard is prepared for HACS-style releases, but HACS can only access
**public GitHub repositories**. Keep using the manual ZIP while this repository
is private.

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

Do not change repository visibility just to test the integration. Manual
installation remains supported for private development.

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
python3 scripts/preflight-ha-release.py --version 0.3.0
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
3. rebuilds the HA panel and produces both ZIP layouts plus SHA256 checksums,
4. verifies the generated frontend matches the committed frontend,
5. checks that the release/tag does not already exist,
6. creates a GitHub Release only when `dry-run=false`.

No package is published by a push to `main`.

## First release procedure

Before the first public HACS release:

1. merge all release-readiness changes,
2. run `bun run ha:release:preflight` locally,
3. decide whether the repository should become public,
4. if public, set the repository description and topics,
5. run **HACS Validate** manually,
6. run **HA Release** once with `dry-run=true`,
7. inspect the workflow result and package checksums,
8. only then run **HA Release** with `dry-run=false`.

Do not create the first release before those checks have passed.

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
