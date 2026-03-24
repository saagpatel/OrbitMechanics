import type { GameSettings, SandboxSave } from "@/types";

const FONT_STACK = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

const COLOR_PALETTE = [
	"#4488FF",
	"#44DDFF",
	"#FF6644",
	"#FF4444",
	"#FFAA00",
	"#44FF88",
	"#FF44DD",
	"#FFFFFF",
] as const;

const TIME_SCALES = [0.1, 1, 5, 20] as const;

function applyBaseStyle(el: HTMLElement): void {
	el.style.fontFamily = FONT_STACK;
	el.style.color = "#ffffff";
	el.style.fontSize = "13px";
}

function makeButton(label: string, title?: string): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.textContent = label;
	if (title) btn.title = title;
	btn.style.height = "32px";
	btn.style.padding = "0 10px";
	btn.style.background = "rgba(255,255,255,0.08)";
	btn.style.border = "1px solid rgba(255,255,255,0.15)";
	btn.style.borderRadius = "4px";
	btn.style.color = "#ffffff";
	btn.style.fontFamily = FONT_STACK;
	btn.style.fontSize = "13px";
	btn.style.cursor = "pointer";
	btn.style.lineHeight = "1";
	btn.style.transition = "background 120ms ease, border-color 120ms ease";
	btn.style.whiteSpace = "nowrap";
	return btn;
}

function makeDivider(): HTMLDivElement {
	const div = document.createElement("div");
	div.style.width = "1px";
	div.style.alignSelf = "stretch";
	div.style.background = "rgba(255,255,255,0.12)";
	div.style.margin = "0 4px";
	return div;
}

export class SandboxUI {
	private readonly container: HTMLDivElement;

	// Mode buttons
	private readonly addBtn: HTMLButtonElement;
	private readonly deleteBtn: HTMLButtonElement;
	private readonly clearBtn: HTMLButtonElement;

	// Mass slider
	private readonly massSlider: HTMLInputElement;
	private readonly massLabel: HTMLSpanElement;

	// Color swatches
	private readonly swatches: HTMLDivElement[] = [];
	private activeColor: string = COLOR_PALETTE[0];

	// Save/load
	private readonly saveBtn: HTMLButtonElement;
	private readonly loadSelect: HTMLSelectElement;

	// Settings toggles
	private readonly trailsBtn: HTMLButtonElement;
	private readonly persistBtn: HTMLButtonElement;
	private readonly orbitsBtn: HTMLButtonElement;
	private readonly gravityBtn: HTMLButtonElement;

	// Time controls
	private readonly timeButtons: Map<number, HTMLButtonElement> = new Map();
	private readonly pauseBtn: HTMLButtonElement;

	// Exit
	private readonly exitBtn: HTMLButtonElement;

	// Callbacks
	private modeCb: ((mode: "place" | "delete" | "observe") => void) | null =
		null;
	private massCb: ((mass: number) => void) | null = null;
	private colorCb: ((color: string) => void) | null = null;
	private clearAllCb: (() => void) | null = null;
	private saveCb: (() => void) | null = null;
	private loadCb: ((saveId: string) => void) | null = null;
	private settingToggleCb:
		| ((setting: keyof GameSettings, value: boolean) => void)
		| null = null;
	private timeScaleCb: ((scale: number) => void) | null = null;
	private pauseCb: (() => void) | null = null;
	private exitCb: (() => void) | null = null;

	// Active mode tracking
	private activeMode: "place" | "delete" | "observe" = "place";

