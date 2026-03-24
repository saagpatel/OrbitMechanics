export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function normalizeAngle(angle: number): number {
	const TWO_PI = 2 * Math.PI;
	return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}
