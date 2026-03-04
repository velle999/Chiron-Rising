// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Social Engineering System
// Based on SMAC manual social factors tables
// ═══════════════════════════════════════════════════════════════

// ─── Social Factor Keys ──────────────────────────────────────

export type SocialFactor =
  | "economy" | "efficiency" | "support" | "morale" | "police"
  | "growth" | "planet" | "probe" | "industry" | "research";

export const ALL_FACTORS: SocialFactor[] = [
  "economy", "efficiency", "support", "morale", "police",
  "growth", "planet", "probe", "industry", "research",
];

// ─── Social Choice ───────────────────────────────────────────

export interface SocialChoice {
  key: string;
  name: string;
  category: "politics" | "economics" | "values" | "future";
  requiresTech: string | null;     // null = default/starting option
  modifiers: Partial<Record<SocialFactor, number>>;
  description: string;
}

// ─── Faction SE State ────────────────────────────────────────

export interface SocialEngineering {
  politics: string;     // choice key
  economics: string;
  values: string;
  future: string;
}

export function defaultSocialEngineering(): SocialEngineering {
  return {
    politics: "frontier",
    economics: "simple",
    values: "survival",
    future: "none",
  };
}

// ─── All Social Choices ──────────────────────────────────────

export const SOCIAL_CHOICES: SocialChoice[] = [
  // ── POLITICS ──
  { key: "frontier",        name: "Frontier",        category: "politics", requiresTech: null,                  modifiers: {},                                                                       description: "Default early government. No modifiers." },
  { key: "police_state",    name: "Police State",    category: "politics", requiresTech: "doctrine_loyalty",    modifiers: { support: 2, police: 2, efficiency: -2 },                                description: "+2 Support, +2 Police, -2 Efficiency" },
  { key: "democratic",      name: "Democratic",      category: "politics", requiresTech: "ethical_calculus",    modifiers: { efficiency: 2, growth: 2, support: -2 },                                description: "+2 Efficiency, +2 Growth, -2 Support" },
  { key: "fundamentalist",  name: "Fundamentalist",  category: "politics", requiresTech: "social_psych",       modifiers: { probe: 2, morale: 1, research: -2 },                                   description: "+2 Probe, +1 Morale, -2 Research" },

  // ── ECONOMICS ──
  { key: "simple",          name: "Simple",          category: "economics", requiresTech: null,                  modifiers: {},                                                                       description: "Default early economy. No modifiers." },
  { key: "free_market",     name: "Free Market",     category: "economics", requiresTech: "industrial_economics",modifiers: { economy: 2, planet: -3, police: -5 },                                  description: "+2 Economy, -3 Planet, -5 Police" },
  { key: "planned",         name: "Planned",         category: "economics", requiresTech: "planetary_networks",  modifiers: { growth: 2, industry: 1, efficiency: -2 },                              description: "+2 Growth, +1 Industry, -2 Efficiency" },
  { key: "green",           name: "Green",           category: "economics", requiresTech: "centauri_empathy",    modifiers: { efficiency: 2, planet: 2, growth: -2 },                                description: "+2 Efficiency, +2 Planet, -2 Growth" },

  // ── VALUES ──
  { key: "survival",        name: "Survival",        category: "values",   requiresTech: null,                  modifiers: {},                                                                       description: "Default priority. No modifiers." },
  { key: "power",           name: "Power",           category: "values",   requiresTech: "doctrine_loyalty",    modifiers: { support: 2, morale: 2, industry: -2 },                                 description: "+2 Support, +2 Morale, -2 Industry" },
  { key: "knowledge",       name: "Knowledge",       category: "values",   requiresTech: "cyberethics",         modifiers: { research: 2, efficiency: 1, probe: -2 },                               description: "+2 Research, +1 Efficiency, -2 Probe" },
  { key: "wealth",          name: "Wealth",          category: "values",   requiresTech: "industrial_automation",modifiers: { economy: 1, industry: 1, morale: -2 },                                description: "+1 Economy, +1 Industry, -2 Morale" },

  // ── FUTURE SOCIETY ──
  { key: "none",            name: "None",            category: "future",   requiresTech: null,                  modifiers: {},                                                                       description: "No future society model yet." },
  { key: "cybernetic",      name: "Cybernetic",      category: "future",   requiresTech: "digital_sentience",   modifiers: { efficiency: 2, planet: 2, research: 2, police: -3 },                   description: "+2 Efficiency, +2 Planet, +2 Research, -3 Police" },
  { key: "eudaimonic",      name: "Eudaimonic",      category: "future",   requiresTech: "sentient_econometrics",modifiers: { economy: 2, growth: 2, industry: 2, morale: -2 },                     description: "+2 Economy, +2 Growth, +2 Industry, -2 Morale" },
  { key: "thought_control", name: "Thought Control",  category: "future",   requiresTech: "centauri_psi",        modifiers: { morale: 2, police: 2, probe: 2, support: -3 },                         description: "+2 Morale, +2 Police, +2 Probe, -3 Support" },
];

