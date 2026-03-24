import { GravityFieldOverlay } from "@/renderer/GravityFieldOverlay";
import { OrbitalDataOverlay } from "@/renderer/OrbitalDataOverlay";
import { StarFieldRenderer } from "@/renderer/StarFieldRenderer";
import { TrailRenderer } from "@/renderer/TrailRenderer";
import { VectorRenderer } from "@/renderer/VectorRenderer";
import type { Viewport } from "@/renderer/Viewport";
import type { SOIBody } from "@/simulation/PatchedConics";
import { EARTH_MASS_KG } from "@/simulation/PhysicsConstants";
import type { Body, VectorDrawState } from "@/types";

/**
 * Top-level Canvas renderer. Composes TrailRenderer, VectorRenderer,
 * GravityFieldOverlay, OrbitalDataOverlay, and StarFieldRenderer.
 *
 * Draw order: clear → stars → gravity field → trails → bodies → orbital data → vector overlay.
 */
export class CanvasRenderer {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly starField: StarFieldRenderer;
	private readonly trailRenderer: TrailRenderer;
	private readonly vectorRenderer: VectorRenderer;
	private readonly gravityFieldOverlay: GravityFieldOverlay;
	private readonly orbitalDataOverlay: OrbitalDataOverlay;
	private colorblindMode = false;

	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly viewport: Viewport,
	) {
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get 2D canvas context");
		this.ctx = ctx;
		this.starField = new StarFieldRenderer(ctx, viewport);
		this.trailRenderer = new TrailRenderer(ctx, viewport);
		this.vectorRenderer = new VectorRenderer(ctx, viewport);
		this.gravityFieldOverlay = new GravityFieldOverlay(ctx, viewport);
		this.orbitalDataOverlay = new OrbitalDataOverlay(ctx);
	}

	/** Toggle a named overlay on or off. */
	setOverlayEnabled(
		overlay: "gravityField" | "orbitalData",
		enabled: boolean,
	): void {
		if (overlay === "gravityField") {
			this.gravityFieldOverlay.setEnabled(enabled);
		} else {
			this.orbitalDataOverlay.setEnabled(enabled);
		}
	}

	setColorblindMode(enabled: boolean): void {
		this.colorblindMode = enabled;
	}

	render(
		bodies: ReadonlyArray<Readonly<Body>>,
		drawState: Readonly<VectorDrawState> | null,
		centralBody: Readonly<Body> | null,
		soiBodies?: ReadonlyArray<SOIBody>,
	): void {
		const { ctx, canvas } = this;

		// 1. Clear to black
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// 2. Star field background
		this.starField.render();

		// 3. Gravity field overlay (behind everything else)
		this.gravityFieldOverlay.render(bodies);

		// 4. Fading trails behind bodies
		this.trailRenderer.render(bodies);

		// 5. Solid body circles (with glow for massive bodies)
		this.drawBodies(bodies);

		// 6. Orbital data overlay (on top of bodies)
		this.orbitalDataOverlay.render(bodies, centralBody);

		// 7. Velocity arrow + trajectory preview + selection highlight on top
		if (drawState !== null) {
			this.vectorRenderer.render(
				drawState,
				bodies,
				centralBody,
				soiBodies ?? [],
			);
		}
	}

	private drawBodies(bodies: ReadonlyArray<Readonly<Body>>): void {
		const { ctx, viewport } = this;

		for (const body of bodies) {
			const screenPos = viewport.simToScreen(body.position);
			const radius = Math.max(body.radius, 2); // minimum 2px visibility

			// Glow for massive bodies (stars, large planets)
			const glowRadius = Math.min(Math.sqrt(body.mass / 5.972e24) * 2, 60);
			if (glowRadius > 3) {
				ctx.save();
				ctx.shadowColor = body.color;
				ctx.shadowBlur = glowRadius;
				ctx.beginPath();
				ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
				ctx.fillStyle = body.color;
				ctx.fill();
				ctx.restore();
			}

			if (this.colorblindMode) {
				const isHeavy = body.mass > EARTH_MASS_KG * 100;
				this.drawShape(body.shape, screenPos, radius, body.color, isHeavy);
			} else {
				// Solid filled circle
				ctx.beginPath();
				ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
				ctx.fillStyle = body.color;
				ctx.fill();
			}
		}
	}

	private drawShape(
		shape: Body["shape"],
		pos: { x: number; y: number },
		radius: number,
		color: string,
		filled: boolean,
	): void {
		const { ctx } = this;
		ctx.beginPath();

		switch (shape) {
			case "circle":
				ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
				break;
			case "triangle": {
				const h = radius * 1.2;
				for (let i = 0; i < 3; i++) {
					const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
					const x = pos.x + h * Math.cos(angle);
					const y = pos.y + h * Math.sin(angle);
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.closePath();
				break;
			}
			case "diamond": {
				const d = radius * 1.2;
				ctx.moveTo(pos.x, pos.y - d);
				ctx.lineTo(pos.x + d, pos.y);
				ctx.lineTo(pos.x, pos.y + d);
				ctx.lineTo(pos.x - d, pos.y);
				ctx.closePath();
				break;
			}
			case "square": {
				const s = radius * 0.9;
				ctx.rect(pos.x - s, pos.y - s, s * 2, s * 2);
				break;
			}
		}

		if (filled) {
			ctx.fillStyle = color;
			ctx.fill();
		} else {
			ctx.strokeStyle = color;
			ctx.lineWidth = 2;
			ctx.stroke();
		}
	}
}
