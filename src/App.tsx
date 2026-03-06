// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Main Application
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from "react";
import HexMap from "./components/HexMap";
import InfoPanel from "./components/InfoPanel";
import DiplomacyScreen from "./components/DiplomacyScreen";
import Minimap from "./components/Minimap";
import { ProductionPrompt, ResearchPrompt, getTurnPrompts, TurnPrompt } from "./components/TurnPrompts";
import { hexKey } from "./game/hexMap";
import {
  GameState, initializeGame, moveUnit, foundBase, endTurn,
  changeProduction, chooseResearch, changeSocialEngineering,
  setUnitOrders, UnitType, FACTION_DEFS, FactionState
} from "./game/gameState";
import { soundManager, playSoundsForLog } from "./audio/soundSystem";
import { playTechVoice, playFacilityVoice, playFactionIntro, playOpeningNarration, TECH_VOICE_MAP } from "./audio/voiceSystem";
import { saveGame, loadGame, autoSave, loadAutoSave, hasSave, hasAutoSave, exportSaveToFile, importSaveFromFile, getSaveInfo } from "./game/saveLoad";
import { checkVictoryConditions } from "./game/projectsAndVictory";
import { setTreaty, TreatyType } from "./game/diplomacy";

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
  const [diplomacyTarget, setDiplomacyTarget] = useState<FactionState | null>(null);
  const [turnPrompts, setTurnPrompts] = useState<TurnPrompt[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mapCamera, setMapCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [mapViewSize, setMapViewSize] = useState({ w: 800, h: 600 });
  const [minimapCameraTarget, setMinimapCameraTarget] = useState<{x:number,y:number}|null>(null);
  const [victoryMessage, setVictoryMessage] = useState<string | null>(null);
  const prevLogLength = useRef(0);
  const audioInitialized = useRef(false);

  // ─── Game Setup ────────────────────────────────────────

  const startGame = useCallback(() => {
    // Init audio on first user interaction
    if (!audioInitialized.current) {
      soundManager.init();
      soundManager.preload([
        "turn_complete", "prod_complete", "new_orders", "new_data",
        "base_founded", "combat_report", "menu_click", "ok",
        "terraform_complete", "mind_worm_attack", "resource_shortfall",
      ]);
      audioInitialized.current = true;
    }

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

    // Play opening narration
    setTimeout(() => playOpeningNarration("f"), 500);

    // Check initial prompts (research needed at game start)
    const prompts = getTurnPrompts(state);
    if (prompts.length > 0) {
      setTurnPrompts(prompts);
      setCurrentPromptIndex(0);
    }
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
      soundManager.play("base_founded");
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
    if (type === "road") {
      // Road is separate — can coexist with other improvements
      newTiles.set(key, { ...tile, road: true });
    } else {
      newTiles.set(key, { ...tile, improvement: type });
    }

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
    const oldLogLen = gameState.log.length;
    const playerFaction = gameState.factions[gameState.currentFaction];
    const newState = endTurn(gameState);
    setGameState(newState);

    // Play sounds for new log entries
    playSoundsForLog(newState.log, oldLogLen);
    soundManager.play("turn_complete");

    // Check for voice-over triggers in new log entries (player faction only)
    const newEntries = newState.log.slice(oldLogLen);
    for (const entry of newEntries) {
      // Tech discovery voice-over
      if (entry.includes("discovers") && playerFaction && entry.includes(playerFaction.name)) {
        const techMatch = entry.match(/discovers (.+)!/);
        if (techMatch) {
          const techName = techMatch[1].toLowerCase();
          // Match tech name to voice map key
          for (const key of Object.keys(TECH_VOICE_MAP)) {
            const normalName = key.replace(/_/g, " ");
            if (techName === normalName || techName.startsWith(normalName.slice(0, 12))) {
              playTechVoice(key);
              break;
            }
          }
        }
      }

      // Facility completion voice-over
      if (entry.includes("completed!") && !entry.includes("discovers")) {
        const facMatch = entry.match(/: (.+) completed!/);
        if (facMatch) {
          const itemName = facMatch[1];
          // Try to match facility name to voice key
          const facilityKeys: Record<string, string> = {
            "Recycling Tanks": "recycling_tanks",
            "Network Node": "network_node",
            "Energy Bank": "energy_bank",
            "Perimeter Defense": "perimeter_defense",
            "Recreation Commons": "recreation_commons",
            "Children's Creche": "children_creche",
            "Command Center": "command_center",
            "Research Hospital": "research_hospital",
            "Tree Farm": "tree_farm",
            "Hab Complex": "hab_complex",
            "Biology Lab": "biology_lab",
            "Hologram Theatre": "hologram_theatre",
            "Fusion Lab": "fusion_lab",
            "Aerospace Complex": "aerospace_complex",
            "Genejack Factory": "genejack_factory",
            "Robotic Assembly Plant": "robotic_assembly",
            "Pressure Dome": "pressure_dome",
            "Centauri Preserve": "centauri_preserve",
            "Skunkworks": "skunkworks",
          };
          const facKey = facilityKeys[itemName];
          if (facKey) {
            playFacilityVoice(facKey);
          }
        }
      }
    }

    // Check for prompts after turn
    const prompts = getTurnPrompts(newState);
    if (prompts.length > 0) {
      setTurnPrompts(prompts);
      setCurrentPromptIndex(0);
      soundManager.play("new_orders");
    }

    // Autosave every 5 turns
    if (newState.turn % 5 === 0) {
      autoSave(newState);
    }

    // Check for victory
    const victory = checkVictoryConditions(newState);
    if (victory.winner !== null && victory.message) {
      setVictoryMessage(victory.message);
    }
  }, [gameState]);

  const handleChangeProduction = useCallback((baseId: string, buildKey: string) => {
    if (!gameState) return;
    setGameState(changeProduction(gameState, baseId, buildKey));
  }, [gameState]);

  const handleChooseResearch = useCallback((techKey: string) => {
    if (!gameState) return;
    setGameState(chooseResearch(gameState, techKey));
  }, [gameState]);

  const handleChangeSE = useCallback((category: string, choiceKey: string) => {
    if (!gameState) return;
    setGameState(changeSocialEngineering(gameState, category as any, choiceKey));
  }, [gameState]);

  const handleSetOrders = useCallback((orders: string | null) => {
    if (!gameState?.selectedUnit) return;
    setGameState(setUnitOrders(gameState, gameState.selectedUnit, orders));
  }, [gameState]);

  // ─── Keyboard Shortcuts ────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!gameState) return;
      // Block shortcuts when modals are open
      if (turnPrompts.length > 0 || diplomacyTarget) return;

      // Save/Load
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (gameState) {
          saveGame(gameState);
          setGameState({ ...gameState, log: [...gameState.log, "Game saved."] });
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        const loaded = loadGame();
        if (loaded) {
          setGameState(loaded);
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        handleEndTurn();
      }
      if (e.key === "b" || e.key === "B") {
        handleFoundBase();
      }
      if (e.key === "f" && !e.shiftKey) handleBuildImprovement("farm");
      if (e.key === "F" && e.shiftKey) handleSetOrders("fortify");
      if (e.key === "m") handleBuildImprovement("mine");
      if (e.key === "s") handleBuildImprovement("solar");
      if (e.key === "p") handleBuildImprovement("forest");
      if (e.key === "r") handleBuildImprovement("road");
      if (e.key === "e" || e.key === "E") {
        const el = document.getElementById("se-picker");
        if (el) el.style.display = el.style.display === "none" ? "block" : "none";
      }
      // Unit order shortcuts
      if (e.key === "a" || e.key === "A") handleSetOrders("auto");
      if (e.key === "l" || e.key === "L") handleSetOrders("sentry");
      if (e.key === "h" || e.key === "H") handleSetOrders("hold");
      if (e.key === "z") handleSetOrders(null); // cancel orders / skip turn
      if (e.key === "d" || e.key === "D") {
        // Open diplomacy with first known AI faction
        if (gameState) {
          const playerKnown = gameState.factions[gameState.currentFaction]?.knownFactions || new Set();
          const firstKnownAI = gameState.factions.find(f => !f.isHuman && f.id !== gameState.currentFaction && playerKnown.has(f.id));
          if (firstKnownAI) {
            setDiplomacyTarget(firstKnownAI);
            playFactionIntro(firstKnownAI.key);
          }
        }
      }
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
  }, [gameState, handleEndTurn, handleFoundBase, handleBuildImprovement, handleSetOrders, turnPrompts, diplomacyTarget]);

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
          {(hasSave() || hasAutoSave()) && (
            <button
              style={{ ...setupStyles.startBtn, background: "#111a2a", marginTop: 8 }}
              onClick={() => {
                if (!audioInitialized.current) {
                  soundManager.init();
                  audioInitialized.current = true;
                }
                const loaded = loadGame() || loadAutoSave();
                if (loaded) {
                  setGameState(loaded);
                  setShowSetup(false);
                }
              }}
            >
              ▸ CONTINUE SAVED GAME
              {(() => {
                const info = getSaveInfo() || getSaveInfo("chiron_rising_autosave");
                return info ? ` (Turn ${info.turn}, ${info.faction})` : "";
              })()}
            </button>
          )}
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
          onCameraChange={(x, y, z, vw, vh) => {
            setMapCamera({ x, y, zoom: z });
            setMapViewSize({ w: vw, h: vh });
          }}
          setCameraTo={minimapCameraTarget}
        />
        {/* Minimap */}
        <Minimap
          gameState={gameState}
          camera={mapCamera}
          zoom={mapCamera.zoom}
          viewWidth={mapViewSize.w}
          viewHeight={mapViewSize.h}
          onClickMap={(x, y) => setMinimapCameraTarget({ x, y })}
        />
        {/* Top bar */}
        <div style={gameStyles.topBar}>
          <span style={gameStyles.topBarTitle}>CHIRON RISING</span>
          <span style={gameStyles.topBarInfo}>
            {gameState.factions[gameState.currentFaction]?.leaderName}
            {" · M.Y. "}{gameState.year}
            {" · Turn "}{gameState.turn}
          </span>
          <div style={{ display: "flex", gap: 4, marginLeft: 8, pointerEvents: "auto" }}>
            <button
              style={gameStyles.topBarBtn}
              onClick={() => {
                saveGame(gameState);
                setGameState({ ...gameState, log: [...gameState.log, "Game saved."] });
              }}
              title="Save (Ctrl+S)"
            >💾</button>
            <button
              style={gameStyles.topBarBtn}
              onClick={() => {
                const loaded = loadGame();
                if (loaded) setGameState(loaded);
              }}
              title="Load (Ctrl+L)"
            >📂</button>
            <button
              style={gameStyles.topBarBtn}
              onClick={() => exportSaveToFile(gameState)}
              title="Export save to file"
            >📤</button>
            <button
              style={gameStyles.topBarBtn}
              onClick={async () => {
                const loaded = await importSaveFromFile();
                if (loaded) setGameState(loaded);
              }}
              title="Import save from file"
            >📥</button>
          </div>
          <button
            style={{
              background: "none",
              border: "1px solid #1a2a44",
              color: soundEnabled ? "#88aacc" : "#556677",
              padding: "2px 8px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Rajdhani', sans-serif",
              marginLeft: 8,
              pointerEvents: "auto",
            }}
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundManager.setEnabled(next);
              if (next) soundManager.play("ok");
            }}
            title={soundEnabled ? "Mute sounds" : "Enable sounds"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </div>
      <InfoPanel
        gameState={gameState}
        onFoundBase={handleFoundBase}
        onBuildImprovement={handleBuildImprovement}
        onEndTurn={handleEndTurn}
        onChangeProduction={handleChangeProduction}
        onChooseResearch={handleChooseResearch}
        onChangeSE={handleChangeSE}
        onSetOrders={handleSetOrders}
        onContactFaction={(factionId: number) => {
          const target = gameState.factions[factionId];
          if (target && !target.isHuman) {
            setDiplomacyTarget(target);
            playFactionIntro(target.key);
          }
        }}
      />
      {/* Victory Screen */}
      {victoryMessage && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
          fontFamily: "'Rajdhani', sans-serif",
        }}>
          <div style={{
            background: "linear-gradient(180deg, #0c1a2a 0%, #060a14 100%)",
            border: "1px solid #2a4466", borderRadius: 6, padding: "40px 50px",
            maxWidth: 500, textAlign: "center",
            boxShadow: "0 0 80px rgba(30,80,140,0.3)",
          }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, color: "#ffcc44", letterSpacing: "0.15em", marginBottom: 16 }}>
              VICTORY
            </div>
            <div style={{ fontSize: 15, color: "#b0c4d8", lineHeight: 1.6, marginBottom: 24 }}>
              {victoryMessage}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                style={{ ...gameStyles.topBarBtn, padding: "8px 20px", fontSize: 13, pointerEvents: "auto" }}
                onClick={() => setVictoryMessage(null)}
              >
                Continue Playing
              </button>
              <button
                style={{ ...gameStyles.topBarBtn, padding: "8px 20px", fontSize: 13, pointerEvents: "auto", borderColor: "#ffcc44", color: "#ffcc44" }}
                onClick={() => { setVictoryMessage(null); setShowSetup(true); setGameState(null); }}
              >
                New Game
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Diplomacy Overlay */}
      {diplomacyTarget && (
        <DiplomacyScreen
          gameState={gameState}
          targetFaction={diplomacyTarget}
          onClose={() => setDiplomacyTarget(null)}
          onSetTreaty={(factionId: number, treaty: TreatyType) => {
            const newState = setTreaty(gameState, gameState.currentFaction, factionId, treaty);
            const treatyName = treaty === "treaty" ? "Treaty of Friendship" : treaty === "pact" ? "Pact of Brotherhood" : treaty === "vendetta" ? "Vendetta" : "No Treaty";
            setGameState({
              ...newState,
              log: [...newState.log, `Diplomatic status with ${gameState.factions[factionId]?.name}: ${treatyName}`],
            });
          }}
        />
      )}
      {/* Turn Prompts */}
      {turnPrompts.length > 0 && currentPromptIndex < turnPrompts.length && (() => {
        const prompt = turnPrompts[currentPromptIndex];
        const advancePrompt = () => {
          if (currentPromptIndex + 1 < turnPrompts.length) {
            setCurrentPromptIndex(currentPromptIndex + 1);
          } else {
            setTurnPrompts([]);
            setCurrentPromptIndex(0);
          }
        };

        if (prompt.type === "production" && prompt.baseId) {
          return (
            <ProductionPrompt
              gameState={gameState}
              baseId={prompt.baseId}
              baseName={prompt.baseName || "Unknown Base"}
              completedItem={prompt.completedItem}
              onSelect={(baseId, buildKey) => {
                soundManager.play("ok");
                setGameState(changeProduction(gameState, baseId, buildKey));
                advancePrompt();
              }}
              onSkip={() => {
                soundManager.play("menu_back");
                setGameState(changeProduction(gameState, prompt.baseId!, "stockpile_energy"));
                advancePrompt();
              }}
            />
          );
        }

        if (prompt.type === "research") {
          return (
            <ResearchPrompt
              gameState={gameState}
              onSelect={(techKey) => {
                soundManager.play("ok");
                setGameState(chooseResearch(gameState, techKey));
                advancePrompt();
              }}
              onSkip={() => {
                soundManager.play("menu_back");
                advancePrompt();
              }}
            />
          );
        }

        return null;
      })()}
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
  topBarBtn: {
    background: "none",
    border: "1px solid #1a2a44",
    color: "#88aacc",
    padding: "2px 6px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'Rajdhani', sans-serif",
    borderRadius: 2,
    pointerEvents: "auto",
  } as React.CSSProperties,
};
