import JSZip from "jszip";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { IslandSettings, TerrainData } from "./terrain";

const GUNWARE_MATERIALS = {
  sand_beach: { label: "Sable de plage (Cayo)", diffuse: "cs_islx_bchsand_5", normal: "cs_islx_bchsand_5_n", collisionId: 19, collisionName: "SAND_COMPACT", tint: [0.85, 0.79, 0.65] },
  grass_lush: { label: "Herbe tropicale", diffuse: "cs_rsn_sl_wetlandsgrass2", normal: "cs_rsn_sl_wetlandsgrass2_n", collisionId: 47, collisionName: "GRASS", tint: [0.36, 0.45, 0.20] },
  rock_cliff: { label: "Falaise côtière", diffuse: "cs_islx_cstcliff_0001b", normal: "cs_rsn_sl_cstcliff_0001_n", collisionId: 9, collisionName: "ROCK", tint: [0.49, 0.46, 0.41] },
  dirt_forest: { label: "Terre caillouteuse", diffuse: "cs_rsn_dor_mntearthstonesveg02", normal: "cs_rsn_dor_mntearthstonesveg02_n", collisionId: 43, collisionName: "SOIL", tint: [0.43, 0.36, 0.25] },
} as const;

function layerInfo(settings: IslandSettings, index: number) {
  const id = settings.layers[index] ?? "grass_lush";
  return { id, ...(GUNWARE_MATERIALS[id as keyof typeof GUNWARE_MATERIALS] ?? GUNWARE_MATERIALS.grass_lush) };
}

function writeObjTile(data: TerrainData, tileIndex: number, settings: IslandSettings) {
  const vertexMap = new Map<number, number>();
  const vertices: number[] = [];
  const faces: { indices: number[]; material: number }[] = [];
  for (let face = 0; face < data.faceTiles.length; face++) {
    if (data.faceTiles[face] !== tileIndex) continue;
    const global = [data.indices[face * 3], data.indices[face * 3 + 1], data.indices[face * 3 + 2]];
    const local = global.map((index) => {
      let mapped = vertexMap.get(index);
      if (mapped === undefined) {
        mapped = vertexMap.size + 1;
        vertexMap.set(index, mapped);
        vertices.push(index);
      }
      return mapped;
    });
    faces.push({ indices: local, material: data.faceMaterials[face] ?? 1 });
  }
  const lines = [
    `# ${settings.name} / tile ${tileIndex}`,
    "# Local terrain coordinates (metres). Position YMAP entities at config/world.json origin.",
    "# OBJ interchange geometry only; not a native GTA V drawable.",
    "mtllib island_terrain.mtl",
  ];
  const texScale = Math.max(0.25, settings.texScale);
  for (const index of vertices) {
    const offset = index * 3;
    lines.push(`v ${data.positions[offset].toFixed(4)} ${data.positions[offset + 1].toFixed(4)} ${data.positions[offset + 2].toFixed(4)}`);
  }
  for (const index of vertices) {
    const offset = index * 3;
    lines.push(`vt ${(data.positions[offset] / texScale).toFixed(5)} ${(data.positions[offset + 1] / texScale).toFixed(5)}`);
  }
  for (const index of vertices) {
    const gx = index % data.n, gy = Math.floor(index / data.n);
    const left = data.heights[gy * data.n + Math.max(0, gx - 1)];
    const right = data.heights[gy * data.n + Math.min(data.n - 1, gx + 1)];
    const down = data.heights[Math.max(0, gy - 1) * data.n + gx];
    const up = data.heights[Math.min(data.n - 1, gy + 1) * data.n + gx];
    const nx = (left - right) / (2 * data.cell), ny = (down - up) / (2 * data.cell);
    const length = Math.hypot(nx, ny, 1) || 1;
    lines.push(`vn ${(nx / length).toFixed(6)} ${(ny / length).toFixed(6)} ${(1 / length).toFixed(6)}`);
  }
  let current = -1;
  for (const face of faces) {
    if (face.material !== current) {
      current = face.material;
      lines.push(`usemtl ${layerInfo(settings, current).id}`);
    }
    lines.push(`f ${face.indices.map((index) => `${index}/${index}/${index}`).join(" ")}`);
  }
  return { text: lines.join("\n"), vertices: vertices.length, triangles: faces.length };
}

function makeMtl(settings: IslandSettings) {
  return settings.layers.map((layer, index) => {
    const info = layerInfo(settings, index), [r, g, b] = info.tint;
    return [`newmtl ${layer}`, `# GunWare diffuse: ${info.diffuse}.png`, `# GunWare normal: ${info.normal}.png`,
      "Ka 0.25 0.25 0.25", `Kd ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`,
      "Ks 0.04 0.04 0.04", "Ns 12.0", ""].join("\n");
  }).join("\n");
}