// ─── Faction Intrinsic Bonuses ───────────────────────────────

export interface FactionBonuses {
  modifiers: Partial<Record<SocialFactor, number>>;
  agenda: string;       // preferred SE choice key
  aversion: string;     // SE choice they refuse
  special: string[];    // text descriptions of unique abilities
}

export const FACTION_BONUSES: Record<string, FactionBonuses> = {
  GAIANS: {
    modifiers: { planet: 1, efficiency: 2, morale: -1, police: -1 },
    agenda: "green",
    aversion: "free_market",
    special: ["+1 nutrients in fungus"],
  },
  HIVE: {
    modifiers: { growth: 1, industry: 1, economy: -2 },
    agenda: "police_state",
    aversion: "democratic",
    special: ["Free Perimeter Defense at each base"],
  },
  UNIV: {
    modifiers: { research: 2, probe: -2 },
    agenda: "knowledge",
    aversion: "fundamentalist",
    special: ["Free Network Node at every base", "+1 bonus tech at start"],
  },
  MORGAN: {
    modifiers: { economy: 1, support: -1 },
    agenda: "free_market",
    aversion: "planned",
    special: ["Starts with 100 extra energy", "Needs Hab Complex for bases > size 4"],
  },
  SPARTANS: {
    modifiers: { morale: 2, police: 1, industry: -1 },
    agenda: "power",
    aversion: "wealth",
    special: ["Free prototypes"],
  },
  BELIEVE: {
    modifiers: { probe: 1, research: -2, planet: -1 },
    agenda: "fundamentalist",
    aversion: "knowledge",
    special: ["+25% attack bonus", "No research until M.Y. 2110"],
  },
  PEACE: {
    modifiers: { efficiency: -1 },
    agenda: "democratic",
    aversion: "police_state",
    special: ["Extra talent per 4 citizens", "Double council votes"],
  },
};

// ─── Lookup Helpers ──────────────────────────────────────────

const choiceMap = new Map<string, SocialChoice>();
SOCIAL_CHOICES.forEach(c => choiceMap.set(c.key, c));

export function getSocialChoice(key: string): SocialChoice | undefined {
  return choiceMap.get(key);
}

export function getChoicesForCategory(category: SocialChoice["category"]): SocialChoice[] {
  return SOCIAL_CHOICES.filter(c => c.category === category);
}

// Get available SE choices for a category (filtered by tech)
export function getAvailableChoices(
  category: SocialChoice["category"],
  discoveredTechs: string[],
  factionKey: string
): SocialChoice[] {
  const techSet = new Set(discoveredTechs);
  const bonuses = FACTION_BONUSES[factionKey];

  return SOCIAL_CHOICES.filter(c => {
    if (c.category !== category) return false;
    // Default choices always available
    if (!c.requiresTech) return true;
    // Check tech
    if (!techSet.has(c.requiresTech)) return false;
    // Check faction aversion
    if (bonuses && c.key === bonuses.aversion) return false;
    return true;
  });
}

// ─── Calculate Social Factors ────────────────────────────────
// Sums: faction intrinsic + all 4 SE choices

export type SocialFactors = Record<SocialFactor, number>;

