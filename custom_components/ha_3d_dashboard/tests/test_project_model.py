"""Unit tests for the pure HA 3D project model."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

_MODULE_PATH = Path(__file__).parents[1] / "project_model.py"
_SPEC = importlib.util.spec_from_file_location("ha3d_project_model", _MODULE_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_MODEL = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _MODEL
_SPEC.loader.exec_module(_MODEL)

EmptySceneRejectedError = _MODEL.EmptySceneRejectedError
InvalidProjectError = _MODEL.InvalidProjectError
ProjectAlreadyExistsError = _MODEL.ProjectAlreadyExistsError
ProjectCollection = _MODEL.ProjectCollection
ProjectNotFoundError = _MODEL.ProjectNotFoundError
ProjectVersionConflictError = _MODEL.ProjectVersionConflictError


class ProjectCollectionTests(unittest.TestCase):
    def test_create_list_and_get_are_defensive(self) -> None:
        collection = ProjectCollection(clock=lambda: "2026-09-29T10:00:00+00:00")
        created = collection.create(
            project_id="main_house",
            name=" Main house ",
            scene={"nodes": {"site": {"type": "site"}}, "rootNodeIds": ["site"]},
        )

        self.assertEqual(created["name"], "Main house")
        self.assertEqual(created["revision"], 1)
        self.assertEqual(created["ha_config"], {"version": 1, "bindings": []})
        self.assertEqual(collection.list_metadata()[0]["id"], "main_house")

        loaded = collection.get("main_house")
        loaded["scene"]["nodes"].clear()
        self.assertIn("site", collection.get("main_house")["scene"]["nodes"])

    def test_duplicate_and_missing_projects_are_explicit(self) -> None:
        collection = ProjectCollection(clock=lambda: "2026-09-29T10:00:00+00:00")
        collection.create(project_id="main", name="Main")

        with self.assertRaises(ProjectAlreadyExistsError):
            collection.create(project_id="main", name="Again")
        with self.assertRaises(ProjectNotFoundError):
            collection.get("missing")

    def test_save_increments_revision_only_when_content_changes(self) -> None:
        times = iter(
            [
                "2026-09-29T10:00:00+00:00",
                "2026-09-29T10:01:00+00:00",
            ]
        )
        collection = ProjectCollection(clock=lambda: next(times))
        collection.create(project_id="main", name="Main")

        unchanged = collection.save("main", expected_revision=1, name="Main")
        self.assertEqual(unchanged["revision"], 1)

        updated = collection.save(
            "main",
            expected_revision=1,
            ha_config={
                "version": 1,
                "bindings": [{"nodeId": "lamp", "entityId": "light.salon"}],
            },
        )
        self.assertEqual(updated["revision"], 2)
        self.assertEqual(updated["updated_at"], "2026-09-29T10:01:00+00:00")

    def test_populated_scene_cannot_be_silently_replaced_with_empty_scene(self) -> None:
        collection = ProjectCollection(clock=lambda: "2026-09-29T10:00:00+00:00")
        collection.create(
            project_id="main",
            name="Main",
            scene={"nodes": {"site": {"type": "site"}}, "rootNodeIds": ["site"]},
        )

        with self.assertRaises(EmptySceneRejectedError):
            collection.save(
                "main",
                expected_revision=1,
                scene={"nodes": {}, "rootNodeIds": []},
            )

        updated = collection.save(
            "main",
            expected_revision=1,
            scene={"nodes": {}, "rootNodeIds": []},
            force_empty_scene=True,
        )
        self.assertEqual(updated["revision"], 2)

    def test_stale_save_and_delete_are_rejected(self) -> None:
        times = iter(
            [
                "2026-09-29T10:00:00+00:00",
                "2026-09-29T10:01:00+00:00",
            ]
        )
        collection = ProjectCollection(clock=lambda: next(times))
        collection.create(project_id="main", name="Main")
        collection.save("main", expected_revision=1, name="Renamed")

        with self.assertRaises(ProjectVersionConflictError) as save_error:
            collection.save("main", expected_revision=1, name="Stale")
        self.assertEqual(save_error.exception.current_revision, 2)

        with self.assertRaises(ProjectVersionConflictError):
            collection.delete("main", expected_revision=1)
        self.assertEqual(collection.get("main")["revision"], 2)

        collection.delete("main", expected_revision=2)
        with self.assertRaises(ProjectNotFoundError):
            collection.get("main")

    def test_validation_rejects_invalid_identifiers_names_and_non_json_values(self) -> None:
        collection = ProjectCollection(clock=lambda: "2026-09-29T10:00:00+00:00")

        with self.assertRaises(InvalidProjectError):
            collection.create(project_id="../bad", name="Bad")
        with self.assertRaises(InvalidProjectError):
            collection.create(project_id="good", name="   ")
        with self.assertRaises(InvalidProjectError):
            collection.create(
                project_id="good",
                name="Good",
                scene={"nodes": {}, "rootNodeIds": [], "bad": float("nan")},
            )
        with self.assertRaises(InvalidProjectError):
            collection.create(
                project_id="good",
                name="Good",
                scene={},
            )
        with self.assertRaises(InvalidProjectError):
            collection.create(
                project_id="good",
                name="Good",
                scene={"nodes": {}, "rootNodeIds": ["missing"]},
            )
        with self.assertRaises(InvalidProjectError):
            collection.create(
                project_id="good",
                name="Good",
                ha_config={"version": 999, "bindings": []},
            )
        with self.assertRaises(InvalidProjectError):
            collection.create(
                project_id="good",
                name="Good",
                ha_config={
                    "version": 1,
                    "bindings": [
                        {
                            "nodeId": "lamp",
                            "entityId": "light.salon",
                            "domain": "light",
                            "coverMotion": {
                                "axis": "y",
                                "openOffsetMeters": 1.8,
                                "durationMs": 800,
                            },
                        }
                    ],
                },
            )

    def test_storage_reload_keeps_good_projects_and_drops_bad_entries(self) -> None:
        collection = ProjectCollection(clock=lambda: "2026-09-29T10:00:00+00:00")
        collection.create(project_id="main", name="Main")
        payload = collection.export()
        payload["projects"]["broken"] = {
            "schema_version": 999,
            "id": "broken",
        }

        restored, ignored = ProjectCollection.from_storage(payload)

        self.assertEqual(restored.get("main")["name"], "Main")
        self.assertEqual(ignored, ("broken",))


if __name__ == "__main__":
    unittest.main()
