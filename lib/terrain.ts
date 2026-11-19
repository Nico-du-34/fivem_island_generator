export type IslandSettings = {
  islandName: string;
  seed: number;
  width: number;
  length: number;
  resolution: number;
  tiles: number;
  maxHeight: number;
  coastline: number;
  coastRoughness: number;
  mountainStrength: number;
  mountainWidth: number;
  valleyStrength: number;
  sandWidth: number;
};

export type Landmark = { id: string; label: string; type: "city" | "port" | "airport" | "nature" | "tourism"; x: number; y: number; z: number };

export type TerrainData = {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;
  land: Float32Array;
  faceTiles: Uint16Array;
  faceMaterials: Uint8Array;
  landmarks: Landmark[];
  minHeight: number;
  maxHeight: number;
};

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function hash2(x: number, y: number, seed: number) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
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

function fbm(x: number, y: number, seed: number) {
  let total = 0, amplitude = 0.55, frequency = 1, norm = 0;
  for (let octave = 0; octave < 5; octave++) {
    total += valueNoise(x * frequency, y * frequency, seed + octave * 101) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return total / norm;
}

export function sampleTerrain(nx: number, ny: number, s: IslandSettings) {
  const radial = Math.hypot(nx * 0.91, ny * 1.02);
  const angle = Math.atan2(ny, nx);
  const coastNoise =
    fbm(nx * 2.0, ny * 2.0, s.seed) * 0.11 +
    Math.sin(angle * 5 + s.seed * 0.17) * 0.025 +
    Math.sin(angle * 9 - s.seed * 0.11) * 0.012;
  const southBay = Math.exp(-(((nx + 0.10) / 0.34) ** 2 + ((ny + 0.90) / 0.23) ** 2));
  const eastCove = Math.exp(-(((nx - 0.88) / 0.18) ** 2 + ((ny - 0.08) / 0.34) ** 2));
  const coastRadius = radial + coastNoise * s.coastRoughness + southBay * 0.17 + eastCove * 0.08;
  const land = clamp(1 - smoothstep(s.coastline, 1.0, coastRadius));

  const ridgeAxis = nx * 0.46 + ny * 0.76 + 0.06;
  const ridge = Math.exp(-((ridgeAxis / s.mountainWidth) ** 2)) * smoothstep(-0.78, 0.16, ny);
  const secondaryRidge = Math.exp(-(((nx - 0.48) / 0.25) ** 2 + ((ny - 0.33) / 0.42) ** 2)) * 0.65;
  const valley = Math.exp(-(((nx + 0.17) / 0.34) ** 2 + ((ny - 0.01) / 0.56) ** 2));
  const rolling = fbm(nx * 2.2, ny * 2.2, s.seed + 31) * 0.12 + fbm(nx * 7, ny * 7, s.seed + 71) * 0.035;
  const base = 0.12 + ridge * s.mountainStrength + secondaryRidge * s.mountainStrength * 0.48 + rolling;
  const elevation = Math.max(0, base - valley * s.valleyStrength);
  const coastalFade = smoothstep(0.015, 0.34, land);
  const height = elevation * s.maxHeight * coastalFade;
  return { height, land };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function colorFor(height: number, slope: number, land: number, s: IslandSettings, variation: number) {
  const sand = [0.78, 0.70, 0.50];
  const grass = [0.19, 0.39, 0.20];
  const highGrass = [0.27, 0.43, 0.25];
  const rock = [0.38, 0.37, 0.34];
  const sandMix = clamp((height - 1.5) / Math.max(8, s.sandWidth));
  let color = sand.map((v, i) => mix(v, grass[i], smoothstep(0.18, 0.92, sandMix)));
  const elevationMix = smoothstep(s.maxHeight * 0.35, s.maxHeight * 0.82, height);
  color = color.map((v, i) => mix(v, highGrass[i], elevationMix * 0.6));
  const rockMix = clamp((slope - 0.25) * 1.25 + elevationMix * 0.5);
  color = color.map((v, i) => mix(v, rock[i], rockMix));
  const tint = 0.94 + variation * 0.12;
  return color.map(v => clamp(v * tint));
}

const regionSeeds: Omit<Landmark, "z">[] = [
  { id: "capital", label: "Capital City", type: "city", x: -0.16, y: -0.08 },
  { id: "paradise", label: "Paradise Coast", type: "tourism", x: 0.36, y: -0.34 },
  { id: "green-valley", label: "Green Valley", type: "nature", x: -0.35, y: 0.16 },
  { id: "highland", label: "Highland", type: "nature", x: 0.02, y: 0.54 },
  { id: "industrial-port", label: "Industrial Port", type: "port", x: -0.47, y: -0.29 },
  { id: "airport", label: "International Airport", type: "airport", x: 0.32, y: 0.10 },
  { id: "wild-forest", label: "Wild Forest", type: "nature", x: -0.53, y: 0.45 },
  { id: "eastern-coast", label: "Eastern Coast", type: "tourism", x: 0.58, y: 0.02 },
];

export function generateIsland(s: IslandSettings): TerrainData {
  const n = s.resolution;
  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  const heights = new Float32Array(n * n);
  const land = new Float32Array(n * n);
  let minHeight = Number.POSITIVE_INFINITY, maxHeight = 0;

  for (let y = 0; y < n; y++) {
    const ny = (y / (n - 1)) * 2 - 1;
    for (let x = 0; x < n; x++) {
      const nx = (x / (n - 1)) * 2 - 1;
      const idx = y * n + x;
      const sample = sampleTerrain(nx, ny, s);
      heights[idx] = sample.height;
      land[idx] = sample.land;
      minHeight = Math.min(minHeight, sample.height);
      maxHeight = Math.max(maxHeight, sample.height);
      positions[idx * 3] = nx * s.width * 0.5;
      positions[idx * 3 + 1] = ny * s.length * 0.5;
      positions[idx * 3 + 2] = sample.height;
    }
  }

  const indices: number[] = [];
  const faceTiles: number[] = [];
  const faceMaterials: number[] = [];
  const tileCount = Math.max(1, s.tiles);
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const a = y * n + x, b = a + 1, c = a + n, d = c + 1;
      const averageLand = (land[a] + land[b] + land[c] + land[d]) * 0.25;
      if (averageLand < 0.025) continue;
      const xNorm = x / (n - 1), yNorm = y / (n - 1);
      const tileX = Math.min(tileCount - 1, Math.floor(xNorm * tileCount));
      const tileY = Math.min(tileCount - 1, Math.floor(yNorm * tileCount));
      const tile = tileY * tileCount + tileX;
      const avgH = (heights[a] + heights[b] + heights[c] + heights[d]) * 0.25;
      const gx = (heights[b] - heights[a]) / Math.max(1, s.width / n);
      const gy = (heights[c] - heights[a]) / Math.max(1, s.length / n);
      const slope = Math.hypot(gx, gy);
      const material = averageLand < 0.70 || avgH < s.sandWidth ? 0 : slope > 0.48 ? 2 : 1;
      indices.push(a, c, b, b, c, d);
      faceTiles.push(tile, tile);
      faceMaterials.push(material, material);
    }
  }

  // Vertex gradients provide convincing sand/grass/rock color bands in the live preview.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const idx = y * n + x;
      const left = heights[y * n + Math.max(0, x - 1)];
      const right = heights[y * n + Math.min(n - 1, x + 1)];
      const down = heights[Math.max(0, y - 1) * n + x];
      const up = heights[Math.min(n - 1, y + 1) * n + x];
      const slope = Math.hypot((right - left) / Math.max(1, (s.width / n) * 2), (up - down) / Math.max(1, (s.length / n) * 2));
      const variation = fbm(x / n * 8, y / n * 8, s.seed + 991);
      const color = colorFor(heights[idx], slope, land[idx], s, variation);
      colors.set(color, idx * 3);
    }
  }

  const landmarks: Landmark[] = regionSeeds.flatMap(seed => {
    let nx = seed.x, ny = seed.y;
    let sample = sampleTerrain(nx, ny, s);
    if (sample.land < 0.30) {
      let found = false;
      for (let r = 0.04; r <= 0.30 && !found; r += 0.04) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          const tx = seed.x + Math.cos(a) * r, ty = seed.y + Math.sin(a) * r;
          const candidate = sampleTerrain(tx, ty, s);
          if (candidate.land > 0.35) { nx = tx; ny = ty; sample = candidate; found = true; break; }
        }
      }
    }
    if (sample.land < 0.30) return [];
    return [{ ...seed, x: nx * s.width * 0.5, y: ny * s.length * 0.5, z: sample.height + 5 }];
  });

  return {
    positions, colors, indices: new Uint32Array(indices), heights, land,
    faceTiles: new Uint16Array(faceTiles), faceMaterials: new Uint8Array(faceMaterials),
    landmarks, minHeight, maxHeight,
  };
}

export const DEFAULT_SETTINGS: IslandSettings = {
  islandName: "Tropical Island",
  seed: 42819,
  width: 8500,
  length: 8500,
  resolution: 257,
  tiles: 4,
  maxHeight: 850,
  coastline: 0.69,
  coastRoughness: 0.70,
  mountainStrength: 0.88,
  mountainWidth: 0.30,
  valleyStrength: 0.22,
  sandWidth: 24,
};
