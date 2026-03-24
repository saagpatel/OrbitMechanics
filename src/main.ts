import { GameManager } from "@/game/GameManager";
import { SandboxManager } from "@/game/SandboxManager";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
if (!canvas) throw new Error("Canvas element #game-canvas not found");

const game = new GameManager(canvas);
let sandbox: SandboxManager | null = null;

game.init();

game.onSandboxRequested(() => {
	game.exitToLevelSelect();
	if (!sandbox) {
		sandbox = new SandboxManager(canvas);
		sandbox.init();
		sandbox.onExitRequested(() => {
			sandbox?.exitToLevelSelect();
			game.init();
		});
	}
	sandbox.enterSandbox();
});
