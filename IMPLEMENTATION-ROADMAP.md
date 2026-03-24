# Orbit Mechanic — Implementation Roadmap

## Architecture

### System Overview
```
Input Layer
  [Mouse/Touch Events] → [InputController] → [VectorDrawState]
                                                    ↓
Simulation Layer
  [VectorDrawState] → [KeplerSolver (preview)] → [TrajectoryPreview]
  [VectorDrawState] → [VerletSimulation (committed)] → [SimulationState]
                                                              ↓
Game Logic Layer
  [SimulationState] → [WinConditionChecker] → [LevelManager]
  [LevelManager] → [LevelConfig (JSON)] → [SceneBuilder]
                                               ↓
Render Layer
  [SimulationState + TrajectoryPreview] → [CanvasRenderer] → [HTMLCanvas]
  [LevelManager + UIState] → [UIRenderer (DOM)] → [HUD/Menus]
                                                        ↓
Persistence Layer
  [LevelProgress] → localStorage["orbit_progress"]
  [SandboxSaves] → localStorage["orbit_sandbox"]
  [Settings] → localStorage["orbit_settings"]
```

### File Structure
```
orbit-mechanic/
├── index.html                    # Single page entry
├── vite.config.ts                # Vite config, path aliases
├── tsconfig.json                 # Strict TS config
├── package.json
├── vercel.json                   # CSP headers, static deploy config
├── CLAUDE.md
├── IMPLEMENTATION-ROADMAP.md
│
├── public/
│   └── favicon.ico
│
├── src/
│   ├── main.ts                   # App entry point, canvas init, game loop start
│   │
│   ├── types/
│   │   └── index.ts              # ALL shared interfaces — Body, Level, SimState, etc.
│   │
│   ├── simulation/
│   │   ├── VerletSimulation.ts   # Fixed-timestep n-body Velocity Verlet integrator
│   │   ├── KeplerSolver.ts       # Analytical 2-body Kepler orbit solver (preview line)
│   │   ├── PatchedConics.ts      # Multi-body trajectory approximation (SOI-switching)
│   │   └── PhysicsConstants.ts   # G, AU, solar mass, simulation unit scale factors
│   │
│   ├── game/
│   │   ├── LevelManager.ts       # Load level JSON, track progress, unlock logic
│   │   ├── SceneBuilder.ts       # Convert LevelConfig → initial SimulationState
│   │   ├── WinConditionChecker.ts # Evaluate win/fail conditions every 10 ticks
│   │   ├── InputController.ts    # Mouse → vector draw state machine
│   │   └── GameLoop.ts           # requestAnimationFrame loop, timestep accumulator
│   │
│   ├── renderer/
│   │   ├── CanvasRenderer.ts     # Main 2D Canvas draw calls (bodies, trails, preview)
│   │   ├── TrailRenderer.ts      # Fading orbital trail polylines (ring buffer)
│   │   ├── VectorRenderer.ts     # Velocity vector arrow + dotted preview trajectory
│   │   ├── UIRenderer.ts         # DOM-based HUD, level info, star rating overlay
│   │   └── Viewport.ts           # Pan/zoom, sim-space ↔ screen-space transforms
│   │
│   ├── ui/
│   │   ├── screens/
│   │   │   ├── MainMenu.ts       # Title screen — play, level select, sandbox, settings
│   │   │   ├── LevelSelect.ts    # Act/level grid, locked/unlocked/star states
│   │   │   ├── GameHUD.ts        # In-game: burn counter, par, pause, restart, time scale
│   │   │   └── SandboxUI.ts      # Sandbox toolbar: add body, mass slider, save/load
│   │   └── components/
│   │       ├── StarRating.ts     # 3-star display component
│   │       └── TimeControl.ts    # 0.1×/1×/5×/20× multiplier + pause
│   │
│   ├── levels/
│   │   ├── act1/
│   │   │   ├── level-01.json     # Circular orbit
│   │   │   ├── level-02.json
│   │   │   ├── level-03.json
│   │   │   ├── level-04.json
│   │   │   ├── level-05.json
│   │   │   ├── level-06.json
│   │   │   ├── level-07.json
│   │   │   └── level-08.json
│   │   ├── act2/                 # Levels 9–16, transfer orbits
│   │   ├── act3/                 # Levels 17–22, multi-body
│   │   └── act4/                 # Levels 23–30, mastery
│   │
│   ├── devtools/
│   │   └── LevelEditor.ts        # In-browser level editor; enabled via ?devtools=1
│   │
│   └── utils/
│       ├── Vector2.ts            # 2D vector math — add, sub, scale, magnitude, normalize, dot, distance, rotate
│       ├── Storage.ts            # Typed localStorage wrapper
│       └── MathUtils.ts          # clamp, lerp, normalizeAngle
│
└── tests/
    ├── simulation/
    │   ├── VerletSimulation.test.ts   # Energy conservation, circular orbit return accuracy
    │   ├── KeplerSolver.test.ts       # Orbital element computation accuracy
    │   └── WinCondition.test.ts       # All win condition types with synthetic sim states
    └── utils/
        └── Vector2.test.ts            # All 15 vector operations with known values
```

