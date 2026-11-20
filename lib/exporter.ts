import JSZip from "jszip";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { getGunwareMaterial, type GunwareMaterial } from "./gunware-materials";
import type { IslandSettings, TerrainData } from "./terrain";

function getVertexNormal(data: TerrainData, index: number) {
  const x = index % data.n;
  const y = Math.floor(index / data.n);
  const left = data.heights[y * data.n + Math.max(0, x - 1)];
  const right = data.heights[y * data.n + Math.min(data.n - 1, x + 1)];
  const down = data.heights[Math.max(0, y - 1) * data.n + x];
  const up = data.heights[Math.min(data.n - 1, y + 1) * data.n + x];
  const dx = (right - left) / (Math.max(1, Math.min(data.n - 1, x + 1) - Math.max(0, x - 1)) * data.cell);
  const dy = (up - down) / (Math.max(1, Math.min(data.n - 1, y + 1) - Math.max(0, y - 1)) * data.cell);
  const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
  return normal;
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
    "# Island Forge / GunWare material-ready terrain source",
    "# Coordinates: GTA world space; units: metres; Z-up",
    "# UV channel 0 is world-projected and scaled by settings.texScale.",
    "mtllib island_terrain.mtl",
  ];
  for (const index of vertices) {
    const offset = index * 3;
    const x = data.positions[offset], y = data.positions[offset + 1];
    lines.push("v " + (x + settings.originX).toFixed(4) + " " + (y + settings.originY).toFixed(4) + " " + data.positions[offset + 2].toFixed(4));
  }
  for (const index of vertices) {
    const offset = index * 3;
    const x = data.positions[offset], y = data.positions[offset + 1];
    lines.push("vt " + ((x + data.half) / Math.max(1, settings.texScale)).toFixed(5) + " " + ((y + data.half) / Math.max(1, settings.texScale)).toFixed(5));
  }
  for (const index of vertices) {
    const normal = getVertexNormal(data, index);
    lines.push("vn " + normal.x.toFixed(6) + " " + normal.y.toFixed(6) + " " + normal.z.toFixed(6));
  }
  let current = -1;
  for (const face of faces) {
    if (face.material !== current) {
      current = face.material;
      lines.push("usemtl " + (settings.layers[current] ?? settings.layers[1] ?? "grass_lush"));
    }
    lines.push("f " + face.indices.map((index) => index + "/" + index + "/" + index).join(" "));
  }
  return { text: lines.join("\n"), vertices: vertices.length, triangles: faces.length };
}

function writeCollisionObj(data: TerrainData, settings: IslandSettings) {
  const step = Math.max(1, Math.ceil((data.n - 1) / 256));
  const coordinates: number[] = [];
  for (let value = 0; value < data.n - 1; value += step) coordinates.push(value);
  coordinates.push(data.n - 1);
  const size = coordinates.length;
  const lines = [
    "# Coarse collision source mesh for YBN authoring",
    "# Keep this separate from the high-detail visual YDR mesh.",
    "# Z-up; GTA world coordinates; recommended low-complexity collision material.",
  ];
  for (const y of coordinates) for (const x of coordinates) {
    const index = y * data.n + x;
    lines.push("v " + (data.positions[index * 3] + settings.originX).toFixed(4) + " " +
      (data.positions[index * 3 + 1] + settings.originY).toFixed(4) + " " +
      data.heights[index].toFixed(4));
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const a = y * size + x + 1, b = a + 1, c = a + size, d = c + 1;
    const sx = coordinates[x], sy = coordinates[y];
    const sx1 = coordinates[x + 1], sy1 = coordinates[y + 1];
    const landAverage = (
      data.land[sy * data.n + sx] +
      data.land[sy * data.n + sx1] +
      data.land[sy1 * data.n + sx] +
      data.land[sy1 * data.n + sx1]
    ) * 0.25;
    if (landAverage < 0.025) continue;
    lines.push("f " + a + " " + b + " " + c);
    lines.push("f " + b + " " + d + " " + c);
  }
  return { text: lines.join("\n"), vertices: size * size, resolution: size };
}

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialTextureValue(material: GunwareMaterial, u: number, v: number) {
  const role = material.role;
  const broad = Math.sin(u * (role === 2 ? 0.8 : 1.7) + Math.cos(v * 1.1) * 1.3);
  const fine = Math.sin(u * 8.0 + Math.sin(v * 7.0)) * Math.cos(v * 10.0);
  const grain = Math.sin(u * 43.0 + v * 17.0) * Math.sin(v * 37.0 - u * 13.0);
  const ridges = Math.sin((u * 0.8 + v * 0.23) * Math.PI * 4 + Math.sin(v * 2.1));
  const height = role === 0
    ? 0.50 + broad * 0.04 + fine * 0.035 + grain * 0.018
    : role === 1
      ? 0.48 + broad * 0.10 + fine * 0.055 + grain * 0.025
      : role === 2
        ? 0.5 + ridges * 0.13 + fine * 0.07 + grain * 0.025
        : 0.49 + broad * 0.07 + fine * 0.055 + grain * 0.03;
  return { height, brightness: 0.88 + (height - 0.5) * 0.85 + grain * 0.035 };
}

