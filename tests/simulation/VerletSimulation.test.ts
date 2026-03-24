import { describe, expect, it } from "vitest";
import {
	EARTH_MASS_KG,
	G_AU,
	SECONDS_PER_DAY,
	SIM_DT,
	SOLAR_MASS_KG,
} from "@/simulation/PhysicsConstants";
import { VerletSimulation } from "@/simulation/VerletSimulation";
import type { Body } from "@/types";
import * as Vec from "@/utils/Vector2";

function makeStar(overrides?: Partial<Body>): Body {
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
		...overrides,
	};
}

function makePlanet(overrides?: Partial<Body>): Body {
	const r = 1.0; // AU
	const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / r);

	return {
		id: "planet",
		mass: EARTH_MASS_KG,
		radius: 8,
		position: { x: r, y: 0 },
		velocity: { x: 0, y: vCircular },
		isFixed: false,
		color: "#4488FF",
		shape: "circle",
		trailPoints: [],
		trailMaxLength: 200,
		...overrides,
	};
}

function computeSpecificOrbitalEnergy(
	body: Readonly<Body>,
	centralMass: number,
): number {
	const r = Vec.magnitude(body.position);
	const v = Vec.magnitude(body.velocity);
	return 0.5 * v * v - (G_AU * centralMass) / r;
}

