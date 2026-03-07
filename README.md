# CHIRON RISING

A 4X strategy game inspired by Sid Meier's Alpha Centauri with LLM-powered diplomacy, original SMAC voice-overs, and a full unit designer.

Built with Tauri + React + TypeScript. ~10,000 lines across 24 source files.

## Quick Start

```bash
cd chiron-rising
npm install
npm run dev
```

Open http://localhost:1420

### Desktop App (Tauri)

```bash
npm run tauri dev        # Dev mode
npm run tauri build      # Production build (.exe / .dmg / .AppImage)
```

## What's In the Game

### Map & Exploration
- Procedural hex map (48×32) with fractal terrain: ocean, shelf, flats, rolling, hills, mountains
- Rivers, xenofungus, monoliths, bonus resource squares
- Supply pods (Unity wreckage) with random rewards: energy, free tech, survivors, mindworm attacks
- Fog of war: hidden → explored → visible, per-faction tracking
- Minimap with click-to-jump navigation

### Economy & Growth
- SMAC-accurate resources: nutrients from rainfall, minerals from rockiness, energy from elevation
- Base growth with food surplus thresholds, starvation mechanics
- Drone riots: pop > 3 generates drones; facilities and police suppress them; riots halt production
- Golden Age: no drones + talents ≥ pop = double growth rate
- Territory expansion: bases auto-claim tiles as population grows
- Specialists: Doctor (+2⚡, -1 drone), Engineer (+3⛏), Librarian (+3⚡ labs), Empath (+2⚡, -2 drones), Transcendi (+4⚡, +1🌿, +1⛏, +talent)

### Production & Technology
- 30+ buildable items: units, facilities, secret projects, custom designs
- 50+ technologies across 4 research tracks (Explore/Discover/Build/Conquer)
- Social Engineering: 4 categories × 4 choices (16 total), 10 social factors
- Faction agendas and aversions (Gaians can't go Free Market, Hive can't go Democratic)

### Military & Combat
- SMAC-style round-by-round combat with terrain defense, base defense, fortify bonus, morale, psi combat
- Combat odds preview with win probability and modifier breakdown
- Base capture when last defender killed
- Unit Designer (Workshop): combine weapons (Atk 1–12), armor (Def 1–5), chassis (infantry/speeder/hovertank/foil/cruiser/needlejet/chopper), reactors (10–40 HP)
- Unit automation: auto-former, auto-scout, auto-patrol, sentry, hold, fortify

### Naval Units
- Foil Patrol (light combat), Cruiser (heavy warship), Transport Foil (carries land units), Sea Former (builds kelp farms, mining platforms, tidal harnesses)
- Sea Lurk (ocean mindworm variant)
- Naval units move on ocean/shelf tiles, can enter coastal bases

