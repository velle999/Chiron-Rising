// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Unit Automation
// AI logic for automated units (formers, scouts, military)
// ═══════════════════════════════════════════════════════════════

import { GameState, Unit, UnitType, Base, getTileResources } from "./gameState";
import { MapTile, Terrain, Moisture, hexKey, hexNeighbors, AxialCoord } from "./hexMap";

// ─── Order Types ─────────────────────────────────────────────

export type UnitOrder =
  | "auto"           // Fully automated (AI decides everything)
  | "auto_former"    // Automated terraforming
  | "auto_scout"     // Automated exploration
  | "auto_patrol"    // Patrol around current area
  | "sentry"         // Hold position until enemy nearby
  | "hold"           // Hold position indefinitely
  | "fortify"        // Fortify in place
  | "terraform"      // Building an improvement (in progress)
  | null;            // No orders — awaiting player input

// ─── Automated Former Logic ──────────────────────────────────

function findNearestBase(state: GameState, q: number, r: number, owner: number): Base | null {
  let best: Base | null = null;
  let bestDist = Infinity;
  for (const [, base] of state.bases) {
    if (base.owner !== owner) continue;
    const dist = hexDistance(q, r, base.q, base.r);
    if (dist < bestDist) {
      bestDist = dist;
      best = base;
    }
  }
  return best;
}

function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs((q1 + r1) - (q2 + r2)));
}

// Decide what improvement to build on a tile
function bestImprovement(tile: MapTile): string | null {
  if (tile.improvement) return null; // already improved
  if (tile.baseId) return null;       // base square
  if (tile.fungus) return null;       // can't build on fungus (for now)
  if (tile.terrain === Terrain.Ocean || tile.terrain === Terrain.DeepOcean || tile.terrain === Terrain.Shelf) return null;

  // Rocky = mine
  if (tile.terrain === Terrain.Mountains || tile.terrain === Terrain.Hills) return "mine";

  // Rainy/moist flat/rolling = farm
  if (tile.moisture === Moisture.Rainy || tile.moisture === Moisture.Moderate) {
    if (tile.terrain === Terrain.Flat || tile.terrain === Terrain.Rolling) return "farm";
  }

  // Arid = forest (best general-purpose for low-resource tiles)
  if (tile.moisture === Moisture.Arid) return "forest";

  // High elevation = solar collector
  if (tile.elevation > 160) return "solar";

  // Default: road if nothing else
  return "road";
}

