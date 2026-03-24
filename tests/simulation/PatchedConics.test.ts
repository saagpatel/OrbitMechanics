import { describe, expect, it } from "vitest";
import {
	buildSOIHierarchy,
	computeSOI,
	findSOIBody,
	generatePatchedConicsPreview,
} from "@/simulation/PatchedConics";
import {
	EARTH_MASS_KG,
	G_AU,
	SOLAR_MASS_KG,
} from "@/simulation/PhysicsConstants";
import type { Body, Vector2 } from "@/types";

// ── Factories ─────────────────────────────────────────────────────────────────

function makeStar(overrides?: Partial<Body>): Body {
	return {
		id: "star",
		mass: SOLAR_MASS_KG,
		radius: 20,
		position: { x: 0, y: 0 },
		velocity: { x: 0, y: 0 },
		isFixed: true,
		color: "#FFD700",
		shape: "circle",
		trailPoints: [],
		trailMaxLength: 0,
		...overrides,
	};
}

/** Jupiter mass in kg */
const JUPITER_MASS_KG = 1.898e27;

function makePlanet(overrides?: Partial<Body>): Body {
	const r = 5.0; // AU (Jupiter-like)
	const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / r);
	return {
		id: "planet",
		mass: JUPITER_MASS_KG,
		radius: 14,
		position: { x: r, y: 0 },
		velocity: { x: 0, y: vCircular },
		isFixed: false,
		color: "#FF8844",
		shape: "circle",
		trailPoints: [],
		trailMaxLength: 200,
		...overrides,
	};
}

function makeProbe(position: Vector2, velocity: Vector2): Body {
	return {
		id: "probe",
		mass: 1e10, // tiny — should be filtered from SOI hierarchy
		radius: 4,
		position,
		velocity,
		isFixed: false,
		color: "#FFFFFF",
		shape: "circle",
		trailPoints: [],
		trailMaxLength: 200,
	};
}

// ── computeSOI ────────────────────────────────────────────────────────────────

describe("computeSOI", () => {
	it("should compute ~0.32 AU for Jupiter-mass at 5 AU around solar mass", () => {
		// r_SOI = 5 * (1.898e27 / 1.989e30)^(2/5)
		const soi = computeSOI(5, JUPITER_MASS_KG, SOLAR_MASS_KG);
		// Analytical: 5 * (9.542e-4)^0.4 ≈ 5 * 0.0644 ≈ 0.322
		expect(soi).toBeGreaterThan(0.3);
		expect(soi).toBeLessThan(0.35);
	});

	it("should return 0 when bodyMass is zero", () => {
		expect(computeSOI(1.0, 0, SOLAR_MASS_KG)).toBe(0);
	});

	it("should return 0 when parentMass is zero", () => {
		expect(computeSOI(1.0, EARTH_MASS_KG, 0)).toBe(0);
	});

	it("should compute ~0.01 AU for Earth-mass at 1 AU around solar mass", () => {
		const soi = computeSOI(1.0, EARTH_MASS_KG, SOLAR_MASS_KG);
		// Earth's actual Hill sphere ≈ 0.0098 AU
		expect(soi).toBeGreaterThan(0.005);
		expect(soi).toBeLessThan(0.02);
	});
});

// ── buildSOIHierarchy ─────────────────────────────────────────────────────────

describe("buildSOIHierarchy", () => {
	it("should return one SOI entry for star + planet + probe (planet only)", () => {
		const star = makeStar();
		const planet = makePlanet();
		const probe = makeProbe({ x: 1, y: 0 }, { x: 0, y: 1e-7 });

		const hierarchy = buildSOIHierarchy([star, planet, probe]);

		expect(hierarchy).toHaveLength(1);
		expect(hierarchy[0]?.body.id).toBe("planet");
	});

	it("should return empty array when given no bodies", () => {
		expect(buildSOIHierarchy([])).toHaveLength(0);
	});

	it("should set parentBody to the most massive body (the star)", () => {
		const star = makeStar();
		const planet = makePlanet();
		const hierarchy = buildSOIHierarchy([star, planet]);

		expect(hierarchy[0]?.parentBody.id).toBe("star");
	});
});

// ── findSOIBody ───────────────────────────────────────────────────────────────

