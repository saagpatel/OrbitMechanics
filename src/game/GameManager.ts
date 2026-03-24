import { GameLoop } from "@/game/GameLoop";
import { InputController, type InputEvent } from "@/game/InputController";
import { LevelManager } from "@/game/LevelManager";
import { buildScene } from "@/game/SceneBuilder";
import {
	type WinCheckResult,
	WinConditionChecker,
} from "@/game/WinConditionChecker";
import { CanvasRenderer } from "@/renderer/CanvasRenderer";
import { Viewport } from "@/renderer/Viewport";
import { buildSOIHierarchy, type SOIBody } from "@/simulation/PatchedConics";
import { SIM_DT, WIN_CHECK_INTERVAL } from "@/simulation/PhysicsConstants";
import { findCentralBody } from "@/simulation/TrajectoryPreview";
import {
	type BurnResult,
	VerletSimulation,
} from "@/simulation/VerletSimulation";
import type { AvailableBody, Body, LevelConfig } from "@/types";
import { ScreenManager } from "@/ui/ScreenManager";
import { GameHUD } from "@/ui/screens/GameHUD";
import { LevelSelect } from "@/ui/screens/LevelSelect";
import { MainMenu } from "@/ui/screens/MainMenu";
import { ResultOverlay } from "@/ui/screens/ResultOverlay";
import { Settings } from "@/ui/screens/Settings";

type GameScreen = "level_select" | "playing";

export class GameManager {
	private screen: GameScreen = "level_select";
	private sandboxCb: (() => void) | null = null;
	private simulation: VerletSimulation | null = null;
	private inputController: InputController | null = null;
	private winChecker: WinConditionChecker | null = null;
	private centralBody: Readonly<Body> | null = null;
	private currentLevel: LevelConfig | null = null;
	private playerBodyIds: string[] = [];
	private placementQueue: AvailableBody[] = [];
	private placementIndex = 0;
	private ticksSinceLastCheck = 0;
	private simRunning = false;
	private soiBodies: SOIBody[] = [];
	private failCount = 0;
	private hintShown = false;
	private mainMenuCb: (() => void) | null = null;

	private readonly gameLoop: GameLoop;
	private readonly viewport: Viewport;
	private readonly renderer: CanvasRenderer;
	private readonly levelManager: LevelManager;
	private readonly hud: GameHUD;
	private readonly levelSelect: LevelSelect;
	private readonly resultOverlay: ResultOverlay;
	private readonly screenManager: ScreenManager;
	private readonly canvas: HTMLCanvasElement;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.viewport = new Viewport(canvas);
		this.renderer = new CanvasRenderer(canvas, this.viewport);
		this.levelManager = new LevelManager();
		this.hud = new GameHUD();
		this.levelSelect = new LevelSelect();
		this.resultOverlay = new ResultOverlay();
		const mainMenu = new MainMenu();
		const settings = new Settings();
		this.screenManager = new ScreenManager(
			canvas,
			mainMenu,
			this.levelSelect,
			this.hud,
			settings,
		);

		this.gameLoop = new GameLoop(
			(dt) => this.onTick(dt),
			() => this.onRender(),
			SIM_DT,
		);

