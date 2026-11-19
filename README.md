# FiveM Island Generator

Blender add-on for generating procedural tropical island terrain and preparing a FiveM-oriented export package.

## Features

- Procedural island silhouette with an irregular coastline and southern bay.
- Configurable island width/length, seed, terrain resolution and tile count.
- Adjustable relief, mountain ridge, valley strength, coast shape, sand band and rock threshold.
- Separate terrain mesh objects per tile.
- Preview-only ocean plane.
- Road guide curve and vegetation scatter points.
- 16-bit grayscale PNG heightmap export.
- OBJ + MTL terrain interchange export with configurable FiveM world origin.
- Optional GLB preview export.
- ZIP package containing configuration, manifest, guides and a FiveM resource scaffold.

## Important: what the Export button does

The Export button creates a complete **interchange package** for the next stage of a FiveM map workflow. It exports Blender geometry as OBJ/MTL, a heightmap, optional GLB preview, placement guides and a FiveM resource scaffold.

It does **not** directly generate native GTA V map assets. OBJ/GLB files are not FiveM-streamable map assets. A production map still needs conversion and authoring in a compatible Sollumz workflow, including the required YDR/YBN/YMAP/YTYP/YTD data, collisions, LODs and water setup, followed by CodeWalker and in-game validation. The generated resource scaffold is intentionally not advertised as ready to start.

## Install

1. Download or clone this repository.
2. Build the installable add-on ZIP:
   ```bash
   python tools/build_addon_zip.py
   ```
3. In Blender, open Preferences and use **Install from Disk** (in the Extensions/Add-ons area).
4. Select `dist/fivem_island_generator_addon.zip`, then enable **FiveM Island Generator**.
5. Open the 3D Viewport, press `N`, and open the **Island Gen** tab.

No external Python package is required by the generator. The optional GLB preview uses Blender's glTF exporter when available.

## First use

1. Set the island name and random seed.
2. Set width/length, resolution and tiles per axis.
3. Adjust coast, relief, mountain and valley controls.
4. Click **Generate / Regenerate Island**.
5. Inspect the generated meshes and guide objects in the collection `TW_Island_Generator`.
6. Set the FiveM export origin to the chosen in-game world coordinate.
7. Choose an output ZIP path and click **Export FiveM Package**.

## Export package

```text
tropical_island_fivem/
├── README_EXPORT.txt
├── config/island_config.json
├── manifest/island_manifest.json
├── heightmap/island_heightmap_16bit.png
├── geometry/
│   ├── terrain/*.obj
│   ├── terrain/*.mtl
│   └── preview/island_preview.glb
├── guides/
│   ├── road_guide.json
│   └── vegetation_scatter.json
└── fivem_resource/
    ├── fxmanifest.lua
    ├── README.md
    └── stream/README_ASSET_PIPELINE.txt
```

## Coordinate and scale notes

- The generator treats one Blender Unit as one metre.
- The export origin is added to OBJ and guide coordinates; it does not move objects in the Blender scene.
- GTA V has finite world bounds. Check the chosen island bounds against the actual game coordinate space before production.
- Tile size and vertex density are design controls, not a guarantee of streaming performance. Profile the exported assets in FiveM.

## Recommended production pipeline

1. Generate and inspect the terrain in Blender.
2. Export the interchange package.
3. Use the OBJ/heightmap as source data in Blender and create GTA-ready assets with Sollumz.
4. Create simplified collision geometry and appropriate LODs.
5. Author/verify placements and archetype definitions.
6. Configure native GTA water separately; the blue ocean plane is preview-only.
7. Validate assets and placement in CodeWalker.
8. Test streaming, collision, water, minimap, GPS and world limits in a clean FiveM development server.

## Development

Run a syntax check:

```bash
python -m compileall -q island_generator tools
```

The GitHub Actions workflow runs this check on pushes and pull requests.

## License

MIT. See [LICENSE](LICENSE).
