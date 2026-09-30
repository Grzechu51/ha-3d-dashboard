# HA 3D Dashboard release process

This document covers distribution of the Home Assistant custom integration. It is
separate from Pascal's npm/CLI release workflow.

## Distribution layout

The source integration stays in:

`custom_components/ha_3d_dashboard/`

HACS is configured through the repository-root `hacs.json` to consume a GitHub
release asset named:

`ha_3d_dashboard.zip`

The ZIP is intentionally rooted at the integration contents. When extracted into
`/config/custom_components/ha_3d_dashboard/`, its top-level files are
`__init__.py`, `manifest.json`, `frontend/`, `brand/`, and the rest of the
runtime integration.

Tests, `__pycache__`, and `.pyc` files are excluded.

## Version contract

A release version must match both:

- `custom_components/ha_3d_dashboard/manifest.json -> version`
- `custom_components/ha_3d_dashboard/const.py -> VERSION`

The release workflow accepts SemVer without the leading `v` and creates a GitHub
release tagged `v<version>`.

Do not publish a release by changing only one of the two version declarations.

## Release checklist

1. Merge all intended HA changes to `main`.
2. Bump the integration version in both files above.
3. Build the HA panel and commit the generated `frontend/` output.
4. Make sure the normal repository quality gate passes.
5. Run **HA 3D Release** from `main` with `dry-run=true`.
6. Inspect the uploaded `ha_3d_dashboard.zip` artifact.
7. Run the workflow again with `dry-run=false` to create the GitHub release.
8. Install that release in a clean Home Assistant instance before announcing it.

The workflow independently rebuilds the panel and fails if the generated frontend
differs from the committed bundle.

## HACS validation

`.github/workflows/ha-validate.yml` runs Hassfest for the custom integration.

The HACS validator job is deliberately skipped while the GitHub repository is
private. Current HACS publishing requirements only support public GitHub
repositories. Do not change repository visibility as part of an automated release;
that is an explicit owner decision.

Before HACS distribution is enabled, also make sure the GitHub repository has:

- a short repository description,
- useful topics such as `home-assistant`, `hacs`, `3d`, and
  `home-automation`,
- Issues enabled,
- at least one published GitHub release.

## Manual installation while the repository is private

A release ZIP can still be tested manually:

1. Download `ha_3d_dashboard.zip`.
2. Create `/config/custom_components/ha_3d_dashboard/`.
3. Extract the ZIP contents directly into that directory.
4. Restart Home Assistant.
5. Open **Settings -> Devices & services -> Add integration**.
6. Add **HA 3D Dashboard**.

A Home Assistant restart is also recommended after updating the custom integration.
