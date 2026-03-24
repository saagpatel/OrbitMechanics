import { describe, expect, it } from "vitest";
import { computeOrbitalElements } from "@/simulation/KeplerSolver";
import {
	EARTH_MASS_KG,
	G_AU,
	SOLAR_MASS_KG,
} from "@/simulation/PhysicsConstants";
import type { Body } from "@/types";

function makeStar(): Body {
	return {
		id: "star",
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

function makeBody(overrides: Partial<Body>): Body {
	return {
		id: "body",
		mass: EARTH_MASS_KG,
		radius: 8,
		position: { x: 1, y: 0 },
		velocity: { x: 0, y: 0 },
		isFixed: false,
		color: "#4488FF",
		shape: "circle",
		trailPoints: [],
		trailMaxLength: 200,
		...overrides,
	};
}

describe("KeplerSolver", () => {
	describe("circular orbit at 1 AU", () => {
		it("should have eccentricity near zero", () => {
			const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / 1.0);
			const body = makeBody({ velocity: { x: 0, y: vCircular } });

			const elements = computeOrbitalElements(makeStar(), body);

			expect(elements.eccentricity).toBeLessThan(0.001);
		});

		it("should have semi-major axis of 1 AU", () => {
			const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / 1.0);
			const body = makeBody({ velocity: { x: 0, y: vCircular } });

			const elements = computeOrbitalElements(makeStar(), body);

			expect(elements.semiMajorAxis).toBeCloseTo(1.0, 3);
		});

		it("should have period within 0.5% of 31,557,600 seconds", () => {
			const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / 1.0);
			const body = makeBody({ velocity: { x: 0, y: vCircular } });

			const elements = computeOrbitalElements(makeStar(), body);
			const expectedPeriod =
				2 * Math.PI * Math.sqrt(1.0 / (G_AU * SOLAR_MASS_KG));
			const drift = Math.abs(elements.period - expectedPeriod) / expectedPeriod;

			expect(drift).toBeLessThan(0.005); // < 0.5%
			expect(elements.isEscaping).toBe(false);
		});
	});

	describe("elliptical orbit (e=0.5)", () => {
		it("should compute correct eccentricity and semi-major axis", () => {
			const a = 1.0;
			const e = 0.5;
			const rPeriapsis = a * (1 - e); // 0.5 AU

			// Vis-viva at periapsis
			const vPeriapsis = Math.sqrt(
				G_AU * SOLAR_MASS_KG * (2 / rPeriapsis - 1 / a),
			);

			const body = makeBody({
				position: { x: rPeriapsis, y: 0 },
				velocity: { x: 0, y: vPeriapsis },
			});

			const elements = computeOrbitalElements(makeStar(), body);

			expect(elements.eccentricity).toBeCloseTo(0.5, 3);
			expect(elements.semiMajorAxis).toBeCloseTo(1.0, 3);
			expect(elements.isEscaping).toBe(false);
			expect(Number.isFinite(elements.period)).toBe(true);
		});
	});

	describe("escape velocity", () => {
		it("should detect escaping body with positive energy", () => {
			const vEscape = Math.sqrt((2 * G_AU * SOLAR_MASS_KG) / 1.0);
			// Give 10% more than escape velocity
			const body = makeBody({ velocity: { x: 0, y: vEscape * 1.1 } });

			const elements = computeOrbitalElements(makeStar(), body);

			expect(elements.isEscaping).toBe(true);
			expect(elements.specificOrbitalEnergy).toBeGreaterThan(0);
			expect(elements.eccentricity).toBeGreaterThan(1);
			expect(elements.period).toBe(Infinity);
		});

		it("should detect bound orbit with negative energy", () => {
			const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / 1.0);
			const body = makeBody({ velocity: { x: 0, y: vCircular } });

			const elements = computeOrbitalElements(makeStar(), body);

			expect(elements.isEscaping).toBe(false);
			expect(elements.specificOrbitalEnergy).toBeLessThan(0);
		});
	});

	describe("orbit direction", () => {
		it("should detect prograde orbit (positive angular momentum)", () => {
			const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / 1.0);
			const body = makeBody({ velocity: { x: 0, y: vCircular } }); // +Y = prograde

			const elements = computeOrbitalElements(makeStar(), body);

			expect(elements.isRetrograde).toBe(false);
		});

		it("should detect retrograde orbit (negative angular momentum)", () => {
			const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / 1.0);
			const body = makeBody({ velocity: { x: 0, y: -vCircular } }); // -Y = retrograde

			const elements = computeOrbitalElements(makeStar(), body);

			expect(elements.isRetrograde).toBe(true);
		});
	});
});
