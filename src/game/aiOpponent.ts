// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — AI Opponent System
// Decision-making for non-human factions
// ═══════════════════════════════════════════════════════════════

import { GameState, Unit, UnitType, Base, getAvailableBuilds } from "./gameState";
import { MapTile, Terrain, Moisture, hexKey, hexNeighbors, AxialCoord } from "./hexMap";
import { FACTION_BONUSES, getAvailableChoices, SocialEngineering } from "./socialEngineering";

// ─── AI Base Names ───────────────────────────────────────────

const AI_BASE_NAMES = [
  "New Settlement", "Outpost Alpha", "Forward Base", "Colony Prime",
  "Settlement Beta", "Bastion", "Frontier Post", "Citadel",
  "Stronghold", "Nexus", "Hub", "Enclave", "Depot",
  "Vanguard Post", "Staging Ground", "Watchtower", "Haven",
  "Refuge", "Command Post", "Territory Mark",
];
let aiBaseNameIdx = 0;

function getAIBaseName(factionName: string): string {
  const name = `${factionName} ${AI_BASE_NAMES[aiBaseNameIdx % AI_BASE_NAMES.length]}`;
  aiBaseNameIdx++;
  return name;
}

// ─── Utility: hex distance ───────────────────────────────────

function hexDist(q1: number, r1: number, q2: number, r2: number): number {
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs((q1 + r1) - (q2 + r2)));
}

// ─── AI Turn Processing ──────────────────────────────────────
// Called once per turn for each AI faction. Modifies state in place via returned state.

export interface AITurnResult {
  units: Map<string, Unit>;
  bases: Map<string, Base>;
  tiles: Map<string, MapTile>;
  factions: any[];
  log: string[];
}

export function processAITurn(state: GameState, factionId: number): AITurnResult {
  const faction = state.factions[factionId];
  if (!faction || faction.isHuman) {
    return {
      units: state.units,
      bases: state.bases,
      tiles: state.map.tiles,
      factions: state.factions,
      log: [],
    };
  }

  const newUnits = new Map(state.units);
  const newBases = new Map(state.bases);
  const newTiles = new Map(state.map.tiles);
  let newFactions = [...state.factions];
  const log: string[] = [];

  // ── 1. Colony Pod AI: Find good locations and found bases ──
  const colonyPods = Array.from(newUnits.values())
    .filter(u => u.owner === factionId && u.type === UnitType.Colony);

  for (const pod of colonyPods) {
    const currentKey = hexKey(pod.q, pod.r);
    const currentTile = newTiles.get(currentKey);

    // Check if current location is good for a base
    if (currentTile && !currentTile.baseId && isGoodBaseLocation(pod.q, pod.r, newTiles, newBases, factionId, state.map.width, state.map.height)) {
      // Found base here
      const baseName = getAIBaseName(faction.name.split(" ").pop() || "AI");
      const result = foundBaseInternal(newUnits, newBases, newTiles, pod.id, baseName, factionId);
      if (result) {
        log.push(`${faction.name} founds ${baseName}!`);
      }
    } else if (pod.movesLeft > 0) {
      // Move toward a good base location
      const target = findGoodBaseSpot(pod, newTiles, newBases, factionId, state.map.width, state.map.height);
      if (target) {
        const moved = moveUnitToward(pod, target.q, target.r, newTiles, newUnits);
        if (moved) {
          newUnits.set(pod.id, moved);
        }
      }
    }
  }

  // ── 2. Former AI: Terraform around bases ──
  const formers = Array.from(newUnits.values())
    .filter(u => u.owner === factionId && u.type === UnitType.Former && u.movesLeft > 0);

  for (const former of formers) {
    // Set to auto if not already
    if (!former.orders) {
      newUnits.set(former.id, { ...former, orders: "auto_former" });
    }
  }

  // ── 3. Scout AI: Explore ──
  const scouts = Array.from(newUnits.values())
    .filter(u => u.owner === factionId && u.type === UnitType.Scout && u.movesLeft > 0);

  for (const scout of scouts) {
    if (!scout.orders) {
      newUnits.set(scout.id, { ...scout, orders: "auto_scout" });
    }
  }

  // ── 4. Military AI: Move toward threats or patrol ──
  const military = Array.from(newUnits.values())
    .filter(u => u.owner === factionId &&
      (u.type === UnitType.Infantry || u.type === UnitType.Speeder) &&
      u.movesLeft > 0 && !u.orders);

  for (const unit of military) {
    // Check for nearby enemies
    const nearestEnemy = findNearestEnemy(unit, newUnits, factionId);

    if (nearestEnemy && hexDist(unit.q, unit.r, nearestEnemy.q, nearestEnemy.r) <= 6) {
      // Move toward enemy
      const moved = moveUnitToward(unit, nearestEnemy.q, nearestEnemy.r, newTiles, newUnits);
      if (moved) {
        newUnits.set(unit.id, moved);
      }
    } else {
      // Set to patrol
      newUnits.set(unit.id, { ...unit, orders: "auto_patrol" });
    }
  }

  // ── 5. Base Production AI: Choose what to build ──
  const aiBases = Array.from(newBases.values()).filter(b => b.owner === factionId);

  for (const base of aiBases) {
    if (!base.currentBuild) {
      const buildKey = chooseAIProduction(base, newUnits, newBases, faction, state);
      if (buildKey) {
        newBases.set(base.id, { ...base, currentBuild: buildKey, buildProgress: base.buildProgress });
      }
    }
  }

  // ── 6. Social Engineering AI: Pick based on faction agenda ──
  const bonuses = FACTION_BONUSES[faction.key];
  if (bonuses && state.turn % 20 === 0) {
    // Periodically reconsider SE choices
    const newSE = chooseAISocialEngineering(faction, bonuses);
    newFactions = newFactions.map((f, i) =>
      i === factionId ? { ...f, socialEngineering: newSE } : f
    );
  }

  return { units: newUnits, bases: newBases, tiles: newTiles, factions: newFactions, log };
}

