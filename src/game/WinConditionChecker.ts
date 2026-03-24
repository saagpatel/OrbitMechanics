import { computeOrbitalElements } from "@/simulation/KeplerSolver";
import { SIM_DT, WIN_CHECK_INTERVAL } from "@/simulation/PhysicsConstants";
import type { Body, SimulationState, WinCondition } from "@/types";
import * as Vec from "@/utils/Vector2";

export type WinCheckResult =
	| { status: "in_progress" }
	| { status: "won"; burnCount: number; fuelUsed: number }
	| { status: "failed"; reason: string };

/**
 * Evaluates win and fail conditions against the current simulation state.
 *
 * Conditions must be satisfied for a consecutive window of ticks before
 * triggering — prevents false positives from momentary crossings.
 */
export class WinConditionChecker {
	private readonly winConditions: WinCondition[];
	private readonly failConditions: WinCondition[];

	// Maps conditionIndex → consecutivePassCount
	private winCounts: Map<number, number> = new Map();
	private failCounts: Map<number, number> = new Map();

	constructor(winConditions: WinCondition[], failConditions: WinCondition[]) {
		if (winConditions.length === 0) {
			throw new Error(
				"WinConditionChecker requires at least one win condition",
			);
		}
		this.winConditions = winConditions;
		this.failConditions = failConditions;

		// Initialise all counters to zero
		for (let i = 0; i < winConditions.length; i++) {
			this.winCounts.set(i, 0);
		}
		for (let i = 0; i < failConditions.length; i++) {
			this.failCounts.set(i, 0);
		}
	}

	/**
	 * Evaluate all conditions against the given state.
	 * Fail conditions are checked first; any single failure returns 'failed'.
	 * Win requires ALL conditions to pass for their full checkWindowTicks.
	 */
	check(state: SimulationState): WinCheckResult {
		// ── Fail conditions (fail-fast: any one hit → failed) ─────────────
		for (let i = 0; i < this.failConditions.length; i++) {
			const condition = this.failConditions[i]!;
			const passes = this.evaluateCondition(condition, state);
			const prev = this.failCounts.get(i) ?? 0;

			if (passes) {
				const next = prev + 1;
				this.failCounts.set(i, next);
				const window = condition.holdDuration
					? Math.ceil(condition.holdDuration / (WIN_CHECK_INTERVAL * SIM_DT))
					: (condition.checkWindowTicks ?? 5);
				if (next >= window) {
					return {
						status: "failed",
						reason: describeFailCondition(condition, i),
					};
				}
			} else {
				this.failCounts.set(i, 0);
			}
		}

		// ── Win conditions (must ALL pass for their window) ────────────────
		let allWon = true;

		for (let i = 0; i < this.winConditions.length; i++) {
			const condition = this.winConditions[i]!;
			const passes = this.evaluateCondition(condition, state);
			const prev = this.winCounts.get(i) ?? 0;

			if (passes) {
				const next = prev + 1;
				this.winCounts.set(i, next);
				const window = condition.holdDuration
					? Math.ceil(condition.holdDuration / (WIN_CHECK_INTERVAL * SIM_DT))
					: (condition.checkWindowTicks ?? 5);
				if (next < window) {
					allWon = false;
				}
			} else {
				this.winCounts.set(i, 0);
				allWon = false;
			}
		}

		if (allWon) {
			return {
				status: "won",
				burnCount: state.burnCount,
				fuelUsed: state.fuelUsed,
			};
		}

		return { status: "in_progress" };
	}

