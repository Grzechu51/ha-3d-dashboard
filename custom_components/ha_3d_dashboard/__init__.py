"""HA 3D Dashboard custom integration."""

from pathlib import Path
from typing import Any

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import (
    DOMAIN,
    PANEL_COMPONENT_NAME,
    PANEL_ICON,
    PANEL_MODULE_URL,
    PANEL_TITLE,
    PANEL_URL_PATH,
    STATIC_URL_PATH,
    VERSION,
)

_FRONTEND_DIR = Path(__file__).parent / "frontend"
_DATA_STATIC_REGISTERED = "static_registered"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up HA 3D Dashboard integration resources."""
    domain_data: dict[str, Any] = hass.data.setdefault(DOMAIN, {})

    if not domain_data.get(_DATA_STATIC_REGISTERED):
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    STATIC_URL_PATH,
                    str(_FRONTEND_DIR),
                    cache_headers=True,
                )
            ]
        )
        domain_data[_DATA_STATIC_REGISTERED] = True

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Register the HA 3D custom panel for a config entry."""
    if frontend.async_panel_exists(hass, PANEL_URL_PATH):
        frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT_NAME,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=PANEL_MODULE_URL,
        config={
            "domain": DOMAIN,
            "version": VERSION,
        },
        require_admin=False,
        config_panel_domain=DOMAIN,
        handle_safe_area=True,
    )

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {}
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the HA 3D custom panel."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True
