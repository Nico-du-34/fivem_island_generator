# Native export bridge contract

The browser editor sends edited terrain buffers and selected GunWare material references to the Windows worker in [native-worker/](../native-worker/). The worker uses Blender, Sollumz, szio and PyMateria to produce native YDR/YBN/YMAP/YTYP/YTD resources. The Next.js API routes are an authenticated proxy only. The worker reopens each native YMAP with szio before it marks the ZIP ready. CodeWalker is optional for inspection/editing, not required as a conversion step.

## Configuration

```dotenv
ISLAND_EXPORT_BRIDGE_URL=http://127.0.0.1:8787
ISLAND_EXPORT_BRIDGE_TOKEN=a-long-random-secret
```

The app adds Authorization: Bearer <token> when configured. Keep the bridge on a private network, behind a firewall, and never expose it directly to the public internet.

## 1. Create a job

POST /api/export/jobs

The Next.js proxy forwards the JSON body to:

POST {ISLAND_EXPORT_BRIDGE_URL}/api/export/jobs

Example body (abbreviated):

```json
{
  "params": {
    "name": "gw_island",
    "seed": 248198535,
    "shape": "archipelago",
    "worldSize": 1024,
    "originX": -3450,
    "originY": -3450,
    "layers": ["sand_beach", "grass_lush", "rock_cliff", "dirt_forest"]
  },
  "gen": 9,
  "options": {
    "xml": true,
    "waves": true,
    "target": "enhanced",
    "createVisualYdr": true,
    "createCollisionYbn": true,
    "createYmapAndYtyp": true,
    "createYtd": true,
    "createLods": true
  },
  "terrain": {
    "axis": "Z_UP",
    "units": "meters",
    "resolution": 513,
    "cellSize": 2,
    "worldSize": 1024,
    "origin": { "x": -3450, "y": -3450, "z": 0 }
  },
  "materials": [
    {
      "slot": 0,
      "id": "sand_beach",
      "diffuseTextureDictionary": "cs_islx_bchsand_5",
      "normalTextureDictionary": "cs_islx_bchsand_5_n",
      "collisionMaterial": 19,
      "previewTint": "#d9c9a3"
    }
  ],
  "edits": {
    "format": "float32-le",
    "compression": "gzip",
    "n": 513,
    "cell": 2,
    "counts": {
      "heights": 263169,
      "blendWeights": 1052676,
      "vegetationMask": 263169,
      "props": 12000,
      "grass": 40000
    },
    "data": "base64-encoded-binary"
  },
  "preview": null
}
```

The edits binary is base64-encoded. Decode it, decompress gzip when compression is gzip, then read Float32 little-endian values in this exact order:

1. heights: one value per terrain sample.
2. blendWeights: four values per terrain sample, in order sand / grass / rock / dirt.
3. vegetationMask: one value per terrain sample.
4. land: one value per terrain sample (0–1 coast/land mask).
5. props: six values per placement: X, Y, Z, scale, rotation radians, kind (0 tree, 1 rock).
6. grass: four values per placement: X, Y, Z, scale.

The counts object is authoritative for array boundaries. Validate the exact total byte size before allocating geometry. The legacy heightsCount, blendCount, vegetationCount, propsCount and grassCount fields are also included for compatibility.

The materials array is ordered by terrain slot. diffuseTextureDictionary and normalTextureDictionary are **texture names**, not image bytes. The web source ZIP includes procedural fallback PNG maps for Blender preview, but these must not be mislabelled as original GunWare/GTA textures. To build native YTD dictionaries, the Windows worker must resolve the named game textures from the matching legally available game archives (RPF), or use an explicitly supplied replacement texture set, then convert/package the required DDS images with mipmaps.

Successful response:

```json
{ "id": "job_123", "state": "running" }
```

Errors should be JSON with an error or message field and an appropriate HTTP status.

## 2. Poll status

GET /api/export/jobs/:id

The proxy forwards to the same path on the bridge. Suggested response while running:

```json
{
  "id": "job_123",
  "state": "running",
  "stage": "Building terrain drawables",
  "done": 3,
  "total": 8
}
```

On success return state: "done"; on failure return state: "error" and an error or message string.

## 3. Download result

GET /api/export/jobs/:id/file

Return the completed ZIP as application/zip, preferably with a Content-Disposition: attachment; filename="gw_island_gen9.zip" header.

## Windows conversion pipeline

The source package deliberately separates the high-resolution visual terrain from the lower-resolution collision mesh. The worker should:

