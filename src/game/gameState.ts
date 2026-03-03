// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Game State Engine
// ═══════════════════════════════════════════════════════════════

import {
  GameMap, MapTile, Terrain, Moisture, hexKey, hexNeighbors,
  generateMap, MapConfig, DEFAULT_MAP_CONFIG
} from "./hexMap";

// ─── Resource Types ──────────────────────────────────────────

export interface Resources {
  nutrients: number;
  minerals: number;
  energy: number;
}

// ─── Base (City) ─────────────────────────────────────────────

export interface Base {
  id: string;
  name: string;
  q: number;
  r: number;
  owner: number;          // faction index
  population: number;
  storedNutrients: number;
  storedMinerals: number;
  facilities: string[];
  productionQueue: string[];
  workedTiles: string[];  // hex keys of tiles being worked
}

// ─── Unit ────────────────────────────────────────────────────

export enum UnitType {
  Colony = "colony",
  Former = "former",
  Scout = "scout",
  Infantry = "infantry",
  Speeder = "speeder",
  Mindworm = "mindworm",
}

export interface Unit {
  id: string;
  type: UnitType;
  q: number;
  r: number;
  owner: number;
  movesLeft: number;
  maxMoves: number;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  orders: string | null;
}

// ─── Faction ─────────────────────────────────────────────────

export interface FactionState {
  id: number;
  key: string;           // e.g. "GAIANS"
  name: string;
  leaderName: string;
  color: string;
  isHuman: boolean;
  energy: number;        // treasury
  techProgress: number;
  currentResearch: string | null;
  discoveredTechs: string[];
  relations: Map<number, number>; // faction id -> disposition (-100 to 100)
}

// ─── Game State ──────────────────────────────────────────────

export interface GameState {
  turn: number;
  year: number;
  map: GameMap;
  factions: FactionState[];
  bases: Map<string, Base>;
  units: Map<string, Unit>;
  selectedUnit: string | null;
  selectedBase: string | null;
  selectedTile: string | null; // hex key
  currentFaction: number;
  phase: "playing" | "menu" | "diplomacy";
  log: string[];
}

// ─── Faction Definitions ─────────────────────────────────────

export interface FactionDef {
  key: string;
  name: string;
  leaderName: string;
  color: string;
}

export const FACTION_DEFS: FactionDef[] = [
  { key: "GAIANS",   name: "Gaia's Stepdaughters",    leaderName: "Lady Deirdre Skye",       color: "#22cc55" },
  { key: "HIVE",     name: "The Human Hive",           leaderName: "Chairman Yang",            color: "#ccaa22" },
  { key: "UNIV",     name: "The University of Planet",  leaderName: "Academician Zakharov",     color: "#dddddd" },
  { key: "MORGAN",   name: "Morgan Industries",         leaderName: "CEO Nwabudike Morgan",     color: "#eebb33" },
  { key: "SPARTANS", name: "The Spartan Federation",    leaderName: "Colonel Corazon Santiago",  color: "#cc3333" },
  { key: "BELIEVE",  name: "The Lord's Believers",      leaderName: "Sister Miriam Godwinson",   color: "#cc66cc" },
  { key: "PEACE",    name: "The Peacekeeping Forces",   leaderName: "Commissioner Pravin Lal",   color: "#3388dd" },
];

// ─── Initialization ──────────────────────────────────────────

let nextUnitId = 1;
let nextBaseId = 1;

function createUnit(type: UnitType, q: number, r: number, owner: number): Unit {
  const stats: Record<UnitType, { moves: number; hp: number; atk: number; def: number }> = {
    [UnitType.Colony]:    { moves: 1, hp: 10, atk: 0, def: 1 },
    [UnitType.Former]:    { moves: 1, hp: 10, atk: 0, def: 1 },
    [UnitType.Scout]:     { moves: 1, hp: 10, atk: 1, def: 1 },
    [UnitType.Infantry]:  { moves: 1, hp: 10, atk: 2, def: 2 },
    [UnitType.Speeder]:   { moves: 2, hp: 10, atk: 3, def: 1 },
    [UnitType.Mindworm]:  { moves: 1, hp: 10, atk: 2, def: 2 },
  };

  const s = stats[type];
  const id = `unit_${nextUnitId++}`;
  return {
    id, type, q, r, owner,
    movesLeft: s.moves, maxMoves: s.moves,
    health: s.hp, maxHealth: s.hp,
    attack: s.atk, defense: s.def,
    orders: null,
  };
}

