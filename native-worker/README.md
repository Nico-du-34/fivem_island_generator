# Island Forge — Windows native export worker

This worker runs beside a Windows installation of Blender + Sollumz. The browser sends a validated terrain payload to it; the worker reconstructs GTA-coordinate meshes, creates Sollumz objects and exports the supported RAGE binary assets.

## What it produces

- **YDR** visual terrain drawables, split into streaming tiles.
- **YBN** coarse BVH collision per high-detail terrain tile.
- **YTYP** archetype definitions for terrain and each streamed LOD.
- **YTD** texture dictionary containing the selected material maps.
- **YMAP XML** with terrain tile placements, HD/LOD/SLOD hierarchy and built-in GTA tree/rock archetype placements.
- FiveM fxmanifest.lua, native-export report, texture/material and placement metadata.

The terrain is split into six streaming levels per tile: HD, LOD, SLOD1, SLOD2, SLOD3 and SLOD4. Collision is kept separate from render geometry. Trees and rocks are referenced as existing GTA archetypes; this worker does not bundle those GTA props.

## Important YMAP limitation

The current Sollumz native binary provider exports YDR/YBN/YTYP/YTD, but YMAP remains a CodeWalker XML workflow. The worker therefore does **not** label its ZIP as ready-to-start until the .ymap.xml has been opened and saved as binary .ymap in CodeWalker.

The generated package contains finalize-ymap.ps1. After saving the YMAP as binary in CodeWalker, run:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\finalize-ymap.ps1 -YmapPath "C:\path\to\gw_island_world.ymap"
~~~

The script validates the RSC7 header, copies the binary into stream/, and changes the package report to nativeReady: true.

This is deliberate: a .ymap.xml is not a streamable binary .ymap.

## Requirements

- Windows 10/11 x64.
- Node.js 20+.
- Blender 4.0+ (Blender 4.5/5.x recommended).
- Sollumz 2.9.1 or newer installed in that Blender profile.
- PyMateria installed and available to Blender for native Gen8/Gen9 YDR/YBN/YTYP/YTD export.
- CodeWalker installed for finalizing the generated YMAP XML.
- GTA texture images are optional. The worker creates procedural fallback diffuse/normal maps if GUNWARE_TEXTURE_DIR is not set or a selected image is missing.

Sollumz/PyMateria must be configured and working in the same Blender installation referenced by BLENDER_PATH. Installing the addon in a different Blender version does not configure this worker.

## Configuration

Set these Windows environment variables before starting the worker:

~~~powershell
$env:BLENDER_PATH = "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
$env:SOLLUMZ_ADDON_PATH = "$env:APPDATA\Blender Foundation\Blender\4.5\scripts\addons\Sollumz"
$env:SOLLUMZ_ADDON_MODULE = "Sollumz"
$env:ISLAND_EXPORT_BRIDGE_TOKEN = "replace-with-a-long-random-secret"
$env:ISLAND_EXPORT_BRIDGE_PORT = "8787"
$env:ISLAND_WORKER_DATA = "D:\IslandForge\jobs"
# Optional: legally extracted or replacement images named <material-id>_diffuse.png / <material-id>_normal.png
$env:GUNWARE_TEXTURE_DIR = "D:\IslandForge\textures"
node .\server.mjs
~~~

If Sollumz is already installed and enabled in the Blender profile, SOLLUMZ_ADDON_PATH may be omitted. The worker still checks that PyMateria's native provider is available before accepting an export.

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

The source bundle supplied with Island Forge includes GTA texture dictionary names, not the original source bitmaps. If GUNWARE_TEXTURE_DIR contains the matching diffuse/normal images, the worker will use them. Otherwise it creates fallback PNGs from the chosen material tints and procedural noise, packs them into a YTD and uses them in the YDR shader materials. These fallback images are not original GunWare/GTA textures.

## Limits still reported in the package

- YMAP binary conversion is a separate CodeWalker step.
- Native GTA water quads are not generated; water settings are exported as metadata.
- Procedural grass is retained as placement/source metadata but not yet packed as a native YMAP grass batch.
- GTA prop names are referenced as built-in archetypes; the worker cannot guarantee a model exists in a different game build or custom server pack.
- Actual testing in CodeWalker and on a FiveM test server remains required.
