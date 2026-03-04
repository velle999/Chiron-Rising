// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Sound System
// Maps game events to original SMAC sound effects via Web Audio API
// ═══════════════════════════════════════════════════════════════

// ─── Sound Event Mapping ─────────────────────────────────────
// Maps our game events to the original SMAC fx/ filenames

export const SOUND_MAP: Record<string, string> = {
  // Turn / UI
  "turn_complete":        "cpu turn complete.wav",
  "menu_click":           "menu up.wav",
  "menu_back":            "menu down.wav",
  "menu_out":             "menu out.wav",
  "ok":                   "ok.wav",
  "switch":               "switch1.wav",
  "button_change":        "ax button change.wav",
  "opening_menu":         "opening menu.wav",

  // Production
  "prod_complete":        "cpu prod complete.wav",
  "project_complete":     "CPU project complete.wav",
  "project_initiated":    "CPU project initiated.wav",
  "enemy_project":        "CPU enemy project initiated.wav",

  // Orders / Units
  "new_orders":           "cpu new orders.wav",
  "mission_accomplished": "cpu mission accomplished.wav",
  "mission_aborted":      "cpu mission aborted.wav",
  "unit_lost":            "CPU unit lost.wav",
  "terraform_complete":   "CPU terraform complete.wav",
  "invalid_command":      "cpu invalid command.wav",
  "nocando":              "cpu nocando.wav",
  "lacks_ability":        "cpu lacks ability.wav",
  "invalid_base_site":    "cpu invalid base site.wav",
  "bad_base_site":        "cpu bad base site.wav",
  "invalid_terraform":    "cpu invalid terraform.wav",
  "improved_already":     "cpu improved already.wav",

  // Research / Data
  "new_data":             "cpu new data.wav",
  "review_options":       "CPU review your options.wav",
  "data":                 "data.wav",

  // Combat
  "combat_report":        "cpu combat report.wav",
  "units_engaged":        "cpu units engaged.wav",
  "battle1":              "battle1_.wav",
  "battle2":              "battle2_.wav",
  "psi_attack":           "psi attack.wav",
  "mindworms":            "mindworms.wav",
  "mind_worm_attack":     "cpu mind worm attack.wav",
  "soft_hit":             "soft hit.wav",
  "boom":                 "boom.wav",

  // Weapons
  "wpn_laser":            "wpn laser2.wav",
  "wpn_gatlin":           "wpn gatlin laser.wav",
  "wpn_fusion":           "wpn fusion laser.wav",
  "wpn_particle":         "wpn particle.wav",
  "wpn_missile":          "wpn missile.wav",
  "wpn_plasma":           "wpn plasma shard.wav",
  "wpn_tachyon":          "wpn tachyon bolt.wav",
  "wpn_chaos":            "wpn chaos gun.wav",
  "wpn_graviton":         "wpn graviton gun.wav",
  "wpn_quantum":          "wpn quantum laser.wav",
  "wpn_singularity":      "wpn singularity laser.wav",
  "wpn_resonance":        "wpn resonance laser.wav",
  "wpn_string":           "wpn string disruptor.wav",
  "wpn_spore":            "wpn spore launcher.wav",

  // Unit movement
  "move_infantry":        "infantry.wav",
  "move_hover":           "hover.wav",
  "move_jet":             "jet.wav",
  "move_ship":            "ship.wav",
  "move_alien":           "alien infantry.wav",
  "move_non_military":    "non military land.wav",
  "move_military":        "military land.wav",

  // Base / Population
  "base_founded":         "pop1.wav",
  "drone_riots":          "cpu drone riots.wav",
  "drone_riots_over":     "cpu drone riots over.wav",
  "golden_age":           "cpu golden age begun.wav",
  "golden_age_over":      "cpu golden age over.wav",
  "max_population":       "cpu max population.wav",
  "pod_recovered":        "cpu pod recovered.wav",
  "data_pod":             "cpu data pod recovered.wav",
  "faction_gone":         "cpu faction gone.wav",

  // Resources
  "resource_shortfall":   "cpu resource shortfall.wav",
  "insufficient_energy":  "cpu insufficient energy.wav",
  "nutrient_resources":   "CPU nutrient resources.wav",
  "mineral_resources":    "CPU mineral resources.wav",
  "energy_resources":     "CPU energy resources.wav",

  // Confirmation
  "are_you_certain":      "cpu are you certain1.wav",
  "request_confirmation": "cpu request confirmation.wav",
  "please_dont_go":       "CPU please don't go.wav",

  // Misc
  "indigenous_lifeforms": "CPU indigenous lifeforms.wav",
  "improvement_destroyed":"cpu improvement destroyed.wav",
  "crash_land":           "crash land.wav",
  "energy1":              "energy1.wav",
};