### Type Definitions (src/types/index.ts)
```typescript
// ─── Physics ────────────────────────────────────────────────────────────────

export interface Vector2 {
  x: number;
  y: number;
}

export interface Body {
  id: string;
  mass: number;           // kg
  radius: number;         // display pixels (sqrt-proportional to mass for visibility)
  position: Vector2;      // AU
  velocity: Vector2;      // AU/s
  isFixed: boolean;       // true = anchor body (star/planet); ignores forces
  color: string;          // hex string
  shape: 'circle' | 'triangle' | 'diamond' | 'square'; // for colorblind mode
  label?: string;
  trailPoints: Vector2[]; // ring buffer; capped at trailMaxLength
  trailMaxLength: number;
}

export interface SimulationState {
  bodies: Body[];
  time: number;           // simulation seconds elapsed
  timeScale: number;      // 0.1 | 1 | 5 | 20
  isPaused: boolean;
  isCommitted: boolean;   // false = still drawing vector; true = sim running
  burnCount: number;      // total burns committed this level
  fuelUsed: number;       // total delta-v magnitude used (AU/s units)
  fuelBudget: number | null; // null = unlimited (Act 1)
}

export interface OrbitalElements {
  semiMajorAxis: number;         // AU
  eccentricity: number;          // 0 = circular, 1 = parabolic, >1 = hyperbolic
  period: number;                // simulation seconds
  specificOrbitalEnergy: number; // J/kg — negative = bound orbit
  isEscaping: boolean;           // specificOrbitalEnergy >= 0
}

export interface TrajectoryPoint {
  position: Vector2;
  time: number;
}

// ─── Level System ────────────────────────────────────────────────────────────

export type WinConditionType =
  | 'stable_orbit'
  | 'rendezvous'
  | 'escape_velocity'
  | 'lagrange_station'
  | 'orbital_resonance';

export interface WinCondition {
  type: WinConditionType;
  bodyId?: string;                   // which player body must satisfy this
  targetBodyId?: string;             // reference body (for orbit around, rendezvous with)
  targetEccentricity?: number;       // stable_orbit: target eccentricity
  eccentricityTolerance?: number;    // stable_orbit: ± tolerance (default 0.05)
  targetSemiMajorAxis?: number;      // stable_orbit: target altitude in AU
  semiMajorAxisTolerance?: number;   // ± tolerance in AU
  proximityDistance?: number;        // rendezvous: max distance in AU
  relativeVelocityMax?: number;      // rendezvous: max relative speed (AU/s)
  holdDuration?: number;             // lagrange_station: required hold time (sim seconds)
  lagrangePoint?: 'L4' | 'L5';      // lagrange_station: which point
  resonanceRatio?: [number, number]; // orbital_resonance: e.g. [2, 1]
  resonanceTolerance?: number;       // ± fraction (default 0.05)
  checkWindowTicks?: number;         // how many consecutive passing checks required (default 5)
}

export interface AvailableBody {
  mass: number;
  label?: string;
  color?: string;         // null = player picks from palette
}

export interface LevelConfig {
  id: string;             // "act1-01"
  act: 1 | 2 | 3 | 4;
  levelNumber: number;    // 1–30
  title: string;
  description: string;    // shown in level select only; NOT displayed during play
  fixedBodies: Array<Omit<Body, 'trailPoints' | 'trailMaxLength'>>;
  availableBodies: AvailableBody[];
  winConditions: WinCondition[];    // ALL must be satisfied simultaneously
  failConditions?: WinCondition[];  // ANY triggers failure
  parBurnCount: number;
  maxBurnCount?: number;            // hard limit; null = unlimited
  fuelBudget?: number;              // total delta-v budget in AU/s; null = unlimited
  viewportBounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;     // AU — defines the fixed level camera
  };
  hintText?: string;                // shown after 3+ failed attempts
}

export interface LevelProgress {
  levelId: string;
  completed: boolean;
  bestBurnCount: number;
  stars: 1 | 2 | 3;
  completedAt: number;    // unix timestamp ms
}

// ─── Input State ──────────────────────────────────────────────────────────────

export type DrawPhase = 'idle' | 'selecting_body' | 'drawing_vector' | 'committed';

export interface VectorDrawState {
  phase: DrawPhase;
  selectedBodyId: string | null;
  startPoint: Vector2 | null;    // screen coords at drag start
  currentPoint: Vector2 | null;  // live mouse position (screen coords)
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface GameSettings {
  showOrbitalData: boolean;       // eccentricity/period/energy overlay — off by default
  showGravityField: boolean;      // gravitational vector field overlay — off by default
  showTrails: boolean;            // orbital history trails — on by default
  trailPersistence: boolean;      // sandbox: trails accumulate indefinitely
  audioEnabled: boolean;
  colorblindMode: boolean;        // shape-coded bodies in addition to color
}

// ─── Sandbox ─────────────────────────────────────────────────────────────────

export interface SandboxSave {
  id: string;
  name: string;
  bodies: Array<Omit<Body, 'trailPoints' | 'trailMaxLength'>>;
  savedAt: number;      // unix timestamp ms
}
```