	/** Reset all consecutive counters — call on level restart. */
	reset(): void {
		for (const key of this.winCounts.keys()) {
			this.winCounts.set(key, 0);
		}
		for (const key of this.failCounts.keys()) {
			this.failCounts.set(key, 0);
		}
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	private evaluateCondition(
		condition: WinCondition,
		state: SimulationState,
	): boolean {
		try {
			switch (condition.type) {
				case "stable_orbit":
					return this.evaluateStableOrbit(condition, state);
				case "escape_velocity":
					return this.evaluateEscapeVelocity(condition, state);
				case "rendezvous":
					return this.evaluateRendezvous(condition, state);
				case "lagrange_station":
					return this.evaluateLagrangeStation(condition, state);
				case "orbital_resonance":
					return this.evaluateOrbitalResonance(condition, state);
				default:
					return false;
			}
		} catch {
			// Defensive: degenerate or NaN states should not crash or falsely win/fail
			return false;
		}
	}

	private evaluateStableOrbit(
		condition: WinCondition,
		state: SimulationState,
	): boolean {
		const { bodyId, targetBodyId } = condition;

		const orbitingBody = state.bodies.find((b) => b.id === bodyId);
		const centralBody = state.bodies.find((b) => b.id === targetBodyId);

		if (!orbitingBody || !centralBody) return false;

		const elements = computeOrbitalElements(centralBody, orbitingBody);

		// Guard against NaN/Infinity from degenerate states
		if (
			!Number.isFinite(elements.eccentricity) ||
			!Number.isFinite(elements.semiMajorAxis)
		) {
			return false;
		}

		// Eccentricity check
		const targetE = condition.targetEccentricity ?? 0;
		const eTol = condition.eccentricityTolerance ?? 0.05;
		if (Math.abs(elements.eccentricity - targetE) > eTol) return false;

		// Semi-major axis check (optional)
		if (condition.targetSemiMajorAxis !== undefined) {
			const smaTol = condition.semiMajorAxisTolerance ?? 0.1;
			if (
				Math.abs(elements.semiMajorAxis - condition.targetSemiMajorAxis) >
				smaTol
			) {
				return false;
			}
		}

		// Orbit direction check (optional)
		if (condition.orbitDirection !== undefined) {
			const wantRetrograde = condition.orbitDirection === "retrograde";
			if (elements.isRetrograde !== wantRetrograde) return false;
		}

		return true;
	}

	private evaluateEscapeVelocity(
		condition: WinCondition,
		state: SimulationState,
	): boolean {
		const { bodyId, targetBodyId } = condition;

		const orbitingBody = state.bodies.find((b) => b.id === bodyId);
		const centralBody = state.bodies.find((b) => b.id === targetBodyId);

		if (!orbitingBody || !centralBody) return false;

		const elements = computeOrbitalElements(centralBody, orbitingBody);

		return elements.isEscaping;
	}

	private evaluateRendezvous(
		condition: WinCondition,
		state: SimulationState,
	): boolean {
		const body = state.bodies.find((b) => b.id === condition.bodyId);
		const target = state.bodies.find((b) => b.id === condition.targetBodyId);
		if (!body || !target) return false;

		const dist = Vec.distance(body.position, target.position);
		if (dist > (condition.proximityDistance ?? 0.05)) return false;

		const relSpeed = Vec.magnitude(Vec.sub(body.velocity, target.velocity));
		if (relSpeed > (condition.relativeVelocityMax ?? 2e-8)) return false;

		return true;
	}

	private findPrimaryBody(state: SimulationState): Body | null {
		if (state.bodies.length === 0) return null;
		let primary = state.bodies[0]!;
		for (const body of state.bodies) {
			if (body.mass > primary.mass) {
				primary = body;
			}
		}
		return primary;
	}

	private evaluateLagrangeStation(
		condition: WinCondition,
		state: SimulationState,
	): boolean {
		const probe = state.bodies.find((b) => b.id === condition.bodyId);
		const secondary = state.bodies.find((b) => b.id === condition.targetBodyId);
		if (!probe || !secondary) return false;

		const primary = this.findPrimaryBody(state);
		if (!primary || primary.id === secondary.id) return false;

		// Compute secondary's angular momentum relative to primary
		const r = Vec.sub(secondary.position, primary.position);
		const v = Vec.sub(secondary.velocity, primary.velocity);
		const h = Vec.cross(r, v); // positive = CCW

		// Guard: secondary at primary position
		if (Vec.magnitude(r) < 1e-15) return false;

		// L4 = +60° ahead (CCW), L5 = -60° behind (CCW)
		// For retrograde (h < 0), flip the sign
		let angle = condition.lagrangePoint === "L4" ? Math.PI / 3 : -Math.PI / 3;
		if (h < 0) angle = -angle;

		const lagrangeRelPos = Vec.rotate(r, angle);
		const lagrangePos = Vec.add(primary.position, lagrangeRelPos);

		const dist = Vec.distance(probe.position, lagrangePos);
		const tolerance = condition.proximityDistance ?? 0.02;

		return dist <= tolerance;
	}

	private evaluateOrbitalResonance(
		condition: WinCondition,
		state: SimulationState,
	): boolean {
		const body = state.bodies.find((b) => b.id === condition.bodyId);
		const refBody = state.bodies.find((b) => b.id === condition.targetBodyId);
		if (!body || !refBody) return false;

		const primary = this.findPrimaryBody(state);
		if (!primary) return false;

		const elemBody = computeOrbitalElements(primary, body);
		const elemRef = computeOrbitalElements(primary, refBody);

		if (elemBody.isEscaping || elemRef.isEscaping) return false;
		if (!Number.isFinite(elemBody.period) || !Number.isFinite(elemRef.period))
			return false;
		if (elemRef.period === 0) return false;

		const [n, m] = condition.resonanceRatio ?? [1, 1];
		const expectedRatio = n / m;
		const actualRatio = elemBody.period / elemRef.period;
		const tolerance = condition.resonanceTolerance ?? 0.05;

		return Math.abs(actualRatio - expectedRatio) <= tolerance * expectedRatio;
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function describeFailCondition(condition: WinCondition, index: number): string {
	switch (condition.type) {
		case "stable_orbit":
			return `Body ${condition.bodyId ?? index} left a stable orbit`;
		case "escape_velocity":
			return `Body ${condition.bodyId ?? index} escaped unexpectedly`;
		case "lagrange_station":
			return `Body ${condition.bodyId ?? index} left the Lagrange station`;
		case "orbital_resonance":
			return `Body ${condition.bodyId ?? index} broke orbital resonance`;
		default:
			return `Fail condition ${index} triggered`;
	}
}
