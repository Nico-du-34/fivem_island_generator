import { getGunwareMaterial, type GunwareMaterialId } from "./gunware-materials";

export type IslandShape =
  | "round" | "long" | "crescent" | "twin" | "archipelago"
  | "atoll" | "volcano" | "continent" | "islands";

export type MaterialLayer = GunwareMaterialId;

export type IslandSettings = {
  name: string;
  seed: number;
  shape: IslandShape;
  worldSize: number;
  cellSize: number;
  meshCell: number;
  coverage: number;
  coastNoise: number;
  warp: number;
  maxHeight: number;
  mountains: number;
  hills: number;
  terraces: number;
  seaDepth: number;
  erosion: number;
  thermal: number;
  beachWidth: number;
  beachHeight: number;
  rockSlope: number;
  dryness: number;
  layers: MaterialLayer[];
  texScale: number;
  grassDensity: number;
  grassTypes: string[];
  treeDensity: number;
  treeTypes: string[];
  rockDensity: number;
  rockTypes: string[];
  procTags: { sand: number; grass: number; rock: number; dirt: number; underwater: number };
  originX: number;
  originY: number;
  fauna: number;
  faunaTypes: string[];
  ignoreGtaMap: boolean;
  waves: boolean;
};

export type Landmark = {
  id: string;
  label: string;
  type: "city" | "port" | "airport" | "nature" | "tourism";
  x: number;
  y: number;
  z: number;
};

export type TerrainData = {
  n: number;
  cell: number;
  half: number;
  positions: Float32Array;
  colors: Float32Array;
  blendWeights: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;
  land: Float32Array;
  vegetationMask: Float32Array;
  props: Float32Array;
  grass: Float32Array;
  faceTiles: Uint16Array;
  faceMaterials: Uint8Array;
  landmarks: Landmark[];
  minHeight: number;
  maxHeight: number;
  landRatio: number;
  chunkCount: number;
};

export const WORLD_SIZES = [512, 768, 1024, 1280, 1536, 2048, 2560, 3072, 4096, 5120, 6144, 8192, 10240, 12288, 14336, 16384];

export const SHAPES: { id: IslandShape; label: string }[] = [
  { id: "round", label: "Ronde" },
  { id: "long", label: "Allongée" },
  { id: "crescent", label: "Croissant" },
  { id: "twin", label: "Jumelles" },
  { id: "archipelago", label: "Archipel" },
  { id: "atoll", label: "Atoll" },
  { id: "volcano", label: "Volcan" },
  { id: "continent", label: "Continent" },
  { id: "islands", label: "Îles éparses" },
];

export const MATERIAL_OPTIONS: { id: MaterialLayer; label: string; color: string }[] = [
  { id: "sand_beach", label: "Sable", color: "#d9c9a3" },
  { id: "grass_lush", label: "Herbe", color: "#5d7134" },
  { id: "rock_cliff", label: "Roche", color: "#7d7466" },
  { id: "dirt_forest", label: "Terre", color: "#6e5f45" },
];

export const DEFAULT_SETTINGS: IslandSettings = {
  name: "gw_island",
  seed: 1337,
  shape: "round",
  worldSize: 1024,
  cellSize: 2,
  meshCell: 2,
  coverage: 0.62,
  coastNoise: 0.55,
  warp: 0.35,
  maxHeight: 70,
  mountains: 0.55,
  hills: 0.5,
  terraces: 0,
  seaDepth: 60,
  erosion: 0.6,
  thermal: 0.35,
  beachWidth: 0.6,
  beachHeight: 2.2,
  rockSlope: 0.42,
  dryness: 0.3,
  layers: ["sand_beach", "grass_lush", "rock_cliff", "dirt_forest"],
  texScale: 6,
  grassDensity: 0.6,
  grassTypes: ["proc_grasses01", "proc_grassplantmix_01", "proc_meadowmix_01", "proc_grassfronds01"],
  treeDensity: 16,
  treeTypes: ["prop_palm_med_01b", "prop_palm_sm_01e", "prop_palm_fan_03_c", "prop_palm_fan_04_b"],
  rockDensity: 6,
  rockTypes: ["prop_rock_1_d", "prop_rock_3_a", "prop_rock_3_h", "prop_rock_4_c", "prop_rock_4_d"],
  procTags: { sand: 0, grass: 139, rock: 0, dirt: 164, underwater: 49 },
  originX: -3450,
  originY: -3450,
  fauna: 0.5,
  faunaTypes: ["WORLD_DOLPHIN_SWIM", "WORLD_STINGRAY_SWIM", "WORLD_SHARK_HAMMERHEAD_SWIM", "WORLD_SHARK_SWIM", "WORLD_WHALE_SWIM"],
  ignoreGtaMap: false,
  waves: true,
};

