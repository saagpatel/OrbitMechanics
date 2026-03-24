import { G_AU, SOFTENING } from "@/simulation/PhysicsConstants";
import type { Body, SimulationState, Vector2 } from "@/types";
import * as Vec from "@/utils/Vector2";

export type BurnResult = "applied" | "rejected_no_fuel" | "rejected_invalid";

export class VerletSimulation {
	private bodies: Body[];
	private accelerations: Vector2[];
	private time: number = 0;
	private burnCount: number = 0;
	private fuelUsed: number = 0;
	private fuelBudget: number | null = null;

	constructor(initialBodies: Body[]) {
		this.bodies = initialBodies.map((b) => ({
			...b,
			position: { ...b.position },
			velocity: { ...b.velocity },
			trailPoints: [...b.trailPoints],
		}));

		// Compute initial accelerations
		this.accelerations = this.computeAccelerations();
	}

	/**
	 * Advance simulation by dt seconds using Velocity Verlet (kick-drift-kick).
	 */
	step(dt: number): void {
		const { bodies, accelerations } = this;

		// Phase 1: Half-kick velocity + full-step position
		for (let i = 0; i < bodies.length; i++) {
			const body = bodies[i]!;
			if (body.isFixed) continue;

			const a = accelerations[i]!;
			// v += 0.5 * a * dt
			body.velocity.x += 0.5 * a.x * dt;
			body.velocity.y += 0.5 * a.y * dt;

			// pos += v * dt
			body.position.x += body.velocity.x * dt;
			body.position.y += body.velocity.y * dt;
		}

		// Phase 2: Compute new accelerations from updated positions
		const newAccelerations = this.computeAccelerations();

		// Phase 3: Half-kick velocity with new accelerations
		for (let i = 0; i < bodies.length; i++) {
			const body = bodies[i]!;
			if (body.isFixed) continue;

			const aNew = newAccelerations[i]!;
			body.velocity.x += 0.5 * aNew.x * dt;
			body.velocity.y += 0.5 * aNew.y * dt;
		}

		// Store new accelerations for next step
		this.accelerations = newAccelerations;
		this.time += dt;
	}

	/**
	 * Compute gravitational acceleration for each body.
	 * Fixed bodies get zero acceleration (they don't move).
	 */
	private computeAccelerations(): Vector2[] {
		const { bodies } = this;
		const n = bodies.length;
		const acc: Vector2[] = new Array(n);

		for (let i = 0; i < n; i++) {
			const bodyI = bodies[i]!;
			if (bodyI.isFixed) {
				acc[i] = { x: 0, y: 0 };
				continue;
			}

			let ax = 0;
			let ay = 0;

			for (let j = 0; j < n; j++) {
				if (j === i) continue;
				const bodyJ = bodies[j]!;

				const dx = bodyJ.position.x - bodyI.position.x;
				const dy = bodyJ.position.y - bodyI.position.y;
				const distSq = dx * dx + dy * dy;
				const softenedDistSq = distSq + SOFTENING * SOFTENING;
				const softenedDist = Math.sqrt(softenedDistSq);

				// a = G * m_j / (r² + ε²) * r_hat
				// Using softened distance for both magnitude and direction
				// prevents NaN when bodies overlap (dx=dy=0)
				const forceMag = (G_AU * bodyJ.mass) / softenedDistSq;

				ax += (forceMag * dx) / softenedDist;
				ay += (forceMag * dy) / softenedDist;
			}

			acc[i] = { x: ax, y: ay };
		}

		return acc;
	}

	/** Set the fuel budget for this simulation. null = unlimited. */
	setFuelBudget(budget: number | null): void {
		this.fuelBudget = budget;
	}

	/** Apply a velocity change (burn). Returns result indicating success or rejection reason. */
	applyDeltaV(bodyId: string, dv: Vector2): BurnResult {
		const body = this.bodies.find((b) => b.id === bodyId);
		if (!body || body.isFixed) return "rejected_invalid";

		const dvMag = Vec.magnitude(dv);

		if (this.fuelBudget !== null && this.fuelUsed + dvMag > this.fuelBudget) {
			return "rejected_no_fuel";
		}

		body.velocity.x += dv.x;
		body.velocity.y += dv.y;
		this.burnCount++;
		this.fuelUsed += dvMag;
		return "applied";
	}

	getBodies(): ReadonlyArray<Readonly<Body>> {
		return this.bodies;
	}

	getTime(): number {
		return this.time;
	}

	getState(): SimulationState {
		return {
			bodies: this.bodies,
			time: this.time,
			timeScale: 1,
			isPaused: false,
			isCommitted: true,
			burnCount: this.burnCount,
			fuelUsed: this.fuelUsed,
			fuelBudget: this.fuelBudget,
		};
	}
}