	constructor() {
		this.container = document.createElement("div");
		this.container.style.position = "fixed";
		this.container.style.top = "0";
		this.container.style.left = "0";
		this.container.style.right = "0";
		this.container.style.zIndex = "20";
		this.container.style.display = "none";
		this.container.style.flexWrap = "wrap";
		this.container.style.alignItems = "center";
		this.container.style.gap = "6px";
		this.container.style.padding = "8px 12px";
		this.container.style.background = "rgba(0,0,0,0.85)";
		this.container.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
		this.container.style.backdropFilter = "blur(8px)";
		applyBaseStyle(this.container);

		// ── Mode section ───────────────────────────────────────────────────
		this.addBtn = makeButton("Add Body", "Place a new body (click canvas)");
		this.deleteBtn = makeButton("Delete", "Click a body to remove it");
		this.clearBtn = makeButton("Clear All", "Remove all bodies");

		this.addBtn.addEventListener("click", () => this.setMode("place"));
		this.deleteBtn.addEventListener("click", () => this.setMode("delete"));
		this.clearBtn.addEventListener("click", () => this.clearAllCb?.());

		// Highlight Add as default active mode
		this.applyModeHighlight();

		// ── Mass slider section ────────────────────────────────────────────
		const massLabel = document.createElement("span");
		massLabel.textContent = "Mass:";
		massLabel.style.fontSize = "12px";
		massLabel.style.color = "rgba(255,255,255,0.6)";
		applyBaseStyle(massLabel);

		this.massSlider = document.createElement("input");
		this.massSlider.type = "range";
		this.massSlider.min = "15";
		this.massSlider.max = "30.3";
		this.massSlider.step = "0.1";
		this.massSlider.value = "24.776"; // log10(5.972e24) ≈ 24.776 (Earth mass)
		this.massSlider.style.width = "90px";
		this.massSlider.style.cursor = "pointer";
		this.massSlider.style.accentColor = "#4488FF";

		this.massLabel = document.createElement("span");
		this.massLabel.style.fontSize = "12px";
		this.massLabel.style.minWidth = "70px";
		this.massLabel.style.color = "rgba(255,255,255,0.8)";
		applyBaseStyle(this.massLabel);
		this.updateMassLabel(parseFloat(this.massSlider.value));

		this.massSlider.addEventListener("input", () => {
			const log10 = parseFloat(this.massSlider.value);
			this.updateMassLabel(log10);
			this.massCb?.(10 ** log10);
		});

		// ── Color palette section ──────────────────────────────────────────
		const paletteRow = document.createElement("div");
		paletteRow.style.display = "flex";
		paletteRow.style.gap = "4px";
		paletteRow.style.alignItems = "center";

		for (const color of COLOR_PALETTE) {
			const swatch = document.createElement("div");
			swatch.style.width = "20px";
			swatch.style.height = "20px";
			swatch.style.borderRadius = "3px";
			swatch.style.background = color;
			swatch.style.cursor = "pointer";
			swatch.style.border =
				color === this.activeColor
					? "2px solid #ffffff"
					: "2px solid transparent";
			swatch.style.transition = "border-color 100ms ease";
			swatch.title = color;
			swatch.addEventListener("click", () => {
				this.activeColor = color;
				this.updateSwatchHighlight();
				this.colorCb?.(color);
			});
			this.swatches.push(swatch);
			paletteRow.appendChild(swatch);
		}

		// ── Save/Load section ──────────────────────────────────────────────
		this.saveBtn = makeButton("Save", "Save current sandbox");
		this.saveBtn.addEventListener("click", () => this.saveCb?.());

		this.loadSelect = document.createElement("select");
		this.loadSelect.style.height = "32px";
		this.loadSelect.style.padding = "0 8px";
		this.loadSelect.style.background = "rgba(255,255,255,0.08)";
		this.loadSelect.style.border = "1px solid rgba(255,255,255,0.15)";
		this.loadSelect.style.borderRadius = "4px";
		this.loadSelect.style.color = "#ffffff";
		this.loadSelect.style.fontFamily = FONT_STACK;
		this.loadSelect.style.fontSize = "13px";
		this.loadSelect.style.cursor = "pointer";
		this.loadSelect.style.minWidth = "100px";
		applyBaseStyle(this.loadSelect);

		const defaultOption = document.createElement("option");
		defaultOption.textContent = "Load…";
		defaultOption.value = "";
		defaultOption.style.background = "#111111";
		this.loadSelect.appendChild(defaultOption);

		this.loadSelect.addEventListener("change", () => {
			const id = this.loadSelect.value;
			if (id) {
				this.loadCb?.(id);
				this.loadSelect.value = "";
			}
		});

		// ── Settings toggles ───────────────────────────────────────────────
		this.trailsBtn = makeButton("Trails", "Toggle body trails");
		this.persistBtn = makeButton("Persist", "Keep full trail history");
		this.orbitsBtn = makeButton("Orbits", "Show orbital data overlay");
		this.gravityBtn = makeButton("Gravity", "Show gravity field overlay");

		this.trailsBtn.addEventListener("click", () => {
			const next = !this.trailsBtn.dataset["active"];
			this.setToggle(this.trailsBtn, next);
			this.settingToggleCb?.("showTrails", next);
		});
		this.persistBtn.addEventListener("click", () => {
			const next = !this.persistBtn.dataset["active"];
			this.setToggle(this.persistBtn, next);
			this.settingToggleCb?.("trailPersistence", next);
		});
		this.orbitsBtn.addEventListener("click", () => {
			const next = !this.orbitsBtn.dataset["active"];
			this.setToggle(this.orbitsBtn, next);
			this.settingToggleCb?.("showOrbitalData", next);
		});
		this.gravityBtn.addEventListener("click", () => {
			const next = !this.gravityBtn.dataset["active"];
			this.setToggle(this.gravityBtn, next);
			this.settingToggleCb?.("showGravityField", next);
		});

		// ── Time controls ──────────────────────────────────────────────────
		for (const scale of TIME_SCALES) {
			const label = scale === 0.1 ? ".1×" : `${scale}×`;
			const btn = makeButton(label);
			btn.addEventListener("click", () => {
				this.timeScaleCb?.(scale);
				this.highlightTimeScale(scale);
			});
			this.timeButtons.set(scale, btn);
		}
		// Default: 1× active
		this.highlightTimeScale(1);

		this.pauseBtn = makeButton("⏸", "Pause / Resume");
		this.pauseBtn.addEventListener("click", () => this.pauseCb?.());

		// ── Exit ───────────────────────────────────────────────────────────
		this.exitBtn = makeButton("← Back", "Return to level select");
		this.exitBtn.style.marginLeft = "auto";
		this.exitBtn.addEventListener("click", () => this.exitCb?.());

		// ── Assemble toolbar ───────────────────────────────────────────────
		this.container.appendChild(this.addBtn);
		this.container.appendChild(this.deleteBtn);
		this.container.appendChild(this.clearBtn);
		this.container.appendChild(makeDivider());
		this.container.appendChild(massLabel);
		this.container.appendChild(this.massSlider);
		this.container.appendChild(this.massLabel);
		this.container.appendChild(makeDivider());
		this.container.appendChild(paletteRow);
		this.container.appendChild(makeDivider());
		this.container.appendChild(this.saveBtn);
		this.container.appendChild(this.loadSelect);
		this.container.appendChild(makeDivider());
		this.container.appendChild(this.trailsBtn);
		this.container.appendChild(this.persistBtn);
		this.container.appendChild(this.orbitsBtn);
		this.container.appendChild(this.gravityBtn);
		this.container.appendChild(makeDivider());
		for (const btn of this.timeButtons.values()) {
			this.container.appendChild(btn);
		}
		this.container.appendChild(this.pauseBtn);
		this.container.appendChild(this.exitBtn);

		document.body.appendChild(this.container);
	}

