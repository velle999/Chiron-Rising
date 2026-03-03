// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Info Panel (Sidebar)
// ═══════════════════════════════════════════════════════════════

import { GameState, getTileResources, Unit, UnitType, Base } from "../game/gameState";
import { hexKey, MapTile, Terrain, Moisture } from "../game/hexMap";

interface InfoPanelProps {
  gameState: GameState;
  onFoundBase: () => void;
  onBuildImprovement: (type: string) => void;
  onEndTurn: () => void;
}

export default function InfoPanel({ gameState, onFoundBase, onBuildImprovement, onEndTurn }: InfoPanelProps) {
  const { selectedTile, selectedUnit, map, units, bases, factions, currentFaction, turn, year, log } = gameState;
  const playerFaction = factions[currentFaction];

  // Get selected tile info
  const tile = selectedTile ? map.tiles.get(selectedTile) : null;
  const resources = tile ? getTileResources(tile) : null;

  // Get selected unit
  const unit = selectedUnit ? units.get(selectedUnit) : null;

  // Find base at selected tile
  const baseAtTile = tile ? Array.from(bases.values()).find(b => b.q === tile.q && b.r === tile.r) : null;

  // Units at selected tile
  const unitsAtTile = tile
    ? Array.from(units.values()).filter(u => u.q === tile.q && u.r === tile.r)
    : [];

  const terrainNames: Record<string, string> = {
    [Terrain.DeepOcean]: "Deep Ocean",
    [Terrain.Ocean]: "Ocean",
    [Terrain.Shelf]: "Continental Shelf",
    [Terrain.Flat]: "Flat",
    [Terrain.Rolling]: "Rolling",
    [Terrain.Hills]: "Hills",
    [Terrain.Mountains]: "Mountains",
    [Terrain.Fungus]: "Xenofungus",
  };

  const unitTypeNames: Record<string, string> = {
    [UnitType.Colony]: "Colony Pod",
    [UnitType.Former]: "Terraformer",
    [UnitType.Scout]: "Scout Patrol",
    [UnitType.Infantry]: "Garrison",
    [UnitType.Speeder]: "Speeder",
    [UnitType.Mindworm]: "Mind Worm",
  };

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.factionName}>{playerFaction?.name || "Unknown"}</div>
        <div style={styles.yearDisplay}>M.Y. {year}</div>
        <div style={styles.turnDisplay}>Turn {turn}</div>
      </div>

      {/* Resources */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>TREASURY</div>
        <div style={styles.resourceRow}>
          <span style={{ color: "#ffcc00" }}>⚡ {playerFaction?.energy || 0}</span>
          <span style={{ color: "#88aacc" }}> Energy Credits</span>
        </div>
      </div>

      {/* Tile Info */}
      {tile && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>TERRAIN</div>
          <div style={styles.tileInfo}>
            <div>{terrainNames[tile.terrain] || tile.terrain}</div>
            <div style={styles.dim}>
              {tile.moisture !== Moisture.Moderate ? tile.moisture + " · " : ""}
              Elev: {tile.elevation}
              {tile.river ? " · River" : ""}
              {tile.fungus ? " · Fungus" : ""}
              {tile.bonus ? " · Bonus" : ""}
            </div>
            {tile.improvement && (
              <div style={styles.improvement}>⚙ {tile.improvement}</div>
            )}
          </div>
          {resources && (tile.terrain !== Terrain.DeepOcean && tile.terrain !== Terrain.Ocean) && (
            <div style={styles.resourceGrid}>
              <span style={{ color: "#44cc66" }}>🌿 {resources.nutrients}</span>
              <span style={{ color: "#cc8833" }}>⛏ {resources.minerals}</span>
              <span style={{ color: "#ffcc00" }}>⚡ {resources.energy}</span>
            </div>
          )}
        </div>
      )}

      {/* Base Info */}
      {baseAtTile && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>BASE</div>
          <div style={styles.baseName}>{baseAtTile.name}</div>
          <div style={styles.dim}>
            Pop: {baseAtTile.population} ·
            Minerals: {baseAtTile.storedMinerals} ·
            Food: {baseAtTile.storedNutrients}
          </div>
          <div style={styles.dim}>
            Facilities: {baseAtTile.facilities.join(", ") || "none"}
          </div>
        </div>
      )}

      {/* Unit Info */}
      {unit && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>UNIT</div>
          <div style={styles.unitName}>{unitTypeNames[unit.type] || unit.type}</div>
          <div style={styles.dim}>
            HP: {unit.health}/{unit.maxHealth} ·
            Moves: {unit.movesLeft}/{unit.maxMoves}
          </div>
          {unit.attack > 0 && (
            <div style={styles.dim}>
              Atk: {unit.attack} · Def: {unit.defense}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>ORDERS</div>
        <div style={styles.actions}>
          {unit?.type === UnitType.Colony && unit.owner === currentFaction && (
            <button style={styles.actionBtn} onClick={onFoundBase}>
              [B] Found Base
            </button>
          )}
          {unit?.type === UnitType.Former && unit.owner === currentFaction && tile &&
            tile.terrain !== Terrain.Ocean && tile.terrain !== Terrain.DeepOcean && (
            <>
              <button style={styles.actionBtn} onClick={() => onBuildImprovement("farm")}>
                [F] Build Farm
              </button>
              <button style={styles.actionBtn} onClick={() => onBuildImprovement("mine")}>
                [M] Build Mine
              </button>
              <button style={styles.actionBtn} onClick={() => onBuildImprovement("solar")}>
                [S] Solar Collector
              </button>
              <button style={styles.actionBtn} onClick={() => onBuildImprovement("forest")}>
                [P] Plant Forest
              </button>
              <button style={styles.actionBtn} onClick={() => onBuildImprovement("road")}>
                [R] Build Road
              </button>
            </>
          )}
          <button style={{ ...styles.actionBtn, ...styles.endTurnBtn }} onClick={onEndTurn}>
            [ENTER] End Turn
          </button>
        </div>
      </div>

      {/* Log */}
      <div style={{ ...styles.section, flex: 1, overflow: "hidden" }}>
        <div style={styles.sectionTitle}>PLANETARY LOG</div>
        <div style={styles.log}>
          {[...log].reverse().slice(0, 12).map((entry, i) => (
            <div key={i} style={{ ...styles.logEntry, opacity: 1 - i * 0.06 }}>
              {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 280,
    height: "100%",
    background: "linear-gradient(180deg, #0a0e18 0%, #0d1220 100%)",
    borderLeft: "1px solid #1a2a44",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Rajdhani', sans-serif",
    color: "#b0c4d8",
    fontSize: 13,
    overflow: "hidden",
  },
  header: {
    padding: "14px 16px 10px",
    borderBottom: "1px solid #1a2a44",
    background: "linear-gradient(180deg, #0f1628 0%, transparent 100%)",
  },
  factionName: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: 11,
    color: "#22cc55",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  yearDisplay: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 20,
    color: "#e0e8f0",
    fontWeight: "bold",
  },
  turnDisplay: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    color: "#556677",
  },
  section: {
    padding: "10px 16px",
    borderBottom: "1px solid #111a2a",
  },
  sectionTitle: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: 9,
    color: "#445566",
    letterSpacing: "0.2em",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  tileInfo: {
    lineHeight: 1.5,
  },
  dim: {
    color: "#556677",
    fontSize: 11,
  },
  improvement: {
    color: "#88aacc",
    marginTop: 2,
  },
  resourceGrid: {
    display: "flex",
    gap: 12,
    marginTop: 6,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 13,
  },
  resourceRow: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 14,
  },
  baseName: {
    color: "#e0e8f0",
    fontSize: 15,
    fontWeight: 600,
  },
  unitName: {
    color: "#e0e8f0",
    fontSize: 14,
    fontWeight: 600,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  actionBtn: {
    background: "#111a2a",
    border: "1px solid #1a2a44",
    color: "#88aacc",
    padding: "6px 10px",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.15s",
  },
  endTurnBtn: {
    marginTop: 8,
    background: "#1a2233",
    borderColor: "#22cc55",
    color: "#22cc55",
  },
  log: {
    flex: 1,
    overflow: "auto",
  },
  logEntry: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    color: "#556677",
    padding: "2px 0",
    borderBottom: "1px solid #0a0f18",
  },
};