export const PRESETS: { id: string; label: string; params: Partial<IslandSettings> }[] = [
  { id: "tropical", label: "Tropicale", params: { shape: "round", maxHeight: 70, mountains: 0.55, coverage: 0.62, beachWidth: 0.6, dryness: 0.25, treeDensity: 9 } },
  { id: "lagoon", label: "Lagon", params: { shape: "atoll", maxHeight: 18, mountains: 0.15, hills: 0.35, coverage: 0.7, beachWidth: 0.9, beachHeight: 3, treeDensity: 14, erosion: 0.3 } },
  { id: "volcanic", label: "Volcanique", params: { shape: "volcano", maxHeight: 160, mountains: 0.4, hills: 0.4, coverage: 0.55, beachWidth: 0.35, rockSlope: 0.34, dryness: 0.5, treeDensity: 5 } },
  { id: "rocky", label: "Rocheuse", params: { shape: "long", maxHeight: 110, mountains: 0.85, hills: 0.65, terraces: 0.25, beachWidth: 0.25, rockSlope: 0.3, dryness: 0.55, treeDensity: 4, rockDensity: 14 } },
  { id: "archipelago", label: "Archipel", params: { shape: "archipelago", maxHeight: 45, mountains: 0.45, coverage: 0.75, beachWidth: 0.7, treeDensity: 10 } },
  { id: "continent", label: "Grande terre (8 km)", params: { shape: "continent", worldSize: 8192, cellSize: 4, meshCell: 2, maxHeight: 420, mountains: 0.7, hills: 0.55, coverage: 0.7, coastNoise: 0.7, warp: 0.5, erosion: 0.8, thermal: 0.4, beachWidth: 0.55, treeDensity: 14 } },
  { id: "big_archipelago", label: "Archipel géant (10 km)", params: { shape: "islands", worldSize: 10240, cellSize: 8, meshCell: 2, maxHeight: 180, mountains: 0.5, hills: 0.5, coverage: 0.55, coastNoise: 0.6, warp: 0.45, erosion: 0.6, beachWidth: 0.75, treeDensity: 12 } },
];

