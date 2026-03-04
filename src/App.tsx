// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Main Application
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from "react";
import HexMap from "./components/HexMap";
import InfoPanel from "./components/InfoPanel";
import { hexKey } from "./game/hexMap";
import {
  GameState, initializeGame, moveUnit, foundBase, endTurn,
  changeProduction, chooseResearch, UnitType, FACTION_DEFS
} from "./game/gameState";

// ─── Base Name Generator ─────────────────────────────────────

const BASE_NAMES = [
  "Gaia's Landing", "New Dawn", "Planetfall", "Landing Site Alpha",
  "First Colony", "Chiron's Hope", "Unity Point", "Promise",
  "Haven", "Threshold", "Vanguard", "Foundation",
  "Pioneer's Rest", "Manifest", "Beacon", "Terminus",
  "Emerald Heights", "Dustfield", "Starfall", "Cradle",
];
let baseNameIdx = 0;

function getNextBaseName(): string {
  return BASE_NAMES[baseNameIdx++ % BASE_NAMES.length];
}

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showSetup, setShowSetup] = useState(true);
  const [selectedFaction, setSelectedFaction] = useState(0);

  // ─── Game Setup ────────────────────────────────────────

  const startGame = useCallback(() => {
    const state = initializeGame(selectedFaction, 4, {
      width: 48,
      height: 32,
      seed: Date.now(),
      oceanPercent: 0.45,
      hillsFrequency: 0.35,
      fungusPercent: 0.12,
      riverCount: 8,
    });
    setGameState(state);
    setShowSetup(false);
  }, [selectedFaction]);

  // ─── Tile Click Handler ────────────────────────────────

  const handleTileClick = useCallback((q: number, r: number) => {
    if (!gameState) return;
    const key = hexKey(q, r);
    const tile = gameState.map.tiles.get(key);
    if (!tile) return;

    // If we have a selected unit with moves, try to move it
    if (gameState.selectedUnit) {
      const unit = gameState.units.get(gameState.selectedUnit);
      if (unit && unit.movesLeft > 0 && unit.owner === gameState.currentFaction) {
        // Check if clicking adjacent tile
        const dist = Math.max(
          Math.abs(unit.q - q),
          Math.abs(unit.r - r),
          Math.abs((-unit.q - unit.r) - (-q - r))
        );
        if (dist === 1) {
          const newState = moveUnit(gameState, gameState.selectedUnit, q, r);
          setGameState({ ...newState, selectedTile: key });
          return;
        }
      }
    }

    // Otherwise, select a unit at this tile or just select the tile
    const unitsHere = Array.from(gameState.units.values())
      .filter(u => u.q === q && u.r === r && u.owner === gameState.currentFaction);

    if (unitsHere.length > 0) {
      // Cycle through units if clicking same tile
      const currentIdx = unitsHere.findIndex(u => u.id === gameState.selectedUnit);
      const nextUnit = unitsHere[(currentIdx + 1) % unitsHere.length];
      setGameState({ ...gameState, selectedUnit: nextUnit.id, selectedTile: key });
    } else {
      setGameState({ ...gameState, selectedUnit: null, selectedTile: key });
    }
  }, [gameState]);

  // ─── Right Click ───────────────────────────────────────

  const handleTileRightClick = useCallback((q: number, r: number) => {
    if (!gameState) return;
    // Deselect
    setGameState({ ...gameState, selectedUnit: null, selectedTile: null });
  }, [gameState]);

  // ─── Actions ───────────────────────────────────────────

  const handleFoundBase = useCallback(() => {
    if (!gameState?.selectedUnit) return;
    const name = prompt("Name your base:", getNextBaseName());
    if (name) {
      setGameState(foundBase(gameState, gameState.selectedUnit, name));
    }
  }, [gameState]);

  const handleBuildImprovement = useCallback((type: string) => {
    if (!gameState?.selectedUnit) return;
    const unit = gameState.units.get(gameState.selectedUnit);
    if (!unit || unit.type !== UnitType.Former) return;

    const key = hexKey(unit.q, unit.r);
    const tile = gameState.map.tiles.get(key);
    if (!tile) return;

    const newTiles = new Map(gameState.map.tiles);
    newTiles.set(key, { ...tile, improvement: type });

    const newUnits = new Map(gameState.units);
    newUnits.set(unit.id, { ...unit, movesLeft: 0 });

    const log = [...gameState.log, `Terraformer: ${type} built at (${unit.q}, ${unit.r})`];
    setGameState({
      ...gameState,
      map: { ...gameState.map, tiles: newTiles },
      units: newUnits,
      log,
    });
  }, [gameState]);

  const handleEndTurn = useCallback(() => {
    if (!gameState) return;
    setGameState(endTurn(gameState));
  }, [gameState]);

  const handleChangeProduction = useCallback((baseId: string, buildKey: string) => {
    if (!gameState) return;
    setGameState(changeProduction(gameState, baseId, buildKey));
  }, [gameState]);

  const handleChooseResearch = useCallback((techKey: string) => {
    if (!gameState) return;
    setGameState(chooseResearch(gameState, techKey));
  }, [gameState]);

  // ─── Keyboard Shortcuts ────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!gameState) return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleEndTurn();
      }
      if (e.key === "b" || e.key === "B") {
        handleFoundBase();
      }
      if (e.key === "f") handleBuildImprovement("farm");
      if (e.key === "m") handleBuildImprovement("mine");
      if (e.key === "s") handleBuildImprovement("solar");
      if (e.key === "p") handleBuildImprovement("forest");
      if (e.key === "r") handleBuildImprovement("road");
      if (e.key === "Escape") {
        setGameState({ ...gameState, selectedUnit: null, selectedTile: null });
      }

      // Numpad movement for selected unit (pointy-top hex directions)
      // Also support arrow-key style with Home/End/PgUp/PgDn
      const numpadDirs: Record<string, { dq: number; dr: number }> = {
        "7":         { dq: 0,  dr: -1 },  // upper-left
        "Home":      { dq: 0,  dr: -1 },
        "9":         { dq: 1,  dr: -1 },  // upper-right
        "PageUp":    { dq: 1,  dr: -1 },
        "4":         { dq: -1, dr: 0 },   // left
        "ArrowLeft": { dq: -1, dr: 0 },
        "6":         { dq: 1,  dr: 0 },   // right
        "ArrowRight":{ dq: 1,  dr: 0 },
        "1":         { dq: -1, dr: 1 },   // lower-left
        "End":       { dq: -1, dr: 1 },
        "3":         { dq: 0,  dr: 1 },   // lower-right
        "PageDown":  { dq: 0,  dr: 1 },
      };

      const dir = numpadDirs[e.key];
      if (dir && gameState.selectedUnit) {
        const unit = gameState.units.get(gameState.selectedUnit);
        if (unit && unit.movesLeft > 0 && unit.owner === gameState.currentFaction) {
          const toQ = unit.q + dir.dq;
          const toR = unit.r + dir.dr;
          const newState = moveUnit(gameState, gameState.selectedUnit, toQ, toR);
          const key = hexKey(toQ, toR);
          setGameState({ ...newState, selectedTile: key });
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gameState, handleEndTurn, handleFoundBase, handleBuildImprovement]);

  // ─── Setup Screen ──────────────────────────────────────

  if (showSetup) {
    return (
      <div style={setupStyles.container}>
        <div style={setupStyles.overlay} />
        <div style={setupStyles.content}>
          <h1 style={setupStyles.title}>CHIRON RISING</h1>
          <p style={setupStyles.subtitle}>A New Chapter on Planet</p>

          <div style={setupStyles.factionList}>
            <div style={setupStyles.label}>SELECT YOUR FACTION</div>
            {FACTION_DEFS.map((def, i) => (
              <button
                key={def.key}
                style={{
                  ...setupStyles.factionBtn,
                  borderColor: i === selectedFaction ? def.color : "#1a2a44",
                  color: i === selectedFaction ? def.color : "#556677",
                  background: i === selectedFaction ? def.color + "11" : "transparent",
                }}
                onClick={() => setSelectedFaction(i)}
              >
                <span style={{ fontWeight: 700 }}>{def.leaderName}</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}> — {def.name}</span>
              </button>
            ))}
          </div>

          <button style={setupStyles.startBtn} onClick={startGame}>
            ▸ COMMENCE PLANETFALL
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Game UI ──────────────────────────────────────

  if (!gameState) return null;

  return (
    <div style={gameStyles.container}>
      <div style={gameStyles.mapArea}>
        <HexMap
          gameState={gameState}
          onTileClick={handleTileClick}
          onTileRightClick={handleTileRightClick}
        />
        {/* Top bar */}
        <div style={gameStyles.topBar}>
          <span style={gameStyles.topBarTitle}>CHIRON RISING</span>
          <span style={gameStyles.topBarInfo}>
            {gameState.factions[gameState.currentFaction]?.leaderName}
            {" · M.Y. "}{gameState.year}
            {" · Turn "}{gameState.turn}
          </span>
        </div>
      </div>
      <InfoPanel
        gameState={gameState}
        onFoundBase={handleFoundBase}
        onBuildImprovement={handleBuildImprovement}
        onEndTurn={handleEndTurn}
        onChangeProduction={handleChangeProduction}
        onChooseResearch={handleChooseResearch}
      />
    </div>
  );
}