function makeFloat32Raw(values: Float32Array) {
  const bytes = new Uint8Array(values.length * 4), view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) view.setFloat32(i * 4, values[i], true);
  return bytes;
}

function makeMaskRaw(values: Float32Array) {
  const bytes = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) bytes[i] = Math.round(Math.max(0, Math.min(1, values[i])) * 255);
  return bytes;
}

function makeBlendWeightsRaw(data: TerrainData) {
  const bytes = new Uint8Array(data.blendWeights.length);
  for (let i = 0; i < data.heights.length; i++) {
    const offset = i * 4;
    const values = [0, 1, 2, 3].map((channel) => Math.max(0, data.blendWeights[offset + channel]));
    const total = Math.max(0.0001, values.reduce((sum, value) => sum + value, 0));
    for (let channel = 0; channel < 4; channel++) bytes[offset + channel] = Math.round(Math.min(1, values[channel] / total) * 255);
  }
  return bytes;
}

function makeCollisionMaterials(data: TerrainData, settings: IslandSettings) {
  const bytes = new Uint8Array(data.faceMaterials.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] = layerInfo(settings, data.faceMaterials[i] ?? 1).collisionId;
  return bytes;
}

function makeMaterialManifest(settings: IslandSettings) {
  return {
    format: "islandforge.gta-terrain-materials.v1",
    source: "GunWare Island Creator terrain-bank identifiers supplied with the project references",
    note: "Texture pixels are not embedded in the source ZIP. Resolve these identifiers against licensed local texture assets during native conversion.",
    channels: settings.layers.map((id, index) => {
      const info = layerInfo(settings, index);
      return { channel: index, id, label: info.label, diffuseTexture: info.diffuse, normalTexture: info.normal,
        gtaCollisionMaterial: { id: info.collisionId, name: info.collisionName }, tint: info.tint };
    }),
  };
}
function makeRawHeightmap(data: TerrainData) {
  const bytes = new Uint8Array(data.heights.length * 2);
  const view = new DataView(bytes.buffer);
  const min = data.minHeight;
  const range = Math.max(1, data.maxHeight - min);
  for (let i = 0; i < data.heights.length; i++) {
    const normalized = Math.max(0, Math.min(1, (data.heights[i] - min) / range));
    view.setUint16(i * 2, Math.round(normalized * 65535), true);
  }
  return bytes;
}

async function exportGlb(data: TerrainData, settings: IslandSettings) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions.slice(), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(data.colors.slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices.slice(), 1));
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, side: THREE.DoubleSide }),
  );
  terrain.position.set(settings.originX, settings.originY, 0);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(settings.worldSize * 1.7, settings.worldSize * 1.7),
    new THREE.MeshStandardMaterial({ color: "#0b5a70", roughness: 0.35, metalness: 0.08 }),
  );
  ocean.position.set(settings.originX, settings.originY, -0.1);
  const scene = new THREE.Scene();
  scene.add(terrain, ocean);
  const exporter = new GLTFExporter();
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(scene, (result) => {
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new Error("L'export GLB n'a pas produit de fichier binaire."));
    }, reject, { binary: true, onlyVisible: true });
  });
}

function makePlacementGuides(settings: IslandSettings, data: TerrainData) {
  const anchors = [
    [-0.40, -0.12], [-0.30, 0.02], [-0.12, 0.14], [0.08, 0.22],
    [0.29, 0.15], [0.39, -0.03], [0.27, -0.25], [0.02, -0.34],
    [-0.20, -0.28],
  ];
  const roads = anchors.map(([nx, ny], index) => {
    const ix = Math.max(0, Math.min(data.n - 1, Math.round((nx + 1) * 0.5 * (data.n - 1))));
    const iy = Math.max(0, Math.min(data.n - 1, Math.round((ny + 1) * 0.5 * (data.n - 1))));
    const sample = data.heights[iy * data.n + ix];
    return {
      index,
      x: nx * settings.worldSize * 0.5 + settings.originX,
      y: ny * settings.worldSize * 0.5 + settings.originY,
      z: sample + 2,
    };
  });

  const props = [];
  for (let i = 0, instance = 0; i < data.props.length; i += 6, instance++) {
    const isRock = data.props[i + 5] > 0.5;
    const types = isRock ? settings.rockTypes : settings.treeTypes;
    const asset = types.length ? types[instance % types.length] : (isRock ? "prop_rock_1_d" : "prop_palm_med_01b");
    props.push({
      x: data.props[i] + settings.originX,
      y: data.props[i + 1] + settings.originY,
      z: data.props[i + 2],
      scale: data.props[i + 3],
      rotation: data.props[i + 4],
      kind: isRock ? "rock" : "tree",
      model: asset,
    });
  }

  const grass = [];
  for (let i = 0, instance = 0; i < data.grass.length; i += 4, instance++) {
    const types = settings.grassTypes;
    grass.push({
      x: data.grass[i] + settings.originX,
      y: data.grass[i + 1] + settings.originY,
      z: data.grass[i + 2],
      scale: data.grass[i + 3],
      model: types.length ? types[instance % types.length] : "proc_grasses01",
    });
  }
  return { roads, props, grass };
}

