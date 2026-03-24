import { describe, expect, it } from "vitest";
import { WinConditionChecker } from "@/game/WinConditionChecker";
import {
	EARTH_MASS_KG,
	G_AU,
	SIM_DT,
	SOLAR_MASS_KG,
	WIN_CHECK_INTERVAL,
} from "@/simulation/PhysicsConstants";
import type { Body, SimulationState, WinCondition } from "@/types";

// ── Factories ─────────────────────────────────────────────────────────────────

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

/**
 * Create a satellite on a circular orbit at the given radius.
 * Velocity is set to the circular orbital speed around a solar-mass star.
 * retrograde=true flips the velocity sign for a clockwise orbit.
 */
function makeCircularOrbit(
	radius: number,
	retrograde = false,
	id = "sat",
): Body {
	const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / radius);
	const vy = retrograde ? -vCircular : vCircular;

	return {
		id,
		mass: EARTH_MASS_KG,
		radius: 8,
		position: { x: radius, y: 0 },
		velocity: { x: 0, y: vy },
		isFixed: false,
		color: "#4488FF",
		shape: "circle",
		trailPoints: [],
		trailMaxLength: 200,
	};
}

function makeSimState(bodies: Body[]): SimulationState {
	return {
		bodies,
		time: 0,
		timeScale: 1,
		isPaused: false,
		isCommitted: true,
		burnCount: 2,
		fuelUsed: 1e-7,
		fuelBudget: null,
	};
}

/** Call checker.check(state) n times and return the last result. */
function checkNTimes(
	checker: WinConditionChecker,
	state: SimulationState,
	n: number,
) {
	let result = checker.check(state);
	for (let i = 1; i < n; i++) {
		result = checker.check(state);
	}
	return result;
}

// ── stable_orbit ──────────────────────────────────────────────────────────────

describe("stable_orbit", () => {
	it("should return won after checkWindowTicks when orbit matches target SMA and eccentricity", () => {
		const bodies = [makeStar(), makeCircularOrbit(0.5)];
		const state = makeSimState(bodies);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.05,
			targetSemiMajorAxis: 0.5,
			semiMajorAxisTolerance: 0.1,
			checkWindowTicks: 5,
		};

		const checker = new WinConditionChecker([condition], []);
		const result = checkNTimes(checker, state, 5);

		expect(result.status).toBe("won");
	});

	it("should remain in_progress when SMA is outside tolerance", () => {
		// Sat at 0.5 AU but win condition requires 1.0 AU ± 0.1
		const bodies = [makeStar(), makeCircularOrbit(0.5)];
		const state = makeSimState(bodies);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.05,
			targetSemiMajorAxis: 1.0,
			semiMajorAxisTolerance: 0.1,
			checkWindowTicks: 5,
		};

		const checker = new WinConditionChecker([condition], []);
		const result = checkNTimes(checker, state, 10);

		expect(result.status).toBe("in_progress");
	});

	it("should remain in_progress when eccentricity is outside tolerance", () => {
		// Circular orbit but target is e=0.55 ± 0.15 (our e≈0 is way out)
		const bodies = [makeStar(), makeCircularOrbit(1.0)];
		const state = makeSimState(bodies);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0.55,
			eccentricityTolerance: 0.15,
			checkWindowTicks: 5,
		};

		const checker = new WinConditionChecker([condition], []);
		const result = checkNTimes(checker, state, 10);

		expect(result.status).toBe("in_progress");
	});

	it("should reset counter when orbit exits tolerance before window completes", () => {
		const goodState = makeSimState([makeStar(), makeCircularOrbit(0.5)]);

		// A bad state — satellite at wrong SMA (1.5 AU)
		const badSat: Body = {
			...makeCircularOrbit(1.5),
			id: "sat",
		};
		const badState = makeSimState([makeStar(), badSat]);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.05,
			targetSemiMajorAxis: 0.5,
			semiMajorAxisTolerance: 0.1,
			checkWindowTicks: 5,
		};

		const checker = new WinConditionChecker([condition], []);

		// Pass 4 times, then fail once, then pass again — should not win yet
		for (let i = 0; i < 4; i++) checker.check(goodState);
		checker.check(badState); // reset
		const result = checker.check(goodState); // count = 1, not 5

		expect(result.status).toBe("in_progress");
	});

	it("should pass when eccentricity is exactly at the tolerance boundary", () => {
		// Build an orbit with e = targetE + tolerance exactly (boundary inclusive)
		const targetE = 0;
		const tol = 0.05;
		const boundaryE = targetE + tol; // e = 0.05

		// Create an elliptical body with e ≈ 0.05 using vis-viva at periapsis
		const a = 1.0;
		const rPeriapsis = a * (1 - boundaryE);
		const vPeriapsis = Math.sqrt(
			G_AU * SOLAR_MASS_KG * (2 / rPeriapsis - 1 / a),
		);

		const sat: Body = {
			id: "sat",
			mass: EARTH_MASS_KG,
			radius: 8,
			position: { x: rPeriapsis, y: 0 },
			velocity: { x: 0, y: vPeriapsis },
			isFixed: false,
			color: "#4488FF",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};

		const bodies = [makeStar(), sat];
		const state = makeSimState(bodies);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: targetE,
			eccentricityTolerance: tol,
			checkWindowTicks: 1,
		};

		const checker = new WinConditionChecker([condition], []);
		const result = checker.check(state);

		// At boundary, |e - targetE| = tol, which satisfies <= tol
		expect(result.status).toBe("won");
	});

	it("should pass for retrograde orbit when orbitDirection is retrograde, fail for prograde", () => {
		const retrogradeSat = makeCircularOrbit(1.0, true);
		const retroState = makeSimState([makeStar(), retrogradeSat]);

		const progradeState = makeSimState([
			makeStar(),
			makeCircularOrbit(1.0, false),
		]);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.1,
			orbitDirection: "retrograde",
			checkWindowTicks: 1,
		};

		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(retroState).status).toBe("won");

		checker.reset();
		expect(checker.check(progradeState).status).toBe("in_progress");
	});
});

