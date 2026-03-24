import type { Viewport } from "@/renderer/Viewport";
import {
	generatePatchedConicsPreview,
	type SOIBody,
} from "@/simulation/PatchedConics";
import { VELOCITY_MULTIPLIER } from "@/simulation/PhysicsConstants";
import { generateTrajectoryPreview } from "@/simulation/TrajectoryPreview";
import type { Body, TrajectoryPoint, Vector2, VectorDrawState } from "@/types";
import { hexToRGBA } from "@/utils/ColorUtils";
import * as Vec from "@/utils/Vector2";

/**
 * Renders the velocity vector arrow and trajectory preview during drag,
 * plus the pulsing selection highlight around the selected body.
 */
export class VectorRenderer {
	constructor(
		private readonly ctx: CanvasRenderingContext2D,
		private readonly viewport: Viewport,
	) {}

	render(
		drawState: Readonly<VectorDrawState>,
		bodies: ReadonlyArray<Readonly<Body>>,
		centralBody: Readonly<Body> | null,
		soiBodies: ReadonlyArray<SOIBody> = [],
	): void {
		if (
			drawState.phase !== "drawing_vector" &&
			drawState.phase !== "selecting_body"
		)
			return;

		const body = bodies.find((b) => b.id === drawState.selectedBodyId);
		if (!body) return;

		// Selection highlight pulses at ~3 Hz
		this.drawSelectionHighlight(body, Date.now() * 0.003);

		if (
			drawState.phase === "drawing_vector" &&
			drawState.startPoint !== null &&
			drawState.currentPoint !== null
		) {
			// Compute delta-v from screen drag
			const bodyScreenPos = this.viewport.simToScreen(body.position);
			const screenDelta = Vec.sub(drawState.currentPoint, bodyScreenPos);

			// Flip Y: screen +Y is down, sim +Y is up
			const simDir = Vec.normalize({ x: screenDelta.x, y: -screenDelta.y });
			const pixelLength = Vec.magnitude(screenDelta);
			const simLength = pixelLength / this.viewport.getPixelsPerAU();
			const dvMag = simLength * VELOCITY_MULTIPLIER;
			const deltaV = Vec.scale(simDir, dvMag);
			const proposedVelocity = Vec.add(body.velocity, deltaV);

			// Trajectory preview — use patched conics when SOI bodies are present
			if (centralBody !== null) {
				let points: TrajectoryPoint[];
				if (soiBodies.length > 0) {
					points = generatePatchedConicsPreview(
						centralBody,
						soiBodies,
						body.position,
						proposedVelocity,
						200,
					);
				} else {
					points = generateTrajectoryPreview(
						centralBody,
						body.position,
						proposedVelocity,
						200,
					);
				}
				this.drawTrajectoryPreview(points, body.color, 0.4);
			}

			// Arrow from body center to mouse
			this.drawArrow(bodyScreenPos, drawState.currentPoint, body.color);
		}
	}

	/**
	 * Draw a pulsing dashed ring around the body to indicate selection.
	 * Called externally by CanvasRenderer between body draw and vector draw.
	 */
	drawSelectionHighlight(body: Readonly<Body>, pulsePhase: number): void {
		const screenPos = this.viewport.simToScreen(body.position);
		// Pulse amplitude ±2px at the given phase
		const pulse = Math.sin(pulsePhase * Math.PI * 2) * 2;
		const ringRadius = body.radius + 6 + pulse;

		const { ctx } = this;
		ctx.save();
		ctx.strokeStyle = "rgba(255,255,255,0.6)";
		ctx.lineWidth = 1.5;
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.arc(screenPos.x, screenPos.y, ringRadius, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.restore();
	}

	/**
	 * Draw a solid arrow from `from` to `to` with a filled arrowhead.
	 * Shaft is 3px wide; arrowhead is 12px long × 8px wide.
	 */
	private drawArrow(from: Vector2, to: Vector2, color: string): void {
		const { ctx } = this;

		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const angle = Math.atan2(dy, dx);
		const length = Math.sqrt(dx * dx + dy * dy);

		// Don't draw if drag is too short to be meaningful
		if (length < 4) return;

		// Arrowhead geometry
		const headLen = 12;
		const headHalfWidth = 4;

		// Shaft endpoint stops before the arrowhead base
		const shaftEndX = to.x - Math.cos(angle) * headLen;
		const shaftEndY = to.y - Math.sin(angle) * headLen;

		ctx.save();
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = 3;
		ctx.lineCap = "round";

		// Shaft
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.lineTo(shaftEndX, shaftEndY);
		ctx.stroke();

		// Arrowhead — filled triangle
		// Left wing: perpendicular at headHalfWidth to the left
		const perpX = -Math.sin(angle);
		const perpY = Math.cos(angle);

		ctx.beginPath();
		ctx.moveTo(to.x, to.y);
		ctx.lineTo(
			shaftEndX + perpX * headHalfWidth,
			shaftEndY + perpY * headHalfWidth,
		);
		ctx.lineTo(
			shaftEndX - perpX * headHalfWidth,
			shaftEndY - perpY * headHalfWidth,
		);
		ctx.closePath();
		ctx.fill();

		ctx.restore();
	}

	/**
	 * Draw the predicted orbit as a dashed semi-transparent polyline.
	 */
	private drawTrajectoryPreview(
		points: ReadonlyArray<TrajectoryPoint>,
		color: string,
		alpha: number,
	): void {
		if (points.length < 2) return;

		const { ctx, viewport } = this;

		ctx.save();
		ctx.setLineDash([6, 4]);
		ctx.strokeStyle = hexToRGBA(color, alpha);
		ctx.lineWidth = 1.5;
		ctx.beginPath();

		const first = points[0];
		if (first === undefined) {
			ctx.restore();
			return;
		}
		const firstScreen = viewport.simToScreen(first.position);
		ctx.moveTo(firstScreen.x, firstScreen.y);

		for (let i = 1; i < points.length; i++) {
			const pt = points[i];
			if (pt === undefined) continue;
			const screen = viewport.simToScreen(pt.position);
			ctx.lineTo(screen.x, screen.y);
		}

		ctx.stroke();
		ctx.setLineDash([]);
		ctx.restore();
	}
}
