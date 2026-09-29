"""Pure project model for HA 3D Dashboard persistence."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
import json
import re
from typing import Any, Callable

PROJECT_DOCUMENT_VERSION = 1
STORAGE_PAYLOAD_VERSION = 1
MAX_PROJECT_JSON_BYTES = 16 * 1024 * 1024

_PROJECT_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
MISSING = object()


class ProjectError(Exception):
    """Base exception for project operations."""


class InvalidProjectError(ProjectError):
    """Raised when a project document is invalid."""


class ProjectAlreadyExistsError(ProjectError):
    """Raised when creating an existing project."""


class ProjectNotFoundError(ProjectError):
    """Raised when a project does not exist."""


class ProjectVersionConflictError(ProjectError):
    """Raised when optimistic concurrency detects a stale writer."""

    def __init__(self, expected_revision: int, current_revision: int) -> None:
        self.expected_revision = expected_revision
        self.current_revision = current_revision
        super().__init__(
            f"Project revision conflict: expected {expected_revision}, "
            f"current {current_revision}"
        )


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def default_ha_config() -> dict[str, Any]:
    """Return an empty HA-specific sidecar matching the frontend v1 contract."""
    return {"version": 1, "bindings": []}


def _validate_project_id(project_id: str) -> str:
    value = project_id.strip()
    if not _PROJECT_ID_RE.fullmatch(value):
        raise InvalidProjectError(
            "project_id must match ^[a-z0-9][a-z0-9_-]{0,63}$"
        )
    return value


def _validate_name(name: str) -> str:
    value = name.strip()
    if not value:
        raise InvalidProjectError("project name must not be empty")
    if len(value) > 120:
        raise InvalidProjectError("project name must be at most 120 characters")
    return value


def _validate_revision(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise InvalidProjectError("project revision must be a positive integer")
    return value


def _validate_document_mapping(
    value: Any, field: str, *, allow_none: bool = False
) -> dict[str, Any] | None:
    if value is None and allow_none:
        return None
    if not isinstance(value, dict):
        raise InvalidProjectError(f"{field} must be an object")
    return deepcopy(value)


def _validate_timestamp(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise InvalidProjectError(f"{field} must be a non-empty timestamp string")
    return value


def _ensure_json_size(document: dict[str, Any]) -> None:
    try:
        payload = json.dumps(
            document,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError) as err:
        raise InvalidProjectError("project contains non-JSON data") from err
    if len(payload) > MAX_PROJECT_JSON_BYTES:
        raise InvalidProjectError(
            f"project exceeds {MAX_PROJECT_JSON_BYTES} serialized bytes"
        )


def _normalize_persisted_project(
    project_id: str, raw: Any
) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise InvalidProjectError("stored project must be an object")

    normalized_id = _validate_project_id(project_id)
    if raw.get("schema_version") != PROJECT_DOCUMENT_VERSION:
        raise InvalidProjectError("unsupported project document version")
    if raw.get("id") != normalized_id:
        raise InvalidProjectError("stored project id does not match its key")

    document = {
        "schema_version": PROJECT_DOCUMENT_VERSION,
        "id": normalized_id,
        "name": _validate_name(raw.get("name", "")),
        "revision": _validate_revision(raw.get("revision")),
        "scene": _validate_document_mapping(raw.get("scene"), "scene", allow_none=True),
        "ha_config": _validate_document_mapping(raw.get("ha_config"), "ha_config"),
        "created_at": _validate_timestamp(raw.get("created_at"), "created_at"),
        "updated_at": _validate_timestamp(raw.get("updated_at"), "updated_at"),
    }
    _ensure_json_size(document)
    return document


def project_metadata(document: dict[str, Any]) -> dict[str, Any]:
    """Return the small list-view shape for a stored project."""
    return {
        "id": document["id"],
        "name": document["name"],
        "revision": document["revision"],
        "created_at": document["created_at"],
        "updated_at": document["updated_at"],
    }


class ProjectCollection:
    """In-memory project collection with optimistic concurrency."""

    def __init__(
        self,
        projects: dict[str, dict[str, Any]] | None = None,
        *,
        clock: Callable[[], str] = _utc_now,
    ) -> None:
        self._projects = projects or {}
        self._clock = clock

    @classmethod
    def from_storage(
        cls,
        raw: Any,
        *,
        clock: Callable[[], str] = _utc_now,
    ) -> tuple["ProjectCollection", tuple[str, ...]]:
        """Load valid projects and report corrupt entries without losing healthy ones."""
        if raw is None:
            return cls(clock=clock), ()
        if not isinstance(raw, dict):
            return cls(clock=clock), ("<root>",)
        if raw.get("schema_version") != STORAGE_PAYLOAD_VERSION:
            return cls(clock=clock), ("<root>",)

        projects = raw.get("projects")
        if not isinstance(projects, dict):
            return cls(clock=clock), ("<root>",)

        valid: dict[str, dict[str, Any]] = {}
        ignored: list[str] = []
        for project_id, document in projects.items():
            if not isinstance(project_id, str):
                ignored.append(str(project_id))
                continue
            try:
                valid[project_id] = _normalize_persisted_project(project_id, document)
            except InvalidProjectError:
                ignored.append(project_id)
        return cls(valid, clock=clock), tuple(ignored)

    def export(self) -> dict[str, Any]:
        """Return an isolated JSON-safe storage payload."""
        return {
            "schema_version": STORAGE_PAYLOAD_VERSION,
            "projects": deepcopy(self._projects),
        }

    def list_metadata(self) -> list[dict[str, Any]]:
        """Return project metadata in a stable human order."""
        values = [project_metadata(project) for project in self._projects.values()]
        return sorted(values, key=lambda item: (item["name"].casefold(), item["id"]))

    def get(self, project_id: str) -> dict[str, Any]:
        """Return a defensive copy of one project."""
        normalized_id = _validate_project_id(project_id)
        project = self._projects.get(normalized_id)
        if project is None:
            raise ProjectNotFoundError(f"Project not found: {normalized_id}")
        return deepcopy(project)

    def create(
        self,
        *,
        project_id: str,
        name: str,
        scene: dict[str, Any] | None = None,
        ha_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a project at revision 1."""
        normalized_id = _validate_project_id(project_id)
        if normalized_id in self._projects:
            raise ProjectAlreadyExistsError(f"Project already exists: {normalized_id}")

        timestamp = self._clock()
        document = {
            "schema_version": PROJECT_DOCUMENT_VERSION,
            "id": normalized_id,
            "name": _validate_name(name),
            "revision": 1,
            "scene": _validate_document_mapping(scene, "scene", allow_none=True),
            "ha_config": _validate_document_mapping(
                default_ha_config() if ha_config is None else ha_config,
                "ha_config",
            ),
            "created_at": timestamp,
            "updated_at": timestamp,
        }
        _ensure_json_size(document)
        self._projects[normalized_id] = document
        return deepcopy(document)

    def save(
        self,
        project_id: str,
        *,
        expected_revision: int,
        name: str | object = MISSING,
        scene: dict[str, Any] | None | object = MISSING,
        ha_config: dict[str, Any] | object = MISSING,
    ) -> dict[str, Any]:
        """Save changed fields if the caller owns the current revision."""
        normalized_id = _validate_project_id(project_id)
        current = self._projects.get(normalized_id)
        if current is None:
            raise ProjectNotFoundError(f"Project not found: {normalized_id}")

        expected = _validate_revision(expected_revision)
        if current["revision"] != expected:
            raise ProjectVersionConflictError(expected, current["revision"])

        candidate = deepcopy(current)
        if name is not MISSING:
            if not isinstance(name, str):
                raise InvalidProjectError("project name must be a string")
            candidate["name"] = _validate_name(name)
        if scene is not MISSING:
            candidate["scene"] = _validate_document_mapping(
                scene, "scene", allow_none=True
            )
        if ha_config is not MISSING:
            candidate["ha_config"] = _validate_document_mapping(
                ha_config, "ha_config"
            )

        comparable = ("name", "scene", "ha_config")
        if all(candidate[key] == current[key] for key in comparable):
            return deepcopy(current)

        candidate["revision"] = current["revision"] + 1
        candidate["updated_at"] = self._clock()
        _ensure_json_size(candidate)
        self._projects[normalized_id] = candidate
        return deepcopy(candidate)

    def delete(self, project_id: str, *, expected_revision: int) -> None:
        """Delete a project if the caller owns the current revision."""
        normalized_id = _validate_project_id(project_id)
        current = self._projects.get(normalized_id)
        if current is None:
            raise ProjectNotFoundError(f"Project not found: {normalized_id}")

        expected = _validate_revision(expected_revision)
        if current["revision"] != expected:
            raise ProjectVersionConflictError(expected, current["revision"])
        del self._projects[normalized_id]
