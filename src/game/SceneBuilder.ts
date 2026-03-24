import type { Body, LevelConfig } from "@/types";

export interface SceneState {
	bodies: Body[];
	/** IDs of bodies the player can apply burns to */
	playerBodyIds: string[];
}

/**
 * Convert a LevelConfig into a runnable scene.
 *
 * Fixed bodies are taken directly from the config and converted to full Body
 * objects (adding trail buffers). Bodies with `isFixed: false` are considered
 * pre-placed player bodies and have their IDs added to `playerBodyIds`.
 *
 * `availableBodies` are templates for bodies the player will place interactively —
 * they are NOT added to the scene here. GameManager manages the placement queue.
 */
export function buildScene(config: LevelConfig): SceneState {
	const bodies: Body[] = [];
	const playerBodyIds: string[] = [];

	for (const bodyConfig of config.fixedBodies) {
		const isFixed = bodyConfig.isFixed;
		const trailMaxLength = isFixed ? 0 : 200;

		const body: Body = {
			...bodyConfig,
			trailPoints: [],
			trailMaxLength,
		};

		bodies.push(body);

		// Pre-placed non-fixed bodies (e.g. Level 08 probe) belong to the player
		if (!isFixed) {
			playerBodyIds.push(body.id);
		}
	}

	return { bodies, playerBodyIds };
}
