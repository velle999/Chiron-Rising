// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Game State Engine
// ═══════════════════════════════════════════════════════════════

import {
  GameMap, MapTile, Terrain, Moisture, hexKey, hexNeighbors,
  generateMap, MapConfig, DEFAULT_MAP_CONFIG
} from "./hexMap";

import {
  getTech, getResearchableTechs, getFactionStartingTechs,
  calculateLabsPerTurn, TECH_TREE
} from "./techTree";

import {
  SocialEngineering, defaultSocialEngineering, calculateSocialFactors,
  SocialFactors, FACTION_BONUSES
} from "./socialEngineering";

import { processAutomatedUnits } from "./unitAutomation";

import { processAITurn } from "./aiOpponent";
import { resolveCombatDetailed } from "./combat";
import { getProjectBonuses, healUnits, checkVictoryConditions, getFreeFacilities } from "./projectsAndVictory";

// ─── Resource Types ──────────────────────────────────────────

export interface Resources {
  nutrients: number;
  minerals: number;
  energy: number;
}

// ─── Unit Types ─────────────────────────────────────────────

export enum UnitType {
  Colony = "colony",
  Former = "former",
  Scout = "scout",
  Infantry = "infantry",
  Speeder = "speeder",
  Mindworm = "mindworm",
}

// ─── Production Catalog ──────────────────────────────────────

export interface BuildItem {
  key: string;
  name: string;
  category: "unit" | "facility" | "project";
  cost: number;           // minerals to build
  description: string;
  maintenance?: number;   // energy per turn (facilities)
  unitType?: UnitType;    // if unit
  requiresTech?: string;  // tech key required to build
}

