import { describe, expect, it } from "vitest";
import {
	EARTH_ORBITAL_VELOCITY,
	G_AU,
	SOLAR_MASS_KG,
} from "@/simulation/PhysicsConstants";

describe("PhysicsConstants", () => {
	it("should compute Earth orbital velocity at 1 AU as ~1.99e-7 AU/s", () => {
		const v = Math.sqrt((G_AU * SOLAR_MASS_KG) / 1.0);

		// 29.78 km/s in AU/s = 29780 / 1.496e8 ≈ 1.991e-7
		expect(v).toBeCloseTo(1.991e-7, 10); // 10 significant digits
		expect(EARTH_ORBITAL_VELOCITY).toBe(v);
	});

	it("should compute Earth orbital period at 1 AU as ~365.25 days", () => {
		const r = 1.0; // AU
		const v = Math.sqrt((G_AU * SOLAR_MASS_KG) / r);
		const circumference = 2 * Math.PI * r; // AU
		const period = circumference / v; // seconds
		const periodDays = period / 86400;

		// Should be close to 365.25 days (within 1%)
		expect(periodDays).toBeGreaterThan(360);
		expect(periodDays).toBeLessThan(370);
	});
});