1. Validate seed, world bounds, target generation, dimensions, buffer counts and resource name. Reject paths or command-line fragments from the client.
2. Decode the height/material/vegetation/placement arrays and reconstruct the edited terrain. Keep the visual surface and collision mesh as separate objects.
3. Generate tile-based visual meshes, with normals and UVs, and create one or more optimized YDR drawables. Keep each drawable within tested geometry and material limits for the selected GTA build.
4. Convert the separate coarse collision source into YBN collision geometry. Assign valid GTA collision materials/flags; a plain OBJ is not a collision asset.
5. Build the material dictionary/YTD using the chosen GTA diffuse and normal textures or user-supplied replacements. Create mipmaps and confirm each shader/material points to valid texture entries.
6. Place tree, rock and grass model references using the placement arrays. Validate that every selected archetype exists in the target game build.
7. Create YTYP archetypes and YMAP placements, then export AssetMapData through the native szio/PyMateria provider. Keep optional CWXML copies only as editable source.
8. Generate LOD/SLOD, world bounds, native water configuration and procedural-grass/material tags.
9. Create fxmanifest.lua and stream/ references that match the generated native files. Start a clean FiveM test server and verify terrain, collision, water, materials, vegetation and streaming at distance.

The current szio native provider calls PyMateria MapData.export_rsc for AssetMapData. Its test suite includes a native YMAP round-trip test: it exports an AssetMapData as .ymap, reopens the file with try_load_asset, and compares the map data. The Gen9 provider falls back to the shared native MapData writer for map assets. The worker now follows this path and validates the generated YMAP with the same reader before packaging. CodeWalker remains useful for visual inspection and manual edits, but is not part of the required binary conversion pipeline.

Do not return state: "done" until the ZIP contains the required native files and validation has passed. A source-only OBJ/GLB/RAW ZIP must never be represented as a native FiveM map. Native export is only marked ready after YDR/YBN/YMAP/YTYP/YTD files exist and each YMAP has passed the szio read-back check.

## Operational requirements

- Queue jobs; process one export at a time per worker if the conversion toolchain is not concurrency-safe.
- Enforce body-size, geometry-count and time limits.
- Validate that requested coordinates fit the target game world.
- Use isolated temporary folders per job and remove them after expiry.
- Return detailed but non-sensitive error messages.
- Never trust client-provided file paths or shell commands.


## Included Windows worker

The repository contains a Node.js worker and a Blender background script:

- native-worker/server.mjs — bearer-token HTTP service, payload validation, one-at-a-time queue, job polling and ZIP download.
- native-worker/blender/export_island.py — terrain reconstruction, tile mesh creation, collision BVH, native YDR/YBN/YMAP/YTYP/YTD generation, LOD hierarchy and szio YMAP round-trip validation.
- native-worker/README.md — Windows prerequisites and installation instructions.

The worker listens on port 8787 by default. Configure the same ISLAND_EXPORT_BRIDGE_TOKEN on the Windows host and Next.js server. Never expose this service directly to the public internet.

### Native output contract

The worker generates six visual LOD tiers per terrain tile (HD, LOD, SLOD1–SLOD4), a coarse independent BVH collision, YTYP archetypes, a YTD texture dictionary and a native binary YMAP. Tree and rock placements are YMAP entities referencing game archetypes.

The worker deliberately returns state done and nativeReady true only after:
- YDR, YBN, YMAP, YTYP and YTD assets have all been found.
- The native YMAP has the RSC7 header.
- Each generated YMAP has been reopened through szio.try_load_asset and contains entities.

The szio project test_maps.py demonstrates a native AssetMapData round-trip. The native provider calls PyMateria MapData.export_rsc; the Gen9 provider delegates map data to that shared writer:
- https://github.com/Sollumz/szio/blob/main/tests/test_maps.py
- https://github.com/Sollumz/szio/blob/main/src/szio/gta5/native/provider.py
- https://github.com/Sollumz/szio/blob/main/src/szio/gta5/native/provider_gen9.py

Optional CWXML source copies are placed in sources/cwxml/ for inspection and editing. They are not used to produce the binary map. CodeWalker is optional for reviewing the result, not a mandatory conversion step.

### Still not emitted as native map data

- Native GTA water quads are not built yet; water configuration is placed in config/water.json.
- Grass points are preserved in config/grass-placements.json, but are not yet serialized as a native YMAP grass instance list.
- Tree and rock model names are existing GTA archetype references; the worker does not bundle those models or guarantee their presence on a modified game build.
- The worker creates generated fallback diffuse/normal PNGs when no image override is provided. The uploaded GunWare source bundle contained texture dictionary names, not the original source bitmaps. Use GUNWARE_TEXTURE_DIR for legally available texture replacements.

See [native-worker/README.md](../native-worker/README.md) for Windows setup.
