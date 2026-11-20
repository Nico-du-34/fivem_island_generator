#!/usr/bin/env python3
"""Create a deterministic minimal Island Forge native-engine smoke job."""
from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path


def create_job(output_dir: Path, generation: int) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    n = 33
    world_size = 64.0
    cell = world_size / (n - 1)
    half = world_size / 2.0
    heights: list[float] = []
    weights: list[float] = []
    vegetation: list[float] = []
    land: list[float] = []

    for y in range(n):
        ny = (y / (n - 1)) * 2.0 - 1.0
        for x in range(n):
            nx = (x / (n - 1)) * 2.0 - 1.0
            radius = math.sqrt(nx * nx + ny * ny)
            mask = 1.0 if radius <= 0.94 else 0.0
            h = max(0.0, (0.94 - radius) * 18.0) + 0.35 * math.sin(nx * 4.0) * math.cos(ny * 3.0)
            heights.append(h if mask else -2.0)
            land.append(mask)
            vegetation.append(1.0 if mask and radius < 0.78 else 0.0)
            weights.extend((0.18, 0.62, 0.08, 0.12))

    props = [
        -8.0, -5.0, 4.0, 1.0, 0.2, 0.0,
        9.0, 7.0, 3.0, 0.8, 1.1, 1.0,
    ]
    grass = [
        -4.0, 2.0, 4.0, 1.0,
        3.0, -3.0, 4.5, 0.85,
    ]
    binary_values = heights + weights + vegetation + land + props + grass
    binary_path = output_dir / "terrain.f32"
    binary_path.write_bytes(struct.pack("<" + "f" * len(binary_values), *binary_values))

    counts = {
        "heights": len(heights),
        "blendWeights": len(weights),
        "vegetationMask": len(vegetation),
        "land": len(land),
        "props": len(props),
        "grass": len(grass),
    }
    job = {
        "id": f"ragekit-smoke-gen{generation}",
        "generation": generation,
        "params": {
            "name": f"island_smoke_gen{generation}",
            "treeTypes": ["prop_palm_med_01b"],
            "rockTypes": ["prop_rock_1_d"],
            "grassTypes": ["proc_grasses01"],
        },
        "terrain": {
            "resolution": n,
            "cellSize": cell,
            "worldSize": world_size,
            "origin": {"x": -12000.0, "y": 0.0, "z": 0.0},
        },
        "counts": counts,
        "binaryFile": "terrain.f32",
        "placedAssets": [
            {
                "name": "prop_roadcone02a",
                "x": -11996.0,
                "y": 6.0,
                "z": 1.0,
                "heading": 0.0,
                "scale": 1.0,
            }
        ],
    }
    (output_dir / "job.json").write_text(json.dumps(job, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--generation", required=True, type=int, choices=(8, 9))
    args = parser.parse_args()
    create_job(args.output.resolve(), args.generation)


if __name__ == "__main__":
    main()
