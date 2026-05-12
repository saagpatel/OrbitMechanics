# OrbitMechanic — Portfolio Disposition

**Status:** Release Frozen (static-host, pure static SPA) —
TypeScript + Canvas 2D browser-based orbital mechanics puzzle game
with **real Newtonian physics** (Verlet integrator + Kepler solver +
patched conics) on `origin/main`. 30 handcrafted levels across
4 acts + Sandbox mode. Vercel deploy config + security headers +
CVE fixes. **Sixth static-host cluster member.** Joins static SPA
sub-shape (alongside HowMoneyMoves + Neural Network Playground) —
**third static-SPA sub-shape member**. Zero runtime dependencies
beyond Canvas 2D — pure browser game with no backend, no
analytics, no auth.

> Disposition uses strict `origin/main` verification.

---

## Verification posture

Only `origin` (`saagpatel/OrbitMechanic`). Clean migration state.

`origin/main`:

- Tip: `07e4d12` chore: add .vercel to gitignore
- Production-hardening cadence:
  - `07e4d12` chore: add .vercel to gitignore
  - `2c47f62` chore: add security headers and vercel deploy config
  - `a4b0600` chore: add buildCommand and outputDirectory to
    vercel.json
  - `0492f5f` chore(deps): fix HIGH CVEs via npm audit fix
- Full OSS scaffolding wave
- Default branch: `main`

---

## Current state in one paragraph

OrbitMechanic is a browser-based puzzle game built on **real
Newtonian physics**: distances in AU, masses in kg, velocities in
AU/s. A **Verlet integrator** advances the simulation per-tick; a
**Kepler solver** renders trajectory previews so the player sees
the projected orbit before committing a delta-v burn; **patched
conics** handle sphere-of-influence handoff between bodies. 30
handcrafted levels across four acts (circular orbits → multi-body
gravity assists) plus a Sandbox mode unlocked after Act 1. **Zero
dependencies beyond Canvas 2D** — no game engine, no WebGL, no
framework. Per memory: v1.0 done. Vercel deploy config + security
headers + HIGH-severity CVE fixes confirm production-hardening.

---

## Why "Release Frozen (static-host, static SPA)" — sixth cluster member

Static SPA sub-shape with **physics-engine compute**:

| Member | Sub-shape | Compute |
|---|---|---|
| HowMoneyMoves | Static SPA | Pure presentation |
| Neural Network Playground | Static SPA + client ML | TF.js training |
| **OrbitMechanic** | **Static SPA + physics simulation** | **Verlet + Kepler in Canvas 2D** |

Static SPA sub-shape now has **3 members with three distinct
compute models**: pure presentation, ML training, physics
simulation. The sub-shape is well-occupied. Future static-SPA
games / simulations / visualizations batch here.

---

## Cluster taxonomy update

| Cluster | Count | Sub-shapes |
|---|---|---|
| **Static-host (web)** | **6** | PWA / static SPA (3) / SSR+Supabase / Next.js+SQLite |
| (others unchanged) | | |

Static SPA sub-shape: 3 members. Cluster pattern is now stable.

---

## Unblock trigger (operator)

Production-deployable to Vercel (config in place). Operational
concerns:

1. **Vercel deploy URL** — verify the deployed instance is live
   and reachable; README didn't include a live URL on triage.
2. **Mobile UX** — orbital mechanics games on phones with
   touch-only burns are a different interaction model than
   keyboard/mouse. Verify graceful degradation or warning.
3. **Performance budget** — N-body physics with patched conics
   scales poorly with body count; verify Sandbox mode caps body
   count or warns at high N.
4. **No CVEs in the dep tree** — `0492f5f` did one HIGH CVE pass;
   periodic `npm audit` worth scheduling.
5. **Continued accessibility** — physics game UI typically has
   tight contrast / small-element challenges; if not yet audited,
   worth a pass.

Estimated operator time to deploy: ~30 min once Vercel project
linked.

---

## Portfolio operating system instructions

| Aspect | Posture |
|---|---|
| Portfolio status | `Release Frozen (static-host, pure static SPA)` |
| Distribution channel | **Vercel** (config in place) |
| Review cadence | Suspend overdue counting |
| Resurface conditions | (a) Vercel deploy verification, (b) HIGH CVE in deps, (c) accessibility audit, (d) v1.1 (more levels, multiplayer?) |
| Co-batch with | Static-host cluster — **now 6 repos** |
| Sub-shape | **Static SPA + physics simulation** |
| Special concern | **N-body performance budget.** Sandbox mode can grow body count; cap or warn. |
| Special concern | **Mobile touch UX** for orbital burns is non-trivial. |
| Special concern | **Real Newtonian physics positioning is a strong marketing hook** for educational / hobbyist audiences. |

---

## Reactivation procedure

1. Verify branch tracking.
2. No stash needed (working tree was clean).
3. Run `npm test` (if test suite exists) + `npm run build`.
4. Verify Vercel deployment.
5. Spot-check 1-2 levels for regressions after recent dep updates.

---

## Last known reference

| Field | Value |
|---|---|
| `origin/main` tip | `07e4d12` chore: add .vercel to gitignore |
| Default branch | `main` |
| Build system | TypeScript + Canvas 2D + Vercel static deploy |
| Phases shipped | v1.0 per memory; 30 levels + Sandbox + production-hardening |
| Compute model | **Pure client-side physics** (Verlet + Kepler + patched conics in Canvas 2D) |
| Distinguishing tech | **Real Newtonian physics** (no fake orbital shortcuts) + **zero dependencies** (no framework, no engine) |
| Migration state | No `legacy-origin` remote |
| Distinguishing feature | **Sixth static-host cluster member; third static-SPA sub-shape member.** First with physics-simulation compute model. Real Newtonian physics positioning. |