export const BUILD_CATALOG: BuildItem[] = [
  // ── Units ──
  { key: "unit_colony",    name: "Colony Pod",      category: "unit", cost: 30,  description: "Founds a new base",           unitType: UnitType.Colony },
  { key: "unit_former",    name: "Terraformer",     category: "unit", cost: 18,  description: "Builds improvements on tiles", unitType: UnitType.Former, requiresTech: "centauri_ecology" },
  { key: "unit_scout",     name: "Scout Patrol",    category: "unit", cost: 8,   description: "Fast exploration unit",        unitType: UnitType.Scout },
  { key: "unit_infantry",  name: "Garrison",        category: "unit", cost: 12,  description: "Standard combat unit",         unitType: UnitType.Infantry },
  { key: "unit_speeder",   name: "Speeder",         category: "unit", cost: 16,  description: "Fast attack vehicle",          unitType: UnitType.Speeder, requiresTech: "doctrine_mobility" },

  // ── Facilities ──
  { key: "recycling_tanks",    name: "Recycling Tanks",    category: "facility", cost: 40,  maintenance: 0, description: "+1 nutrient, mineral, energy at base square", requiresTech: "biogenetics" },
  { key: "recreation_commons", name: "Recreation Commons", category: "facility", cost: 40,  maintenance: 1, description: "Reduces drones by 2",                        requiresTech: "social_psych" },
  { key: "network_node",       name: "Network Node",       category: "facility", cost: 80,  maintenance: 1, description: "+50% labs output at base",                    requiresTech: "information_networks" },
  { key: "energy_bank",        name: "Energy Bank",        category: "facility", cost: 80,  maintenance: 1, description: "+50% economy at base",                        requiresTech: "industrial_economics" },
  { key: "perimeter_defense",  name: "Perimeter Defense",  category: "facility", cost: 50,  maintenance: 0, description: "Doubles defense of units in base",            requiresTech: "doctrine_loyalty" },
  { key: "command_center",     name: "Command Center",     category: "facility", cost: 40,  maintenance: 1, description: "+2 morale for land units built here",         requiresTech: "doctrine_mobility" },
  { key: "children_creche",    name: "Children's Creche",  category: "facility", cost: 50,  maintenance: 1, description: "+2 Growth, +2 Efficiency at this base",       requiresTech: "ethical_calculus" },
  { key: "tree_farm",          name: "Tree Farm",          category: "facility", cost: 120, maintenance: 3, description: "+50% psych and economy from forests",         requiresTech: "environmental_economics" },
  { key: "hab_complex",        name: "Hab Complex",        category: "facility", cost: 80,  maintenance: 2, description: "Allows population to exceed 7",               requiresTech: "industrial_automation" },
  { key: "research_hospital",  name: "Research Hospital",  category: "facility", cost: 120, maintenance: 3, description: "+50% labs, -1 drone",                         requiresTech: "gene_splicing" },
  { key: "biology_lab",        name: "Biology Lab",        category: "facility", cost: 60,  maintenance: 1, description: "+2 research per turn",                        requiresTech: "centauri_empathy" },
  { key: "fusion_lab",         name: "Fusion Lab",         category: "facility", cost: 120, maintenance: 3, description: "+50% economy and labs",                       requiresTech: "fusion_power" },
  { key: "genejack_factory",   name: "Genejack Factory",   category: "facility", cost: 100, maintenance: 2, description: "+50% minerals, +1 drone",                     requiresTech: "retroviral_engineering" },
  { key: "aerospace_complex",  name: "Aerospace Complex",  category: "facility", cost: 80,  maintenance: 2, description: "+2 morale for air units",                     requiresTech: "doctrine_air_power" },
  { key: "robotic_assembly",   name: "Robotic Assembly Plant", category: "facility", cost: 200, maintenance: 4, description: "+50% minerals",                           requiresTech: "industrial_nanorobotics" },

  // ── Stockpile ──
  { key: "stockpile_energy",   name: "Stockpile Energy",   category: "facility", cost: 0,   maintenance: 0, description: "Convert excess minerals to energy" },

  // ── Secret Projects (wonders — one per planet) ──
  { key: "sp_weather_paradigm",       name: "The Weather Paradigm",        category: "project", cost: 200,  description: "Free Condenser/Borehole for all formers. Bonus terraforming speed.",  requiresTech: "ecological_engineering" },
  { key: "sp_human_genome",           name: "The Human Genome Project",    category: "project", cost: 160,  description: "+1 talent at every base.",                                            requiresTech: "biogenetics" },
  { key: "sp_command_nexus",          name: "The Command Nexus",           category: "project", cost: 200,  description: "+2 morale for all units. Free Command Center at every base.",          requiresTech: "doctrine_loyalty" },
  { key: "sp_citizens_defense",       name: "The Citizens' Defense Force", category: "project", cost: 200,  description: "Free Perimeter Defense at every base.",                               requiresTech: "intellectual_integrity" },
  { key: "sp_virtual_world",          name: "The Virtual World",           category: "project", cost: 200,  description: "Network Nodes count as Hologram Theatres. -2 drones per base.",       requiresTech: "planetary_networks" },
  { key: "sp_planetary_transit",      name: "The Planetary Transit System",category: "project", cost: 160,  description: "New bases start with population 3. +1 population at all bases.",      requiresTech: "industrial_automation" },
  { key: "sp_supercollider",          name: "The Supercollider",           category: "project", cost: 300,  description: "+100% labs at this base.",                                             requiresTech: "applied_relativity" },
  { key: "sp_ascetic_virtues",        name: "The Ascetic Virtues",         category: "project", cost: 200,  description: "+1 Police rating. Hab limits increased by 2.",                        requiresTech: "planetary_economics" },
  { key: "sp_longevity_vaccine",      name: "The Longevity Vaccine",       category: "project", cost: 200,  description: "+50% economy at every base. -2 drones.",                              requiresTech: "bio_engineering" },
  { key: "sp_hunters_seeker",         name: "The Hunter-Seeker Algorithm", category: "project", cost: 200,  description: "Immune to all probe team actions.",                                   requiresTech: "pre_sentient_algorithms" },
  { key: "sp_pholus_mutagen",         name: "The Pholus Mutagen",          category: "project", cost: 200,  description: "+1 lifecycle bonus per fungus square. Fungus production +1.",         requiresTech: "centauri_genetics" },
  { key: "sp_cyborg_factory",         name: "The Cyborg Factory",          category: "project", cost: 300,  description: "Free Bioenhancement Center at every base. +2 morale all units.",      requiresTech: "mind_machine_interface" },
  { key: "sp_theory_everything",      name: "The Theory of Everything",    category: "project", cost: 300,  description: "+100% labs at this base. Free tech every 10 turns.",                  requiresTech: "unified_field_theory" },
  { key: "sp_dream_twister",          name: "The Dream Twister",           category: "project", cost: 300,  description: "+50% psi attack for all units.",                                      requiresTech: "centauri_psi" },
  { key: "sp_voice_planet",           name: "The Voice of Planet",         category: "project", cost: 400,  description: "Begin Ascent to Transcendence. Mindworms may join your faction.",     requiresTech: "threshold_transcendence" },
  { key: "sp_network_backbone",       name: "The Network Backbone",        category: "project", cost: 300,  description: "+1 labs per citizen at every base. +5 research per turn.",            requiresTech: "digital_sentience" },
  { key: "sp_planetary_datalinks",    name: "The Planetary Datalinks",     category: "project", cost: 200,  description: "Automatically gain any tech discovered by 3+ other factions.",        requiresTech: "cyberethics" },
  { key: "sp_maritime_control",       name: "The Maritime Control Center",  category: "project", cost: 200,  description: "+2 moves for all naval units. Free Naval Yard at every base.",       requiresTech: "doctrine_initiative" },
  { key: "sp_nano_factory",           name: "The Nano Factory",            category: "project", cost: 300,  description: "Units repaired fully each turn. -50% upgrade costs.",                 requiresTech: "industrial_nanorobotics" },
];

export function getBuildItem(key: string): BuildItem | undefined {
  return BUILD_CATALOG.find(b => b.key === key);
}

// Items available for a base to build (check tech + already-built)
export function getAvailableBuilds(base: Base, discoveredTechs: string[], completedProjects?: Map<string, { owner: number; baseId: string }>): BuildItem[] {
  const techSet = new Set(discoveredTechs);
  return BUILD_CATALOG.filter(item => {
    // Check tech prerequisite
    if (item.requiresTech && !techSet.has(item.requiresTech)) return false;
    // Stockpile always available
    if (item.key === "stockpile_energy") return true;
    // Can always build units (if tech met)
    if (item.category === "unit") return true;
    // Can't build a facility you already have
    if (item.category === "facility" && base.facilities.includes(item.key)) return false;
    // Secret projects: only one per planet
    if (item.category === "project" && completedProjects?.has(item.key)) return false;
    return true;
  });
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
  productionQueue: string[];     // keys from BUILD_CATALOG
  currentBuild: string | null;   // key currently being built
  buildProgress: number;         // minerals accumulated toward current build
  workedTiles: string[];         // hex keys of tiles being worked
}

// ─── Unit ────────────────────────────────────────────────────

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
  socialEngineering: SocialEngineering;
  knownFactions: Set<number>;   // faction IDs we've made contact with
}

// ─── Game State ──────────────────────────────────────────────