### Physics Constants (src/simulation/PhysicsConstants.ts)
```typescript
// Simulation unit system:
//   Distance: AU (astronomical units) — 1 AU = 1.496e11 m
//   Mass:     kg
//   Time:     seconds
//   Velocity: AU/s
//
// G in SI:           6.674e-11 m³/(kg·s²)
// G in AU³/(kg·s²):  6.674e-11 / (1.496e11)³ = 1.993e-44
//
// Circular orbit velocity at r AU around M kg:
//   v = sqrt(G_AU * M / r)   →   Earth at 1 AU: ~1.991e-7 AU/s (29.78 km/s)

export const G_AU = 1.993e-44;           // AU³/(kg·s²)
export const AU_METERS = 1.496e11;       // meters per AU
export const SOLAR_MASS_KG = 1.989e30;   // kg
export const EARTH_MASS_KG = 5.972e24;   // kg
export const SIM_DT = 200;              // seconds per integration step (~3.3 minutes)
export const BASE_TICKS_PER_FRAME = 50;  // simulation ticks per rendered frame at timeScale=1
export const MAX_TICKS_PER_FRAME = 1200; // hard cap on ticks per frame (safety valve)
export const SOFTENING = 1e-10;          // AU — prevents NaN on body overlap
```

### Dependencies
```bash
# Scaffold
npm create vite@latest orbit-mechanic -- --template vanilla-ts
cd orbit-mechanic

# Dev dependencies only (ZERO runtime dependencies)
npm install -D vitest@1.6 @vitest/ui@1.6

# Verify
npm run dev       # → localhost:5173
npm test          # → Vitest runs, 0 tests (ok)
```

---

## Scope Boundaries

**In scope (v1):**
- 30 hand-authored levels across 4 acts
- Velocity Verlet n-body simulation
- Analytical Kepler preview line (2-body) + patched conics hint (3+ body)
- Win conditions: stable_orbit, rendezvous, escape_velocity, lagrange_station, orbital_resonance
- Burn counter, par system, 3-star rating
- Time controls: 0.1×, 1×, 5×, 20×, pause
- Sandbox mode (unlocked after Level 8) with body placement, mass controls, save/load
- Trail persistence / spirograph mode in sandbox
- Optional overlays: orbital data, gravity field (settings toggle)
- Colorblind accessibility mode (shape-coded bodies)
- Level editor devtools (`?devtools=1`)
- Static deploy to Vercel

**Out of scope (v1):**
- Sound / music
- Mobile / touch (desktop browser only)
- User accounts or cloud saves
- Level sharing / export
- Multiplayer
- 3D mode