function findLandTile(map: GameMap, rng: () => number, avoidKeys: Set<string>): { q: number; r: number } | null {
  for (let attempt = 0; attempt < 500; attempt++) {
    const q = Math.floor(rng() * map.width);
    const r = Math.floor(rng() * map.height);
    const key = hexKey(q, r);
    const tile = map.tiles.get(key);
    if (tile &&
        tile.terrain !== Terrain.DeepOcean &&
        tile.terrain !== Terrain.Ocean &&
        tile.terrain !== Terrain.Shelf &&
        tile.terrain !== Terrain.Mountains &&
        !avoidKeys.has(key)) {
      return { q, r };
    }
  }
  return null;
}

export function initializeGame(
  playerFactionIndex: number = 0,
  numFactions: number = 4,
  mapConfig: MapConfig = DEFAULT_MAP_CONFIG
): GameState {
  const map = generateMap(mapConfig);
  const factions: FactionState[] = [];
  const bases = new Map<string, Base>();
  const units = new Map<string, Unit>();
  const usedTiles = new Set<string>();

  // Simple RNG for placement
  let placeSeed = mapConfig.seed + 9999;
  const placeRng = () => {
    placeSeed = (placeSeed * 1664525 + 1013904223) & 0xffffffff;
    return (placeSeed >>> 0) / 0xffffffff;
  };

  // Create factions
  const selectedDefs = FACTION_DEFS.slice(0, Math.min(numFactions, FACTION_DEFS.length));

  for (let i = 0; i < selectedDefs.length; i++) {
    const def = selectedDefs[i];
    factions.push({
      id: i,
      key: def.key,
      name: def.name,
      leaderName: def.leaderName,
      color: def.color,
      isHuman: i === playerFactionIndex,
      energy: 10,
      techProgress: 0,
      currentResearch: null,
      discoveredTechs: [],
      relations: new Map(),
    });

    // Place starting units
    const startPos = findLandTile(map, placeRng, usedTiles);
    if (startPos) {
      // Mark area as used
      const nearKeys = hexNeighbors(startPos).map(n => hexKey(n.q, n.r));
      nearKeys.forEach(k => usedTiles.add(k));
      usedTiles.add(hexKey(startPos.q, startPos.r));

      // Colony pod
      const colony = createUnit(UnitType.Colony, startPos.q, startPos.r, i);
      units.set(colony.id, colony);

      // Scout
      const scoutPos = hexNeighbors(startPos).find(n => {
        const t = map.tiles.get(hexKey(n.q, n.r));
        return t && t.terrain !== Terrain.Ocean && t.terrain !== Terrain.DeepOcean && t.terrain !== Terrain.Shelf;
      }) || startPos;
      const scout = createUnit(UnitType.Scout, scoutPos.q, scoutPos.r, i);
      units.set(scout.id, scout);

      // Former
      const former = createUnit(UnitType.Former, startPos.q, startPos.r, i);
      units.set(former.id, former);
    }
  }

  // Scatter some neutral mindworms
  for (let i = 0; i < 8; i++) {
    const pos = findLandTile(map, placeRng, new Set());
    if (pos) {
      const worm = createUnit(UnitType.Mindworm, pos.q, pos.r, -1); // -1 = neutral/planet
      units.set(worm.id, worm);
    }
  }

  return {
    turn: 1,
    year: 2100,
    map,
    factions,
    bases,
    units,
    selectedUnit: null,
    selectedBase: null,
    selectedTile: null,
    currentFaction: playerFactionIndex,
    phase: "playing",
    log: ["Year 2100. Planetfall. The Unity has been lost. You must survive."],
  };
}

// ─── Tile Resource Calculation ───────────────────────────────

