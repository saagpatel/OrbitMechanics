import {
	BASE_TICKS_PER_FRAME,
	MAX_TICKS_PER_FRAME,
} from "@/simulation/PhysicsConstants";

type TickCallback = (dt: number) => void;
type RenderCallback = () => void;

/**
 * Game loop using requestAnimationFrame.
 *
 * Runs a fixed number of simulation ticks per frame based on timeScale,
 * then renders once. This is NOT a real-time accumulator — timeScale directly
 * controls sim-speed, not real-time correspondence.
 */
export class GameLoop {
	private running = false;
	private rafId = 0;
	private lastTimestamp = 0;
	private tickCount = 0;
	private frameCount = 0;
	private lastFpsUpdate = 0;

	/** Ticks per second (rolling, updated every second) */
	actualTicksPerSecond = 0;

	/** Last frame time in ms */
	frameTimeMs = 0;

	/** Simulation time scale multiplier */
	timeScale = 1;

	/** Whether simulation is paused */
	isPaused = false;

	constructor(
		private readonly onTick: TickCallback,
		private readonly onRender: RenderCallback,
		private readonly dt: number,
	) {}

	start(): void {
		if (this.running) return;
		this.running = true;
		this.lastTimestamp = performance.now();
		this.lastFpsUpdate = this.lastTimestamp;
		this.tickCount = 0;
		this.frameCount = 0;
		this.rafId = requestAnimationFrame((t) => this.loop(t));
	}

	stop(): void {
		this.running = false;
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = 0;
		}
	}

	private loop(timestamp: number): void {
		if (!this.running) return;

		const elapsed = timestamp - this.lastTimestamp;
		this.lastTimestamp = timestamp;
		this.frameTimeMs = elapsed;

		// Run simulation ticks
		if (!this.isPaused) {
			const ticksThisFrame = Math.min(
				Math.floor(BASE_TICKS_PER_FRAME * this.timeScale),
				MAX_TICKS_PER_FRAME,
			);

			for (let i = 0; i < ticksThisFrame; i++) {
				this.onTick(this.dt);
			}

			this.tickCount += ticksThisFrame;
		}

		// Render
		this.onRender();
		this.frameCount++;

		// Update TPS counter every second
		const sinceFpsUpdate = timestamp - this.lastFpsUpdate;
		if (sinceFpsUpdate >= 1000) {
			this.actualTicksPerSecond = Math.round(
				(this.tickCount / sinceFpsUpdate) * 1000,
			);
			this.tickCount = 0;
			this.lastFpsUpdate = timestamp;
		}

		this.rafId = requestAnimationFrame((t) => this.loop(t));
	}
}