async function createMaterialMaps(material: GunwareMaterial) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de créer les textures de matériau dans ce navigateur.");
  const diffuse = context.createImageData(size, size);
  const normal = context.createImageData(size, size);
  const tint = hexToRgb(material.tint);
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    const u = x / size * Math.PI * 2;
    const v = y / size * Math.PI * 2;
    const detail = materialTextureValue(material, u, v);
    heights[index] = detail.height;
    const shade = detail.brightness;
    diffuse.data[index * 4] = Math.max(0, Math.min(255, tint[0] * shade));
    diffuse.data[index * 4 + 1] = Math.max(0, Math.min(255, tint[1] * shade));
    diffuse.data[index * 4 + 2] = Math.max(0, Math.min(255, tint[2] * shade));
    diffuse.data[index * 4 + 3] = 255;
  }

  const strength = material.role === 2 ? 5.5 : material.role === 1 ? 3.8 : 2.2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    const left = heights[y * size + (x + size - 1) % size];
    const right = heights[y * size + (x + 1) % size];
    const down = heights[((y + size - 1) % size) * size + x];
    const up = heights[((y + 1) % size) * size + x];
    const nx = (left - right) * strength;
    const ny = (down - up) * strength;
    const nz = 1;
    const length = Math.hypot(nx, ny, nz);
    normal.data[index * 4] = Math.round((nx / length * 0.5 + 0.5) * 255);
    normal.data[index * 4 + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
    normal.data[index * 4 + 2] = Math.round((nz / length * 0.5 + 0.5) * 255);
    normal.data[index * 4 + 3] = 255;
  }

  const toPng = async (image: ImageData) => {
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Encodage PNG impossible.")), "image/png"));
    return new Uint8Array(await blob.arrayBuffer());
  };
  const diffuseBytes = await toPng(diffuse);
  const normalBytes = await toPng(normal);
  return { diffuseBytes, normalBytes, width: size, height: size, format: "PNG" as const };
}