describe("VerletSimulation", () => {
	describe("circular orbit at 1 AU", () => {
		it("should return within 0.001 AU of start after one orbital period", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			const startPos = { ...sim.getBodies()[1]!.position };

			// Compute exact orbital period: T = 2π * sqrt(a³ / (G*M))
			const period = 2 * Math.PI * Math.sqrt(1.0 ** 3 / (G_AU * SOLAR_MASS_KG));
			const ticks = Math.round(period / SIM_DT);

			for (let i = 0; i < ticks; i++) {
				sim.step(SIM_DT);
			}

			const endPos = sim.getBodies()[1]!.position;
			const drift = Vec.distance(startPos, endPos);

			expect(drift).toBeLessThan(0.001); // < 0.001 AU
		});

		it("should conserve energy to within 0.01% over 365 days", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			const initialEnergy = computeSpecificOrbitalEnergy(
				sim.getBodies()[1]!,
				SOLAR_MASS_KG,
			);

			const totalSeconds = 365 * SECONDS_PER_DAY;
			const ticks = Math.round(totalSeconds / SIM_DT);
			let maxDrift = 0;

			for (let i = 0; i < ticks; i++) {
				sim.step(SIM_DT);

				// Sample every 1000 ticks to keep test fast
				if (i % 1000 === 0) {
					const currentEnergy = computeSpecificOrbitalEnergy(
						sim.getBodies()[1]!,
						SOLAR_MASS_KG,
					);
					const drift = Math.abs(
						(currentEnergy - initialEnergy) / initialEnergy,
					);
					maxDrift = Math.max(maxDrift, drift);
				}
			}

			expect(maxDrift).toBeLessThan(0.0001); // < 0.01%
		});
	});

	describe("elliptical orbit (e=0.5)", () => {
		it("should conserve energy to within 0.01% over 10 orbits", () => {
			const a = 1.0; // semi-major axis AU
			const e = 0.5;
			const rPeriapsis = a * (1 - e); // 0.5 AU

			// Vis-viva at periapsis: v² = G*M*(2/r - 1/a)
			const vPeriapsis = Math.sqrt(
				G_AU * SOLAR_MASS_KG * (2 / rPeriapsis - 1 / a),
			);

			const planet = makePlanet({
				position: { x: rPeriapsis, y: 0 },
				velocity: { x: 0, y: vPeriapsis },
			});

			const sim = new VerletSimulation([makeStar(), planet]);
			const initialEnergy = computeSpecificOrbitalEnergy(
				sim.getBodies()[1]!,
				SOLAR_MASS_KG,
			);

			// Period = 2π * sqrt(a³ / (G*M))
			const period = 2 * Math.PI * Math.sqrt(a ** 3 / (G_AU * SOLAR_MASS_KG));
			const totalSeconds = period * 10;
			const ticks = Math.round(totalSeconds / SIM_DT);
			let maxDrift = 0;

			for (let i = 0; i < ticks; i++) {
				sim.step(SIM_DT);

				if (i % 1000 === 0) {
					const currentEnergy = computeSpecificOrbitalEnergy(
						sim.getBodies()[1]!,
						SOLAR_MASS_KG,
					);
					const drift = Math.abs(
						(currentEnergy - initialEnergy) / initialEnergy,
					);
					maxDrift = Math.max(maxDrift, drift);
				}
			}

			expect(maxDrift).toBeLessThan(0.0001); // < 0.01%
		});
	});

	describe("fixed body immobility", () => {
		it("should never move a fixed body", () => {
			const star = makeStar();
			const sim = new VerletSimulation([star, makePlanet()]);
			const startPos = { ...sim.getBodies()[0]!.position };

			for (let i = 0; i < 1000; i++) {
				sim.step(SIM_DT);
			}

			const endPos = sim.getBodies()[0]!.position;
			expect(endPos.x).toBe(startPos.x);
			expect(endPos.y).toBe(startPos.y);
		});
	});

	describe("momentum conservation", () => {
		it("should conserve total momentum for two non-fixed bodies", () => {
			const body1: Body = {
				id: "a",
				mass: 1e26,
				radius: 10,
				position: { x: 0, y: 0 },
				velocity: { x: 1e-8, y: 0 },
				isFixed: false,
				color: "#FF0000",
				shape: "circle",
				trailPoints: [],
				trailMaxLength: 0,
			};

			const body2: Body = {
				id: "b",
				mass: 1e26,
				radius: 10,
				position: { x: 0.1, y: 0 },
				velocity: { x: -1e-8, y: 0 },
				isFixed: false,
				color: "#0000FF",
				shape: "circle",
				trailPoints: [],
				trailMaxLength: 0,
			};

			const sim = new VerletSimulation([body1, body2]);

			const initialMomentum = Vec.add(
				Vec.scale(sim.getBodies()[0]!.velocity, body1.mass),
				Vec.scale(sim.getBodies()[1]!.velocity, body2.mass),
			);

			for (let i = 0; i < 1000; i++) {
				sim.step(SIM_DT);
			}

			const finalMomentum = Vec.add(
				Vec.scale(sim.getBodies()[0]!.velocity, body1.mass),
				Vec.scale(sim.getBodies()[1]!.velocity, body2.mass),
			);

			// Momentum should be conserved to high precision
			expect(finalMomentum.x).toBeCloseTo(initialMomentum.x, 15);
			expect(finalMomentum.y).toBeCloseTo(initialMomentum.y, 15);
		});
	});

	describe("applyDeltaV", () => {
		it("should change velocity by exact delta-v amount", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			const before = { ...sim.getBodies()[1]!.velocity };
			const dv = { x: 1e-8, y: -5e-9 };

			sim.applyDeltaV("planet", dv);

			const after = sim.getBodies()[1]!.velocity;
			expect(after.x).toBeCloseTo(before.x + dv.x, 20);
			expect(after.y).toBeCloseTo(before.y + dv.y, 20);
		});

		it("should increment burn count and fuel used", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			const dv = { x: 1e-8, y: 0 };

			sim.applyDeltaV("planet", dv);
			const state = sim.getState();

			expect(state.burnCount).toBe(1);
			expect(state.fuelUsed).toBeCloseTo(1e-8);
		});

		it("should not modify a fixed body", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			const before = { ...sim.getBodies()[0]!.velocity };

			sim.applyDeltaV("star", { x: 1, y: 1 });

			const after = sim.getBodies()[0]!.velocity;
			expect(after.x).toBe(before.x);
			expect(after.y).toBe(before.y);
		});
	});

	describe("time tracking", () => {
		it("should accumulate time correctly", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);

			sim.step(SIM_DT);
			sim.step(SIM_DT);
			sim.step(SIM_DT);

			expect(sim.getTime()).toBeCloseTo(3 * SIM_DT);
		});
	});

	describe("fuel budget enforcement", () => {
		it("should reject burn when budget would be exceeded", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			sim.setFuelBudget(1e-9);
			const before = { ...sim.getBodies()[1]!.velocity };

			const result = sim.applyDeltaV("planet", { x: 1e-8, y: 0 });

			expect(result).toBe("rejected_no_fuel");
			expect(sim.getBodies()[1]!.velocity.x).toBe(before.x);
		});

		it("should accept burn within budget", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			sim.setFuelBudget(1e-7);

			const result = sim.applyDeltaV("planet", { x: 1e-8, y: 0 });

			expect(result).toBe("applied");
			expect(sim.getState().fuelUsed).toBeCloseTo(1e-8);
		});

		it("should allow unlimited burns when fuelBudget is null", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			// fuelBudget defaults to null

			const r1 = sim.applyDeltaV("planet", { x: 1e-5, y: 0 });
			const r2 = sim.applyDeltaV("planet", { x: 1e-5, y: 0 });

			expect(r1).toBe("applied");
			expect(r2).toBe("applied");
		});

		it("should reject third burn after two consume the budget", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			sim.setFuelBudget(2.5e-8);

			expect(sim.applyDeltaV("planet", { x: 1e-8, y: 0 })).toBe("applied");
			expect(sim.applyDeltaV("planet", { x: 1e-8, y: 0 })).toBe("applied");
			expect(sim.applyDeltaV("planet", { x: 1e-8, y: 0 })).toBe(
				"rejected_no_fuel",
			);
		});

		it("should return fuelBudget in getState", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			sim.setFuelBudget(5e-7);

			expect(sim.getState().fuelBudget).toBe(5e-7);
		});

		it("should accept burn that exactly exhausts remaining fuel", () => {
			const sim = new VerletSimulation([makeStar(), makePlanet()]);
			sim.setFuelBudget(1e-8);

			const result = sim.applyDeltaV("planet", { x: 1e-8, y: 0 });

			expect(result).toBe("applied");
			expect(sim.getState().fuelUsed).toBeCloseTo(1e-8);
		});
	});
});
