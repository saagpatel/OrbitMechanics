import type { GameSettings, SandboxSave } from "@/types";

const SANDBOX_KEY = "orbit_sandbox";
const SETTINGS_KEY = "orbit_settings";

const DEFAULT_SETTINGS: GameSettings = {
	showOrbitalData: false,
	showGravityField: false,
	showTrails: true,
	trailPersistence: false,
	audioEnabled: false,
	colorblindMode: false,
};

export function loadSandboxSaves(): SandboxSave[] {
	try {
		const raw = localStorage.getItem(SANDBOX_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as SandboxSave[];
	} catch {
		return [];
	}
}

export function saveSandboxSaves(saves: SandboxSave[]): void {
	try {
		localStorage.setItem(SANDBOX_KEY, JSON.stringify(saves));
	} catch {
		// Storage quota exceeded or unavailable — silently ignore
	}
}

export function loadSettings(): GameSettings {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		return {
			...DEFAULT_SETTINGS,
			...(JSON.parse(raw) as Partial<GameSettings>),
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveSettings(settings: GameSettings): void {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
	} catch {
		// Storage quota exceeded or unavailable — silently ignore
	}
}
