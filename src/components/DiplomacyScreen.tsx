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

export type DiplomacyEffect =
  | { type: "treaty"; factionId: number; treaty: TreatyType }
  | { type: "energy_gift"; factionId: number; amount: number }
  | { type: "relation"; factionId: number; delta: number };

interface DiplomacyScreenProps {
  gameState: GameState;
  targetFaction: FactionState;
  onClose: () => void;
  onSetTreaty?: (factionId: number, treaty: TreatyType) => void;
  onGameEffect?: (effect: DiplomacyEffect) => void;
  llmConfig?: LLMConfig;
}

export default function DiplomacyScreen({ gameState, targetFaction, onClose, onSetTreaty, onGameEffect, llmConfig }: DiplomacyScreenProps) {
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

  // ── Diplomatic proposal handler ──
  // Sends proposal to LLM, parses DECISION line, applies game effect
  const sendDiplomaticProposal = useCallback(async (playerMsg: string, proposalType: string) => {
    if (loading) return;

    setMessages(prev => [...prev, { role: "player", text: playerMsg }]);
    setLoading(true);
    setError(null);

    // Build the prompt with decision instructions
    const decisionInstructions = `\n\nIMPORTANT: After your in-character response, you MUST end with a decision on a new line. Write exactly ONE of:
DECISION: ACCEPT
DECISION: REJECT
DECISION: COUNTER

Base your decision on:
- Your faction ideology and personality
- Current relations and game state
- Whether this proposal benefits your faction
- Your diplomatic style (Yang rarely accepts, Lal is diplomatic, Santiago respects strength)`;

    try {
      const newHistory: ChatMessage[] = [
        ...llmHistory,
        { role: "user", content: playerMsg + decisionInstructions },
      ];
      const trimmed = newHistory.length > 18 ? [newHistory[0], ...newHistory.slice(-16)] : newHistory;
      const response = await queryLLM(config, trimmed);

      // Parse the DECISION line
      const lines = response.trim().split("\n");
      const decisionLine = lines.find(l => l.trim().startsWith("DECISION:"));
      const decision = decisionLine?.includes("ACCEPT") ? "accept" : decisionLine?.includes("COUNTER") ? "counter" : "reject";

      // Clean response text (remove decision line for display)
      const responseText = response.replace(/DECISION:\s*(ACCEPT|REJECT|COUNTER)\s*$/im, "").trim();

      setMessages(prev => [...prev, { role: "leader", text: responseText }]);
      setLlmHistory([...trimmed, { role: "assistant", content: response }]);

      // Apply game effects based on decision
      if (decision === "accept") {
        let effectMsg = "";
        switch (proposalType) {
          case "treaty":
            onSetTreaty?.(targetFaction.id, "treaty");
            onGameEffect?.({ type: "relation", factionId: targetFaction.id, delta: 15 });
            effectMsg = "✓ Treaty of Friendship established.";
            break;
          case "pact":
            onSetTreaty?.(targetFaction.id, "pact");
            onGameEffect?.({ type: "relation", factionId: targetFaction.id, delta: 25 });
            effectMsg = "✓ Pact of Brotherhood formed!";
            break;
          case "ceasefire":
            onSetTreaty?.(targetFaction.id, "truce");
            onGameEffect?.({ type: "relation", factionId: targetFaction.id, delta: 10 });
            effectMsg = "✓ Ceasefire agreed. Truce in effect.";
            break;
          case "tech_trade":
            // Give them a random tech they don't have, get one we don't have
            onGameEffect?.({ type: "relation", factionId: targetFaction.id, delta: 10 });
            effectMsg = "✓ Technology exchange agreed.";
            break;
          case "energy_tribute":
            onGameEffect?.({ type: "energy_gift", factionId: targetFaction.id, amount: -50 });
            onGameEffect?.({ type: "relation", factionId: targetFaction.id, delta: 20 });
            effectMsg = "✓ Tribute of 50 energy credits paid. Relations improved.";
            break;
        }
        if (effectMsg) {
          setMessages(prev => [...prev, { role: "system", text: effectMsg }]);
        }
      } else if (decision === "reject") {
        onGameEffect?.({ type: "relation", factionId: targetFaction.id, delta: -5 });
        setMessages(prev => [...prev, { role: "system", text: "✗ Proposal rejected." }]);
      } else {
        setMessages(prev => [...prev, { role: "system", text: "↔ Counter-proposal suggested. Continue negotiating." }]);
      }
    } catch (err: any) {
      setError(err.message || "LLM error");
      setMessages(prev => [...prev, { role: "system", text: `[Error: ${err.message}. Proposal auto-resolved by game rules.]` }]);
      // Fallback: use simple game logic when LLM unavailable
      const relation = targetFaction.relations?.get(gameState.currentFaction) || 0;
      if (proposalType === "treaty" && relation >= 0) {
        onSetTreaty?.(targetFaction.id, "treaty");
        setMessages(prev => [...prev, { role: "system", text: "✓ Treaty of Friendship established (auto-resolved)." }]);
      } else if (proposalType === "ceasefire") {
        onSetTreaty?.(targetFaction.id, "truce");
        setMessages(prev => [...prev, { role: "system", text: "✓ Truce agreed (auto-resolved)." }]);
      } else {
        setMessages(prev => [...prev, { role: "system", text: "✗ Proposal rejected (auto-resolved)." }]);
      }
    }
    setLoading(false);
    inputRef.current?.focus();
  }, [loading, llmHistory, config, onSetTreaty, onGameEffect, targetFaction, gameState]);

  // Quick diplomatic actions — now tied to real game effects
  const currentTreatyForActions = getTreaty(gameState, gameState.currentFaction, targetFaction.id);

  const quickActions = [
    ...(currentTreatyForActions !== "treaty" && currentTreatyForActions !== "pact" ? [{
      label: "Propose Treaty",
      msg: "I would like to propose a Treaty of Friendship between our factions. This would allow free passage through each other's territories and establish peaceful relations. What say you?",
      type: "treaty",
    }] : []),
    ...(currentTreatyForActions === "treaty" ? [{
      label: "Propose Pact",
      msg: "Our Treaty of Friendship has served us well. I propose we deepen our bond with a Pact of Brotherhood — a full alliance. Together we would be unstoppable.",
      type: "pact",
    }] : []),
    ...(currentTreatyForActions === "vendetta" ? [{
      label: "Request Ceasefire",
      msg: "This war serves neither of us. I propose an immediate ceasefire. Let us end the bloodshed and negotiate as civilized leaders.",
      type: "ceasefire",
    }] : []),
    {
      label: "Offer Technology",
      msg: "Perhaps we could arrange an exchange of technological knowledge? I have discoveries that might interest your researchers, and I'm sure you have findings that would benefit mine.",
      type: "tech_trade",
    },
    {
      label: "Offer Tribute",
      msg: "As a gesture of good faith, I am prepared to offer 50 energy credits to your faction. I hope this demonstrates our commitment to peaceful relations.",
      type: "energy_tribute",
    },
    {
      label: "Threaten War",
      msg: "Know this: your aggressive actions will not go unanswered. If you do not change course immediately, you will face the full might of our military. This is your final warning.",
      type: "threaten",
    },
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
              style={{
                ...styles.quickBtn,
                borderColor: action.type === "threaten" ? "#cc444444" : action.type === "treaty" || action.type === "pact" || action.type === "ceasefire" ? "#44cc6644" : "#1a2a44",
              }}
              disabled={loading}
              onClick={() => sendDiplomaticProposal(action.msg, action.type)}
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
