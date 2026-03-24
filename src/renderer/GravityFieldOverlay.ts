import type { Viewport } from "@/renderer/Viewport";
import { G_AU, SOFTENING } from "@/simulation/PhysicsConstants";
import type { Body } from "@/types";

/**
 * Renders a 20×20 grid of arrows showing gravitational acceleration direction
 * and magnitude. Drawn behind trails so it does not obscure gameplay.
 *
 * Performance: 400 grid points × N bodies = O(400N) force calcs per frame.
 * At N=5 this is 2000 calcs — negligible (<0.1ms).
 */
export class GravityFieldOverlay {
	private enabled = false;
	private readonly GRID_SIZE = 20;

	constructor(
		private readonly ctx: CanvasRenderingContext2D,
		private readonly viewport: Viewport,
	) {}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	render(bodies: ReadonlyArray<Readonly<Body>>): void {
		if (!this.enabled || bodies.length === 0) return;

		const { ctx, viewport, GRID_SIZE } = this;
		const w = ctx.canvas.width;
		const h = ctx.canvas.height;
		const stepX = w / (GRID_SIZE + 1);
		const stepY = h / (GRID_SIZE + 1);

		ctx.save();
		ctx.lineWidth = 1;

		for (let i = 0; i < GRID_SIZE; i++) {
			for (let j = 0; j < GRID_SIZE; j++) {
				const screenX = stepX * (i + 1);
				const screenY = stepY * (j + 1);
				const simPos = viewport.screenToSim({ x: screenX, y: screenY });

				// Sum gravitational acceleration from all bodies
				let ax = 0;
				let ay = 0;
				for (const body of bodies) {
					const dx = body.position.x - simPos.x;
					const dy = body.position.y - simPos.y;
					const distSq = dx * dx + dy * dy;
					const softenedDistSq = distSq + SOFTENING * SOFTENING;
					const dist = Math.sqrt(softenedDistSq);
					const forceMag = (G_AU * body.mass) / softenedDistSq;
					ax += (forceMag * dx) / dist;
					ay += (forceMag * dy) / dist;
				}

				const aMag = Math.sqrt(ax * ax + ay * ay);
				if (aMag < 1e-60) continue;

				// Arrow length: log10 scale mapped to visible range
				// Typical range: 1e-50 (far) to 1e-35 (near star)
				const logMag = Math.log10(aMag);
				const arrowLen = Math.max(3, Math.min(18, (logMag + 50) * 1.2));

				// Direction in sim-space → screen-space (negate Y for screen coords)
				const dirX = ax / aMag;
				const dirY = -ay / aMag; // negate because screen Y is inverted

				// Alpha based on magnitude
				const alpha = Math.max(0.1, Math.min(0.3, (logMag + 50) * 0.02));

				ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
				ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;

				// Draw arrow shaft
				const endX = screenX + dirX * arrowLen;
				const endY = screenY + dirY * arrowLen;
				ctx.beginPath();
				ctx.moveTo(screenX, screenY);
				ctx.lineTo(endX, endY);
				ctx.stroke();

				// Small arrowhead (3px) for longer arrows
				if (arrowLen > 5) {
					const headLen = 3;
					const headAngle = Math.atan2(dirY, dirX);
					ctx.beginPath();
					ctx.moveTo(endX, endY);
					ctx.lineTo(
						endX - headLen * Math.cos(headAngle - 0.4),
						endY - headLen * Math.sin(headAngle - 0.4),
					);
					ctx.lineTo(
						endX - headLen * Math.cos(headAngle + 0.4),
						endY - headLen * Math.sin(headAngle + 0.4),
					);
					ctx.closePath();
					ctx.fill();
				}
			}
		}

		ctx.restore();
	}
}