// ── escape_velocity ───────────────────────────────────────────────────────────

describe("escape_velocity", () => {
	it("should detect escape when velocity exceeds escape velocity", () => {
		const vEscape = Math.sqrt((2 * G_AU * SOLAR_MASS_KG) / 1.0);
		const probe: Body = {
			id: "probe",
			mass: EARTH_MASS_KG,
			radius: 8,
			position: { x: 1, y: 0 },
			velocity: { x: 0, y: vEscape * 1.1 },
			isFixed: false,
			color: "#FF8800",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};

		const state = makeSimState([makeStar(), probe]);
		const condition: WinCondition = {
			type: "escape_velocity",
			bodyId: "probe",
			targetBodyId: "star",
			checkWindowTicks: 1,
		};

		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should not trigger for circular velocity (bound orbit)", () => {
		const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / 1.0);
		const probe: Body = {
			id: "probe",
			mass: EARTH_MASS_KG,
			radius: 8,
			position: { x: 1, y: 0 },
			velocity: { x: 0, y: vCircular },
			isFixed: false,
			color: "#FF8800",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};

		const state = makeSimState([makeStar(), probe]);
		const condition: WinCondition = {
			type: "escape_velocity",
			bodyId: "probe",
			targetBodyId: "star",
			checkWindowTicks: 5,
		};

		const checker = new WinConditionChecker([condition], []);
		expect(checkNTimes(checker, state, 10).status).toBe("in_progress");
	});

	it("should not trigger at 0.99× escape velocity (barely bound)", () => {
		const vEscape = Math.sqrt((2 * G_AU * SOLAR_MASS_KG) / 1.0);
		const probe: Body = {
			id: "probe",
			mass: EARTH_MASS_KG,
			radius: 8,
			position: { x: 1, y: 0 },
			velocity: { x: 0, y: vEscape * 0.99 },
			isFixed: false,
			color: "#FF8800",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};

		const state = makeSimState([makeStar(), probe]);
		const condition: WinCondition = {
			type: "escape_velocity",
			bodyId: "probe",
			targetBodyId: "star",
			checkWindowTicks: 5,
		};

		const checker = new WinConditionChecker([condition], []);
		expect(checkNTimes(checker, state, 10).status).toBe("in_progress");
	});
});