// ─── Base Location Scoring ───────────────────────────────────

function isGoodBaseLocation(
  q: number, r: number,
  tiles: Map<string, MapTile>,
  bases: Map<string, Base>,
  factionId: number,
  mapW: number, mapH: number
): boolean {
  const tile = tiles.get(hexKey(q, r));
  if (!tile) return false;
  if (tile.terrain === Terrain.Ocean || tile.terrain === Terrain.DeepOcean ||
      tile.terrain === Terrain.Shelf || tile.terrain === Terrain.Mountains) return false;
  if (tile.baseId) return false;

  // Must be at least 3 hexes from any existing base
  for (const [, base] of bases) {
    if (hexDist(q, r, base.q, base.r) < 3) return false;
  }

  // Score surrounding tiles — need decent resources
  let score = 0;
  const neighbors = hexNeighbors({ q, r });
  for (const n of neighbors) {
    const nt = tiles.get(hexKey(n.q, n.r));
    if (!nt) continue;
    if (nt.terrain === Terrain.Flat && nt.moisture === Moisture.Rainy) score += 3;
    else if (nt.terrain === Terrain.Flat && nt.moisture === Moisture.Moderate) score += 2;
    else if (nt.terrain === Terrain.Rolling) score += 2;
    else if (nt.terrain === Terrain.Hills) score += 2;
    if (nt.river) score += 2;
    if (nt.bonus) score += 3;
  }

  return score >= 6; // Minimum quality threshold
}

function findGoodBaseSpot(
  pod: Unit,
  tiles: Map<string, MapTile>,
  bases: Map<string, Base>,
  factionId: number,
  mapW: number, mapH: number
): AxialCoord | null {
  // Search in expanding rings for a good spot
  let bestSpot: AxialCoord | null = null;
  let bestScore = -1;

  for (let radius = 1; radius <= 8; radius++) {
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
        if (Math.abs(dq) !== radius && Math.abs(dr) !== radius && Math.abs(dq + dr) !== radius) continue;
        const tq = pod.q + dq;
        const tr = pod.r + dr;

        if (tq < 0 || tq >= mapW || tr < 0 || tr >= mapH) continue;
        if (!isGoodBaseLocation(tq, tr, tiles, bases, factionId, mapW, mapH)) continue;

        // Prefer closer spots
        const dist = hexDist(pod.q, pod.r, tq, tr);
        const score = 20 - dist;
        if (score > bestScore) {
          bestScore = score;
          bestSpot = { q: tq, r: tr };
        }
      }
    }
    if (bestSpot) break; // Found something at this radius
  }

  return bestSpot;
}