export const TERRAIN_TOOLS = [
  { id: "orbit", label: "Caméra", key: "1", hint: "Orbite au clic gauche", color: "#6f79bf", kind: "camera" },
  { id: "raise", label: "Élever", key: "2", hint: "Monte le terrain sous le pinceau", color: "#7db04f", kind: "height" },
  { id: "lower", label: "Creuser", key: "3", hint: "Creuse : baies, chenaux, criques", color: "#df746f", kind: "height" },
  { id: "smooth", label: "Lisser", key: "4", hint: "Adoucit les pentes et les arêtes", color: "#8fb9bf", kind: "height" },
  { id: "flatten", label: "Aplanir", key: "5", hint: "Aplanit à la hauteur du premier clic", color: "#d6bb6b", kind: "height" },
  { id: "paint", label: "Peindre", key: "6", hint: "Peint la couche choisie", color: "#d4d5dc", kind: "paint" },
  { id: "erase", label: "Gomme", key: "7", hint: "Efface la peinture", color: "#d97e73", kind: "paint" },
  { id: "vegRemove", label: "Déboiser", key: "8", hint: "Retire herbe, arbres et rochers", color: "#d1a15d", kind: "vegetation" },
  { id: "vegAdd", label: "Densifier", key: "9", hint: "Ajoute de la végétation", color: "#2eaa71", kind: "vegetation" },
] as const;

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createSimplexNoise(seed: number) {
  const random = createSeededRandom(seed);
  const permutation = new Uint8Array(512);
  const source = new Uint8Array(256);
  const gradients = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [1, 0], [-1, 0],
    [0, 1], [0, -1], [0, 1], [0, -1],
  ];
  for (let i = 0; i < 256; i++) source[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const value = source[i];
    source[i] = source[j];
    source[j] = value;
  }
  for (let i = 0; i < 512; i++) permutation[i] = source[i & 255];

  const noise = (x: number, y: number) => {
    const f2 = 0.5 * (Math.sqrt(3) - 1);
    const g2 = (3 - Math.sqrt(3)) / 6;
    const skew = (x + y) * f2;
    const i = Math.floor(x + skew), j = Math.floor(y + skew);
    const unskew = (i + j) * g2;
    const x0 = x - (i - unskew), y0 = y - (j - unskew);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + g2, y1 = y0 - j1 + g2;
    const x2 = x0 - 1 + 2 * g2, y2 = y0 - 1 + 2 * g2;
    const ii = i & 255, jj = j & 255;
    // The three simplex corners use the same permutation table with their own offsets.
    const p0 = gradients[permutation[ii + permutation[jj]] % 12];
    const p1 = gradients[permutation[ii + i1 + permutation[jj + j1]] % 12];
    const p2 = gradients[permutation[ii + 1 + permutation[jj + 1]] % 12];
    const corner = (cx: number, cy: number, gradient: number[]) => {
      const attenuation = 0.5 - cx * cx - cy * cy;
      if (attenuation <= 0) return 0;
      const a = attenuation * attenuation;
      return a * a * (gradient[0] * cx + gradient[1] * cy);
    };
    return 70 * (corner(x0, y0, p0) + corner(x1, y1, p1) + corner(x2, y2, p2));
  };

  const fbm = (x: number, y: number, octaves: number, lacunarity = 2, persistence = 0.5) => {
    let amplitude = 1, frequency = 1, total = 0, norm = 0;
    for (let octave = 0; octave < octaves; octave++) {
      total += amplitude * noise(x * frequency + octave * 17.31, y * frequency - octave * 9.73);
      norm += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / Math.max(0.0001, norm);
  };
  const ridged = (x: number, y: number, octaves: number, lacunarity = 2.1, persistence = 0.5) => {
    let amplitude = 0.5, frequency = 1, total = 0, norm = 0, weight = 1;
    for (let octave = 0; octave < octaves; octave++) {
      let ridge = 1 - Math.abs(noise(x * frequency + octave * 31.7, y * frequency + octave * 11.1));
      ridge *= ridge * weight;
      weight = clamp(ridge * 2);
      total += ridge * amplitude;
      norm += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / Math.max(0.0001, norm);
  };
  return { noise, fbm, ridged };
}

type TerrainSample = { height: number; land: number; coast: number; slopeHint: number };
type TerrainSampler = (nx: number, ny: number) => TerrainSample;

function createTerrainSampler(p: IslandSettings): TerrainSampler {
  const shapeNoise = createSimplexNoise(p.seed + 17);
  const warpNoise = createSimplexNoise(p.seed + 101);
  const coastNoise = createSimplexNoise(p.seed + 233);
  const hillsNoise = createSimplexNoise(p.seed + 347);
  const mountainNoise = createSimplexNoise(p.seed + 461);
  const seaNoise = createSimplexNoise(p.seed + 577);
  const shapeRandom = createSeededRandom(p.seed + 701);
  const angle = shapeRandom() * Math.PI * 2;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const blobs: { x: number; y: number; radius: number }[] = [];

  if (p.shape === "archipelago") {
    const count = 4 + Math.floor(shapeRandom() * 4);
    for (let i = 0; i < count; i++) {
      const direction = shapeRandom() * Math.PI * 2;
      const distance = p.coverage * (0.55 + shapeRandom() * 0.40);
      blobs.push({
        x: Math.cos(direction) * distance + (shapeRandom() - 0.5) * p.coverage * 0.18,
        y: Math.sin(direction) * distance + (shapeRandom() - 0.5) * p.coverage * 0.18,
        radius: p.coverage * (0.14 + shapeRandom() * 0.16),
      });
    }
  } else if (p.shape === "twin") {
    const distance = p.coverage * 0.42;
    blobs.push({ x: -distance, y: 0, radius: p.coverage * 0.55 });
    blobs.push({ x: distance, y: (shapeRandom() - 0.5) * p.coverage * 0.3, radius: p.coverage * (0.40 + shapeRandom() * 0.1) });
  }

  const softUnion = (a: number, b: number, k: number) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.max(a, b) + h * h * k * 0.25;
  };

  return (nx, ny) => {
    const warpX = warpNoise.fbm(nx * 1.4, ny * 1.4, 3) * p.warp * 0.3;
    const warpY = warpNoise.fbm(nx * 1.4 + 7.7, ny * 1.4 - 3.1, 3) * p.warp * 0.3;
    const wx = nx + warpX, wy = ny + warpY;
    const x = wx * cos - wy * sin;
    const y = wx * sin + wy * cos;
    const radius = Math.hypot(x, y);

    let shape = 0;
    if (p.shape === "round" || p.shape === "volcano") {
      shape = 1 - radius / Math.max(0.08, p.coverage);
    } else if (p.shape === "long") {
      shape = 1 - Math.hypot(x / Math.max(0.08, p.coverage * 1.35), y / Math.max(0.08, p.coverage * 0.55));
    } else if (p.shape === "crescent") {
      const outer = 1 - radius / Math.max(0.08, p.coverage);
      const inner = Math.hypot(x - p.coverage * 0.5, y) / Math.max(0.08, p.coverage * 0.72) - 1;
      shape = Math.min(outer, inner * 1.4);
    } else if (p.shape === "atoll") {
      shape = 1 - Math.abs(radius - p.coverage * 0.78) / Math.max(0.06, p.coverage * 0.2);
    } else if (p.shape === "twin" || p.shape === "archipelago") {
      shape = -10;
      for (const blob of blobs) {
        const influence = 1 - Math.hypot(wx - blob.x, wy - blob.y) / Math.max(0.05, blob.radius);
        shape = softUnion(shape, influence, 0.35);
      }
    } else if (p.shape === "continent") {
      const continentNoise = shapeNoise.fbm(x * 1.3 + 3.1, y * 1.3 - 1.7, 5);
      shape = (1 - radius / Math.max(0.08, p.coverage * 1.12)) * 0.8 + continentNoise * 0.62 - 0.04;
    } else {
      const islandNoise = shapeNoise.fbm(x * 2.6 + 0.4, y * 2.6 + 5.2, 5);
      shape = (islandNoise - (0.33 - p.coverage * 0.42)) * 3 - smoothstep(0.82, 1.02, radius) * 1.6;
    }

    const coastDetail =
      coastNoise.fbm(wx * 2.2, wy * 2.2, 3) * p.coastNoise * 0.28 +
      coastNoise.fbm(wx * 9, wy * 9, 3) * p.coastNoise * 0.07 +
      Math.sin(Math.atan2(wy, wx) * 13 + p.seed * 0.019) * p.coastNoise * 0.012;
    const coast = shape + coastDetail;
    const land = smoothstep(-0.018, 0.045, coast);
    const inland = smoothstep(0.015, 0.65, Math.max(0, coast));

    const hills = hillsNoise.fbm(wx * 2.7 + 8, wy * 2.7 - 4, 6) * 0.5 + 0.5;
    const broad = hillsNoise.fbm(wx * 0.9, wy * 0.9, 4) * 0.5 + 0.5;
    const ridges = mountainNoise.ridged(wx * 1.6, wy * 1.6, 6);
    const peakMask = smoothstep(0.08, 0.62, coast);

    let relief = Math.pow(Math.max(0.0001, inland), 0.85) *
      (0.28 + 0.36 * p.hills * (0.3 + hills * 1.1) + 0.16 * broad * p.hills);
    relief *= 1 - p.mountains * 0.25;
    relief += p.mountains * Math.pow(ridges, 1.45) * peakMask * 0.95;
    relief += p.mountains * Math.pow(Math.max(0, broad - 0.55), 1.5) * peakMask * 0.45;

    // Add mid/high-frequency landform detail so large islands do not read as
    // smooth noise domes. These layers are spatially warped to avoid concentric bands.
    const detailWarp = shapeNoise.fbm(wx * 3.2 + 9.1, wy * 3.2 - 6.7, 3);
    const terrainDetail = shapeNoise.fbm(
      wx * 10.5 + detailWarp * 2.8 + 13.4,
      wy * 10.5 - detailWarp * 2.2 - 5.8,
      4,
    );
    const microDetail = shapeNoise.fbm(wx * 24.0 + 2.7, wy * 24.0 - 8.4, 3);
    relief += peakMask * inland * (
      terrainDetail * (0.055 * p.hills + 0.028 * p.mountains) +
      microDetail * (0.018 + 0.022 * p.hills)
    );

    if (p.shape === "volcano") {
      const normalizedRadius = radius / Math.max(0.05, p.coverage);
      const ring = Math.exp(-Math.pow((normalizedRadius - 0.48) / 0.2, 2));
      const crater = Math.exp(-Math.pow(normalizedRadius / 0.14, 2));
      relief = inland * (0.10 + ring * p.mountains * 1.2 + hills * p.hills * 0.2 - crater * 0.35);
    } else if (p.shape === "atoll") {
      relief = inland * (0.08 + hills * p.hills * 0.12);
    }

    if (coast > 0) {
      let rawHeight = Math.max(0, relief) * p.maxHeight;

      // Plateaux are broken by two independent noise scales and only affect
      // higher inland terrain. This prevents the old circular contour rings.
      if (p.terraces > 0.001 && peakMask > 0.02 && p.shape !== "atoll") {
        const stepHeight = Math.max(8, p.maxHeight / 16);
        const contourWarp =
          shapeNoise.fbm(wx * 5.3 + rawHeight * 0.0025, wy * 5.3 - rawHeight * 0.0018, 4) * 0.78 +
          shapeNoise.fbm(wx * 13.2 - 3.4, wy * 13.2 + 8.6, 3) * 0.24;
        const level = rawHeight / stepHeight + contourWarp;
        const baseLevel = Math.floor(level);
        const phase = level - baseLevel;
        const shelf = smoothstep(0.10, 0.24, phase) * (1 - smoothstep(0.72, 0.90, phase));
        const terracedHeight = baseLevel * stepHeight + stepHeight * (0.18 + shelf * 0.52) - contourWarp * stepHeight * 0.30;
        const upperTerrain = smoothstep(0.12, 0.62, rawHeight / Math.max(1, p.maxHeight));
        const influence = clamp(p.terraces * 0.72 * peakMask * upperTerrain);
        rawHeight += (terracedHeight - rawHeight) * influence;
      }

      return { height: rawHeight, land, coast, slopeHint: 0 };
    }

    const depth = Math.max(0, -coast);
    const seaFloor = p.seaDepth * Math.pow(smoothstep(0.015, 0.72, depth), 1.25);
    const undulation = seaNoise.fbm(nx * 0.45, ny * 0.45, 3) * 0.55 * smoothstep(0.02, 0.24, depth);
    return { height: -seaFloor + undulation, land, coast, slopeHint: 0 };
  };
}