		this.setupEventHandlers();
	}

	async init(): Promise<void> {
		this.levelManager.loadLevels();
		this.updateLevelSelect();
		this.screenManager.showScreen("level_select");
		this.gameLoop.start();
	}

	startLevel(levelId: string): void {
		const config = this.levelManager.getLevel(levelId);
		if (!config) return;

		// Only reset fail count when starting a DIFFERENT level
		if (this.currentLevel?.id !== levelId) {
			this.failCount = 0;
			this.hintShown = false;
			this.hud.hideHint();
		}

		this.currentLevel = config;
		const scene = buildScene(config);

		this.simulation = new VerletSimulation(scene.bodies);
		if (config.fuelBudget !== undefined) {
			this.simulation.setFuelBudget(config.fuelBudget);
		}
		this.soiBodies = buildSOIHierarchy(scene.bodies);
		this.playerBodyIds = scene.playerBodyIds;
		this.centralBody = findCentralBody(scene.bodies);

		this.winChecker = new WinConditionChecker(
			config.winConditions,
			config.failConditions ?? [],
		);

		// Determine placement queue
		this.placementQueue = [...config.availableBodies];
		this.placementIndex = 0;

		// Set up input controller
		this.inputController?.destroy();
		this.inputController = new InputController(
			this.canvas,
			this.viewport,
			(e) => this.handleInputEvent(e),
		);
		this.inputController.setBodies(this.simulation.getBodies());

		// Configure viewport for the level
		const { viewportBounds } = config;
		const boundsWidth = viewportBounds.maxX - viewportBounds.minX;
		this.viewport.pan = {
			x: (viewportBounds.minX + viewportBounds.maxX) / 2,
			y: (viewportBounds.minY + viewportBounds.maxY) / 2,
		};
		this.viewport.zoom =
			Math.min(this.canvas.width, this.canvas.height) /
			((this.viewport.getPixelsPerAU() / this.viewport.zoom) * boundsWidth);

		// Set up game state
		this.gameLoop.isPaused = true;
		this.gameLoop.timeScale = 1;
		this.simRunning = false;
		this.ticksSinceLastCheck = 0;

		this.resultOverlay.hide();
		this.screen = "playing";

		// Re-show hint if previously triggered for this level
		if (this.hintShown && config.hintText) {
			this.hud.showHint(config.hintText);
		}

		this.screenManager.showScreen("game");

		// Set up zoom/pan for canvas
		this.setupCanvasInteraction();
	}

	restartLevel(): void {
		if (!this.currentLevel) return;
		this.startLevel(this.currentLevel.id);
	}

	exitToLevelSelect(): void {
		this.gameLoop.isPaused = true;
		this.simRunning = false;
		this.simulation = null;
		this.inputController?.destroy();
		this.inputController = null;
		this.currentLevel = null;
		this.resultOverlay.hide();
		this.cleanupCanvasInteraction();
		this.screen = "level_select";
		this.updateLevelSelect();
		this.screenManager.showScreen("level_select");
	}

	// ── Tick + Render ──────────────────────────────────────────────────────

	private onTick(dt: number): void {
		if (!this.simulation || !this.simRunning) return;

		this.simulation.step(dt);

		this.ticksSinceLastCheck++;
		if (this.ticksSinceLastCheck >= WIN_CHECK_INTERVAL && this.winChecker) {
			this.ticksSinceLastCheck = 0;
			const result = this.winChecker.check(this.simulation.getState());
			if (result.status === "won") this.handleWin(result);
			else if (result.status === "failed") this.handleFail(result);
		}
	}

	private onRender(): void {
		if (this.screen !== "playing" || !this.simulation) return;

		const bodies = this.simulation.getBodies() as Body[];

		// Record trails (1 point per body per frame)
		if (this.simRunning) {
			for (const body of bodies) {
				if (body.trailMaxLength === 0) continue;
				body.trailPoints.push({ x: body.position.x, y: body.position.y });
				if (body.trailPoints.length > body.trailMaxLength) {
					body.trailPoints.shift();
				}
			}
		}

		// Update input controller with current body positions
		this.inputController?.setBodies(bodies);

		const drawState = this.inputController?.getDrawState() ?? null;

		this.renderer.render(bodies, drawState, this.centralBody, this.soiBodies);

		// Draw placement indicator
		if (this.placementQueue.length > this.placementIndex) {
			this.drawPlacementHint();
		}

		// Update HUD
		if (this.currentLevel) {
			const state = this.simulation.getState();
			this.hud.update({
				levelTitle: this.currentLevel.title,
				burnCount: state.burnCount,
				parBurnCount: this.currentLevel.parBurnCount,
				timeScale: this.gameLoop.timeScale,
				isPaused: this.gameLoop.isPaused,
				fuelUsed: state.fuelUsed,
				fuelBudget: state.fuelBudget,
			});
		}
	}

	// ── Input Event Handling ────────────────────────────────────────────────

	private handleInputEvent(event: InputEvent): void {
		if (!this.simulation) return;

		switch (event.type) {
			case "vector_committed": {
				const result: BurnResult = this.simulation.applyDeltaV(
					event.bodyId,
					event.deltaV,
				);
				if (result === "rejected_no_fuel") {
					// Don't fail — let the simulation continue. The player's current
					// orbit might already satisfy win conditions. Just ignore the burn.
					return;
				}
				if (result === "applied" && !this.simRunning) {
					this.simRunning = true;
					this.gameLoop.isPaused = false;
				}
				break;
			}
			case "body_selected":
				break;
			case "cancelled":
				break;
		}
	}

	// ── Body Placement ──────────────────────────────────────────────────────

	private handleCanvasClick(e: MouseEvent): void {
		if (this.screen !== "playing") return;
		if (this.placementQueue.length <= this.placementIndex) return;
		if (e.shiftKey || e.button !== 0) return;

		// Check we're not clicking on an existing body (InputController handles that)
		const drawState = this.inputController?.getDrawState();
		if (
			drawState &&
			drawState.phase !== "idle" &&
			drawState.phase !== "committed"
		)
			return;

		const simPos = this.viewport.screenToSim({ x: e.clientX, y: e.clientY });
		const template = this.placementQueue[this.placementIndex]!;

		const newBody: Body = {
			id: `satellite-${this.placementIndex}`,
			mass: template.mass,
			radius: 6,
			position: { ...simPos },
			velocity: { x: 0, y: 0 },
			isFixed: false,
			color: template.color ?? "#4488FF",
			shape: "circle",
			label: template.label,
			trailPoints: [],
			trailMaxLength: 200,
		};

		// Add body to simulation — rebuild with new body, preserving fuel budget
		const currentBodies = [...this.simulation!.getBodies()] as Body[];
		const prevBudget = this.simulation!.getState().fuelBudget;
		currentBodies.push(newBody);
		this.simulation = new VerletSimulation(currentBodies);
		if (prevBudget !== null) {
			this.simulation.setFuelBudget(prevBudget);
		}
		this.playerBodyIds.push(newBody.id);
		this.centralBody = findCentralBody(currentBodies);
		this.soiBodies = buildSOIHierarchy(currentBodies);
		this.placementIndex++;

		// Update input controller and auto-select the new body
		this.inputController?.setBodies(this.simulation.getBodies());
		// The player now needs to drag to set velocity — InputController will handle this
		// by clicking the newly placed body
	}

	private drawPlacementHint(): void {
		const ctx = this.canvas.getContext("2d");
		if (!ctx) return;

		const remaining = this.placementQueue.length - this.placementIndex;
		const template = this.placementQueue[this.placementIndex];
		if (!template) return;

		ctx.save();
		ctx.fillStyle = "rgba(255,255,255,0.5)";
		ctx.font = '13px "JetBrains Mono", "Fira Code", "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText(
			`Click to place ${template.label ?? "body"} (${remaining} remaining)`,
			this.canvas.width / 2,
			40,
		);
		ctx.restore();
	}

	// ── Win/Fail Handling ────────────────────────────────────────────────────

	private handleWin(result: WinCheckResult): void {
		if (result.status !== "won" || !this.currentLevel) return;

		this.gameLoop.isPaused = true;
		this.simRunning = false;

		const stars = this.levelManager.completeLevel(
			this.currentLevel.id,
			result.burnCount,
			result.fuelUsed,
			this.currentLevel.act,
		);

		this.resultOverlay.showWin({
			levelTitle: this.currentLevel.title,
			burnCount: result.burnCount,
			parBurnCount: this.currentLevel.parBurnCount,
			stars,
			fuelUsed: result.fuelUsed,
			fuelBudget: this.currentLevel.fuelBudget ?? null,
		});
	}

	private handleFail(result: WinCheckResult): void {
		if (result.status !== "failed") return;

		this.gameLoop.isPaused = true;
		this.simRunning = false;

		this.failCount++;
		if (this.failCount >= 3 && !this.hintShown && this.currentLevel?.hintText) {
			this.hintShown = true;
			this.hud.showHint(this.currentLevel.hintText);
		}

		this.resultOverlay.showFail({ reason: result.reason });
	}

	onSandboxRequested(cb: () => void): void {
		this.sandboxCb = cb;
	}

	onMainMenuRequested(cb: () => void): void {
		this.mainMenuCb = cb;
	}

	setColorblindMode(enabled: boolean): void {
		this.renderer.setColorblindMode(enabled);
	}

	exitToMainMenu(): void {
		this.gameLoop.isPaused = true;
		this.simRunning = false;
		this.simulation = null;
		this.inputController?.destroy();
		this.inputController = null;
		this.currentLevel = null;
		this.resultOverlay.hide();
		this.cleanupCanvasInteraction();
		this.screen = "level_select";
		this.mainMenuCb?.();
	}

	showLevelSelect(): void {
		this.updateLevelSelect();
		this.screenManager.showScreen("level_select");
	}

	// ── Event Setup ──────────────────────────────────────────────────────────

	private setupEventHandlers(): void {
		this.levelSelect.onLevelSelect((id) => this.startLevel(id));
		this.levelSelect.onSandboxSelect(() => this.sandboxCb?.());

		this.hud.onRestart(() => this.restartLevel());
		this.hud.onPause(() => {
			if (this.simRunning) {
				this.gameLoop.isPaused = !this.gameLoop.isPaused;
			}
		});
		this.hud.onTimeScaleChange((scale) => {
			this.gameLoop.timeScale = scale;
		});

		this.resultOverlay.onReplay(() => this.restartLevel());
		this.resultOverlay.onLevelSelect(() => this.exitToLevelSelect());
		this.resultOverlay.onNextLevel(() => {
			if (!this.currentLevel) return;
			const nextNum = this.currentLevel.levelNumber + 1;
			// Search across all acts, not just current act
			const allLevels = [
				...this.levelManager.getLevelsByAct(1),
				...this.levelManager.getLevelsByAct(2),
				...this.levelManager.getLevelsByAct(3),
				...this.levelManager.getLevelsByAct(4),
			];
			const nextLevel = allLevels.find((l) => l.levelNumber === nextNum);
			if (nextLevel) {
				this.startLevel(nextLevel.id);
			} else {
				this.exitToLevelSelect();
			}
		});
	}

	private canvasClickHandler: ((e: MouseEvent) => void) | null = null;
	private wheelHandler: ((e: WheelEvent) => void) | null = null;
	private panState = { active: false, lastX: 0, lastY: 0 };
	private panDownHandler: ((e: MouseEvent) => void) | null = null;
	private panMoveHandler: ((e: MouseEvent) => void) | null = null;
	private panUpHandler: ((e: MouseEvent) => void) | null = null;
	private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

	private cleanupCanvasInteraction(): void {
		if (this.canvasClickHandler) {
			this.canvas.removeEventListener("click", this.canvasClickHandler);
			this.canvasClickHandler = null;
		}
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
		if (this.keydownHandler) {
			document.removeEventListener("keydown", this.keydownHandler);
			this.keydownHandler = null;
		}
	}

	private setupCanvasInteraction(): void {
		// Clean up previous handlers
		if (this.canvasClickHandler) {
			this.canvas.removeEventListener("click", this.canvasClickHandler);
		}
		if (this.wheelHandler) {
			this.canvas.removeEventListener("wheel", this.wheelHandler);
		}
		if (this.panDownHandler) {
			this.canvas.removeEventListener("mousedown", this.panDownHandler);
		}
		if (this.panMoveHandler) {
			this.canvas.removeEventListener("mousemove", this.panMoveHandler);
		}
		if (this.panUpHandler) {
			this.canvas.removeEventListener("mouseup", this.panUpHandler);
		}
		if (this.keydownHandler) {
			document.removeEventListener("keydown", this.keydownHandler);
		}

		// Placement clicks
		this.canvasClickHandler = (e) => this.handleCanvasClick(e);
		this.canvas.addEventListener("click", this.canvasClickHandler);

		// Zoom
		this.wheelHandler = (e) => {
			e.preventDefault();
			this.viewport.applyZoom(e.deltaY, { x: e.clientX, y: e.clientY });
		};
		this.canvas.addEventListener("wheel", this.wheelHandler, {
			passive: false,
		});

		// Pan (shift+left or middle click)
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

		// Keyboard shortcuts
		this.keydownHandler = (e: KeyboardEvent) => {
			if (this.screen !== "playing") return;
			switch (e.key) {
				case "Escape":
					e.preventDefault();
					if (this.screen === "playing") {
						if (this.simRunning) {
							const confirmed = window.confirm(
								"Return to menu? Progress on this level will be lost.",
							);
							if (!confirmed) break;
						}
						this.exitToMainMenu();
					}
					break;
				case " ":
					e.preventDefault();
					if (this.simRunning) {
						this.gameLoop.isPaused = !this.gameLoop.isPaused;
					}
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
			}
		};
		document.addEventListener("keydown", this.keydownHandler);
	}

	private updateLevelSelect(): void {
		const allLevels = [
			...this.levelManager.getLevelsByAct(1),
			...this.levelManager.getLevelsByAct(2),
			...this.levelManager.getLevelsByAct(3),
			...this.levelManager.getLevelsByAct(4),
		];

		// Find highest unlocked level number
		let highestUnlocked = 1;
		for (const level of allLevels) {
			if (this.levelManager.isUnlocked(level.id)) {
				highestUnlocked = Math.max(highestUnlocked, level.levelNumber);
			}
		}

		this.levelSelect.update(
			allLevels,
			this.levelManager.getAllProgress(),
			highestUnlocked,
		);
	}
}