	show(): void {
		this.container.style.display = "flex";
	}

	hide(): void {
		this.container.style.display = "none";
	}

	destroy(): void {
		this.container.remove();
	}

	updateSaveList(saves: SandboxSave[]): void {
		// Remove all options except the placeholder
		while (this.loadSelect.options.length > 1) {
			this.loadSelect.remove(1);
		}

		for (const save of saves) {
			const option = document.createElement("option");
			option.value = save.id;
			option.textContent = save.name;
			option.style.background = "#111111";
			this.loadSelect.appendChild(option);
		}
	}

	updateSettings(settings: GameSettings): void {
		this.setToggle(this.trailsBtn, settings.showTrails);
		this.setToggle(this.persistBtn, settings.trailPersistence);
		this.setToggle(this.orbitsBtn, settings.showOrbitalData);
		this.setToggle(this.gravityBtn, settings.showGravityField);
	}

	onModeChange(cb: (mode: "place" | "delete" | "observe") => void): void {
		this.modeCb = cb;
	}

	onMassChange(cb: (mass: number) => void): void {
		this.massCb = cb;
	}

	onColorChange(cb: (color: string) => void): void {
		this.colorCb = cb;
	}

	onClearAll(cb: () => void): void {
		this.clearAllCb = cb;
	}