// Find the best tile to terraform near a base
function findBestTerraformTarget(
  state: GameState,
  unit: Unit
): { q: number; r: number; improvement: string } | null {
  const nearBase = findNearestBase(state, unit.q, unit.r, unit.owner);
  if (!nearBase) return null;

  // Look at tiles in base production radius (2 hex), prioritize unimproved ones
  const candidates: { q: number; r: number; improvement: string; priority: number }[] = [];

  for (let dq = -2; dq <= 2; dq++) {
    for (let dr = Math.max(-2, -dq - 2); dr <= Math.min(2, -dq + 2); dr++) {
      const tq = nearBase.q + dq;
      const tr = nearBase.r + dr;
      const key = hexKey(tq, tr);
      const tile = state.map.tiles.get(key);
      if (!tile) continue;

      const imp = bestImprovement(tile);
      if (!imp) continue;

      // Priority: closer to former = higher, farms > mines > solar > forest > road
      const dist = hexDistance(unit.q, unit.r, tq, tr);
      let priority = 10 - dist;
      if (imp === "farm") priority += 5;
      else if (imp === "mine") priority += 4;
      else if (imp === "solar") priority += 3;
      else if (imp === "forest") priority += 2;

      // Bonus for tiles the base is actually working
      if (nearBase.workedTiles.includes(key)) priority += 3;

      candidates.push({ q: tq, r: tr, improvement: imp, priority });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0];
}

// ─── Automated Scout Logic ───────────────────────────────────

function findExploreTarget(state: GameState, unit: Unit): { q: number; r: number } | null {
  const explored = state.explored.get(unit.owner) || new Set<string>();

  // Look for adjacent unexplored tiles
  const neighbors = hexNeighbors({ q: unit.q, r: unit.r });
  const unexplored = neighbors.filter(n => {
    const key = hexKey(n.q, n.r);
    const tile = state.map.tiles.get(key);
    if (!tile) return false;
    if (tile.terrain === Terrain.Ocean || tile.terrain === Terrain.DeepOcean) return false;
    // Count how many unexplored tiles are near this neighbor
    return !explored.has(key);
  });

  if (unexplored.length > 0) {
    return unexplored[Math.floor(Math.random() * unexplored.length)];
  }

  // No unexplored adjacent — move toward the nearest unexplored area
  // Simple: pick a random walkable neighbor that's farthest from home base
  const walkable = neighbors.filter(n => {
    const tile = state.map.tiles.get(hexKey(n.q, n.r));
    return tile && tile.terrain !== Terrain.Ocean && tile.terrain !== Terrain.DeepOcean
      && tile.terrain !== Terrain.Shelf;
  });

  if (walkable.length > 0) {
    // Prefer directions with more unexplored tiles in a 3-hex cone
    let bestDir: AxialCoord | null = null;
    let bestScore = -1;
    for (const w of walkable) {
      let score = 0;
      const farNeighbors = hexNeighbors(w);
      for (const fn of farNeighbors) {
        if (!explored.has(hexKey(fn.q, fn.r))) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestDir = w;
      }
    }
    return bestDir;
  }

  return null;
}

// ─── Automated Patrol Logic ──────────────────────────────────

function findPatrolTarget(state: GameState, unit: Unit): { q: number; r: number } | null {
  const neighbors = hexNeighbors({ q: unit.q, r: unit.r });
  const walkable = neighbors.filter(n => {
    const tile = state.map.tiles.get(hexKey(n.q, n.r));
    if (!tile) return false;
    if (tile.terrain === Terrain.Ocean || tile.terrain === Terrain.DeepOcean) return false;
    if (tile.terrain === Terrain.Shelf) return false;
    // Don't walk into enemy units
    for (const [, u] of state.units) {
      if (u.q === n.q && u.r === n.r && u.owner !== unit.owner && u.owner !== -1) return false;
    }
    return true;
  });

  // Stay near own bases
  const nearBase = findNearestBase(state, unit.q, unit.r, unit.owner);
  if (!nearBase) return walkable.length > 0 ? walkable[Math.floor(Math.random() * walkable.length)] : null;

  // Prefer tiles within 4 hexes of a base
  const nearbyBase = walkable.filter(n => hexDistance(n.q, n.r, nearBase.q, nearBase.r) <= 4);
  if (nearbyBase.length > 0) {
    return nearbyBase[Math.floor(Math.random() * nearbyBase.length)];
  }

  // Move toward base
  walkable.sort((a, b) =>
    hexDistance(a.q, a.r, nearBase.q, nearBase.r) - hexDistance(b.q, b.r, nearBase.q, nearBase.r)
  );
  return walkable[0] || null;
}

// ─── Sentry Check ────────────────────────────────────────────

function enemyNearby(state: GameState, unit: Unit, range: number): boolean {
  for (const [, other] of state.units) {
    if (other.owner === unit.owner || other.owner === -1) continue;
    if (hexDistance(unit.q, unit.r, other.q, other.r) <= range) return true;
  }
  return false;
}

// ─── Main Automation Processor ───────────────────────────────
// Called during endTurn. Processes all automated units.

export interface AutomationResult {
  units: Map<string, Unit>;
  tiles: Map<string, MapTile>;
  log: string[];
}

export function processAutomatedUnits(state: GameState): AutomationResult {
  const newUnits = new Map(state.units);
  const newTiles = new Map(state.map.tiles);
  const log: string[] = [];

  for (const [id, unit] of newUnits) {
    if (unit.owner < 0) continue;       // skip neutral units
    if (!unit.orders) continue;          // no orders
    if (unit.movesLeft <= 0) continue;   // no moves left

    const order = unit.orders as UnitOrder;

    // ── Sentry: wake up if enemy nearby ──
    if (order === "sentry") {
      if (enemyNearby(state, unit, 2)) {
        newUnits.set(id, { ...unit, orders: null });
        log.push(`${unit.type} at (${unit.q},${unit.r}) alerts: enemy spotted!`);
      }
      continue;
    }

    if (order === "hold" || order === "fortify") continue;

    // ── Automated Former ──
    if (order === "auto_former" || (order === "auto" && unit.type === UnitType.Former)) {
      // Check if current tile needs improvement
      const currentKey = hexKey(unit.q, unit.r);
      const currentTile = newTiles.get(currentKey);

      if (currentTile && !currentTile.improvement && !currentTile.baseId && !currentTile.fungus
          && currentTile.terrain !== Terrain.Ocean && currentTile.terrain !== Terrain.DeepOcean
          && currentTile.terrain !== Terrain.Shelf && currentTile.terrain !== Terrain.Mountains) {
        // Build here
        const imp = bestImprovement(currentTile);
        if (imp) {
          newTiles.set(currentKey, { ...currentTile, improvement: imp });
          newUnits.set(id, { ...unit, movesLeft: 0 });
          log.push(`Auto-Former: ${imp} built at (${unit.q},${unit.r})`);
          continue;
        }
      }

      // Find target and move toward it
      const target = findBestTerraformTarget(
        { ...state, units: newUnits, map: { ...state.map, tiles: newTiles } },
        unit
      );
      if (target) {
        const moved = moveToward(unit, target.q, target.r, state);
        if (moved) {
          newUnits.set(id, { ...moved, orders: unit.orders });
        }
      }
      continue;
    }

    // ── Automated Scout ──
    if (order === "auto_scout" || (order === "auto" && unit.type === UnitType.Scout)) {
      const target = findExploreTarget(
        { ...state, units: newUnits },
        unit
      );
      if (target) {
        const moved = moveToward(unit, target.q, target.r, state);
        if (moved) {
          newUnits.set(id, { ...moved, orders: unit.orders });
        }
      }
      continue;
    }

    // ── Automated Patrol (military) ──
    if (order === "auto_patrol" || (order === "auto" &&
        (unit.type === UnitType.Infantry || unit.type === UnitType.Speeder))) {
      const target = findPatrolTarget(
        { ...state, units: newUnits },
        unit
      );
      if (target) {
        const moved = moveToward(unit, target.q, target.r, state);
        if (moved) {
          newUnits.set(id, { ...moved, orders: unit.orders });
        }
      }
      continue;
    }
  }

  return { units: newUnits, tiles: newTiles, log };
}

// ─── Movement Helper ─────────────────────────────────────────
// Move one step toward target, respecting terrain

function moveToward(unit: Unit, targetQ: number, targetR: number, state: GameState): Unit | null {
  if (unit.movesLeft <= 0) return null;

  const neighbors = hexNeighbors({ q: unit.q, r: unit.r });
  const walkable = neighbors.filter(n => {
    const tile = state.map.tiles.get(hexKey(n.q, n.r));
    if (!tile) return false;
    if (tile.terrain === Terrain.Ocean || tile.terrain === Terrain.DeepOcean) return false;
    if (tile.terrain === Terrain.Shelf) return false;
    // Don't step on enemy units (basic collision)
    for (const [, u] of state.units) {
      if (u.q === n.q && u.r === n.r && u.owner !== unit.owner && u.owner >= 0) return false;
    }
    return true;
  });

  if (walkable.length === 0) return null;

  // Pick the neighbor closest to target
  walkable.sort((a, b) =>
    hexDistance(a.q, a.r, targetQ, targetR) - hexDistance(b.q, b.r, targetQ, targetR)
  );

  const best = walkable[0];

  // Movement cost
  const tile = state.map.tiles.get(hexKey(best.q, best.r));
  const moveCost = (tile && (tile.terrain === Terrain.Hills || tile.terrain === Terrain.Mountains)) ? 2 : 1;

  return {
    ...unit,
    q: best.q,
    r: best.r,
    movesLeft: Math.max(0, unit.movesLeft - moveCost),
  };
}