// ─── AI Production Choice ────────────────────────────────────

function chooseAIProduction(
  base: Base,
  units: Map<string, Unit>,
  bases: Map<string, Base>,
  faction: any,
  state: GameState
): string | null {
  const available = getAvailableBuilds(base, faction.discoveredTechs);
  if (available.length === 0) return "unit_scout";

  // Count our units and bases
  const ourUnits = Array.from(units.values()).filter(u => u.owner === faction.id);
  const ourBases = Array.from(bases.values()).filter(b => b.owner === faction.id);
  const numFormers = ourUnits.filter(u => u.type === UnitType.Former).length;
  const numScouts = ourUnits.filter(u => u.type === UnitType.Scout).length;
  const numMilitary = ourUnits.filter(u => u.type === UnitType.Infantry || u.type === UnitType.Speeder).length;
  const numColonies = ourUnits.filter(u => u.type === UnitType.Colony).length;

  // Priority scoring
  const scores: { key: string; score: number }[] = [];

  for (const item of available) {
    let score = 0;

    // Colony pods: want to expand, cap at 2 in production
    if (item.key === "unit_colony") {
      if (numColonies < 2 && ourBases.length < 6) score = 30;
      else score = 5;
    }
    // Formers: 1 per base
    else if (item.key === "unit_former") {
      if (numFormers < ourBases.length) score = 25;
      else score = 3;
    }
    // Scouts: keep 2-3
    else if (item.key === "unit_scout") {
      if (numScouts < 2) score = 15;
      else score = 2;
    }
    // Military: want at least 1 per base for defense
    else if (item.key === "unit_infantry" || item.key === "unit_speeder") {
      if (numMilitary < ourBases.length) score = 20;
      else if (numMilitary < ourBases.length * 2) score = 10;
      else score = 5;
    }
    // Facilities: score by value
    else if (item.category === "facility") {
      if (item.key === "recycling_tanks" && !base.facilities.includes("recycling_tanks")) score = 22;
      else if (item.key === "network_node" && !base.facilities.includes("network_node")) score = 18;
      else if (item.key === "perimeter_defense" && !base.facilities.includes("perimeter_defense")) score = 15;
      else if (item.key === "recreation_commons") score = 12;
      else if (item.key === "energy_bank") score = 10;
      else if (item.key === "children_creche") score = 8;
      else if (item.key === "command_center") score = 7;
      else score = 5;
    }

    if (score > 0) scores.push({ key: item.key, score });
  }

  if (scores.length === 0) return "unit_scout";

  // Weight by score with some randomness
  scores.sort((a, b) => b.score - a.score);

  // Top pick gets 60% chance, second 25%, random 15%
  const roll = Math.random();
  if (roll < 0.6 || scores.length === 1) return scores[0].key;
  if (roll < 0.85 && scores.length >= 2) return scores[1].key;
  return scores[Math.floor(Math.random() * Math.min(scores.length, 4))].key;
}

// ─── AI Social Engineering ───────────────────────────────────

function chooseAISocialEngineering(faction: any, bonuses: any): SocialEngineering {
  const se: SocialEngineering = {
    politics: "frontier",
    economics: "simple",
    values: "survival",
    future: "none",
  };

  // Try to adopt agenda
  const categories: Array<keyof SocialEngineering> = ["politics", "economics", "values", "future"];
  for (const cat of categories) {
    const choices = getAvailableChoices(cat, faction.discoveredTechs, faction.key);
    // Try agenda first
    const agenda = choices.find(c => c.key === bonuses.agenda);
    if (agenda) {
      se[cat] = agenda.key;
    } else {
      // Pick the non-default choice if available
      const nonDefault = choices.filter(c => c.requiresTech !== null);
      if (nonDefault.length > 0) {
        se[cat] = nonDefault[Math.floor(Math.random() * nonDefault.length)].key;
      }
    }
  }

  return se;
}