### AI Opponents
- AI base founding with terrain quality evaluation and faction-specific base names
- AI production decisions, military tactics, expansion strategy
- AI social engineering (factions pursue their agenda)
- AI respects territory borders (won't trespass without treaty/vendetta)
- AI proposes treaties when relations are good, declares vendetta when hostile

### LLM Diplomacy (Ollama)
- Talk to faction leaders via local LLM — they respond in character with unique ideology and personality
- **LLM decisions drive real game effects**: propose a treaty and the AI leader decides based on personality, game state, and relations
- Quick diplomatic actions: Propose Treaty, Propose Pact, Request Ceasefire, Offer Technology, Offer Tribute, Threaten War
- When accepted: treaties are signed, energy changes hands, relations shift
- When rejected: relations take a hit
- Fallback logic when LLM unavailable — game still playable without Ollama
- Game context injected: year, military strength, bases, recent events, current treaty status

### Secret Projects (Wonders)
- 19 planet-unique Secret Projects with applied global effects
- Only one base per faction can build a given project at a time
- Command Nexus (+20% combat, free Command Centers), Citizens' Defense (free Perimeter Defense), Supercollider (+100% labs), Dream Twister (+50% psi attack), Nano Factory (full unit repair), and more

### Territory & Treaties
- Faction contact: must discover factions by spotting units/bases before diplomacy
- Treaties: No Treaty → Truce → Treaty of Friendship → Pact of Brotherhood → Vendetta
- Territory enforcement: trespassing damages relations; AI respects borders
- Treaty management in diplomacy screen with status bar

### Sound & Voice-Overs
- 60+ original SMAC sound effects mapped to game events
- Tech discovery voice-over quotes, facility voices, faction leader intros, opening narration
- Toggle with 🔊 button

### Save/Load & Victory
- Ctrl+S/L save/load, autosave every 5 turns, file export/import
- Continue Saved Game on title screen
- Victory: Conquest (all bases), Transcendence (Voice of Planet + tech), Economic (50%+ energy), Diplomatic (75%+ bases)
- Defeat detection on elimination

### UI & Quality of Life
- Textured terrain with animated water caustics, glowing xenofungus, snow-capped mountains
- SMAC-style rectangular unit shields with faction stripe, silhouette, attack/defense/moves stats
- Color-coded planetary log (combat red, tech blue, production green, projects gold)
- Top bar: energy treasury, base count, unit count, research progress %
- Context-sensitive keyboard hints at bottom of screen
- Tab cycles idle units with camera centering, Space centers on selected unit
- Auto-select first idle unit after ending turn

## Sound Effects & Voice-Overs

If you own SMAC on Steam:

```powershell
xcopy "C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Alpha Centauri\fx" public\fx\ /E
xcopy "C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Alpha Centauri\voices" public\voices\ /E
```

Without these files the game runs silently — no errors.

## LLM Diplomacy Setup

```bash
ollama run llama3.2
```

Then click a faction leader in DIPLOMACY or press **D**. The LLM makes real game decisions — accepting/rejecting treaties, responding to threats, negotiating trades. Without Ollama, diplomacy uses fallback logic.

Also supports llama.cpp, OpenAI API, and Anthropic API.

## Controls

| Key | Action |
|-----|--------|
| **Click** | Select/move unit, select tile |
| **Right click** | Deselect |
| **Scroll wheel** | Zoom in/out (cursor-centered) |
| **Click + drag** | Pan map |
| **Tab** | Next idle unit (cycles + centers camera) |
| **Space** | Center camera on selected unit |
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
| **W** | Open Unit Designer (Workshop) |
| **E** | Social Engineering picker |
| **D** | Open diplomacy (first known faction) |
| **Z** | Cancel orders |
| **Ctrl+S** | Save game |
| **Ctrl+L** | Load game |
| **Esc** | Deselect / close |

## Project Structure

```
chiron-rising/
├── src/
│   ├── game/
│   │   ├── gameState.ts         # Core state, units, bases, turns, resources
│   │   ├── hexMap.ts            # Hex math, procedural map gen, supply pods
│   │   ├── techTree.ts          # 50+ technologies, 4 research tracks
│   │   ├── socialEngineering.ts # 16 SE choices, 10 social factors
│   │   ├── combat.ts            # SMAC-style combat with terrain/morale modifiers
│   │   ├── aiOpponent.ts        # AI decision-making, diplomacy, faction base names
│   │   ├── unitAutomation.ts    # Auto-former, auto-scout, patrol AI
│   │   ├── unitDesigner.ts      # Weapon/armor/chassis/reactor combinations
│   │   ├── diplomacy.ts         # Treaty system, territory enforcement
│   │   ├── projectsAndVictory.ts # Secret project effects, victory conditions
│   │   └── saveLoad.ts          # Save/load serialization, autosave
│   ├── llm/
│   │   ├── llmClient.ts         # LLM abstraction (Ollama/OpenAI/Anthropic)
│   │   └── factionPersonalities.ts # Character bibles for all 7 leaders
│   ├── audio/
│   │   ├── soundSystem.ts       # Web Audio API, 60+ SMAC sound mappings
│   │   └── voiceSystem.ts       # Tech/facility/faction voice-overs
│   ├── components/
│   │   ├── HexMap.tsx           # Canvas renderer with terrain/unit/base visuals
│   │   ├── InfoPanel.tsx        # Sidebar: resources, production, research, SE, diplomacy
│   │   ├── DiplomacyScreen.tsx  # LLM conversations with game effect parsing
│   │   ├── TurnPrompts.tsx      # Operations Director / Research Director modals
│   │   ├── UnitDesigner.tsx     # Workshop UI for custom unit designs
│   │   └── Minimap.tsx          # Corner minimap
│   ├── App.tsx                  # Main app, keyboard shortcuts, game flow
│   └── main.tsx
├── src-tauri/                   # Tauri desktop backend
│   ├── icons/                   # App icons
│   └── src/
└── public/
    ├── fx/                      # SMAC sound effects (user-provided)
    └── voices/                  # SMAC voice-overs (user-provided)
```

## Development History

| Phase | Features |
|-------|----------|
| 1 | Core engine, hex map, 7 factions, units, bases, terraforming |
| 2 | Fog of war, textured terrain, animated xenofungus, coastlines |
| 3 | Production queues, tech tree (50+ techs), research UI |
| 4 | Social engineering (16 choices, 10 factors), SMAC resource formulas |
| 5 | Unit automation, AI opponents (base founding, military, expansion) |
| 6 | LLM diplomacy (Ollama), faction leader conversations |
| 7 | Sound effects (60+ SMAC wavs), voice-overs, Operations Director prompts |
| 8 | Combat system (terrain/morale/base defense), save/load, minimap |
| 9 | 19 Secret Projects with global effects, fortify order |
| 10 | Project effects applied, victory conditions, unit healing |
| 11 | Territory enforcement, treaties, drone riots, golden age, border expansion |
| 12 | Unit Designer (weapon/armor/chassis/reactor), missing facilities |
| 13 | Custom unit production, Tab unit cycling, Space camera center, auto-select |
| 14 | Supply pods (exploration rewards), AI diplomacy, resource display, production ETA |
| 15 | Naval units (Foil/Cruiser/Transport/Sea Former), specialists, sea improvements |
| 16 | UI polish: color-coded log, status bar, context-sensitive keyboard hints |
| 17 | LLM-driven game effects: diplomatic proposals → ACCEPT/REJECT → treaties/energy/relations, faction-specific base names, secret project exclusivity fix |

## Roadmap

- [ ] Air units and drop pods
- [ ] Multiplayer (stretch goal)

---

*"In the great commons at Gaia's Landing we have a tall and particularly beautiful stand of white pine..."*
