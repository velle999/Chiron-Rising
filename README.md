# CHIRON RISING

A 4X strategy game inspired by Sid Meier's Alpha Centauri with LLM-powered diplomacy.

Built with Tauri + React + TypeScript.

## Phase 1 — What's Working

- **Hex map generation** with fractal noise terrain (ocean, shelf, flats, rolling, hills, mountains)
- **Xenofungus** scattered across the landscape
- **Rivers** flowing downhill from mountain sources
- **Bonus resource squares** randomly placed
- **7 SMAC factions** with faction-colored territory
- **Units**: Colony Pods, Terraformers, Scout Patrols, neutral Mind Worms
- **Base founding** from Colony Pods with named bases
- **Terraforming**: farms, mines, solar collectors, forests, roads
- **Resource system**: nutrients, minerals, energy per tile
- **Base growth**: population increases/decreases based on food surplus
- **Simple combat** against Mind Worms and enemy units
- **Turn cycle** with resource accumulation and unit refresh
- **Keyboard shortcuts**: B=found base, F=farm, M=mine, S=solar, P=plant forest, R=road, Enter=end turn, Esc=deselect

## Quick Start (Browser Dev Mode)

```bash
cd chiron-rising
npm install
npm run dev
```

Open http://localhost:1420

## Build as Desktop App (Tauri)

Requires [Rust](https://rustup.rs/) and Tauri CLI.

```bash
npm install
npm run tauri dev        # Dev mode with hot reload
npm run tauri build      # Production build
```

## Project Structure

```
chiron-rising/
├── src/
│   ├── game/
│   │   ├── hexMap.ts        # Hex math, map gen, terrain
│   │   └── gameState.ts     # Game state, units, bases, turns
│   ├── llm/
│   │   └── llmClient.ts     # LLM abstraction (llama.cpp/OpenAI/Anthropic)
│   ├── components/
│   │   ├── HexMap.tsx        # Canvas hex map renderer
│   │   └── InfoPanel.tsx     # Sidebar info/actions panel
│   ├── App.tsx               # Main app + setup screen
│   └── main.tsx              # Entry point
├── src-tauri/                # Tauri (Rust) backend
└── public/
```

## LLM Integration (Coming in Phase 4)

The LLM client already supports three backends:
- **llama.cpp** — local models via OpenAI-compatible API
- **OpenAI** — GPT-4o, etc.
- **Anthropic** — Claude

Diplomacy system will let you have freeform conversations with AI faction leaders
who make actual game decisions (treaties, trade, war) based on their personality
and the current game state.

## Controls

- **Left click**: Select unit / move selected unit / select tile
- **Right click**: Deselect
- **Scroll/drag**: Pan map
- **Enter**: End turn
- **Escape**: Deselect

## Roadmap

- [ ] Phase 2: Fog of war, exploration, AI unit movement
- [ ] Phase 3: Full tech tree, social engineering, facilities, production queues
- [ ] Phase 4: LLM diplomacy — talk to faction leaders, negotiate treaties
- [ ] Phase 5: Unit workshop, victory conditions, audio, polish

---

*"In the great commons at Gaia's Landing we have a tall and particularly beautiful stand of white pine..."*
