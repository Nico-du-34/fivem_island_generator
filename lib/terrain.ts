export type IslandShape =
  | "round" | "long" | "crescent" | "twin" | "archipelago"
  | "atoll" | "volcano" | "continent" | "islands";

export type MaterialLayer = "sand_beach" | "grass_lush" | "rock_cliff" | "dirt_forest";

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
  { id: "sand_beach", label: "Sable de plage", color: "#cbb783" },
  { id: "grass_lush", label: "Herbe tropicale", color: "#608b4d" },
  { id: "rock_cliff", label: "Roche / falaise", color: "#77776f" },
  { id: "dirt_forest", label: "Terre / forêt", color: "#795d42" },
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

function hash2(x: number, y: number, seed: number) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy) * 2 - 1;
}

function fbm(x: number, y: number, seed: number, octaves = 5) {
  let total = 0, amplitude = 0.55, frequency = 1, norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    total += valueNoise(x * frequency, y * frequency, seed + octave * 101) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return total / norm;
}

function ellipseDistance(x: number, y: number, cx: number, cy: number, rx: number, ry = rx) {
  return Math.hypot((x - cx) / rx, (y - cy) / ry);
}

function smoothMax(a: number, b: number, radius: number) {
  if (radius <= 0) return Math.max(a, b);
  const h = clamp(0.5 + 0.5 * (a - b) / radius);
  return b * (1 - h) + a * h + radius * h * (1 - h);
}

type ShapeBlob = { x: number; y: number; rx: number; ry: number };
const shapeBlobCache = new Map<string, ShapeBlob[]>();

function getShapeBlobs(shape: IslandShape, coverage: number, seed: number): ShapeBlob[] {
  const key = `${shape}:${coverage.toFixed(4)}:${seed >>> 0}`;
  const cached = shapeBlobCache.get(key);
  if (cached) return cached;
  const radius = Math.max(0.15, coverage);
  const random = seededRandom(seed ^ (shape === "twin" ? 0x51ed270b : shape === "archipelago" ? 0x2c1b3c6d : 0x6d2b79f5));
  const count = shape === "twin" ? 2 : shape === "archipelago" ? 6 : 9;
  const blobs: ShapeBlob[] = [];
  for (let i = 0; i < count; i++) {
    const angle = shape === "twin" ? (i === 0 ? Math.PI : 0) : random() * Math.PI * 2;
    const radial = shape === "twin" ? radius * 0.34 : radius * (0.16 + random() * (shape === "islands" ? 0.90 : 0.78));
    const size = shape === "twin"
      ? radius * (0.46 + (i === 0 ? 0.04 : -0.02))
      : radius * (shape === "islands" ? 0.13 + random() * 0.16 : i === 0 ? 0.34 + random() * 0.09 : 0.13 + random() * 0.14);
    blobs.push({
      x: Math.cos(angle) * radial,
      y: Math.sin(angle) * radial * (shape === "twin" ? 0.28 : 1),
      rx: size * (0.88 + random() * 0.26),
      ry: size * (0.70 + random() * 0.33),
    });
  }
  if (shapeBlobCache.size > 32) shapeBlobCache.clear();
  shapeBlobCache.set(key, blobs);
  return blobs;
}

function shapeField(shape: IslandShape, x: number, y: number, coverage: number, seed: number) {
  const angle = ((seed >>> 0) % 6283) / 1000;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;
  const radius = Math.max(0.15, coverage);
  const ellipse = (px: number, py: number, cx: number, cy: number, ax: number, ay = ax) =>
    1 - Math.hypot((px - cx) / ax, (py - cy) / ay);
  switch (shape) {
    case "long":
      return 1 - Math.hypot(rx / (radius * 1.38), ry / (radius * 0.56));
    case "crescent": {
      const outer = 1 - Math.hypot(rx, ry) / radius;
      const inner = Math.hypot(rx - radius * 0.50, ry) / (radius * 0.72) - 1;
      return Math.min(outer, inner * 1.35);
    }
    case "twin":
    case "archipelago":
    case "islands": {
      const blobs = getShapeBlobs(shape, coverage, seed);
      let field = -2;
      for (const blob of blobs) {
        field = smoothMax(field, ellipse(x, y, blob.x, blob.y, blob.rx, blob.ry), radius * (shape === "twin" ? 0.035 : 0.045));
      }
      return field;
    }
    case "atoll": {
      const radial = Math.hypot(rx, ry * 1.04);
      const outer = 1 - Math.abs(radial - radius * 0.78) / (radius * 0.22);
      return outer + Math.sin(Math.atan2(ry, rx) * 5 + seed * 0.003) * 0.035;
    }
    case "volcano":
    case "round":
      return 1 - Math.hypot(rx / radius, ry / (radius * 0.92));
    case "continent": {
      const main = 1 - Math.hypot(rx / (radius * 1.12), ry / (radius * 0.98));
      const peninsula = 1 - Math.hypot((rx - radius * 0.56) / (radius * 0.52), (ry + radius * 0.18) / (radius * 0.66));
      return smoothMax(main, peninsula, radius * 0.09);
    }
    default:
      return 1 - Math.hypot(rx / radius, ry / (radius * 0.92));
  }
}

