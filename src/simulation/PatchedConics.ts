import { G_AU, SIM_DT, SOFTENING } from "@/simulation/PhysicsConstants";
import type { Body, TrajectoryPoint, Vector2 } from "@/types";
import * as Vec from "@/utils/Vector2";

/**
 * Compute the radius of the sphere of influence (SOI) for a body orbiting
 * a parent body.
 *
 * r_SOI = a * (m / M)^(2/5)
 *
 * where a = orbital radius, m = body mass, M = parent mass.
 */
export function computeSOI(
	orbitalRadius: number,
	bodyMass: number,
	parentMass: number,
): number {
	if (bodyMass <= 0 || parentMass <= 0) return 0;
	return orbitalRadius * (bodyMass / parentMass) ** (2 / 5);
}

export interface SOIBody {
	body: Readonly<Body>;
	soiRadius: number;
	parentBody: Readonly<Body>;
}

/**
 * Build an SOI hierarchy from the body list.
 *
 * The primary is the most massive body. Every other body with mass > 1e20 kg
 * gets an SOI entry relative to the primary.
 */
export function buildSOIHierarchy(
	bodies: ReadonlyArray<Readonly<Body>>,
): SOIBody[] {
	// Find most massive body as primary (typically the star)
	let primary: Readonly<Body> | null = null;
	for (const b of bodies) {
		if (!primary || b.mass > primary.mass) primary = b;
	}
	if (!primary) return [];

	const result: SOIBody[] = [];
	for (const b of bodies) {
		if (b === primary) continue;
		if (b.mass < 1e20) continue; // filter out probes / satellites
		const orbitalRadius = Vec.distance(b.position, primary.position);
		if (orbitalRadius < 1e-10) continue;
		const soi = computeSOI(orbitalRadius, b.mass, primary.mass);
		result.push({ body: b, soiRadius: soi, parentBody: primary });
	}
	return result;
}

/**
 * Return the SOI body whose sphere contains `position` with the smallest
 * centre-to-position distance, or null when outside all spheres.
 */
export function findSOIBody(
	position: Readonly<Vector2>,
	soiBodies: ReadonlyArray<SOIBody>,
): SOIBody | null {
	let best: SOIBody | null = null;
	let bestDist = Infinity;
	for (const soi of soiBodies) {
		const dist = Vec.distance(position, soi.body.position);
		if (dist <= soi.soiRadius && dist < bestDist) {
			best = soi;
			bestDist = dist;
		}
	}
	return best;
}

/**
 * Generate a trajectory preview using numerical Velocity Verlet integration
 * with SOI switching — the "patched conics" approximation.
 *
 * All coordinates are in absolute simulation space (AU).
 * The dominant attractor at each step is either the primary body or whichever
 * SOI body contains the current probe position.
 *
 * Integration cap: 4000 steps at SIM_DT to prevent runaway.
 * Returns up to `numPoints` trajectory points sampled at regular intervals.
 */
export function generatePatchedConicsPreview(
	primaryBody: Readonly<Body>,
	soiBodies: ReadonlyArray<SOIBody>,
	startPosition: Readonly<Vector2>,
	startVelocity: Readonly<Vector2>,
	numPoints: number,
): TrajectoryPoint[] {
	const maxSteps = 4000;
	const dt = SIM_DT;
	const recordInterval = Math.max(1, Math.floor(maxSteps / numPoints));

	let pos: Vector2 = { ...startPosition };
	let vel: Vector2 = { ...startVelocity };

	// Determine initial attractor
	const initialSOI = findSOIBody(pos, soiBodies);
	let attractor: Readonly<Body> = initialSOI ? initialSOI.body : primaryBody;

	// Compute initial acceleration
	let acc = computeAccel(pos, attractor);

	const points: TrajectoryPoint[] = [];

	for (let step = 0; step < maxSteps; step++) {
		// Velocity Verlet: half-kick
		vel = { x: vel.x + 0.5 * acc.x * dt, y: vel.y + 0.5 * acc.y * dt };
		// Drift
		pos = { x: pos.x + vel.x * dt, y: pos.y + vel.y * dt };
		// New acceleration
		const newAcc = computeAccel(pos, attractor);
		// Half-kick
		vel = { x: vel.x + 0.5 * newAcc.x * dt, y: vel.y + 0.5 * newAcc.y * dt };
		acc = newAcc;

		// Check SOI transition
		const currentSOI = findSOIBody(pos, soiBodies);
		const newAttractor: Readonly<Body> = currentSOI
			? currentSOI.body
			: primaryBody;
		if (newAttractor.id !== attractor.id) {
			attractor = newAttractor;
			acc = computeAccel(pos, attractor); // recompute for new attractor
		}

		// Record point at regular intervals
		if (step % recordInterval === 0) {
			if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
				points.push({ position: { ...pos }, time: step * dt });
			}
		}

		if (points.length >= numPoints) break;
	}

	return points;
}

function computeAccel(
	pos: Readonly<Vector2>,
	attractor: Readonly<Body>,
): Vector2 {
	const mu = G_AU * attractor.mass;
	const dx = attractor.position.x - pos.x;
	const dy = attractor.position.y - pos.y;
	const distSq = dx * dx + dy * dy;
	const softenedDistSq = distSq + SOFTENING * SOFTENING;
	const dist = Math.sqrt(softenedDistSq);
	const forceMag = mu / softenedDistSq;
	return { x: (forceMag * dx) / dist, y: (forceMag * dy) / dist };
}