function makeMtl(settings: IslandSettings) {
  return [0, 1, 2, 3].map((role) => {
    const material = getGunwareMaterial(settings.layers[role], role as 0 | 1 | 2 | 3);
    const [red, green, blue] = hexToRgb(material.tint);
    const kd = [red, green, blue].map((value) => (value / 255).toFixed(4)).join(" ");
    return [
      "newmtl " + material.id,
      "Ka 0.22 0.22 0.22",
      "Kd " + kd,
      "Ks 0.08 0.08 0.08",
      "Ns 14.0",
      "illum 2",
      "map_Kd textures/" + material.id + "_diffuse.png",
      "map_Bump -bm 0.18 textures/" + material.id + "_normal.png",
      "",
    ].join("\n");
  }).join("\n");
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
  const uv = new Float32Array(data.heights.length * 2);
  for (let i = 0; i < data.heights.length; i++) {
    uv[i * 2] = (data.positions[i * 3] + data.half) / Math.max(1, settings.texScale);
    uv[i * 2 + 1] = (data.positions[i * 3 + 1] + data.half) / Math.max(1, settings.texScale);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
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
  const textures = source.folder("textures")!;
  const stream = resource.folder("stream")!;
  const config = resource.folder("config")!;
  const report = resource.folder("report")!;

  const tileStats = [];
  for (let tile = 0; tile < data.chunkCount; tile++) {
    const result = writeObjTile(data, tile, settings);
    if (result.triangles === 0) continue;
    const filename = "terrain_" + String(tile).padStart(2, "0") + ".obj";
    source.file(filename, result.text);
    tileStats.push({ file: filename, vertices: result.vertices, triangles: result.triangles });
  }

  const selectedMaterials = [0, 1, 2, 3].map((role) => {
    const material = getGunwareMaterial(settings.layers[role], role as 0 | 1 | 2 | 3);
    return {
      slot: role,
      id: material.id,
      label: material.label,
      diffuseTextureDictionary: material.diffuse,
      normalTextureDictionary: material.normal,
      collisionMaterial: material.collision,
      previewTint: material.tint,
      textureAssetsIncluded: false,
      fallbackMaps: [
        "source/textures/" + material.id + "_diffuse.png",
        "source/textures/" + material.id + "_normal.png",
      ],
    };
  });

  for (const item of selectedMaterials) {
    const material = getGunwareMaterial(item.id, item.slot as 0 | 1 | 2 | 3);
    const maps = await createMaterialMaps(material);
    textures.file(material.id + "_diffuse.png", maps.diffuseBytes);
    textures.file(material.id + "_normal.png", maps.normalBytes);
  }
  source.file("island_terrain.mtl", makeMtl(settings));
  source.file("island.glb", await exportGlb(data, settings));
  source.file("heightmap_16bit.raw", makeRawHeightmap(data));
  source.file("heightmap.json", JSON.stringify({
    width: data.n,
    height: data.n,
    cellSizeMeters: data.cell,
    worldSizeMeters: settings.worldSize,
    minElevationMeters: data.minHeight,
    maxElevationMeters: data.maxHeight,
    format: "unsigned 16-bit little-endian RAW, normalized to min/max elevation",
    note: "Source heightmap for Blender/Sollumz terrain conversion.",
  }, null, 2));

  const collision = writeCollisionObj(data, settings);
  source.file("collision_terrain_coarse.obj", collision.text);
  config.file("collision.json", JSON.stringify({
    source: "source/collision_terrain_coarse.obj",
    vertices: collision.vertices,
    resolution: collision.resolution,
    purpose: "coarse source mesh for creating a GTA YBN collision asset",
    materialPerLayer: selectedMaterials.map((material) => ({ slot: material.slot, id: material.id, collisionMaterial: material.collisionMaterial })),
    note: "This OBJ is not a YBN file. Configure collision flags/materials in the native conversion stage.",
  }, null, 2));

  const guides = makePlacementGuides(settings, data);
  config.file("world.json", JSON.stringify({
    project: "Island Forge",
    name: settings.name,
    gameGeneration: gameGen,
    units: "meters (1 Blender Unit = 1 meter)",
    axis: "Z_UP",
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
    },
    settings,
    landmarks: data.landmarks.map((item) => ({
      ...item,
      x: item.x + settings.originX,
      y: item.y + settings.originY,
    })),
    suggestedSpawn: data.landmarks.find((item) => item.id === "capital") ?? data.landmarks[0] ?? null,
    generatedNativeGtaAssets: false,
  }, null, 2));
  config.file("materials.json", JSON.stringify({
    source: "GunWare Island Creator reference material list",
    selected: selectedMaterials,
    textureNote: "Named GTA texture dictionaries are references for the native worker. The bundled PNG maps are generated fallback maps, not copied GTA/GunWare bitmaps.",
  }, null, 2));
  config.file("water.json", JSON.stringify({
    waterLevel: 0,
    seaDepth: settings.seaDepth,
    waves: settings.waves,
    bounds: {
      minX: settings.originX - settings.worldSize * 0.9,
      maxX: settings.originX + settings.worldSize * 0.9,
      minY: settings.originY - settings.worldSize * 0.9,
      maxY: settings.originY + settings.worldSize * 0.9,
    },
    nativeWaterDataRequired: true,
    note: "Preview ocean only; the native worker must author/test GTA water data separately.",
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
    "This source package contains OBJ/GLB/RAW and fallback PNG maps; it is not a native GTA V map.\\n" +
    "Import terrain and coarse collision separately. Build YDR visual meshes and YBN collision with the correct collision flags/materials.\\n" +
    "Resolve the listed GTA texture dictionary names from legally available game assets using CodeWalker/RPF tooling; do not rename the fallback maps as original game textures.\\n" +
    "Create YMAP placements, YTYP archetypes, YTD texture dictionaries, LOD/SLOD and native water data.\\n" +
    "Target generation: gen" + gameGen + ". Validate all binary assets and coordinates before FiveM deployment.\\n"
  );
  resource.file("fxmanifest.lua",
    "fx_version 'cerulean'\\n" +
    "game 'gta5'\\n\\n" +
    "author 'Island Forge'\\n" +
    "description 'Island Forge terrain source; complete native assets in stream/ are required'\\n" +
    "version '0.3.0'\\n\\n" +
    "this_is_a_map 'yes'\\n"
  );
  resource.file("README_INSTALL.txt",
    "ISLAND FORGE — SOURCE AND CONVERSION PACKAGE\\n\\n" +
    "source/ contains tiled terrain OBJ files with world UVs/normals, MTL, procedural fallback texture maps, GLB preview, 16-bit RAW heightmap and a separate coarse collision OBJ.\\n" +
    "config/ contains the GTA world placement, material dictionary references, collision metadata, water settings and placement guides.\\n\\n" +
    "Native conversion checklist (Windows):\\n" +
    "1. Open the terrain OBJ tiles in Blender (Z-up; 1 unit = 1 metre). Keep visual and collision meshes separate.\\n" +
    "2. Replace fallback texture maps with extracted/authorized GTA texture assets where appropriate; create YTD textures with mipmaps.\\n" +
    "3. Build optimized visual YDR drawables and coarse YBN collision assets with valid GTA collision materials.\\n" +
    "4. Create archetypes in YTYP and placements in YMAP; generate LOD/SLOD and world bounds.\\n" +
    "5. Configure native water and proc-grass/material tags for the selected GTA build.\\n" +
    "6. Validate in CodeWalker and an isolated FiveM server before deployment.\\n"
  );
  report.file("export_report.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    gameGeneration: gameGen,
    tileCount: tileStats.length,
    tiles: tileStats,
    triangleCount: tileStats.reduce((sum, item) => sum + item.triangles, 0),
    collisionVertices: collision.vertices,
    materialSlots: selectedMaterials.length,
    fallbackTextureMaps: selectedMaterials.length * 2,
    sourcePackageOnly: true,
    readyToRunInFiveM: false,
    note: "The browser generated source package is not a native RAGE resource; use the Windows conversion stage.",
  }, null, 2));

  zip.file("README.txt",
    "ISLAND FORGE — EXPORT GEN" + gameGen + "\\n\\n" +
    "Source package with terrain geometry, fallback material maps, coarse collision mesh, world metadata and placement guides.\\n" +
    "This is not a ready-to-run native GTA V/FiveM map. See " + resourceName + "/README_INSTALL.txt.\\n"
  );
  return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
