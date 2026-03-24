import { describe, expect, it } from "vitest";
import {
	add,
	distance,
	dot,
	magnitude,
	magnitudeSquared,
	normalize,
	rotate,
	scale,
	sub,
	ZERO,
} from "@/utils/Vector2";

describe("Vector2", () => {
	describe("add", () => {
		it("should add two vectors", () => {
			expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
		});

		it("should handle negative values", () => {
			expect(add({ x: -1, y: 3 }, { x: 2, y: -5 })).toEqual({
				x: 1,
				y: -2,
			});
		});

		it("should handle zero vector", () => {
			expect(add({ x: 5, y: 7 }, ZERO)).toEqual({ x: 5, y: 7 });
		});
	});

	describe("sub", () => {
		it("should subtract two vectors", () => {
			expect(sub({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
		});

		it("should return zero when subtracting a vector from itself", () => {
			const v = { x: 3, y: 4 };
			expect(sub(v, v)).toEqual(ZERO);
		});
	});

	describe("scale", () => {
		it("should scale a vector by a scalar", () => {
			expect(scale({ x: 2, y: 3 }, 4)).toEqual({ x: 8, y: 12 });
		});

		it("should handle zero scalar", () => {
			expect(scale({ x: 5, y: 7 }, 0)).toEqual(ZERO);
		});

		it("should handle negative scalar", () => {
			expect(scale({ x: 2, y: 3 }, -1)).toEqual({ x: -2, y: -3 });
		});
	});

	describe("magnitude", () => {
		it("should compute magnitude of a 3-4-5 triangle", () => {
			expect(magnitude({ x: 3, y: 4 })).toBe(5);
		});

		it("should return 0 for zero vector", () => {
			expect(magnitude(ZERO)).toBe(0);
		});

		it("should handle unit vectors", () => {
			expect(magnitude({ x: 1, y: 0 })).toBe(1);
			expect(magnitude({ x: 0, y: 1 })).toBe(1);
		});
	});

	describe("magnitudeSquared", () => {
		it("should compute squared magnitude without sqrt", () => {
			expect(magnitudeSquared({ x: 3, y: 4 })).toBe(25);
		});
	});

	describe("normalize", () => {
		it("should normalize to unit length", () => {
			const result = normalize({ x: 3, y: 4 });
			expect(result.x).toBeCloseTo(0.6);
			expect(result.y).toBeCloseTo(0.8);
			expect(magnitude(result)).toBeCloseTo(1);
		});

		it("should return zero vector when normalizing zero vector", () => {
			expect(normalize(ZERO)).toEqual(ZERO);
		});

		it("should preserve direction", () => {
			const result = normalize({ x: -6, y: 8 });
			expect(result.x).toBeCloseTo(-0.6);
			expect(result.y).toBeCloseTo(0.8);
		});
	});

	describe("dot", () => {
		it("should compute dot product", () => {
			expect(dot({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
		});

		it("should return 0 for perpendicular vectors", () => {
			expect(dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
		});

		it("should return negative for opposing vectors", () => {
			expect(dot({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe(-1);
		});
	});

	describe("distance", () => {
		it("should compute distance between two points", () => {
			expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
		});

		it("should return 0 for same point", () => {
			const p = { x: 5, y: 7 };
			expect(distance(p, p)).toBe(0);
		});

		it("should be commutative", () => {
			const a = { x: 1, y: 2 };
			const b = { x: 4, y: 6 };
			expect(distance(a, b)).toBe(distance(b, a));
		});
	});

	describe("rotate", () => {
		it("should rotate by 90 degrees (π/2)", () => {
			const result = rotate({ x: 1, y: 0 }, Math.PI / 2);
			expect(result.x).toBeCloseTo(0);
			expect(result.y).toBeCloseTo(1);
		});

		it("should rotate by 180 degrees (π)", () => {
			const result = rotate({ x: 1, y: 0 }, Math.PI);
			expect(result.x).toBeCloseTo(-1);
			expect(result.y).toBeCloseTo(0);
		});

		it("should return to original after full rotation (2π)", () => {
			const original = { x: 3, y: 4 };
			const result = rotate(original, 2 * Math.PI);
			expect(result.x).toBeCloseTo(original.x);
			expect(result.y).toBeCloseTo(original.y);
		});

		it("should preserve magnitude", () => {
			const v = { x: 3, y: 4 };
			const rotated = rotate(v, 1.23);
			expect(magnitude(rotated)).toBeCloseTo(magnitude(v));
		});

		it("should handle zero angle (identity)", () => {
			const v = { x: 5, y: 7 };
			const result = rotate(v, 0);
			expect(result.x).toBeCloseTo(v.x);
			expect(result.y).toBeCloseTo(v.y);
		});
	});
});