export function sampleTerrain(nx: number, ny: number, p: IslandSettings) {
  const warpScale = p.warp * 0.18;
  const warpX = fbm(nx * 2.1 + 17, ny * 2.1 - 5, p.seed + 11, 3) * warpScale;
  const warpY = fbm(nx * 2.1 - 9, ny * 2.1 + 23, p.seed + 29, 3) * warpScale;
  const x = nx + warpX;
  const y = ny + warpY;
  const baseField = shapeField(p.shape, x, y, p.coverage, p.seed);
  const angle = Math.atan2(y, x);
  const coastNoise =
    fbm(x * 3.2, y * 3.2, p.seed + 37, 3) * 0.11 +
    fbm(x * 10.5, y * 10.5, p.seed + 71, 3) * 0.035 +
    fbm(x * 23, y * 23, p.seed + 109, 2) * 0.009 +
    Math.sin(angle * 7 + p.seed * 0.019) * 0.018;
  const coast = baseField + coastNoise * p.coastNoise;
  const land = smoothstep(-0.045, 0.045, coast);
  const lowFrequency = fbm(x * 1.8 + 2.4, y * 1.8 - 7.2, p.seed + 101, 4) * 0.5 + 0.5;
  const hills = fbm(x * 4.6, y * 4.6, p.seed + 211, 4) * 0.5 + 0.5;
  const detail = fbm(x * 11.5, y * 11.5, p.seed + 313, 3);
  const ridges = Math.pow(1 - Math.abs(fbm(x * 3.6 + 1.7, y * 3.6 - 3.1, p.seed + 419, 4)), 1.65);
  const spine = Math.pow(Math.max(0, 1 - Math.abs(x * 0.52 + y * 0.78 + 0.08) / 0.54), 2)
    * smoothstep(-0.72, 0.08, y);
  let relief = 0.10
    + hills * p.hills * 0.38
    + lowFrequency * p.hills * 0.16
    + (ridges * 0.48 + lowFrequency * 0.20 + spine * 0.34) * p.mountains
    + detail * (0.035 + p.hills * 0.035);
  relief = Math.max(0.025, relief);
  if (p.shape === "volcano") {
    const radial = Math.hypot(x, y);
    const ring = Math.exp(-Math.pow((radial - p.coverage * 0.46) / Math.max(0.07, p.coverage * 0.18), 2));
    const crater = Math.exp(-Math.pow(radial / Math.max(0.05, p.coverage * 0.19), 2));
    relief = 0.07 + ring * (0.80 + p.mountains * 0.55) + hills * p.hills * 0.18 - crater * 0.36;
  } else if (p.shape === "atoll") {
    relief = 0.035 + hills * p.hills * 0.055;
  }
  const innerRelief = smoothstep(0.045, 0.38, coast);
  const beachCrest = p.beachHeight * smoothstep(0.0, 0.095, coast);
  let height = beachCrest + relief * p.maxHeight * Math.pow(innerRelief, 0.82);
  if (p.terraces > 0.001 && height > 1) {
    const steps = 6 + Math.round(p.terraces * 18);
    const stepHeight = Math.max(2, p.maxHeight / steps);
    const stepped = Math.floor(height / stepHeight) * stepHeight;
    height = height * (1 - p.terraces) + stepped * p.terraces;
  }
  const offshore = smoothstep(0.012, 0.52, -coast);
  const shelf = smoothstep(0.012, 0.15, -coast);
  const underwaterNoise = fbm(x * 3.5, y * 3.5, p.seed + 557, 3) * 1.1;
  const seabed = -offshore * p.seaDepth - shelf * underwaterNoise;
  const finalHeight = coast > -0.012 ? Math.max(0, height) : seabed;
  return { height: finalHeight, land, coast, slopeHint: 0 };
}
function computeWeights(height: number, land: number, slope: number, p: IslandSettings) {
  const sand = clamp((1 - smoothstep(p.beachHeight * 0.5, p.beachHeight * 4.2, height)) * (0.45 + land * 0.55));
  const rock = clamp((slope - p.rockSlope) * 3.2 + smoothstep(p.maxHeight * 0.48, p.maxHeight * 0.9, height) * p.mountains * 0.38);
  const dirt = clamp(p.dryness * (0.25 + smoothstep(p.maxHeight * 0.08, p.maxHeight * 0.45, height)) * (1 - rock * 0.5));
  const grass = Math.max(0.001, 1 - sand - rock - dirt);
  const total = sand + grass + rock + dirt;
  return [sand / total, grass / total, rock / total, dirt / total];
}

