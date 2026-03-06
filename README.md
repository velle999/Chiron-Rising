# CHIRON RISING

A 4X strategy game inspired by Sid Meier's Alpha Centauri with LLM-powered diplomacy and original SMAC voice-overs.

Built with Tauri + React + TypeScript.

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
npm run tauri build      # Production build
```

## What's In the Game

### Phase 1 — Core Engine ✅
- Procedural hex map (48×32) with fractal noise terrain: ocean, shelf, flats, rolling, hills, mountains
- Xenofungus, rivers flowing downhill, bonus resource squares, monoliths
- 7 SMAC-inspired factions with unique colors and starting bonuses
- Colony Pods, Terraformers, Scout Patrols, Infantry, Speeders, Probe Teams
- Base founding, terraforming (farm, mine, solar, forest, road), resource model
- Simple combat, neutral Mind Worms, turn cycle

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
- Auto-Former (prioritizes improvements by terrain), Auto-Scout, Auto-Patrol, Sentry, Hold
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
| **F** | Build farm |
| **M** | Build mine |
| **S** | Build solar collector |
| **P** | Plant forest |
| **R** | Build road |
| **A** | Automate unit |
| **L** | Sentry mode |
| **H** | Hold position |
| **Z** | Cancel orders |
| **E** | Social Engineering picker |
| **D** | Open diplomacy |
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
│   │   └── aiOpponent.ts        # AI faction decision-making
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
│   │   └── TurnPrompts.tsx      # Operations Director / Research Director modals
│   ├── App.tsx                  # Main app, setup screen, keyboard shortcuts
│   └── main.tsx                 # Entry point
├── src-tauri/                   # Tauri (Rust) desktop backend
└── public/
    ├── fx/                      # SMAC sound effects (user-provided)
    └── voices/                  # SMAC voice-overs (user-provided)
```

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
- Projects include: Weather Paradigm, Human Genome, Command Nexus, Virtual World, Planetary Transit, Supercollider, Hunter-Seeker Algorithm, Cyborg Factory, Voice of Planet, and more
- Projects shown in sidebar with builder faction
- Fortify order for combat units (Shift+F, +25% defense)

## Roadmap — What's Next

- [ ] Secret project global effects (currently tracked but effects not all applied)
- [ ] Unit designer (weapon + armor + chassis combinations)
- [ ] Drone riots / golden age / specialists
- [ ] Naval units and ocean gameplay
- [ ] Diplomacy actions with game effects (treaties, pacts, vendetta)
- [ ] Victory conditions (Transcendence, Conquest, Diplomatic, Economic)
- [ ] Multiplayer (stretch goal)

---

*"In the great commons at Gaia's Landing we have a tall and particularly beautiful stand of white pine..."*
