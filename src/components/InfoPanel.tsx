// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Info Panel (Sidebar)
// ═══════════════════════════════════════════════════════════════

import { GameState, getTileResources, Unit, UnitType, Base, getBuildItem, getAvailableBuilds, BuildItem } from "../game/gameState";
import { getTech, getResearchableTechs, calculateLabsPerTurn, Tech } from "../game/techTree";
import {
  SocialEngineering, calculateSocialFactors, getAvailableChoices,
  getSocialChoice, ALL_FACTORS, getFactorEffect, SocialFactor
} from "../game/socialEngineering";
import { hexKey, MapTile, Terrain, Moisture } from "../game/hexMap";
import { getCombatOdds } from "../game/combat";
import { getTreaty, getTreatyDisplayName, getTreatyColor, TreatyType } from "../game/diplomacy";

interface InfoPanelProps {
  gameState: GameState;
  onFoundBase: () => void;
  onBuildImprovement: (type: string) => void;
  onEndTurn: () => void;
  onChangeProduction: (baseId: string, buildKey: string) => void;
  onChooseResearch: (techKey: string) => void;
  onChangeSE: (category: string, choiceKey: string) => void;
  onSetOrders: (orders: string | null) => void;
  onContactFaction: (factionId: number) => void;
  onSetSpecialist?: (baseId: string, citizenIndex: number, specType: string) => void;
}

