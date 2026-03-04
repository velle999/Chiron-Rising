// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Technology Tree
// Based on Sid Meier's Alpha Centauri tech tree
// ═══════════════════════════════════════════════════════════════

export interface Tech {
  key: string;
  name: string;
  prerequisites: string[];    // tech keys required
  cost: number;               // base research points
  track: "explore" | "discover" | "build" | "conquer";
  level: number;              // depth in tree (1-16)
  unlocks: string[];          // description of what this tech enables
}

// ─── Full Tech Tree ──────────────────────────────────────────
// Costs scale with level: base 30 × level, tuned slightly

export const TECH_TREE: Tech[] = [
  // ── Level 1: Starting techs (no prerequisites) ──
  { key: "centauri_ecology",     name: "Centauri Ecology",      prerequisites: [],                       cost: 30,   track: "explore",   level: 1, unlocks: ["Former unit", "Farm", "Mine", "Solar Collector", "Remove Fungus"] },
  { key: "social_psych",         name: "Social Psych",          prerequisites: [],                       cost: 30,   track: "explore",   level: 1, unlocks: ["Recreation Commons"] },
  { key: "applied_physics",      name: "Applied Physics",       prerequisites: [],                       cost: 30,   track: "discover",  level: 1, unlocks: ["Laser weapon (Atk 2)"] },
  { key: "information_networks", name: "Information Networks",   prerequisites: [],                       cost: 30,   track: "build",     level: 1, unlocks: ["Planetary Networks prereq"] },
  { key: "industrial_base",      name: "Industrial Base",       prerequisites: [],                       cost: 30,   track: "build",     level: 1, unlocks: ["Synthmetal Armor (Def 2)"] },
  { key: "doctrine_mobility",    name: "Doctrine: Mobility",    prerequisites: [],                       cost: 30,   track: "conquer",   level: 1, unlocks: ["Speeder chassis", "Command Center"] },
  { key: "biogenetics",          name: "Biogenetics",           prerequisites: [],                       cost: 30,   track: "discover",  level: 1, unlocks: ["Recycling Tanks"] },

  // ── Level 2 ──
  { key: "doctrine_flexibility", name: "Doctrine: Flexibility", prerequisites: ["doctrine_mobility"],                                     cost: 60,  track: "conquer",   level: 2, unlocks: ["Foil chassis (naval)", "Pressure Dome"] },
  { key: "doctrine_loyalty",     name: "Doctrine: Loyalty",     prerequisites: ["doctrine_mobility", "social_psych"],                     cost: 60,  track: "conquer",   level: 2, unlocks: ["Perimeter Defense"] },
  { key: "ethical_calculus",     name: "Ethical Calculus",       prerequisites: ["social_psych"],                                          cost: 60,  track: "explore",   level: 2, unlocks: ["Children's Creche"] },
  { key: "planetary_networks",   name: "Planetary Networks",    prerequisites: ["information_networks"],                                   cost: 60,  track: "build",     level: 2, unlocks: ["Probe Team unit", "Hologram Theatre"] },
  { key: "industrial_economics", name: "Industrial Economics",  prerequisites: ["industrial_base"],                                        cost: 60,  track: "build",     level: 2, unlocks: ["Energy Bank"] },
  { key: "high_energy_chemistry",name: "High Energy Chemistry", prerequisites: ["industrial_base", "applied_physics"],                     cost: 60,  track: "discover",  level: 2, unlocks: ["Plasma Steel Armor (Def 3)"] },
  { key: "polymorphic_software", name: "Polymorphic Software",  prerequisites: ["industrial_base", "information_networks"],                cost: 60,  track: "build",     level: 2, unlocks: ["Heavy Artillery ability"] },
  { key: "nonlinear_mathematics",name: "Nonlinear Mathematics", prerequisites: ["applied_physics", "information_networks"],                cost: 60,  track: "discover",  level: 2, unlocks: ["Particle Impactor (Atk 4)"] },

  // ── Level 3 ──
  { key: "gene_splicing",        name: "Gene Splicing",         prerequisites: ["biogenetics", "ethical_calculus"],                        cost: 90,  track: "discover",  level: 3, unlocks: ["Research Hospital", "Lifts nutrient cap"] },
  { key: "ecological_engineering",name: "Ecological Engineering",prerequisites: ["centauri_ecology", "gene_splicing"],                     cost: 90,  track: "explore",   level: 3, unlocks: ["Condenser", "Borehole", "Plant Fungus", "Lifts mineral cap"] },
  { key: "intellectual_integrity",name: "Intellectual Integrity",prerequisites: ["ethical_calculus", "doctrine_loyalty"],                   cost: 90,  track: "explore",   level: 3, unlocks: ["Non-Lethal Methods ability"] },
  { key: "optical_computers",    name: "Optical Computers",     prerequisites: ["applied_physics", "polymorphic_software"],                cost: 90,  track: "discover",  level: 3, unlocks: ["Gatling Laser (Atk 5)"] },
  { key: "doctrine_initiative",  name: "Doctrine: Initiative",  prerequisites: ["doctrine_flexibility", "industrial_economics"],           cost: 90,  track: "conquer",   level: 3, unlocks: ["Cruiser chassis", "Maritime Control Center prereq"] },
  { key: "industrial_automation",name: "Industrial Automation",  prerequisites: ["industrial_economics", "planetary_networks"],             cost: 90,  track: "build",     level: 3, unlocks: ["Supply Transport unit", "Hab Complex"] },
  { key: "synthetic_fossil_fuels",name: "Synthetic Fossil Fuels",prerequisites: ["high_energy_chemistry", "gene_splicing"],                cost: 90,  track: "build",     level: 3, unlocks: ["Missile Launcher (Atk 6)"] },
  { key: "secrets_human_brain",  name: "Secrets of the Human Brain", prerequisites: ["social_psych", "biogenetics"],                      cost: 90,  track: "explore",   level: 3, unlocks: ["Bonus tech to first discoverer", "Hypnotic Trance ability"] },

  // ── Level 4 ──
  { key: "centauri_empathy",     name: "Centauri Empathy",      prerequisites: ["secrets_human_brain", "centauri_ecology"],                cost: 120, track: "explore",   level: 4, unlocks: ["Empath Song ability", "Biology Lab"] },
  { key: "environmental_economics",name: "Environmental Economics",prerequisites: ["industrial_economics", "ecological_engineering"],      cost: 120, track: "build",     level: 4, unlocks: ["Tree Farm", "Lifts energy cap", "Raise/Lower terrain"] },
  { key: "superconductor",       name: "Superconductor",        prerequisites: ["optical_computers", "industrial_base"],                   cost: 120, track: "discover",  level: 4, unlocks: ["Gatling Laser (Atk 5)"] },
  { key: "doctrine_air_power",   name: "Doctrine: Air Power",   prerequisites: ["synthetic_fossil_fuels", "doctrine_flexibility"],         cost: 120, track: "conquer",   level: 4, unlocks: ["Needlejet chassis", "Aerospace Complex"] },
  { key: "neural_grafting",      name: "Neural Grafting",       prerequisites: ["secrets_human_brain", "industrial_automation"],            cost: 120, track: "discover",  level: 4, unlocks: ["2 special abilities per unit", "Neural Amplifier prereq"] },
  { key: "cyberethics",          name: "Cyberethics",           prerequisites: ["planetary_networks", "intellectual_integrity"],            cost: 120, track: "build",     level: 4, unlocks: ["Planetary Datalinks prereq"] },
  { key: "adv_military_algorithms",name: "Adv. Military Algorithms",prerequisites: ["doctrine_flexibility", "optical_computers"],          cost: 120, track: "conquer",   level: 4, unlocks: ["Bunker", "AAA Tracking ability"] },
  { key: "bio_engineering",      name: "Bio-Engineering",       prerequisites: ["gene_splicing", "neural_grafting"],                       cost: 120, track: "discover",  level: 4, unlocks: ["Clean Reactor ability"] },

  // ── Level 5 ──
  { key: "adv_subatomic_theory", name: "Adv. Subatomic Theory", prerequisites: ["high_energy_chemistry", "polymorphic_software"],          cost: 150, track: "discover",  level: 5, unlocks: ["Skunkworks facility", "Comm Jammer ability"] },
  { key: "centauri_meditation",  name: "Centauri Meditation",   prerequisites: ["ecological_engineering", "centauri_empathy"],              cost: 150, track: "explore",   level: 5, unlocks: ["Centauri Preserve", "+1 energy from fungus"] },
  { key: "pre_sentient_algorithms",name: "Pre-Sentient Algorithms",prerequisites: ["adv_military_algorithms", "cyberethics"],              cost: 150, track: "conquer",   level: 5, unlocks: ["Hunter-Seeker Algorithm prereq"] },
  { key: "fusion_power",         name: "Fusion Power",          prerequisites: ["pre_sentient_algorithms", "superconductor"],              cost: 150, track: "discover",  level: 5, unlocks: ["Fusion Reactor (20 HP)", "Engineer specialist", "Fusion Lab"] },
  { key: "silksteel_alloys",     name: "Silksteel Alloys",      prerequisites: ["adv_subatomic_theory", "industrial_automation"],           cost: 150, track: "build",     level: 5, unlocks: ["Silksteel Armor (Def 4)"] },
  { key: "planetary_economics",  name: "Planetary Economics",   prerequisites: ["environmental_economics", "intellectual_integrity"],       cost: 150, track: "build",     level: 5, unlocks: ["Ascetic Virtues prereq", "Corner Global Energy Market victory"] },
  { key: "mind_machine_interface",name: "Mind/Machine Interface",prerequisites: ["doctrine_air_power", "neural_grafting"],                 cost: 150, track: "conquer",   level: 5, unlocks: ["Chopper chassis", "Drop Pods ability", "Cyborg Factory prereq"] },
  { key: "retroviral_engineering",name: "Retroviral Engineering",prerequisites: ["bio_engineering", "adv_military_algorithms"],             cost: 150, track: "conquer",   level: 5, unlocks: ["Genejack Factory"] },

  // ── Level 6 ──
  { key: "superstring_theory",   name: "Superstring Theory",    prerequisites: ["nonlinear_mathematics", "cyberethics"],                   cost: 180, track: "discover",  level: 6, unlocks: ["Chaos Gun (Atk 8)"] },
  { key: "orbital_spaceflight",  name: "Orbital Spaceflight",   prerequisites: ["doctrine_air_power", "pre_sentient_algorithms"],           cost: 180, track: "conquer",   level: 6, unlocks: ["Missile chassis", "Sky Hydroponics Lab", "Nessus Mining Station"] },
  { key: "organic_superlubricant",name: "Organic Superlubricant",prerequisites: ["fusion_power", "synthetic_fossil_fuels"],                cost: 180, track: "discover",  level: 6, unlocks: ["Fusion Laser (Atk 10)"] },
  { key: "monopole_magnets",     name: "Monopole Magnets",      prerequisites: ["superstring_theory", "silksteel_alloys"],                 cost: 180, track: "build",     level: 6, unlocks: ["Mag Tube enhancement"] },
  { key: "industrial_nanorobotics",name: "Industrial Nanorobotics",prerequisites: ["industrial_automation", "monopole_magnets"],            cost: 180, track: "build",     level: 6, unlocks: ["Robotic Assembly Plant", "Nano Factory prereq"] },
  { key: "applied_relativity",   name: "Applied Relativity",    prerequisites: ["superconductor", "adv_subatomic_theory"],                 cost: 180, track: "discover",  level: 6, unlocks: ["Supercollider prereq"] },
  { key: "centauri_genetics",    name: "Centauri Genetics",     prerequisites: ["centauri_meditation", "retroviral_engineering"],            cost: 180, track: "explore",   level: 6, unlocks: ["+1 mineral from fungus", "Pholus Mutagen prereq"] },
  { key: "adv_ecological_engineering", name: "Adv. Ecological Engineering", prerequisites: ["fusion_power", "environmental_economics"],   cost: 180, track: "build",     level: 6, unlocks: ["Soil Enricher", "Super Former ability"] },

  // ── Level 7+ (abbreviated — key late-game techs) ──
  { key: "nanominiaturization",  name: "Nanominiaturization",   prerequisites: ["monopole_magnets", "organic_superlubricant"],              cost: 210, track: "build",     level: 7, unlocks: ["Hovertank chassis"] },
  { key: "digital_sentience",    name: "Digital Sentience",     prerequisites: ["industrial_nanorobotics", "mind_machine_interface"],       cost: 210, track: "build",     level: 7, unlocks: ["Network Backbone prereq"] },
  { key: "photon_wave_mechanics",name: "Photon/Wave Mechanics", prerequisites: ["applied_relativity", "silksteel_alloys"],                 cost: 210, track: "discover",  level: 7, unlocks: ["Photon Wall (Def 5)"] },
  { key: "unified_field_theory", name: "Unified Field Theory",  prerequisites: ["monopole_magnets", "applied_relativity"],                 cost: 210, track: "discover",  level: 7, unlocks: ["Tachyon Bolt (Atk 12)"] },
  { key: "quantum_power",        name: "Quantum Power",         prerequisites: ["unified_field_theory", "planetary_economics"],             cost: 240, track: "discover",  level: 8, unlocks: ["Quantum Chamber reactor (30 HP)"] },
  { key: "sentient_econometrics", name: "Sentient Econometrics", prerequisites: ["planetary_economics", "digital_sentience"],               cost: 240, track: "build",     level: 8, unlocks: ["Corner Global Energy Market", "Paradise Garden"] },
  { key: "self_aware_machines",  name: "Self-Aware Machines",   prerequisites: ["digital_sentience", "orbital_spaceflight"],                cost: 240, track: "build",     level: 8, unlocks: ["Self-Aware Colony prereq", "Orbital facilities"] },
  { key: "centauri_psi",         name: "Centauri Psi",          prerequisites: ["centauri_genetics", "adv_ecological_engineering"],          cost: 240, track: "explore",   level: 8, unlocks: ["Psi Attack weapon", "+1 nutrient from fungus"] },
  { key: "homo_superior",        name: "Homo Superior",         prerequisites: ["digital_sentience", "doctrine_initiative"],                cost: 270, track: "discover",  level: 9, unlocks: ["Universal Translator prereq"] },
  { key: "secrets_creation",     name: "Secrets of Creation",   prerequisites: ["unified_field_theory", "centauri_psi"],                    cost: 270, track: "discover",  level: 9, unlocks: ["Bonus tech to first discoverer"] },
  { key: "secrets_alpha_centauri",name: "Secrets of Alpha Centauri", prerequisites: ["centauri_psi", "sentient_econometrics"],              cost: 300, track: "explore",   level: 10, unlocks: ["Bonus tech to first discoverer", "Transcendi specialist", "+1 energy from fungus"] },
  { key: "singularity_mechanics",name: "Singularity Mechanics", prerequisites: ["secrets_creation", "self_aware_machines"],                 cost: 300, track: "discover",  level: 10, unlocks: ["Singularity Engine reactor (40 HP)"] },
  { key: "threshold_transcendence",name: "Threshold of Transcendence", prerequisites: ["secrets_creation", "unified_field_theory"],        cost: 360, track: "explore",   level: 12, unlocks: ["Voice of Planet prereq", "Ascent to Transcendence"] },
];

