# CHIRON RISING

A 4X strategy game inspired by Sid Meier's Alpha Centauri with LLM-powered diplomacy and original SMAC voice-overs.

Built with Tauri + React + TypeScript. ~9,000 lines across 23 source files.

## Quick Start

```bash
cd chiron-rising
npm install
npm run dev
```

Open http://localhost:1420

### Desktop App (Tauri)

Requires [Rust](https://rustup.rs/) and Tauri CLI.

```bash
npm run tauri dev        # Dev mode with hot reload
npm run tauri build      # Production build (.exe / .dmg / .AppImage)
```

## What's In the Game

### Phase 1 — Core Engine ✅
- Procedural hex map (48×32) with fractal noise terrain: ocean, shelf, flats, rolling, hills, mountains
- Xenofungus, rivers flowing downhill, bonus resource squares, monoliths
- 7 SMAC-inspired factions with unique colors and starting bonuses
- Colony Pods, Terraformers, Scout Patrols, Infantry, Speeders, Probe Teams
- Base founding, terraforming (farm, mine, solar, forest, road), resource model
- Neutral Mind Worms, turn cycle

### Phase 2 — Fog of War & Visuals ✅
- Full fog of war system (hidden → explored → visible)
- Textured terrain rendering with elevation shading
- Animated xenofungus, coastline effects, geometric unit icons
- Faction-colored base markers and territory borders

### Phase 3 — Production & Tech ✅
- Production queues with 20+ buildable items (units, facilities, secret projects)
- Tech tree with 50+ technologies across 4 research tracks (Explore/Discover/Build/Conquer)
- Tech prerequisites, faction starting techs, research progress UI
- Mineral costs, build times, tech-gated production

### Phase 4 — Social Engineering & Resources ✅
- 4 SE categories × 4 choices each (16 total), all tech-gated
- 10 social factors: Economy, Efficiency, Support, Morale, Police, Growth, Planet, Probe, Industry, Research
- Faction intrinsic bonuses, agendas, and aversions (e.g., Gaians can't go Free Market)
- SMAC-accurate resource formulas: nutrients from rainfall, minerals from rockiness, energy from elevation
- Roads as separate infrastructure (coexist with improvements)
- Movement costs: roads free, flat 1, hills 2, fungus 3

### Phase 5 — Unit Automation & AI Opponents ✅
- Auto-Former (prioritizes improvements by terrain), Auto-Scout, Auto-Patrol, Sentry, Hold, Fortify
- AI faction decision-making: base founding, production choices, military AI, expansion
- AI social engineering (factions pursue their agenda)
- AI colony pods evaluate terrain quality and found bases at good locations
- AI military units chase nearby enemies or patrol near bases

### Phase 6 — LLM Diplomacy ✅
- Full comm screen for talking to faction leaders via local LLM (Ollama)
- Rich character bibles for all 7 leaders with ideology, personality, speaking style
- Game context injection: year, military strength, base count, recent events
- Quick diplomatic actions: treaties, demands, tech trade, threats, ceasefire
- Conversation history with context window management
- Supports Ollama, llama.cpp, OpenAI, and Anthropic backends

### Phase 7 — Sound & Voice-Overs ✅
- 60+ original SMAC sound effects mapped to game events
- Tech discovery voice-over quotes (the iconic voiced quotes)
- Facility completion voice-overs
- Faction leader intro speeches on diplomacy open
- Opening narration at game start
- SMAC-style Operations Director prompts for idle production/research
- Scroll wheel zoom (cursor-centered, 0.3x–4.0x)

### Phase 8 — Combat, Save/Load, Minimap ✅
- SMAC-style round-by-round combat resolution
- Terrain defense: Hills +50%, Mountains +75%, Rolling +25%, Fungus +50%, Forest +25%
- Base defense +25%, Perimeter Defense +100%, Command Center +25%, Fortify +25%
- Morale modifiers from SE, psi combat for mindworms, health-based effectiveness
- Base capture when last defender killed
- Combat odds preview with win probability bar and modifier list
- Save/Load: Ctrl+S/Ctrl+L, autosave every 5 turns, file export/import
- Continue Saved Game on title screen
- Minimap in bottom-right corner with click-to-jump

### Phase 9 — Secret Projects ✅
- 19 Secret Projects (wonders) — planet-unique, one builder only
- Weather Paradigm, Human Genome, Command Nexus, Citizens' Defense Force, Virtual World, Planetary Transit, Supercollider, Ascetic Virtues, Longevity Vaccine, Hunter-Seeker Algorithm, Pholus Mutagen, Cyborg Factory, Theory of Everything, Dream Twister, Voice of Planet, Network Backbone, Planetary Datalinks, Maritime Control, Nano Factory
- Projects shown in sidebar with builder faction
- Fortify order for combat units (Shift+F, +25% defense)

## Sound Effects & Voice-Overs

If you own SMAC on Steam, copy the original assets:

```powershell
xcopy "C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Alpha Centauri\fx" public\fx\ /E
xcopy "C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Alpha Centauri\voices" public\voices\ /E
```

Without these files the game runs silently — no errors. Toggle sound with 🔊 in the top bar.

## LLM Diplomacy Setup

Default: Ollama at localhost:11434. Start any model:

```bash
ollama run llama3.2
```

Then click a faction leader in the DIPLOMACY panel or press **D**.

Also supports llama.cpp (port 8080), OpenAI API, and Anthropic API.

## Controls

| Key | Action |
|-----|--------|
| **Click** | Select/move unit, select tile |
| **Right click** | Deselect |
| **Scroll wheel** | Zoom in/out |
| **Click + drag** | Pan map |
| **Enter** | End turn |
| **B** | Found base (Colony Pod) |
| **F** | Build farm (Former) |
| **M** | Build mine (Former) |
| **S** | Build solar collector (Former) |
| **P** | Plant forest (Former) |
| **R** | Build road (Former) |
| **A** | Automate unit |
| **L** | Sentry mode |
| **H** | Hold position |
| **Shift+F** | Fortify (+25% defense) |
| **Z** | Cancel orders |
| **E** | Social Engineering picker |
| **D** | Open diplomacy |
| **Ctrl+S** | Save game |
| **Ctrl+L** | Load game |
| **Esc** | Deselect / close |

## Project Structure

```
chiron-rising/
├── src/
│   ├── game/
│   │   ├── hexMap.ts            # Hex math, procedural map generation
│   │   ├── gameState.ts         # Core game state, units, bases, turns, resources
│   │   ├── techTree.ts          # 50+ technologies, 4 research tracks
│   │   ├── socialEngineering.ts # 16 SE choices, 10 social factors
│   │   ├── unitAutomation.ts    # Auto-former, auto-scout, patrol AI
│   │   ├── aiOpponent.ts        # AI faction decision-making
│   │   ├── combat.ts            # SMAC-style combat with terrain/morale modifiers
│   │   └── saveLoad.ts          # Save/load serialization, autosave, file export
│   ├── llm/
│   │   ├── llmClient.ts         # LLM abstraction (Ollama/OpenAI/Anthropic)
│   │   └── factionPersonalities.ts # Character bibles for all 7 leaders
│   ├── audio/
│   │   ├── soundSystem.ts       # Web Audio API, 60+ SMAC sound mappings
│   │   └── voiceSystem.ts       # Tech/facility/faction voice-overs
│   ├── components/
│   │   ├── HexMap.tsx           # Canvas hex map renderer with zoom
│   │   ├── InfoPanel.tsx        # Sidebar: tile info, production, research, SE, diplomacy
│   │   ├── DiplomacyScreen.tsx  # LLM-powered faction leader conversations
│   │   ├── TurnPrompts.tsx      # Operations Director / Research Director modals
│   │   └── Minimap.tsx          # Corner minimap with click-to-jump
│   ├── App.tsx                  # Main app, setup screen, keyboard shortcuts
│   └── main.tsx                 # Entry point
├── src-tauri/                   # Tauri (Rust) desktop backend
│   ├── icons/                   # App icons (.ico, .png)
│   ├── tauri.conf.json          # Tauri v2 config
│   └── src/
└── public/
    ├── fx/                      # SMAC sound effects (user-provided)
    └── voices/                  # SMAC voice-overs (user-provided)
```

### Phase 10 — Project Effects, Victory, Healing ✅
- Secret project effects now applied: resource bonuses, free facilities, combat modifiers, research multipliers
- Command Nexus: +20% combat for all units, free Command Center at every base
- Citizens' Defense Force: free Perimeter Defense at every base
- Supercollider/Theory of Everything: +100% labs at host base
- Longevity Vaccine: +50% economy at every base
- Dream Twister: +50% psi attack
- Nano Factory: full unit repair each turn
- Network Backbone: +1 energy per base
- Unit healing: 1 HP/turn in bases, 2 HP with Research Hospital, 1 HP when fortified in field
- Victory conditions: Conquest (all bases), Transcendence (Voice of Planet + tech), Economic (50%+ energy + 1000+), Diplomatic (75%+ bases)
- Defeat detection: eliminated if you lose all bases and colony pods
- Victory screen with Continue Playing / New Game options

### Phase 11 — Territory, Treaties, Population ✅
- Faction contact system: must discover factions by spotting their units/bases before diplomacy
- Treaty system: No Treaty → Truce → Treaty of Friendship → Pact of Brotherhood → Vendetta
- Territory enforcement: trespassing without a treaty warns player and damages relations (-3 per move)
- AI respects borders: won't enter your territory without a treaty or vendetta
- Treaty management in diplomacy screen with status bar and action buttons
- Drone riots: bases with pop > 3 generate drones, reduced by facilities and police units; riots halt production
- Golden Age: no drones + talents ≥ pop + pop ≥ 3 = double growth rate
- Territory expansion: bases auto-claim tiles in expanding radius as population grows
- Auto-work: new citizens automatically assigned to best available tile
- Drone/Golden Age status displayed in base info panel

## Roadmap — What's Next

- [ ] Unit designer (weapon + armor + chassis combinations)
- [ ] Naval units and ocean gameplay
- [ ] Specialists (doctors, engineers, librarians)
- [ ] Multiplayer (stretch goal)

---

*"In the great commons at Gaia's Landing we have a tall and particularly beautiful stand of white pine..."*
