# OrbitMechanics

[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](#) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#)

> Real orbital physics in a browser tab — place your satellites, plot your burns, and guide spacecraft through gravitational fields that actually obey Newton

OrbitMechanics is a browser-based puzzle game built on real Newtonian physics. Distances are in AU, masses in kg, velocities in AU/s. A Verlet integrator advances the simulation each tick; a Kepler solver computes trajectory previews in real time so you see your orbit before committing a burn. Patched conics handle sphere-of-influence transitions between bodies. 30 handcrafted levels across four acts, plus a Sandbox mode that unlocks after Act 1.

## Features

- **Real physics** — Verlet integration with gravitational constants derived from astronomical values; no fake orbital shortcuts
- **Trajectory preview** — Kepler solver renders your projected orbit arc in real time before you commit a delta-v burn
- **Patched conics** — smooth sphere-of-influence handoff between bodies as your spacecraft crosses gravitational boundaries
- **30 levels** — four acts of handcrafted challenges from basic circular parking orbits to multi-body gravity assists
- **Sandbox mode** — place stars, planets, and satellites in any configuration and watch the system evolve; no win condition, pure exploration
- **Zero dependencies** — pure TypeScript and the browser's native Canvas 2D API; nothing to install beyond Node

## Quick Start

### Prerequisites

- Node.js 26+ (also supported by the lockfile: Node 22.22.2+ on the 22 line or 24.15.0+ on the 24 line)
- npm (included with Node)

### Installation

```bash
git clone https://github.com/saagpatel/OrbitMechanics.git
cd OrbitMechanics
npm ci
```

### Usage

```bash
# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build locally
npm run preview
```

## Verification

Run from the repository root after `npm ci` (uses `package-lock.json`). Select the test file related to your change first; for example:

```bash
npm test -- tests/utils/Vector2.test.ts
# Physics changes: select the relevant tests/simulation/*.test.ts file.
# Broader unit gate:
npm test
# TypeScript checking followed by the production bundle:
npm run build
```

`npm test` runs once; `npm run test:watch` is the interactive alternative. No lint or formatter script is configured in `package.json`.

For Canvas, input, level progression, or simulation display changes, run `npm run dev` and check the affected level and Sandbox in a browser, including pause/reset, controls and a narrow viewport. Use a separate browser profile because progress is stored in localStorage. The page calls Vercel Analytics, which loads an external debug script in development: block all non-loopback requests during browser verification. If your browser setup cannot intercept those requests, record this browser lane as unavailable rather than launching it as a bounded local check. Unit tests do not prove rendering or interaction behavior. Pure documentation changes do not require browser checks.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.7 (strict mode) |
| Bundler | Vite 6 |
| Rendering | HTML5 Canvas 2D API |
| Physics | Custom Verlet integrator + patched conics |
| Orbit preview | Kepler solver (analytical) |
| Tests | Vitest 3 |
| Deploy | Vercel |

## Architecture

The simulation loop runs at a fixed physics timestep decoupled from the render framerate. The Verlet integrator accumulates forces from all gravitating bodies each tick; when a spacecraft crosses a body's sphere of influence the patched-conics solver takes over for the preview calculation. The Kepler analytical solver only runs on the preview path — committed trajectories always use the integrator to stay consistent. All physics state is plain TypeScript objects; no external physics library.

## License

MIT
