#!/usr/bin/env python3
"""Build a manual-install ZIP for the HA 3D Dashboard custom integration."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
COMPONENT_RELATIVE = Path("custom_components/ha_3d_dashboard")
COMPONENT_DIR = REPO_ROOT / COMPONENT_RELATIVE
MANIFEST_PATH = COMPONENT_DIR / "manifest.json"
CONST_PATH = COMPONENT_DIR / "const.py"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "dist"

EXCLUDED_PARTS = {"tests", "__pycache__"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build a ZIP that can be extracted directly into the Home Assistant "
            "configuration directory."
        )
    )
    parser.add_argument(
        "--skip-frontend-build",
        action="store_true",
        help="Package the committed frontend bundle without rebuilding it first.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional output ZIP path. Defaults to dist/ha_3d_dashboard-v<version>.zip.",
    )
    return parser.parse_args()


def integration_version() -> str:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    manifest_version = manifest.get("version")
    if not isinstance(manifest_version, str) or not manifest_version.strip():
        raise RuntimeError("manifest.json must contain a non-empty string version")

    const_text = CONST_PATH.read_text(encoding="utf-8")
    match = re.search(r'^VERSION:\s*Final\s*=\s*["\']([^"\']+)["\']\s*$', const_text, re.MULTILINE)
    if match is None:
        raise RuntimeError("Could not read VERSION from const.py")

    const_version = match.group(1)
    if const_version != manifest_version:
        raise RuntimeError(
            f"Version mismatch: manifest.json={manifest_version!r}, const.py={const_version!r}"
        )
    return manifest_version


def build_frontend() -> None:
    if shutil.which("bun") is None:
        raise RuntimeError(
            "Bun is required to rebuild the HA panel. Install Bun or use "
            "--skip-frontend-build to package the committed bundle."
        )
    subprocess.run(
        ["bun", "run", "--cwd", "apps/editor", "build:ha-panel"],
        cwd=REPO_ROOT,
        check=True,
    )


def package_files() -> list[Path]:
    files: list[Path] = []
    for path in COMPONENT_DIR.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(COMPONENT_DIR)
        if any(part in EXCLUDED_PARTS for part in relative.parts):
            continue
        if path.suffix in EXCLUDED_SUFFIXES:
            continue
        files.append(path)

    files.sort(key=lambda path: path.as_posix())

    required = {
        COMPONENT_DIR / "__init__.py",
        COMPONENT_DIR / "config_flow.py",
        COMPONENT_DIR / "const.py",
        COMPONENT_DIR / "manifest.json",
        COMPONENT_DIR / "project_model.py",
        COMPONENT_DIR / "storage.py",
        COMPONENT_DIR / "strings.json",
        COMPONENT_DIR / "websocket.py",
        COMPONENT_DIR / "translations/en.json",
        COMPONENT_DIR / "translations/pl.json",
        COMPONENT_DIR / "frontend/ha3d-panel.css",
        COMPONENT_DIR / "frontend/ha3d-panel.js",
    }
    missing = sorted(path for path in required if path not in files or not path.exists())
    if missing:
        rendered = "\n".join(f"- {path.relative_to(REPO_ROOT)}" for path in missing)
        raise RuntimeError(f"Required integration files are missing:\n{rendered}")

    for frontend_file in (
        COMPONENT_DIR / "frontend/ha3d-panel.css",
        COMPONENT_DIR / "frontend/ha3d-panel.js",
    ):
        if frontend_file.stat().st_size < 1024:
            raise RuntimeError(
                f"Generated frontend bundle looks invalid: {frontend_file.relative_to(REPO_ROOT)}"
            )

    return files


def zip_info(archive_name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(archive_name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    return info


def write_archive(output: Path, files: list[Path]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            archive_name = path.relative_to(REPO_ROOT).as_posix()
            archive.writestr(zip_info(archive_name), path.read_bytes())


def verify_archive(output: Path, files: list[Path], version: str) -> None:
    expected_names = [path.relative_to(REPO_ROOT).as_posix() for path in files]
    with zipfile.ZipFile(output, "r") as archive:
        actual_names = archive.namelist()
        if actual_names != expected_names:
            raise RuntimeError("ZIP content does not match the selected integration runtime files")

        manifest_name = f"{COMPONENT_RELATIVE.as_posix()}/manifest.json"
        archived_manifest = json.loads(archive.read(manifest_name).decode("utf-8"))
        if archived_manifest.get("version") != version:
            raise RuntimeError("ZIP manifest version does not match the source integration version")

        if any("/tests/" in name or "__pycache__" in name for name in actual_names):
            raise RuntimeError("ZIP unexpectedly contains development/test files")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    args = parse_args()

    try:
        version = integration_version()
        if not args.skip_frontend_build:
            build_frontend()

        files = package_files()
        output = (
            args.output.resolve()
            if args.output is not None
            else DEFAULT_OUTPUT_DIR / f"ha_3d_dashboard-v{version}.zip"
        )
        write_archive(output, files)
        verify_archive(output, files, version)
    except (OSError, RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"HA package build failed: {error}", file=sys.stderr)
        return 1

    print(f"Built: {output.relative_to(REPO_ROOT) if output.is_relative_to(REPO_ROOT) else output}")
    print(f"Version: {version}")
    print(f"Runtime files: {len(files)}")
    print(f"SHA256: {sha256(output)}")
    print("Archive root: custom_components/ha_3d_dashboard/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
