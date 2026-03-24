import type { LevelConfig, LevelProgress } from "@/types";

const FONT_STACK = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

const ACT_NAMES: Record<1 | 2 | 3 | 4, string> = {
	1: "First Steps",
	2: "Transfer Orbits",
	3: "Many Bodies",
	4: "Mastery",
};

function applyFont(el: HTMLElement): void {
	el.style.fontFamily = FONT_STACK;
	el.style.color = "#ffffff";
}

export class LevelSelect {
	private readonly container: HTMLDivElement;
	private readonly content: HTMLDivElement;
	private selectCb: ((levelId: string) => void) | null = null;
	private sandboxCb: (() => void) | null = null;

	constructor() {
		this.container = document.createElement("div");
		this.container.style.position = "fixed";
		this.container.style.inset = "0";
		this.container.style.zIndex = "100";
		this.container.style.background = "#000000";
		this.container.style.overflowY = "auto";
		this.container.style.display = "none";

		// ── Title ────────────────────────────────────────────────────────────
		const title = document.createElement("h1");
		title.textContent = "ORBIT MECHANIC";
		title.style.textAlign = "center";
		title.style.fontSize = "32px";
		title.style.fontWeight = "300";
		title.style.letterSpacing = "0.1em";
		title.style.margin = "0";
		title.style.padding = "72px 0 48px";
		title.style.color = "#ffffff";
		applyFont(title);

		this.content = document.createElement("div");
		this.content.style.maxWidth = "720px";
		this.content.style.margin = "0 auto";
		this.content.style.padding = "0 24px 72px";

		this.container.appendChild(title);
		this.container.appendChild(this.content);

		document.body.appendChild(this.container);
	}

	update(
		levels: ReadonlyArray<LevelConfig>,
		progress: ReadonlyMap<string, LevelProgress>,
		highestUnlocked: number,
	): void {
		this.content.innerHTML = "";

		const byAct = new Map<1 | 2 | 3 | 4, LevelConfig[]>();
		for (const lvl of levels) {
			const existing = byAct.get(lvl.act);
			if (existing !== undefined) {
				existing.push(lvl);
			} else {
				byAct.set(lvl.act, [lvl]);
			}
		}

		const acts: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4];

		for (const act of acts) {
			const actLevels = byAct.get(act) ?? [];
			const isActLocked = act !== 1 && actLevels.length === 0;

			// ── Act heading ─────────────────────────────────────────────────
			const actHeading = document.createElement("div");
			actHeading.style.marginBottom = "16px";
			actHeading.style.marginTop = act === 1 ? "0" : "48px";
			actHeading.style.display = "flex";
			actHeading.style.alignItems = "center";
			actHeading.style.gap = "12px";

			const actLabel = document.createElement("h2");
			actLabel.textContent = `Act ${act}: ${ACT_NAMES[act]}`;
			actLabel.style.fontSize = "12px";
			actLabel.style.fontWeight = "300";
			actLabel.style.letterSpacing = "0.15em";
			actLabel.style.textTransform = "uppercase";
			actLabel.style.margin = "0";
			actLabel.style.color = isActLocked
				? "rgba(255,255,255,0.3)"
				: "rgba(255,255,255,0.6)";
			applyFont(actLabel);

			const divider = document.createElement("div");
			divider.style.flex = "1";
			divider.style.height = "1px";
			divider.style.background = isActLocked
				? "rgba(255,255,255,0.08)"
				: "rgba(255,255,255,0.15)";

			actHeading.appendChild(actLabel);
			actHeading.appendChild(divider);
			this.content.appendChild(actHeading);

			// ── Level grid ──────────────────────────────────────────────────
			const grid = document.createElement("div");
			grid.style.display = "grid";
			grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(80px, 1fr))";
			grid.style.gap = "12px";

			if (actLevels.length === 0) {
				// No levels for this act yet — render locked placeholder slots
				const lockedSlotCount = 8;
				for (let i = 0; i < lockedSlotCount; i++) {
					grid.appendChild(this.makeLockedSlotCard());
				}
			}

			for (const lvl of actLevels) {
				const lvlProgress = progress.get(lvl.id);
				const isUnlocked = lvl.levelNumber <= highestUnlocked;
				const isCompleted = lvlProgress?.completed === true;

				const card = this.makeLevelCard(
					lvl,
					lvlProgress,
					isUnlocked,
					isCompleted,
				);
				grid.appendChild(card);
			}

			this.content.appendChild(grid);