export function sampleTerrain(nx: number, ny: number, p: IslandSettings) {
  return createTerrainSampler(p)(nx, ny);
}

function computeWeights(height: number, land: number, slope: number, p: IslandSettings) {
  const beach = 1 - smoothstep(p.beachHeight * 0.7, p.beachHeight * 4.5, height);
  const sand = clamp(beach * (0.22 + land * 0.78));
  const rock = clamp((slope - p.rockSlope) * 2.8 + smoothstep(p.maxHeight * 0.28, p.maxHeight * 0.82, height) * p.mountains * 0.42);
  const dirt = clamp((0.16 + p.dryness * 0.74) * (0.22 + smoothstep(p.maxHeight * 0.08, p.maxHeight * 0.55, height) * 0.78) * (1 - rock * 0.42));
  const grass = Math.max(0.001, (1 - sand) * (1 - rock * 0.8) * (1 - dirt * 0.58));
  const total = sand + grass + rock + dirt;
  return [sand / total, grass / total, rock / total, dirt / total];
}

function hexToLinear(hex: string) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [value >> 16 & 255, value >> 8 & 255, value & 255].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
}

function materialColor(weights: number[], variation: number, layers: MaterialLayer[] = DEFAULT_SETTINGS.layers) {
  const selected = [
    getGunwareMaterial(layers[0], 0).tint,
    getGunwareMaterial(layers[1], 1).tint,
    getGunwareMaterial(layers[2], 2).tint,
    getGunwareMaterial(layers[3], 3).tint,
  ].map(hexToLinear);
  const out = [0, 0, 0];
  for (let layer = 0; layer < 4; layer++) {
    for (let channel = 0; channel < 3; channel++) out[channel] += selected[layer][channel] * weights[layer];
  }
  const shade = 0.96 + variation * 0.12;
  return out.map((value) => clamp(value * shade, 0, 1));
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hydraulicErosion(heights: Float32Array, land: Float32Array, n: number, strength: number, seed: number) {
  if (strength <= 0.01 || n < 48) return;
  const random = seededRandom(seed + 7123);
  const droplets = Math.round(120 + strength * 1050 * (n / 257));
  for (let d = 0; d < droplets; d++) {
    let x = 2 + random() * (n - 4);
    let y = 2 + random() * (n - 4);
    let sediment = 0;
    let vx = 0, vy = 0;
    for (let life = 0; life < 24; life++) {
      const ix = x | 0, iy = y | 0, idx = iy * n + ix;
      if (land[idx] < 0.3) break;
      const h = heights[idx];
      const gx = heights[idx + 1] - heights[idx - 1];
      const gy = heights[idx + n] - heights[idx - n];
      vx = vx * 0.25 - gx * 0.375;
      vy = vy * 0.25 - gy * 0.375;
      const len = Math.hypot(vx, vy);
      if (len < 0.0001) break;
      vx /= len; vy /= len;
      x += vx; y += vy;
      if (x < 2 || y < 2 || x > n - 3 || y > n - 3) break;
      const next = (y | 0) * n + (x | 0);
      const drop = heights[next] - h;
      if (drop > 0) {
        const deposit = Math.min(sediment, drop);
        heights[idx] += deposit * 0.35;
        sediment -= deposit * 0.35;
      } else {
        const erosion = Math.min((0.045 + -drop * 0.16) * strength, 0.85);
        heights[idx] -= erosion;
        sediment += erosion;
      }
    }
  }
}

function thermalErosion(heights: Float32Array, land: Float32Array, n: number, strength: number) {
  if (strength <= 0.01) return;
  const delta = new Float32Array(heights.length);
  const passes = Math.max(1, Math.round(1 + strength * 4));
  for (let pass = 0; pass < passes; pass++) {
    delta.fill(0);
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      if (land[i] < 0.3) continue;
      const h = heights[i];
      for (const j of [i - 1, i + 1, i - n, i + n]) {
        const diff = h - heights[j];
        const threshold = 0.7 + (1 - strength) * 1.8;
        if (diff > threshold) {
          const transfer = Math.min(0.12, (diff - threshold) * 0.035 * strength);
          delta[i] -= transfer;
          delta[j] += transfer;
        }
      }
    }
    for (let i = 0; i < heights.length; i++) heights[i] += delta[i];
  }
}