export function getTileResources(tile: MapTile): Resources {
  let nutrients = 0;
  let minerals = 0;
  let energy = 0;

  switch (tile.terrain) {
    case Terrain.Flat:
      nutrients = tile.moisture === Moisture.Rainy ? 2 : 1;
      minerals = 0;
      energy = 1;
      break;
    case Terrain.Rolling:
      nutrients = tile.moisture === Moisture.Rainy ? 2 : 1;
      minerals = 1;
      energy = 1;
      break;
    case Terrain.Hills:
      nutrients = 0;
      minerals = 2;
      energy = 1;
      break;
    case Terrain.Mountains:
      nutrients = 0;
      minerals = 3;
      energy = 0;
      break;
    case Terrain.Shelf:
      nutrients = 1;
      minerals = 0;
      energy = 1;
      break;
    default:
      break;
  }

  if (tile.fungus) {
    nutrients = 1;
    minerals = 0;
    energy = 0;
  }

  if (tile.river) energy += 1;
  if (tile.bonus) {
    nutrients += 1;
    minerals += 1;
    energy += 1;
  }

  // Improvements
  if (tile.improvement === "farm") nutrients += 1;
  if (tile.improvement === "mine") minerals += 1;
  if (tile.improvement === "solar") energy += 1;
  if (tile.improvement === "forest") {
    nutrients = 1;
    minerals = 2;
    energy = 1;
  }

  return { nutrients, minerals, energy };
}

// ─── Actions ─────────────────────────────────────────────────

export function moveUnit(state: GameState, unitId: string, toQ: number, toR: number): GameState {
  const unit = state.units.get(unitId);
  if (!unit || unit.movesLeft <= 0) return state;

  const targetKey = hexKey(toQ, toR);
  const targetTile = state.map.tiles.get(targetKey);
  if (!targetTile) return state;

  // Can't move into deep ocean (unless naval unit, TBD)
  if (targetTile.terrain === Terrain.DeepOcean || targetTile.terrain === Terrain.Ocean) {
    return state;
  }

  // Check distance
  const dist = Math.max(
    Math.abs(unit.q - toQ),
    Math.abs(unit.r - toR),
    Math.abs((-unit.q - unit.r) - (-toQ - toR))
  );
  if (dist > 1) return state;

  // Check for enemy units
  const enemyAtTarget = Array.from(state.units.values()).find(
    u => u.q === toQ && u.r === toR && u.owner !== unit.owner && u.owner !== -1
  );
  if (enemyAtTarget) {
    // Simple combat
    return resolveCombat(state, unitId, enemyAtTarget.id);
  }

  // Move
  const newUnits = new Map(state.units);
  newUnits.set(unitId, {
    ...unit,
    q: toQ,
    r: toR,
    movesLeft: unit.movesLeft - 1,
  });

  return { ...state, units: newUnits };
}

function resolveCombat(state: GameState, attackerId: string, defenderId: string): GameState {
  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);
  if (!attacker || !defender) return state;

  const newUnits = new Map(state.units);
  const log = [...state.log];

  // Simple combat resolution
  const atkRoll = attacker.attack * (attacker.health / attacker.maxHealth) * (0.5 + Math.random());
  const defRoll = defender.defense * (defender.health / defender.maxHealth) * (0.5 + Math.random());

  if (atkRoll > defRoll) {
    // Attacker wins
    newUnits.delete(defenderId);
    const dmg = Math.ceil(defRoll * 2);
    newUnits.set(attackerId, {
      ...attacker,
      q: defender.q,
      r: defender.r,
      movesLeft: 0,
      health: Math.max(1, attacker.health - dmg),
    });
    log.push(`Combat: Your ${attacker.type} defeated enemy ${defender.type}!`);
  } else {
    // Defender wins
    newUnits.delete(attackerId);
    const dmg = Math.ceil(atkRoll * 2);
    newUnits.set(defenderId, {
      ...defender,
      health: Math.max(1, defender.health - dmg),
    });
    log.push(`Combat: Your ${attacker.type} was destroyed by enemy ${defender.type}.`);
  }

  return { ...state, units: newUnits, log };
}

