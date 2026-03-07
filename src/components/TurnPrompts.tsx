// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Turn Prompts
// Modal popups for production/research decisions (SMAC-style)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { GameState, Base, getAvailableBuilds, getBuildItem, BuildItem } from "../game/gameState";
import { getResearchableTechs, Tech, calculateLabsPerTurn } from "../game/techTree";

// ─── Prompt Types ────────────────────────────────────────────

export interface TurnPrompt {
  type: "production" | "research" | "production_complete";
  baseId?: string;
  baseName?: string;
  completedItem?: string;  // what just finished building
}

// Scan game state for needed prompts
export function getTurnPrompts(state: GameState): TurnPrompt[] {
  const prompts: TurnPrompt[] = [];
  const faction = state.factions[state.currentFaction];
  if (!faction || !faction.isHuman) return prompts;

  // Check bases with no production
  for (const [id, base] of state.bases) {
    if (base.owner !== state.currentFaction) continue;
    if (!base.currentBuild) {
      prompts.push({
        type: "production",
        baseId: id,
        baseName: base.name,
      });
    }
  }

  // Check if no research selected
  if (!faction.currentResearch) {
    const available = getResearchableTechs(faction.discoveredTechs);
    if (available.length > 0) {
      prompts.push({ type: "research" });
    }
  }

  return prompts;
}

// ─── Production Prompt Component ─────────────────────────────

interface ProductionPromptProps {
  gameState: GameState;
  baseId: string;
  baseName: string;
  completedItem?: string;
  onSelect: (baseId: string, buildKey: string) => void;
  onSkip: () => void;
}

