import type { Vector2 } from "@/types";

export const ZERO: Readonly<Vector2> = { x: 0, y: 0 };

export function add(a: Vector2, b: Vector2): Vector2 {
	return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vector2, b: Vector2): Vector2 {
	return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vector2, s: number): Vector2 {
	return { x: v.x * s, y: v.y * s };
}

export function magnitude(v: Vector2): number {
	return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function magnitudeSquared(v: Vector2): number {
	return v.x * v.x + v.y * v.y;
}

export function normalize(v: Vector2): Vector2 {
	const mag = magnitude(v);
	if (mag === 0) return { x: 0, y: 0 };
	return { x: v.x / mag, y: v.y / mag };
}

export function dot(a: Vector2, b: Vector2): number {
	return a.x * b.x + a.y * b.y;
}

export function distance(a: Vector2, b: Vector2): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	return Math.sqrt(dx * dx + dy * dy);
}

export function rotate(v: Vector2, angle: number): Vector2 {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return {
		x: v.x * cos - v.y * sin,
		y: v.x * sin + v.y * cos,
	};
}

export function cross(a: Vector2, b: Vector2): number {
	return a.x * b.y - a.y * b.x;
}
