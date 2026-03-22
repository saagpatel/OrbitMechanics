# Orbit Mechanic

## Overview
A browser-based explorable explanation game that teaches orbital mechanics through direct manipulation. Players place bodies and draw velocity vectors on an HTML Canvas, watch orbits form via real-time simulation, and progress through 30 hand-authored levels before unlocking a full sandbox. No backend — fully static, localStorage only.

## Tech Stack
- TypeScript: 5.4+ (strict mode, no `any`)
- Vite: 5.2+ (build tool + dev server)
- HTML5 Canvas 2D: browser native (no WebGL, no physics library)
- Vitest: 1.6+ (unit tests for all physics math)
- Vercel: static deploy target

## Development Conventions
- TypeScript strict mode — no `any`, no implicit types
- File naming: camelCase for files, PascalCase for classes/interfaces
- Coordinate system: simulation space in AU; screen space in pixels via `Viewport.ts`
- No runtime dependencies — zero npm packages in production bundle
- Physics math goes in `src/simulation/`, game logic in `src/game/`, rendering in `src/renderer/`
- Every simulation function must have a corresponding unit test in `tests/`
- Conventional commits: `feat:`, `fix:`, `test:`, `chore:`

## Current Phase
**Phase 0: Simulation Engine (Week 1)**
See IMPLEMENTATION-ROADMAP.md for full phase details, all subsequent phases, and complete architecture.

## Key Decisions
| Decision | Choice | Why |
|----------|--------|-----|
| Physics integrator | Velocity Verlet | Better energy conservation than RK4 for orbital mechanics |
| Preview trajectory | Analytical Kepler (2-body) | Exact for Acts 1–2; patched conics approximation for 3+ body |
| Rendering | Canvas 2D (no WebGL) | Sufficient for 2D at 60fps; avoids WebGL boilerplate |
| State management | Plain TypeScript classes | No framework needed for Canvas game state |
| Simulation units | AU for distance, AU/s for velocity | Keeps physics math clean; viewport handles pixel scaling |
| Sandbox unlock | After Level 8 (end of Act 1) | Motivates completion without frustrating sandbox-first players |
| Level data | JSON files in `src/levels/` | Data-driven; no code changes for new levels |
| Level editor | `?devtools=1` URL param | Needed to author 30 levels; not exposed to players |

## Do NOT
- Do not use any external physics libraries — the simulation is written from scratch (that's the point)
- Do not use React, Vue, or any UI framework — DOM for menus/HUD only, Canvas for game rendering
- Do not couple the simulation tick to `requestAnimationFrame` — use fixed timestep with accumulator in `GameLoop.ts`
- Do not store any state server-side — localStorage only, nothing leaves the browser
- Do not add sound, multiplayer, or 3D mode — these are v2 features
- Do not add features not in the current phase of IMPLEMENTATION-ROADMAP.md
