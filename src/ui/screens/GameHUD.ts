const FONT_STACK = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";
const TIME_SCALES: ReadonlyArray<number> = [0.1, 1, 5, 20];

interface HUDState {
	levelTitle: string;
	burnCount: number;
	parBurnCount: number;
	timeScale: number;
	isPaused: boolean;
	fuelUsed: number;
	fuelBudget: number | null;
}

function applyBaseStyle(
	el: HTMLElement,
	extra: Partial<CSSStyleDeclaration> = {},
): void {
	el.style.fontFamily = FONT_STACK;
	el.style.color = "#ffffff";
	el.style.fontSize = "13px";
	Object.assign(el.style, extra);
}

function makeButton(label: string): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.textContent = label;
	btn.style.height = "32px";
	btn.style.padding = "0 12px";
	btn.style.background = "rgba(255,255,255,0.08)";
	btn.style.border = "1px solid rgba(255,255,255,0.15)";
	btn.style.borderRadius = "4px";
	btn.style.color = "#ffffff";
	btn.style.fontFamily = FONT_STACK;
	btn.style.fontSize = "13px";
	btn.style.cursor = "pointer";
	btn.style.pointerEvents = "auto";
	btn.style.lineHeight = "1";
	btn.style.transition = "background 120ms ease, border-color 120ms ease";
	return btn;
}

export class GameHUD {
	private readonly container: HTMLDivElement;
	private readonly topBar: HTMLDivElement;
	private readonly bottomBar: HTMLDivElement;
	private readonly titleEl: HTMLSpanElement;
	private readonly pauseBtn: HTMLButtonElement;
	private readonly restartBtn: HTMLButtonElement;
	private readonly burnsEl: HTMLSpanElement;
	private readonly fuelContainer: HTMLDivElement;
	private readonly fuelBarFill: HTMLDivElement;
	private readonly fuelLabel: HTMLSpanElement;
	private readonly timeButtons: Map<number, HTMLButtonElement> = new Map();
	private readonly hintBanner: HTMLDivElement;
	private readonly hintText: HTMLSpanElement;

	private restartCb: (() => void) | null = null;
	private pauseCb: (() => void) | null = null;
	private timeScaleCb: ((scale: number) => void) | null = null;

	// dirty-check cache
	private lastTitle = "";
	private lastBurnCount = -1;
	private lastParBurnCount = -1;
	private lastTimeScale = -1;
	private lastIsPaused: boolean | null = null;
	private lastFuelUsed = -1;
	private lastFuelBudget: number | null = null;

	constructor() {
		this.container = document.createElement("div");
		this.container.style.position = "absolute";
		this.container.style.inset = "0";
		this.container.style.pointerEvents = "none";
		this.container.style.zIndex = "10";
		this.container.style.display = "flex";
		this.container.style.flexDirection = "column";
		this.container.style.justifyContent = "space-between";

		// ── Top bar ──────────────────────────────────────────────────────────
		this.topBar = document.createElement("div");
		this.topBar.style.display = "flex";
		this.topBar.style.alignItems = "center";
		this.topBar.style.justifyContent = "space-between";
		this.topBar.style.padding = "12px 16px";
		this.topBar.style.background =
			"linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)";

		this.titleEl = document.createElement("span");
		applyBaseStyle(this.titleEl, {
			fontSize: "14px",
			fontWeight: "300",
			letterSpacing: "0.06em",
		});

		const topRight = document.createElement("div");
		topRight.style.display = "flex";
		topRight.style.gap = "8px";
		topRight.style.pointerEvents = "auto";

		this.restartBtn = makeButton("⟳");
		this.restartBtn.title = "Restart level";
		this.restartBtn.addEventListener("click", () => {
			this.restartCb?.();
		});

		this.pauseBtn = makeButton("⏸");
		this.pauseBtn.title = "Pause / Resume";
		this.pauseBtn.addEventListener("click", () => {
			this.pauseCb?.();
		});

		topRight.appendChild(this.restartBtn);
		topRight.appendChild(this.pauseBtn);

		this.topBar.appendChild(this.titleEl);
		this.topBar.appendChild(topRight);

		// ── Bottom bar ───────────────────────────────────────────────────────
		this.bottomBar = document.createElement("div");
		this.bottomBar.style.display = "flex";
		this.bottomBar.style.alignItems = "center";
		this.bottomBar.style.justifyContent = "space-between";
		this.bottomBar.style.padding = "12px 16px";
		this.bottomBar.style.background =
			"linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)";

		this.burnsEl = document.createElement("span");
		applyBaseStyle(this.burnsEl, { letterSpacing: "0.04em" });

		// Fuel gauge (hidden when no budget)
		this.fuelContainer = document.createElement("div");
		this.fuelContainer.style.display = "none";
		this.fuelContainer.style.flexDirection = "row";
		this.fuelContainer.style.gap = "8px";
		this.fuelContainer.style.alignItems = "center";

		const fuelBar = document.createElement("div");
		fuelBar.style.width = "120px";
		fuelBar.style.height = "8px";
		fuelBar.style.borderRadius = "4px";
		fuelBar.style.background = "rgba(255,255,255,0.1)";
		fuelBar.style.overflow = "hidden";

		this.fuelBarFill = document.createElement("div");
		this.fuelBarFill.style.height = "100%";
		this.fuelBarFill.style.borderRadius = "4px";
		this.fuelBarFill.style.width = "100%";
		this.fuelBarFill.style.background = "#44DDFF";
		this.fuelBarFill.style.transition =
			"width 200ms ease, background 200ms ease";

		fuelBar.appendChild(this.fuelBarFill);

		this.fuelLabel = document.createElement("span");
		applyBaseStyle(this.fuelLabel, {
			fontSize: "12px",
			color: "rgba(255,255,255,0.5)",
		});
		this.fuelLabel.textContent = "Fuel 100%";

		this.fuelContainer.appendChild(fuelBar);
		this.fuelContainer.appendChild(this.fuelLabel);

		const timeControls = document.createElement("div");
		timeControls.style.display = "flex";
		timeControls.style.gap = "6px";
		timeControls.style.pointerEvents = "auto";

		for (const scale of TIME_SCALES) {
			const label = scale === 0.1 ? ".1×" : `${scale}×`;
			const btn = makeButton(label);
			btn.addEventListener("click", () => {
				this.timeScaleCb?.(scale);
			});
			this.timeButtons.set(scale, btn);
			timeControls.appendChild(btn);
		}

		this.bottomBar.appendChild(this.burnsEl);
		this.bottomBar.appendChild(this.fuelContainer);
		this.bottomBar.appendChild(timeControls);

		this.container.appendChild(this.topBar);
		this.container.appendChild(this.bottomBar);

		// ── Hint banner ──────────────────────────────────────────────────────
		this.hintBanner = document.createElement("div");
		this.hintBanner.style.position = "absolute";
		this.hintBanner.style.top = "56px";
		this.hintBanner.style.left = "50%";
		this.hintBanner.style.transform = "translateX(-50%)";
		this.hintBanner.style.maxWidth = "480px";
		this.hintBanner.style.padding = "12px 16px";
		this.hintBanner.style.background = "rgba(68,136,255,0.12)";
		this.hintBanner.style.border = "1px solid rgba(68,136,255,0.25)";
		this.hintBanner.style.borderRadius = "6px";
		this.hintBanner.style.display = "none";
		this.hintBanner.style.flexDirection = "row";
		this.hintBanner.style.alignItems = "center";
		this.hintBanner.style.gap = "10px";
		this.hintBanner.style.pointerEvents = "auto";

		const hintIcon = document.createElement("span");
		hintIcon.textContent = "💡";

		this.hintText = document.createElement("span");
		applyBaseStyle(this.hintText, {
			fontSize: "13px",
			color: "rgba(255,255,255,0.8)",
		});

		const dismissBtn = document.createElement("button");
		dismissBtn.textContent = "×";
		dismissBtn.style.background = "none";
		dismissBtn.style.border = "none";
		dismissBtn.style.color = "rgba(255,255,255,0.6)";
		dismissBtn.style.fontFamily = FONT_STACK;
		dismissBtn.style.fontSize = "18px";
		dismissBtn.style.lineHeight = "1";
		dismissBtn.style.cursor = "pointer";
		dismissBtn.style.padding = "0 0 0 4px";
		dismissBtn.style.flexShrink = "0";
		dismissBtn.addEventListener("click", () => this.hideHint());

		this.hintBanner.appendChild(hintIcon);
		this.hintBanner.appendChild(this.hintText);
		this.hintBanner.appendChild(dismissBtn);
		this.container.appendChild(this.hintBanner);

		document.body.appendChild(this.container);
	}

