// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Hex Grid & Map Generation Engine
// ═══════════════════════════════════════════════════════════════

// ─── Hex Coordinate System (Axial / Cube) ────────────────────

export interface AxialCoord {
  q: number; // column
  r: number; // row
}

export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

export function axialToCube(hex: AxialCoord): CubeCoord {
  return { q: hex.q, r: hex.r, s: -hex.q - hex.r };
}

export function cubeToAxial(cube: CubeCoord): AxialCoord {
  return { q: cube.q, r: cube.r };
}

export function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(Math.abs(ac.q - bc.q), Math.abs(ac.r - bc.r), Math.abs(ac.s - bc.s));
}

export function hexNeighbors(hex: AxialCoord): AxialCoord[] {
  const directions = [
    { q: 1, r: 0 },  { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  ];
  return directions.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function parseHexKey(key: string): AxialCoord {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

// ─── Pixel Conversion (pointy-top hexagons) ─────────────────

export function hexToPixel(hex: AxialCoord, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
  const y = size * ((3 / 2) * hex.r);
  return { x, y };
}

export function pixelToHex(x: number, y: number, size: number): AxialCoord {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return hexRound(q, r);
}

function hexRound(q: number, r: number): AxialCoord {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;

  return { q: rq, r: rr };
}

export function hexCorners(center: { x: number; y: number }, size: number): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }
  return corners;
}

// ─── Terrain Types ───────────────────────────────────────────

export enum Terrain {
  DeepOcean = "deep_ocean",
  Ocean = "ocean",
  Shelf = "shelf",
  Flat = "flat",
  Rolling = "rolling",
  Hills = "hills",
  Mountains = "mountains",
  Fungus = "fungus",
}

export enum Moisture {
  Arid = "arid",
  Moderate = "moderate",
  Rainy = "rainy",
}

export interface MapTile {
  q: number;
  r: number;
  terrain: Terrain;
  moisture: Moisture;
  elevation: number;     // 0-255
  rainfall: number;      // 0-255
  temperature: number;   // 0-255
  fungus: boolean;
  river: boolean;
  road: boolean;         // road/mag tube (separate from improvement)
  bonus: boolean;        // resource bonus square
  improvement: string | null;
  owner: number | null;  // faction index
  baseId: string | null;
  supplyPod: boolean;    // Unity supply pod (exploration reward)
}

// ─── Noise Generator (Simplex-like) ─────────────────────────

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    return (this.seed >>> 0) / 0xffffffff;
  }

  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }
}

// Simple value noise with interpolation
function valueNoise2D(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smooth interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  function hash(px: number, py: number): number {
    let h = ((px * 374761393 + py * 668265263 + seed) & 0xffffffff) >>> 0;
    h = (((h ^ (h >> 13)) * 1274126177) & 0xffffffff) >>> 0;
    return (h >>> 0) / 0xffffffff;
  }

  const n00 = hash(ix, iy);
  const n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1);
  const n11 = hash(ix + 1, iy + 1);

  const nx0 = n00 + sx * (n10 - n00);
  const nx1 = n01 + sx * (n11 - n01);

  return nx0 + sy * (nx1 - nx0);
}

function fractalNoise(x: number, y: number, seed: number, octaves: number, persistence: number, scale: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += valueNoise2D(x * frequency, y * frequency, seed + i * 100) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return value / maxValue;
}

// ─── Map Generator ───────────────────────────────────────────

export interface MapConfig {
  width: number;
  height: number;
  seed: number;
  oceanPercent: number;  // 0.0 - 1.0
  hillsFrequency: number;
  fungusPercent: number;
  riverCount: number;
}

export const DEFAULT_MAP_CONFIG: MapConfig = {
  width: 48,
  height: 32,
  seed: Date.now(),
  oceanPercent: 0.45,
  hillsFrequency: 0.35,
  fungusPercent: 0.15,
  riverCount: 8,
};

export interface GameMap {
  width: number;
  height: number;
  tiles: Map<string, MapTile>;
  seed: number;
}

