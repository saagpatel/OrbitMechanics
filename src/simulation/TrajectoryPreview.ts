import { G_AU } from "@/simulation/PhysicsConstants";
import type { Body, TrajectoryPoint, Vector2 } from "@/types";
import * as Vec from "@/utils/Vector2";

/**
 * Generate analytical Kepler orbit preview points for the 2-body case.
 *
 * Uses the conic section equation r = p / (1 + e·cos(ν)) to produce points
 * directly from orbital elements — no numerical integration required.
 */
export function generateTrajectoryPreview(
	centralBody: Readonly<Body>,
	orbitingPosition: Readonly<Vector2>,
	proposedVelocity: Readonly<Vector2>,
	numPoints: number,
): TrajectoryPoint[] {
	const mu = G_AU * centralBody.mass;

	// Guard: degenerate central body
	if (mu < 1e-60) return [];

	// Relative position and velocity with respect to the central body
	const r = Vec.sub(orbitingPosition, centralBody.position);
	const v = Vec.sub(proposedVelocity, centralBody.velocity);

	const rMag = Vec.magnitude(r);

	// Guard: degenerate position (body at the center)
	if (rMag < 1e-15) return [];

	const vMag = Vec.magnitude(v);

	// Specific orbital energy: ε = v²/2 - μ/r
	const energy = 0.5 * vMag * vMag - mu / rMag;

	// Angular momentum (2D scalar): h = r × v
	const h = Vec.cross(r, v);

	// Semi-major axis: a = -μ / (2ε)
	// Parabolic: ε ≈ 0 → a → ∞
	// Hyperbolic: ε > 0 → a < 0 (by convention)
	let a: number;
	if (Math.abs(energy) < 1e-30) {
		a = Infinity;
	} else {
		a = -mu / (2 * energy);
	}

	// Eccentricity: e = sqrt(1 + 2εh²/μ²)
	const eSq = 1 + (2 * energy * h * h) / (mu * mu);
	const e = Math.sqrt(Math.max(0, eSq));

	// ── Eccentricity vector ────────────────────────────────────────────────
	// e_vec = (v × h) / μ - r_hat
	// In 2D, v × h = (vx, vy, 0) × (0, 0, h) = (vy*h, -vx*h, 0)
	// So e_vec = { x: vy*h/μ - rx/r, y: -vx*h/μ - ry/r }
	const eMagUsed = e;
	let omega: number; // argument of periapsis
	if (eMagUsed < 1e-6) {
		// Nearly circular — periapsis direction undefined; reference from +X
		omega = 0;
	} else {
		const eVecX = (v.y * h) / mu - r.x / rMag;
		const eVecY = (-v.x * h) / mu - r.y / rMag;
		omega = Math.atan2(eVecY, eVecX);
	}

	// ── True anomaly at current position ─────────────────────────────────
	// ν = angle between eccentricity vector and r
	// We derive it from the orbit equation: cos(ν) = (p/r - 1) / e
	// But we need the sign from the radial velocity component.
	// Radial velocity: v_r = dr/dt = (r · v) / |r|
	// If v_r > 0, body is moving away from periapsis → ν ∈ (0, π)
	// If v_r < 0, body is approaching periapsis → ν ∈ (π, 2π)
	const radialVelocity = Vec.dot(r, v) / rMag;

	let nu0: number; // current true anomaly
	if (e < 1e-6) {
		// Circular: derive angle from position directly
		nu0 = Math.atan2(r.y, r.x) - omega;
	} else {
		// Semi-latus rectum: p = h²/μ for all conic types
		const p = (h * h) / mu;
		const cosNu = Math.min(1, Math.max(-1, (p / rMag - 1) / e));
		nu0 = Math.acos(cosNu);
		if (radialVelocity < 0) {
			nu0 = -nu0; // wrap to negative (approaching periapsis)
		}
	}

	// ── Generate orbit points ─────────────────────────────────────────────
	const points: TrajectoryPoint[] = [];

	if (e > 1 + 1e-6) {
		// Hyperbolic trajectory
		// Asymptote angle: ν_∞ = acos(-1/e)
		const nuAsymptote = Math.acos(-1 / e) - 0.01;

		// Sweep from current ν₀ toward positive asymptote
		// and from current ν₀ toward negative asymptote
		const pHyp = Math.abs(a) * (e * e - 1);

		// Determine sweep range: from -nuAsymptote to +nuAsymptote
		const nuMin = -nuAsymptote;
		const nuMax = nuAsymptote;
		const step = (nuMax - nuMin) / (numPoints - 1);

		for (let i = 0; i < numPoints; i++) {
			const nu = nuMin + i * step;
			const denom = 1 + e * Math.cos(nu);
			if (denom <= 0) continue; // beyond asymptote, skip

			const rDist = pHyp / denom;
			if (!Number.isFinite(rDist) || rDist < 0) continue;

			const angle = nu + omega;
			const x = centralBody.position.x + rDist * Math.cos(angle);
			const y = centralBody.position.y + rDist * Math.sin(angle);

			if (Number.isFinite(x) && Number.isFinite(y)) {
				points.push({ position: { x, y }, time: 0 });
			}
		}
	} else if (Math.abs(e - 1) < 0.001 || !Number.isFinite(a)) {
		// Parabolic trajectory
		const pPar = (h * h) / mu;
		// Sweep from current ν₀ to near π (asymptote)
		const nuMax = Math.PI - 0.05;
		const nuMin = -nuMax;
		const step = (nuMax - nuMin) / (numPoints - 1);

		for (let i = 0; i < numPoints; i++) {
			const nu = nuMin + i * step;
			const denom = 1 + Math.cos(nu);
			if (denom <= 0) continue;

			const rDist = pPar / denom;
			if (!Number.isFinite(rDist) || rDist < 0) continue;

			const angle = nu + omega;
			const x = centralBody.position.x + rDist * Math.cos(angle);
			const y = centralBody.position.y + rDist * Math.sin(angle);

			if (Number.isFinite(x) && Number.isFinite(y)) {
				points.push({ position: { x, y }, time: 0 });
			}
		}
	} else {
		// Elliptical trajectory (e < 1)
		const p = a * (1 - e * e);
		const step = (2 * Math.PI) / numPoints;

		for (let i = 0; i < numPoints; i++) {
			const nu = nu0 + i * step;
			const denom = 1 + e * Math.cos(nu);
			if (denom <= 0) continue;

			const rDist = p / denom;
			if (!Number.isFinite(rDist) || rDist < 0) continue;

			const angle = nu + omega;
			const x = centralBody.position.x + rDist * Math.cos(angle);
			const y = centralBody.position.y + rDist * Math.sin(angle);

			if (Number.isFinite(x) && Number.isFinite(y)) {
				points.push({ position: { x, y }, time: 0 });
			}
		}
	}

	return points;
}

/**
 * Find the most massive fixed body — used as the 2-body central mass
 * for trajectory preview. Returns null if no fixed bodies exist.
 *
 * Phase 2 will replace this with SOI-based lookup.
 */
export function findCentralBody(
	bodies: ReadonlyArray<Readonly<Body>>,
): Readonly<Body> | null {
	let best: Readonly<Body> | null = null;

	for (const body of bodies) {
		if (!body.isFixed) continue;
		if (best === null || body.mass > best.mass) {
			best = body;
		}
	}

	return best;
}