export function foundBase(state: GameState, unitId: string, name: string): GameState {
  const unit = state.units.get(unitId);
  if (!unit || unit.type !== UnitType.Colony) return state;

  const key = hexKey(unit.q, unit.r);
  const tile = state.map.tiles.get(key);
  if (!tile || tile.baseId) return state;

  const baseId = `base_${nextBaseId++}`;
  const base: Base = {
    id: baseId,
    name,
    q: unit.q,
    r: unit.r,
    owner: unit.owner,
    population: 1,
    storedNutrients: 0,
    storedMinerals: 0,
    facilities: ["recycling_tanks"],
    productionQueue: [],
    workedTiles: [key],
  };

  const newBases = new Map(state.bases);
  newBases.set(baseId, base);

  const newUnits = new Map(state.units);
  newUnits.delete(unitId); // Colony pod consumed

  // Update map tile
  const newTiles = new Map(state.map.tiles);
  newTiles.set(key, { ...tile, baseId, owner: unit.owner });

  // Mark surrounding tiles as owned
  for (const n of hexNeighbors({ q: unit.q, r: unit.r })) {
    const nk = hexKey(n.q, n.r);
    const nt = newTiles.get(nk);
    if (nt && nt.owner === null) {
      newTiles.set(nk, { ...nt, owner: unit.owner });
    }
  }

  const log = [...state.log, `${name} founded!`];

  return {
    ...state,
    bases: newBases,
    units: newUnits,
    map: { ...state.map, tiles: newTiles },
    log,
    selectedUnit: null,
  };
}

// ─── Turn Processing ─────────────────────────────────────────

export function endTurn(state: GameState): GameState {
  let newState = { ...state };
  const log = [...state.log];

  // Reset unit moves
  const newUnits = new Map<string, Unit>();
  for (const [id, unit] of state.units) {
    newUnits.set(id, { ...unit, movesLeft: unit.maxMoves });
  }

  // Process bases — production and growth
  const newBases = new Map<string, Base>();
  for (const [id, base] of state.bases) {
    let totalNutrients = 0;
    let totalMinerals = 0;
    let totalEnergy = 0;

    // Sum resources from worked tiles
    for (const tileKey of base.workedTiles) {
      const tile = state.map.tiles.get(tileKey);
      if (tile) {
        const res = getTileResources(tile);
        totalNutrients += res.nutrients;
        totalMinerals += res.minerals;
        totalEnergy += res.energy;
      }
    }

    // Base square always produces 2/1/1
    totalNutrients += 2;
    totalMinerals += 1;
    totalEnergy += 1;

    // Subtract consumption (2 nutrients per pop)
    const consumed = base.population * 2;
    const surplus = totalNutrients - consumed;

    let newPop = base.population;
    let newStoredNutrients = base.storedNutrients + surplus;

    // Growth
    const growthThreshold = (newPop + 1) * 10;
    if (newStoredNutrients >= growthThreshold) {
      newPop++;
      newStoredNutrients -= growthThreshold;
      log.push(`${base.name} has grown to size ${newPop}!`);
    } else if (newStoredNutrients < -10) {
      newPop = Math.max(1, newPop - 1);
      newStoredNutrients = 0;
      log.push(`Starvation in ${base.name}!`);
    }

    newBases.set(id, {
      ...base,
      population: newPop,
      storedNutrients: Math.max(0, newStoredNutrients),
      storedMinerals: base.storedMinerals + totalMinerals,
    });

    // Add energy to faction treasury
    const fIdx = base.owner;
    if (fIdx >= 0 && fIdx < newState.factions.length) {
      newState.factions = newState.factions.map((f, i) =>
        i === fIdx ? { ...f, energy: f.energy + totalEnergy } : f
      );
    }
  }

  // Mindworm random movement
  for (const [id, unit] of newUnits) {
    if (unit.owner === -1 && unit.type === UnitType.Mindworm) {
      const neighbors = hexNeighbors({ q: unit.q, r: unit.r });
      const valid = neighbors.filter(n => {
        const t = state.map.tiles.get(hexKey(n.q, n.r));
        return t && t.terrain !== Terrain.Ocean && t.terrain !== Terrain.DeepOcean;
      });
      if (valid.length > 0 && Math.random() < 0.4) {
        const target = valid[Math.floor(Math.random() * valid.length)];
        newUnits.set(id, { ...unit, q: target.q, r: target.r });
      }
    }
  }

  return {
    ...newState,
    turn: state.turn + 1,
    year: state.year + 1,
    units: newUnits,
    bases: newBases,
    log,
  };
}