	onSave(cb: () => void): void {
		this.saveCb = cb;
	}

	onLoad(cb: (saveId: string) => void): void {
		this.loadCb = cb;
	}

	onSettingToggle(
		cb: (setting: keyof GameSettings, value: boolean) => void,
	): void {
		this.settingToggleCb = cb;
	}

	onTimeScaleChange(cb: (scale: number) => void): void {
		this.timeScaleCb = cb;
	}

	onPause(cb: () => void): void {
		this.pauseCb = cb;
	}

	onExit(cb: () => void): void {
		this.exitCb = cb;
	}

	// ── Private helpers ─────────────────────────────────────────────────────

	private setMode(mode: "place" | "delete" | "observe"): void {
		this.activeMode = mode;
		this.applyModeHighlight();
		this.modeCb?.(mode);
	}

	private applyModeHighlight(): void {
		const modes: Array<["place" | "delete" | "observe", HTMLButtonElement]> = [
			["place", this.addBtn],
			["delete", this.deleteBtn],
		];
		for (const [mode, btn] of modes) {
			const active = this.activeMode === mode;
			btn.style.background = active
				? "rgba(68,136,255,0.25)"
				: "rgba(255,255,255,0.08)";
			btn.style.borderColor = active
				? "rgba(68,136,255,0.6)"
				: "rgba(255,255,255,0.15)";
		}
	}

	private updateMassLabel(log10: number): void {
		const mass = 10 ** log10;
		// Format as scientific notation: 1.23e+24
		const exp = Math.floor(log10);
		const mantissa = mass / 10 ** exp;
		this.massLabel.textContent = `${mantissa.toFixed(2)}e${exp > 0 ? "+" : ""}${exp}`;
	}

	private updateSwatchHighlight(): void {
		for (let i = 0; i < COLOR_PALETTE.length; i++) {
			const swatch = this.swatches[i];
			if (!swatch) continue;
			swatch.style.border =
				COLOR_PALETTE[i] === this.activeColor
					? "2px solid #ffffff"
					: "2px solid transparent";
		}
	}

	private setToggle(btn: HTMLButtonElement, active: boolean): void {
		if (active) {
			btn.dataset["active"] = "1";
			btn.style.background = "rgba(255,255,255,0.2)";
			btn.style.borderColor = "rgba(255,255,255,0.4)";
		} else {
			delete btn.dataset["active"];
			btn.style.background = "rgba(255,255,255,0.08)";
			btn.style.borderColor = "rgba(255,255,255,0.15)";
		}
	}

	private highlightTimeScale(activeScale: number): void {
		for (const [scale, btn] of this.timeButtons) {
			const active = scale === activeScale;
			btn.style.background = active
				? "rgba(255,255,255,0.2)"
				: "rgba(255,255,255,0.08)";
			btn.style.borderColor = active
				? "rgba(255,255,255,0.4)"
				: "rgba(255,255,255,0.15)";
		}
	}
}
