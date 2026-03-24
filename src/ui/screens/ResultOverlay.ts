const FONT_STACK = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

function applyFont(el: HTMLElement): void {
	el.style.fontFamily = FONT_STACK;
	el.style.color = "#ffffff";
}

function makeButton(label: string, primary = false): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.textContent = label;
	btn.style.height = "40px";
	btn.style.padding = "0 20px";
	btn.style.border = "1px solid";
	btn.style.borderRadius = "4px";
	btn.style.cursor = "pointer";
	btn.style.fontSize = "13px";
	btn.style.letterSpacing = "0.05em";
	btn.style.transition = "background 150ms ease, border-color 150ms ease";
	applyFont(btn);

	if (primary) {
		btn.style.background = "rgba(255,255,255,0.15)";
		btn.style.borderColor = "rgba(255,255,255,0.4)";
		btn.addEventListener("mouseenter", () => {
			btn.style.background = "rgba(255,255,255,0.25)";
		});
		btn.addEventListener("mouseleave", () => {
			btn.style.background = "rgba(255,255,255,0.15)";
		});
	} else {
		btn.style.background = "rgba(255,255,255,0.05)";
		btn.style.borderColor = "rgba(255,255,255,0.15)";
		btn.addEventListener("mouseenter", () => {
			btn.style.background = "rgba(255,255,255,0.1)";
		});
		btn.addEventListener("mouseleave", () => {
			btn.style.background = "rgba(255,255,255,0.05)";
		});
	}

	return btn;
}

export class ResultOverlay {
	private readonly container: HTMLDivElement;
	private readonly card: HTMLDivElement;

	private nextLevelCb: (() => void) | null = null;
	private replayCb: (() => void) | null = null;
	private levelSelectCb: (() => void) | null = null;

	constructor() {
		this.container = document.createElement("div");
		this.container.style.position = "fixed";
		this.container.style.inset = "0";
		this.container.style.zIndex = "200";
		this.container.style.background = "rgba(0,0,0,0.85)";
		this.container.style.display = "none";
		this.container.style.alignItems = "center";
		this.container.style.justifyContent = "center";

		this.card = document.createElement("div");
		this.card.style.background = "rgba(255,255,255,0.05)";
		this.card.style.border = "1px solid rgba(255,255,255,0.15)";
		this.card.style.borderRadius = "8px";
		this.card.style.padding = "48px";
		this.card.style.minWidth = "320px";
		this.card.style.maxWidth = "480px";
		this.card.style.width = "90vw";
		this.card.style.display = "flex";
		this.card.style.flexDirection = "column";
		this.card.style.alignItems = "center";
		this.card.style.gap = "24px";
		this.card.style.textAlign = "center";
		applyFont(this.card);

		this.container.appendChild(this.card);
		document.body.appendChild(this.container);
	}

