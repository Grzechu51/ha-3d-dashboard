"""Constants for HA 3D Dashboard."""

from typing import Final

DOMAIN: Final = "ha_3d_dashboard"
NAME: Final = "HA 3D Dashboard"
VERSION: Final = "0.3.0-beta.24"

PANEL_URL_PATH: Final = "ha-3d"
PANEL_COMPONENT_NAME: Final = "ha3d-dashboard-panel"
PANEL_TITLE: Final = "HA 3D"
PANEL_ICON: Final = "mdi:home-automation"

STATIC_URL_PATH: Final = "/ha3d_static"
PANEL_ASSET_URL_PATH: Final = f"/ha3d_static_build/{VERSION}"
PANEL_MODULE_URL: Final = f"{PANEL_ASSET_URL_PATH}/ha3d-panel.js"

DATA_PROJECT_STORE: Final = "project_store"
DATA_WEBSOCKET_REGISTERED: Final = "websocket_registered"

STORAGE_VERSION: Final = 1
STORAGE_KEY: Final = f"{DOMAIN}.projects"
