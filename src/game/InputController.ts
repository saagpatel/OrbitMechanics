import type { Viewport } from "@/renderer/Viewport";
import {
	MIN_BURN_DV,
	VELOCITY_MULTIPLIER,
} from "@/simulation/PhysicsConstants";
import type { Body, DrawPhase, Vector2, VectorDrawState } from "@/types";
import * as Vec from "@/utils/Vector2";

export type InputEvent =
	| { type: "body_selected"; bodyId: string }
	| { type: "vector_committed"; bodyId: string; deltaV: Vector2 }
	| { type: "cancelled" };

export class InputController {
	private drawState: VectorDrawState = {
		phase: "idle",
		selectedBodyId: null,
		startPoint: null,
		currentPoint: null,
	};
	private bodies: ReadonlyArray<Readonly<Body>> = [];
	private mouseDownPos: Vector2 | null = null;

	// Bound handlers for cleanup
	private readonly handleMouseDown: (e: MouseEvent) => void;
	private readonly handleMouseMove: (e: MouseEvent) => void;
	private readonly handleMouseUp: (e: MouseEvent) => void;
	private readonly handleKeyDown: (e: KeyboardEvent) => void;

	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly viewport: Viewport,
		private readonly onEvent: (event: InputEvent) => void,
	) {
		this.handleMouseDown = (e: MouseEvent) => this.onMouseDown(e);
		this.handleMouseMove = (e: MouseEvent) => this.onMouseMove(e);
		this.handleMouseUp = (e: MouseEvent) => this.onMouseUp(e);
		this.handleKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);

		this.canvas.addEventListener("mousedown", this.handleMouseDown);
		this.canvas.addEventListener("mousemove", this.handleMouseMove);
		this.canvas.addEventListener("mouseup", this.handleMouseUp);
		document.addEventListener("keydown", this.handleKeyDown);
	}

	setBodies(bodies: ReadonlyArray<Readonly<Body>>): void {
		this.bodies = bodies;
	}

	getDrawState(): Readonly<VectorDrawState> {
		return this.drawState;
	}

	reset(): void {
		this.drawState = {
			phase: "idle",
			selectedBodyId: null,
			startPoint: null,
			currentPoint: null,
		};
		this.mouseDownPos = null;
	}

	destroy(): void {
		this.canvas.removeEventListener("mousedown", this.handleMouseDown);
		this.canvas.removeEventListener("mousemove", this.handleMouseMove);
		this.canvas.removeEventListener("mouseup", this.handleMouseUp);
		document.removeEventListener("keydown", this.handleKeyDown);
	}

	private onMouseDown(e: MouseEvent): void {
		// Only handle unmodified left-clicks
		if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;

		this.mouseDownPos = { x: e.clientX, y: e.clientY };

		const phase = this.drawState.phase;

		if (phase === "idle" || phase === "committed") {
			const screenPos: Vector2 = { x: e.clientX, y: e.clientY };
			const body = this.findBodyAtScreen(screenPos);
			if (body !== null) {
				this.transitionTo("selecting_body", body.id);
				this.onEvent({ type: "body_selected", bodyId: body.id });
			}
			return;
		}

		if (phase === "selecting_body") {
			// Immediately start drawing when the user clicks in selecting_body
			const body = this.bodies.find(
				(b) => b.id === this.drawState.selectedBodyId,
			);
			if (body !== null && body !== undefined) {
				this.transitionTo("drawing_vector", body.id);
				this.drawState.startPoint = this.viewport.simToScreen(body.position);
				this.drawState.currentPoint = { x: e.clientX, y: e.clientY };
			}
		}
	}

	private onMouseMove(e: MouseEvent): void {
		const phase = this.drawState.phase;

		if (phase === "selecting_body" && this.mouseDownPos !== null) {
			const currentPos: Vector2 = { x: e.clientX, y: e.clientY };
			const dist = Vec.distance(this.mouseDownPos, currentPos);
			if (dist > 5) {
				const body = this.bodies.find(
					(b) => b.id === this.drawState.selectedBodyId,
				);
				if (body !== null && body !== undefined) {
					this.transitionTo("drawing_vector", body.id);
					this.drawState.startPoint = this.viewport.simToScreen(body.position);
					this.drawState.currentPoint = currentPos;
				}
			}
			return;
		}

		if (phase === "drawing_vector") {
			this.drawState.currentPoint = { x: e.clientX, y: e.clientY };
		}
	}

	private onMouseUp(e: MouseEvent): void {
		if (e.button !== 0) return;

		const phase = this.drawState.phase;

		if (phase === "selecting_body") {
			// User clicked without dragging — body stays selected, no vector committed
			this.mouseDownPos = null;
			return;
		}

		if (phase === "drawing_vector") {
			const deltaV = this.computeDeltaV();
			const bodyId = this.drawState.selectedBodyId;

			if (
				deltaV !== null &&
				bodyId !== null &&
				Vec.magnitude(deltaV) >= MIN_BURN_DV
			) {
				this.transitionTo("committed", bodyId);
				this.onEvent({ type: "vector_committed", bodyId, deltaV });
			} else {
				this.transitionTo("idle");
				this.onEvent({ type: "cancelled" });
			}

			this.mouseDownPos = null;
		}
	}

	private onKeyDown(e: KeyboardEvent): void {
		if (e.key !== "Escape") return;

		const phase = this.drawState.phase;
		if (phase === "selecting_body" || phase === "drawing_vector") {
			this.transitionTo("idle");
			this.onEvent({ type: "cancelled" });
		}
	}

	private findBodyAtScreen(screenPos: Vector2): Readonly<Body> | null {
		for (const body of this.bodies) {
			if (body.isFixed) continue;
			const bodyScreen = this.viewport.simToScreen(body.position);
			const dist = Vec.distance(screenPos, bodyScreen);
			if (dist < Math.max(body.radius + 10, 20)) {
				return body;
			}
		}
		return null;
	}

	private computeDeltaV(): Vector2 | null {
		const body = this.bodies.find(
			(b) => b.id === this.drawState.selectedBodyId,
		);
		if (body === undefined || this.drawState.currentPoint === null) return null;

		const bodyScreen = this.viewport.simToScreen(body.position);
		const screenDelta: Vector2 = {
			x: this.drawState.currentPoint.x - bodyScreen.x,
			y: this.drawState.currentPoint.y - bodyScreen.y,
		};

		const simDir = Vec.normalize({ x: screenDelta.x, y: -screenDelta.y });
		const pixelLen = Vec.magnitude(screenDelta);
		const simLen = pixelLen / this.viewport.getPixelsPerAU();
		const dvMag = simLen * VELOCITY_MULTIPLIER;

		return Vec.scale(simDir, dvMag);
	}

	private transitionTo(phase: DrawPhase, bodyId?: string): void {
		this.drawState.phase = phase;
		this.drawState.selectedBodyId = bodyId ?? null;

		if (phase === "idle" || phase === "committed") {
			this.drawState.startPoint = null;
			this.drawState.currentPoint = null;
		}
	}
}
