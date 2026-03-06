// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Diplomacy Screen
// LLM-powered faction leader conversations
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from "react";
import { GameState, FactionState } from "../game/gameState";
import { FACTION_DEFS } from "../game/gameState";
import { queryLLM, DEFAULT_LLM_CONFIG, ChatMessage, LLMConfig, buildDiplomacyPrompt } from "../llm/llmClient";
import { getFactionPersonality } from "../llm/factionPersonalities";
import { UnitType } from "../game/gameState";
import { getTreaty, getTreatyDisplayName, getTreatyColor, TreatyType } from "../game/diplomacy";

interface DiplomacyScreenProps {
  gameState: GameState;
  targetFaction: FactionState;
  onClose: () => void;
  onSetTreaty?: (factionId: number, treaty: TreatyType) => void;
  llmConfig?: LLMConfig;
}

export default function DiplomacyScreen({ gameState, targetFaction, onClose, onSetTreaty, llmConfig }: DiplomacyScreenProps) {
  const [messages, setMessages] = useState<Array<{ role: "player" | "leader" | "system"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmHistory, setLlmHistory] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = llmConfig || DEFAULT_LLM_CONFIG;
  const personality = getFactionPersonality(targetFaction.key);
  const playerFaction = gameState.factions[gameState.currentFaction];

  // Build game context for the system prompt
  const theirBases = Array.from(gameState.bases.values()).filter(b => b.owner === targetFaction.id).length;
  const theirUnits = Array.from(gameState.units.values()).filter(u => u.owner === targetFaction.id);
  const militaryCount = theirUnits.filter(u => u.type === UnitType.Infantry || u.type === UnitType.Speeder).length;
  const militaryStr = militaryCount > 5 ? "formidable" : militaryCount > 2 ? "moderate" : "modest";

  // Recent log entries relevant to this faction
  const recentEvents = gameState.log
    .filter(l => l.includes(targetFaction.name) || l.includes(playerFaction?.name || ""))
    .slice(-5);

  const systemPrompt = personality
    ? buildDiplomacyPrompt(personality, {
        year: gameState.year,
        theirBases,
        theirMilitary: militaryStr,
        playerFaction: playerFaction?.name || "Unknown",
        relations: "neutral",
        recentEvents,
      })
    : `You are a faction leader on Planet Chiron. Respond in character.`;

  // Opening greeting
  useEffect(() => {
    const greet = async () => {
      setLoading(true);
      setError(null);
      try {
        const greeting: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${playerFaction?.leaderName || "The player"} of ${playerFaction?.name || "an unknown faction"} has opened communications with you. Greet them in character. Keep it to 1-2 paragraphs. Reference the current situation on Planet.` },
        ];

        const response = await queryLLM(config, greeting);
        setMessages([{ role: "leader", text: response }]);
        setLlmHistory([
          ...greeting,
          { role: "assistant", content: response },
        ]);
      } catch (err: any) {
        setError(err.message || "Failed to connect to LLM");
        setMessages([{
          role: "system",
          text: `[Connection to ${config.host} failed. Make sure Ollama is running with a model loaded. Try: ollama run llama3.2]`,
        }]);
      }
      setLoading(false);
    };
    greet();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const playerMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "player", text: playerMsg }]);
    setLoading(true);
    setError(null);

    try {
      const newHistory: ChatMessage[] = [
        ...llmHistory,
        { role: "user", content: playerMsg },
      ];

      // If history is getting long, keep system + last 8 exchanges
      const trimmed = newHistory.length > 18
        ? [newHistory[0], ...newHistory.slice(-16)]
        : newHistory;

      const response = await queryLLM(config, trimmed);
      setMessages(prev => [...prev, { role: "leader", text: response }]);
      setLlmHistory([...trimmed, { role: "assistant", content: response }]);
    } catch (err: any) {
      setError(err.message || "LLM error");
      setMessages(prev => [...prev, { role: "system", text: `[Error: ${err.message}]` }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, llmHistory, config]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  // Quick diplomatic actions
  const quickActions = [
    { label: "Propose Treaty of Friendship", msg: "I would like to propose a Treaty of Friendship between our factions. What say you?" },
    { label: "Demand Withdrawal", msg: "Your units are encroaching on our territory. I demand you withdraw them immediately." },
    { label: "Offer Technology Trade", msg: "Perhaps we could arrange an exchange of technological knowledge? I have discoveries that might interest you." },
    { label: "Threaten War", msg: "Know this: if you do not change your aggressive stance, you will face the full might of our military. This is your final warning." },
    { label: "Discuss Planet", msg: "What are your thoughts on the native life of Planet? The xenofungus is spreading rapidly in our territories." },
    { label: "Request Ceasefire", msg: "I believe it would be in both our interests to cease hostilities. Shall we negotiate a truce?" },
  ];

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.commWindow}>
        {/* Header */}
        <div style={{
          ...styles.header,
          borderColor: targetFaction.color,
          background: `linear-gradient(90deg, ${targetFaction.color}22 0%, transparent 100%)`,
        }}>
          <div style={styles.headerLeft}>
            <div style={{ ...styles.factionIndicator, background: targetFaction.color }} />
            <div>
              <div style={styles.leaderName}>{targetFaction.leaderName}</div>
              <div style={styles.factionName}>{targetFaction.name}</div>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Treaty Status Bar */}
        {(() => {
          const currentTreaty = getTreaty(gameState, gameState.currentFaction, targetFaction.id);
          const treatyColor = getTreatyColor(currentTreaty);
          return (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 16px", borderBottom: "1px solid #1a2a44",
              background: "#080c14",
            }}>
              <div style={{ fontSize: 11, color: treatyColor }}>
                Status: {getTreatyDisplayName(currentTreaty)}
              </div>
              {onSetTreaty && (
                <div style={{ display: "flex", gap: 4 }}>
                  {currentTreaty !== "treaty" && currentTreaty !== "pact" && (
                    <button
                      style={{ ...styles.quickBtn, borderColor: "#44cc66", color: "#44cc66" }}
                      onClick={() => {
                        onSetTreaty(targetFaction.id, "treaty");
                        setMessages(prev => [...prev, { role: "system", text: "Treaty of Friendship established." }]);
                      }}
                    >
                      Propose Treaty
                    </button>
                  )}
                  {currentTreaty === "treaty" && (
                    <button
                      style={{ ...styles.quickBtn, borderColor: "#4488dd", color: "#4488dd" }}
                      onClick={() => {
                        onSetTreaty(targetFaction.id, "pact");
                        setMessages(prev => [...prev, { role: "system", text: "Pact of Brotherhood formed!" }]);
                      }}
                    >
                      Propose Pact
                    </button>
                  )}
                  {currentTreaty !== "vendetta" && currentTreaty !== "none" && (
                    <button
                      style={{ ...styles.quickBtn, borderColor: "#cc4444", color: "#cc4444" }}
                      onClick={() => {
                        onSetTreaty(targetFaction.id, "none");
                        setMessages(prev => [...prev, { role: "system", text: "Treaty cancelled." }]);
                      }}
                    >
                      Cancel Treaty
                    </button>
                  )}
                  {currentTreaty !== "vendetta" && (
                    <button
                      style={{ ...styles.quickBtn, borderColor: "#cc4444", color: "#cc4444" }}
                      onClick={() => {
                        onSetTreaty(targetFaction.id, "vendetta");
                        setMessages(prev => [...prev, { role: "system", text: "You have declared Vendetta!" }]);
                      }}
                    >
                      Declare Vendetta
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Messages */}
        <div style={styles.messageArea} ref={scrollRef}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              ...styles.message,
              ...(msg.role === "player" ? styles.playerMsg : {}),
              ...(msg.role === "system" ? styles.systemMsg : {}),
              ...(msg.role === "leader" ? styles.leaderMsg : {}),
            }}>
              {msg.role === "leader" && (
                <div style={{ ...styles.msgLabel, color: targetFaction.color }}>
                  {targetFaction.leaderName}
                </div>
              )}
              {msg.role === "player" && (
                <div style={{ ...styles.msgLabel, color: playerFaction?.color || "#88aacc" }}>
                  {playerFaction?.leaderName || "You"}
                </div>
              )}
              <div style={styles.msgText}>{msg.text}</div>
            </div>
          ))}
          {loading && (
            <div style={{ ...styles.message, ...styles.leaderMsg }}>
              <div style={{ ...styles.msgLabel, color: targetFaction.color }}>
                {targetFaction.leaderName}
              </div>
              <div style={{ ...styles.msgText, opacity: 0.5, fontStyle: "italic" }}>
                composing response...
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={styles.quickActions}>
          {quickActions.map((action, i) => (
            <button
              key={i}
              style={styles.quickBtn}
              disabled={loading}
              onClick={() => {
                setInput(action.msg);
                setTimeout(() => {
                  setInput(action.msg);
                  // Auto-send
                  const fakeInput = action.msg;
                  setInput("");
                  setMessages(prev => [...prev, { role: "player", text: fakeInput }]);
                  setLoading(true);
                  const newHistory: ChatMessage[] = [
                    ...llmHistory,
                    { role: "user", content: fakeInput },
                  ];
                  const trimmed = newHistory.length > 18
                    ? [newHistory[0], ...newHistory.slice(-16)]
                    : newHistory;
                  queryLLM(config, trimmed).then(response => {
                    setMessages(prev => [...prev, { role: "leader", text: response }]);
                    setLlmHistory([...trimmed, { role: "assistant", content: response }]);
                    setLoading(false);
                  }).catch(err => {
                    setMessages(prev => [...prev, { role: "system", text: `[Error: ${err.message}]` }]);
                    setLoading(false);
                  });
                }, 50);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={styles.inputBar}>
          <input
            ref={inputRef}
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? "Waiting for response..." : "Speak to the faction leader..."}
            disabled={loading}
            autoFocus
          />
          <button
            style={{ ...styles.sendBtn, opacity: loading ? 0.4 : 1 }}
            onClick={sendMessage}
            disabled={loading}
          >
            Send
          </button>
        </div>

        {/* Status */}
        {error && (
          <div style={styles.errorBar}>
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    fontFamily: "'Rajdhani', sans-serif",
  },
  commWindow: {
    width: "min(700px, 90vw)",
    height: "min(600px, 85vh)",
    background: "linear-gradient(180deg, #0a0e18 0%, #0d1422 100%)",
    border: "1px solid #1a2a44",
    borderRadius: 4,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 20px rgba(30,60,100,0.2)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #1a2a44",
    borderLeft: "3px solid",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  factionIndicator: {
    width: 8,
    height: 40,
    borderRadius: 2,
  },
  leaderName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#e0e8f0",
    fontFamily: "'Orbitron', sans-serif",
    letterSpacing: "0.05em",
  },
  factionName: {
    fontSize: 11,
    color: "#667788",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
  closeBtn: {
    background: "none",
    border: "1px solid #1a2a44",
    color: "#667788",
    fontSize: 16,
    cursor: "pointer",
    padding: "4px 10px",
    borderRadius: 2,
  },
  messageArea: {
    flex: 1,
    overflow: "auto",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  message: {
    maxWidth: "85%",
  },
  playerMsg: {
    alignSelf: "flex-end",
    textAlign: "right" as const,
  },
  leaderMsg: {
    alignSelf: "flex-start",
  },
  systemMsg: {
    alignSelf: "center",
    textAlign: "center" as const,
    maxWidth: "100%",
  },
  msgLabel: {
    fontSize: 10,
    fontFamily: "'Orbitron', sans-serif",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    marginBottom: 3,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 1.5,
    color: "#b0c4d8",
    background: "#111a2a",
    padding: "10px 14px",
    borderRadius: 4,
    border: "1px solid #1a2a44",
    whiteSpace: "pre-wrap" as const,
  },
  quickActions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
    padding: "8px 16px",
    borderTop: "1px solid #111a2a",
  },
  quickBtn: {
    background: "#0a1020",
    border: "1px solid #1a2a44",
    color: "#667788",
    fontSize: 10,
    padding: "3px 8px",
    cursor: "pointer",
    fontFamily: "'Rajdhani', sans-serif",
    borderRadius: 2,
    transition: "all 0.15s",
  },
  inputBar: {
    display: "flex",
    gap: 8,
    padding: "10px 16px",
    borderTop: "1px solid #1a2a44",
    background: "#080c14",
  },
  input: {
    flex: 1,
    background: "#0a1020",
    border: "1px solid #1a2a44",
    color: "#e0e8f0",
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: "'Rajdhani', sans-serif",
    outline: "none",
    borderRadius: 2,
  },
  sendBtn: {
    background: "#1a2a44",
    border: "1px solid #2a3a55",
    color: "#88aacc",
    padding: "8px 16px",
    fontSize: 12,
    fontFamily: "'Orbitron', sans-serif",
    cursor: "pointer",
    borderRadius: 2,
    letterSpacing: "0.05em",
  },
  errorBar: {
    background: "#2a1515",
    border: "1px solid #442222",
    color: "#cc6644",
    padding: "6px 16px",
    fontSize: 11,
    textAlign: "center" as const,
  },
};
