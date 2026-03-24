import type { Viewport } from "@/renderer/Viewport";

interface Star {
	nx: number; // 0-1 normalized x
	ny: number; // 0-1 normalized y
	radius: number;
	alpha: number;
}

function lcg(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) & 0x7fffffff;
		return state / 0x7fffffff;
	};
}

export class StarFieldRenderer {
	private readonly stars: Star[];

	constructor(
		private readonly ctx: CanvasRenderingContext2D,
		private readonly viewport: Viewport,
	) {
		const rng = lcg(42);
		this.stars = Array.from({ length: 200 }, () => ({
			nx: rng(),
			ny: rng(),
			radius: 0.5 + rng() * 1.5,
			alpha: 0.3 + rng() * 0.5,
		}));
	}

	render(): void {
		const { ctx, viewport } = this;
		const w = ctx.canvas.width;
		const h = ctx.canvas.height;

		// Parallax: stars move at 10% of viewport pan speed
		const panOffsetX = viewport.pan.x * viewport.getPixelsPerAU() * 0.1;
		const panOffsetY = -viewport.pan.y * viewport.getPixelsPerAU() * 0.1;

		for (const star of this.stars) {
			let sx = (star.nx * w - panOffsetX) % w;
			let sy = (star.ny * h - panOffsetY) % h;
			if (sx < 0) sx += w;
			if (sy < 0) sy += h;

			ctx.beginPath();
			ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
			ctx.fill();
		}
	}
}