export function generateMap(config: MapConfig = DEFAULT_MAP_CONFIG): GameMap {
  const rng = new SeededRandom(config.seed);
  const tiles = new Map<string, MapTile>();

  // Pass 1: Generate elevation using fractal noise
  const elevations: Map<string, number> = new Map();
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let r = 0; r < config.height; r++) {
    for (let q = 0; q < config.width; q++) {
      // Offset for pointy-top hex grid wrapping
      const nx = q / config.width;
      const ny = r / config.height;

      let elev = fractalNoise(nx, ny, config.seed, 6, 0.55, 4.0);

      // Add continent-scale features
      elev += fractalNoise(nx, ny, config.seed + 500, 3, 0.4, 1.5) * 0.5;

      // Edge fade for ocean borders (optional — creates island-ish maps)
      const edgeX = Math.min(q, config.width - q) / (config.width * 0.15);
      const edgeY = Math.min(r, config.height - r) / (config.height * 0.15);
      const edgeFade = Math.min(1, Math.min(edgeX, edgeY));
      elev *= 0.3 + 0.7 * edgeFade;

      elevations.set(hexKey(q, r), elev);
      minElev = Math.min(minElev, elev);
      maxElev = Math.max(maxElev, elev);
    }
  }

  // Normalize elevations to 0-255
  const elevRange = maxElev - minElev || 1;
  for (const [key, val] of elevations) {
    elevations.set(key, ((val - minElev) / elevRange) * 255);
  }

  // Find ocean threshold
  const allElevs = Array.from(elevations.values()).sort((a, b) => a - b);
  const oceanThreshold = allElevs[Math.floor(allElevs.length * config.oceanPercent)];

  // Pass 2: Generate rainfall and temperature
  for (let r = 0; r < config.height; r++) {
    for (let q = 0; q < config.width; q++) {
      const key = hexKey(q, r);
      const elev = elevations.get(key) || 0;

      // Rainfall: based on noise + latitude bands
      const latitudeFactor = 1 - Math.abs((r / config.height) * 2 - 1);
      let rainfall = fractalNoise(
        q / config.width, r / config.height,
        config.seed + 1000, 4, 0.5, 3.0
      );
      rainfall = rainfall * 0.6 + latitudeFactor * 0.4;
      rainfall = Math.max(0, Math.min(1, rainfall)) * 255;

      // Temperature: latitude-based with altitude cooling
      let temp = 1 - Math.abs((r / config.height) * 2 - 1) * 0.8;
      temp -= Math.max(0, (elev - oceanThreshold) / 255) * 0.3;
      temp += fractalNoise(q / config.width, r / config.height, config.seed + 2000, 3, 0.4, 2.0) * 0.15;
      temp = Math.max(0, Math.min(1, temp)) * 255;

      // Determine terrain type
      let terrain: Terrain;
      if (elev < oceanThreshold * 0.5) {
        terrain = Terrain.DeepOcean;
      } else if (elev < oceanThreshold * 0.8) {
        terrain = Terrain.Ocean;
      } else if (elev < oceanThreshold) {
        terrain = Terrain.Shelf;
      } else if (elev > oceanThreshold + (255 - oceanThreshold) * 0.85) {
        terrain = Terrain.Mountains;
      } else if (elev > oceanThreshold + (255 - oceanThreshold) * 0.65) {
        terrain = Terrain.Hills;
      } else if (elev > oceanThreshold + (255 - oceanThreshold) * 0.4) {
        terrain = Terrain.Rolling;
      } else {
        terrain = Terrain.Flat;
      }

      // Moisture
      let moisture: Moisture;
      if (rainfall < 85) moisture = Moisture.Arid;
      else if (rainfall < 170) moisture = Moisture.Moderate;
      else moisture = Moisture.Rainy;

      // Fungus placement
      const fungusNoise = fractalNoise(
        q / config.width, r / config.height,
        config.seed + 3000, 3, 0.6, 5.0
      );
      const isFungus = terrain !== Terrain.DeepOcean &&
                        terrain !== Terrain.Ocean &&
                        terrain !== Terrain.Mountains &&
                        fungusNoise > (1 - config.fungusPercent) &&
                        rng.next() > 0.3;

      // Bonus resource squares
      const isBonus = rng.next() < 0.08 &&
                      terrain !== Terrain.DeepOcean &&
                      terrain !== Terrain.Ocean;

      tiles.set(key, {
        q, r,
        terrain,
        moisture,
        elevation: Math.round(elev),
        rainfall: Math.round(rainfall),
        temperature: Math.round(temp),
        fungus: isFungus,
        river: false,
        road: false,
        bonus: isBonus,
        improvement: null,
        owner: null,
        baseId: null,
        supplyPod: false,
      });
    }
  }

  // Pass 3: Rivers (flow downhill from high points)
  for (let i = 0; i < config.riverCount; i++) {
    // Find a random high-elevation land tile
    let startQ = rng.nextInt(0, config.width - 1);
    let startR = rng.nextInt(0, config.height - 1);
    let startTile = tiles.get(hexKey(startQ, startR));

    // Try to find a hill/mountain start
    for (let attempt = 0; attempt < 50; attempt++) {
      startQ = rng.nextInt(0, config.width - 1);
      startR = rng.nextInt(0, config.height - 1);
      startTile = tiles.get(hexKey(startQ, startR));
      if (startTile && (startTile.terrain === Terrain.Hills || startTile.terrain === Terrain.Mountains)) {
        break;
      }
    }

    if (!startTile) continue;

    // Flow downhill
    let current = { q: startQ, r: startR };
    for (let step = 0; step < 30; step++) {
      const tile = tiles.get(hexKey(current.q, current.r));
      if (!tile) break;

      tile.river = true;

      // Find lowest neighbor
      const neighbors = hexNeighbors(current).filter(
        n => n.q >= 0 && n.q < config.width && n.r >= 0 && n.r < config.height
      );

      let lowestNeighbor: AxialCoord | null = null;
      let lowestElev = tile.elevation;

      for (const n of neighbors) {
        const nt = tiles.get(hexKey(n.q, n.r));
        if (nt && nt.elevation < lowestElev) {
          lowestElev = nt.elevation;
          lowestNeighbor = n;
        }
      }

      if (!lowestNeighbor) break;
      current = lowestNeighbor;

      // Stop at ocean
      const nextTile = tiles.get(hexKey(current.q, current.r));
      if (nextTile && (nextTile.terrain === Terrain.Ocean || nextTile.terrain === Terrain.DeepOcean)) {
        break;
      }
    }
  }

  // Pass 4: Scatter supply pods (Unity wreckage)
  const podCount = Math.floor(config.width * config.height * 0.015); // ~1.5% of land tiles
  let podsPlaced = 0;
  for (let attempt = 0; attempt < podCount * 5 && podsPlaced < podCount; attempt++) {
    const pq = rng.nextInt(0, config.width - 1);
    const pr = rng.nextInt(0, config.height - 1);
    const pk = hexKey(pq, pr);
    const pt = tiles.get(pk);
    if (pt && pt.terrain !== Terrain.Ocean && pt.terrain !== Terrain.DeepOcean && !pt.bonus && !pt.supplyPod) {
      tiles.set(pk, { ...pt, supplyPod: true });
      podsPlaced++;
    }
  }

  return { width: config.width, height: config.height, tiles, seed: config.seed };
}

// ─── Terrain Colors ──────────────────────────────────────────

export function getTerrainColor(tile: MapTile): string {
  if (tile.fungus) {
    return "#8B2252"; // Xenofungus — deep magenta/crimson
  }

  switch (tile.terrain) {
    case Terrain.DeepOcean:
      return "#0a1628";
    case Terrain.Ocean:
      return "#0f2847";
    case Terrain.Shelf:
      return "#1a3d5c";
    case Terrain.Flat:
      if (tile.moisture === Moisture.Rainy) return "#2d5a1e";
      if (tile.moisture === Moisture.Moderate) return "#4a7a2e";
      return "#8a9a3e"; // arid
    case Terrain.Rolling:
      if (tile.moisture === Moisture.Rainy) return "#3a6b28";
      if (tile.moisture === Moisture.Moderate) return "#5a8438";
      return "#9aaa48";
    case Terrain.Hills:
      return "#7a7a5a";
    case Terrain.Mountains:
      return "#a0a0a0";
    default:
      return "#333333";
  }
}

export function getTerrainAccentColor(tile: MapTile): string {
  if (tile.river) return "#2288cc";
  if (tile.bonus) return "#ffcc00";
  return "transparent";
}
