// Simulation unit system:
//   Distance: AU (astronomical units) — 1 AU = 1.496e11 m
//   Mass:     kg
//   Time:     seconds
//   Velocity: AU/s
//
// G in SI:           6.674e-11 m³/(kg·s²)
// G in AU³/(kg·s²):  6.674e-11 / (1.496e11)³ = 1.993e-44
//
// Verification — circular orbit velocity at r AU around M kg:
//   v = sqrt(G_AU * M / r)
//   Earth at 1 AU: sqrt(1.993e-44 * 1.989e30 / 1.0) ≈ 1.991e-7 AU/s (29.78 km/s)

/** Gravitational constant in AU³/(kg·s²) */
export const G_AU = 1.993e-44;

/** Meters per astronomical unit */
export const AU_METERS = 1.496e11;

/** Solar mass in kg */
export const SOLAR_MASS_KG = 1.989e30;

/** Earth mass in kg */
export const EARTH_MASS_KG = 5.972e24;

/** Integration timestep in simulation seconds (≈3.3 minutes) */
export const SIM_DT = 200;

/** Simulation ticks per rendered frame at timeScale=1 */
export const BASE_TICKS_PER_FRAME = 50;

/** Hard cap on ticks per frame (safety valve) */
export const MAX_TICKS_PER_FRAME = 1200;

/** Softening parameter in AU — prevents NaN on body overlap (~15 meters) */
export const SOFTENING = 1e-10;

/** Seconds per day */
export const SECONDS_PER_DAY = 86400;

/**
 * Earth's circular orbital velocity at 1 AU in AU/s.
 * Derived: sqrt(G_AU * SOLAR_MASS_KG / 1.0)
 * Used in tests for validation — not authoritative.
 */
export const EARTH_ORBITAL_VELOCITY = Math.sqrt((G_AU * SOLAR_MASS_KG) / 1.0);

/**
 * Velocity scaling: AU/s of delta-v per AU of screen-space drag.
 * Calibrated so a 200px drag at zoom=1 on 1080p ≈ Earth circular velocity (~1.99e-7 AU/s).
 * At zoom=1, baseScale ≈ 270 px/AU → 200px = 0.741 AU → 0.741 * 2.69e-7 ≈ 1.99e-7 AU/s.
 */
export const VELOCITY_MULTIPLIER = 2.69e-7;

/** Minimum delta-v magnitude to register as a burn (below this, treat as cancel) */
export const MIN_BURN_DV = 1e-10;

/** Simulation ticks between win condition checks */
export const WIN_CHECK_INTERVAL = 10;