export function calculateSocialFactors(
  factionKey: string,
  se: SocialEngineering
): SocialFactors {
  const factors: SocialFactors = {
    economy: 0, efficiency: 0, support: 0, morale: 0, police: 0,
    growth: 0, planet: 0, probe: 0, industry: 0, research: 0,
  };

  // Faction intrinsics
  const bonuses = FACTION_BONUSES[factionKey];
  if (bonuses) {
    for (const [key, val] of Object.entries(bonuses.modifiers)) {
      factors[key as SocialFactor] += val as number;
    }
  }

  // Sum SE choices
  const choiceKeys = [se.politics, se.economics, se.values, se.future];
  for (const ck of choiceKeys) {
    const choice = getSocialChoice(ck);
    if (choice) {
      for (const [key, val] of Object.entries(choice.modifiers)) {
        factors[key as SocialFactor] += val as number;
      }
    }
  }

  return factors;
}

// ─── Factor Effect Descriptions ──────────────────────────────
// Human-readable text for what each factor level means

export function getFactorEffect(factor: SocialFactor, value: number): string {
  switch (factor) {
    case "economy":
      if (value <= -2) return `-${Math.abs(value)} energy each base`;
      if (value === -1) return "-1 energy at HQ";
      if (value === 0) return "Standard rates";
      if (value === 1) return "+1 energy each base";
      if (value >= 2) return `+1 energy/square, +${value - 1} energy/base`;
      break;
    case "efficiency":
      if (value <= -3) return "Murderous inefficiency";
      if (value === -2) return "Appalling inefficiency";
      if (value === -1) return "Gross inefficiency";
      if (value === 0) return "High inefficiency";
      if (value === 1) return "Reasonable efficiency";
      if (value === 2) return "Commendable efficiency";
      if (value >= 3) return "Exemplary efficiency";
      break;
    case "support":
      if (value <= -3) return "Each unit costs 1 to support";
      if (value === -2) return "1 free unit per base";
      if (value === -1) return "1 free unit per base";
      if (value === 0) return "2 free units per base";
      if (value === 1) return "3 free units per base";
      if (value === 2) return "4 free units per base";
      if (value >= 3) return "4+ free units per base";
      break;
    case "morale":
      if (value <= -2) return `${value} Morale, bonuses halved`;
      if (value === -1) return "-1 Morale";
      if (value === 0) return "Normal Morale";
      if (value === 1) return "+1 Morale";
      if (value === 2) return "+1 Morale (+2 defense)";
      if (value >= 3) return `+${value - 1} Morale (+${value} defense)`;
      break;
    case "police":
      if (value <= -3) return "Extra drone per unit away";
      if (value === -2) return "No military police";
      if (value === -1) return "1 police unit allowed";
      if (value === 0) return "1 police unit";
      if (value === 1) return "2 police units";
      if (value === 2) return "3 police units";
      if (value >= 3) return "3 police, doubled effect";
      break;
    case "growth":
      if (value <= -2) return `-${Math.abs(value) * 10}% growth`;
      if (value === -1) return "-10% growth";
      if (value === 0) return "Normal growth";
      return `+${value * 10}% growth`;
    case "planet":
      if (value <= -2) return "Rampant eco-damage";
      if (value === -1) return "Increased eco-damage";
      if (value === 0) return "Normal eco-tension";
      if (value === 1) return "Safeguards, 25% capture";
      if (value === 2) return "Harmony, 50% capture";
      if (value >= 3) return "Wisdom, 75% capture";
      break;
    case "probe":
      if (value <= -1) return "Vulnerable to probes";
      if (value === 0) return "Normal security";
      return `+${value} probe morale`;
    case "industry":
      if (value < 0) return `+${Math.abs(value) * 10}% mineral costs`;
      if (value === 0) return "Normal costs";
      return `-${value * 10}% mineral costs`;
    case "research":
      if (value < 0) return `${value * 10}% research speed`;
      if (value === 0) return "Normal research";
      return `+${value * 10}% research speed`;
  }
  return `${value >= 0 ? "+" : ""}${value}`;
}
