# Native export bridge contract

The browser editor deliberately separates source geometry export from native GTA V asset production. The native export routes in Next.js proxy to a trusted bridge service. The bridge should run on a Windows host with the compatible GTA V / CodeWalker conversion toolchain and any project-specific scripts.

## Configuration

\`\`\`dotenv
ISLAND_EXPORT_BRIDGE_URL=http://127.0.0.1:8787
ISLAND_EXPORT_BRIDGE_TOKEN=a-long-random-secret
\`\`\`

The app adds Authorization: Bearer <token> when a token is configured. Keep the bridge on a private network; do not make it directly internet-accessible.

## 1. Create a job

POST /api/export/jobs

The Next.js proxy forwards the JSON body to:

POST {ISLAND_EXPORT_BRIDGE_URL}/api/export/jobs

Example body (abbreviated):

\`\`\`json
{
  "params": {
    "name": "gw_island",
    "seed": 1337,
    "shape": "round",
    "worldSize": 1024,
    "originX": -3450,
    "originY": -3450
  },
  "gen": 8,
  "edits": {
    "format": "float32-le",
    "compression": "gzip",
    "n": 513,
    "cell": 2,
    "heightsCount": 263169,
    "blendCount": 1052676,
    "vegetationCount": 263169,
    "data": "base64-encoded-binary"
  },
  "options": {
    "xml": false,
    "waves": true
  },
  "preview": null
}
\`\`\`

The edits.data bytes contain concatenated Float32 little-endian arrays in this order: heights, four material weights per sample, vegetation mask. The bridge must verify counts, dimensions, payload size and parameters before accepting the job.

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

Return the completed ZIP as application/zip, preferably with a Content-Disposition: attachment; filename="gw_island_gen8.zip" header.

## Native asset responsibilities

The bridge, not the browser, must generate and validate the native RAGE files required by the target workflow. At minimum this generally includes:
- YDR terrain drawables and any required material/shader references.
- YBN collision geometry and suitable collision materials.
- YMAP placements and YTYP archetypes.
- YTD textures where custom textures are used.
- LOD/SLOD levels, water setup and any world-boundary/placement data.
- A complete FiveM resource with fxmanifest and optional client initialization.

Do not return state: "done" until the ZIP has been created and its contents have passed validation. A source-only OBJ/GLB ZIP must never be represented as a native FiveM map.

## Operational requirements

- Queue jobs; process one export at a time per worker if the conversion toolchain is not concurrency-safe.
- Enforce body-size, geometry-count and time limits.
- Validate that requested coordinates fit the target game world.
- Use isolated temporary folders per job and remove them after expiry.
- Return detailed but non-sensitive error messages.
- Never trust client-provided file paths or command-line fragments.