export async function exportIslandPackage(settings: IslandSettings, data: TerrainData, gameGen: 8 | 9 = 8) {
  const zip = new JSZip();
  const safeName = settings.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "gw_island";
  const resourceName = safeName;
  const resource = zip.folder(resourceName)!;
  const source = resource.folder("source")!;
  const stream = resource.folder("stream")!;
  const config = resource.folder("config")!;
  const report = resource.folder("report")!;

  const tileCount = data.chunkCount;
  const tileStats = [];
  for (let tile = 0; tile < tileCount; tile++) {
    const result = writeObjTile(data, tile, settings);
    if (result.triangles === 0) continue;
    const filename = `terrain_${String(tile).padStart(2, "0")}.obj`;
    source.file(filename, result.text);
    tileStats.push({ file: filename, vertices: result.vertices, triangles: result.triangles });
  }
  source.file("island_terrain.mtl", makeMtl(settings));
  source.file("island.glb", await exportGlb(data, settings));
  source.file("heightmap_16bit.raw", makeRawHeightmap(data));
  source.file("heightmap_float32_le.raw", makeFloat32Raw(data.heights));
  source.file("blend_weights_rgba8.raw", makeBlendWeightsRaw(data));
  source.file("land_mask_u8.raw", makeMaskRaw(data.land));
  source.file("vegetation_mask_u8.raw", makeMaskRaw(data.vegetationMask));
  source.file("triangle_collision_materials_u8.raw", makeCollisionMaterials(data, settings));
  source.file("heightmap.json", JSON.stringify({
    width: data.n,
    height: data.n,
    cellSizeMeters: data.cell,
    worldSizeMeters: settings.worldSize,
    minElevationMeters: data.minHeight,
    maxElevationMeters: data.maxHeight,
    format: "unsigned 16-bit little-endian RAW, normalized to min/max elevation",
    note: "Source heightmap for the Blender/Sollumz conversion stage.",
  }, null, 2));

  const guides = makePlacementGuides(settings, data);
  config.file("materials.json", JSON.stringify(makeMaterialManifest(settings), null, 2));
  config.file("terrain_channels.json", JSON.stringify({
    format: "islandforge.terrain-channels.v1", width: data.n, height: data.n, sampleCount: data.heights.length,
    blendWeights: { file: "../source/blend_weights_rgba8.raw", format: "RGBA8", channels: settings.layers, order: "row-major" },
    landMask: { file: "../source/land_mask_u8.raw", format: "R8_UNORM", range: "0..255" },
    vegetationMask: { file: "../source/vegetation_mask_u8.raw", format: "R8_UNORM", range: "0..255" },
    collisionMaterials: { file: "../source/triangle_collision_materials_u8.raw", format: "uint8 GTA collision material id per triangle, matching OBJ tile triangle traversal order" },
  }, null, 2));
  config.file("water.json", JSON.stringify({
    enabled: true, seaLevelMeters: 0, seabedDepthMeters: settings.seaDepth, wavesEnabled: settings.waves,
    note: "Native water geometry and physics still need generation by the conversion bridge and in-game validation.",
  }, null, 2));
  config.file("spawn_points.json", JSON.stringify({
    units: "meters", points: data.landmarks.map((item) => ({ ...item, x: item.x + settings.originX, y: item.y + settings.originY })),
    suggestedSpawn: data.landmarks.find((item) => item.id === "capital") ?? data.landmarks[0] ?? null,
  }, null, 2));
  config.file("tile_manifest.json", JSON.stringify({
    units: "meters", worldSize: settings.worldSize, origin: { x: settings.originX, y: settings.originY, z: 0 },
    tileCount: tileStats.length, tiles: tileStats,
  }, null, 2));
  resource.folder("textures")!.file("README.txt",
    "Texture pixels are not redistributed in this package. The preview references GunWare terrain-bank names. For local native conversion, resolve diffuse and normal names from config/materials.json against assets you are licensed to use. Do not ship extracted GTA V texture files publicly without the required rights.\\n"
  );
  config.file("world.json", JSON.stringify({
    project: "Island Forge",
    name: settings.name,
    gameGeneration: gameGen,
    units: "meters (1 Blender Unit = 1 meter)",
    origin: { x: settings.originX, y: settings.originY, z: 0 },
    bounds: {
      minX: settings.originX - settings.worldSize / 2,
      maxX: settings.originX + settings.worldSize / 2,
      minY: settings.originY - settings.worldSize / 2,
      maxY: settings.originY + settings.worldSize / 2,
      minZ: data.minHeight,
      maxZ: data.maxHeight,
    },
    terrain: {
      shape: settings.shape,
      worldSize: settings.worldSize,
      cellSize: data.cell,
      sampleResolution: data.n,
      landRatio: data.landRatio,
      chunks: data.chunkCount,
      vertices: data.positions.length / 3,
      triangles: data.indices.length / 3,
      heightRange: { min: data.minHeight, max: data.maxHeight },
    },
    settings,
    materialManifest: "materials.json",
    waterManifest: "water.json",
    channelManifest: "terrain_channels.json",
    landmarks: data.landmarks.map((item) => ({
      ...item,
      x: item.x + settings.originX,
      y: item.y + settings.originY,
    })),
    suggestedSpawn: data.landmarks.find((item) => item.id === "capital") ?? data.landmarks[0] ?? null,
    generatedNativeGtaAssets: false,
  }, null, 2));
  config.file("road_guides.json", JSON.stringify({
    status: "GUIDES_ONLY_NOT_DRIVABLE_ROADS",
    points: guides.roads,
  }, null, 2));
  config.file("vegetation_placements.json", JSON.stringify({
    status: "PLACEMENT_DATA_ONLY_ASSETS_NOT_INCLUDED",
    points: guides.props,
  }, null, 2));
  config.file("grass_placements.json", JSON.stringify({
    status: "PLACEMENT_DATA_ONLY_ASSETS_NOT_INCLUDED",
    points: guides.grass,
  }, null, 2));

  stream.file("README_NATIVE_ASSETS_REQUIRED.txt",
    "The browser source exporter does not generate native GTA V RAGE assets.\n" +
    "OBJ/GLB/RAW are interchange/source formats, not FiveM-streamable map assets.\n" +
    "Create and validate YDR drawables, YBN collisions, YMAP placements, YTYP archetypes, YTD textures, LOD/SLOD, terrain shaders and water configuration with the GTA asset pipeline (Sollumz/CodeWalker).\n" +
    "The selected game target is gen" + gameGen + ". Confirm target compatibility in the conversion environment.\n"
  );
  resource.file("fxmanifest.lua",
    "fx_version 'cerulean'\\n" +
    "game 'gta5'\\n\\n" +
    "author 'Island Forge'\\n" +
    "description 'Island Forge generated terrain map'\\n" +
    "version '0.3.0'\\n\\n" +
    "this_is_a_map 'yes'\\n" +
    "data_file 'DLC_ITYP_REQUEST' 'stream/*.ytyp'\\n"
  );
  resource.file("README_INSTALL.txt",
    "ISLAND FORGE — FIVE M SOURCE PACKAGE\\n\\n" +
    "Source includes local-space OBJ tiles, GLB preview, 16-bit normalized and exact Float32 heightmaps, four material weights, land/vegetation masks, collision material IDs and world placement metadata.\\n" +
    "This resource is not ready to start in FiveM until native GTA RAGE assets are generated.\\n\\n" +
    "1. Import the local-space OBJ tiles into Blender (1 unit = 1 metre).\\n" +
    "2. Position YMAP entities at the origin in config/world.json.\\n" +
    "3. Use config/materials.json and terrain_channels.json for texture, material blend and collision conversion.\\n" +
    "4. Generate YDR terrain, YBN collision, YMAP placement, YTYP archetype, YTD textures and LOD/SLOD.\\n" +
    "5. Add native water data, validate in CodeWalker and test on an isolated FiveM server.\\n"
  );
  report.file("export_report.json", JSON.stringify({
    generatedAt: new Date().toISOString(), applicationVersion: "0.3.0", gameGeneration: gameGen,
    tileCount: tileStats.length, tiles: tileStats, vertexCount: data.positions.length / 3,
    triangleCount: data.indices.length / 3, propCount: data.props.length / 6, grassInstanceCount: data.grass.length / 4,
    sampleResolution: data.n, cellSizeMeters: data.cell, minHeightMeters: data.minHeight, maxHeightMeters: data.maxHeight,
    texturePixelsBundled: false, sourcePackageOnly: true, readyToRunInFiveM: false,
    nativeOutputsRequired: ["YDR", "YBN", "YMAP", "YTYP", "YTD", "LOD/SLOD", "water"],
    note: "A Windows Blender + Sollumz native conversion service is still required. This ZIP contains source geometry and metadata, not native RAGE assets.",
  }, null, 2));

  zip.file("README.txt",
    "ISLAND FORGE — EXPORT GEN" + gameGen + "\n\n" +
    "This ZIP contains source geometry and a FiveM resource scaffold. It is not a ready-to-run native GTA V map.\n" +
    "See " + resourceName + "/README_INSTALL.txt and " + resourceName + "/stream/README_NATIVE_ASSETS_REQUIRED.txt.\n"
  );
  return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
