# OrbitMechanic Codex Playbook

## Communication Contract

Follow the global Codex communication contract. Keep updates short, PM-readable, operator-grade, and focused on what changed, what passed, and what still needs attention.

## Project Goal

OrbitMechanic is a browser-based explorable explanation game for orbital mechanics. It teaches through direct manipulation on HTML Canvas, fixed-timestep simulation, hand-authored levels, and a fully static localStorage-only runtime.

## First Read

- `README.md`
- `CLAUDE.md`
- `IMPLEMENTATION-ROADMAP.md`
- `package.json`
- `README.md#verification`

## Core Rules

- Keep physics implemented from scratch; do not add external physics libraries.
- Keep rendering on Canvas 2D; do not add WebGL, React, Vue, or another UI framework.
- Keep simulation tick independent from `requestAnimationFrame`; use the fixed timestep accumulator.
- Keep state local-only; do not add backend storage, accounts, telemetry, or sync.
- Keep physics math under `src/simulation/`, game logic under `src/game/`, and rendering under `src/renderer/`.
- Every new simulation function should have focused tests.

## Codex App Usage

- Use Codex App Projects for repo-scoped implementation, debugging, and verification.
- Use Worktrees for physics integrator, coordinate system, renderer, level data, storage, game-loop, or broad gameplay changes.
- Use file search before editing because behavior spans simulation math, viewport transforms, renderer code, game state, and level data.
- Use browser or Playwright evidence for canvas, level progression, input, responsive layout, and visual simulation behavior.
- Use artifacts only for reusable level-design notes or handoffs.

## Verification

Use npm with `package-lock.json`. The locked stack is TypeScript 7.0.2, Vite 8.3.2, and Vitest 5.0.2. Node.js must satisfy `^22.22.2 || ^24.15.0 || >=26.0.0` (22.22.2+ on the 22 line, 24.15.0+ on the 24 line, or 26+; excludes Node 23 and 25), the intersection of all locked dependency engine ranges.

Use [README verification](README.md#verification) as the canonical local gate; it documents dependency installation, focused and broader tests, build/typecheck, and conditional browser checks.

## Done Criteria

- The relevant verifier commands have been run, or the exact blocker is recorded.
- Physics changes have unit tests and simulation sanity evidence.
- Canvas/gameplay changes have browser or screenshot evidence when visual behavior matters.