	update(state: HUDState): void {
		if (state.levelTitle !== this.lastTitle) {
			this.titleEl.textContent = state.levelTitle;
			this.lastTitle = state.levelTitle;
		}

		if (
			state.burnCount !== this.lastBurnCount ||
			state.parBurnCount !== this.lastParBurnCount
		) {
			this.burnsEl.textContent = `Burns: ${state.burnCount} / par ${state.parBurnCount}`;
			this.lastBurnCount = state.burnCount;
			this.lastParBurnCount = state.parBurnCount;
		}

		if (state.isPaused !== this.lastIsPaused) {
			this.pauseBtn.textContent = state.isPaused ? "▶" : "⏸";
			this.lastIsPaused = state.isPaused;
		}

		if (state.timeScale !== this.lastTimeScale) {
			for (const [scale, btn] of this.timeButtons) {
				const active = scale === state.timeScale;
				btn.style.background = active
					? "rgba(255,255,255,0.2)"
					: "rgba(255,255,255,0.08)";
				btn.style.borderColor = active
					? "rgba(255,255,255,0.4)"
					: "rgba(255,255,255,0.15)";
				btn.style.color = "#ffffff";
			}
			this.lastTimeScale = state.timeScale;
		}

		if (
			state.fuelUsed !== this.lastFuelUsed ||
			state.fuelBudget !== this.lastFuelBudget
		) {
			if (state.fuelBudget === null) {
				this.fuelContainer.style.display = "none";
			} else {
				this.fuelContainer.style.display = "flex";
				const remaining = Math.max(0, 1 - state.fuelUsed / state.fuelBudget);
				this.fuelBarFill.style.width = `${remaining * 100}%`;
				const color =
					remaining > 0.4 ? "#44DDFF" : remaining > 0.2 ? "#FFAA00" : "#FF4444";
				this.fuelBarFill.style.background = color;
				this.fuelLabel.textContent = `Fuel ${Math.round(remaining * 100)}%`;
			}
			this.lastFuelUsed = state.fuelUsed;
			this.lastFuelBudget = state.fuelBudget;
		}
	}

	onRestart(cb: () => void): void {
		this.restartCb = cb;
	}

	onPause(cb: () => void): void {
		this.pauseCb = cb;
	}

	onTimeScaleChange(cb: (scale: number) => void): void {
		this.timeScaleCb = cb;
	}

	showHint(text: string): void {
		this.hintText.textContent = text;
		this.hintBanner.style.display = "flex";
	}

	hideHint(): void {
		this.hintBanner.style.display = "none";
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
}