			// ── Sandbox button (after Act 1 grid) ────────────────────────────
			if (act === 1) {
				const act1LastLevel = progress.get("act1-08");
				const sandboxUnlocked = act1LastLevel?.completed === true;
				const sandboxCard = this.makeSandboxCard(sandboxUnlocked);
				this.content.appendChild(sandboxCard);
			}
		}
	}

	private makeLevelCard(
		lvl: LevelConfig,
		prog: LevelProgress | undefined,
		isUnlocked: boolean,
		isCompleted: boolean,
	): HTMLButtonElement {
		const card = document.createElement("button");
		card.style.aspectRatio = "1";
		card.style.display = "flex";
		card.style.flexDirection = "column";
		card.style.alignItems = "center";
		card.style.justifyContent = "center";
		card.style.gap = "6px";
		card.style.border = "1px solid";
		card.style.borderRadius = "6px";
		card.style.cursor = isUnlocked ? "pointer" : "default";
		card.style.transition = "background 150ms ease, border-color 150ms ease";
		applyFont(card);

		if (isCompleted) {
			card.style.background = "rgba(255,215,0,0.08)";
			card.style.borderColor = "rgba(255,215,0,0.35)";
			card.style.opacity = "1";
		} else if (isUnlocked) {
			card.style.background = "rgba(255,255,255,0.05)";
			card.style.borderColor = "rgba(255,255,255,0.2)";
			card.style.opacity = "1";
		} else {
			card.style.background = "rgba(255,255,255,0.02)";
			card.style.borderColor = "rgba(255,255,255,0.08)";
			card.style.opacity = "0.3";
		}

		if (isUnlocked) {
			card.addEventListener("mouseenter", () => {
				card.style.background = isCompleted
					? "rgba(255,215,0,0.15)"
					: "rgba(255,255,255,0.1)";
			});
			card.addEventListener("mouseleave", () => {
				card.style.background = isCompleted
					? "rgba(255,215,0,0.08)"
					: "rgba(255,255,255,0.05)";
			});
			card.addEventListener("click", () => {
				this.selectCb?.(lvl.id);
			});
		}

		// Level number
		const numEl = document.createElement("span");
		numEl.textContent = String(lvl.levelNumber).padStart(2, "0");
		numEl.style.fontSize = "22px";
		numEl.style.fontWeight = "300";
		numEl.style.color = isCompleted ? "#FFD700" : "#ffffff";
		applyFont(numEl);

		card.appendChild(numEl);

		if (isCompleted && prog !== undefined) {
			const stars = document.createElement("span");
			stars.style.fontSize = "11px";
			stars.style.letterSpacing = "2px";
			const filled = prog.stars;
			stars.textContent = "★".repeat(filled) + "☆".repeat(3 - filled);
			stars.style.color = "#FFD700";
			card.appendChild(stars);
		} else if (!isUnlocked) {
			const lock = document.createElement("span");
			lock.textContent = "🔒";
			lock.style.fontSize = "14px";
			card.appendChild(lock);
		}

		return card;
	}

	private makeSandboxCard(isUnlocked: boolean): HTMLDivElement {
		const wrapper = document.createElement("div");
		wrapper.style.marginTop = "24px";

		const card = document.createElement("button");
		card.style.width = "100%";
		card.style.height = "64px";
		card.style.display = "flex";
		card.style.alignItems = "center";
		card.style.justifyContent = "center";
		card.style.gap = "10px";
		card.style.border = "1px solid";
		card.style.borderRadius = "6px";
		card.style.cursor = isUnlocked ? "pointer" : "default";
		card.style.transition = "background 150ms ease, border-color 150ms ease";
		applyFont(card);

		if (isUnlocked) {
			card.style.background = "rgba(68,136,255,0.06)";
			card.style.borderColor = "rgba(68,136,255,0.3)";
			card.style.opacity = "1";

			card.addEventListener("mouseenter", () => {
				card.style.background = "rgba(68,136,255,0.14)";
			});
			card.addEventListener("mouseleave", () => {
				card.style.background = "rgba(68,136,255,0.06)";
			});
			card.addEventListener("click", () => {
				this.sandboxCb?.();
			});
		} else {
			card.style.background = "rgba(255,255,255,0.02)";
			card.style.borderColor = "rgba(255,255,255,0.08)";
			card.style.opacity = "0.4";
		}

		const icon = document.createElement("span");
		icon.textContent = isUnlocked ? "⬡" : "🔒";
		icon.style.fontSize = "20px";
		card.appendChild(icon);

		const label = document.createElement("span");
		label.textContent = isUnlocked
			? "Sandbox"
			: "Sandbox — complete Act 1 to unlock";
		label.style.fontSize = "14px";
		label.style.fontWeight = "300";
		label.style.letterSpacing = "0.06em";
		label.style.color = isUnlocked ? "#4488FF" : "rgba(255,255,255,0.4)";
		applyFont(label);
		card.appendChild(label);

		wrapper.appendChild(card);
		return wrapper;
	}

	private makeLockedSlotCard(): HTMLDivElement {
		const card = document.createElement("div");
		card.style.aspectRatio = "1";
		card.style.border = "1px solid rgba(255,255,255,0.08)";
		card.style.borderRadius = "6px";
		card.style.background = "rgba(255,255,255,0.02)";
		card.style.opacity = "0.3";
		card.style.display = "flex";
		card.style.alignItems = "center";
		card.style.justifyContent = "center";

		const lock = document.createElement("span");
		lock.textContent = "🔒";
		lock.style.fontSize = "14px";
		card.appendChild(lock);

		return card;
	}

	onLevelSelect(cb: (levelId: string) => void): void {
		this.selectCb = cb;
	}

	onSandboxSelect(cb: () => void): void {
		this.sandboxCb = cb;
	}

	show(): void {
		this.container.style.display = "block";
	}

	hide(): void {
		this.container.style.display = "none";
	}

	destroy(): void {
		this.container.remove();
	}
}
