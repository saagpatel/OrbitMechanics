const FONT_STACK = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

function applyFont(el: HTMLElement): void {
	el.style.fontFamily = FONT_STACK;
	el.style.color = "#ffffff";
}

function makeButton(label: string, primary = false): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = label;
	btn.style.height = "40px";
	btn.style.padding = "0 24px";
	btn.style.border = "1px solid";
	btn.style.borderRadius = "4px";
	btn.style.cursor = "pointer";
	btn.style.fontSize = "13px";
	btn.style.letterSpacing = "0.05em";
	btn.style.transition = "background 150ms ease, border-color 150ms ease";
	btn.style.width = "220px";
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
		btn.style.background = "rgba(255,255,255,0.08)";
		btn.style.borderColor = "rgba(255,255,255,0.15)";
		btn.addEventListener("mouseenter", () => {
			btn.style.background = "rgba(255,255,255,0.14)";
		});
		btn.addEventListener("mouseleave", () => {
			btn.style.background = "rgba(255,255,255,0.08)";
		});
	}

	return btn;
}

export class MainMenu {
	private readonly container: HTMLDivElement;
	private readonly sandboxBtn: HTMLButtonElement;
	private readonly creditsText: HTMLParagraphElement;
	private creditsVisible = false;

	private playCb: (() => void) | null = null;
	private sandboxCb: (() => void) | null = null;
	private settingsCb: (() => void) | null = null;

	constructor() {
		this.container = document.createElement("div");
		this.container.style.position = "fixed";
		this.container.style.inset = "0";
		this.container.style.zIndex = "100";
		this.container.style.background = "#000000";
		this.container.style.display = "none";
		this.container.style.alignItems = "center";
		this.container.style.justifyContent = "center";
		this.container.style.flexDirection = "column";

		// ── Center wrapper ────────────────────────────────────────────────────
		const center = document.createElement("div");
		center.style.display = "flex";
		center.style.flexDirection = "column";
		center.style.alignItems = "center";
		center.style.textAlign = "center";

		// ── Title ─────────────────────────────────────────────────────────────
		const title = document.createElement("h1");
		title.textContent = "ORBIT MECHANIC";
		title.style.fontSize = "48px";
		title.style.fontWeight = "300";
		title.style.letterSpacing = "0.15em";
		title.style.margin = "0";
		applyFont(title);

		// ── Subtitle ──────────────────────────────────────────────────────────
		const subtitle = document.createElement("p");
		subtitle.textContent = "An explorable explanation of orbital mechanics";
		subtitle.style.fontSize = "13px";
		subtitle.style.color = "rgba(255,255,255,0.4)";
		subtitle.style.margin = "12px 0 0";
		subtitle.style.fontFamily = FONT_STACK;

		// ── Button stack ──────────────────────────────────────────────────────
		const btnStack = document.createElement("div");
		btnStack.style.display = "flex";
		btnStack.style.flexDirection = "column";
		btnStack.style.gap = "16px";
		btnStack.style.marginTop = "64px";
		btnStack.style.alignItems = "center";

		const playBtn = makeButton("Play", true);
		playBtn.addEventListener("click", () => {
			this.playCb?.();
		});

		this.sandboxBtn = makeButton("Sandbox", true);
		this.sandboxBtn.style.opacity = "0.3";
		this.sandboxBtn.style.pointerEvents = "none";
		this.sandboxBtn.style.cursor = "default";
		this.sandboxBtn.addEventListener("click", () => {
			this.sandboxCb?.();
		});

		const settingsBtn = makeButton("Settings");
		settingsBtn.addEventListener("click", () => {
			this.settingsCb?.();
		});

		const creditsBtn = makeButton("Credits");
		creditsBtn.addEventListener("click", () => {
			this.creditsVisible = !this.creditsVisible;
			this.creditsText.style.display = this.creditsVisible ? "block" : "none";
		});

		btnStack.appendChild(playBtn);
		btnStack.appendChild(this.sandboxBtn);
		btnStack.appendChild(settingsBtn);
		btnStack.appendChild(creditsBtn);

		// ── Credits text ──────────────────────────────────────────────────────
		this.creditsText = document.createElement("p");
		this.creditsText.textContent =
			"Built as an explorable explanation of orbital mechanics. No frameworks, no physics libraries — just TypeScript and Canvas.";
		this.creditsText.style.fontSize = "13px";
		this.creditsText.style.color = "rgba(255,255,255,0.4)";
		this.creditsText.style.maxWidth = "360px";
		this.creditsText.style.textAlign = "center";
		this.creditsText.style.marginTop = "24px";
		this.creditsText.style.lineHeight = "1.6";
		this.creditsText.style.fontFamily = FONT_STACK;
		this.creditsText.style.display = "none";

		center.appendChild(title);
		center.appendChild(subtitle);
		center.appendChild(btnStack);
		center.appendChild(this.creditsText);

		this.container.appendChild(center);
		document.body.appendChild(this.container);
	}

	onPlay(cb: () => void): void {
		this.playCb = cb;
	}

	onSandbox(cb: () => void): void {
		this.sandboxCb = cb;
	}

	onSettings(cb: () => void): void {
		this.settingsCb = cb;
	}

	setSandboxUnlocked(unlocked: boolean): void {
		if (unlocked) {
			this.sandboxBtn.style.opacity = "1";
			this.sandboxBtn.style.pointerEvents = "auto";
			this.sandboxBtn.style.cursor = "pointer";
		} else {
			this.sandboxBtn.style.opacity = "0.3";
			this.sandboxBtn.style.pointerEvents = "none";
			this.sandboxBtn.style.cursor = "default";
		}
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
