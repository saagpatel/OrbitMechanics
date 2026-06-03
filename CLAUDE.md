# Orbit Mechanic

Browser-based explorable explanation game teaching orbital mechanics through direct manipulation — 30 hand-authored levels, Canvas simulation, full sandbox. No backend; fully static, localStorage only.

## Stack

- TypeScript 5.7+ (strict mode)
- Vite 6+ (build + dev server)
- HTML5 Canvas 2D — browser native (no WebGL, no physics library)
- Vitest 3+ (unit tests for all physics math)
- Vercel (static deploy target)

## Build / Test / Run

```sh
npm install          # install dev dependencies
npm run dev          # dev server at localhost:5173
npm test             # unit tests via Vitest
npm run build        # TypeScript compile + Vite production build
npm run preview      # preview production build locally
```

## Architecture

- `src/simulation/` — physics math (Velocity Verlet integrator)
- `src/game/` — game logic
- `src/renderer/` — Canvas 2D rendering
- `src/levels/` — level data as JSON files (data-driven; add levels without code changes)
- `src/renderer/Viewport.ts` — simulation space (AU) ↔ screen space (pixel) conversion
- `src/game/GameLoop.ts` — fixed timestep with accumulator (simulation tick is decoupled from `requestAnimationFrame`)

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Physics integrator | Velocity Verlet | Better energy conservation than RK4 for orbital mechanics |
| Preview trajectory | Analytical Kepler (2-body) | Exact for Acts 1–2; patched conics approximation for 3+ body |
| Rendering | Canvas 2D (no WebGL) | Sufficient for 2D at 60fps; avoids WebGL boilerplate |
| State management | Plain TypeScript classes | No framework needed for Canvas game state |
| Simulation units | AU for distance, AU/s for velocity | Keeps physics math clean; viewport handles pixel scaling |
| Sandbox unlock | After Level 8 (end of Act 1) | Motivates completion without frustrating sandbox-first players |

## Conventions & Constraints

- File naming: camelCase for files, PascalCase for classes/interfaces
- Type with `unknown` + narrowing — strict mode, no `any`, no implicit types
- Every simulation function requires a corresponding unit test in `tests/`
- Runtime dependencies: `@vercel/analytics` only — no game engine, UI framework, or physics library in bundle (the simulation is written from scratch — that's the point)
- DOM for menus/HUD only; Canvas for all game rendering — no React, Vue, or UI framework
- Scope gate: stay within IMPLEMENTATION-ROADMAP.md — sound, multiplayer, and 3D are v2 scope
- Conventional commits: `feat:`, `fix:`, `test:`, `chore:`

<!-- portfolio-context:start -->
# Portfolio Context

## What This Project Is

A browser-based explorable explanation game that teaches orbital mechanics through direct manipulation. Players place bodies and draw velocity vectors on an HTML Canvas, watch orbits form via real-time simulation, and progress through 30 hand-authored levels before unlocking a full sandbox. No backend — fully static, localStorage only.

## Current State

**v1.0 complete** — all 4 phases shipped. 30 levels across 4 acts, Sandbox mode, Vercel deploy.

## Stack

- TypeScript: 5.7+ (strict mode, no `any`)
- Vite: 6+ (build tool + dev server)
- HTML5 Canvas 2D: browser native (no WebGL, no physics library)
- Vitest: 3+ (unit tests for all physics math)
- Vercel: static deploy target

## How To Run

- `npm install` — install dev dependencies
- `npm run dev` — dev server at localhost:5173
- `npm test` — unit tests via Vitest
- `npm run build` — TypeScript compile + Vite production build
- `npm run preview` — preview production build locally

## Known Risks

- Do not use any external physics libraries — the simulation is written from scratch (that's the point)
- Do not use React, Vue, or any UI framework — DOM for menus/HUD only, Canvas for game rendering
- Do not couple the simulation tick to `requestAnimationFrame` — use fixed timestep with accumulator in `GameLoop.ts`
- Do not store any state server-side — localStorage only, nothing leaves the browser
- Do not add sound, multiplayer, or 3D mode — these are v2 features
- Do not add features not in the current phase of IMPLEMENTATION-ROADMAP.md

## Next Recommended Move

Use this context plus the README and supporting docs to resume the next active task, then promote the repo beyond minimum-viable by capturing a dedicated handoff, roadmap, or discovery artifact.

<!-- portfolio-context:end -->
