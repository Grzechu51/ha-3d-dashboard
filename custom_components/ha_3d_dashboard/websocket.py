"""WebSocket project API for HA 3D Dashboard."""

from __future__ import annotations

import secrets
from typing import Any, cast

import probatio

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv

from .const import DATA_PROJECT_STORE, DOMAIN
from .project_model import (
    MISSING,
    EmptySceneRejectedError,
    InvalidProjectError,
    ProjectAlreadyExistsError,
    ProjectNotFoundError,
    ProjectVersionConflictError,
)
from .storage import HomeAssistantProjectStore

ERR_ALREADY_EXISTS = "already_exists"
ERR_EMPTY_SCENE_REJECTED = "empty_scene_rejected"
ERR_INVALID_PROJECT = "invalid_project"
ERR_NOT_FOUND = "not_found"
ERR_VERSION_CONFLICT = "version_conflict"


def _project_store(hass: HomeAssistant) -> HomeAssistantProjectStore:
    return cast(HomeAssistantProjectStore, hass.data[DOMAIN][DATA_PROJECT_STORE])


def _send_project_error(
    connection: websocket_api.ActiveConnection,
    msg_id: int,
    error: Exception,
) -> None:
    if isinstance(error, EmptySceneRejectedError):
        connection.send_error(msg_id, ERR_EMPTY_SCENE_REJECTED, str(error))
        return
    if isinstance(error, ProjectVersionConflictError):
        connection.send_error(msg_id, ERR_VERSION_CONFLICT, str(error))
        return
    if isinstance(error, ProjectNotFoundError):
        connection.send_error(msg_id, ERR_NOT_FOUND, str(error))
        return
    if isinstance(error, ProjectAlreadyExistsError):
        connection.send_error(msg_id, ERR_ALREADY_EXISTS, str(error))
        return
    if isinstance(error, InvalidProjectError):
        connection.send_error(msg_id, ERR_INVALID_PROJECT, str(error))
        return
    raise error


@websocket_api.websocket_command(
    {probatio.Required("type"): f"{DOMAIN}/project/list"}
)
@callback
def websocket_list_projects(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """List HA 3D projects without their heavy scene payloads."""
    connection.send_result(
        msg["id"],
        {"projects": _project_store(hass).list_projects()},
    )


@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/project/get",
        probatio.Required("project_id"): cv.string,
    }
)
@callback
def websocket_get_project(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Load one HA 3D project."""
    try:
        project = _project_store(hass).get_project(msg["project_id"])
    except Exception as error:
        _send_project_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], project)


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/project/create",
        probatio.Optional("project_id"): cv.string,
        probatio.Required("name"): cv.string,
        probatio.Optional("scene"): probatio.Any(dict, None),
        probatio.Optional("ha_config"): dict,
    }
)
@websocket_api.async_response
async def websocket_create_project(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create an HA 3D project."""
    try:
        project = await _project_store(hass).async_create_project(
            project_id=msg.get("project_id") or secrets.token_hex(8),
            name=msg["name"],
            scene=msg.get("scene"),
            ha_config=msg.get("ha_config"),
        )
    except Exception as error:
        _send_project_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], project)


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/project/save",
        probatio.Required("project_id"): cv.string,
        probatio.Required("expected_revision"): cv.positive_int,
        probatio.Optional("name"): cv.string,
        probatio.Optional("scene"): probatio.Any(dict, None),
        probatio.Optional("ha_config"): dict,
        probatio.Optional("force_empty_scene", default=False): bool,
    }
)
@websocket_api.async_response
async def websocket_save_project(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save an HA 3D project with optimistic concurrency."""
    try:
        project = await _project_store(hass).async_save_project(
            msg["project_id"],
            expected_revision=msg["expected_revision"],
            name=msg["name"] if "name" in msg else MISSING,
            scene=msg["scene"] if "scene" in msg else MISSING,
            ha_config=msg["ha_config"] if "ha_config" in msg else MISSING,
            force_empty_scene=msg["force_empty_scene"],
        )
    except Exception as error:
        _send_project_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], project)


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        probatio.Required("type"): f"{DOMAIN}/project/delete",
        probatio.Required("project_id"): cv.string,
        probatio.Required("expected_revision"): cv.positive_int,
    }
)
@websocket_api.async_response
async def websocket_delete_project(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete an HA 3D project with optimistic concurrency."""
    try:
        await _project_store(hass).async_delete_project(
            msg["project_id"],
            expected_revision=msg["expected_revision"],
        )
    except Exception as error:
        _send_project_error(connection, msg["id"], error)
        return
    connection.send_result(
        msg["id"],
        {"project_id": msg["project_id"], "deleted": True},
    )


@callback
def async_register_project_websocket_api(hass: HomeAssistant) -> None:
    """Register the HA 3D project command surface."""
    websocket_api.async_register_command(hass, websocket_list_projects)
    websocket_api.async_register_command(hass, websocket_get_project)
    websocket_api.async_register_command(hass, websocket_create_project)
    websocket_api.async_register_command(hass, websocket_save_project)
    websocket_api.async_register_command(hass, websocket_delete_project)