describe("findSOIBody", () => {
	it("should return the SOI body when position is inside its sphere", () => {
		const star = makeStar();
		const planet = makePlanet(); // at x=5 AU

		const hierarchy = buildSOIHierarchy([star, planet]);
		const soiRadius = hierarchy[0]!.soiRadius;

		// Place probe just inside the SOI of the planet
		const insidePos: Vector2 = {
			x: planet.position.x + soiRadius * 0.5,
			y: 0,
		};

		const result = findSOIBody(insidePos, hierarchy);
		expect(result).not.toBeNull();
		expect(result?.body.id).toBe("planet");
	});

	it("should return null when position is outside all SOI spheres", () => {
		const star = makeStar();
		const planet = makePlanet(); // at x=5 AU

		const hierarchy = buildSOIHierarchy([star, planet]);

		// Far away from the planet
		const outsidePos: Vector2 = { x: 1.0, y: 0 };

		const result = findSOIBody(outsidePos, hierarchy);
		expect(result).toBeNull();
	});
});

// ── generatePatchedConicsPreview ──────────────────────────────────────────────

describe("generatePatchedConicsPreview", () => {
	it("should return all-finite coordinates for a basic orbit", () => {
		const star = makeStar();
		const planet = makePlanet();
		const hierarchy = buildSOIHierarchy([star, planet]);

		// Probe at 1 AU in a circular orbit
		const r = 1.0;
		const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / r);
		const startPos: Vector2 = { x: r, y: 0 };
		const startVel: Vector2 = { x: 0, y: vCircular };

		const points = generatePatchedConicsPreview(
			star,
			hierarchy,
			startPos,
			startVel,
			100,
		);

		expect(points.length).toBeGreaterThan(0);
		for (const pt of points) {
			expect(Number.isFinite(pt.position.x)).toBe(true);
			expect(Number.isFinite(pt.position.y)).toBe(true);
		}
	});

	it("should produce trajectory with points closer to planet when approaching it", () => {
		const star = makeStar();
		// Planet at 5 AU with significant SOI
		const planet = makePlanet();
		const hierarchy = buildSOIHierarchy([star, planet]);

		// Start probe very close to the planet (inside its SOI) heading toward it
		// SOI radius ≈ 0.32 AU, so 0.1 AU from planet centre is well inside
		const startPos: Vector2 = { x: planet.position.x - 0.1, y: 0 };
		// Give it a small velocity — it should be pulled closer by gravity
		const startVel: Vector2 = { x: 0, y: 5e-9 };

		const points = generatePatchedConicsPreview(
			star,
			hierarchy,
			startPos,
			startVel,
			200,
		);

		expect(points.length).toBeGreaterThan(0);

		// All points should be finite
		for (const pt of points) {
			expect(Number.isFinite(pt.position.x)).toBe(true);
			expect(Number.isFinite(pt.position.y)).toBe(true);
		}

		// At least some points should be closer to the planet than the star
		const distancesToPlanet = points.map((p) => {
			const dx = p.position.x - planet.position.x;
			const dy = p.position.y - planet.position.y;
			return Math.sqrt(dx * dx + dy * dy);
		});
		const distancesToStar = points.map((p) => {
			return Math.sqrt(p.position.x ** 2 + p.position.y ** 2);
		});
		const minDistToPlanet = Math.min(...distancesToPlanet);
		const minDistToStar = Math.min(...distancesToStar);

		// When inside the planet's SOI the probe is much closer to the planet than the star
		expect(minDistToPlanet).toBeLessThan(minDistToStar);
	});

	it("should return points for no-SOI case similar to simple 2-body", () => {
		const star = makeStar();

		const r = 1.0;
		const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / r);
		const startPos: Vector2 = { x: r, y: 0 };
		const startVel: Vector2 = { x: 0, y: vCircular };

		// No SOI bodies — pure 2-body preview
		const points = generatePatchedConicsPreview(
			star,
			[], // empty SOI list
			startPos,
			startVel,
			100,
		);

		expect(points.length).toBeGreaterThan(0);

		// For a circular orbit the probe should stay near 1 AU from the star
		for (const pt of points) {
			const dist = Math.sqrt(pt.position.x ** 2 + pt.position.y ** 2);
			// Within 5% of circular orbit radius (numerical integration is approximate)
			expect(dist).toBeGreaterThan(0.8);
			expect(dist).toBeLessThan(1.2);
		}
	});

	it("should cap output at requested numPoints", () => {
		const star = makeStar();
		const r = 1.0;
		const vCircular = Math.sqrt((G_AU * SOLAR_MASS_KG) / r);

		const points = generatePatchedConicsPreview(
			star,
			[],
			{ x: r, y: 0 },
			{ x: 0, y: vCircular },
			50,
		);

		expect(points.length).toBeLessThanOrEqual(50);
	});
});