	showWin(data: {
		levelTitle: string;
		burnCount: number;
		parBurnCount: number;
		stars: 1 | 2 | 3;
		fuelUsed: number;
		fuelBudget: number | null;
	}): void {
		this.card.innerHTML = "";

		// Stars
		const starsEl = document.createElement("div");
		starsEl.style.fontSize = "28px";
		starsEl.style.letterSpacing = "6px";
		let starsText = "";
		for (let i = 1; i <= 3; i++) {
			starsText += i <= data.stars ? "★" : "☆";
		}
		starsEl.textContent = starsText;
		starsEl.style.color = "#FFD700";

		// Heading
		const heading = document.createElement("h2");
		heading.textContent = "Level Complete!";
		heading.style.fontSize = "20px";
		heading.style.fontWeight = "300";
		heading.style.letterSpacing = "0.08em";
		heading.style.margin = "0";
		applyFont(heading);

		// Level title
		const titleEl = document.createElement("p");
		titleEl.textContent = data.levelTitle;
		titleEl.style.fontSize = "13px";
		titleEl.style.color = "rgba(255,255,255,0.5)";
		titleEl.style.margin = "0";
		applyFont(titleEl);

		// Burns summary
		const burnSummary = document.createElement("div");
		burnSummary.style.fontSize = "14px";
		burnSummary.style.color = "rgba(255,255,255,0.7)";
		burnSummary.style.letterSpacing = "0.04em";
		const burnsOverPar = data.burnCount - data.parBurnCount;
		let burnText = `Burns: ${data.burnCount}`;
		if (burnsOverPar === 0) {
			burnText += "  ✓ par";
		} else if (burnsOverPar > 0) {
			burnText += `  +${burnsOverPar} over par`;
		}
		burnSummary.textContent = burnText;
		applyFont(burnSummary);

		// Fuel summary (only when level has a fuel budget)
		let fuelSummary: HTMLDivElement | null = null;
		if (data.fuelBudget !== null) {
			const remaining = Math.max(0, 1 - data.fuelUsed / data.fuelBudget);
			const pct = Math.round(remaining * 100);
			const color =
				remaining > 0.4 ? "#44DDFF" : remaining > 0.2 ? "#FFAA00" : "#FF4444";

			fuelSummary = document.createElement("div");
			fuelSummary.style.fontSize = "14px";
			fuelSummary.style.letterSpacing = "0.04em";
			fuelSummary.style.color = color;
			fuelSummary.textContent = `Fuel: ${pct}% remaining`;
			applyFont(fuelSummary);
			fuelSummary.style.color = color; // override applyFont white
		}

		// Buttons
		const btnRow = document.createElement("div");
		btnRow.style.display = "flex";
		btnRow.style.gap = "10px";
		btnRow.style.flexWrap = "wrap";
		btnRow.style.justifyContent = "center";
		btnRow.style.marginTop = "8px";

		const nextBtn = makeButton("Next Level", true);
		nextBtn.addEventListener("click", () => {
			this.nextLevelCb?.();
		});

		const replayBtn = makeButton("Replay");
		replayBtn.addEventListener("click", () => {
			this.replayCb?.();
		});

		const selectBtn = makeButton("Level Select");
		selectBtn.addEventListener("click", () => {
			this.levelSelectCb?.();
		});

		btnRow.appendChild(nextBtn);
		btnRow.appendChild(replayBtn);
		btnRow.appendChild(selectBtn);

		this.card.appendChild(starsEl);
		this.card.appendChild(heading);
		this.card.appendChild(titleEl);
		this.card.appendChild(burnSummary);
		if (fuelSummary !== null) {
			this.card.appendChild(fuelSummary);
		}
		this.card.appendChild(btnRow);

		this.container.style.display = "flex";
	}

	showFail(data: { reason: string }): void {
		this.card.innerHTML = "";

		// Heading
		const heading = document.createElement("h2");
		heading.textContent = "Level Failed";
		heading.style.fontSize = "20px";
		heading.style.fontWeight = "300";
		heading.style.letterSpacing = "0.08em";
		heading.style.margin = "0";
		applyFont(heading);

		// Reason
		const reasonEl = document.createElement("p");
		reasonEl.textContent = data.reason;
		reasonEl.style.fontSize = "13px";
		reasonEl.style.color = "rgba(255,255,255,0.55)";
		reasonEl.style.margin = "0";
		reasonEl.style.lineHeight = "1.6";
		reasonEl.style.maxWidth = "280px";
		applyFont(reasonEl);

		// Buttons
		const btnRow = document.createElement("div");
		btnRow.style.display = "flex";
		btnRow.style.gap = "10px";
		btnRow.style.flexWrap = "wrap";
		btnRow.style.justifyContent = "center";
		btnRow.style.marginTop = "8px";

		const retryBtn = makeButton("Retry", true);
		retryBtn.addEventListener("click", () => {
			this.replayCb?.();
		});

		const selectBtn = makeButton("Level Select");
		selectBtn.addEventListener("click", () => {
			this.levelSelectCb?.();
		});

		btnRow.appendChild(retryBtn);
		btnRow.appendChild(selectBtn);

		this.card.appendChild(heading);
		this.card.appendChild(reasonEl);
		this.card.appendChild(btnRow);

		this.container.style.display = "flex";
	}

	onNextLevel(cb: () => void): void {
		this.nextLevelCb = cb;
	}

	onReplay(cb: () => void): void {
		this.replayCb = cb;
	}

	onLevelSelect(cb: () => void): void {
		this.levelSelectCb = cb;
	}

	hide(): void {
		this.container.style.display = "none";
	}

	destroy(): void {
		this.container.remove();
	}
}
