import JSZip from "jszip";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { IslandSettings, TerrainData } from "./terrain";
import { sampleTerrain } from "./terrain";

const terrainMaterials = [
  { name: "TW_Sand", color: [0.78, 0.70, 0.50] },
  { name: "TW_Tropical_Grass", color: [0.19, 0.39, 0.20] },
  { name: "TW_Rock", color: [0.38, 0.37, 0.34] },
];

function writeObjTile(data: TerrainData, tileIndex: number, settings: IslandSettings) {
  const origin = { x: settings.originX, y: settings.originY, z: settings.originZ };
  const vertexMap = new Map<number, number>();
  const vertices: number[] = [];
  const faces: { indices: number[]; material: number }[] = [];
  const tileFaces = data.faceTiles;
  const indexArray = data.indices;
  for (let tri = 0; tri < tileFaces.length; tri++) {
    if (tileFaces[tri] !== tileIndex) continue;
    const global = [indexArray[tri * 3], indexArray[tri * 3 + 1], indexArray[tri * 3 + 2]];
    const local = global.map((index) => {
      let mapped = vertexMap.get(index);
      if (mapped === undefined) {
        mapped = vertexMap.size + 1;
        vertexMap.set(index, mapped);
        vertices.push(index);
      }
      return mapped;
    });
    faces.push({ indices: local, material: data.faceMaterials[tri] ?? 1 });
  }

  const lines = [
    `# ${settings.islandName} / tile ${tileIndex}`,
    "# OBJ interchange export. Convert/validate with Sollumz before FiveM deployment.",
    "mtllib island_terrain.mtl",
  ];
  for (const vertexIndex of vertices) {
    const i = vertexIndex * 3;
    lines.push(
      `v ${(data.positions[i] + origin.x).toFixed(4)} ${(data.positions[i + 1] + origin.y).toFixed(4)} ${(data.positions[i + 2] + origin.z).toFixed(4)}`,
    );
  }
  let activeMaterial = -1;
  for (const face of faces) {
    if (face.material !== activeMaterial) {
      activeMaterial = face.material;
      lines.push(`usemtl ${terrainMaterials[activeMaterial]?.name ?? terrainMaterials[1].name}`);
    }
    lines.push(`f ${face.indices.join(" ")}`);
  }
  return { obj: lines.join("\n"), vertices: vertices.length, triangles: faces.length };
}

function makeMtl() {
  return terrainMaterials.map((material) => {
    const [r, g, b] = material.color;
    return [
      `newmtl ${material.name}`,
      `Ka 0.12 0.12 0.12`,
      `Kd ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`,
      "Ks 0.05 0.05 0.05",
      "Ns 8.0",
      "",
    ].join("\n");
  }).join("\n");
}

function makeRawHeightmap(data: TerrainData, settings: IslandSettings) {
  const out = new Uint8Array(data.heights.length * 2);
  const view = new DataView(out.buffer);
  const range = Math.max(1, settings.maxHeight);
  for (let i = 0; i < data.heights.length; i++) {
    const normalized = Math.max(0, Math.min(1, data.heights[i] / range));
    view.setUint16(i * 2, Math.round(normalized * 65535), true);
  }
  return out;
}

function makeRoadGuide(settings: IslandSettings) {
  const anchors = [
    [-0.40, -0.12], [-0.30, 0.02], [-0.12, 0.14], [0.08, 0.22],
    [0.29, 0.15], [0.39, -0.03], [0.27, -0.25], [0.02, -0.34],
    [-0.20, -0.28],
  ];
  return anchors.map(([nx, ny], index) => {
    const sample = sampleTerrain(nx, ny, settings);
    return {
      index,
      x: nx * settings.width * 0.5 + settings.originX,
      y: ny * settings.length * 0.5 + settings.originY,
      z: sample.height + settings.originZ + 4,
      land: sample.land,
    };
  }).filter((point) => point.land > 0.25);
}

function makeVegetationGuide(settings: IslandSettings, count = 3200) {
  // Seeded pseudo-random generator for repeatable placement points.
  let state = settings.seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const points: { x: number; y: number; z: number; type: string }[] = [];
  let attempts = 0;
  while (points.length < count && attempts < count * 15) {
    attempts++;
    const nx = random() * 1.64 - 0.82;
    const ny = random() * 1.64 - 0.82;
    const sample = sampleTerrain(nx, ny, settings);
    if (sample.land < 0.48 || sample.height < settings.sandWidth * 2) continue;
    points.push({
      x: nx * settings.width * 0.5 + settings.originX,
      y: ny * settings.length * 0.5 + settings.originY,
      z: sample.height + settings.originZ,
      type: sample.height > settings.maxHeight * 0.55 ? "forest_highland" : "tropical_tree",
    });
  }
  return points;
}

async function exportGlb(data: TerrainData, settings: IslandSettings) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions.slice(), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(data.colors.slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices.slice(), 1));
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
  );
  terrain.position.set(settings.originX, settings.originY, settings.originZ);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(settings.width * 1.65, settings.length * 1.65),
    new THREE.MeshStandardMaterial({ color: "#174657", roughness: 0.38, metalness: 0.1 }),
  );
  ocean.position.set(settings.originX, settings.originY, settings.originZ - 8);
  const scene = new THREE.Scene();
  scene.add(terrain, ocean);
  const exporter = new GLTFExporter();
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error("Le GLB n'a pas été exporté en format binaire."));
      },
      (error) => reject(error),
      { binary: true, onlyVisible: true },
    );
  });
}