// ─── Internal Base Founding ──────────────────────────────────
// Direct mutation version for AI use (avoids full state copy overhead)

function foundBaseInternal(
  units: Map<string, Unit>,
  bases: Map<string, Base>,
  tiles: Map<string, MapTile>,
  unitId: string,
  name: string,
  factionId: number
): boolean {
  const unit = units.get(unitId);
  if (!unit || unit.type !== UnitType.Colony) return false;

  const key = hexKey(unit.q, unit.r);
  const tile = tiles.get(key);
  if (!tile || tile.baseId) return false;

  // Generate base ID
  const baseId = `base_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const base: Base = {
    id: baseId,
    name,
    q: unit.q,
    r: unit.r,
    owner: factionId,
    population: 1,
    storedNutrients: 0,
    storedMinerals: 0,
    facilities: [],
    productionQueue: [],
    currentBuild: "unit_scout",
    buildProgress: 0,
    workedTiles: [key],
  };

  bases.set(baseId, base);
  units.delete(unitId);

  // Update tile
  tiles.set(key, { ...tile, baseId, owner: factionId });

  // Claim surrounding tiles
  for (const n of hexNeighbors({ q: unit.q, r: unit.r })) {
    const nk = hexKey(n.q, n.r);
    const nt = tiles.get(nk);
    if (nt && nt.owner === null) {
      tiles.set(nk, { ...nt, owner: factionId });
    }
  }

  return true;
}

// ─── Movement Helper ─────────────────────────────────────────

function moveUnitToward(
  unit: Unit,
  targetQ: number, targetR: number,
  tiles: Map<string, MapTile>,
  units: Map<string, Unit>
): Unit | null {
  if (unit.movesLeft <= 0) return null;

  const neighbors = hexNeighbors({ q: unit.q, r: unit.r });
  const walkable = neighbors.filter(n => {
    const tile = tiles.get(hexKey(n.q, n.r));
    if (!tile) return false;
    if (tile.terrain === Terrain.Ocean || tile.terrain === Terrain.DeepOcean) return false;
    if (tile.terrain === Terrain.Shelf) return false;
    if (tile.terrain === Terrain.Mountains && unit.type !== UnitType.Scout) return false;
    // Don't step on other units
    for (const [, u] of units) {
      if (u.q === n.q && u.r === n.r && u.id !== unit.id) return false;
    }
    return true;
  });

  if (walkable.length === 0) return null;

  // Sort by distance to target, prefer roads
  walkable.sort((a, b) => {
    const aTile = tiles.get(hexKey(a.q, a.r));
    const bTile = tiles.get(hexKey(b.q, b.r));
    const aDist = hexDist(a.q, a.r, targetQ, targetR) + (aTile?.road ? -0.5 : 0);
    const bDist = hexDist(b.q, b.r, targetQ, targetR) + (bTile?.road ? -0.5 : 0);
    return aDist - bDist;
  });

  const best = walkable[0];
  const tile = tiles.get(hexKey(best.q, best.r));
  let moveCost = 1;
  if (tile?.road) moveCost = 0;
  else if (tile?.fungus) moveCost = 3;
  else if (tile && (tile.terrain === Terrain.Hills || tile.terrain === Terrain.Mountains)) moveCost = 2;

  return {
    ...unit,
    q: best.q,
    r: best.r,
    movesLeft: Math.max(0, unit.movesLeft - Math.max(moveCost, 1)),
  };
}

// ─── Find Nearest Enemy ──────────────────────────────────────

function findNearestEnemy(unit: Unit, units: Map<string, Unit>, factionId: number): Unit | null {
  let nearest: Unit | null = null;
  let nearestDist = Infinity;

  for (const [, other] of units) {
    if (other.owner === factionId || other.owner === -1) continue;
    const dist = hexDist(unit.q, unit.r, other.q, other.r);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = other;
    }
  }

  return nearest;
}
