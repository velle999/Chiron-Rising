// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Voice-Over System
// Maps game events to original SMAC voice clips (voices/ folder)
// Tech discovery quotes, faction intros, facility completion
// ═══════════════════════════════════════════════════════════════

import { soundManager } from "./soundSystem";

// ─── Tech Key → SMAC Tech Index ──────────────────────────────
// Index is 0-based position in alpha.txt #TECHNOLOGY section
// tech0.mp3 = Biogenetics, tech1.mp3 = Industrial Base, etc.

export const TECH_VOICE_MAP: Record<string, number> = {
  // Level 1
  "biogenetics":              0,
  "industrial_base":          1,
  "information_networks":     2,
  "applied_physics":          3,
  "social_psych":             4,
  "doctrine_mobility":        5,
  "centauri_ecology":         6,

  // Level 2+
  "superconductor":           7,
  "nonlinear_mathematics":    8,
  "applied_relativity":       9,
  "fusion_power":            10,
  "silksteel_alloys":        11,
  "adv_subatomic_theory":    12,
  "high_energy_chemistry":   13,
  // 14 = Frictionless Surfaces (not in our tree)
  // 15 = Nanometallurgy (not in our tree)
  "superstring_theory":      16,
  "adv_military_algorithms": 17,
  "monopole_magnets":        18,
  // 19 = Matter Compression
  "unified_field_theory":    20,
  // 21 = Graviton Theory
  "polymorphic_software":    22,
  // 23 = Applied Gravitonics
  // 24 = deleted
  "quantum_power":           25,
  "singularity_mechanics":   26,
  // 27 = Controlled Singularity
  // 28 = Temporal Mechanics
  // 29 = Probability Mechanics
  "pre_sentient_algorithms": 30,
  // 31 = Super Tensile Solids
  "planetary_networks":      32,
  "digital_sentience":       33,
  "self_aware_machines":     34,
  "doctrine_initiative":     35,
  "doctrine_flexibility":    36,
  "intellectual_integrity":  37,
  "synthetic_fossil_fuels":  38,
  "doctrine_air_power":      39,
  "photon_wave_mechanics":   40,  // Photon/Wave Mechanics
  "mind_machine_interface":  41,
  "nanominiaturization":     42,
  "doctrine_loyalty":        43,
  "ethical_calculus":         44,
  "industrial_economics":    45,
  "industrial_automation":   46,
  "centauri_meditation":     47,
  "secrets_human_brain":     48,
  "gene_splicing":           49,
  "bio_engineering":         50,
  // 51 = Biomachinery
  "neural_grafting":         52,
  "cyberethics":             53,
  // 54 = Eudaimonia
  // 55 = The Will to Power
  "threshold_transcendence": 56,
  // 57 = Matter Transmission
  "centauri_empathy":        58,
  "environmental_economics": 59,
  "ecological_engineering":  60,
  "planetary_economics":     61,
  "adv_ecological_engineering": 62,
  "centauri_psi":            63,
  "secrets_alpha_centauri":  64,
  "secrets_creation":        65,
  // 66 = Advanced Spaceflight
  "homo_superior":           67,
  "organic_superlubricant":  68,
  // 69 = Quantum Machinery
  // 70 = deleted
  // 71 = Matter Editation
  "optical_computers":       72,
  "industrial_nanorobotics": 73,
  "centauri_genetics":       74,
  "sentient_econometrics":   75,
  "retroviral_engineering":  76,
  "orbital_spaceflight":     77,
};

// ─── Facility Key → SMAC Facility Voice Index ────────────────
// fac1.mp3 through fac41.mp3, plus fac340-fac410 for SMACX

export const FACILITY_VOICE_MAP: Record<string, number> = {
  "recycling_tanks":     2,
  "network_node":        4,
  "energy_bank":         5,
  "perimeter_defense":   6,
  "recreation_commons":  1,
  "children_creche":     9,
  "command_center":      3,
  "research_hospital":  10,
  "tree_farm":          12,
  "hab_complex":        14,
  "biology_lab":        15,
  "hologram_theatre":   16,
  "fusion_lab":         18,
  "aerospace_complex":  23,
  "genejack_factory":   24,
  "robotic_assembly":   25,
  "pressure_dome":      29,
  "centauri_preserve":  30,
  "skunkworks":         31,
};

// ─── Faction Key → Voice File ────────────────────────────────

export const FACTION_VOICE_MAP: Record<string, string> = {
  "GAIANS":   "gaians.mp3",
  "HIVE":     "hive.mp3",
  "UNIV":     "univ.mp3",
  "MORGAN":   "morgan.mp3",
  "SPARTANS": "spartans.mp3",
  "BELIEVE":  "believe.mp3",
  "PEACE":    "peace.mp3",
};

// ─── Voice Playback ──────────────────────────────────────────

const voiceBasePath = "/voices/";

// Currently playing voice — only one at a time
let currentVoice: { source: AudioBufferSourceNode; gainNode: GainNode } | null = null;

async function loadVoiceBuffer(filename: string): Promise<AudioBuffer | null> {
  try {
    const url = voiceBasePath + encodeURIComponent(filename);
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const ctx = (soundManager as any).audioContext as AudioContext;
    if (!ctx) return null;
    return await ctx.decodeAudioData(arrayBuffer);
  } catch {
    return null;
  }
}

export function stopVoice() {
  if (currentVoice) {
    try {
      currentVoice.source.stop();
    } catch {}
    currentVoice = null;
  }
}

async function playVoiceFile(filename: string) {
  if (!soundManager.isEnabled()) return;

  const ctx = (soundManager as any).audioContext as AudioContext;
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume();

  // Stop any currently playing voice
  stopVoice();

  const buffer = await loadVoiceBuffer(filename);
  if (!buffer) return;

  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  gainNode.gain.value = soundManager.getVolume();
  source.buffer = buffer;
  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start(0);

  currentVoice = { source, gainNode };
  source.onended = () => {
    if (currentVoice?.source === source) {
      currentVoice = null;
    }
  };
}

// ─── Public API ──────────────────────────────────────────────

/** Play the voice-over for a tech discovery */
export function playTechVoice(techKey: string) {
  const idx = TECH_VOICE_MAP[techKey];
  if (idx !== undefined) {
    playVoiceFile(`tech${idx}.mp3`);
  }
}

/** Play the voice-over for a facility completion */
export function playFacilityVoice(facilityKey: string) {
  const idx = FACILITY_VOICE_MAP[facilityKey];
  if (idx !== undefined) {
    playVoiceFile(`fac${idx}.mp3`);
  }
}

/** Play the faction leader intro */
export function playFactionIntro(factionKey: string) {
  const file = FACTION_VOICE_MAP[factionKey];
  if (file) {
    playVoiceFile(file);
  }
}

/** Play opening narration */
export function playOpeningNarration(gender: "f" | "m" = "f") {
  playVoiceFile(gender === "f" ? "openingf.mp3" : "openingm.mp3");
}