function makeLandmarks(p: IslandSettings, sample: TerrainSampler): Landmark[] {
  const seeds: Omit<Landmark, "z">[] = [
    { id: "capital", label: "Centre urbain", type: "city", x: -0.16, y: -0.08 },
    { id: "port", label: "Port commercial", type: "port", x: -0.48, y: -0.30 },
    { id: "airport", label: "Aéroport", type: "airport", x: 0.35, y: 0.12 },
    { id: "paradise", label: "Côte touristique", type: "tourism", x: 0.38, y: -0.35 },
    { id: "highland", label: "Massif montagneux", type: "nature", x: 0.02, y: 0.53 },
    { id: "green-valley", label: "Vallée verte", type: "nature", x: -0.36, y: 0.18 },
    { id: "eastern-coast", label: "Côte orientale", type: "tourism", x: 0.60, y: 0.02 },
    { id: "wild-forest", label: "Forêt tropicale", type: "nature", x: -0.54, y: 0.45 },
  ];
  return seeds.flatMap((seed) => {
    let x = seed.x, y = seed.y, point = sample(x, y);
    if (point.land < 0.32) {
      let found = false;
      for (let radius = 0.04; radius < 0.36 && !found; radius += 0.04) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
          const tx = seed.x + Math.cos(angle) * radius;
          const ty = seed.y + Math.sin(angle) * radius;
          const candidate = sample(tx, ty);
          if (candidate.land > 0.45) {
            x = tx;
            y = ty;
            point = candidate;
            found = true;
            break;
          }
        }
      }
    }
    if (point.land < 0.32) return [];
    return [{ ...seed, x: x * p.worldSize * 0.5, y: y * p.worldSize * 0.5, z: point.height + 5 }];
  });
}

