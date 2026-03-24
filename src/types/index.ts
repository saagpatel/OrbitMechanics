// ─── Physics ────────────────────────────────────────────────────────────────

export interface Vector2 {
	x: number;
	y: number;
}

export interface Body {
	id: string;
	mass: number; // kg
	radius: number; // display pixels (sqrt-proportional to mass for visibility)
	position: Vector2; // AU
	velocity: Vector2; // AU/s
	isFixed: boolean; // true = anchor body (star/planet); ignores forces
	color: string; // hex string
	shape: "circle" | "triangle" | "diamond" | "square"; // for colorblind mode
	label?: string;
	trailPoints: Vector2[]; // ring buffer; capped at trailMaxLength
	trailMaxLength: number;
}

export interface SimulationState {
	bodies: Body[];
	time: number; // simulation seconds elapsed
	timeScale: number; // 0.1 | 1 | 5 | 20
	isPaused: boolean;
	isCommitted: boolean; // false = still drawing vector; true = sim running
	burnCount: number; // total burns committed this level
	fuelUsed: number; // total delta-v magnitude used (AU/s units)
	fuelBudget: number | null; // null = unlimited (Act 1)
}

export interface OrbitalElements {
	semiMajorAxis: number; // AU
	eccentricity: number; // 0 = circular, 1 = parabolic, >1 = hyperbolic
	period: number; // simulation seconds (Infinity for parabolic/hyperbolic)
	specificOrbitalEnergy: number; // J/kg equivalent — negative = bound orbit
	isEscaping: boolean; // specificOrbitalEnergy >= 0
	isRetrograde: boolean; // angular momentum h < 0 (clockwise in +Y-up system)
}

export interface TrajectoryPoint {
	position: Vector2;
	time: number;
}

// ─── Level System ────────────────────────────────────────────────────────────

export type WinConditionType =
	| "stable_orbit"
	| "rendezvous"
	| "escape_velocity"
	| "lagrange_station"
	| "orbital_resonance";

export interface WinCondition {
	type: WinConditionType;
	bodyId?: string;
	targetBodyId?: string;
	targetEccentricity?: number;
	eccentricityTolerance?: number;
	targetSemiMajorAxis?: number;
	semiMajorAxisTolerance?: number;
	proximityDistance?: number;
	relativeVelocityMax?: number;
	holdDuration?: number;
	lagrangePoint?: "L4" | "L5";
	resonanceRatio?: [number, number];
	resonanceTolerance?: number;
	checkWindowTicks?: number;
	orbitDirection?: "prograde" | "retrograde";
}

export interface AvailableBody {
	mass: number;
	label?: string;
	color?: string;
}

export interface LevelConfig {
	id: string; // "act1-01"
	act: 1 | 2 | 3 | 4;
	levelNumber: number; // 1–30
	title: string;
	description: string;
	fixedBodies: Array<Omit<Body, "trailPoints" | "trailMaxLength">>;
	availableBodies: AvailableBody[];
	winConditions: WinCondition[];
	failConditions?: WinCondition[];
	parBurnCount: number;
	maxBurnCount?: number;
	fuelBudget?: number;
	viewportBounds: {
		minX: number;
		maxX: number;
		minY: number;
		maxY: number; // AU
	};
	hintText?: string;
}

export interface LevelProgress {
	levelId: string;
	completed: boolean;
	bestBurnCount: number;
	stars: 1 | 2 | 3;
	completedAt: number; // unix timestamp ms
}

// ─── Input State ──────────────────────────────────────────────────────────────

export type DrawPhase =
	| "idle"
	| "selecting_body"
	| "drawing_vector"
	| "committed";

export interface VectorDrawState {
	phase: DrawPhase;
	selectedBodyId: string | null;
	startPoint: Vector2 | null; // screen coords at drag start
	currentPoint: Vector2 | null; // live mouse position (screen coords)
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface GameSettings {
	showOrbitalData: boolean;
	showGravityField: boolean;
	showTrails: boolean;
	trailPersistence: boolean;
	audioEnabled: boolean;
	colorblindMode: boolean;
}

// ─── Sandbox ─────────────────────────────────────────────────────────────────

export interface SandboxSave {
	id: string;
	name: string;
	bodies: Array<Omit<Body, "trailPoints" | "trailMaxLength">>;
	savedAt: number; // unix timestamp ms
}
