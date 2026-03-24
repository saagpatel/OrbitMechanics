import type { GameSettings } from "@/types";

const FONT_STACK = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

function applyFont(el: HTMLElement): void {
	el.style.fontFamily = FONT_STACK;
	el.style.color = "#ffffff";
}

type SettingRow = {
	key: keyof GameSettings;
	label: string;
	disabled?: boolean;
};

const SETTING_ROWS: ReadonlyArray<SettingRow> = [
	{ key: "showOrbitalData", label: "Show Orbital Data" },
	{ key: "showGravityField", label: "Show Gravity Field" },
	{ key: "showTrails", label: "Show Trails" },
	{ key: "trailPersistence", label: "Trail Persistence" },
	{ key: "audioEnabled", label: "Audio", disabled: true },
	{ key: "colorblindMode", label: "Colorblind Mode" },
];

function makeToggle(disabled: boolean): {
	wrapper: HTMLLabelElement;
	input: HTMLInputElement;
} {
	const wrapper = document.createElement("label");
	wrapper.style.position = "relative";
	wrapper.style.display = "inline-block";
	wrapper.style.width = "44px";
	wrapper.style.height = "24px";
	wrapper.style.cursor = disabled ? "default" : "pointer";
	wrapper.style.flexShrink = "0";

	const input = document.createElement("input");
	input.type = "checkbox";
	input.role = "switch";
	input.setAttribute("aria-checked", "false");
	input.style.position = "absolute";
	input.style.opacity = "0";
	input.style.width = "0";
	input.style.height = "0";
	input.disabled = disabled;

	// Track
	const track = document.createElement("span");
	track.style.position = "absolute";
	track.style.inset = "0";
	track.style.borderRadius = "12px";
	track.style.background = "rgba(255,255,255,0.15)";
	track.style.transition = "background 200ms ease";

	// Thumb
	const thumb = document.createElement("span");
	thumb.style.position = "absolute";
	thumb.style.top = "3px";
	thumb.style.left = "3px";
	thumb.style.width = "18px";
	thumb.style.height = "18px";
	thumb.style.borderRadius = "50%";
	thumb.style.background = "#ffffff";
	thumb.style.transition = "left 200ms ease";

	input.addEventListener("change", () => {
		const checked = input.checked;
		input.setAttribute("aria-checked", String(checked));
		track.style.background = checked ? "#4488FF" : "rgba(255,255,255,0.15)";
		thumb.style.left = checked ? "23px" : "3px";
	});

	track.appendChild(thumb);
	wrapper.appendChild(input);
	wrapper.appendChild(track);

	return { wrapper, input };
}

export class Settings {
	private readonly container: HTMLDivElement;
	private readonly toggles: Map<keyof GameSettings, HTMLInputElement> =
		new Map();

	private settingChangeCb:
		| ((key: keyof GameSettings, value: boolean) => void)
		| null = null;
	private backCb: (() => void) | null = null;

	constructor() {
		this.container = document.createElement("div");
		this.container.style.position = "fixed";
		this.container.style.inset = "0";
		this.container.style.zIndex = "100";
		this.container.style.background = "rgba(0,0,0,0.92)";
		this.container.style.display = "none";
		this.container.style.alignItems = "center";
		this.container.style.justifyContent = "center";

		// ── Card ──────────────────────────────────────────────────────────────
		const card = document.createElement("div");
		card.style.maxWidth = "480px";
		card.style.width = "90vw";
		card.style.padding = "48px";
		card.style.display = "flex";
		card.style.flexDirection = "column";
		card.style.gap = "0";

		// ── Title ─────────────────────────────────────────────────────────────
		const title = document.createElement("h1");
		title.textContent = "SETTINGS";
		title.style.fontSize = "24px";
		title.style.fontWeight = "700";
		title.style.textTransform = "uppercase";
		title.style.letterSpacing = "0.1em";
		title.style.margin = "0 0 32px";
		applyFont(title);

		card.appendChild(title);

		// ── Rows ──────────────────────────────────────────────────────────────
		for (const row of SETTING_ROWS) {
			const isDisabled = row.disabled === true;

			const rowEl = document.createElement("div");
			rowEl.style.display = "flex";
			rowEl.style.alignItems = "center";
			rowEl.style.justifyContent = "space-between";
			rowEl.style.paddingTop = "16px";
			rowEl.style.paddingBottom = "16px";
			rowEl.style.borderBottom = "1px solid rgba(255,255,255,0.08)";

			if (isDisabled) {
				rowEl.style.opacity = "0.3";
				rowEl.style.pointerEvents = "none";
			}

			const labelEl = document.createElement("span");
			const labelText = isDisabled ? `${row.label} (coming soon)` : row.label;
			labelEl.textContent = labelText;
			labelEl.style.fontSize = "14px";
			labelEl.style.flex = "1";
			applyFont(labelEl);

			const { wrapper, input } = makeToggle(isDisabled);

			if (!isDisabled) {
				input.addEventListener("change", () => {
					this.settingChangeCb?.(row.key, input.checked);
				});
			}

			this.toggles.set(row.key, input);

			rowEl.appendChild(labelEl);
			rowEl.appendChild(wrapper);
			card.appendChild(rowEl);
		}

		// ── Back button ───────────────────────────────────────────────────────
		const backBtn = document.createElement("button");
		backBtn.type = "button";
		backBtn.textContent = "Back";
		backBtn.style.marginTop = "32px";
		backBtn.style.height = "40px";
		backBtn.style.padding = "0 24px";
		backBtn.style.border = "1px solid rgba(255,255,255,0.15)";
		backBtn.style.borderRadius = "4px";
		backBtn.style.background = "rgba(255,255,255,0.08)";
		backBtn.style.cursor = "pointer";
		backBtn.style.fontSize = "13px";
		backBtn.style.letterSpacing = "0.05em";
		backBtn.style.alignSelf = "flex-start";
		backBtn.style.transition = "background 150ms ease, border-color 150ms ease";
		applyFont(backBtn);

		backBtn.addEventListener("mouseenter", () => {
			backBtn.style.background = "rgba(255,255,255,0.14)";
		});
		backBtn.addEventListener("mouseleave", () => {
			backBtn.style.background = "rgba(255,255,255,0.08)";
		});
		backBtn.addEventListener("click", () => {
			this.backCb?.();
		});

		card.appendChild(backBtn);

		this.container.appendChild(card);
		document.body.appendChild(this.container);
	}

	update(settings: GameSettings): void {
		for (const [key, input] of this.toggles) {
			const value = settings[key];
			input.checked = value;
			input.setAttribute("aria-checked", String(value));

			// Sync the visual track/thumb state by dispatching a synthetic event
			// We access the track/thumb via the label's children
			const label = input.parentElement;
			if (label !== null) {
				const track = label.querySelector("span") as HTMLSpanElement | null;
				if (track !== null) {
					track.style.background = value ? "#4488FF" : "rgba(255,255,255,0.15)";
					const thumb = track.querySelector("span") as HTMLSpanElement | null;
					if (thumb !== null) {
						thumb.style.left = value ? "23px" : "3px";
					}
				}
			}
		}
	}

	onSettingChange(cb: (key: keyof GameSettings, value: boolean) => void): void {
		this.settingChangeCb = cb;
	}

	onBack(cb: () => void): void {
		this.backCb = cb;
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
