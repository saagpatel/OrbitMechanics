import type { GameHUD } from "@/ui/screens/GameHUD";
import type { LevelSelect } from "@/ui/screens/LevelSelect";
import type { MainMenu } from "@/ui/screens/MainMenu";
import type { SandboxUI } from "@/ui/screens/SandboxUI";
import type { Settings } from "@/ui/screens/Settings";

export type Screen =
	| "main_menu"
	| "level_select"
	| "game"
	| "sandbox"
	| "settings";

export class ScreenManager {
	private currentScreen: Screen = "main_menu";

	constructor(
		private readonly canvas: HTMLCanvasElement,
		private readonly mainMenu: MainMenu,
		private readonly levelSelect: LevelSelect,
		private readonly gameHUD: GameHUD,
		private readonly settings: Settings,
		private readonly sandboxUI?: SandboxUI,
	) {}

	showScreen(screen: Screen): void {
		this.currentScreen = screen;

		// Hide everything
		this.canvas.style.display = "none";
		this.mainMenu.hide();
		this.levelSelect.hide();
		this.gameHUD.hide();
		this.settings.hide();
		this.sandboxUI?.hide();

		// Show requested
		switch (screen) {
			case "main_menu":
				this.mainMenu.show();
				break;
			case "level_select":
				this.levelSelect.show();
				break;
			case "game":
				this.canvas.style.display = "block";
				this.gameHUD.show();
				break;
			case "sandbox":
				this.canvas.style.display = "block";
				this.sandboxUI?.show();
				break;
			case "settings":
				this.settings.show();
				break;
		}
	}

	getCurrentScreen(): Screen {
		return this.currentScreen;
	}
}