export function effectiveCellSize(p: IslandSettings) {
  const minimumCell = Math.ceil(p.worldSize / 1536);
  return Math.max(1, minimumCell, Math.min(p.cellSize, p.meshCell));
}

export function generateIsland(p: IslandSettings): TerrainData {
  const requestedCell = effectiveCellSize(p);
  const n = Math.min(1537, Math.max(65, Math.round(p.worldSize / requestedCell) + 1));
  const cell = p.worldSize / (n - 1);
  const half = p.worldSize / 2;
  const count = n * n;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const blendWeights = new Float32Array(count * 4);
  const heights = new Float32Array(count);
  const land = new Float32Array(count);
  const vegetationMask = new Float32Array(count);
  const sample = createTerrainSampler(p);
  let rawPeak = 0, landCount = 0;

  // Pass 1: evaluate a seeded coast/relief field. Positive terrain is normalized
  // to the configured maximum altitude in pass 2 so every map uses its full range.
  for (let y = 0; y < n; y++) {
    const ny = (y / (n - 1)) * 2 - 1;
    for (let x = 0; x < n; x++) {
      const nx = (x / (n - 1)) * 2 - 1;
      const index = y * n + x;
      const point = sample(nx, ny);
      heights[index] = point.height;
      land[index] = point.land;
      if (point.land > 0.2) landCount++;
      if (point.land > 0.5) rawPeak = Math.max(rawPeak, point.height);
      positions[index * 3] = nx * half;
      positions[index * 3 + 1] = ny * half;
    }
  }

  const heightScale = p.maxHeight / Math.max(0.001, rawPeak);
  for (let i = 0; i < count; i++) {
    if (heights[i] > 0) heights[i] *= heightScale;
  }

  // Erosion is applied to the normalized height field, not to the raw noise.
  hydraulicErosion(heights, land, n, p.erosion, p.seed);
  thermalErosion(heights, land, n, p.thermal);

  // A smooth beach profile raises the shallow seabed and lowers the shoreline
  // into a walkable shelf, matching the reference generator's profile curve.
  if (p.beachWidth > 0) {
    const strength = p.beachWidth * 0.85;
    const landCurve = p.beachHeight * 1.2 + 3 * p.beachWidth;
    const seaCurve = 1.5 + 2.5 * p.beachWidth;
    for (let i = 0; i < count; i++) {
      const h = heights[i];
      const curve = h >= 0 ? landCurve : seaCurve;
      heights[i] = h - strength * curve * Math.tanh(h / Math.max(0.1, curve));
    }
  }

  let minHeight = Infinity, maxHeight = -Infinity;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const index = y * n + x;
    const h = heights[index];
    const left = heights[y * n + Math.max(0, x - 1)];
    const right = heights[y * n + Math.min(n - 1, x + 1)];
    const down = heights[Math.max(0, y - 1) * n + x];
    const up = heights[Math.min(n - 1, y + 1) * n + x];
    const dx = (right - left) / (x === 0 || x === n - 1 ? cell : 2 * cell);
    const dy = (up - down) / (y === 0 || y === n - 1 ? cell : 2 * cell);
    const slope = Math.hypot(dx, dy);
    const weights = computeWeights(h, land[index], slope, p);
    blendWeights.set(weights, index * 4);
    const variation = Math.sin((x + p.seed * 0.13) * 0.047) * Math.cos((y - p.seed * 0.09) * 0.039);
    colors.set(materialColor(weights, variation, p.layers), index * 3);
    positions[index * 3 + 2] = h;
    vegetationMask[index] = land[index] > 0.5 && h > p.beachHeight * 0.55 && slope < 1.25 ? 1 : 0;
    minHeight = Math.min(minHeight, h);
    maxHeight = Math.max(maxHeight, h);
  }

  const indices: number[] = [];
  const faceTiles: number[] = [];
  const faceMaterials: number[] = [];
  const tileAxis = Math.max(1, Math.min(8, Math.ceil(p.worldSize / 2048)));
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const a = y * n + x, b = a + 1, c = a + n, d = c + 1;
    const landAvg = (land[a] + land[b] + land[c] + land[d]) * 0.25;
    if (landAvg < 0.025) continue;
    indices.push(a, b, c, b, d, c);
    const tileX = Math.min(tileAxis - 1, Math.floor(x / (n - 1) * tileAxis));
    const tileY = Math.min(tileAxis - 1, Math.floor(y / (n - 1) * tileAxis));
    const tile = tileY * tileAxis + tileX;
    const weights = [0, 1, 2, 3].map((layer) =>
      (blendWeights[a * 4 + layer] + blendWeights[b * 4 + layer] + blendWeights[c * 4 + layer] + blendWeights[d * 4 + layer]) * 0.25,
    );
    const material = weights.indexOf(Math.max(...weights));
    faceTiles.push(tile, tile);
    faceMaterials.push(material, material);
  }

  const sampleGrid = (worldX: number, worldY: number) => {
    const gx = clamp((worldX + half) / cell, 0, n - 1.0001);
    const gy = clamp((worldY + half) / cell, 0, n - 1.0001);
    const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const i00 = iy * n + ix, i10 = i00 + 1, i01 = i00 + n, i11 = i01 + 1;
    const blend = (array: Float32Array, offset: number, channels = 1) => {
      const value = (channel: number) =>
        array[i00 * channels + offset + channel] * (1 - fx) * (1 - fy) +
        array[i10 * channels + offset + channel] * fx * (1 - fy) +
        array[i01 * channels + offset + channel] * (1 - fx) * fy +
        array[i11 * channels + offset + channel] * fx * fy;
      return channels === 1 ? value(0) : Array.from({ length: channels }, (_, channel) => value(channel));
    };
    const height = blend(heights, 0) as number;
    const landValue = blend(land, 0) as number;
    const material = blend(blendWeights, 0, 4) as number[];
    const ix0 = Math.max(0, ix - 1), ix1 = Math.min(n - 1, ix + 1);
    const iy0 = Math.max(0, iy - 1), iy1 = Math.min(n - 1, iy + 1);
    const slopeX = (heights[iy * n + ix1] - heights[iy * n + ix0]) / Math.max(cell, (ix1 - ix0) * cell);
    const slopeY = (heights[iy1 * n + ix] - heights[iy0 * n + ix]) / Math.max(cell, (iy1 - iy0) * cell);
    return { height, land: landValue, material, slope: Math.hypot(slopeX, slopeY) };
  };

  const rng = seededRandom(p.seed + 2309);
  const props: number[] = [];
  const landAreaHa = (landCount / count) * (p.worldSize * p.worldSize) / 10000;
  const treeSpacing = p.treeDensity > 0 ? Math.max(9, 100 / Math.sqrt(p.treeDensity)) : p.worldSize + 1;
  const rockSpacing = p.rockDensity > 0 ? Math.max(7, 100 / Math.sqrt(p.rockDensity)) : p.worldSize + 1;
  const maxTrees = Math.min(6500, Math.round(landAreaHa * p.treeDensity * 0.65));
  const maxRocks = Math.min(2200, Math.round(landAreaHa * p.rockDensity * 0.5));
  let treesPlaced = 0, rocksPlaced = 0;

  for (let y = -half + treeSpacing * 0.5; y < half && treesPlaced < maxTrees; y += treeSpacing) {
    for (let x = -half + treeSpacing * 0.5; x < half && treesPlaced < maxTrees; x += treeSpacing) {
      const px = x + (rng() - 0.5) * treeSpacing * 0.72;
      const py = y + (rng() - 0.5) * treeSpacing * 0.72;
      const point = sampleGrid(px, py);
      if (point.land < 0.48 || point.height < p.beachHeight * 0.65 || point.slope > 0.8) continue;
      const vegetation = Math.max(0, point.material[1] + point.material[3] * 0.65 + point.material[0] * 0.18);
      const probability = clamp((0.22 + vegetation * 0.9) * (1 - p.dryness * 0.3));
      if (rng() > probability) continue;
      const scale = 0.78 + rng() * 0.72;
      props.push(px, py, point.height, scale, rng() * Math.PI * 2, 0);
      treesPlaced++;
    }
  }

  for (let y = -half + rockSpacing * 0.5; y < half && rocksPlaced < maxRocks; y += rockSpacing) {
    for (let x = -half + rockSpacing * 0.5; x < half && rocksPlaced < maxRocks; x += rockSpacing) {
      const px = x + (rng() - 0.5) * rockSpacing * 0.8;
      const py = y + (rng() - 0.5) * rockSpacing * 0.8;
      const point = sampleGrid(px, py);
      if (point.land < 0.34 || point.height < -1) continue;
      const probability = clamp((point.material[2] * 1.35 + point.material[3] * 0.35 + point.slope * 0.28) * (point.slope < 0.12 ? 0.35 : 1));
      if (rng() > probability) continue;
      const scale = 0.65 + rng() * 1.75;
      props.push(px, py, point.height, scale, rng() * Math.PI * 2, 1);
      rocksPlaced++;
    }
  }

  const grass: number[] = [];
  if (p.grassDensity > 0) {
    const grassSpacing = Math.max(2.2, 5 / Math.sqrt(p.grassDensity));
    for (let y = -half + grassSpacing * 0.5; y < half && grass.length / 4 < 30000; y += grassSpacing) {
      for (let x = -half + grassSpacing * 0.5; x < half && grass.length / 4 < 30000; x += grassSpacing) {
        const px = x + (rng() - 0.5) * grassSpacing * 0.9;
        const py = y + (rng() - 0.5) * grassSpacing * 0.9;
        const point = sampleGrid(px, py);
        if (point.land < 0.5 || point.height < p.beachHeight * 0.8 || point.slope > 1.1 || point.material[1] < 0.14) continue;
        if (rng() > clamp(p.grassDensity * (0.45 + point.material[1] * 0.9))) continue;
        grass.push(px, py, point.height, 0.55 + rng() * 1.25);
      }
    }
  }

  const sampleFinalGrid = (nx: number, ny: number): TerrainSample => {
    const point = sampleGrid(nx * half, ny * half);
    return { height: point.height, land: point.land, coast: point.land, slopeHint: point.slope };
  };

  return {
    n, cell, half, positions, colors, blendWeights, indices: new Uint32Array(indices),
    heights, land, vegetationMask, props: new Float32Array(props), grass: new Float32Array(grass),
    faceTiles: new Uint16Array(faceTiles), faceMaterials: new Uint8Array(faceMaterials),
    landmarks: makeLandmarks(p, sampleFinalGrid), minHeight, maxHeight,
    landRatio: landCount / count, chunkCount: Math.max(1, tileAxis * tileAxis),
  };
}

