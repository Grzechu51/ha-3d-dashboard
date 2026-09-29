"""Home Assistant Store-backed persistence for HA 3D Dashboard projects."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION
from .project_model import MISSING, ProjectCollection

_LOGGER = logging.getLogger(__name__)


class HomeAssistantProjectStore:
    """Serialize project mutations and persist them through Home Assistant Store."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(
            hass,
            STORAGE_VERSION,
            STORAGE_KEY,
            private=True,
            atomic_writes=True,
            serialize_in_event_loop=False,
        )
        self._projects = ProjectCollection()
        self._mutation_lock = asyncio.Lock()

    async def async_load(self) -> None:
        """Load project data once during integration setup."""
        raw = await self._store.async_load()
        self._projects, ignored = ProjectCollection.from_storage(raw)
        if ignored:
            _LOGGER.warning(
                "Ignored invalid HA 3D project storage entries: %s",
                ", ".join(ignored),
            )

    def list_projects(self) -> list[dict[str, Any]]:
        """List project metadata."""
        return self._projects.list_metadata()

    def get_project(self, project_id: str) -> dict[str, Any]:
        """Return one full project document."""
        return self._projects.get(project_id)

    async def async_create_project(
        self,
        *,
        project_id: str,
        name: str,
        scene: dict[str, Any] | None = None,
        ha_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create and durably persist a project."""
        async with self._mutation_lock:
            project = self._projects.create(
                project_id=project_id,
                name=name,
                scene=scene,
                ha_config=ha_config,
            )
            await self._store.async_save(self._projects.export())
            return project

    async def async_save_project(
        self,
        project_id: str,
        *,
        expected_revision: int,
        name: str | object = MISSING,
        scene: dict[str, Any] | None | object = MISSING,
        ha_config: dict[str, Any] | object = MISSING,
    ) -> dict[str, Any]:
        """Persist a project update with optimistic concurrency."""
        async with self._mutation_lock:
            project = self._projects.save(
                project_id,
                expected_revision=expected_revision,
                name=name,
                scene=scene,
                ha_config=ha_config,
            )
            await self._store.async_save(self._projects.export())
            return project

    async def async_delete_project(
        self, project_id: str, *, expected_revision: int
    ) -> None:
        """Delete a project with optimistic concurrency."""
        async with self._mutation_lock:
            self._projects.delete(
                project_id,
                expected_revision=expected_revision,
            )
            await self._store.async_save(self._projects.export())
