# FiveM Island Generator

Blender add-on for procedural tropical island blockouts and FiveM-oriented export packaging.

## Current scope

- Procedural island terrain generation in Blender.
- Configurable size, resolution, coast, hills, mountain ridge, noise, and seed.
- Material assignment for sand, grass, rock, and shallow water reference.
- Sectorized terrain meshes for manageable editing.
- Optional road-guide curves and vegetation scatter points.
- Exports a ZIP package containing Blender-generated OBJ terrain tiles, optional GLB preview, configuration JSON, coordinate manifest, and a FiveM resource skeleton.

## Important export limitation

Blender alone does **not** produce native GTA V map assets. The package exporter creates interchange geometry (OBJ/GLB) and a FiveM resource scaffold. To obtain production-ready GTA V assets, import the geometry into Blender with a compatible Sollumz build, create/verify YDR/YBN/YMAP/YTYP assets, and validate them in CodeWalker/FiveM. The exporter never labels OBJ/GLB files as GTA-native assets.

## Install

1. Download this repository as ZIP.
2. In Blender, open **Edit > Preferences > Add-ons > Install from Disk**.
3. Select `island_generator/__init__.py` (or package the folder as ZIP) and enable **FiveM Island Generator**.
4. Open the 3D Viewport sidebar with `N`, then select **Island Gen**.
5. Configure parameters and click **Generate Island**.
6. Click **Export FiveM Package** to create the ZIP.

Tested target: Blender 4.2+ (Python API compatibility may vary by Blender version).

## Coordinate system

The generator works in Blender units, treating 1 BU as 1 meter by default. GTA V/FiveM placement uses world coordinates, so set the export origin explicitly and validate scale/location in-game. GTA V has finite world bounds; the user must verify that the chosen island bounds fit the intended GTA coordinate space.

## Export contents

```
tropical_island_fivem.zip
├── README_EXPORT.txt
├── config/island_config.json
├── manifest/island_manifest.json
├── geometry/terrain/*.obj
├── geometry/preview/island_preview.glb
└── fivem_resource/
    ├── fxmanifest.lua
    ├── README.md
    └── stream/README_ASSET_PIPELINE.txt
```

## License

MIT. See LICENSE.
