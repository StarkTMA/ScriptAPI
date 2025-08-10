import { Player, Entity, Block, Vector3, world } from "@minecraft/server";
import { calculateDistance, toUnsigned } from "../math";

export function getBlocksInASphere(centerBlock: Block | Entity, radius: number, innerRadius?: number) {
	if (centerBlock) {
		if (centerBlock instanceof Block && !centerBlock.isValid) return [];
		let center = centerBlock.location;
		let blocks: Block[] = [];
		for (let x = center.x - radius; x < center.x + radius; x++) {
			for (let y = center.y - radius; y < center.y + radius; y++) {
				for (let z = center.z - radius; z < center.z + radius; z++) {
					try {
						let block = centerBlock.dimension.getBlock({ x: x, y: y, z: z });
						if (
							block &&
							block.isValid &&
							!block.isAir &&
							!block.permutation.matches("minecraft:bedrock") &&
							!block.permutation.matches("minecraft:barrier") &&
							calculateDistance(center, block.location) <= radius &&
							(!innerRadius || calculateDistance(center, block.location) >= innerRadius)
						) {
							blocks.push(block);
						}
					} catch (e) {}
				}
			}
		}
		return blocks;
	}
	return [];
}

export function displayActionbar(player: Player | undefined, ...message: any) {
	const text = message.join(" ");
	let target;
	let selector;
	target = player && player.isValid ? player : world.getDimension("overworld");
	selector = player ? `@s` : `@a`;
	target.runCommand(`title @s actionbar ${JSON.stringify(text)}`);
}

/**
 * Snaps an angle to the nearest grid size.
 *
 * @param angle - The angle in degrees to be snapped.
 * @returns The snapped unsigned angle in degrees.
 */
export function snapRotationToGrid(angle: number): number {
	const gridSize = 90;
	return Math.round(toUnsigned(angle) / gridSize) * gridSize;
}

/**
 * Snaps a vector to the nearest integer coordinates.
 *
 * @param v - The vector to be snapped.
 * @returns A new vector with each component rounded to the nearest integer.
 */
export function snapLocationToGrid(v: Vector3): Vector3 {
	return { x: Math.round(v.x), y: Math.floor(v.y), z: Math.round(v.z) };
}
