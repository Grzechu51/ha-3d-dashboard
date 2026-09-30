"""Distribution contract tests for HA 3D Dashboard."""

from __future__ import annotations

import json
from pathlib import Path
import re
import struct
import unittest


_INTEGRATION_DIR = Path(__file__).parents[1]
_REPO_ROOT = Path(__file__).parents[3]


class DistributionContractTests(unittest.TestCase):
    def test_manifest_and_runtime_versions_match(self) -> None:
        manifest = json.loads((_INTEGRATION_DIR / "manifest.json").read_text())
        const_source = (_INTEGRATION_DIR / "const.py").read_text()
        match = re.search(r'^VERSION: Final = "([^"]+)"$', const_source, re.MULTILINE)

        self.assertIsNotNone(match)
        self.assertEqual(manifest["version"], match.group(1))

    def test_hacs_manifest_targets_release_zip(self) -> None:
        hacs = json.loads((_REPO_ROOT / "hacs.json").read_text())

        self.assertEqual(hacs["name"], "HA 3D Dashboard")
        self.assertTrue(hacs["zip_release"])
        self.assertEqual(hacs["filename"], "ha_3d_dashboard.zip")

    def test_local_brand_icon_is_256_square_png(self) -> None:
        icon = (_INTEGRATION_DIR / "brand" / "icon.png").read_bytes()

        self.assertEqual(icon[:8], b"\x89PNG\r\n\x1a\n")
        width, height = struct.unpack(">II", icon[16:24])
        self.assertEqual((width, height), (256, 256))

    def test_generated_panel_bundle_is_present(self) -> None:
        frontend = _INTEGRATION_DIR / "frontend"

        self.assertTrue((frontend / "ha3d-panel.js").is_file())
        self.assertTrue((frontend / "ha3d-panel.css").is_file())


if __name__ == "__main__":
    unittest.main()