export default function InfoPanel({ gameState, onFoundBase, onBuildImprovement, onEndTurn, onChangeProduction, onChooseResearch, onChangeSE, onSetOrders, onContactFaction, onSetSpecialist }: InfoPanelProps) {
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
        <div style={styles.turnDisplay}>
          Turn {turn} · {playerFaction?.discoveredTechs.length || 0} techs · {
            Array.from(bases.values()).filter(b => b.owner === currentFaction).length
          } bases
        </div>
      </div>

      {/* Resources */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>TREASURY</div>
        <div style={styles.resourceRow}>
          <span style={{ color: "#ffcc00" }}>⚡ {playerFaction?.energy || 0}</span>
          <span style={{ color: "#88aacc" }}> Energy Credits</span>
        </div>
      </div>

      {/* Research */}
      {playerFaction && (() => {
        const currentTech = playerFaction.currentResearch ? getTech(playerFaction.currentResearch) : null;
        const labsPerTurn = calculateLabsPerTurn(bases, currentFaction);
        const pct = currentTech ? Math.min(1, playerFaction.techProgress / currentTech.cost) : 0;
        const turnsLeft = currentTech ? Math.max(1, Math.ceil((currentTech.cost - playerFaction.techProgress) / Math.max(1, labsPerTurn))) : 0;
        const researchable = getResearchableTechs(playerFaction.discoveredTechs);

        return (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>RESEARCH</div>
            {currentTech ? (
              <>
                <div style={{ color: "#ccddee", fontSize: 13, fontWeight: 600 }}>{currentTech.name}</div>
                <div style={{
                  width: "100%", height: 6, background: "#0a1020",
                  borderRadius: 3, marginTop: 4, border: "1px solid #1a2a44",
                }}>
                  <div style={{
                    width: `${pct * 100}%`, height: "100%",
                    background: "linear-gradient(90deg, #3388dd, #55ccff)",
                    borderRadius: 3, transition: "width 0.3s",
                  }} />
                </div>
                <div style={{ color: "#667788", fontSize: 10, marginTop: 2 }}>
                  {playerFaction.techProgress}/{currentTech.cost} ({labsPerTurn} labs/turn · ~{turnsLeft} turns)
                </div>
              </>
            ) : (
              <div style={{ color: "#cc6644", fontSize: 12 }}>No research selected!</div>
            )}
            <button
              style={{ ...styles.actionBtn, marginTop: 6, fontSize: 11, padding: "3px 8px" }}
              onClick={() => {
                const el = document.getElementById("research-picker");
                if (el) el.style.display = el.style.display === "none" ? "block" : "none";
              }}
            >
              {currentTech ? "Change Research" : "Choose Research"}
            </button>
            <div id="research-picker" style={{ display: "none", marginTop: 6 }}>
              <div style={{ color: "#667788", fontSize: 10, marginBottom: 4 }}>
                AVAILABLE TECHNOLOGIES ({researchable.length}):
              </div>
              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                {researchable.map(tech => (
                  <button
                    key={tech.key}
                    style={{
                      ...styles.buildPickerBtn,
                      borderColor: tech.key === playerFaction.currentResearch ? "#3388dd" : "#1a2a44",
                    }}
                    onClick={() => {
                      onChooseResearch(tech.key);
                      const el = document.getElementById("research-picker");
                      if (el) el.style.display = "none";
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                      <span style={{ color: "#ccddee", fontSize: 12 }}>{tech.name}</span>
                      <span style={{ color: "#3388dd", fontSize: 11 }}>
                        {tech.cost} · ~{Math.ceil(tech.cost / Math.max(1, labsPerTurn))}t
                      </span>
                    </div>
                    <div style={{ color: "#556677", fontSize: 10, textAlign: "left" }}>
                      {tech.unlocks.slice(0, 2).join(", ")}
                    </div>
                  </button>
                ))}
                {researchable.length === 0 && (
                  <div style={{ color: "#556677", fontSize: 11 }}>No technologies available yet</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tile Info */}
      {tile && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>TERRAIN</div>
          <div style={styles.tileInfo}>
            <div>{terrainNames[tile.terrain] || tile.terrain}</div>
            <div style={styles.dim}>
              {tile.moisture} ·
              Elev: {Math.min(4, Math.floor(tile.elevation / 64) + 1)}
              {tile.river ? " · River" : ""}
              {tile.fungus ? " · Fungus" : ""}
              {tile.bonus ? " · Bonus" : ""}
            </div>
            {(tile.improvement || tile.road) && (
              <div style={styles.improvement}>
                ⚙ {[tile.improvement, tile.road ? "road" : null].filter(Boolean).join(" + ")}
              </div>
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

      {/* Base Info + Production */}
      {baseAtTile && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>BASE</div>
          <div style={styles.baseName}>{baseAtTile.name}</div>
          {/* Resource production summary */}
          {(() => {
            let totalN = 0, totalM = 0, totalE = 0;
            for (const tk of baseAtTile.workedTiles) {
              const tt = gameState.map.tiles.get(tk);
              if (tt) { const res = getTileResources(tt); totalN += res.nutrients; totalM += res.minerals; totalE += res.energy; }
            }
            totalN += 2; totalM += 1; totalE += 2; // base square
            const consumed = baseAtTile.population * 2;
            const surplus = totalN - consumed;
            return (
              <div style={{ fontSize: 11, display: "flex", gap: 8, marginBottom: 2 }}>
                <span style={{ color: "#44cc66" }}>🌿{totalN}<span style={{ color: "#557755", fontSize: 9 }}>({surplus >= 0 ? "+" : ""}{surplus})</span></span>
                <span style={{ color: "#cc8844" }}>⛏{totalM}</span>
                <span style={{ color: "#ffcc44" }}>⚡{totalE}</span>
                <span style={{ color: "#8899aa" }}>Pop:{baseAtTile.population}</span>
              </div>
            );
          })()}
          {/* Drone/Golden Age status */}
          {(() => {
            const pop = baseAtTile.population;
            let drones = Math.max(0, pop - 3);
            if (baseAtTile.facilities.includes("recreation_commons")) drones = Math.max(0, drones - 2);
            if (baseAtTile.facilities.includes("research_hospital")) drones = Math.max(0, drones - 1);
            if (baseAtTile.facilities.includes("hologram_theatre")) drones = Math.max(0, drones - 2);
            if (baseAtTile.facilities.includes("children_creche")) drones = Math.max(0, drones - 1);
            const talents = 1;
            const isDroneRiot = drones > talents;
            const isGoldenAge = talents >= pop && pop >= 3 && drones === 0;
            if (isDroneRiot) return <div style={{ color: "#cc4444", fontSize: 11, fontWeight: 700 }}>⚠ DRONE RIOTS — Production halted</div>;
            if (isGoldenAge) return <div style={{ color: "#ffcc44", fontSize: 11, fontWeight: 700 }}>★ GOLDEN AGE — Double growth</div>;
            if (drones > 0) return <div style={{ color: "#aa775588", fontSize: 10 }}>Drones: {drones} · Talents: {talents}</div>;
            return null;
          })()}
          <div style={{ ...styles.dim, fontSize: 10 }}>
            Facilities: {baseAtTile.facilities.filter(f => !f.startsWith("sp_")).join(", ") || "none"}
          </div>

          {/* Specialists */}
          {baseAtTile.owner === currentFaction && baseAtTile.population > 1 && (
            <div style={{ marginTop: 4, borderTop: "1px solid #1a2a44", paddingTop: 4 }}>
              <div style={{ fontSize: 9, color: "#556677", fontFamily: "'Orbitron', sans-serif", letterSpacing: "0.1em", marginBottom: 3 }}>
                CITIZENS ({baseAtTile.workedTiles.length} workers, {(baseAtTile.specialists || []).length} specialists)
              </div>
              {/* Current specialists */}
              {(baseAtTile.specialists || []).map((spec, i) => {
                const specInfo: Record<string, {label: string; color: string; desc: string}> = {
                  doctor:    { label: "Doctor",     color: "#44cc66", desc: "+2⚡ -1 drone" },
                  engineer:  { label: "Engineer",   color: "#cc8844", desc: "+3⛏" },
                  librarian: { label: "Librarian",  color: "#4488dd", desc: "+3⚡ labs" },
                  empath:    { label: "Empath",     color: "#cc44cc", desc: "+2⚡ -2 drones" },
                  transcend: { label: "Transcendi", color: "#ffcc44", desc: "+4⚡ +1🌿 +1⛏ +talent" },
                  worker:    { label: "Worker",     color: "#667788", desc: "no bonus" },
                };
                const info = specInfo[spec] || specInfo.worker;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, marginBottom: 1 }}>
                    <span style={{ color: info.color }}>{info.label} <span style={{ color: "#556677" }}>{info.desc}</span></span>
                  </div>
                );
              })}
              {/* Add specialist buttons */}
              {baseAtTile.workedTiles.length > 1 && onSetSpecialist && (
                <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginTop: 3 }}>
                  {(["doctor", "engineer", "librarian", "empath"] as const).map(specType => {
                    const labels: Record<string, string> = { doctor: "👨‍⚕️Doc", engineer: "🔧Eng", librarian: "📚Lib", empath: "🧠Emp" };
                    return (
                      <button
                        key={specType}
                        style={{ ...styles.actionBtn, fontSize: 9, padding: "1px 4px" }}
                        onClick={() => onSetSpecialist(baseAtTile.id, baseAtTile.workedTiles.length - 1, specType)}
                        title={`Convert a tile worker to ${specType}`}
                      >
                        {labels[specType]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Current Production */}
          {baseAtTile.owner === currentFaction && (() => {
            const buildItem = baseAtTile.currentBuild ? getBuildItem(baseAtTile.currentBuild) : null;
            // Also check custom designs
            let displayItem = buildItem;
            let displayCost = buildItem?.cost || 0;
            if (!displayItem && baseAtTile.currentBuild?.startsWith("custom_")) {
              const designs = gameState.customDesigns || [];
              const idx = parseInt(baseAtTile.currentBuild.split("_").pop() || "0") - 1;
              const design = designs[idx];
              if (design) {
                const stats = getTileResources(gameState.map.tiles.values().next().value); // dummy
                displayItem = { key: baseAtTile.currentBuild, name: design.name, category: "unit", cost: 0, description: "" };
              }
            }
            const cost = displayCost;
            const progress = baseAtTile.buildProgress;
            const pct = cost > 0 ? Math.min(1, progress / cost) : 0;
            // Calculate minerals per turn for ETA
            let mineralsPerTurn = 0;
            for (const tk of baseAtTile.workedTiles) {
              const tt = gameState.map.tiles.get(tk);
              if (tt) mineralsPerTurn += getTileResources(tt).minerals;
            }
            mineralsPerTurn += 1; // base square
            const turnsLeft = cost > 0 && mineralsPerTurn > 0 ? Math.max(1, Math.ceil((cost - progress) / mineralsPerTurn)) : 0;

            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: "#88aacc", fontSize: 11, marginBottom: 4 }}>BUILDING:</div>
                <div style={{ color: "#ccddee", fontSize: 13, fontWeight: 600 }}>
                  {buildItem ? buildItem.name : "— Nothing —"}
                </div>
                {buildItem && cost > 0 && (
                  <>
                    <div style={{
                      width: "100%", height: 6, background: "#0a1020",
                      borderRadius: 3, marginTop: 4, border: "1px solid #1a2a44",
                    }}>
                      <div style={{
                        width: `${pct * 100}%`, height: "100%",
                        background: `linear-gradient(90deg, #cc8833, #ffcc44)`,
                        borderRadius: 3, transition: "width 0.3s",
                      }} />
                    </div>
                    <div style={{ color: "#667788", fontSize: 10, marginTop: 2 }}>
                      {progress}/{cost} minerals
                    </div>
                  </>
                )}
                {/* Change production button */}
                <button
                  style={{ ...styles.actionBtn, marginTop: 6, fontSize: 11, padding: "3px 8px" }}
                  onClick={() => {
                    // Toggle production picker
                    const el = document.getElementById("prod-picker-" + baseAtTile.id);
                    if (el) el.style.display = el.style.display === "none" ? "block" : "none";
                  }}
                >
                  Change Production
                </button>

                {/* Production Picker (hidden by default) */}
                <div id={"prod-picker-" + baseAtTile.id} style={{ display: "none", marginTop: 6 }}>
                  <div style={{ color: "#667788", fontSize: 10, marginBottom: 4 }}>SELECT BUILD ORDER:</div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {getAvailableBuilds(baseAtTile, playerFaction?.discoveredTechs || [], gameState.completedProjects, gameState.customDesigns, gameState.bases).map(item => (
                      <button
                        key={item.key}
                        style={{
                          ...styles.buildPickerBtn,
                          borderColor: item.key === baseAtTile.currentBuild ? "#cc8833" : "#1a2a44",
                        }}
                        onClick={() => {
                          onChangeProduction(baseAtTile.id, item.key);
                          const el = document.getElementById("prod-picker-" + baseAtTile.id);
                          if (el) el.style.display = "none";
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                          <span style={{ color: "#ccddee", fontSize: 12 }}>{item.name}</span>
                          <span style={{ color: "#cc8833", fontSize: 11 }}>
                            {item.cost > 0 ? `${item.cost}⛏` : "∞"}
                          </span>
                        </div>
                        <div style={{ color: "#556677", fontSize: 10, textAlign: "left" }}>
                          {item.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
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
          {unit.orders && (
            <div style={{ color: "#44cc66", fontSize: 11, marginTop: 2 }}>
              Orders: {
                { auto: "Automated", auto_former: "Auto-Terraform", auto_scout: "Auto-Explore",
                  auto_patrol: "Auto-Patrol", sentry: "Sentry", hold: "Hold", fortify: "Fortify"
                }[unit.orders] || unit.orders
              }
            </div>
          )}
          {/* Combat odds preview — show when we have a selected friendly unit */}
          {unit.owner === currentFaction && unit.attack > 0 && (() => {
            // Find adjacent or same-tile enemies
            const nearbyEnemies = Array.from(units.values()).filter(u => {
              if (u.owner === currentFaction || u.owner === -2) return false;
              const dq = Math.abs(u.q - unit.q);
              const dr = Math.abs(u.r - unit.r);
              const ds = Math.abs((u.q + u.r) - (unit.q + unit.r));
              return Math.max(dq, dr, ds) <= 1 && (dq + dr + ds > 0);
            });
            if (nearbyEnemies.length === 0) return null;
            return (
              <div style={{ marginTop: 4, borderTop: "1px solid #1a2a44", paddingTop: 4 }}>
                <div style={{ fontSize: 10, color: "#cc6644", fontFamily: "'Orbitron', sans-serif", letterSpacing: "0.1em" }}>
                  COMBAT ODDS
                </div>
                {nearbyEnemies.slice(0, 3).map(enemy => {
                  const odds = getCombatOdds(gameState, unit, enemy);
                  const pct = Math.round(odds.attackerChance * 100);
                  const barColor = pct >= 60 ? "#44cc66" : pct >= 40 ? "#ccaa44" : "#cc4444";
                  return (
                    <div key={enemy.id} style={{ fontSize: 11, marginTop: 3 }}>
                      <div style={{ color: "#8899aa" }}>
                        vs {unitTypeNames[enemy.type] || enemy.type}
                        <span style={{ color: barColor, fontWeight: 700, marginLeft: 4 }}>{pct}%</span>
                      </div>
                      <div style={{ background: "#0a1020", height: 4, borderRadius: 2, marginTop: 2 }}>
                        <div style={{ background: barColor, height: "100%", borderRadius: 2, width: `${pct}%`, transition: "width 0.3s" }} />
                      </div>
                      {odds.defMods.length > 0 && (
                        <div style={{ fontSize: 9, color: "#556677", marginTop: 1 }}>
                          {odds.defMods.map(m => m.name).join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Social Engineering */}
      {playerFaction && (() => {
        const factors = calculateSocialFactors(playerFaction.key, playerFaction.socialEngineering);
        const se = playerFaction.socialEngineering;
        const categories: Array<{ key: keyof SocialEngineering; label: string }> = [
          { key: "politics", label: "POL" },
          { key: "economics", label: "ECON" },
          { key: "values", label: "VAL" },
          { key: "future", label: "FUT" },
        ];

        // Only show key non-zero factors
        const activeFacts = ALL_FACTORS.filter(f => factors[f] !== 0);

        return (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>SOCIAL ENGINEERING</div>
            {/* Current choices - compact */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
              {categories.map(cat => {
                const choice = getSocialChoice(se[cat.key]);
                return (
                  <span key={cat.key} style={{ fontSize: 10, color: "#88aacc" }}>
                    <span style={{ color: "#556677" }}>{cat.label}:</span> {choice?.name || "—"}
                  </span>
                );
              })}
            </div>
            {/* Active factors */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginBottom: 4 }}>
              {activeFacts.map(f => (
                <span key={f} style={{
                  fontSize: 10,
                  color: factors[f] > 0 ? "#44cc66" : "#cc4444",
                  fontFamily: "'Share Tech Mono', monospace",
                }}>
                  {f.slice(0, 4)}: {factors[f] > 0 ? "+" : ""}{factors[f]}
                </span>
              ))}
              {activeFacts.length === 0 && (
                <span style={{ fontSize: 10, color: "#556677" }}>No modifiers</span>
              )}
            </div>
            {/* Toggle SE picker */}
            <button
              style={{ ...styles.actionBtn, fontSize: 10, padding: "2px 8px" }}
              onClick={() => {
                const el = document.getElementById("se-picker");
                if (el) el.style.display = el.style.display === "none" ? "block" : "none";
              }}
            >
              [E] Social Engineering
            </button>
            <div id="se-picker" style={{ display: "none", marginTop: 6 }}>
              {categories.map(cat => {
                const choices = getAvailableChoices(cat.key, playerFaction.discoveredTechs, playerFaction.key);
                return (
                  <div key={cat.key} style={{ marginBottom: 6 }}>
                    <div style={{ color: "#667788", fontSize: 10, marginBottom: 2 }}>{cat.label}:</div>
                    <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                      {choices.map(c => (
                        <button
                          key={c.key}
                          style={{
                            ...styles.seChoiceBtn,
                            borderColor: se[cat.key] === c.key ? "#3388dd" : "#1a2a44",
                            color: se[cat.key] === c.key ? "#ccddee" : "#667788",
                          }}
                          title={c.description}
                          onClick={() => onChangeSE(cat.key, c.key)}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Secret Projects */}
      {gameState.completedProjects && gameState.completedProjects.size > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>SECRET PROJECTS</div>
          {Array.from(gameState.completedProjects.entries()).map(([key, info]) => {
            const item = getBuildItem(key);
            const ownerFaction = factions[info.owner];
            return (
              <div key={key} style={{ fontSize: 10, marginBottom: 2 }}>
                <span style={{ color: "#ffcc44" }}>{item?.name || key}</span>
                <span style={{ color: ownerFaction?.color || "#556677", marginLeft: 4 }}>
                  ({ownerFaction?.name.split(" ").pop() || "?"})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Diplomacy */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>DIPLOMACY</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {(() => {
            const playerKnown = playerFaction?.knownFactions || new Set<number>();
            const knownFactions = factions.filter(f => f.id !== currentFaction && !f.isHuman && playerKnown.has(f.id));
            if (knownFactions.length === 0) {
              return (
                <div style={{ fontSize: 10, color: "#445566", fontStyle: "italic", padding: "4px 0" }}>
                  No factions contacted yet. Explore to find them.
                </div>
              );
            }
            return knownFactions.map(f => {
              const treaty = getTreaty(gameState, currentFaction, f.id);
              const treatyColor = getTreatyColor(treaty);
              return (
                <button
                  key={f.id}
                  style={{
                    ...styles.actionBtn,
                    borderLeft: `3px solid ${f.color}`,
                    fontSize: 11,
                    padding: "3px 8px",
                  }}
                  onClick={() => onContactFaction(f.id)}
                >
                  <div>{f.leaderName}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                    <span style={{ color: treatyColor }}>{getTreatyDisplayName(treaty)}</span>
                    <span style={{ color: "#556677" }}>
                      {Array.from(bases.values()).filter(b => b.owner === f.id).length} bases
                    </span>
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </div>

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
          {/* Automation orders for any player unit */}
          {unit && unit.owner === currentFaction && (
            <>
              <button style={styles.actionBtn} onClick={() => onSetOrders("auto")}>
                [A] Automate
              </button>
              <button style={styles.actionBtn} onClick={() => onSetOrders("sentry")}>
                [L] Sentry
              </button>
              <button style={styles.actionBtn} onClick={() => onSetOrders("hold")}>
                [H] Hold Position
              </button>
              {(unit.type === UnitType.Infantry || unit.type === UnitType.Speeder || unit.type === UnitType.Scout) && (
                <button style={styles.actionBtn} onClick={() => onSetOrders("fortify")}>
                  [Shift+F] Fortify
                </button>
              )}
              {unit.orders && (
                <button style={styles.actionBtn} onClick={() => onSetOrders(null)}>
                  [Z] Cancel Orders
                </button>
              )}
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
          {[...log].reverse().slice(0, 15).map((entry, i) => {
            // Color-code log entries
            let color = "#556677";
            if (entry.includes("***")) color = "#ffcc44";
            else if (entry.includes("discovers")) color = "#4488dd";
            else if (entry.includes("completed!")) color = "#44cc66";
            else if (entry.includes("Combat:")) color = "#cc6644";
            else if (entry.includes("WARNING")) color = "#cc4444";
            else if (entry.includes("Contact")) color = "#88aacc";
            else if (entry.includes("Supply pod")) color = "#66ccff";
            else if (entry.includes("Vendetta")) color = "#cc2244";
            else if (entry.includes("Treaty") || entry.includes("Pact")) color = "#44cc66";
            else if (entry.includes("Drone riots")) color = "#cc4444";
            else if (entry.includes("Golden Age")) color = "#ffcc44";
            else if (entry.includes("founded")) color = "#88aacc";
            else if (entry.includes("grown")) color = "#44aa66";
            else if (entry.includes("Starvation")) color = "#cc6644";
            else if (entry.includes("saved")) color = "#448866";
            return (
              <div key={i} style={{ ...styles.logEntry, color, opacity: 1 - i * 0.05 }}>
                {entry}
              </div>
            );
          })}
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
  buildPickerBtn: {
    display: "flex",
    flexDirection: "column" as const,
    width: "100%",
    background: "#0a1020",
    border: "1px solid #1a2a44",
    padding: "5px 8px",
    marginBottom: 2,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.15s",
    gap: 1,
  },
  seChoiceBtn: {
    background: "#0a1020",
    border: "1px solid #1a2a44",
    padding: "2px 6px",
    fontSize: 10,
    cursor: "pointer",
    fontFamily: "'Rajdhani', sans-serif",
    transition: "all 0.15s",
  },
};