function materialColor(weights: number[], variation: number) {
  const colors = [
    [0.78, 0.69, 0.48],
    [0.25, 0.42, 0.20],
    [0.42, 0.40, 0.36],
    [0.39, 0.29, 0.18],
  ];
  const out = [0, 0, 0];
  for (let layer = 0; layer < 4; layer++) {
    for (let c = 0; c < 3; c++) out[c] += colors[layer][c] * weights[layer];
  }
  const shade = 0.93 + variation * 0.11;
  return out.map(v => clamp(v * shade));
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

function makeLandmarks(p: IslandSettings): Landmark[] {
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
  return seeds.flatMap(seed => {
    let x = seed.x, y = seed.y, sample = sampleTerrain(x, y, p);
    if (sample.land < 0.32) {
      let found = false;
      for (let radius = 0.04; radius < 0.32 && !found; radius += 0.04) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
          const tx = seed.x + Math.cos(angle) * radius, ty = seed.y + Math.sin(angle) * radius;
          const candidate = sampleTerrain(tx, ty, p);
          if (candidate.land > 0.35) { x = tx; y = ty; sample = candidate; found = true; break; }
        }
      }
    }
    if (sample.land < 0.32) return [];
    return [{ ...seed, x: x * p.worldSize * 0.5, y: y * p.worldSize * 0.5, z: sample.height + 5 }];
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
  let minHeight = Infinity, maxHeight = -Infinity, landCount = 0;

  for (let y = 0; y < n; y++) {
    const ny = (y / (n - 1)) * 2 - 1;
    for (let x = 0; x < n; x++) {
      const nx = (x / (n - 1)) * 2 - 1;
      const idx = y * n + x;
      const sample = sampleTerrain(nx, ny, p);
      heights[idx] = sample.height;
      land[idx] = sample.land;
      if (sample.land > 0.2) landCount++;
      minHeight = Math.min(minHeight, sample.height);
      maxHeight = Math.max(maxHeight, sample.height);
      positions[idx * 3] = nx * half;
      positions[idx * 3 + 1] = ny * half;
      positions[idx * 3 + 2] = sample.height;
    }
  }

  hydraulicErosion(heights, land, n, p.erosion, p.seed);
  thermalErosion(heights, land, n, p.thermal);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const idx = y * n + x;
    const h = heights[idx];
    const left = heights[y * n + Math.max(0, x - 1)];
    const right = heights[y * n + Math.min(n - 1, x + 1)];
    const down = heights[Math.max(0, y - 1) * n + x];
    const up = heights[Math.min(n - 1, y + 1) * n + x];
    const slope = Math.hypot((right - left) / (2 * cell), (up - down) / (2 * cell));
    const weights = computeWeights(h, land[idx], slope, p);
    blendWeights.set(weights, idx * 4);
    const variation = fbm(x / n * 8, y / n * 8, p.seed + 991, 3);
    colors.set(materialColor(weights, variation), idx * 3);
    const inlandGrowth = smoothstep(p.beachHeight * 0.65, p.beachHeight * 3.2, h);
    const slopeLimit = 1 - smoothstep(0.48, 1.25, slope);
    const patch = 0.78 + Math.max(0, variation + 0.5) * 0.22;
    vegetationMask[idx] = clamp(inlandGrowth * slopeLimit * land[idx] * patch);
    positions[idx * 3 + 2] = h;
  }
  minHeight = Infinity;
  maxHeight = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    if (heights[i] < minHeight) minHeight = heights[i];
    if (heights[i] > maxHeight) maxHeight = heights[i];
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
    const weights = [
      (blendWeights[a * 4] + blendWeights[b * 4] + blendWeights[c * 4] + blendWeights[d * 4]) * 0.25,
      (blendWeights[a * 4 + 1] + blendWeights[b * 4 + 1] + blendWeights[c * 4 + 1] + blendWeights[d * 4 + 1]) * 0.25,
      (blendWeights[a * 4 + 2] + blendWeights[b * 4 + 2] + blendWeights[c * 4 + 2] + blendWeights[d * 4 + 2]) * 0.25,
      (blendWeights[a * 4 + 3] + blendWeights[b * 4 + 3] + blendWeights[c * 4 + 3] + blendWeights[d * 4 + 3]) * 0.25,
    ];
    const material = weights.indexOf(Math.max(...weights));
    faceTiles.push(tile, tile);
    faceMaterials.push(material, material);
  }

  const rng = seededRandom(p.seed + 23);
  const landAreaHa = (landCount / count) * (p.worldSize * p.worldSize) / 10000;
  const treeTarget = Math.min(6500, Math.round(landAreaHa * p.treeDensity));
  const rockTarget = Math.min(2200, Math.round(landAreaHa * p.rockDensity));
  const props: number[] = [];
  const propTarget = treeTarget + rockTarget;
  let attempts = 0, treePlaced = 0, rockPlaced = 0;
  while (props.length / 6 < propTarget && attempts < propTarget * 22) {
    attempts++;
    const x = rng() * p.worldSize - half, y = rng() * p.worldSize - half;
    const gx = Math.max(1, Math.min(n - 2, Math.round((x + half) / cell)));
    const gy = Math.max(1, Math.min(n - 2, Math.round((y + half) / cell)));
    const idx = gy * n + gx;
    const h = heights[idx], vegDensity = vegetationMask[idx];
    const dx = (heights[idx + 1] - heights[idx - 1]) / (2 * cell);
    const dy = (heights[idx + n] - heights[idx - n]) / (2 * cell);
    const slope = Math.hypot(dx, dy);
    if (land[idx] < 0.58 || h < p.beachHeight * 1.35) continue;
    const wantsRock = slope > p.rockSlope * 0.75 || vegDensity < 0.25 || rng() > 0.88;
    const isRock = wantsRock && rockPlaced < rockTarget;
    if (isRock) rockPlaced++;
    else {
      if (treePlaced >= treeTarget || vegDensity < 0.2 || slope > 1.05) continue;
      treePlaced++;
    }
    const scale = isRock ? 0.65 + rng() * 1.85 : 0.78 + rng() * 0.72;
    props.push(x, y, h, scale, rng() * Math.PI * 2, isRock ? 1 : 0);
  }

  const grassTarget = Math.min(45000, Math.round(landAreaHa * 10000 * p.grassDensity * 0.14));
  const grass: number[] = [];
  attempts = 0;
  while (grass.length / 4 < grassTarget && attempts < grassTarget * 12) {
    attempts++;
    const x = rng() * p.worldSize - half, y = rng() * p.worldSize - half;
    const gx = Math.max(1, Math.min(n - 2, Math.round((x + half) / cell)));
    const gy = Math.max(1, Math.min(n - 2, Math.round((y + half) / cell)));
    const idx = gy * n + gx;
    if (land[idx] < 0.52 || vegetationMask[idx] < 0.3 || heights[idx] < p.beachHeight * 1.1) continue;
    grass.push(x, y, heights[idx], 0.55 + rng() * 1.25);
  }

  return {
    n, cell, half, positions, colors, blendWeights, indices: new Uint32Array(indices),
    heights, land, vegetationMask, props: new Float32Array(props), grass: new Float32Array(grass),
    faceTiles: new Uint16Array(faceTiles), faceMaterials: new Uint8Array(faceMaterials),
    landmarks: makeLandmarks(p), minHeight, maxHeight, landRatio: landCount / count,
    chunkCount: Math.max(1, tileAxis * tileAxis),
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
  const target = flattenTarget ?? data.heights[gy * data.n + gx] ?? 0;
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
      ], 0);
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