// ── checkWindowTicks mechanics ────────────────────────────────────────────────

describe("checkWindowTicks mechanics", () => {
	it("should trigger on first pass when checkWindowTicks=1", () => {
		const bodies = [makeStar(), makeCircularOrbit(1.0)];
		const state = makeSimState(bodies);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.1,
			checkWindowTicks: 1,
		};

		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should require 5 consecutive passes for checkWindowTicks=5", () => {
		const bodies = [makeStar(), makeCircularOrbit(1.0)];
		const state = makeSimState(bodies);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.1,
			checkWindowTicks: 5,
		};

		const checker = new WinConditionChecker([condition], []);

		for (let i = 0; i < 4; i++) {
			expect(checker.check(state).status).toBe("in_progress");
		}
		expect(checker.check(state).status).toBe("won");
	});

	it("should require a full reset window after a failed check", () => {
		const goodBodies = [makeStar(), makeCircularOrbit(1.0)];
		const goodState = makeSimState(goodBodies);

		const badSat: Body = { ...makeCircularOrbit(5.0), id: "sat" };
		const badState = makeSimState([makeStar(), badSat]);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.05,
			targetSemiMajorAxis: 1.0,
			semiMajorAxisTolerance: 0.1,
			checkWindowTicks: 5,
		};

		const checker = new WinConditionChecker([condition], []);

		// Pass 4 times
		for (let i = 0; i < 4; i++) checker.check(goodState);
		// Fail once → counter resets
		checker.check(badState);
		// Pass 4 more times → not yet at window
		for (let i = 0; i < 4; i++) checker.check(goodState);
		expect(checker.check(goodState).status).toBe("won"); // 5th pass after reset
	});

	it("should clear all counters on reset()", () => {
		const bodies = [makeStar(), makeCircularOrbit(1.0)];
		const state = makeSimState(bodies);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.1,
			checkWindowTicks: 5,
		};

		const checker = new WinConditionChecker([condition], []);

		// Build up 4 consecutive passes
		for (let i = 0; i < 4; i++) checker.check(state);

		// Reset should clear the counter
		checker.reset();

		// Should need another full 5 passes
		for (let i = 0; i < 4; i++) {
			expect(checker.check(state).status).toBe("in_progress");
		}
		expect(checker.check(state).status).toBe("won");
	});
});

// ── Multiple conditions ───────────────────────────────────────────────────────

