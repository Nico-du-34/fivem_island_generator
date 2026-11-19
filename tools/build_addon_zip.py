#!/usr/bin/env python3
"""Build a Blender-installable ZIP containing only the add-on package."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "island_generator"
OUTPUT = ROOT / "dist" / "fivem_island_generator_addon.zip"


def main() -> None:
    if not (PACKAGE / "__init__.py").is_file():
        raise SystemExit("Add-on package is missing island_generator/__init__.py")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for source in sorted(PACKAGE.rglob("*.py")):
            archive.write(source, source.relative_to(ROOT))
    print(f"Built Blender add-on: {OUTPUT}")


if __name__ == "__main__":
    main()
