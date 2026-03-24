import type { Viewport } from "@/renderer/Viewport";
import type { Body } from "@/types";
import { hexToRGBA } from "@/utils/ColorUtils";

/**
 * Renders fading trail polylines behind bodies.
 * Uses 8 opacity bands so each frame issues 8 strokes instead of N-1 strokes,
 * keeping draw call cost constant regardless of trail length.
 */
export class TrailRenderer {
	constructor(
		private readonly ctx: CanvasRenderingContext2D,
		private readonly viewport: Viewport,
	) {}

	render(bodies: ReadonlyArray<Readonly<Body>>): void {
		const { ctx, viewport } = this;

		for (const body of bodies) {
			const points = body.trailPoints;
			if (points.length < 2) continue;

			const len = points.length;

			// Stride optimization: cap render cost at ~2000 line segments per body.
			// At 10K points stride=5, at 2K points stride=1 (no degradation).
			const stride = Math.max(1, Math.ceil(len / 2000));

			// Draw 8 opacity bands from oldest (darkest) to newest (brightest)
			for (let i = 0; i < 8; i++) {
				const alpha = (i + 0.5) / 8;

				const segStart = Math.floor((i * len) / 8);
				const segEnd = Math.floor(((i + 1) * len) / 8);

				// Need at least 2 points to draw a segment
				if (segEnd - segStart < 1) continue;

				ctx.save();
				ctx.strokeStyle = hexToRGBA(body.color, alpha);
				ctx.lineWidth = 1.5;
				ctx.beginPath();

				// First point of this band — moveTo (stride-aligned)
				const firstPoint = points[segStart];
				if (firstPoint === undefined) continue;
				const screenStart = viewport.simToScreen(firstPoint);
				ctx.moveTo(screenStart.x, screenStart.y);

				// Remaining points in band — lineTo, stepping by stride
				for (let j = segStart + stride; j <= segEnd && j < len; j += stride) {
					const pt = points[j];
					if (pt === undefined) continue;
					const screenPt = viewport.simToScreen(pt);
					ctx.lineTo(screenPt.x, screenPt.y);
				}

				ctx.stroke();
				ctx.restore();
			}
		}
	}
}
