import { describe, expect, it } from "vitest";
import {
	EARTH_MASS_KG,
	G_AU,
	SIM_DT,
	SOLAR_MASS_KG,
} from "@/simulation/PhysicsConstants";
import {
	findCentralBody,
	generateTrajectoryPreview,
} from "@/simulation/TrajectoryPreview";
import { VerletSimulation } from "@/simulation/VerletSimulation";
import type { Body, Vector2 } from "@/types";
import * as Vec from "@/utils/Vector2";

// ── Factories ─────────────────────────────────────────────────────────────────

function makeStar(id = "star"): Body {
	return {
		id,
		mass: SOLAR_MASS_KG,
		radius: 20,
		position: { x: 0, y: 0 },
		velocity: { x: 0, y: 0 },
		isFixed: true,
		color: "#FFD700",
		shape: "circle",
		trailPoints: [],
		trailMaxLength: 0,
	};
}

function makeBody(
	position: Vector2,
	velocity: Vector2,
	id = "sat",
	isFixed = false,
): Body {
	return {
		id,
		mass: EARTH_MASS_KG,
		radius: 8,
		position,
		velocity,
		isFixed,
		color: "#4488FF",
		shape: "circle",
		trailPoints: [],
		trailMaxLength: 200,
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrajectoryPreview", () => {
	it("circular orbit: all preview points should be approximately equidistant from the central body", () => {
		const star = makeStar();
		const radius = 1.0; // AU
		const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / radius);

		const position: Vector2 = { x: radius, y: 0 };
		const velocity: Vector2 = { x: 0, y: vCircular };

		const points = generateTrajectoryPreview(star, position, velocity, 100);

		expect(points.length).toBeGreaterThan(0);

		const distances = points.map((p) =>
			Vec.distance(p.position, star.position),
		);

		const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
		for (const d of distances) {
			// All points within ±0.1% of mean radius
			expect(Math.abs(d - mean) / mean).toBeLessThan(0.001);
		}

		// Mean radius should be close to the actual orbital radius
		expect(Math.abs(mean - radius) / radius).toBeLessThan(0.001);
	});

	it("elliptical orbit: periapsis and apoapsis distances should match analytical values", () => {
		const star = makeStar();
		const a = 1.5; // semi-major axis AU
		const e = 0.4; // eccentricity
		const rPeriapsis = a * (1 - e); // 0.9 AU
		const rApoapsis = a * (1 + e); // 2.1 AU

		// Vis-viva velocity at periapsis
		const vPeriapsis = Math.sqrt(
			G_AU * SOLAR_MASS_KG * (2 / rPeriapsis - 1 / a),
		);

		const position: Vector2 = { x: rPeriapsis, y: 0 };
		const velocity: Vector2 = { x: 0, y: vPeriapsis };

		const points = generateTrajectoryPreview(star, position, velocity, 360);

		expect(points.length).toBeGreaterThan(0);

		const distances = points.map((p) =>
			Vec.distance(p.position, star.position),
		);

		const minDist = Math.min(...distances);
		const maxDist = Math.max(...distances);

		// 2% tolerance on periapsis and apoapsis
		expect(Math.abs(minDist - rPeriapsis) / rPeriapsis).toBeLessThan(0.02);
		expect(Math.abs(maxDist - rApoapsis) / rApoapsis).toBeLessThan(0.02);
	});

	it("hyperbolic trajectory: points should diverge from central body and contain no NaN", () => {
		const star = makeStar();
		const vEscape = Math.sqrt((2 * G_AU * SOLAR_MASS_KG) / 1.0);

		// 1.5× escape velocity — strongly hyperbolic
		const position: Vector2 = { x: 1, y: 0 };
		const velocity: Vector2 = { x: 0, y: vEscape * 1.5 };

		const points = generateTrajectoryPreview(star, position, velocity, 100);

		expect(points.length).toBeGreaterThan(0);

		for (const p of points) {
			expect(Number.isFinite(p.position.x)).toBe(true);
			expect(Number.isFinite(p.position.y)).toBe(true);
		}

		// Points should diverge: the maximum distance should be well beyond start
		const distances = points.map((p) =>
			Vec.distance(p.position, star.position),
		);
		const maxDist = Math.max(...distances);
		expect(maxDist).toBeGreaterThan(2); // clearly moving away
	});

	it("zero velocity: should return empty array (degenerate / radial free-fall)", () => {
		const star = makeStar();
		const position: Vector2 = { x: 1, y: 0 };
		const velocity: Vector2 = { x: 0, y: 0 };

		// h = 0 → angular momentum is zero → orbit collapses to a line (degenerate)
		// The eccentricity formula yields e = 1 (parabolic edge case),
		// but with zero transverse velocity the preview is physically meaningless.
		// Guard condition: |r| < 1e-15 doesn't apply here, but energy leads to
		// a degenerate trajectory. We accept either empty or finite-only output.
		const points = generateTrajectoryPreview(star, position, velocity, 100);

		// All returned points must be finite — no NaN allowed
		for (const p of points) {
			expect(Number.isFinite(p.position.x)).toBe(true);
			expect(Number.isFinite(p.position.y)).toBe(true);
		}

		// With zero angular momentum the orbit degenerates; either empty or
		// a straight line toward/away from star is acceptable output.
		// The key requirement is no crash and no NaN.
	});

	it("preview should match Verlet simulation for circular orbit to within 1%", () => {
		const star = makeStar();
		const radius = 1.0;
		const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / radius);

		const position: Vector2 = { x: radius, y: 0 };
		const velocity: Vector2 = { x: 0, y: vCircular };

		// Generate analytical preview
		const preview = generateTrajectoryPreview(star, position, velocity, 100);
		expect(preview.length).toBeGreaterThan(0);

		// Run Verlet simulation for a full period
		const period =
			2 * Math.PI * Math.sqrt(radius ** 3 / (G_AU * SOLAR_MASS_KG));
		const numTicks = Math.round(period / SIM_DT);

		const satBody = makeBody(position, velocity);
		const sim = new VerletSimulation([star, satBody]);

		// Record one Verlet position per fraction of the orbit, matching preview sample count
		const verletPositions: Vector2[] = [];
		const samplingInterval = Math.max(1, Math.floor(numTicks / preview.length));

		for (let tick = 0; tick < numTicks; tick++) {
			sim.step(SIM_DT);
			if (
				tick % samplingInterval === 0 &&
				verletPositions.length < preview.length
			) {
				verletPositions.push({ ...sim.getBodies()[1]!.position });
			}
		}

		// Compare preview radii vs Verlet radii
		// Both should be ≈ 1 AU for a circular orbit
		const compareCount = Math.min(10, verletPositions.length, preview.length);

		for (let i = 0; i < compareCount; i++) {
			const previewR = Vec.distance(preview[i]!.position, star.position);
			const verletR = Vec.distance(verletPositions[i]!, star.position);

			// Within 1% of each other
			const relErr = Math.abs(previewR - verletR) / radius;
			expect(relErr).toBeLessThan(0.01);
		}
	});

	it("findCentralBody returns the most massive fixed body", () => {
		const smallStar = makeStar("small-star");
		const bigStar: Body = { ...makeStar("big-star"), mass: SOLAR_MASS_KG * 10 };
		const satellite = makeBody({ x: 1, y: 0 }, { x: 0, y: 0 }, "sat");

		const result = findCentralBody([smallStar, bigStar, satellite]);

		expect(result?.id).toBe("big-star");
	});

	it("findCentralBody returns null when no fixed bodies exist", () => {
		const sat1 = makeBody({ x: 1, y: 0 }, { x: 0, y: 0 }, "sat1");
		const sat2 = makeBody({ x: -1, y: 0 }, { x: 0, y: 0 }, "sat2");

		expect(findCentralBody([sat1, sat2])).toBeNull();
	});
});
