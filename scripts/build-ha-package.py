#!/usr/bin/env python3
"""Build install ZIPs for the HA 3D Dashboard custom integration."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import struct
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
LAYOUT_MANUAL = "manual"
LAYOUT_HACS = "hacs"

BRAND_DIMENSIONS = {
    "brand/icon.png": (256, 256),
    "brand/dark_icon.png": (256, 256),
    "brand/icon@2x.png": (512, 512),
    "brand/dark_icon@2x.png": (512, 512),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build a manual-install or HACS release ZIP for the HA 3D Dashboard "
            "custom integration."
        )
    )
    parser.add_argument(
        "--skip-frontend-build",
        action="store_true",
        help="Package the committed frontend bundle without rebuilding it first.",
    )
    parser.add_argument(
        "--layout",
        choices=(LAYOUT_MANUAL, LAYOUT_HACS),
        default=LAYOUT_MANUAL,
        help=(
            "manual: archive root is custom_components/ha_3d_dashboard/ and can be "
            "extracted into /config; hacs: integration files are at the archive root "
            "because HACS extracts the release asset into the integration directory."
        ),
    )
    parser.add_argument(
        "--output",
        type=Path,
        help=(
            "Optional output ZIP path. Defaults to "
            "dist/ha_3d_dashboard-v<version>.zip for manual layout and "
            "dist/ha_3d_dashboard.zip for HACS layout."
        ),
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


def png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise RuntimeError(f"Brand asset is not a valid PNG: {path.relative_to(REPO_ROOT)}")
    return struct.unpack(">II", data[16:24])


def validate_brand_assets() -> None:
    for relative, expected in BRAND_DIMENSIONS.items():
        path = COMPONENT_DIR / relative
        if not path.exists():
            raise RuntimeError(f"Required brand asset is missing: {path.relative_to(REPO_ROOT)}")
        actual = png_dimensions(path)
        if actual != expected:
            raise RuntimeError(
                f"Brand asset {path.relative_to(REPO_ROOT)} must be "
                f"{expected[0]}x{expected[1]} px, got {actual[0]}x{actual[1]}"
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
        COMPONENT_DIR / "brand/icon.png",
        COMPONENT_DIR / "brand/dark_icon.png",
        COMPONENT_DIR / "brand/icon@2x.png",
        COMPONENT_DIR / "brand/dark_icon@2x.png",
        COMPONENT_DIR / "config_flow.py",
        COMPONENT_DIR / "const.py",
        COMPONENT_DIR / "manifest.json",
        COMPONENT_DIR / "LICENSE.txt",
        COMPONENT_DIR / "THIRD_PARTY_NOTICES.txt",
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

    validate_brand_assets()
    return files


def archive_name(path: Path, layout: str) -> str:
    if layout == LAYOUT_HACS:
        return path.relative_to(COMPONENT_DIR).as_posix()
    return path.relative_to(REPO_ROOT).as_posix()


def default_output(version: str, layout: str) -> Path:
    if layout == LAYOUT_HACS:
        return DEFAULT_OUTPUT_DIR / "ha_3d_dashboard.zip"
    return DEFAULT_OUTPUT_DIR / f"ha_3d_dashboard-v{version}.zip"


def zip_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    return info


def write_archive(output: Path, files: list[Path], layout: str) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            archive.writestr(zip_info(archive_name(path, layout)), path.read_bytes())


def verify_archive(output: Path, files: list[Path], version: str, layout: str) -> None:
    expected_names = [archive_name(path, layout) for path in files]
    with zipfile.ZipFile(output, "r") as archive:
        actual_names = archive.namelist()
        if actual_names != expected_names:
            raise RuntimeError("ZIP content does not match the selected integration runtime files")

        manifest_name = (
            "manifest.json"
            if layout == LAYOUT_HACS
            else f"{COMPONENT_RELATIVE.as_posix()}/manifest.json"
        )
        archived_manifest = json.loads(archive.read(manifest_name).decode("utf-8"))
        if archived_manifest.get("version") != version:
            raise RuntimeError("ZIP manifest version does not match the source integration version")

        if any("/tests/" in name or name.startswith("tests/") or "__pycache__" in name for name in actual_names):
            raise RuntimeError("ZIP unexpectedly contains development/test files")

        if layout == LAYOUT_HACS:
            if any(name.startswith("custom_components/") for name in actual_names):
                raise RuntimeError(
                    "HACS ZIP must contain integration files at the archive root"
                )
            if "brand/icon.png" not in actual_names:
                raise RuntimeError("HACS ZIP is missing brand/icon.png")
            for notice in ("LICENSE.txt", "THIRD_PARTY_NOTICES.txt"):
                if notice not in actual_names:
                    raise RuntimeError(f"HACS ZIP is missing {notice}")


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
            else default_output(version, args.layout)
        )
        write_archive(output, files, args.layout)
        verify_archive(output, files, version, args.layout)
    except (OSError, RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"HA package build failed: {error}", file=sys.stderr)
        return 1

    print(f"Built: {output.relative_to(REPO_ROOT) if output.is_relative_to(REPO_ROOT) else output}")
    print(f"Version: {version}")
    print(f"Layout: {args.layout}")
    print(f"Runtime files: {len(files)}")
    print(f"SHA256: {sha256(output)}")
    if args.layout == LAYOUT_HACS:
        print("Archive root: integration files (HACS release layout)")
    else:
        print("Archive root: custom_components/ha_3d_dashboard/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
