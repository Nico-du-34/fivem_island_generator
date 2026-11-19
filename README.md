# Island Forge — FiveM Island Generator

Island Forge is a browser-based procedural island studio for creating tropical terrain concepts and exporting a source package for a FiveM map workflow.

## What it does

- Generates a seeded tropical island directly in the browser.
- Interactive 3D preview with orbit/zoom controls.
- Adjustable width, length, resolution, tiles, coastline, beaches, mountain ridges and valleys.
- Suggests RP region markers: city, port, airport, tourism and natural areas.
- Exports a ZIP with tiled OBJ geometry, MTL materials, a GLB preview, a 16-bit RAW heightmap, coordinates, landmarks and a FiveM resource scaffold.

## Important FiveM export limitation

The browser export is a **source package**, not a ready-to-stream GTA V map. FiveM does not stream OBJ or GLB as native map assets. A production map still needs GTA-native assets and validation: YDR drawables, YBN collisions, YMAP placements, YTYP archetypes, LODs, materials/shaders and water/world setup. Use Blender with a compatible Sollumz workflow and validate in CodeWalker and a local FiveM test server before deployment.

The export deliberately labels this status in the ZIP and does not pretend that OBJ/GLB are native FiveM assets.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run typecheck
npm run build
npm start
```

## Deploy

The application is a standard Next.js app and can be deployed to a Node.js host or Vercel. It runs entirely in the browser after loading; no database or backend is required for the procedural generator and ZIP export.

## Export contents

```text
tw_generated_island/
├── config/
│   ├── world.json
│   └── landmarks.json
├── source_geometry/
│   ├── terrain_00.obj
│   ├── terrain_00.mtl
│   ├── island_terrain.mtl
│   ├── island.glb
│   ├── heightmap_16bit.raw
│   └── heightmap.json
├── stream/
│   └── README_CONVERSION_REQUIRED.txt
├── fxmanifest.lua
└── README_INSTALL.txt
```

Exact number of OBJ tiles depends on the island shape and tile setting.

## Coordinate conventions

- One Blender Unit is treated as one metre.
- OBJ coordinates are exported as X/Y horizontal and Z elevation.
- The export origin is added to package coordinates, not to the browser preview.
- GTA V world bounds are finite. Check the selected origin and island bounds in CodeWalker before attempting to replace Los Santos/Blaine County.

## License

MIT. See [LICENSE](LICENSE).