// ─── Setup Screen Styles ─────────────────────────────────

const setupStyles: Record<string, React.CSSProperties> = {
  container: {
    width: "100vw",
    height: "100vh",
    background: "#060a12",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Rajdhani', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(ellipse at 30% 50%, #0a1a2a 0%, transparent 70%), radial-gradient(ellipse at 70% 80%, #1a0a1a 0%, transparent 60%)",
    pointerEvents: "none",
  },
  content: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
  },
  title: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: 48,
    color: "#e0e8f0",
    letterSpacing: "0.15em",
    fontWeight: 900,
    textShadow: "0 0 60px #22cc5533, 0 0 120px #22cc5511",
    margin: 0,
  },
  subtitle: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 14,
    color: "#445566",
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    marginTop: -12,
  },
  factionList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: 420,
    marginTop: 12,
  },
  label: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: 10,
    color: "#334455",
    letterSpacing: "0.25em",
    marginBottom: 8,
  },
  factionBtn: {
    background: "transparent",
    border: "1px solid #1a2a44",
    padding: "10px 16px",
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.2s",
  },
  startBtn: {
    marginTop: 16,
    background: "#22cc5515",
    border: "1px solid #22cc55",
    color: "#22cc55",
    padding: "12px 48px",
    fontFamily: "'Orbitron', sans-serif",
    fontSize: 13,
    letterSpacing: "0.15em",
    cursor: "pointer",
    transition: "all 0.2s",
  },
};

// ─── Game Screen Styles ──────────────────────────────────

const gameStyles: Record<string, React.CSSProperties> = {
  container: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    background: "#060a12",
    overflow: "hidden",
  },
  mapArea: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    background: "linear-gradient(180deg, #0a0e18ee 0%, #0a0e1800 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    pointerEvents: "none",
  },
  topBarTitle: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: 11,
    color: "#334455",
    letterSpacing: "0.2em",
  },
  topBarInfo: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    color: "#445566",
  },
};