// Visibility state per faction
// "hidden"   = never seen (black)
// "explored" = seen before but no current vision (dimmed, shows terrain but not units)
// "visible"  = currently in line of sight (full detail)
export type TileVisibility = "hidden" | "explored" | "visible";

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
  // Per-faction visibility: factionIndex -> Set of hexKeys that have been explored
  explored: Map<number, Set<string>>;
  // Current turn visibility (recalculated each turn): Set of hexKeys currently visible
  visible: Set<string>;
  // Secret Projects completed: projectKey -> { owner: factionIndex, baseId }
  completedProjects: Map<string, { owner: number; baseId: string }>;
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

// ─── Visibility System ───────────────────────────────────────

const VISION_RANGE_UNIT = 2;    // Units see 2 hexes out
const VISION_RANGE_BASE = 3;    // Bases see 3 hexes out  
const VISION_RANGE_SCOUT = 3;   // Scouts see further

function getVisionRange(unitType: UnitType): number {
  if (unitType === UnitType.Scout) return VISION_RANGE_SCOUT;
  return VISION_RANGE_UNIT;
}

// Get all hex keys within radius of a position
function getHexesInRadius(q: number, r: number, radius: number, mapWidth: number, mapHeight: number): string[] {
  const results: string[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      let tq = q + dq;
      let tr = r + dr;
      // Cylindrical wrapping (horizontal)
      if (tq < 0) tq += mapWidth;
      if (tq >= mapWidth) tq -= mapWidth;
      // Vertical bounds
      if (tr >= 0 && tr < mapHeight) {
        results.push(hexKey(tq, tr));
      }
    }
  }
  return results;
}

// Calculate currently visible hexes for a faction
export function calculateVisibility(state: GameState, factionIndex: number): Set<string> {
  const visible = new Set<string>();
  const { map, units, bases } = state;

  // Vision from units
  for (const [, unit] of units) {
    if (unit.owner === factionIndex) {
      const range = getVisionRange(unit.type);
      const hexes = getHexesInRadius(unit.q, unit.r, range, map.width, map.height);
      hexes.forEach(k => visible.add(k));
    }
  }

  // Vision from bases
  for (const [, base] of bases) {
    if (base.owner === factionIndex) {
      const hexes = getHexesInRadius(base.q, base.r, VISION_RANGE_BASE, map.width, map.height);
      hexes.forEach(k => visible.add(k));
    }
  }

  return visible;
}

// Update explored set with current visibility
function updateExplored(explored: Map<number, Set<string>>, factionIndex: number, visible: Set<string>): Map<number, Set<string>> {
  const newExplored = new Map(explored);
  const factionExplored = new Set(newExplored.get(factionIndex) || []);
  visible.forEach(k => factionExplored.add(k));
  newExplored.set(factionIndex, factionExplored);
  return newExplored;
}

// Get visibility state for a specific tile for the current player
export function getTileVisibility(state: GameState, hexKey: string): TileVisibility {
  if (state.visible.has(hexKey)) return "visible";
  const factionExplored = state.explored.get(state.currentFaction);
  if (factionExplored && factionExplored.has(hexKey)) return "explored";
  return "hidden";
}

// ─── Initialization ──────────────────────────────────────────

let nextUnitId = 1;
let nextBaseId = 1;