**Deferred to v2:**
- Time reversal (negate velocities — trivial for conservative system, but polish needed)
- Historical mission recreations (Apollo 13, Voyager Grand Tour)
- Procedural level generation
- Sandbox config sharing via URL hash
- Community challenges

---

## Security & Credentials

No credentials. No server. No analytics.

- All state in `localStorage` — keys: `orbit_progress`, `orbit_sandbox`, `orbit_settings`
- Nothing leaves the browser
- `vercel.json` sets Content-Security-Policy to block external scripts:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ]
}
```

---

## Phase 0: Simulation Engine (Week 1)

**Objective:** Working physics engine with verified energy conservation and Kepler preview, no UI.

**Tasks:**
1. Scaffold with `npm create vite@latest orbit-mechanic -- --template vanilla-ts`; add Vitest; configure `tsconfig.json` strict mode — **Acceptance:** `npm run dev` opens blank page at localhost:5173; `npm test` runs with 0 tests and exits green

2. Implement `src/utils/Vector2.ts` — functions: `add`, `sub`, `scale`, `magnitude`, `normalize`, `dot`, `distance`, `rotate` — **Acceptance:** `tests/utils/Vector2.test.ts` covers all 8 operations with known values, all pass

3. Implement `src/simulation/PhysicsConstants.ts` — G_AU, AU_METERS, SOLAR_MASS_KG, EARTH_MASS_KG, SIM_DT, BASE_TICKS_PER_FRAME, MAX_TICKS_PER_FRAME, SOFTENING — **Acceptance:** Unit test confirms circular orbit velocity formula: `sqrt(G_AU * SOLAR_MASS_KG / 1.0)` ≈ `1.991e-7` AU/s (Earth's orbital speed at 1 AU)

4. Implement `src/simulation/VerletSimulation.ts` — fixed timestep Velocity Verlet; pairwise gravitational force sum; skip force on `isFixed` bodies — **Acceptance:** Place 1-solar-mass star (fixed) + Earth-mass planet at 1 AU with circular velocity; simulate 1 orbital period (~157,680 ticks at dt=200s); planet returns within 0.001 AU of start; specific orbital energy drifts < 0.01%

5. Implement `src/simulation/KeplerSolver.ts` — `computeOrbitalElements(central: Body, orbiting: Body): OrbitalElements` using vis-viva and angular momentum — **Acceptance:** With Earth at 1 AU circular: eccentricity < 0.001, period ±0.5% of analytical value

6. Implement `src/game/GameLoop.ts` — `requestAnimationFrame` with ticks-per-frame pattern; `onTick(dt)` and `onRender()` callbacks; ticks = `floor(BASE_TICKS_PER_FRAME * timeScale)`, capped at MAX_TICKS_PER_FRAME — **Acceptance:** At 1× timeScale, ~50 ticks per frame (3000 ticks/second at 60fps); pausing tab and resuming runs normal tick count per frame (no catchup)

7. Implement `src/renderer/Viewport.ts` — `simToScreen(pos: Vector2): Vector2` and `screenToSim(pos: Vector2): Vector2`; mouse wheel zoom (0.5×–20×); click+drag pan — **Acceptance:** Body at simulation origin (0, 0) renders at canvas center; body at (1, 0) AU renders at correct pixel offset at default zoom

8. Implement bare `src/renderer/CanvasRenderer.ts` — draw filled circles for bodies only, no trails or UI — **Acceptance:** Two hardcoded bodies in `main.ts` (star at origin, planet at 1 AU) render and orbit each other visibly on the canvas

**Verification Checklist:**
- [ ] `npm test` → all physics tests pass (energy conservation, Kepler accuracy, Vector2 ops)
- [ ] `npm run dev` → two bodies orbit each other on blank canvas
- [ ] Chrome DevTools Performance → steady 60fps, no frame spikes above 20ms
- [ ] 1× speed: Earth orbit completes in ~53 real seconds; 20×: ~2.6 seconds

**Risks:**
- Risk: Orbit decays over many periods due to floating-point accumulation in Verlet
  - Mitigation: Use double precision (JS native Numbers are 64-bit float), verify with energy conservation unit test over 365+ days
  - Fallback: Switch accumulation variable to Kahan summation; or switch to symplectic Euler which has better long-term energy behavior for Hamiltonian systems at the cost of less accurate individual steps

---

## Phase 1: Core Game + Act 1 Levels (Weeks 2–3)

**Objective:** Playable game loop — draw vectors, watch orbits, win levels. All 8 Act 1 levels completable.

**Tasks:**
1. Implement `src/game/InputController.ts` — state machine: `idle → selecting_body → drawing_vector → committed`; click on player body to select; drag to draw vector; mouseup commits — **Acceptance:** Click and drag from a satellite body → see vector arrow; release → simulation starts; clicking empty space cancels selection

2. Implement `src/renderer/VectorRenderer.ts` — draw solid arrow from body (proportional to velocity magnitude); dotted trajectory preview curve (Kepler) updating live during drag — **Acceptance:** Dragging from a satellite body shows dotted orbit preview in real-time; preview matches actual orbit after commit (2-body verification)

3. Implement `src/renderer/TrailRenderer.ts` — ring buffer of `trailMaxLength` positions per body; draw fading polyline (alpha 1.0 → 0.0 over trail length) — **Acceptance:** An orbiting body leaves a fading trail; trail wraps correctly at ring buffer boundary; two complete orbits of trail visible at 200-point buffer

4. Implement `src/game/WinConditionChecker.ts` — evaluate all win conditions every 10 simulation ticks; `stable_orbit` checks eccentricity tolerance + semi-major axis tolerance over `checkWindowTicks` consecutive passing checks — **Acceptance:** `tests/simulation/WinCondition.test.ts`: stable orbit level synthetic state triggers win; escape velocity level triggers win when energy > 0; rendezvous triggers at correct proximity; 0 false positives on a clearly non-winning state

5. Implement `src/game/SceneBuilder.ts` — parse `LevelConfig` JSON → `SimulationState` with correct body positions/masses/velocities — **Acceptance:** Load `act1/level-01.json`; `SceneBuilder.build()` returns SimulationState with bodies matching JSON config exactly

6. Implement `src/game/LevelManager.ts` — load level JSON via `fetch('/src/levels/...')`, track progress in `localStorage['orbit_progress']`, sequential unlock logic — **Acceptance:** Complete Level 1 → `orbit_progress` in localStorage contains level-01 completed; refresh page → Level 2 unlocked; Level 3 still locked

7. Author `src/levels/act1/level-01.json` through `level-08.json`:

   | Level | Title | Win Condition | Fixed Bodies | Player Bodies | Par Burns |
   |-------|-------|---------------|--------------|---------------|-----------|
   | 01 | First Orbit | eccentricity < 0.05, SMA = 0.5 AU ±20% | 1 star (1 solar mass, fixed) | 1 satellite (1e15 kg) | 1 |
   | 02 | Higher Ground | eccentricity < 0.05, SMA = 1.0 AU ±20% | same star | 1 satellite | 1 |
   | 03 | Long Way Around | eccentricity 0.4–0.7, stable | same star | 1 satellite | 1 |
   | 04 | The Other Way | eccentricity < 0.1, retrograde (vY < 0) | same star | 1 satellite | 1 |
   | 05 | Too Fast | specificOrbitalEnergy > 0 (escape) | same star | 1 probe | 1 |
   | 06 | Just Right | SMA = 0.7 AU ±5%, eccentricity < 0.1 | same star | 1 satellite | 1 |
   | 07 | Two Moons | both satellites: eccentricity < 0.1, any stable orbit | 1 planet (10 earth masses) | 2 satellites | 2 |
   | 08 | Circularize | final eccentricity < 0.05 (requires 2+ burns) | 1 star | 1 probe (starts at high eccentricity orbit — `isFixed: false` but pre-positioned with a given velocity) | 2 |

   **Acceptance for all levels:** Each level completable in a single sitting with reference solution; verified manually

8. Implement `src/ui/screens/GameHUD.ts` — DOM overlay: burn counter ("Burns: 2 / Par: 1"), restart button, pause button, time scale controls (0.1×/1×/5×/20×), level title — **Acceptance:** Burn counter increments on each vector commit; pause stops simulation tick; restart resets level to SceneBuilder initial state

9. Implement `src/ui/screens/LevelSelect.ts` — 4 acts × level grid; locked levels show lock icon; completed show star rating; current act highlighted — **Acceptance:** Complete Level 3 → level select shows 3 stars if under par; Level 4 shows unlocked; Levels 5–8 show locked

10. Implement `src/devtools/LevelEditor.ts` — enabled via `?devtools=1` URL param; panel shows: add/move/delete bodies, set mass, set win conditions, export JSON to clipboard — **Acceptance:** Open `localhost:5173?devtools=1`; add two bodies, set win condition, click Export → valid JSON in clipboard; paste into `levels/` folder → loads correctly in game

**Verification Checklist:**
- [ ] Play all 8 Act 1 levels; all completable
- [ ] Level 8 completion: "Sandbox Unlocked" message appears
- [ ] `npm test` → all tests pass including WinCondition suite
- [ ] DevTools Performance → steady 60fps during Level 7 (2-body planet with 2 satellites)
- [ ] localStorage `orbit_progress` → correct state after completing levels 1–4 and refreshing
- [ ] Trajectory preview dotted line matches actual orbit on Level 01 (circular orbit, 2-body — Kepler exact)

**Risks:**
- Risk: Win condition tolerances require per-level tuning — too strict = unbeatable; too loose = trivially easy
  - Mitigation: Test each level with 5 manual attempts across a range of skill levels; expose tolerance as JSON config fields
  - Fallback: Add per-level `toleranceMultiplier` override in JSON; dial individually without code changes

---

## Phase 2: Act 2 Levels + Transfer Mechanics (Weeks 4–5)

**Objective:** Levels 9–16 (Hohmann transfers, bi-elliptic transfers, inclination flips in 2D), fuel system, patched conics preview for gravity assist setups.

**Tasks:**
1. Add fuel system to `SimulationState` — `fuelBudget: number | null`, `fuelUsed: number`; deduct `||deltaV||` (magnitude of velocity change) on each burn — **Acceptance:** Level 9 JSON has `fuelBudget: 2.5e-7` AU/s; exceeding it triggers fail condition; fuel gauge UI shows depletion

2. Add fuel gauge to `GameHUD.ts` — visual bar, AU/s units, turns red at 80% consumed — **Acceptance:** Level 9 fuel gauge depletes as burns are committed; empty gauge triggers level fail message

3. Implement `rendezvous` win condition — within `proximityDistance` AU AND relative velocity magnitude < `relativeVelocityMax` — **Acceptance:** `WinCondition.test.ts` tests: synthetic state with bodies 0.04 AU apart, relative velocity 1e-9 AU/s → win; same but 0.06 AU apart → no win

4. Implement `src/simulation/PatchedConics.ts` — sphere of influence radius per body: `SOI = a * (m_body / m_central)^(2/5)` (Hill sphere approximation); preview trajectory switches dominant gravity body as vehicle crosses SOI boundaries — **Acceptance:** In Level 15 (gravity slingshot setup), trajectory preview visually curves around secondary body; post-encounter direction change visible in preview before committing

5. Author `src/levels/act2/level-09.json` through `level-16.json`:

   | Level | Title | Concept | Win Condition | Par Burns |
   |-------|-------|---------|---------------|-----------|
   | 09 | Two Burns | Hohmann transfer orbit | rendezvous with target probe at outer orbit | 2 |
   | 10 | Short Cut | Bi-elliptic transfer (3-burn is MORE efficient here) | rendezvous at higher orbit | 3 |
   | 11 | Fuel Budget | Hohmann under tight delta-v budget | rendezvous, fuel < 80% budget | 2 |
   | 12 | Mars Run | Earth-to-Mars analog | rendezvous with Mars-analog body | 2 |
   | 13 | Flip It | Retrograde-to-prograde plane change (2D: reverse orbit) | eccentricity < 0.1, retrograde reversed | 1 |
   | 14 | Rescue | Rendezvous with a body in a known elliptical orbit | proximity + velocity match | 2 |
   | 15 | The Slingshot | Set up gravity assist around inner planet | escape velocity from system after assist | 2 |
   | 16 | Efficient | Maximize delta-v left in tank after reaching target orbit | rendezvous + fuel > 50% remaining | 2 |

   **Acceptance:** All 8 levels completable; Level 09 Hohmann transfer discoverable without hint (2-burn solution is most efficient path → 3 stars)

6. Add fuel efficiency to star rating (Act 2+) — 3 stars: ≤ par burns AND ≤ 80% fuel consumed; 2 stars: ≤ par burns; 1 star: completed — **Acceptance:** Level 09 with 3 burns (par = 2) → 2 stars; with 2 burns and ≤80% fuel → 3 stars

**Verification Checklist:**
- [ ] All 16 levels completable
- [ ] Level 09 Hohmann: blind playthrough discovers 2-burn solution within 10 minutes (no hint shown); triggers 3 stars
- [ ] Fuel gauge depletes correctly; out-of-fuel fail triggers "Out of fuel — restart?" prompt
- [ ] `npm test` → rendezvous win condition tests pass; fuel deduction tests pass
- [ ] Level 15 gravity slingshot: trajectory preview shows curved path around secondary body before commit

---

## Phase 3: Acts 3–4 + Sandbox (Weeks 6–8)

**Objective:** All 30 levels, full sandbox mode, trail persistence, optional overlays.

**Tasks:**
1. Author `src/levels/act3/level-17.json` through `level-22.json`:

   | Level | Title | Concept |
   |-------|-------|---------|
   | 17 | Around the Moon | Gravity assist around secondary body |
   | 18 | Double Assist | Two consecutive gravity assists |
   | 19 | Figure Eight | Stable figure-8 orbit (Euler's three-body solution) |
   | 20 | Dance | Trojan asteroid at L4 |
   | 21 | Chaos | Three bodies — prediction diverges intentionally; shows chaos theory |
   | 22 | Tug of War | Two bodies of equal mass; satellite must escape both |

   **Acceptance:** All 6 completable; Level 21 shows visible divergence between preview and actual trajectory (this is the teaching moment — divergence IS the win condition signal)

2. Author `src/levels/act4/level-23.json` through `level-30.json`:

   | Level | Title | Win Condition Type |
   |-------|-------|-------------------|
   | 23 | Find the Balance | lagrange_station (L4) hold 60 sim-days |
   | 24 | The Other Point | lagrange_station (L5) hold 60 sim-days |
   | 25 | Resonance | orbital_resonance 2:1 |
   | 26 | Tidal Lock | orbital_resonance 1:1 (synchronous) |
   | 27 | Grand Tour | 3-body gravity assist chain |
   | 28 | Interplanetary | 4-body solar system analog; Earth → Mars → Jupiter |
   | 29 | The Hard Way | Minimal-fuel path across entire system |
   | 30 | Sandbox Mastery | Place 5 bodies achieving stable resonant configuration |

   **Acceptance:** All 8 completable

3. Implement `lagrange_station` win condition — compute Jacobi constant approximation; check if satellite's position is within ±0.02 AU of L4/L5 point for `holdDuration` consecutive simulation seconds — **Acceptance:** Synthetic test: body at exact L4 of Earth-Moon analog → passes after holdDuration; body 0.05 AU from L4 → fails

4. Implement `orbital_resonance` win condition — compare orbital period ratios of two specified bodies within tolerance — **Acceptance:** Two bodies with period ratio 1.98:1 when tolerance is 0.05 → passes 2:1 resonance check

5. Implement `src/ui/screens/SandboxUI.ts` — toolbar: "Add Body" button (mass slider 1e15–2e30 kg, color picker), delete mode, clear all, save config (name prompt), load config (dropdown) — **Acceptance:** Add 5 bodies with different masses; save as "test"; refresh; load "test" → all 5 bodies restored with correct masses/positions/velocities

6. Implement trail persistence mode (`GameSettings.trailPersistence`) — when enabled: ring buffer expands to 10,000 points per body; old points never removed; trails accumulate indefinitely — **Acceptance:** Enable trail persistence; run 4-body sandbox for 60 sim-days; see dense spirograph-like pattern; canvas shows distinct trail colors

7. Implement orbital data overlay (`GameSettings.showOrbitalData`) — bottom-left panel; for each player body: eccentricity (4 decimal places), semi-major axis (AU, 3 decimal places), period (sim-days, 1 decimal), specific orbital energy (J/kg, scientific notation) — **Acceptance:** Enable overlay on Level 01 solution; eccentricity matches KeplerSolver output ±0.001; update rate ≤ 100ms (don't recompute every tick)

8. Implement gravity field overlay (`GameSettings.showGravityField`) — grid of 20×20 arrow sprites showing gravitational acceleration direction and relative magnitude (arrow length = log10 of magnitude, normalized to viewport); rendered on a Canvas layer below bodies — **Acceptance:** 1-body test: all arrows point toward central mass; magnitude arrows visibly longer near center; overlay has no measurable fps impact at 20×20 grid (< 1ms draw time)

**Verification Checklist:**
- [ ] All 30 levels completable in a full single-session playthrough
- [ ] Sandbox saves/loads correctly; data persists across page refresh
- [ ] Trail persistence: 4-body sandbox, 60 sim-days → dense visible spirograph pattern
- [ ] Orbital data overlay: eccentricity reading matches KeplerSolver value ±0.001 on Level 01
- [ ] `npm test` → all tests pass including Lagrange and resonance win conditions

---

## Phase 4: Polish + Deploy (Week 9)

**Objective:** Main menu, visual polish, accessibility, Vercel deploy.

**Tasks:**
1. Implement `src/ui/screens/MainMenu.ts` — title screen, four buttons: Play (→ Level Select), Sandbox (→ Sandbox), Settings (→ Settings), Credits — **Acceptance:** All 4 buttons navigate correctly; Escape key from any screen returns to main menu (with confirmation if mid-level)

2. Add glow effect to body rendering — Canvas `ctx.shadowBlur` proportional to `sqrt(body.mass / EARTH_MASS_KG)`, capped at 60px shadow blur — **Acceptance:** Massive central star visibly glows; Earth-mass satellite has subtle glow; frame time for glow rendering < 2ms (Profile tab)

3. Add star field background — 200 stars at random positions (seeded with Math random, deterministic), drawn on a background Canvas layer; parallax: panning viewport moves stars at 10% speed — **Acceptance:** Pan across sandbox → stars shift subtly; no performance regression (background layer redraws only on pan/zoom)

4. Implement colorblind mode — `GameSettings.colorblindMode`: each body uses `body.shape` (circle/triangle/diamond/square) in addition to color; filled shapes for heavy bodies, outlined for light — **Acceptance:** Enable colorblind mode → bodies distinguishable with colors set to identical grey; Level 07 with 2 satellites → both visually distinct via shape

5. Add `Settings` screen — toggles: Show Orbital Data, Show Gravity Field, Show Trails, Trail Persistence, Colorblind Mode, Audio (disabled/greyed); all persist to `localStorage['orbit_settings']` — **Acceptance:** Toggle Colorblind Mode → page immediately updates body rendering; refresh → setting persists

6. Create `vercel.json` with CSP headers; run `vercel --prod` — **Acceptance:** Production URL loads in <3 seconds; Lighthouse Performance ≥ 90; all 30 levels accessible; localStorage persists across sessions on production domain

7. Add `hintText` to all 30 level JSON configs; display after 3 consecutive failed attempts — **Acceptance:** Fail Level 09 (Hohmann) 3 times → hint appears: "Try burning perpendicular to your orbit at apoapsis and periapsis"; hint dismissible; does not affect star rating

**Verification Checklist:**
- [ ] Full 30-level playthrough on production Vercel URL
- [ ] Lighthouse audit: Performance ≥ 90, Accessibility ≥ 80
- [ ] Colorblind mode: all bodies distinguishable on Level 07 (2 satellites) with color turned off
- [ ] Settings persist correctly across page refresh
- [ ] `vercel --prod` deploys with zero errors; CSP header present in response

---

## Testing Reference

### Unit Test Suite (`npm test`)
| File | What It Tests | Key Assertions |
|------|--------------|----------------|
| `Vector2.test.ts` | All 8 vector operations | Known-value inputs → expected outputs |
| `VerletSimulation.test.ts` | Energy conservation | Earth orbit: < 0.01% energy drift over 365 days |
| `KeplerSolver.test.ts` | Orbital element computation | Earth at 1 AU: eccentricity < 0.001, period ±0.5% |
| `WinCondition.test.ts` | All 5 win condition types | Synthetic SimulationState → correct win/no-win |
| `LevelConfig.test.ts` | JSON schema validation | All 30 level files: no missing required fields, valid types |

### Manual Verification Per Phase
- **Phase 0:** Blank canvas + orbital simulation; 60fps confirmed in DevTools
- **Phase 1:** Full Act 1 playthrough; Level 07 (2-body + 2 satellites) steady 60fps
- **Phase 2:** Hohmann transfer (Level 09) discoverable blind in < 10 minutes; fuel gauge works
- **Phase 3:** 4-body sandbox spirograph after 60 sim-days; orbital data overlay matches KeplerSolver
- **Phase 4:** Lighthouse ≥ 90; production URL full playthrough
