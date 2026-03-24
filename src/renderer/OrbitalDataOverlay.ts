import { computeOrbitalElements } from "@/simulation/KeplerSolver";
import { SECONDS_PER_DAY } from "@/simulation/PhysicsConstants";
import type { Body } from "@/types";

interface CachedBodyData {
	bodyId: string;
	color: string;
	label: string;
	eccentricity: number;
	semiMajorAxis: number;
	periodDays: number;
	energy: number;
	isEscaping: boolean;
}

/**
 * Canvas-drawn semi-transparent panel in bottom-left showing orbital elements
 * per non-fixed body. Recomputes every 6 frames (~100ms at 60fps) and caches
 * between recomputations to keep render cost negligible.
 */
export class OrbitalDataOverlay {
	private enabled = false;
	private frameCounter = 0;
	private cachedData: CachedBodyData[] = [];

	constructor(private readonly ctx: CanvasRenderingContext2D) {}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	render(
		bodies: ReadonlyArray<Readonly<Body>>,
		centralBody: Readonly<Body> | null,
	): void {
		if (!this.enabled || !centralBody) return;

		// Recompute every 6 frames (~100ms at 60fps)
		this.frameCounter++;
		if (this.frameCounter % 6 === 0 || this.cachedData.length === 0) {
			this.cachedData = [];
			for (const body of bodies) {
				if (body.isFixed) continue;
				if (body.id === centralBody.id) continue;
				const elements = computeOrbitalElements(centralBody, body);
				this.cachedData.push({
					bodyId: body.id,
					color: body.color,
					label: body.label ?? body.id,
					eccentricity: elements.eccentricity,
					semiMajorAxis: elements.semiMajorAxis,
					periodDays: elements.period / SECONDS_PER_DAY,
					energy: elements.specificOrbitalEnergy,
					isEscaping: elements.isEscaping,
				});
			}
		}

		if (this.cachedData.length === 0) return;

		const { ctx } = this;
		const lineHeight = 16;
		const bodyBlockHeight = lineHeight * 3 + 8; // label + 2 data lines + gap
		const panelHeight = this.cachedData.length * bodyBlockHeight + 16;
		const panelWidth = 260;
		const panelX = 16;
		const panelY = ctx.canvas.height - panelHeight - 16;

		ctx.save();

		// Background
		ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
		ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

		// Text
		ctx.font = '11px "JetBrains Mono", "Fira Code", "Courier New", monospace';
		ctx.textBaseline = "top";

		let y = panelY + 8;
		for (const data of this.cachedData) {
			// Color swatch + label
			ctx.fillStyle = data.color;
			ctx.fillRect(panelX + 8, y + 2, 8, 8);
			ctx.fillStyle = "rgba(255,255,255,0.9)";
			ctx.fillText(data.label, panelX + 22, y);
			y += lineHeight;

			// Line 1: eccentricity + semi-major axis
			ctx.fillStyle = "rgba(255,255,255,0.6)";
			const eStr = data.eccentricity.toFixed(4);
			const aStr = data.isEscaping ? "Esc" : data.semiMajorAxis.toFixed(3);
			ctx.fillText(`  e: ${eStr}  a: ${aStr} AU`, panelX + 8, y);
			y += lineHeight;

			// Line 2: period + specific orbital energy
			const tStr = data.isEscaping ? "Esc" : data.periodDays.toFixed(1);
			const energyStr = data.energy.toExponential(2);
			ctx.fillText(`  T: ${tStr} d  E: ${energyStr}`, panelX + 8, y);
			y += lineHeight + 8; // gap between bodies
		}

		ctx.restore();
	}
}
