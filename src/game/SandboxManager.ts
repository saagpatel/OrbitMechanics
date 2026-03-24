import { GameLoop } from "@/game/GameLoop";
import { InputController } from "@/game/InputController";
import { CanvasRenderer } from "@/renderer/CanvasRenderer";
import { Viewport } from "@/renderer/Viewport";
import { buildSOIHierarchy, type SOIBody } from "@/simulation/PatchedConics";
import { EARTH_MASS_KG, SIM_DT } from "@/simulation/PhysicsConstants";
import { findCentralBody } from "@/simulation/TrajectoryPreview";
import { VerletSimulation } from "@/simulation/VerletSimulation";
import type { Body, GameSettings, SandboxSave } from "@/types";
import { SandboxUI } from "@/ui/screens/SandboxUI";
import {
	loadSandboxSaves,
	loadSettings,
	saveSandboxSaves,
	saveSettings,
} from "@/utils/Storage";

export class SandboxManager {
	private readonly canvas: HTMLCanvasElement;
	private readonly gameLoop: GameLoop;
	private readonly viewport: Viewport;
	private readonly renderer: CanvasRenderer;
	private readonly sandboxUI: SandboxUI;

	private simulation: VerletSimulation | null = null;
	private inputController: InputController | null = null;
	private bodies: Body[] = [];
	private settings: GameSettings;
	private mode: "place" | "delete" | "observe" = "place";
	private placementMass = EARTH_MASS_KG;
	private placementColor = "#4488FF";
	private nextBodyIndex = 0;
	private simRunning = false;
	private centralBody: Readonly<Body> | null = null;
	private soiBodies: SOIBody[] = [];
	private exitCb: (() => void) | null = null;

	// Canvas interaction handler references for cleanup
	private wheelHandler: ((e: WheelEvent) => void) | null = null;
	private panDownHandler: ((e: MouseEvent) => void) | null = null;
	private panMoveHandler: ((e: MouseEvent) => void) | null = null;
	private panUpHandler: ((e: MouseEvent) => void) | null = null;
	private clickHandler: ((e: MouseEvent) => void) | null = null;
	private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
	private panState = { active: false, lastX: 0, lastY: 0 };

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.viewport = new Viewport(canvas);
		this.renderer = new CanvasRenderer(canvas, this.viewport);
		this.sandboxUI = new SandboxUI();
		this.settings = loadSettings();