export function createUnit(type: UnitType, q: number, r: number, owner: number): Unit {
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

  // Create factions — always include the player's chosen faction
  const selectedDefs: typeof FACTION_DEFS = [];
  // Player faction goes first
  selectedDefs.push(FACTION_DEFS[playerFactionIndex]);
  // Fill remaining slots with other factions
  for (let i = 0; i < FACTION_DEFS.length && selectedDefs.length < numFactions; i++) {
    if (i !== playerFactionIndex) {
      selectedDefs.push(FACTION_DEFS[i]);
    }
  }
  // Player is always index 0 in the game
  const actualPlayerIndex = 0;

  for (let i = 0; i < selectedDefs.length; i++) {
    const def = selectedDefs[i];
    factions.push({
      id: i,
      key: def.key,
      name: def.name,
      leaderName: def.leaderName,
      color: def.color,
      isHuman: i === actualPlayerIndex,
      energy: def.key === "MORGAN" ? 110 : 10,
      techProgress: 0,
      currentResearch: null,
      discoveredTechs: getFactionStartingTechs(def.key),
      relations: new Map(),
      socialEngineering: defaultSocialEngineering(),
      knownFactions: new Set<number>(),
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

  // Set initial research for AI factions
  for (let i = 0; i < factions.length; i++) {
    if (!factions[i].isHuman) {
      const available = getResearchableTechs(factions[i].discoveredTechs);
      if (available.length > 0) {
        factions[i] = {
          ...factions[i],
          currentResearch: available[Math.floor(placeRng() * available.length)].key,
        };
      }
    }
  }

  // Initialize visibility
  const explored = new Map<number, Set<string>>();
  for (let i = 0; i < selectedDefs.length; i++) {
    explored.set(i, new Set<string>());
  }

  const initialState: GameState = {
    turn: 1,
    year: 2100,
    map,
    factions,
    bases,
    units,
    selectedUnit: null,
    selectedBase: null,
    selectedTile: null,
    currentFaction: actualPlayerIndex,
    phase: "playing",
    log: ["Year 2100. Planetfall. The Unity has been lost. You must survive."],
    explored,
    visible: new Set(),
    completedProjects: new Map(),
  };

  // Calculate initial visibility for all factions
  for (let i = 0; i < selectedDefs.length; i++) {
    const vis = calculateVisibility(initialState, i);
    const factionExplored = new Set(explored.get(i) || []);
    vis.forEach(k => factionExplored.add(k));
    explored.set(i, factionExplored);
  }

  // Set current player's visibility
  initialState.visible = calculateVisibility(initialState, actualPlayerIndex);
  initialState.explored = explored;

  return initialState;
}

// ─── Tile Resource Calculation ───────────────────────────────
// Based on SMAC manual resource production tables:
//   Nutrients from rainfall: Arid=0, Moist(Moderate)=1, Rainy=2
//     BUT rocky terrain negates ALL nutrient production
//   Minerals from rockiness: Flat=0, Rolling=1, Rocky(Hills/Mountains)=1
//   Energy from elevation: requires solar collector, 1 per 1000m band (1-4)
//   Ocean/Shelf: fixed 1 energy per shelf

export function getTileResources(tile: MapTile): Resources {
  let nutrients = 0;
  let minerals = 0;
  let energy = 0;

  // ── Forest: fixed production (overrides everything) ──
  if (tile.improvement === "forest") {
    return { nutrients: 1, minerals: 2, energy: 0 };
  }

  // ── Fungus: base 0/0/0, unlockable with tech (simplified: 1/0/0 baseline) ──
  if (tile.fungus) {
    nutrients = 1;
    minerals = 0;
    energy = 0;
    // River still adds energy in fungus
    if (tile.river) energy += 1;
    if (tile.bonus) { nutrients += 1; minerals += 1; energy += 1; }
    return { nutrients, minerals, energy };
  }

  // ── Ocean tiles ──
  if (tile.terrain === Terrain.DeepOcean || tile.terrain === Terrain.Ocean) {
    return { nutrients: 0, minerals: 0, energy: 0 };
  }
  if (tile.terrain === Terrain.Shelf) {
    nutrients = 1;
    minerals = 0;
    energy = 1;
    if (tile.improvement === "farm") nutrients += 2;   // Kelp farm: +2
    if (tile.improvement === "mine") minerals += 1;    // Mining platform
    if (tile.improvement === "solar") energy += 2;     // Tidal harness: +2
    if (tile.bonus) { nutrients += 1; minerals += 1; energy += 1; }
    return { nutrients, minerals, energy };
  }

  // ── Land tiles: SMAC formula ──

  // Nutrients from rainfall (moisture)
  // Rocky terrain (Hills/Mountains) negates all nutrient production from rainfall
  const isRocky = tile.terrain === Terrain.Hills || tile.terrain === Terrain.Mountains;
  if (!isRocky) {
    switch (tile.moisture) {
      case Moisture.Arid:     nutrients = 0; break;
      case Moisture.Moderate: nutrients = 1; break;  // "Moist" in SMAC
      case Moisture.Rainy:    nutrients = 2; break;
    }
  } else {
    nutrients = 0; // Rocky negates nutrients
  }

  // Minerals from rockiness
  switch (tile.terrain) {
    case Terrain.Flat:       minerals = 0; break;
    case Terrain.Rolling:    minerals = 1; break;
    case Terrain.Hills:      minerals = 1; break;  // "Rocky" in SMAC
    case Terrain.Mountains:  minerals = 1; break;  // Also rocky
  }

  // Energy: base 0 on land. Elevation energy requires solar collector.
  energy = 0;

  // ── River: +1 energy ──
  if (tile.river) energy += 1;

  // ── Improvements ──
  if (tile.improvement === "farm") {
    nutrients += 1;
    // Mine will not reduce nutrients to zero
  }
  if (tile.improvement === "mine") {
    // +1 rolling, +2 rocky, but won't reduce nutrients below 0
    if (tile.terrain === Terrain.Rolling) {
      minerals += 1;
    } else if (isRocky) {
      minerals += 2;
    } else {
      minerals += 1; // flat: still +1
    }
    // Mine on land with nutrients: -1 nutrient (but not below 0)
    if (nutrients > 0 && !isRocky) {
      nutrients = Math.max(0, nutrients - 1);
    }
  }
  if (tile.improvement === "solar") {
    // Solar collector: energy from elevation
    // Elevation 0-255 mapped to SMAC's 0-3000m+ range
    // Level 1 (0-63): +1, Level 2 (64-127): +2, Level 3 (128-191): +3, Level 4 (192+): +4
    const elevLevel = Math.min(4, Math.floor(tile.elevation / 64) + 1);
    energy += elevLevel;
  }
  // Road + mine on rocky = +1 mineral
  if (tile.road && tile.improvement === "mine" && isRocky) {
    minerals += 1;
  }

  // ── Bonus resources ──
  if (tile.bonus) {
    nutrients += 2;
    minerals += 2;
    energy += 2;
  }

  // ── Monolith: 2/2/2 (override) ──
  if (tile.improvement === "monolith") {
    return { nutrients: 2, minerals: 2, energy: 2 };
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

  // Move cost: roads = 1/3 move, flat/rolling = 1, hills = 2, fungus = 3
  const sourceTile = state.map.tiles.get(hexKey(unit.q, unit.r));
  let moveCost = 1;

  if (targetTile.road) {
    // Roads: 1/3 movement point (effectively free for most units)
    moveCost = 0;
  } else if (targetTile.fungus) {
    moveCost = 3;
  } else if (targetTile.terrain === Terrain.Hills || targetTile.terrain === Terrain.Mountains) {
    moveCost = 2;
  }
  // Road-to-road movement is free
  if (sourceTile?.road && targetTile.road) moveCost = 0;

  // Minimum 1 move spent unless road, but always allow at least one step
  const actualCost = Math.max(moveCost, targetTile.road ? 0 : 1);

  // If unit has fewer moves than cost, they can still move (uses all remaining)
  if (unit.movesLeft < actualCost && unit.movesLeft < 1) return state;

  // Move
  const newUnits = new Map(state.units);
  newUnits.set(unitId, {
    ...unit,
    q: toQ,
    r: toR,
    movesLeft: Math.max(0, unit.movesLeft - Math.max(actualCost, 1)),
  });

  let newState = { ...state, units: newUnits };
  
  // Recalculate visibility after move
  if (unit.owner === state.currentFaction) {
    const newVisible = calculateVisibility(newState, state.currentFaction);
    const newExplored = updateExplored(state.explored, state.currentFaction, newVisible);
    newState = { ...newState, visible: newVisible, explored: newExplored };

    // Check for new faction contacts on newly visible tiles
    const playerFaction = newState.factions[state.currentFaction];
    const playerKnown = new Set(playerFaction.knownFactions || []);
    let madeContact = false;
    const updatedFactions = [...newState.factions];

    for (const [, otherUnit] of newState.units) {
      if (otherUnit.owner === state.currentFaction || otherUnit.owner < 0) continue;
      if (playerKnown.has(otherUnit.owner)) continue;
      const uKey = hexKey(otherUnit.q, otherUnit.r);
      if (newVisible.has(uKey)) {
        playerKnown.add(otherUnit.owner);
        // Mutual contact
        const otherKnown = new Set(updatedFactions[otherUnit.owner].knownFactions || []);
        otherKnown.add(state.currentFaction);
        updatedFactions[otherUnit.owner] = { ...updatedFactions[otherUnit.owner], knownFactions: otherKnown };
        newState.log = [...(newState.log || state.log), `Contact established with ${updatedFactions[otherUnit.owner].name}!`];
        madeContact = true;
      }
    }
    for (const [, otherBase] of newState.bases) {
      if (otherBase.owner === state.currentFaction) continue;
      if (playerKnown.has(otherBase.owner)) continue;
      const bKey = hexKey(otherBase.q, otherBase.r);
      if (newVisible.has(bKey)) {
        playerKnown.add(otherBase.owner);
        const otherKnown = new Set(updatedFactions[otherBase.owner].knownFactions || []);
        otherKnown.add(state.currentFaction);
        updatedFactions[otherBase.owner] = { ...updatedFactions[otherBase.owner], knownFactions: otherKnown };
        newState.log = [...(newState.log || state.log), `Contact established with ${updatedFactions[otherBase.owner].name}!`];
        madeContact = true;
      }
    }

    if (madeContact) {
      updatedFactions[state.currentFaction] = { ...updatedFactions[state.currentFaction], knownFactions: playerKnown };
      newState = { ...newState, factions: updatedFactions };
    }
  }

  return newState;
}

function resolveCombat(state: GameState, attackerId: string, defenderId: string): GameState {
  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);
  if (!attacker || !defender) return state;

  const newUnits = new Map(state.units);
  const log = [...state.log];

  // Use the detailed combat system
  const report = resolveCombatDetailed(state, attacker, defender);

  // Build combat log with modifiers
  const atkName = attacker.type;
  const defName = defender.type;
  const modStr = report.defenderModifiers.length > 0
    ? ` [${report.defenderModifiers.map(m => m.name).join(", ")}]`
    : "";

  if (report.attackerWins) {
    // Attacker wins — moves to defender's tile, defender destroyed
    newUnits.delete(defenderId);
    newUnits.set(attackerId, {
      ...attacker,
      q: defender.q,
      r: defender.r,
      movesLeft: 0,
      health: Math.max(1, attacker.health - report.attackerDamage),
    });
    log.push(`Combat: ${atkName} (${Math.round(report.attackerEffective * 10) / 10}) defeated ${defName} (${Math.round(report.defenderEffective * 10) / 10}) in ${report.rounds} rounds${modStr}`);

    // If defender was in a base and attacker captures it
    const defBaseEntry = Array.from(state.bases.entries()).find(([, b]) => b.q === defender.q && b.r === defender.r);
    if (defBaseEntry && defBaseEntry[1].owner !== attacker.owner) {
      const [baseId, base] = defBaseEntry;
      // Check if any other enemy units still in the base
      const otherDefenders = Array.from(newUnits.values()).filter(
        u => u.q === base.q && u.r === base.r && u.owner === base.owner && u.id !== defenderId
      );
      if (otherDefenders.length === 0) {
        // Capture the base!
        const newBases = new Map(state.bases);
        newBases.set(baseId, { ...base, owner: attacker.owner });
        // Update tile ownership
        const newTiles = new Map(state.map.tiles);
        const baseKey = hexKey(base.q, base.r);
        const baseTile = newTiles.get(baseKey);
        if (baseTile) {
          newTiles.set(baseKey, { ...baseTile, owner: attacker.owner });
        }
        log.push(`${base.name} has been captured!`);
        return { ...state, units: newUnits, bases: newBases, map: { ...state.map, tiles: newTiles }, log };
      }
    }
  } else {
    // Defender wins — attacker destroyed
    newUnits.delete(attackerId);
    newUnits.set(defenderId, {
      ...defender,
      health: Math.max(1, defender.health - report.defenderDamage),
    });
    log.push(`Combat: ${atkName} (${Math.round(report.attackerEffective * 10) / 10}) destroyed by ${defName} (${Math.round(report.defenderEffective * 10) / 10}) in ${report.rounds} rounds${modStr}`);
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
    currentBuild: "unit_scout",    // Default: build a scout first
    buildProgress: 0,
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

  let newState = {
    ...state,
    bases: newBases,
    units: newUnits,
    map: { ...state.map, tiles: newTiles },
    log,
    selectedUnit: null,
  };

  // Recalculate visibility (base gives vision)
  if (unit.owner === state.currentFaction) {
    const newVisible = calculateVisibility(newState, state.currentFaction);
    const newExplored = updateExplored(state.explored, state.currentFaction, newVisible);
    newState = { ...newState, visible: newVisible, explored: newExplored };
  }

  return newState;
}

// ─── Production Management ──────────────────────────────────

export function changeProduction(state: GameState, baseId: string, buildKey: string): GameState {
  const base = state.bases.get(baseId);
  if (!base) return state;

  const item = getBuildItem(buildKey);
  if (!item) return state;

  // Switching production loses some progress (keep up to 10 minerals)
  const carryOver = Math.min(base.buildProgress, 10);

  const newBases = new Map(state.bases);
  newBases.set(baseId, {
    ...base,
    currentBuild: buildKey,
    buildProgress: carryOver,
  });

  const log = [...state.log, `${base.name}: Now building ${item.name}`];
  return { ...state, bases: newBases, log };
}

// ─── Research Management ─────────────────────────────────────

export function chooseResearch(state: GameState, techKey: string): GameState {
  const tech = getTech(techKey);
  if (!tech) return state;

  const faction = state.factions[state.currentFaction];
  if (!faction) return state;

  // Verify prerequisites met
  const discovered = new Set(faction.discoveredTechs);
  if (!tech.prerequisites.every(p => discovered.has(p))) return state;
  if (discovered.has(techKey)) return state;

  const newFactions = state.factions.map((f, i) =>
    i === state.currentFaction ? { ...f, currentResearch: techKey } : f
  );

  const log = [...state.log, `Research begun: ${tech.name}`];
  return { ...state, factions: newFactions, log };
}

// ─── Social Engineering Management ───────────────────────────

export function changeSocialEngineering(
  state: GameState,
  category: keyof SocialEngineering,
  choiceKey: string
): GameState {
  const faction = state.factions[state.currentFaction];
  if (!faction) return state;

  // Verify not an aversion
  const bonuses = FACTION_BONUSES[faction.key];
  if (bonuses && choiceKey === bonuses.aversion) return state;

  const newSE = { ...faction.socialEngineering, [category]: choiceKey };
  const newFactors = calculateSocialFactors(faction.key, newSE);

  const newFactions = state.factions.map((f, i) =>
    i === state.currentFaction ? { ...f, socialEngineering: newSE } : f
  );

  const log = [...state.log, `Social Engineering: ${category} changed to ${choiceKey}`];
  return { ...state, factions: newFactions, log };
}

// ─── Unit Orders ─────────────────────────────────────────────

export function setUnitOrders(state: GameState, unitId: string, orders: string | null): GameState {
  const unit = state.units.get(unitId);
  if (!unit) return state;

  const newUnits = new Map(state.units);
  newUnits.set(unitId, { ...unit, orders });

  const orderNames: Record<string, string> = {
    "auto": "Automated",
    "auto_former": "Auto-Terraform",
    "auto_scout": "Auto-Explore",
    "auto_patrol": "Auto-Patrol",
    "sentry": "Sentry",
    "hold": "Hold Position",
    "fortify": "Fortify",
  };

  const label = orders ? (orderNames[orders] || orders) : "Cancelled";
  const log = [...state.log, `${unit.type}: ${label}`];
  return { ...state, units: newUnits, log };
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

  // Process automated units
  const autoState = { ...state, units: newUnits };
  const autoResult = processAutomatedUnits(autoState);
  // Merge automation results
  for (const [id, unit] of autoResult.units) {
    newUnits.set(id, unit);
  }
  const newMapTiles = new Map(state.map.tiles);
  for (const [key, tile] of autoResult.tiles) {
    newMapTiles.set(key, tile);
  }
  log.push(...autoResult.log);
  newState = { ...newState, map: { ...state.map, tiles: newMapTiles } };

  // Process bases — production and growth
  const newBases = new Map<string, Base>();
  for (const [id, base] of state.bases) {
    let totalNutrients = 0;
    let totalMinerals = 0;
    let totalEnergy = 0;

    // Calculate social factors for this base's owner
    const ownerFaction = state.factions[base.owner];
    const factors = ownerFaction
      ? calculateSocialFactors(ownerFaction.key, ownerFaction.socialEngineering)
      : { economy: 0, efficiency: 0, support: 0, morale: 0, police: 0, growth: 0, planet: 0, probe: 0, industry: 0, research: 0 };

    // Sum resources from worked tiles
    for (const tileKey of base.workedTiles) {
      const tile = newState.map.tiles.get(tileKey);
      if (tile) {
        const res = getTileResources(tile);
        totalNutrients += res.nutrients;
        totalMinerals += res.minerals;
        totalEnergy += res.energy;
      }
    }

    // Base square always produces 2/1/2 (per SMAC manual)
    totalNutrients += 2;
    totalMinerals += 1;
    totalEnergy += 2;

    // Apply Economy factor: bonus energy per base
    if (factors.economy >= 1) totalEnergy += 1;
    if (factors.economy >= 4) totalEnergy += 2;
    if (factors.economy <= -2) totalEnergy -= 1;
    if (factors.economy <= -3) totalEnergy -= 2;

    // Apply Industry factor: modify mineral costs (we track effective minerals)
    // Positive industry = cheaper builds (more effective minerals)
    const industryMultiplier = 1.0 + (factors.industry * 0.1); // +/-10% per level

    // Subtract consumption (2 nutrients per pop)
    const consumed = base.population * 2;
    const surplus = totalNutrients - consumed;

    let newPop = base.population;
    let newStoredNutrients = base.storedNutrients + surplus;

    // Growth — apply growth factor
    const growthModifier = 1.0 + (factors.growth * 0.1); // +/-10% per level
    const growthThreshold = Math.max(5, Math.floor((newPop + 1) * 10 / growthModifier));

    if (factors.growth >= 6) {
      // POPULATION BOOM: grow every turn if nutrients available
      if (newStoredNutrients > 0) {
        newPop++;
        newStoredNutrients = Math.max(0, newStoredNutrients - 10);
        log.push(`${base.name} grows to size ${newPop}! (Population Boom)`);
      }
    } else if (newStoredNutrients >= growthThreshold) {
      newPop++;
      newStoredNutrients -= growthThreshold;
      log.push(`${base.name} has grown to size ${newPop}!`);
    } else if (newStoredNutrients < -10) {
      newPop = Math.max(1, newPop - 1);
      newStoredNutrients = 0;
      log.push(`Starvation in ${base.name}!`);
    }

    // ── Production ──
    const effectiveMinerals = Math.max(0, Math.floor(totalMinerals * industryMultiplier));
    let newBuildProgress = base.buildProgress + effectiveMinerals;
    let newCurrentBuild = base.currentBuild;
    let newFacilities = [...base.facilities];
    let newQueue = [...base.productionQueue];

    if (newCurrentBuild) {
      const item = getBuildItem(newCurrentBuild);

      // Stockpile energy: convert minerals to energy
      if (newCurrentBuild === "stockpile_energy") {
        const energyGain = Math.floor(totalMinerals / 2);
        const fIdx = base.owner;
        if (fIdx >= 0 && fIdx < newState.factions.length) {
          newState.factions = newState.factions.map((f, i) =>
            i === fIdx ? { ...f, energy: f.energy + energyGain } : f
          );
        }
        newBuildProgress = 0;
      } else if (item && newBuildProgress >= item.cost) {
        // Production complete!
        newBuildProgress -= item.cost;

        if (item.category === "unit" && item.unitType) {
          // Create the unit at the base
          const newUnit = createUnit(item.unitType, base.q, base.r, base.owner);
          newUnits.set(newUnit.id, newUnit);
          log.push(`${base.name}: ${item.name} completed!`);
        } else if (item.category === "project") {
          // Secret Project completed!
          if (!newState.completedProjects) {
            newState.completedProjects = new Map();
          }
          const cp = new Map(newState.completedProjects);
          cp.set(item.key, { owner: base.owner, baseId: id });
          newState = { ...newState, completedProjects: cp };
          // Also add to base facilities for local effects
          if (!newFacilities.includes(item.key)) {
            newFacilities.push(item.key);
          }
          log.push(`*** ${base.name} completes SECRET PROJECT: ${item.name}! ***`);
        } else if (item.category === "facility") {
          // Add facility to base
          if (!newFacilities.includes(item.key)) {
            newFacilities.push(item.key);
          }
          log.push(`${base.name}: ${item.name} completed!`);
        }

        // Carry over excess minerals (up to 10)
        newBuildProgress = Math.min(newBuildProgress, 10);

        // Pop next from queue, or set to null
        if (newQueue.length > 0) {
          newCurrentBuild = newQueue.shift()!;
        } else {
          newCurrentBuild = null;
        }
      }
    }

    // Apply free facilities from projects
    const freeFacs = getFreeFacilities(newState, base.owner);
    for (const fac of freeFacs) {
      if (!newFacilities.includes(fac)) {
        newFacilities.push(fac);
      }
    }

    // Apply project bonuses
    const projBonus = getProjectBonuses(newState, base.owner, id);
    totalEnergy += projBonus.energyBonus;
    totalEnergy = Math.floor(totalEnergy * projBonus.economyMultiplier);

    newBases.set(id, {
      ...base,
      population: newPop,
      storedNutrients: Math.max(0, newStoredNutrients),
      storedMinerals: base.storedMinerals + totalMinerals,
      facilities: newFacilities,
      currentBuild: newCurrentBuild,
      buildProgress: newBuildProgress,
      productionQueue: newQueue,
    });

    // Add energy to faction treasury
    const fIdx = base.owner;
    if (fIdx >= 0 && fIdx < newState.factions.length) {
      newState.factions = newState.factions.map((f, i) =>
        i === fIdx ? { ...f, energy: f.energy + totalEnergy } : f
      );
    }
  }

  // ── Research Processing ──
  newState.factions = newState.factions.map(faction => {
    if (!faction.currentResearch) return faction;

    const tech = getTech(faction.currentResearch);
    if (!tech) return faction;

    let labsPerTurn = calculateLabsPerTurn(newBases, faction.id);

    // Apply research social factor
    const factors = calculateSocialFactors(faction.key, faction.socialEngineering);
    labsPerTurn = Math.max(1, Math.floor(labsPerTurn * (1.0 + factors.research * 0.1)));

    // Apply project labs bonuses (Supercollider, Theory of Everything, Network Backbone)
    for (const [baseId, base] of newBases) {
      if (base.owner !== faction.id) continue;
      const projBonus = getProjectBonuses(newState, faction.id, baseId);
      if (projBonus.labsMultiplier > 1.0) {
        // Approximate: add bonus labs proportional to this base's contribution
        const baseLabs = base.facilities.includes("network_node") ? 2 : 1;
        labsPerTurn += Math.floor(baseLabs * (projBonus.labsMultiplier - 1.0));
      }
    }

    const newProgress = faction.techProgress + labsPerTurn;

    if (newProgress >= tech.cost) {
      // Discovery!
      const newDiscovered = [...faction.discoveredTechs, faction.currentResearch];
      log.push(`${faction.name} discovers ${tech.name}!`);

      // Auto-pick next research for AI factions
      let nextResearch: string | null = null;
      if (!faction.isHuman) {
        const available = getResearchableTechs(newDiscovered);
        if (available.length > 0) {
          nextResearch = available[Math.floor(Math.random() * available.length)].key;
        }
      }

      return {
        ...faction,
        discoveredTechs: newDiscovered,
        techProgress: 0,
        currentResearch: nextResearch,
      };
    }

    return { ...faction, techProgress: newProgress };
  });

  // ── AI Faction Turns ──
  for (let i = 0; i < newState.factions.length; i++) {
    if (newState.factions[i].isHuman) continue;

    // Build temp state for AI to read
    const tempState = { ...newState, units: newUnits, bases: newBases };
    const aiResult = processAITurn(tempState, i);

    // Merge AI unit changes
    for (const [id, unit] of aiResult.units) {
      newUnits.set(id, unit);
    }
    // Remove consumed colony pods
    for (const [id] of new Map(newUnits)) {
      if (!aiResult.units.has(id) && newUnits.get(id)?.owner === i && newUnits.get(id)?.type === UnitType.Colony) {
        newUnits.delete(id);
      }
    }
    // Merge AI base changes
    for (const [id, base] of aiResult.bases) {
      newBases.set(id, base);
    }
    // Merge AI tile changes (base founding, ownership)
    const updatedMapTiles = new Map(newState.map.tiles);
    for (const [key, tile] of aiResult.tiles) {
      updatedMapTiles.set(key, tile);
    }
    newState = { ...newState, map: { ...newState.map, tiles: updatedMapTiles } };
    newState.factions = aiResult.factions;
    log.push(...aiResult.log);
  }

  // Mindworm random movement
  for (const [id, unit] of newUnits) {
    if (unit.owner === -1 && unit.type === UnitType.Mindworm) {
      const neighbors = hexNeighbors({ q: unit.q, r: unit.r });
      const valid = neighbors.filter(n => {
        const t = newState.map.tiles.get(hexKey(n.q, n.r));
        return t && t.terrain !== Terrain.Ocean && t.terrain !== Terrain.DeepOcean;
      });
      if (valid.length > 0 && Math.random() < 0.4) {
        const target = valid[Math.floor(Math.random() * valid.length)];
        newUnits.set(id, { ...unit, q: target.q, r: target.r });
      }
    }
  }

  // Unit healing
  const healedUnits = healUnits({ ...newState, units: newUnits, bases: newBases });
  for (const [id, unit] of healedUnits) {
    newUnits.set(id, unit);
  }

  let finalState = {
    ...newState,
    turn: state.turn + 1,
    year: state.year + 1,
    units: newUnits,
    bases: newBases,
    log,
  };

  // Recalculate visibility for current faction
  const newVisible = calculateVisibility(finalState, state.currentFaction);
  const newExplored = updateExplored(finalState.explored, state.currentFaction, newVisible);
  finalState = { ...finalState, visible: newVisible, explored: newExplored };

  // ── Faction Contact Detection ──
  // Check if any faction can now see another faction's units or bases
  const updatedFactions = [...finalState.factions];
  let contactMade = false;

  for (let fi = 0; fi < updatedFactions.length; fi++) {
    const faction = updatedFactions[fi];
    const newKnown = new Set(faction.knownFactions || []);

    // Check all visible tiles for this faction's units — do they see other factions?
    // For the human player, use the newVisible set
    // For AI, calculate their visibility
    const visibleSet = fi === state.currentFaction
      ? newVisible
      : calculateVisibility(finalState, fi);

    // Check units on visible tiles
    for (const [, unit] of finalState.units) {
      if (unit.owner === fi || unit.owner < 0) continue;
      const uKey = hexKey(unit.q, unit.r);
      if (visibleSet.has(uKey) && !newKnown.has(unit.owner)) {
        newKnown.add(unit.owner);
        // Mutual contact
        const otherKnown = new Set(updatedFactions[unit.owner].knownFactions || []);
        if (!otherKnown.has(fi)) {
          otherKnown.add(fi);
          updatedFactions[unit.owner] = { ...updatedFactions[unit.owner], knownFactions: otherKnown };
        }
        if (fi === state.currentFaction) {
          finalState.log = [...finalState.log, `Contact established with ${updatedFactions[unit.owner].name}!`];
          contactMade = true;
        } else if (unit.owner === state.currentFaction) {
          finalState.log = [...finalState.log, `${faction.name} has made contact with us!`];
          contactMade = true;
        }
      }
    }

    // Check bases on visible tiles
    for (const [, base] of finalState.bases) {
      if (base.owner === fi) continue;
      const bKey = hexKey(base.q, base.r);
      if (visibleSet.has(bKey) && !newKnown.has(base.owner)) {
        newKnown.add(base.owner);
        const otherKnown = new Set(updatedFactions[base.owner].knownFactions || []);
        if (!otherKnown.has(fi)) {
          otherKnown.add(fi);
          updatedFactions[base.owner] = { ...updatedFactions[base.owner], knownFactions: otherKnown };
        }
        if (fi === state.currentFaction) {
          finalState.log = [...finalState.log, `Contact established with ${updatedFactions[base.owner].name}!`];
          contactMade = true;
        } else if (base.owner === state.currentFaction) {
          finalState.log = [...finalState.log, `${faction.name} has made contact with us!`];
          contactMade = true;
        }
      }
    }

    if (newKnown.size !== (faction.knownFactions?.size || 0)) {
      updatedFactions[fi] = { ...updatedFactions[fi], knownFactions: newKnown };
    }
  }

  finalState = { ...finalState, factions: updatedFactions };

  // Check victory conditions
  const victory = checkVictoryConditions(finalState);
  if (victory.winner !== null && victory.message) {
    finalState.log = [...finalState.log, `*** ${victory.message} ***`];
  }

  return finalState;
}
