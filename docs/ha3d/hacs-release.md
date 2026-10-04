# HACS and GitHub Release

HA 3D Dashboard is prepared for HACS-style releases. HACS can only access
**public GitHub repositories**, so the repository must be public for the beta
test. Early beta releases validated HACS installation, the native HA panel,
standalone browser compatibility and real editor persistence. Current releases
remain custom-repository beta tests, not HACS-default or stable production
releases.

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
- **HA Release** derives prerelease status from the source version and refuses
  a stable version while the lock exists,
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
python3 scripts/preflight-ha-release.py --version 0.3.0-beta.10
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

Normal beta publication is automatic. The workflow watches `main` for changes
to the HA integration source version in:

- `custom_components/ha_3d_dashboard/manifest.json`,
- `custom_components/ha_3d_dashboard/const.py`.

After a reviewed PR with green normal CI is merged, a real source-version change
starts **HA Release** automatically. The workflow reads the version from source,
derives prerelease status from the version suffix, runs the full release
preflight, checks the beta lock and existing tags, and publishes the GitHub
Release when every gate passes.

A manual `workflow_dispatch` entry remains as a recovery path. Its optional
`version` must still match source. `dry-run` defaults to `false`; use a manual
dry run only when debugging release infrastructure, not as a routine second pass
after every green PR.

The workflow refuses to release if `manifest.json` and `const.py` disagree.
While `BETA_RELEASE_LOCK` exists, only `-beta.N` versions can pass preflight and
they are published as GitHub prereleases.

The workflow:

1. resolves the source version and skips push events where the version did not
   actually change,
2. installs locked repository dependencies,
3. runs the offline release preflight for the resolved version,
4. enforces `BETA_RELEASE_LOCK` when present,
5. rebuilds the HA panel and produces both ZIP layouts plus SHA256 checksums,
6. verifies the generated frontend matches the committed frontend,
7. checks that the release/tag does not already exist,
8. creates the GitHub Release automatically for a valid version-changing push
   to `main`.

## Beta release procedure

For normal beta development:

1. implement the change and bump both source version declarations in the same
   feature PR,
2. require green normal PR CI,
3. merge the PR to `main`,
4. let **HA Release** run automatically,
5. verify the automatic run and GitHub Release,
6. update through HACS and perform the real Home Assistant smoke test.

Do not manually run a duplicate release after a successful automatic run. Do not
create a stable release while `BETA_RELEASE_LOCK` exists.

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
