"""Pure project model for HA 3D Dashboard persistence."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
import json
import math
import re
from typing import Any, Callable

PROJECT_DOCUMENT_VERSION = 1
STORAGE_PAYLOAD_VERSION = 1
MAX_PROJECT_JSON_BYTES = 16 * 1024 * 1024

_PROJECT_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
_SUPPORTED_HA_DOMAINS = {
    "light",
    "cover",
    "switch",
    "sensor",
    "binary_sensor",
    "climate",
}
_COVER_MOTION_AXES = {"x", "y", "z"}
MISSING = object()


class ProjectError(Exception):
    """Base exception for project operations."""


class InvalidProjectError(ProjectError):
    """Raised when a project document is invalid."""


class ProjectAlreadyExistsError(ProjectError):
    """Raised when creating an existing project."""


class ProjectNotFoundError(ProjectError):
    """Raised when a project does not exist."""


class EmptySceneRejectedError(ProjectError):
    """Raised when a populated scene would be silently wiped."""


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
    return {
        "version": 1,
        "bindings": [],
        "structureMappings": {"floors": [], "areas": []},
    }


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


def _validate_scene(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    scene = _validate_document_mapping(value, "scene")
    assert scene is not None

    nodes = scene.get("nodes")
    roots = scene.get("rootNodeIds")
    if not isinstance(nodes, dict):
        raise InvalidProjectError("scene nodes must be an object")
    if not isinstance(roots, list) or any(not isinstance(root, str) for root in roots):
        raise InvalidProjectError("scene rootNodeIds must be an array of strings")
    if any(root not in nodes for root in roots):
        raise InvalidProjectError("scene rootNodeIds must reference existing nodes")

    for key in ("collections", "materials"):
        if key in scene and not isinstance(scene[key], dict):
            raise InvalidProjectError(f"scene {key} must be an object")
    if "installedPlugins" in scene and (
        not isinstance(scene["installedPlugins"], list)
        or any(not isinstance(plugin, str) for plugin in scene["installedPlugins"])
    ):
        raise InvalidProjectError("scene installedPlugins must be an array of strings")

    return scene


def _validate_timestamp(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise InvalidProjectError(f"{field} must be a non-empty timestamp string")
    return value


def _validate_ha_config(value: Any) -> dict[str, Any]:
    config = _validate_document_mapping(value, "ha_config")
    assert config is not None
    if config.get("version") != 1:
        raise InvalidProjectError("unsupported ha_config version")
    bindings = config.get("bindings")
    if not isinstance(bindings, list):
        raise InvalidProjectError("ha_config bindings must be an array")

    structure_mappings = config.get("structureMappings", MISSING)
    if structure_mappings is not MISSING and not isinstance(structure_mappings, dict):
        raise InvalidProjectError("ha_config structureMappings must be an object")

    if isinstance(structure_mappings, dict):
        floors = structure_mappings.get("floors")
        areas = structure_mappings.get("areas")
        if not isinstance(floors, list):
            raise InvalidProjectError(
                "ha_config structureMappings floors must be an array"
            )
        if not isinstance(areas, list):
            raise InvalidProjectError(
                "ha_config structureMappings areas must be an array"
            )

        seen_floor_ids: set[str] = set()
        seen_level_node_ids: set[str] = set()
        for mapping in floors:
            if not isinstance(mapping, dict):
                raise InvalidProjectError("ha_config floor mapping must be an object")
            floor_id = mapping.get("floorId")
            level_node_id = mapping.get("levelNodeId")
            if not isinstance(floor_id, str) or not floor_id.strip():
                raise InvalidProjectError(
                    "ha_config floor mapping floorId must be a non-empty string"
                )
            if not isinstance(level_node_id, str) or not level_node_id.strip():
                raise InvalidProjectError(
                    "ha_config floor mapping levelNodeId must be a non-empty string"
                )
            if floor_id in seen_floor_ids or level_node_id in seen_level_node_ids:
                raise InvalidProjectError("ha_config floor mappings must be one-to-one")
            seen_floor_ids.add(floor_id)
            seen_level_node_ids.add(level_node_id)

        seen_area_ids: set[str] = set()
        seen_zone_node_ids: set[str] = set()
        for mapping in areas:
            if not isinstance(mapping, dict):
                raise InvalidProjectError("ha_config area mapping must be an object")
            area_id = mapping.get("areaId")
            zone_node_id = mapping.get("zoneNodeId")
            if not isinstance(area_id, str) or not area_id.strip():
                raise InvalidProjectError(
                    "ha_config area mapping areaId must be a non-empty string"
                )
            if not isinstance(zone_node_id, str) or not zone_node_id.strip():
                raise InvalidProjectError(
                    "ha_config area mapping zoneNodeId must be a non-empty string"
                )
            if area_id in seen_area_ids or zone_node_id in seen_zone_node_ids:
                raise InvalidProjectError("ha_config area mappings must be one-to-one")
            seen_area_ids.add(area_id)
            seen_zone_node_ids.add(zone_node_id)

    for binding in bindings:
        if not isinstance(binding, dict):
            raise InvalidProjectError("ha_config binding must be an object")

        node_id = binding.get("nodeId")
        entity_id = binding.get("entityId")
        if not isinstance(node_id, str) or not node_id.strip():
            raise InvalidProjectError("ha_config binding nodeId must be a non-empty string")
        if not isinstance(entity_id, str) or not entity_id.strip():
            raise InvalidProjectError("ha_config binding entityId must be a non-empty string")

        normalized_entity_id = entity_id.strip()
        separator = normalized_entity_id.find(".")
        if separator <= 0 or separator == len(normalized_entity_id) - 1:
            raise InvalidProjectError("ha_config binding entityId is invalid")
        domain = normalized_entity_id[:separator]
        if domain not in _SUPPORTED_HA_DOMAINS:
            raise InvalidProjectError("ha_config binding domain is unsupported")
        if "domain" in binding and binding["domain"] != domain:
            raise InvalidProjectError("ha_config binding domain does not match entityId")
        if "enabled" in binding and not isinstance(binding["enabled"], bool):
            raise InvalidProjectError("ha_config binding enabled must be a boolean")

        cover_motion = binding.get("coverMotion", MISSING)
        if domain != "cover" and cover_motion is not MISSING:
            raise InvalidProjectError("coverMotion is only valid for cover bindings")
        if cover_motion is MISSING:
            continue
        if not isinstance(cover_motion, dict):
            raise InvalidProjectError("ha_config binding coverMotion must be an object")

        axis = cover_motion.get("axis")
        offset = cover_motion.get("openOffsetMeters")
        duration = cover_motion.get("durationMs")
        if axis not in _COVER_MOTION_AXES:
            raise InvalidProjectError("coverMotion axis must be x, y, or z")
        if (
            isinstance(offset, bool)
            or not isinstance(offset, (int, float))
            or not math.isfinite(offset)
        ):
            raise InvalidProjectError("coverMotion openOffsetMeters must be finite")
        if (
            isinstance(duration, bool)
            or not isinstance(duration, (int, float))
            or not math.isfinite(duration)
            or duration < 0
            or duration > 60_000
        ):
            raise InvalidProjectError("coverMotion durationMs must be between 0 and 60000")

    return config

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
        "scene": _validate_scene(raw.get("scene")),
        "ha_config": _validate_ha_config(raw.get("ha_config")),
        "created_at": _validate_timestamp(raw.get("created_at"), "created_at"),
        "updated_at": _validate_timestamp(raw.get("updated_at"), "updated_at"),
    }
    _ensure_json_size(document)
    return document


def _scene_node_count(scene: Any) -> int:
    if not isinstance(scene, dict):
        return 0
    nodes = scene.get("nodes")
    return len(nodes) if isinstance(nodes, dict) else 0


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
            "scene": _validate_scene(scene),
            "ha_config": _validate_ha_config(
                default_ha_config() if ha_config is None else ha_config
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
        force_empty_scene: bool = False,
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
            next_scene = _validate_scene(scene)
            if (
                not force_empty_scene
                and _scene_node_count(current["scene"]) > 0
                and _scene_node_count(next_scene) == 0
            ):
                raise EmptySceneRejectedError(
                    "Refusing to overwrite a populated project with an empty scene"
                )
            candidate["scene"] = next_scene
        if ha_config is not MISSING:
            candidate["ha_config"] = _validate_ha_config(ha_config)

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
