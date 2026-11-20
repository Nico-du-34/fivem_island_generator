# Native export bridge contract

The browser editor creates a complete **conversion source package** and sends edited terrain buffers to a separate native export worker. The worker must run on Windows with the matching GTA V build assets and conversion tools. The Next.js API routes are only an authenticated proxy; they do not convert OBJ or float arrays into RAGE binaries by themselves.

## Configuration

\`\`\`dotenv
ISLAND_EXPORT_BRIDGE_URL=http://127.0.0.1:8787
ISLAND_EXPORT_BRIDGE_TOKEN=a-long-random-secret
\`\`\`

The app adds Authorization: Bearer <token> when configured. Keep the bridge on a private network, behind a firewall, and never expose it directly to the public internet.

## 1. Create a job

POST /api/export/jobs

The Next.js proxy forwards the JSON body to:

POST {ISLAND_EXPORT_BRIDGE_URL}/api/export/jobs

Example body (abbreviated):

\`\`\`json
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
\`\`\`

The edits binary is base64-encoded. Decode it, decompress gzip when compression is gzip, then read Float32 little-endian values in this exact order:

1. heights: one value per terrain sample.
2. blendWeights: four values per terrain sample, in order sand / grass / rock / dirt.
3. vegetationMask: one value per terrain sample.
4. props: six values per placement: X, Y, Z, scale, rotation radians, kind (0 tree, 1 rock).
5. grass: four values per placement: X, Y, Z, scale.

The counts object is authoritative for array boundaries. Validate the exact total byte size before allocating geometry. The legacy heightsCount, blendCount, vegetationCount, propsCount and grassCount fields are also included for compatibility.

The materials array is ordered by terrain slot. diffuseTextureDictionary and normalTextureDictionary are **texture names**, not image bytes. The web source ZIP includes procedural fallback PNG maps for Blender preview, but these must not be mislabelled as original GunWare/GTA textures. To build native YTD dictionaries, the Windows worker must resolve the named game textures from the matching legally available game archives (RPF), or use an explicitly supplied replacement texture set, then convert/package the required DDS images with mipmaps.

Successful response:

\`\`\`json
{ "id": "job_123", "state": "running" }
\`\`\`

Errors should be JSON with an error or message field and an appropriate HTTP status.

## 2. Poll status

GET /api/export/jobs/:id

The proxy forwards to the same path on the bridge. Suggested response while running:

\`\`\`json
{
  "id": "job_123",
  "state": "running",
  "stage": "Building terrain drawables",
  "done": 3,
  "total": 8
}
\`\`\`

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
7. Create YTYP archetypes and YMAP placements, then produce the required CodeWalker XML/binary sidecars and map manifest data for the target build.
8. Generate LOD/SLOD, world bounds, native water configuration and procedural-grass/material tags.
9. Create fxmanifest.lua and stream/ references that match the generated native files. Start a clean FiveM test server and verify terrain, collision, water, materials, vegetation and streaming at distance.

Sollumz supports native GTA asset authoring and binary export for several formats, but YMAP workflows may still involve XML/CodeWalker conversion depending on the specific tool version and target. Pin the exact Blender, Sollumz, CodeWalker and game build versions used by the worker; do not assume an XML export is equivalent to a validated game-ready map.

Do not return state: "done" until the ZIP contains the required native files and validation has passed. A source-only OBJ/GLB/RAW ZIP must never be represented as a native FiveM map.

## Operational requirements

- Queue jobs; process one export at a time per worker if the conversion toolchain is not concurrency-safe.
- Enforce body-size, geometry-count and time limits.
- Validate that requested coordinates fit the target game world.
- Use isolated temporary folders per job and remove them after expiry.
- Return detailed but non-sensitive error messages.
- Never trust client-provided file paths or shell commands.
