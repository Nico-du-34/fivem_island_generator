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

function shapeDistance(shape: IslandShape, x: number, y: number, coverage: number) {
  const scale = 0.48 + coverage * 0.52;
  const base = ellipseDistance(x, y, 0, 0, 0.91 * scale, 0.82 * scale);
  switch (shape) {
    case "long":
      return ellipseDistance(x, y, 0, 0, 1.15 * scale, 0.56 * scale);
    case "crescent": {
      const outer = ellipseDistance(x, y, -0.02, 0.02, 1.0 * scale, 0.86 * scale);
      const inner = ellipseDistance(x, y, 0.20, 0.05, 0.79 * scale, 0.73 * scale);
      return Math.max(outer, 1.0 - inner * 0.9);
    }
    case "twin":
      return Math.min(ellipseDistance(x, y, -0.38, 0, 0.58 * scale, 0.72 * scale), ellipseDistance(x, y, 0.40, 0.02, 0.60 * scale, 0.70 * scale));
    case "archipelago": {
      const centers = [[-0.48, 0.15, 0.34], [-0.06, 0.30, 0.32], [0.36, 0.10, 0.38], [0.12, -0.40, 0.33], [-0.52, -0.38, 0.23]];
      return Math.min(...centers.map(([cx, cy, r]) => ellipseDistance(x, y, cx, cy, r * scale, r * scale * 0.82)));
    }
    case "atoll": {
      const d = ellipseDistance(x, y, 0, 0, 0.94 * scale, 0.85 * scale);
      const lagoon = ellipseDistance(x, y, 0.04, -0.01, 0.47 * scale, 0.38 * scale);
      return Math.max(d, 1.0 - lagoon * 0.92);
    }
    case "volcano": {
      const d = ellipseDistance(x, y, 0, 0, 0.84 * scale, 0.82 * scale);
      const crater = ellipseDistance(x, y, 0.04, 0.05, 0.15 * scale, 0.13 * scale);
      return Math.max(d, 1.0 - crater * 0.55);
    }
    case "continent":
      return Math.min(
        ellipseDistance(x, y, -0.12, 0.05, 1.10 * scale, 0.95 * scale),
        ellipseDistance(x, y, 0.46, -0.18, 0.55 * scale, 0.66 * scale),
      ) + Math.max(0, Math.abs(x) - 0.92) * 0.3;
    case "islands": {
      const centers = [[-0.55, 0.42, 0.28], [-0.12, 0.52, 0.28], [0.38, 0.45, 0.32], [-0.45, -0.08, 0.27], [0.02, -0.14, 0.32], [0.55, -0.18, 0.28], [-0.15, -0.60, 0.25], [0.38, -0.58, 0.22]];
      return Math.min(...centers.map(([cx, cy, r]) => ellipseDistance(x, y, cx, cy, r * scale, r * scale * 0.85)));
    }
    default:
      return base;
  }
}

export function sampleTerrain(nx: number, ny: number, p: IslandSettings) {
  const warpX = fbm(nx * 2.2 + 17, ny * 2.2, p.seed + 11) * p.warp * 0.18;
  const warpY = fbm(nx * 2.2, ny * 2.2 - 23, p.seed + 29) * p.warp * 0.18;
  const x = nx + warpX, y = ny + warpY;
  const distance = shapeDistance(p.shape, x, y, p.coverage);
  const angular = Math.atan2(y, x);
  const coastFractal =
    fbm(x * 2.4, y * 2.4, p.seed) * 0.15 +
    fbm(x * 7.5, y * 7.5, p.seed + 37) * 0.045 +
    Math.sin(angular * 7 + p.seed * 0.19) * 0.025;
  const roughness = p.coastNoise * 0.22;
  const coast = distance + coastFractal * roughness;
  const land = clamp(1 - smoothstep(0.88, 1.04, coast));
  const inland = smoothstep(0.02, Math.max(0.08, p.beachWidth), land);

  let mountainField = fbm(x * 1.55, y * 1.55, p.seed + 101) * 0.5 + 0.5;
  let ridge = 1 - Math.abs(fbm(x * 2.4, y * 2.4, p.seed + 211));
  let hills = fbm(x * 4.2, y * 4.2, p.seed + 313) * 0.5 + 0.5;
  const spine = Math.exp(-Math.pow((x * 0.48 + y * 0.8 + 0.08) / 0.42, 2)) * smoothstep(-0.8, 0.1, y);
  const broadRelief = (0.10 + hills * p.hills * 0.55 + (mountainField * 0.28 + ridge * 0.2 + spine * 0.45) * p.mountains);
  let height = Math.max(0, broadRelief) * p.maxHeight * inland;
  if (p.shape === "volcano") {
    const ring = Math.exp(-Math.pow((Math.hypot(x, y) - 0.33) / 0.16, 2));
    const crater = Math.exp(-Math.pow(Math.hypot(x, y) / 0.16, 2));
    height = (0.08 + ring * (0.95 * p.mountains) + hills * p.hills * 0.25 - crater * 0.35) * p.maxHeight * inland;
  }
  if (p.shape === "atoll") {
    height = (0.04 + hills * p.hills * 0.09) * p.maxHeight * inland;
  }
  if (p.terraces > 0.001) {
    const steps = 5 + Math.round(p.terraces * 18);
    const stepped = Math.floor((height / Math.max(1, p.maxHeight)) * steps) / steps;
    height = height * (1 - p.terraces) + stepped * p.maxHeight * p.terraces;
  }
  const beachBand = smoothstep(0, p.beachWidth, land) * smoothstep(p.beachWidth + 0.12, p.beachWidth, land);
  height = Math.max(0, height + beachBand * p.beachHeight * 0.42);
  const seabed = -smoothstep(0.88, 1.35, coast) * p.seaDepth;
  const finalHeight = land > 0.02 ? height : seabed;
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
      vegetationMask[idx] = sample.land > 0.5 && sample.height > p.beachHeight * 2 ? 1 : 0;
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
  while (props.length / 6 < propTarget && attempts < propTarget * 15) {
    attempts++;
    const x = rng() * p.worldSize - half, y = rng() * p.worldSize - half;
    const nx = x / half, ny = y / half;
    const sample = sampleTerrain(nx, ny, p);
    if (sample.land < 0.48 || sample.height < p.beachHeight * 2) continue;
    const isRock = rockPlaced < rockTarget && (treePlaced >= treeTarget || rng() > 0.72);
    if (isRock) rockPlaced++; else treePlaced++;
    const scale = isRock ? 0.6 + rng() * 2 : 0.75 + rng() * 0.75;
    props.push(x, y, sample.height, scale, rng() * Math.PI * 2, isRock ? 1 : 0);
  }

  const grassTarget = Math.min(30000, Math.round(landAreaHa * 10000 * p.grassDensity * 0.22));
  const grass: number[] = [];
  attempts = 0;
  while (grass.length / 4 < grassTarget && attempts < grassTarget * 7) {
    attempts++;
    const x = rng() * p.worldSize - half, y = rng() * p.worldSize - half;
    const sample = sampleTerrain(x / half, y / half, p);
    if (sample.land < 0.5 || sample.height < p.beachHeight * 1.5) continue;
    grass.push(x, y, sample.height, 0.6 + rng() * 1.2);
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
