import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameSettings, SandboxSave } from "@/types";
import {
	loadSandboxSaves,
	loadSettings,
	saveSandboxSaves,
	saveSettings,
} from "@/utils/Storage";

// ── localStorage mock ────────────────────────────────────────────────────────
// Vitest runs in Node where localStorage is not available. We install a
// minimal in-memory implementation that matches the browser Web Storage API.

const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string): string | null => store[key] ?? null,
		setItem: (key: string, value: string): void => {
			store[key] = value;
		},
		removeItem: (key: string): void => {
			delete store[key];
		},
		clear: (): void => {
			store = {};
		},
	};
})();

beforeEach(() => {
	Object.defineProperty(globalThis, "localStorage", {
		value: localStorageMock,
		writable: true,
		configurable: true,
	});
	localStorageMock.clear();
});

afterEach(() => {
	localStorageMock.clear();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSave(id: string, name: string): SandboxSave {
	return {
		id,
		name,
		savedAt: Date.now(),
		bodies: [
			{
				id: "body-0",
				mass: 5.972e24,
				radius: 6,
				position: { x: 0.5, y: 0 },
				velocity: { x: 0, y: 1.99e-7 },
				isFixed: false,
				color: "#4488FF",
				shape: "circle",
			},
		],
	};
}

describe("loadSandboxSaves / saveSandboxSaves", () => {
	it("returns empty array when localStorage is empty", () => {
		const saves = loadSandboxSaves();
		expect(saves).toEqual([]);
	});

	it("round-trips a single save correctly", () => {
		const save = makeSave("save-1", "My first sandbox");
		saveSandboxSaves([save]);

		const loaded = loadSandboxSaves();
		expect(loaded).toHaveLength(1);
		expect(loaded[0]?.id).toBe("save-1");
		expect(loaded[0]?.name).toBe("My first sandbox");
		expect(loaded[0]?.bodies).toHaveLength(1);
		expect(loaded[0]?.bodies[0]?.position).toEqual({ x: 0.5, y: 0 });
	});

	it("returns empty array when localStorage contains corrupt JSON", () => {
		localStorage.setItem("orbit_sandbox", "{not valid json}}}");
		const saves = loadSandboxSaves();
		expect(saves).toEqual([]);
	});

	it("accumulates multiple saves correctly", () => {
		const first = makeSave("save-a", "Alpha");
		const second = makeSave("save-b", "Beta");
		const third = makeSave("save-c", "Gamma");

		saveSandboxSaves([first]);
		// Simulate a second save being appended as the real code does
		const existing = loadSandboxSaves();
		existing.push(second);
		saveSandboxSaves(existing);
		const afterTwo = loadSandboxSaves();
		afterTwo.push(third);
		saveSandboxSaves(afterTwo);

		const final = loadSandboxSaves();
		expect(final).toHaveLength(3);
		expect(final.map((s) => s.name)).toEqual(["Alpha", "Beta", "Gamma"]);
	});
});

describe("loadSettings / saveSettings", () => {
	it("returns default settings when localStorage is empty", () => {
		const settings = loadSettings();
		expect(settings.showOrbitalData).toBe(false);
		expect(settings.showGravityField).toBe(false);
		expect(settings.showTrails).toBe(true);
		expect(settings.trailPersistence).toBe(false);
		expect(settings.audioEnabled).toBe(false);
		expect(settings.colorblindMode).toBe(false);
	});

	it("round-trips custom settings correctly", () => {
		const custom: GameSettings = {
			showOrbitalData: true,
			showGravityField: true,
			showTrails: false,
			trailPersistence: true,
			audioEnabled: false,
			colorblindMode: true,
		};
		saveSettings(custom);

		const loaded = loadSettings();
		expect(loaded).toEqual(custom);
	});

	it("merges partial stored settings with defaults", () => {
		// Simulate a partial settings object in storage (e.g., from an older version)
		localStorage.setItem(
			"orbit_settings",
			JSON.stringify({ showTrails: false }),
		);

		const loaded = loadSettings();
		// Overridden value from storage
		expect(loaded.showTrails).toBe(false);
		// All other fields fall back to defaults
		expect(loaded.showOrbitalData).toBe(false);
		expect(loaded.trailPersistence).toBe(false);
	});

	it("returns defaults when localStorage contains corrupt JSON", () => {
		localStorage.setItem("orbit_settings", "not json at all");
		const loaded = loadSettings();
		expect(loaded.showTrails).toBe(true);
		expect(loaded.showOrbitalData).toBe(false);
	});
});