		this.gameLoop = new GameLoop(
			(dt) => this.onTick(dt),
			() => this.onRender(),
			SIM_DT,
		);
	}

	init(): void {
		this.wireUICallbacks();
	}

	enterSandbox(): void {
		this.canvas.style.display = "block";
		this.sandboxUI.show();

		// Apply persisted settings to UI
		this.sandboxUI.updateSettings(this.settings);

		// Restore saves list
		this.sandboxUI.updateSaveList(loadSandboxSaves());

		// Reset viewport to a sensible default
		this.viewport.pan = { x: 0, y: 0 };
		this.viewport.zoom = 1;

		// Start from an empty simulation
		this.bodies = [];
		this.rebuildSimulation();

		this.setupCanvasInteraction();
		this.gameLoop.isPaused = false;
		this.gameLoop.timeScale = 1;
		this.simRunning = true;
		this.gameLoop.start();
	}

	exitToLevelSelect(): void {
		this.gameLoop.isPaused = true;
		this.simRunning = false;
		this.gameLoop.stop();
		this.cleanupCanvasInteraction();
		this.inputController?.destroy();
		this.inputController = null;
		this.sandboxUI.hide();
		this.canvas.style.display = "none";
	}

	onExitRequested(cb: () => void): void {
		this.exitCb = cb;
	}

	destroy(): void {
		this.exitToLevelSelect();
		this.sandboxUI.destroy();
	}

	// ── Private: Simulation ────────────────────────────────────────────────

	private rebuildSimulation(): void {
		this.simulation = new VerletSimulation(this.bodies);
		this.centralBody = findCentralBody(this.bodies);
		this.soiBodies = buildSOIHierarchy(this.bodies);

		// Reconnect input controller with new body list
		this.inputController?.setBodies(this.simulation.getBodies());
	}

	private onTick(dt: number): void {
		if (!this.simulation || !this.simRunning) return;
		this.simulation.step(dt);
	}

	private onRender(): void {
		if (!this.simulation) return;

		const currentBodies = this.simulation.getBodies() as Body[];

		// Record trail points
		if (this.simRunning) {
			for (const body of currentBodies) {
				if (body.trailMaxLength === 0) continue;
				body.trailPoints.push({ x: body.position.x, y: body.position.y });
				if (body.trailPoints.length > body.trailMaxLength) {
					body.trailPoints.shift();
				}
			}
		}

		this.inputController?.setBodies(currentBodies);
		const drawState = this.inputController?.getDrawState() ?? null;

		this.renderer.render(
			currentBodies,
			drawState,
			this.centralBody,
			this.soiBodies,
		);
	}

	// ── Private: UI wiring ─────────────────────────────────────────────────

	private wireUICallbacks(): void {
		this.sandboxUI.onModeChange((mode) => {
			this.mode = mode;
		});

		this.sandboxUI.onMassChange((mass) => {
			this.placementMass = mass;
		});

		this.sandboxUI.onColorChange((color) => {
			this.placementColor = color;
		});

		this.sandboxUI.onClearAll(() => {
			this.bodies = [];
			this.nextBodyIndex = 0;
			this.inputController?.destroy();
			this.inputController = null;
			this.rebuildSimulation();
			this.setupInputController();
		});

		this.sandboxUI.onSave(() => {
			this.handleSave();
		});

		this.sandboxUI.onLoad((saveId) => {
			this.handleLoad(saveId);
		});

		this.sandboxUI.onSettingToggle((setting, value) => {
			this.settings = { ...this.settings, [setting]: value };
			saveSettings(this.settings);
			this.applySettings();
		});

		this.sandboxUI.onTimeScaleChange((scale) => {
			this.gameLoop.timeScale = scale;
		});

		this.sandboxUI.onPause(() => {
			this.gameLoop.isPaused = !this.gameLoop.isPaused;
		});

		this.sandboxUI.onExit(() => {
			this.exitCb?.();
		});
	}

	// ── Private: Canvas interaction ────────────────────────────────────────

	private setupCanvasInteraction(): void {
		this.cleanupCanvasInteraction();
		this.setupInputController();

		// Wheel zoom
		this.wheelHandler = (e) => {
			e.preventDefault();
			this.viewport.applyZoom(e.deltaY, { x: e.clientX, y: e.clientY });
		};
		this.canvas.addEventListener("wheel", this.wheelHandler, {
			passive: false,
		});

		// Pan (shift+left or middle button)
		this.panDownHandler = (e) => {
			if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
				this.panState = { active: true, lastX: e.clientX, lastY: e.clientY };
				this.canvas.style.cursor = "grabbing";
			}
		};
		this.panMoveHandler = (e) => {
			if (!this.panState.active) return;
			this.viewport.applyPan(
				e.clientX - this.panState.lastX,
				e.clientY - this.panState.lastY,
			);
			this.panState.lastX = e.clientX;
			this.panState.lastY = e.clientY;
		};
		this.panUpHandler = () => {
			this.panState.active = false;
			this.canvas.style.cursor = "default";
		};
		this.canvas.addEventListener("mousedown", this.panDownHandler);
		this.canvas.addEventListener("mousemove", this.panMoveHandler);
		this.canvas.addEventListener("mouseup", this.panUpHandler);

		// Click: place or delete body
		this.clickHandler = (e) => this.handleCanvasClick(e);
		this.canvas.addEventListener("click", this.clickHandler);

		// Keyboard shortcuts
		this.keydownHandler = (e) => {
			switch (e.key) {
				case " ":
					e.preventDefault();
					this.gameLoop.isPaused = !this.gameLoop.isPaused;
					break;
				case "1":
					this.gameLoop.timeScale = 0.1;
					break;
				case "2":
					this.gameLoop.timeScale = 1;
					break;
				case "3":
					this.gameLoop.timeScale = 5;
					break;
				case "4":
					this.gameLoop.timeScale = 20;
					break;
				case "Escape":
					e.preventDefault();
					this.exitToLevelSelect();
					break;
			}
		};
		document.addEventListener("keydown", this.keydownHandler);
	}

	private setupInputController(): void {
		this.inputController?.destroy();
		this.inputController = new InputController(
			this.canvas,
			this.viewport,
			(event) => {
				if (event.type === "vector_committed" && this.simulation) {
					this.simulation.applyDeltaV(event.bodyId, event.deltaV);
				}
			},
		);
		if (this.simulation) {
			this.inputController.setBodies(this.simulation.getBodies());
		}
	}

	private cleanupCanvasInteraction(): void {
		if (this.wheelHandler) {
			this.canvas.removeEventListener("wheel", this.wheelHandler);
			this.wheelHandler = null;
		}
		if (this.panDownHandler) {
			this.canvas.removeEventListener("mousedown", this.panDownHandler);
			this.panDownHandler = null;
		}
		if (this.panMoveHandler) {
			this.canvas.removeEventListener("mousemove", this.panMoveHandler);
			this.panMoveHandler = null;
		}
		if (this.panUpHandler) {
			this.canvas.removeEventListener("mouseup", this.panUpHandler);
			this.panUpHandler = null;
		}
		if (this.clickHandler) {
			this.canvas.removeEventListener("click", this.clickHandler);
			this.clickHandler = null;
		}
		if (this.keydownHandler) {
			document.removeEventListener("keydown", this.keydownHandler);
			this.keydownHandler = null;
		}
	}

	private handleCanvasClick(e: MouseEvent): void {
		// Ignore shift (pan) and non-left clicks
		if (e.button !== 0 || e.shiftKey) return;

		// Don't intercept clicks when InputController is handling a vector drag
		const drawState = this.inputController?.getDrawState();
		if (
			drawState &&
			drawState.phase !== "idle" &&
			drawState.phase !== "committed"
		)
			return;

		if (this.mode === "place") {
			this.placeBodyAt(e.clientX, e.clientY);
		} else if (this.mode === "delete") {
			this.deleteBodyNear(e.clientX, e.clientY);
		}
	}

	private placeBodyAt(screenX: number, screenY: number): void {
		const simPos = this.viewport.screenToSim({ x: screenX, y: screenY });

		const trailMaxLength = this.settings.trailPersistence ? 10000 : 200;

		const newBody: Body = {
			id: `sandbox-${this.nextBodyIndex++}`,
			mass: this.placementMass,
			radius: this.massToRadius(this.placementMass),
			position: { ...simPos },
			velocity: { x: 0, y: 0 },
			isFixed: false,
			color: this.placementColor,
			shape: "circle",
			trailPoints: [],
			trailMaxLength,
		};

		this.bodies.push(newBody);
		this.rebuildSimulation();
	}

	private deleteBodyNear(screenX: number, screenY: number): void {
		let closestIdx = -1;
		let closestDist = Infinity;

		for (let i = 0; i < this.bodies.length; i++) {
			const body = this.bodies[i];
			if (!body || body.isFixed) continue;
			const screenPos = this.viewport.simToScreen(body.position);
			const dx = screenX - screenPos.x;
			const dy = screenY - screenPos.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < closestDist && dist < Math.max(body.radius + 15, 24)) {
				closestDist = dist;
				closestIdx = i;
			}
		}

		if (closestIdx >= 0) {
			this.bodies.splice(closestIdx, 1);
			this.inputController?.reset();
			this.rebuildSimulation();
		}
	}

	// ── Private: Save / Load ───────────────────────────────────────────────

	private handleSave(): void {
		const name = window.prompt(
			"Save name:",
			`Sandbox ${new Date().toLocaleTimeString()}`,
		);
		if (!name) return;

		const saves = loadSandboxSaves();
		const id = `save-${Date.now()}`;

		const saveEntry: SandboxSave = {
			id,
			name,
			savedAt: Date.now(),
			bodies: this.bodies.map((b) => ({
				id: b.id,
				mass: b.mass,
				radius: b.radius,
				position: { ...b.position },
				velocity: { ...b.velocity },
				isFixed: b.isFixed,
				color: b.color,
				shape: b.shape,
				label: b.label,
			})),
		};

		saves.push(saveEntry);
		saveSandboxSaves(saves);
		this.sandboxUI.updateSaveList(saves);
	}

	private handleLoad(saveId: string): void {
		const saves = loadSandboxSaves();
		const save = saves.find((s) => s.id === saveId);
		if (!save) return;

		const trailMaxLength = this.settings.trailPersistence ? 10000 : 200;

		this.bodies = save.bodies.map((b) => ({
			...b,
			position: { ...b.position },
			velocity: { ...b.velocity },
			trailPoints: [],
			trailMaxLength,
		}));

		// Advance nextBodyIndex past any loaded IDs
		this.nextBodyIndex = this.bodies.length;

		this.inputController?.reset();
		this.rebuildSimulation();
	}

	// ── Private: Settings application ─────────────────────────────────────

	private applySettings(): void {
		// Overlay toggles — setOverlayEnabled is added by Stream C agent
		// Calling it here; method will be present when streams are merged
		if (
			"setOverlayEnabled" in this.renderer &&
			typeof (this.renderer as unknown as Record<string, unknown>)[
				"setOverlayEnabled"
			] === "function"
		) {
			(
				this.renderer as unknown as {
					setOverlayEnabled: (name: string, v: boolean) => void;
				}
			).setOverlayEnabled("gravityField", this.settings.showGravityField);
			(
				this.renderer as unknown as {
					setOverlayEnabled: (name: string, v: boolean) => void;
				}
			).setOverlayEnabled("orbitalData", this.settings.showOrbitalData);
		}

		// Trail persistence: update trailMaxLength on all bodies
		const maxLength = this.settings.trailPersistence ? 10000 : 200;
		for (const body of this.bodies) {
			body.trailMaxLength = maxLength;
			if (
				!this.settings.trailPersistence &&
				body.trailPoints.length > maxLength
			) {
				body.trailPoints = body.trailPoints.slice(-maxLength);
			}
		}
	}

	// ── Private: Helpers ───────────────────────────────────────────────────

	/** Map mass to a display radius using sqrt scaling, clamped for visibility. */
	private massToRadius(mass: number): number {
		// Earth mass (5.972e24) → radius 6px, Solar mass (1.989e30) → ~38px
		const earthMass = EARTH_MASS_KG;
		return Math.min(
			Math.max(Math.round(6 * Math.sqrt(mass / earthMass)), 3),
			50,
		);
	}
}
