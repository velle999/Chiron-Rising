# CHIRON RISING

A 4X strategy game inspired by Sid Meier's Alpha Centauri with LLM-powered diplomacy and original SMAC voice-overs.

Built with Tauri + React + TypeScript. ~10,000 lines across 25 source files.

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

### Core Systems
- **Procedural hex map** (48×32) with fractal terrain: ocean, shelf, flats, rolling, hills, mountains, rivers, xenofungus, monoliths, supply pods
- **7 factions** with unique bonuses, agendas, colors, and starting techs
- **Fog of war**: hidden → explored → visible, per-faction tracking
- **Textured terrain** with animated water caustics, glowing xenofungus, snow-capped mountains, detailed improvements

### Economy & Growth
- **SMAC-accurate resources**: nutrients from rainfall, minerals from rockiness, energy from elevation
- **Base growth** with food surplus → population threshold, starvation mechanics
- **Drone riots**: pop > 3 generates drones; facilities and police suppress them; riots halt production
- **Golden Age**: no drones + talents ≥ pop = double growth rate
- **Territory expansion**: bases auto-claim tiles as population grows, new citizens auto-assigned to best tiles
- **Production queues** with 25+ buildable items, tech-gated production

### Technology & Social Engineering
- **50+ technologies** across 4 research tracks (Explore/Discover/Build/Conquer) with prerequisites
- **Social Engineering**: 4 categories × 4 choices (16 total), 10 social factors affecting economy/growth/morale/etc.
- **Faction agendas and aversions** (Gaians can't go Free Market, Hive can't go Democratic)

### Military & Combat
- **SMAC-style combat**: round-by-round resolution, terrain defense (Hills +50%, Mountains +75%), base defense, fortify bonus, morale modifiers, psi combat
- **Combat odds preview** with win probability and modifier list
- **Base capture** when last defender killed
- **Unit Designer** (Workshop): combine weapons (1-12 atk), armor (1-5 def), chassis (infantry/speeder/hovertank/foil/cruiser/needlejet/chopper), and reactors (fission→singularity, 10-40 HP)
- **Unit automation**: auto-former, auto-scout, auto-patrol, sentry, hold, fortify

### AI Opponents
- AI faction decision-making: base founding, production choices, military tactics, expansion
- AI evaluates terrain quality for base sites, manages social engineering
- AI respects territory borders (won't trespass without treaty/vendetta)
- AI proposes treaties when relations are good, declares vendetta when hostile

### Diplomacy & Territory
- **Faction contact**: must discover factions by exploring before diplomacy opens
- **Treaties**: No Treaty → Truce → Treaty of Friendship → Pact of Brotherhood → Vendetta
- **Territory enforcement**: trespassing damages relations; AI respects borders
- **LLM diplomacy**: talk to faction leaders via Ollama with rich character personalities
- **Treaty management** in diplomacy screen with status bar and action buttons

### Secret Projects (Wonders)
- 19 planet-unique Secret Projects with applied global effects
- Command Nexus, Citizens' Defense Force, Supercollider, Dream Twister, Nano Factory, Voice of Planet, and more
- Projects shown in sidebar with builder faction

### Exploration
- **Supply pods** (Unity wreckage) scattered across the map
- Rewards: energy caches, free technologies, resource bonuses, survivor units, or mindworm attacks
- Glowing animated capsules with "U" logo visible on map

### Sound & Voice-Overs
- 60+ original SMAC sound effects mapped to game events
- Tech discovery quotes, facility voices, faction leader intros, opening narration
- Toggle with 🔊 button

### Save/Load & Victory
- Ctrl+S/L save/load, autosave every 5 turns, file export/import
- Continue Saved Game on title screen
- Victory conditions: Conquest, Transcendence, Economic, Diplomatic
- Defeat detection on elimination
- Minimap with click-to-jump

## Sound Effects & Voice-Overs

If you own SMAC on Steam:

```powershell
xcopy "C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Alpha Centauri\fx" public\fx\ /E
xcopy "C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Alpha Centauri\voices" public\voices\ /E
```

## LLM Diplomacy

```bash
ollama run llama3.2
```

Then click a faction leader in DIPLOMACY or press **D**.

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
│   │   ├── gameState.ts         # Core state, units, bases, turns, resources (~1,500 lines)
│   │   ├── hexMap.ts            # Hex math, procedural map gen, supply pods
│   │   ├── techTree.ts          # 50+ technologies, 4 research tracks
│   │   ├── socialEngineering.ts # 16 SE choices, 10 social factors
│   │   ├── combat.ts            # SMAC-style combat with terrain/morale modifiers
│   │   ├── aiOpponent.ts        # AI faction decision-making & diplomacy
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
│   │   ├── HexMap.tsx           # Canvas renderer (~1,100 lines)
│   │   ├── InfoPanel.tsx        # Sidebar UI (~730 lines)
│   │   ├── DiplomacyScreen.tsx  # LLM-powered faction conversations
│   │   ├── TurnPrompts.tsx      # Operations Director / Research Director modals
│   │   ├── UnitDesigner.tsx     # Workshop UI for custom unit designs
│   │   └── Minimap.tsx          # Corner minimap
│   ├── App.tsx                  # Main app (~860 lines)
│   └── main.tsx
├── src-tauri/                   # Tauri desktop backend
└── public/
    ├── fx/                      # SMAC sound effects (user-provided)
    └── voices/                  # SMAC voice-overs (user-provided)
```

## Development History

| Phase | Features |
|-------|----------|
| 1 | Core engine, hex map, factions, units, bases, terraforming |
| 2 | Fog of war, textured terrain, animated xenofungus |
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

| 15 | Naval units (Foil, Cruiser, Transport, Sea Former), specialists (Doctor/Engineer/Librarian/Empath/Transcendi), sea improvements |

## Roadmap

- [ ] Air units and drop pods
- [ ] Multiplayer (stretch goal)

---

*"In the great commons at Gaia's Landing we have a tall and particularly beautiful stand of white pine..."*
