import type { LevelConfig, LevelProgress } from "@/types";

/**
 * Manages level loading (from bundled JSON), unlock logic, and progress
 * persistence to localStorage.
 *
 * Level JSON files live in src/levels/**\/*.json and are bundled at build time
 * via import.meta.glob — no runtime fetch required.
 */
export class LevelManager {
	private allLevels: LevelConfig[] = [];
	private progress: Map<string, LevelProgress> = new Map();

	private static readonly STORAGE_KEY = "orbit_progress";

	/**
	 * Load all level JSON files (bundled by Vite) and restore persisted
	 * progress from localStorage. Safe to call multiple times.
	 */
	loadLevels(): void {
		// import.meta.glob returns {} when no files match — handled gracefully
		const levelModules = import.meta.glob<{ default: LevelConfig }>(
			"/src/levels/**/*.json",
			{ eager: true },
		);

		const configs: LevelConfig[] = [];

		for (const path of Object.keys(levelModules)) {
			const mod = levelModules[path];
			if (mod?.default) {
				configs.push(mod.default);
			}
		}

		// Sort by levelNumber so ordering is deterministic regardless of glob order
		configs.sort((a, b) => a.levelNumber - b.levelNumber);
		this.allLevels = configs;

		this.loadProgress();
	}

	/** Return a level config by its ID, or undefined if not found. */
	getLevel(id: string): LevelConfig | undefined {
		return this.allLevels.find((l) => l.id === id);
	}

	/** Return all levels belonging to a given act, in level order. */
	getLevelsByAct(act: 1 | 2 | 3 | 4): LevelConfig[] {
		return this.allLevels.filter((l) => l.act === act);
	}

	/**
	 * A level is unlocked if:
	 * - It is the first level (levelNumber === 1), OR
	 * - The previous level (by levelNumber) has been completed.
	 */
	isUnlocked(id: string): boolean {
		const level = this.getLevel(id);
		if (!level) return false;

		if (level.levelNumber === 1) return true;

		// Find the level with levelNumber === this.levelNumber - 1
		const prev = this.allLevels.find(
			(l) => l.levelNumber === level.levelNumber - 1,
		);
		if (!prev) return true; // No predecessor → treat as unlocked

		const prevProgress = this.progress.get(prev.id);
		return prevProgress?.completed === true;
	}

	/** Return persisted progress for a level, or undefined if never attempted. */
	getProgress(id: string): LevelProgress | undefined {
		return this.progress.get(id);
	}

	/**
	 * Record level completion and compute star rating.
	 * Only updates if the new star count exceeds the previous best.
	 * Returns the achieved star count (1 | 2 | 3).
	 */
	completeLevel(
		id: string,
		burnCount: number,
		fuelUsed: number,
		act: 1 | 2 | 3 | 4 = 1,
	): 1 | 2 | 3 {
		const level = this.getLevel(id);
		if (!level) return 1;

		const stars = computeStars(
			burnCount,
			level.parBurnCount,
			fuelUsed,
			level.fuelBudget,
			act,
		);
		const existing = this.progress.get(id);

		if (!existing || stars > existing.stars) {
			const updated: LevelProgress = {
				levelId: id,
				completed: true,
				bestBurnCount: burnCount,
				stars,
				completedAt: Date.now(),
			};
			this.progress.set(id, updated);
			this.saveProgress();
		}

		return stars;
	}

	/** Return an immutable view of all progress entries. */
	getAllProgress(): ReadonlyMap<string, LevelProgress> {
		return this.progress;
	}

	/** Wipe all progress and persist the cleared state. */
	resetProgress(): void {
		this.progress.clear();
		this.saveProgress();
	}

	// ── Private persistence helpers ──────────────────────────────────────────

	private loadProgress(): void {
		try {
			const raw = localStorage.getItem(LevelManager.STORAGE_KEY);
			if (!raw) return;

			const entries = JSON.parse(raw) as Array<[string, LevelProgress]>;
			this.progress = new Map(entries);
		} catch {
			// Corrupt or missing data — start fresh
			this.progress = new Map();
		}
	}

	private saveProgress(): void {
		try {
			const entries = Array.from(this.progress.entries());
			localStorage.setItem(LevelManager.STORAGE_KEY, JSON.stringify(entries));
		} catch {
			// localStorage unavailable (private browsing quota, etc.) — silently skip
		}
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeStars(
	burnCount: number,
	parBurnCount: number,
	fuelUsed: number,
	fuelBudget: number | undefined,
	act: 1 | 2 | 3 | 4,
): 1 | 2 | 3 {
	const underPar = burnCount <= parBurnCount;

	if (act === 1) {
		if (underPar) return 3;
		if (burnCount <= parBurnCount + 1) return 2;
		return 1;
	}

	// Act 2+: burns AND fuel efficiency
	const fuelEfficient =
		fuelBudget !== undefined ? fuelUsed <= fuelBudget * 0.8 : true;

	if (underPar && fuelEfficient) return 3;
	if (underPar) return 2;
	return 1;
}
