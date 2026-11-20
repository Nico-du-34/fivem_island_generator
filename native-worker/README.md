# Island Forge — Windows native export worker

This worker runs beside Windows Blender + Sollumz. The browser sends a validated terrain payload; the worker reconstructs GTA-coordinate meshes, creates Sollumz scene assets, and exports native RAGE resources through the PyMateria backend used by Sollumz/szio.

## What it produces

- **YDR** visual terrain drawables, split into streaming tiles.
- **YBN** coarse BVH collision per high-detail terrain tile.
- **YTYP** archetype definitions for every terrain tile and LOD.
- **YTD** texture dictionaries containing the selected material maps.
- **YMAP** native RSC7 map data with tile placements, HD/LOD/SLOD hierarchy and configured tree/rock archetype placements.
- Optional **CodeWalker XML** copies under sources/cwxml/ for inspection/editing.
- FiveM fxmanifest.lua, native-export report, texture/material and placement metadata.

The terrain is split into six streaming levels per tile: HD, LOD, SLOD1, SLOD2, SLOD3 and SLOD4. Collision is separate from render geometry. Trees and rocks reference existing GTA archetypes; the worker does not bundle those GTA props.

## YMAP: native export, no manual conversion

The worker does **not** stop at YMAP XML. Sollumz builds an AssetMapData object and exports it through szio's native PyMateria provider. That provider writes the .ymap RSC resource directly. The worker then reopens every generated native YMAP through szio's try_load_asset reader and rejects the job if the resource cannot be read back or contains no entities.

The szio project includes a native AssetMapData round-trip test and its native provider calls PyMateria MapData.export_rsc. Gen9 uses the shared native MapData writer through the provider fallback. References:
- https://github.com/Sollumz/szio/blob/main/src/szio/gta5/native/provider.py
- https://github.com/Sollumz/szio/blob/main/src/szio/gta5/native/provider_gen9.py
- https://github.com/Sollumz/szio/blob/main/tests/test_maps.py

CodeWalker is optional for inspecting/editing the generated .ymap afterwards. It is not required to convert the worker output. The package is marked nativeReady only after YDR/YBN/YMAP/YTYP/YTD exist, every YMAP starts with RSC7, and szio can reopen each YMAP.

## Requirements

- Windows 10/11 x64.
- Node.js 20+.
- Blender 4.0+ (Blender 4.5/5.x recommended).
- Sollumz 2.9.1 or newer installed in that Blender profile.
- PyMateria available to Blender through the Sollumz/szio installation for native Gen8/Gen9 resources.
- CodeWalker is optional for map inspection.
- GTA texture images are optional. The worker creates procedural fallback diffuse/normal maps if GUNWARE_TEXTURE_DIR is not set or a selected image is missing.

Sollumz and PyMateria must be configured in the same Blender installation referenced by BLENDER_PATH. Installing the addon in a different Blender version does not configure this worker.

## Configuration

Set these Windows environment variables before starting the worker:

~~~powershell
$env:BLENDER_PATH = "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
$env:SOLLUMZ_ADDON_PATH = "$env:APPDATA\Blender Foundation\Blender\4.5\scripts\addons\Sollumz"
$env:SOLLUMZ_ADDON_MODULE = "Sollumz"
$env:ISLAND_EXPORT_BRIDGE_TOKEN = "replace-with-a-long-random-secret"
$env:ISLAND_EXPORT_BRIDGE_PORT = "8787"
$env:ISLAND_WORKER_DATA = "D:\IslandForge\jobs"
# Optional: legally available diffuse/normal replacements named <material-id>_diffuse.png / <material-id>_normal.png
$env:GUNWARE_TEXTURE_DIR = "D:\IslandForge\textures"
node .\server.mjs
~~~

If Sollumz is already installed and enabled in the Blender profile, SOLLUMZ_ADDON_PATH may be omitted. The worker still checks that PyMateria's native provider is available before running an export.

On the Next.js deployment, set:

~~~dotenv
ISLAND_EXPORT_BRIDGE_URL=http://WINDOWS_WORKER_LAN_IP:8787
ISLAND_EXPORT_BRIDGE_TOKEN=the-same-long-random-secret
~~~

Keep this endpoint private. Use a LAN/VPN/firewall rule; do not expose the worker port to the public internet.

## Start and check

~~~powershell
.\start-worker.ps1
~~~

The service is intentionally single-worker: one Blender conversion runs at a time. Jobs are stored below ISLAND_WORKER_DATA; poll and download through the existing Next.js proxy endpoints.

## Texture behaviour

The supplied GunWare source bundle contained GTA texture dictionary names, not the original source bitmaps. If GUNWARE_TEXTURE_DIR contains matching diffuse/normal replacements, the worker uses them. Otherwise it creates fallback PNG maps from the chosen material tints and procedural noise, packs them into YTD and uses them for YDR shader materials. These fallback images are not original GunWare/GTA bitmaps.

## Current limitations

- Native GTA water quads are not generated yet; water configuration is included in config/water.json.
- Grass placement data is preserved in config/grass-placements.json, but not yet emitted as a native YMAP grass instance list.
- Trees and rocks reference built-in GTA archetype names; verify those archetypes exist in the target game build/custom asset pack.
- CodeWalker/FiveM runtime validation remains recommended before production deployment.