// ─── Sound Manager ───────────────────────────────────────────

class SoundManager {
  private audioContext: AudioContext | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private basePath: string = "/fx/";
  private enabled: boolean = true;
  private volume: number = 0.7;
  private gainNode: GainNode | null = null;
  private loading: Set<string> = new Set();

  // Initialize audio context (must be called from user interaction)
  init() {
    if (this.audioContext) return;
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(this.audioContext.destination);
  }

  // Set the base path for sound files
  setBasePath(path: string) {
    this.basePath = path.endsWith("/") ? path : path + "/";
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Load a sound file into the buffer cache
  private async loadSound(filename: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(filename)) return this.bufferCache.get(filename)!;
    if (this.loading.has(filename)) return null; // Already loading
    if (!this.audioContext) return null;

    this.loading.add(filename);

    try {
      const url = this.basePath + encodeURIComponent(filename);
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Sound not found: ${filename}`);
        this.loading.delete(filename);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.bufferCache.set(filename, audioBuffer);
      this.loading.delete(filename);
      return audioBuffer;
    } catch (err) {
      console.warn(`Failed to load sound: ${filename}`, err);
      this.loading.delete(filename);
      return null;
    }
  }

  // Preload commonly used sounds
  async preload(events: string[]) {
    const promises = events.map(event => {
      const filename = SOUND_MAP[event];
      if (filename) return this.loadSound(filename);
      return Promise.resolve(null);
    });
    await Promise.allSettled(promises);
  }

  // Play a sound by event name
  async play(event: string) {
    if (!this.enabled || !this.audioContext || !this.gainNode) return;

    // Resume context if suspended (autoplay policy)
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const filename = SOUND_MAP[event];
    if (!filename) {
      console.warn(`Unknown sound event: ${event}`);
      return;
    }

    let buffer = this.bufferCache.get(filename);
    if (!buffer) {
      buffer = await this.loadSound(filename);
      if (!buffer) return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    source.start(0);
  }

  // Play raw filename (for custom sounds)
  async playFile(filename: string) {
    if (!this.enabled || !this.audioContext || !this.gainNode) return;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    let buffer = this.bufferCache.get(filename);
    if (!buffer) {
      buffer = await this.loadSound(filename);
      if (!buffer) return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    source.start(0);
  }
}

// ─── Singleton Export ────────────────────────────────────────

export const soundManager = new SoundManager();

// ─── Convenience: scan log for sound triggers ────────────────
// Call this after endTurn to play appropriate sounds based on log entries

export function playSoundsForLog(logEntries: string[], previousLogLength: number) {
  const newEntries = logEntries.slice(previousLogLength);

  for (const entry of newEntries) {
    const lower = entry.toLowerCase();

    if (lower.includes("completed!") && lower.includes("discovers")) {
      soundManager.play("new_data");
    } else if (lower.includes("completed!")) {
      soundManager.play("prod_complete");
    } else if (lower.includes("discovers")) {
      soundManager.play("new_data");
    } else if (lower.includes("founded")) {
      soundManager.play("base_founded");
    } else if (lower.includes("defeated") || lower.includes("destroyed")) {
      soundManager.play("combat_report");
    } else if (lower.includes("grown to size")) {
      // Growth is quiet — no sound
    } else if (lower.includes("starvation")) {
      soundManager.play("resource_shortfall");
    } else if (lower.includes("auto-former")) {
      // Don't spam sounds for auto-former
    } else if (lower.includes("alerts: enemy spotted")) {
      soundManager.play("mind_worm_attack");
    } else if (lower.includes("terraform")) {
      soundManager.play("terraform_complete");
    }
  }
}