export function ProductionPrompt({ gameState, baseId, baseName, completedItem, onSelect, onSkip }: ProductionPromptProps) {
  const base = gameState.bases.get(baseId);
  const faction = gameState.factions[gameState.currentFaction];
  if (!base || !faction) return null;

  const available = getAvailableBuilds(base, faction.discoveredTechs, gameState.completedProjects, gameState.customDesigns);

  // Group by category
  const units = available.filter(b => b.category === "unit");
  const facilities = available.filter(b => b.category === "facility");
  const projects = available.filter(b => b.category === "project");

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={headerIconStyle}>⚙</div>
          <div>
            <div style={headerTitleStyle}>OPERATIONS DIRECTOR</div>
            <div style={headerSubStyle}>
              {completedItem
                ? `${baseName} has completed ${completedItem}. What shall we build next?`
                : `Governor of ${baseName} requests production orders.`
              }
            </div>
          </div>
        </div>

        {/* Build options */}
        <div style={listContainerStyle}>
          {units.length > 0 && (
            <div style={categoryStyle}>
              <div style={categoryLabelStyle}>UNITS</div>
              {units.map(item => (
                <button
                  key={item.key}
                  style={itemBtnStyle}
                  onClick={() => onSelect(baseId, item.key)}
                >
                  <div style={itemRowStyle}>
                    <span style={itemNameStyle}>{item.name}</span>
                    <span style={itemCostStyle}>{item.cost}⛏</span>
                  </div>
                  <div style={itemDescStyle}>{item.description}</div>
                </button>
              ))}
            </div>
          )}
          {facilities.length > 0 && (
            <div style={categoryStyle}>
              <div style={categoryLabelStyle}>FACILITIES</div>
              {facilities.map(item => (
                <button
                  key={item.key}
                  style={itemBtnStyle}
                  onClick={() => onSelect(baseId, item.key)}
                >
                  <div style={itemRowStyle}>
                    <span style={itemNameStyle}>{item.name}</span>
                    <span style={itemCostStyle}>{item.cost}⛏ · {item.maintenance}⚡/turn</span>
                  </div>
                  <div style={itemDescStyle}>{item.description}</div>
                </button>
              ))}
            </div>
          )}
          {projects.length > 0 && (
            <div style={categoryStyle}>
              <div style={categoryLabelStyle}>SECRET PROJECTS</div>
              {projects.map(item => (
                <button
                  key={item.key}
                  style={itemBtnStyle}
                  onClick={() => onSelect(baseId, item.key)}
                >
                  <div style={itemRowStyle}>
                    <span style={{ ...itemNameStyle, color: "#ffcc44" }}>{item.name}</span>
                    <span style={itemCostStyle}>{item.cost}⛏</span>
                  </div>
                  <div style={itemDescStyle}>{item.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Skip */}
        <div style={footerStyle}>
          <button style={skipBtnStyle} onClick={onSkip}>
            Skip (Stockpile Energy)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Research Prompt Component ───────────────────────────────

interface ResearchPromptProps {
  gameState: GameState;
  completedTech?: string;
  onSelect: (techKey: string) => void;
  onSkip: () => void;
}

export function ResearchPrompt({ gameState, completedTech, onSelect, onSkip }: ResearchPromptProps) {
  const faction = gameState.factions[gameState.currentFaction];
  if (!faction) return null;

  const available = getResearchableTechs(faction.discoveredTechs);
  const labsPerTurn = calculateLabsPerTurn(gameState.bases, faction.id);

  // Group by track
  const tracks = ["explore", "discover", "build", "conquer"];
  const grouped = tracks.map(track => ({
    track,
    techs: available.filter(t => t.track === track),
  })).filter(g => g.techs.length > 0);

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ ...headerIconStyle, background: "#1a2244" }}>🔬</div>
          <div>
            <div style={headerTitleStyle}>RESEARCH DIRECTOR</div>
            <div style={headerSubStyle}>
              {completedTech
                ? `Our scientists have made a breakthrough: ${completedTech}! What shall we research next?`
                : `Our research teams await direction. What technology shall we pursue?`
              }
            </div>
          </div>
        </div>

        <div style={{ ...headerSubStyle, padding: "4px 20px", color: "#3388dd", fontSize: 11 }}>
          Labs per turn: {labsPerTurn}
        </div>

        {/* Tech options */}
        <div style={listContainerStyle}>
          {grouped.map(({ track, techs }) => (
            <div key={track} style={categoryStyle}>
              <div style={{
                ...categoryLabelStyle,
                color: track === "explore" ? "#44cc66" : track === "discover" ? "#4488dd" : track === "build" ? "#cc8833" : "#cc4444",
              }}>
                {track.toUpperCase()}
              </div>
              {techs.map(tech => {
                const est = Math.ceil(tech.cost / Math.max(1, labsPerTurn));
                return (
                  <button
                    key={tech.key}
                    style={itemBtnStyle}
                    onClick={() => onSelect(tech.key)}
                  >
                    <div style={itemRowStyle}>
                      <span style={itemNameStyle}>{tech.name}</span>
                      <span style={itemCostStyle}>{tech.cost} · ~{est} turns</span>
                    </div>
                    <div style={itemDescStyle}>
                      {tech.unlocks.slice(0, 3).join(", ")}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={footerStyle}>
          <button style={skipBtnStyle} onClick={onSkip}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 900,
  fontFamily: "'Rajdhani', sans-serif",
};

const modalStyle: React.CSSProperties = {
  width: "min(550px, 85vw)",
  maxHeight: "min(520px, 80vh)",
  background: "linear-gradient(180deg, #0c1220 0%, #0a0e18 100%)",
  border: "1px solid #1a2a44",
  borderRadius: 4,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 15px rgba(30,60,100,0.15)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  padding: "14px 20px",
  borderBottom: "1px solid #1a2a44",
  background: "linear-gradient(90deg, #111a2a 0%, transparent 100%)",
};

const headerIconStyle: React.CSSProperties = {
  fontSize: 24,
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#1a2222",
  borderRadius: 4,
  border: "1px solid #2a3a44",
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontFamily: "'Orbitron', sans-serif",
  color: "#88aacc",
  letterSpacing: "0.1em",
};

const headerSubStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#8899aa",
  lineHeight: 1.4,
  marginTop: 2,
};

const listContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "8px 16px",
};

const categoryStyle: React.CSSProperties = {
  marginBottom: 8,
};

const categoryLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "'Orbitron', sans-serif",
  color: "#556677",
  letterSpacing: "0.15em",
  marginBottom: 4,
  paddingLeft: 4,
};

const itemBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "#0a1020",
  border: "1px solid #1a2a44",
  padding: "6px 10px",
  marginBottom: 2,
  cursor: "pointer",
  textAlign: "left",
  transition: "all 0.15s",
  fontFamily: "'Rajdhani', sans-serif",
};

const itemRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const itemNameStyle: React.CSSProperties = {
  color: "#ccddee",
  fontSize: 13,
  fontWeight: 600,
};

const itemCostStyle: React.CSSProperties = {
  color: "#667788",
  fontSize: 11,
  fontFamily: "'Share Tech Mono', monospace",
};

const itemDescStyle: React.CSSProperties = {
  color: "#556677",
  fontSize: 10,
  marginTop: 1,
};

const footerStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderTop: "1px solid #1a2a44",
  display: "flex",
  justifyContent: "flex-end",
};

const skipBtnStyle: React.CSSProperties = {
  background: "#111a2a",
  border: "1px solid #1a2a44",
  color: "#667788",
  padding: "6px 16px",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "'Rajdhani', sans-serif",
};
