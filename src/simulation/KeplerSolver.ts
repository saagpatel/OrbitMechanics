import { G_AU } from "@/simulation/PhysicsConstants";
import type { Body, OrbitalElements } from "@/types";
import * as Vec from "@/utils/Vector2";

/**
 * Compute orbital elements for a body orbiting a central mass.
 * Uses vis-viva equation and angular momentum.
 *
 * Assumes 2-body problem (orbiting body mass << central body mass).
 */
export function computeOrbitalElements(
	central: Readonly<Body>,
	orbiting: Readonly<Body>,
): OrbitalElements {
	const mu = G_AU * central.mass; // standard gravitational parameter

	// Position and velocity relative to central body
	const r = Vec.sub(orbiting.position, central.position);
	const v = Vec.sub(orbiting.velocity, central.velocity);

	const rMag = Vec.magnitude(r);
	const vMag = Vec.magnitude(v);

	// Specific orbital energy: ε = v²/2 - μ/r
	const specificOrbitalEnergy = 0.5 * vMag * vMag - mu / rMag;
	const isEscaping = specificOrbitalEnergy >= 0;

	// Semi-major axis from vis-viva: a = -μ / (2ε)
	// For parabolic (ε ≈ 0): a → ∞
	// For hyperbolic (ε > 0): a is negative by convention
	let semiMajorAxis: number;
	if (Math.abs(specificOrbitalEnergy) < 1e-30) {
		// Effectively parabolic
		semiMajorAxis = Infinity;
	} else {
		semiMajorAxis = -mu / (2 * specificOrbitalEnergy);
	}

	// Angular momentum (2D cross product: h = r × v = rx*vy - ry*vx)
	const h = r.x * v.y - r.y * v.x;

	// Eccentricity from: e = sqrt(1 + 2εh²/μ²)
	const eSq = 1 + (2 * specificOrbitalEnergy * h * h) / (mu * mu);
	const eccentricity = Math.sqrt(Math.max(0, eSq)); // clamp to avoid sqrt of tiny negative

	// Period: T = 2π * sqrt(a³/μ)
	// Only meaningful for bound orbits (a > 0)
	let period: number;
	if (semiMajorAxis > 0 && !isEscaping) {
		period =
			2 *
			Math.PI *
			Math.sqrt((semiMajorAxis * semiMajorAxis * semiMajorAxis) / mu);
	} else {
		period = Infinity;
	}

	return {
		semiMajorAxis,
		eccentricity,
		period,
		specificOrbitalEnergy,
		isEscaping,
		isRetrograde: h < 0,
	};
}