// ─── Lookup helpers ───────────────────────────────────────────

const techMap = new Map<string, Tech>();
TECH_TREE.forEach(t => techMap.set(t.key, t));

export function getTech(key: string): Tech | undefined {
  return techMap.get(key);
}

// Get technologies available to research (prereqs met, not already discovered)
export function getResearchableTechs(discoveredTechs: string[]): Tech[] {
  const discovered = new Set(discoveredTechs);
  return TECH_TREE.filter(tech => {
    if (discovered.has(tech.key)) return false;
    return tech.prerequisites.every(p => discovered.has(p));
  });
}

// Get the starting tech(s) for a faction
export function getFactionStartingTechs(factionKey: string): string[] {
  switch (factionKey) {
    case "GAIANS":   return ["centauri_ecology"];
    case "HIVE":     return ["doctrine_loyalty"];
    case "UNIV":     return ["information_networks"]; // +1 bonus tech handled separately
    case "MORGAN":   return ["industrial_economics"];
    case "SPARTANS": return ["doctrine_mobility"];
    case "BELIEVE":  return ["social_psych"];
    case "PEACE":    return ["biogenetics"];
    default:         return [];
  }
}

// Calculate labs per turn for a faction (simplified: 1 per base pop, modified by facilities)
export function calculateLabsPerTurn(bases: Map<string, any>, factionId: number): number {
  let labs = 0;
  for (const [, base] of bases) {
    if (base.owner !== factionId) continue;
    let baseLabs = base.population; // 1 lab per citizen working
    // Network node: +50%
    if (base.facilities.includes("network_node")) {
      baseLabs = Math.floor(baseLabs * 1.5);
    }
    // Research hospital: +50%
    if (base.facilities.includes("research_hospital")) {
      baseLabs = Math.floor(baseLabs * 1.5);
    }
    labs += Math.max(1, baseLabs);
  }
  return labs;
}
