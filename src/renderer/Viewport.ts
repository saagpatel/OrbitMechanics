import type { Vector2 } from "@/types";
import { clamp } from "@/utils/MathUtils";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 20;
const ZOOM_SENSITIVITY = 0.001;

/**
 * Handles coordinate transforms between simulation space (AU, +Y up)
 * and screen space (pixels, +Y down).
 */
export class Viewport {
	private canvas: HTMLCanvasElement;

	/** Pixels per AU at zoom=1 */
	private baseScale: number;

	/** Current zoom multiplier (0.5–20) */
	zoom: number = 1;

	/** Camera center in sim-space (AU) */
	pan: Vector2 = { x: 0, y: 0 };

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.baseScale = Math.min(canvas.width, canvas.height) / 4; // 4 AU visible at zoom=1
		this.setupResizeHandler();
	}

	/** Convert sim-space position (AU) to screen-space position (pixels). */
	simToScreen(pos: Vector2): Vector2 {
		const scale = this.baseScale * this.zoom;
		return {
			x: this.canvas.width / 2 + (pos.x - this.pan.x) * scale,
			y: this.canvas.height / 2 - (pos.y - this.pan.y) * scale, // negate Y
		};
	}

	/** Convert screen-space position (pixels) to sim-space position (AU). */
	screenToSim(pos: Vector2): Vector2 {
		const scale = this.baseScale * this.zoom;
		return {
			x: (pos.x - this.canvas.width / 2) / scale + this.pan.x,
			y: -(pos.y - this.canvas.height / 2) / scale + this.pan.y, // negate Y
		};
	}

	/** Convert a distance in AU to pixels at current zoom. */
	simToScreenDistance(auDistance: number): number {
		return auDistance * this.baseScale * this.zoom;
	}

	/** Apply zoom from mouse wheel. */
	applyZoom(delta: number, mouseScreenPos: Vector2): void {
		const simPosBefore = this.screenToSim(mouseScreenPos);

		this.zoom = clamp(
			this.zoom * (1 - delta * ZOOM_SENSITIVITY),
			MIN_ZOOM,
			MAX_ZOOM,
		);

		// Adjust pan so the point under the mouse stays fixed
		const simPosAfter = this.screenToSim(mouseScreenPos);
		this.pan.x += simPosBefore.x - simPosAfter.x;
		this.pan.y += simPosBefore.y - simPosAfter.y;
	}

	/** Get current scale in pixels per AU. */
	getPixelsPerAU(): number {
		return this.baseScale * this.zoom;
	}

	/** Apply pan from mouse drag (screen-space delta). */
	applyPan(dx: number, dy: number): void {
		const scale = this.baseScale * this.zoom;
		this.pan.x -= dx / scale;
		this.pan.y += dy / scale; // negate Y
	}

	private setupResizeHandler(): void {
		const resize = () => {
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight;
			this.baseScale = Math.min(this.canvas.width, this.canvas.height) / 4;
		};
		window.addEventListener("resize", resize);
		resize(); // initial size
	}
}
