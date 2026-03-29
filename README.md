![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white) ![Vitest](https://img.shields.io/badge/Vitest-3-6E9F18?logo=vitest&logoColor=white) ![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel&logoColor=white)

# OrbitMechanics

A browser-based orbital mechanics puzzle game built on real Newtonian physics. Place satellites, apply delta-v burns, and guide spacecraft into target orbits across 30 handcrafted levels spanning four acts.

The simulation runs Verlet integration with gravitational constants derived from real astronomical values — distances in AU, masses in kg, velocities in AU/s. A patched-conics solver handles sphere-of-influence transitions between bodies, and a Kepler solver computes orbit previews in real time so you can see your trajectory before committing a burn.

After completing Act 1 a free-form **Sandbox** mode unlocks, letting you place any combination of stars, planets, and satellites and watch the system evolve under gravity with no win condition.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.7 (strict mode) |
| Bundler | Vite 6 |
| Rendering | HTML5 Canvas 2D API |
| Physics | Custom Verlet integrator + patched conics |
| Tests | Vitest 3 |
| Deploy | Vercel |

No runtime dependencies — the entire game is pure TypeScript and the browser's native Canvas API.

## Prerequisites

- Node.js 18+
- npm (comes with Node)

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run tests
npm test
```

Open `http://localhost:5173` in your browser after `npm run dev`.

## Project Structure

```
OrbitMechanics/
├── src/
│   ├── game/           # Game loop, input, level management, win/fail logic
│   ├── levels/         # Level definitions (JSON) — 30 levels across 4 acts
│   │   ├── act1/       # Levels 1–8
│   │   ├── act2/       # Levels 9–16
│   │   ├── act3/       # Levels 17–22
│   │   └── act4/       # Levels 23–30
│   ├── renderer/       # Canvas renderer, gravity field overlay, orbital data overlay
│   ├── simulation/     # Verlet integrator, Kepler solver, patched conics, physics constants
│   ├── types/          # Shared TypeScript types
│   ├── ui/             # Screen manager and all UI screens (HUD, menus, overlays)
│   ├── utils/          # Local storage persistence
│   └── main.ts         # Entry point
├── tests/              # Vitest test suite
├── index.html
├── vite.config.ts
└── vitest.config.ts
```

## How to Play

1. **Select a level** from the level select screen.
2. **Click on the canvas** to place your satellite (when a placement is required).
3. **Click and drag** from the satellite to draw a delta-v vector — a trajectory preview renders live.
4. **Release** to commit the burn and start the simulation.
5. Reach the target orbit to win. Fewer burns earns more stars.

**Keyboard shortcuts** during gameplay:

| Key | Action |
|---|---|
| `Space` | Pause / resume |
| `1` / `2` / `3` / `4` | Set time scale (0.1×, 1×, 5×, 20×) |
| `Shift + drag` | Pan the viewport |
| `Scroll wheel` | Zoom in / out |
| `Escape` | Return to main menu |

<!-- TODO: Add screenshot -->

## License

No license file is present in this repository. All rights reserved by the author.
