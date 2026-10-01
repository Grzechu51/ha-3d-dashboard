# Manual Home Assistant installation

This is the baseline installation path before HACS packaging is introduced.

## What gets installed

The package contains:

```text
custom_components/
└── ha_3d_dashboard/
    ├── __init__.py
    ├── config_flow.py
    ├── const.py
    ├── manifest.json
    ├── project_model.py
    ├── storage.py
    ├── strings.json
    ├── websocket.py
    ├── frontend/
    │   ├── ha3d-panel.css
    │   └── ha3d-panel.js
    └── translations/
        ├── en.json
        └── pl.json
```

Tests and Python cache files are intentionally excluded from the install ZIP.

## Build the ZIP locally

Requirements:

- Bun 1.3.14 or a compatible Bun version for the repository,
- Python 3,
- repository dependencies installed with `bun install`.

From the repository root:

```bash
python3 scripts/build-ha-package.py
```

The script rebuilds the native HA panel first, verifies that `manifest.json` and
`const.py` use the same integration version, validates the required runtime
files and writes:

```text
dist/ha_3d_dashboard-v<version>.zip
```

If the committed frontend bundle is already known to be current, packaging can
skip the frontend rebuild:

```bash
python3 scripts/build-ha-package.py --skip-frontend-build
```

On Windows, when Python is exposed through the launcher instead of `python3`:

```powershell
py -3 scripts/build-ha-package.py
```

The archive is ready to extract into the Home Assistant configuration directory.
Its root is `custom_components/ha_3d_dashboard/`.

## Install in Home Assistant

1. Make a backup of the Home Assistant configuration before replacing a custom integration.
2. Extract the ZIP into the Home Assistant configuration directory, normally `/config`.
3. Verify that this file exists:

   ```text
   /config/custom_components/ha_3d_dashboard/manifest.json
   ```

4. Restart Home Assistant.
5. Open **Settings → Devices & services**.
6. Select **Add integration** and search for **HA 3D Dashboard**.
7. Add the integration.
8. Open the **HA 3D** sidebar panel.

Creating, editing, renaming and deleting HA 3D projects requires a Home Assistant
administrator account. Non-admin users can open existing projects in Dashboard mode.

## Update a manual installation

1. Build or obtain the ZIP for the new version.
2. Back up Home Assistant.
3. Replace the contents of
   `/config/custom_components/ha_3d_dashboard/` with the new package contents.
4. Do **not** delete the Home Assistant `.storage` project data.
5. Restart Home Assistant.
6. Hard-refresh the browser if an old frontend bundle is still visible.

The integration version is included in the panel module URL, so a normal version
change also changes the frontend cache key.

## Project data

HA 3D project data is stored by Home Assistant's Store API and is separate from
the files under `custom_components/ha_3d_dashboard/`. Replacing the integration
files during an update is not intended to remove projects.

The project Store currently uses:

```text
ha_3d_dashboard.projects
```

inside Home Assistant-managed storage.

## Current limitations

- HACS installation is not implemented yet.
- GitHub Releases for the HA integration are not implemented yet.
- Automatic two-way creation/deletion of Home Assistant Floors/Areas and Pascal
  Levels/Zones is intentionally not implemented.
- The first release path is the native **HA 3D** panel; a reusable Lovelace card
  remains a later checkpoint.