describe("multiple conditions", () => {
	it("should return won only when both win conditions are satisfied", () => {
		const sat1 = makeCircularOrbit(0.5, false, "sat1");
		const sat2 = makeCircularOrbit(1.0, false, "sat2");
		const bodies = [makeStar(), sat1, sat2];
		const state = makeSimState(bodies);

		const conditions: WinCondition[] = [
			{
				type: "stable_orbit",
				bodyId: "sat1",
				targetBodyId: "star",
				targetEccentricity: 0,
				eccentricityTolerance: 0.1,
				checkWindowTicks: 1,
			},
			{
				type: "stable_orbit",
				bodyId: "sat2",
				targetBodyId: "star",
				targetEccentricity: 0,
				eccentricityTolerance: 0.1,
				checkWindowTicks: 1,
			},
		];

		const checker = new WinConditionChecker(conditions, []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should return in_progress when only one of two conditions is satisfied", () => {
		const sat1 = makeCircularOrbit(0.5, false, "sat1");
		// sat2 at wrong SMA for its condition
		const sat2 = makeCircularOrbit(5.0, false, "sat2");
		const bodies = [makeStar(), sat1, sat2];
		const state = makeSimState(bodies);

		const conditions: WinCondition[] = [
			{
				type: "stable_orbit",
				bodyId: "sat1",
				targetBodyId: "star",
				targetEccentricity: 0,
				eccentricityTolerance: 0.1,
				targetSemiMajorAxis: 0.5,
				semiMajorAxisTolerance: 0.1,
				checkWindowTicks: 1,
			},
			{
				type: "stable_orbit",
				bodyId: "sat2",
				targetBodyId: "star",
				targetEccentricity: 0,
				eccentricityTolerance: 0.1,
				targetSemiMajorAxis: 1.0,
				semiMajorAxisTolerance: 0.1,
				checkWindowTicks: 1,
			},
		];

		const checker = new WinConditionChecker(conditions, []);
		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should return failed rather than won when fail condition is triggered simultaneously", () => {
		// Win condition: sat in circular orbit at 1 AU
		// Fail condition: same sat — also triggers (escape) → fail takes priority
		const vEscape = Math.sqrt((2 * G_AU * SOLAR_MASS_KG) / 1.0);
		const probe: Body = {
			id: "probe",
			mass: EARTH_MASS_KG,
			radius: 8,
			position: { x: 1, y: 0 },
			velocity: { x: 0, y: vEscape * 1.5 }, // escaping → fail condition
			isFixed: false,
			color: "#FF8800",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};

		const state = makeSimState([makeStar(), probe]);

		const winCondition: WinCondition = {
			type: "stable_orbit",
			bodyId: "probe",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 5.0, // absurdly wide — would pass for any e
			checkWindowTicks: 1,
		};

		const failCondition: WinCondition = {
			type: "escape_velocity",
			bodyId: "probe",
			targetBodyId: "star",
			checkWindowTicks: 1,
		};

		const checker = new WinConditionChecker([winCondition], [failCondition]);
		const result = checker.check(state);

		expect(result.status).toBe("failed");
	});
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("edge cases", () => {
	it("should return in_progress without crashing when bodyId is not in state", () => {
		const bodies = [makeStar()]; // 'sat' is missing
		const state = makeSimState(bodies);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.1,
			checkWindowTicks: 1,
		};

		const checker = new WinConditionChecker([condition], []);
		expect(() => checker.check(state)).not.toThrow();
		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should throw at construction when winConditions array is empty", () => {
		expect(() => new WinConditionChecker([], [])).toThrow();
	});

	it("should not crash or falsely win on degenerate orbit (NaN velocity)", () => {
		const degenerateSat: Body = {
			id: "sat",
			mass: EARTH_MASS_KG,
			radius: 8,
			position: { x: 0, y: 0 }, // same as star → degenerate
			velocity: { x: NaN, y: NaN },
			isFixed: false,
			color: "#4488FF",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};

		const state = makeSimState([makeStar(), degenerateSat]);

		const condition: WinCondition = {
			type: "stable_orbit",
			bodyId: "sat",
			targetBodyId: "star",
			targetEccentricity: 0,
			eccentricityTolerance: 0.05,
			checkWindowTicks: 1,
		};

		const checker = new WinConditionChecker([condition], []);
		expect(() => checker.check(state)).not.toThrow();
		expect(checker.check(state).status).toBe("in_progress");
	});
});

// ── Rendezvous ──────────────────────────────────────────────────────────────

describe("rendezvous win condition", () => {
	function makeRendezvousState(
		dist: number,
		relSpeed: number,
	): SimulationState {
		return makeSimState([
			makeStar(),
			{
				id: "probe",
				mass: 1e15,
				radius: 6,
				position: { x: 1.0, y: 0 },
				velocity: { x: 0, y: 2e-7 },
				isFixed: false,
				color: "#44FF88",
				shape: "circle",
				trailPoints: [],
				trailMaxLength: 200,
			},
			{
				id: "target",
				mass: 1e15,
				radius: 6,
				position: { x: 1.0 + dist, y: 0 },
				velocity: { x: 0, y: 2e-7 + relSpeed },
				isFixed: false,
				color: "#FF4444",
				shape: "circle",
				trailPoints: [],
				trailMaxLength: 200,
			},
		]);
	}

	const rendezvousCondition: WinCondition = {
		type: "rendezvous",
		bodyId: "probe",
		targetBodyId: "target",
		proximityDistance: 0.05,
		relativeVelocityMax: 2e-8,
		checkWindowTicks: 1,
	};

	it("should pass when within proximity and velocity tolerance", () => {
		const state = makeRendezvousState(0.03, 1e-9);
		const checker = new WinConditionChecker([rendezvousCondition], []);

		expect(checker.check(state).status).toBe("won");
	});

	it("should fail when distance exceeds proximity", () => {
		const state = makeRendezvousState(0.06, 1e-9);
		const checker = new WinConditionChecker([rendezvousCondition], []);

		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should fail when relative velocity exceeds max", () => {
		const state = makeRendezvousState(0.03, 5e-8);
		const checker = new WinConditionChecker([rendezvousCondition], []);

		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should require both conditions simultaneously", () => {
		const farState = makeRendezvousState(0.06, 5e-8);
		const checker = new WinConditionChecker([rendezvousCondition], []);

		expect(checker.check(farState).status).toBe("in_progress");
	});

	it("should handle missing target body gracefully", () => {
		const state = makeSimState([makeStar()]);
		const checker = new WinConditionChecker([rendezvousCondition], []);

		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should respect checkWindowTicks > 1", () => {
		const condition: WinCondition = {
			...rendezvousCondition,
			checkWindowTicks: 3,
		};
		const state = makeRendezvousState(0.03, 1e-9);
		const checker = new WinConditionChecker([condition], []);

		expect(checker.check(state).status).toBe("in_progress");
		expect(checker.check(state).status).toBe("in_progress");
		expect(checker.check(state).status).toBe("won");
	});
});

// ── Lagrange Station ──────────────────────────────────────────────────────────

describe("lagrange_station win condition", () => {
	// Star at origin, planet at (1,0) with CCW (prograde) velocity.
	// L4 = rotate((1,0), +60°) = (cos60°, sin60°) = (0.5, 0.866)
	// L5 = rotate((1,0), -60°) = (cos(-60°), sin(-60°)) = (0.5, -0.866)
	const L4_X = Math.cos(Math.PI / 3);
	const L4_Y = Math.sin(Math.PI / 3);
	const L5_Y = -Math.sin(Math.PI / 3);

	function makePlanet(retrograde = false): Body {
		return makeCircularOrbit(1.0, retrograde, "planet");
	}

	function makeProbe(px: number, py: number): Body {
		return {
			id: "probe",
			mass: EARTH_MASS_KG,
			radius: 6,
			position: { x: px, y: py },
			velocity: { x: 0, y: 0 },
			isFixed: false,
			color: "#44FF88",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};
	}

	it("should pass when body is at exact L4 of a CCW orbit", () => {
		const state = makeSimState([
			makeStar(),
			makePlanet(false),
			makeProbe(L4_X, L4_Y),
		]);
		const condition: WinCondition = {
			type: "lagrange_station",
			bodyId: "probe",
			targetBodyId: "planet",
			lagrangePoint: "L4",
			proximityDistance: 0.02,
			checkWindowTicks: 1,
		};
		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should pass when body is at exact L5 of a CCW orbit", () => {
		const state = makeSimState([
			makeStar(),
			makePlanet(false),
			makeProbe(L4_X, L5_Y),
		]);
		const condition: WinCondition = {
			type: "lagrange_station",
			bodyId: "probe",
			targetBodyId: "planet",
			lagrangePoint: "L5",
			proximityDistance: 0.02,
			checkWindowTicks: 1,
		};
		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should flip L4 to -60° for a retrograde orbit", () => {
		// Retrograde planet: h < 0 → L4 angle flips to -PI/3 → position (0.5, -0.866)
		const state = makeSimState([
			makeStar(),
			makePlanet(true),
			makeProbe(L4_X, L5_Y), // (0.5, -0.866) is retrograde L4
		]);
		const condition: WinCondition = {
			type: "lagrange_station",
			bodyId: "probe",
			targetBodyId: "planet",
			lagrangePoint: "L4",
			proximityDistance: 0.02,
			checkWindowTicks: 1,
		};
		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should return in_progress when body is 0.05 AU from L4 and tolerance is 0.02", () => {
		// L4 at (0.5, 0.866): offset probe by 0.05 AU in x
		const state = makeSimState([
			makeStar(),
			makePlanet(false),
			makeProbe(L4_X + 0.05, L4_Y),
		]);
		const condition: WinCondition = {
			type: "lagrange_station",
			bodyId: "probe",
			targetBodyId: "planet",
			lagrangePoint: "L4",
			proximityDistance: 0.02,
			checkWindowTicks: 1,
		};
		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should pass when body is within the tolerance boundary (0.019 AU from L4)", () => {
		// Body at L4_X + 0.019 in x — 0.019 AU from L4, inside the 0.02 tolerance.
		// (Using 0.019 rather than exactly 0.02 to avoid floating-point rounding past the boundary.)
		const state = makeSimState([
			makeStar(),
			makePlanet(false),
			makeProbe(L4_X + 0.019, L4_Y),
		]);
		const condition: WinCondition = {
			type: "lagrange_station",
			bodyId: "probe",
			targetBodyId: "planet",
			lagrangePoint: "L4",
			proximityDistance: 0.02,
			checkWindowTicks: 1,
		};
		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should convert holdDuration to the correct number of required checks", () => {
		// holdDuration = 10000s → window = ceil(10000 / (WIN_CHECK_INTERVAL * SIM_DT)) = 5
		const holdDuration = 10000;
		const expectedWindow = Math.ceil(
			holdDuration / (WIN_CHECK_INTERVAL * SIM_DT),
		);

		const state = makeSimState([
			makeStar(),
			makePlanet(false),
			makeProbe(L4_X, L4_Y),
		]);
		const condition: WinCondition = {
			type: "lagrange_station",
			bodyId: "probe",
			targetBodyId: "planet",
			lagrangePoint: "L4",
			proximityDistance: 0.02,
			holdDuration,
		};
		const checker = new WinConditionChecker([condition], []);

		// Should require exactly expectedWindow passes
		for (let i = 0; i < expectedWindow - 1; i++) {
			expect(checker.check(state).status).toBe("in_progress");
		}
		expect(checker.check(state).status).toBe("won");
	});

	it("should return in_progress when bodyId is missing from state", () => {
		// probe not in state bodies
		const state = makeSimState([makeStar(), makePlanet(false)]);
		const condition: WinCondition = {
			type: "lagrange_station",
			bodyId: "probe",
			targetBodyId: "planet",
			lagrangePoint: "L4",
			proximityDistance: 0.02,
			checkWindowTicks: 1,
		};
		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should return in_progress when secondary is at primary position", () => {
		// Planet placed at origin — same as star, so |r| = 0 → guard triggers
		const planetAtOrigin: Body = {
			id: "planet",
			mass: EARTH_MASS_KG,
			radius: 8,
			position: { x: 0, y: 0 },
			velocity: { x: 0, y: 0 },
			isFixed: false,
			color: "#4488FF",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};
		const state = makeSimState([
			makeStar(),
			planetAtOrigin,
			makeProbe(L4_X, L4_Y),
		]);
		const condition: WinCondition = {
			type: "lagrange_station",
			bodyId: "probe",
			targetBodyId: "planet",
			lagrangePoint: "L4",
			proximityDistance: 0.02,
			checkWindowTicks: 1,
		};
		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("in_progress");
	});
});

// ── Orbital Resonance ─────────────────────────────────────────────────────────

describe("orbital_resonance win condition", () => {
	// Kepler 3rd law: T ∝ r^(3/2) for circular orbits around a central mass.
	// For a 2:1 resonance (T_body / T_ref = 2): r_body = r_ref * 2^(2/3)

	function makeOrbitingBody(radius: number, id: string): Body {
		return makeCircularOrbit(radius, false, id);
	}

	function makeResonanceState(
		bodyRadius: number,
		refRadius: number,
	): SimulationState {
		return makeSimState([
			makeStar(),
			makeOrbitingBody(bodyRadius, "body"),
			makeOrbitingBody(refRadius, "ref"),
		]);
	}

	function makeResonanceCondition(
		n: number,
		m: number,
		tolerance = 0.05,
	): WinCondition {
		return {
			type: "orbital_resonance",
			bodyId: "body",
			targetBodyId: "ref",
			resonanceRatio: [n, m],
			resonanceTolerance: tolerance,
			checkWindowTicks: 1,
		};
	}

	it("should pass for exact 2:1 resonance", () => {
		// ref at 0.5 AU, body at 0.5 * 2^(2/3) ≈ 0.7937 AU → T_body/T_ref = 2
		const refRadius = 0.5;
		const bodyRadius = refRadius * 2 ** (2 / 3);
		const state = makeResonanceState(bodyRadius, refRadius);
		const condition = makeResonanceCondition(2, 1);

		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should pass for exact 1:1 resonance (both at same radius)", () => {
		const state = makeResonanceState(1.0, 1.0);
		const condition = makeResonanceCondition(1, 1);

		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should pass for exact 3:2 resonance", () => {
		// ref at 0.5 AU, body at 0.5 * (3/2)^(2/3) ≈ 0.6552 AU → T_body/T_ref = 1.5
		const refRadius = 0.5;
		const bodyRadius = refRadius * (3 / 2) ** (2 / 3);
		const state = makeResonanceState(bodyRadius, refRadius);
		const condition = makeResonanceCondition(3, 2);

		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("won");
	});

	it("should return in_progress when ratio is 2.15:1 (outside 5% tolerance of 2:1)", () => {
		// 2.15:1 → relative deviation = |2.15-2|/2 = 0.075 > 0.05
		const refRadius = 0.5;
		const bodyRadius = refRadius * 2.15 ** (2 / 3);
		const state = makeResonanceState(bodyRadius, refRadius);
		const condition = makeResonanceCondition(2, 1, 0.05);

		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should return false when body is escaping", () => {
		const vEscape = Math.sqrt((2 * G_AU * SOLAR_MASS_KG) / 1.0);
		const escapingBody: Body = {
			id: "body",
			mass: EARTH_MASS_KG,
			radius: 8,
			position: { x: 1.0, y: 0 },
			velocity: { x: 0, y: vEscape * 1.1 },
			isFixed: false,
			color: "#FF8800",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};
		const state = makeSimState([
			makeStar(),
			escapingBody,
			makeOrbitingBody(0.5, "ref"),
		]);
		const condition = makeResonanceCondition(2, 1);

		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should return in_progress when bodies are missing from state", () => {
		const state = makeSimState([makeStar()]);
		const condition = makeResonanceCondition(2, 1);

		const checker = new WinConditionChecker([condition], []);
		expect(checker.check(state).status).toBe("in_progress");
	});

	it("should return in_progress for degenerate body at primary position (NaN orbital elements)", () => {
		// Body at star's position → rMag = 0 → NaN/Infinity in orbital elements
		const bodyAtStar: Body = {
			id: "body",
			mass: EARTH_MASS_KG,
			radius: 8,
			position: { x: 0, y: 0 },
			velocity: { x: 0, y: 0 },
			isFixed: false,
			color: "#4488FF",
			shape: "circle",
			trailPoints: [],
			trailMaxLength: 200,
		};
		const state = makeSimState([
			makeStar(),
			bodyAtStar,
			makeOrbitingBody(0.5, "ref"),
		]);
		const condition = makeResonanceCondition(2, 1);

		const checker = new WinConditionChecker([condition], []);
		expect(() => checker.check(state)).not.toThrow();
		expect(checker.check(state).status).toBe("in_progress");
	});
});
