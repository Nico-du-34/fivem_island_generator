# Island Forge — FiveM Island Creator

Island Forge is a browser-based procedural terrain editor inspired by the workflow of professional GTA V / FiveM map tools. The editor runs in the browser and uses Three.js for the 3D viewport.

## Editor features

### Generate
- Nine island/map shapes: round, long, crescent, twin, archipelago, atoll, volcano, continent and scattered islands.
- World sizes from 512 m to 16,384 m.
- Seeded generation and one-click preset variants.
- Adjustable land coverage, coast noise, domain warp, elevation, mountains, hills, terraces, seabed depth and beach profile.
- Hydraulic and thermal erosion passes.
- Resolution/cell-size choices constrained by world size.

### Sculpt and test
- Raise, lower, smooth, flatten, material paint, paint erase, remove vegetation and add vegetation brushes.
- Brush radius and strength controls.
- Undo/redo history for brush strokes.
- Orbit and top-down camera views.
- Walk mode with a human-scale character, movement, sprint, slow walk, jump and first-/third-person camera.
- Time-of-day lighting, animated water preview, vegetation and rock batches.
- Display modes, layer visibility, grid and chunk overlays.

### Surface and GTA placement
- Four terrain material channels: beach sand, lush grass, rock/cliff and forest dirt.
- Grass, tree and rock density/type controls.
- GTA prop and procedural-grass tag settings.
- GTA coordinate placement map with presets, world-bound checks and approximate overlap warnings.
- gen8 Legacy / gen9 Enhanced export target selection.

## Export modes

### Source package (available without a backend)

The browser ZIP contains:
- Tiled OBJ terrain geometry and MTL materials.
- GLB preview.
- 16-bit RAW heightmap and metadata.
- World parameters, coordinate bounds, landmarks, road guide points and vegetation placement points.
- A FiveM resource scaffold (fxmanifest.lua) with a conversion checklist.

**This is a source/interchange package, not a finished FiveM map.** OBJ, GLB and RAW are not GTA V streamable map formats.

### Native FiveM package (requires an export bridge)

The editor has a server-side proxy for a separate Windows export service. Set the following environment variables:

\`\`\`dotenv
ISLAND_EXPORT_BRIDGE_URL=http://127.0.0.1:8787
ISLAND_EXPORT_BRIDGE_TOKEN=replace-with-a-long-random-token
\`\`\`

The bridge must implement the routes and payload contract in [docs/export-bridge.md](docs/export-bridge.md). It is responsible for using the chosen GTA toolchain to create and validate native RAGE assets such as YDR, YBN, YMAP, YTYP and YTD, plus LOD/SLOD, collisions, shaders and water configuration. The web app does not claim that source geometry is native GTA content.

When no bridge is configured, the native export button returns a clear bridge_missing error and the browser source export remains available.

## Run locally

Requirements: Node.js 20+.

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000.

## Type check and production build

\`\`\`bash
npm run typecheck
npm run build
npm start
\`\`\`

## Deploy

Deploy as a standard Next.js Node.js application. The procedural generator, 3D viewport and source ZIP export run in the browser. Native export requires the separate bridge service on a host with the required GTA conversion tools. Do not expose the bridge directly to the public internet; put it behind a firewall and configure a token.

## Coordinate notes

- One world unit is treated as one metre.
- Export placement uses X/Y world origin and terrain elevation on Z.
- GTA V has finite world bounds. The placement map is indicative; verify actual collisions/overlaps in CodeWalker before deploying a world replacement.
- Large worlds increase CPU, memory, triangle counts and export time. Start with a low-resolution test before selecting 8–16 km worlds.

## License

MIT. See [LICENSE](LICENSE).