export async function exportIslandPackage(settings: IslandSettings, data: TerrainData) {
  const zip = new JSZip();
  const resourceName = "tw_generated_island";
  const resource = zip.folder(resourceName)!;
  const geo = resource.folder("source_geometry")!;
  const stream = resource.folder("stream")!;
  const config = resource.folder("config")!;

  const tileCount = settings.tiles * settings.tiles;
  const tileStats = [];
  for (let tile = 0; tile < tileCount; tile++) {
    const result = writeObjTile(data, tile, settings);
    if (result.triangles === 0) continue;
    const name = `terrain_${String(tile).padStart(2, "0")}`;
    geo.file(`${name}.obj`, result.obj);
    tileStats.push({ name, file: `${name}.obj`, vertices: result.vertices, triangles: result.triangles });
  }
  geo.file("island_terrain.mtl", makeMtl());
  geo.file("island.glb", await exportGlb(data, settings));
  geo.file("heightmap_16bit.raw", makeRawHeightmap(data, settings));
  geo.file("heightmap.json", JSON.stringify({
    width: settings.resolution,
    height: settings.resolution,
    format: "unsigned 16-bit little-endian RAW",
    minElevationMeters: 0,
    maxElevationMeters: settings.maxHeight,
    sampleSpacingMeters: {
      x: settings.width / (settings.resolution - 1),
      y: settings.length / (settings.resolution - 1),
    },
    note: "Terrain source data for Blender/Sollumz conversion; not a GTA native heightmap asset.",
  }, null, 2));

  const spawn = data.landmarks.find((item) => item.id === "capital") ?? data.landmarks[0];
  const manifest = {
    project: "FiveM Island Generator",
    island: settings.islandName,
    status: "SOURCE_PACKAGE_REQUIRES_GTA_ASSET_CONVERSION",
    units: "meters; Blender Unit = 1 meter",
    coordinateSystem: "X/Y horizontal, Z elevation (GTA-style Z-up)",
    origin: { x: settings.originX, y: settings.originY, z: settings.originZ },
    bounds: {
      minX: settings.originX - settings.width / 2,
      maxX: settings.originX + settings.width / 2,
      minY: settings.originY - settings.length / 2,
      maxY: settings.originY + settings.length / 2,
      minZ: settings.originZ,
      maxZ: settings.originZ + data.maxHeight,
    },
    settings,
    tileCount: tileStats.length,
    tiles: tileStats,
    landmarks: data.landmarks.map((item) => ({ ...item, x: item.x + settings.originX, y: item.y + settings.originY, z: item.z + settings.originZ })),
    spawnSuggestion: spawn ? { x: spawn.x + settings.originX, y: spawn.y + settings.originY, z: spawn.z + settings.originZ + 1 } : null,
    generatedNativeGtaFiles: false,
    conversionRequired: ["YDR terrain drawables", "YBN collision meshes", "YMAP placement", "YTYP archetype definitions", "LOD setup", "GTA water configuration"],
  };
  config.file("world.json", JSON.stringify(manifest, null, 2));
  config.file("landmarks.json", JSON.stringify(manifest.landmarks, null, 2));

  stream.file("README_CONVERSION_REQUIRED.txt",
    "This folder is intentionally empty. The browser exporter cannot author native GTA V RAGE assets.\n" +
    "Use source_geometry/island.glb or the OBJ tiles as input to Blender. In Blender, use a compatible Sollumz release to build the appropriate Drawables (YDR), Bound Composites (YBN), YMAP placement and YTYP archetype data.\n" +
    "Create/validate LODs, collisions, material/shader setup, water and world coordinate placement in CodeWalker and a local FiveM test server.\n" +
    "Do not start this resource expecting the raw OBJ/GLB sources to appear in-game.\n"
  );
  resource.file("fxmanifest.lua",
    "fx_version 'cerulean'\n" +
    "game 'gta5'\n\n" +
    "author 'FiveM Island Generator'\n" +
    "description 'Generated island source package - native map conversion required'\n" +
    "version '0.1.0'\n\n" +
    "-- Add validated GTA assets to stream/ after Sollumz conversion.\n" +
    "this_is_a_map 'yes'\n\n" +
    "files { 'config/*.json' }\n"
  );
  resource.file("README_INSTALL.txt",
    "FIVEM ISLAND SOURCE PACKAGE\n\n" +
    "1. Convert source_geometry assets to native GTA V assets with Blender + Sollumz.\n" +
    "2. Place validated .ydr, .ybn, .ymap, .ytyp and .ytd files in stream/.\n" +
    "3. Validate all assets, collisions, water and world bounds in CodeWalker.\n" +
    "4. Test in an isolated FiveM server before production.\n\n" +
    "The ZIP is not a ready-to-run island map. It includes the source geometry and a resource scaffold.\n"
  );
  zip.file("EXPORT_REPORT.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    island: settings.islandName,
    output: "source_geometry + FiveM resource scaffold",
    readyToStreamInFiveM: false,
    reason: "Native GTA V assets must be authored and validated with Sollumz/CodeWalker.",
  }, null, 2));

  return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
