#!/usr/bin/env python3
"""Offline release preflight for HA 3D Dashboard."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
COMPONENT_DIR = REPO_ROOT / "custom_components/ha_3d_dashboard"
MANIFEST_PATH = COMPONENT_DIR / "manifest.json"
CONST_PATH = COMPONENT_DIR / "const.py"
HACS_PATH = REPO_ROOT / "hacs.json"
BETA_LOCK_PATH = REPO_ROOT / "BETA_RELEASE_LOCK"
DIST_DIR = REPO_ROOT / "dist"

REQUIRED_MANIFEST_KEYS = {
    "domain",
    "documentation",
    "issue_tracker",
    "codeowners",
    "name",
    "version",
}
SEMVER_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate metadata and build both HA 3D release package layouts."
    )
    parser.add_argument(
        "--version",
        help="Expected version. Defaults to the version already declared in source.",
    )
    parser.add_argument(
        "--skip-frontend-build",
        action="store_true",
        help="Use the committed frontend bundle instead of rebuilding it.",
    )
    return parser.parse_args()


def fail(message: str) -> None:
    raise RuntimeError(message)


def source_version() -> str:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    missing = sorted(REQUIRED_MANIFEST_KEYS.difference(manifest))
    if missing:
        fail(f"manifest.json is missing required HACS keys: {', '.join(missing)}")

    version = manifest.get("version")
    if not isinstance(version, str) or not SEMVER_RE.fullmatch(version):
        fail(f"manifest.json version is invalid: {version!r}")

    codeowners = manifest.get("codeowners")
    if not isinstance(codeowners, list) or not codeowners or any(
        not isinstance(value, str) or not value.strip() for value in codeowners
    ):
        fail("manifest.json codeowners must contain at least one non-empty string")

    for key in ("documentation", "issue_tracker"):
        value = manifest.get(key)
        if not isinstance(value, str) or not value.startswith("https://"):
            fail(f"manifest.json {key} must be an https URL")

    const_text = CONST_PATH.read_text(encoding="utf-8")
    match = re.search(
        r'^VERSION:\s*Final\s*=\s*["\']([^"\']+)["\']\s*$',
        const_text,
        re.MULTILINE,
    )
    if match is None:
        fail("Could not read VERSION from const.py")
    if match.group(1) != version:
        fail(
            f"Version mismatch: manifest.json={version!r}, const.py={match.group(1)!r}"
        )
    return version


def validate_beta_policy(version: str) -> None:
    if BETA_LOCK_PATH.exists() and "-beta." not in version:
        fail(
            "BETA_RELEASE_LOCK is present; HA releases must use a -beta.N "
            "prerelease version"
        )


def validate_repository_layout() -> None:
    custom_components = REPO_ROOT / "custom_components"
    integrations = sorted(
        path.name
        for path in custom_components.iterdir()
        if path.is_dir() and not path.name.startswith(".")
    )
    if integrations != ["ha_3d_dashboard"]:
        fail(
            "HACS integration repository must expose exactly one custom_components "
            f"directory; found {integrations!r}"
        )


def validate_hacs_manifest() -> None:
    hacs = json.loads(HACS_PATH.read_text(encoding="utf-8"))
    if hacs.get("name") != "HA 3D Dashboard":
        fail("hacs.json name must be HA 3D Dashboard")
    if hacs.get("zip_release") is not True:
        fail("hacs.json must enable zip_release")
    if hacs.get("filename") != "ha_3d_dashboard.zip":
        fail("hacs.json filename must be ha_3d_dashboard.zip")
    if hacs.get("hide_default_branch") is not True:
        fail("hacs.json must hide the default branch while releases are required")

    minimum_ha = hacs.get("homeassistant")
    if not isinstance(minimum_ha, str) or not SEMVER_RE.fullmatch(minimum_ha):
        fail("hacs.json homeassistant must be a semantic version")


def run_builder(version: str, skip_frontend_build: bool) -> tuple[Path, Path]:
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    hacs_zip = DIST_DIR / "ha_3d_dashboard.zip"
    manual_zip = DIST_DIR / f"ha_3d_dashboard-v{version}.zip"

    hacs_command = [
        sys.executable,
        str(REPO_ROOT / "scripts/build-ha-package.py"),
        "--layout",
        "hacs",
        "--output",
        str(hacs_zip),
    ]
    if skip_frontend_build:
        hacs_command.append("--skip-frontend-build")

    subprocess.run(hacs_command, cwd=REPO_ROOT, check=True)
    subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts/build-ha-package.py"),
            "--skip-frontend-build",
            "--layout",
            "manual",
            "--output",
            str(manual_zip),
        ],
        cwd=REPO_ROOT,
        check=True,
    )
    return hacs_zip, manual_zip


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def write_checksums(paths: tuple[Path, ...]) -> Path:
    output = DIST_DIR / "SHA256SUMS"
    lines = [f"{digest(path)}  {path.name}" for path in paths]
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return output


def main() -> int:
    args = parse_args()
    try:
        actual = source_version()
        requested = args.version.strip() if args.version is not None else actual
        if not SEMVER_RE.fullmatch(requested):
            fail(f"Requested version is invalid: {requested!r}")

        if actual != requested:
            fail(
                f"Requested version {requested!r} does not match source version {actual!r}"
            )

        validate_beta_policy(actual)
        validate_repository_layout()
        validate_hacs_manifest()
        hacs_zip, manual_zip = run_builder(actual, args.skip_frontend_build)
        checksums = write_checksums((hacs_zip, manual_zip))
    except (
        OSError,
        RuntimeError,
        subprocess.CalledProcessError,
        json.JSONDecodeError,
    ) as error:
        print(f"HA release preflight failed: {error}", file=sys.stderr)
        return 1

    print("HA release preflight passed")
    print(f"Version: {actual}")
    print(f"HACS package: {hacs_zip.relative_to(REPO_ROOT)}")
    print(f"Manual package: {manual_zip.relative_to(REPO_ROOT)}")
    print(f"Checksums: {checksums.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