export function applyBrushInPlace(
  data: TerrainData,
  p: IslandSettings,
  worldX: number,
  worldY: number,
  tool: string,
  radius: number,
  strength: number,
  dt: number,
  layerIndex = 1,
  flattenTarget?: number,
) {
  const gx = Math.round((worldX + data.half) / data.cell);
  const gy = Math.round((worldY + data.half) / data.cell);
  const cells = Math.max(1, Math.ceil(radius / data.cell));
  const safeX = Math.max(0, Math.min(data.n - 1, gx));
  const safeY = Math.max(0, Math.min(data.n - 1, gy));
  const target = flattenTarget ?? data.heights[safeY * data.n + safeX] ?? 0;
  for (let y = Math.max(1, gy - cells); y <= Math.min(data.n - 2, gy + cells); y++) {
    for (let x = Math.max(1, gx - cells); x <= Math.min(data.n - 2, gx + cells); x++) {
      const dx = (x - gx) * data.cell, dy = (y - gy) * data.cell;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const falloff = Math.pow(1 - distance / radius, 2);
      const i = y * data.n + x;
      if (data.land[i] < 0.12) continue;
      if (tool === "raise") data.heights[i] += strength * dt * 28 * falloff;
      else if (tool === "lower") data.heights[i] = Math.max(0, data.heights[i] - strength * dt * 28 * falloff);
      else if (tool === "flatten") data.heights[i] += (target - data.heights[i]) * Math.min(1, strength * dt * 5 * falloff);
      else if (tool === "smooth") {
        const avg = (data.heights[i - 1] + data.heights[i + 1] + data.heights[i - data.n] + data.heights[i + data.n]) * 0.25;
        data.heights[i] += (avg - data.heights[i]) * Math.min(1, strength * dt * 6 * falloff);
      } else if (tool === "paint" || tool === "erase") {
        const offset = i * 4;
        const weight = Math.min(1, strength * dt * 3 * falloff);
        if (tool === "erase") {
          const base = [0.05, 0.72, 0.08, 0.15];
          for (let k = 0; k < 4; k++) data.blendWeights[offset + k] += (base[k] - data.blendWeights[offset + k]) * weight;
        } else {
          for (let k = 0; k < 4; k++) data.blendWeights[offset + k] *= 1 - weight;
          data.blendWeights[offset + Math.max(0, Math.min(3, layerIndex))] += weight;
        }
      } else if (tool === "vegRemove") data.vegetationMask[i] = Math.max(0, data.vegetationMask[i] - strength * dt * 1.8 * falloff);
      else if (tool === "vegAdd") data.vegetationMask[i] = Math.min(1, data.vegetationMask[i] + strength * dt * 1.8 * falloff);

      const h = data.heights[i];
      const l = data.heights[i - 1], r = data.heights[i + 1], d = data.heights[i - data.n], u = data.heights[i + data.n];
      const slope = Math.hypot((r - l) / (2 * data.cell), (u - d) / (2 * data.cell));
      if (tool !== "paint" && tool !== "erase") {
        const weights = computeWeights(h, data.land[i], slope, p);
        data.blendWeights.set(weights, i * 4);
      }
      const color = materialColor([
        data.blendWeights[i * 4], data.blendWeights[i * 4 + 1],
        data.blendWeights[i * 4 + 2], data.blendWeights[i * 4 + 3],
      ], 0, p.layers);
      data.colors.set(color, i * 3);
      data.positions[i * 3 + 2] = h;
    }
  }
}

export function allowedCellSizes(worldSize: number) {
  return (worldSize > 2048 ? [4, 8, 16] : [1, 2, 4]).filter(cell => worldSize / cell + 1 <= 2049 && Number.isInteger(worldSize / cell));
}

export function allowedMeshCells(worldSize: number, cellSize: number) {
  return worldSize <= 2048 ? [cellSize] : [1, 2, 4].filter(cell => cell < cellSize && (cell > 1 || worldSize <= 4096));
}

export function formatWorldSize(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km` : `${meters} m`;
}
