import {
	Player,
	Entity,
	Block,
	Vector3,
	world,
	StructureRotation,
	Vector2,
	BlockInventoryComponent,
	BlockPermutation,
	EntityEquippableComponent,
	EntityInventoryComponent,
	EquipmentSlot,
	ItemStack,
} from "@minecraft/server";
import { calculateDistance, toRadians, toSigned, toUnsigned } from "../math";

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
	target.runCommand(`title ${selector} actionbar ${JSON.stringify(text)}`);
}

/**
 * Snaps an angle to the nearest grid size.
 *
 * @param angle - The angle in degrees to be snapped.
 * @returns The snapped unsigned angle in degrees.
 */
export function snapYawToGrid(angle: number): number {
	const gridSize = 90;
	// Round to nearest grid step, then normalize into [0, 360)
	const snapped = Math.round(toUnsigned(angle) / gridSize) * gridSize;
	return ((snapped % 360) + 360) % 360;
}

/**
 * Snaps a vector to the nearest integer coordinates.
 *
 * @param v - The vector to be snapped.
 * @returns A new vector with each component rounded to the nearest integer.
 */
export function snapLocationToGrid(location: Vector3, yaw: Vector2, gridSize: number = 1): Vector3 {
	const snappedYaw = snapYawToGrid(yaw.y);
	const dx = Math.round(Math.sin(snappedYaw));
	const dz = Math.round(Math.cos(snappedYaw));

	return {
		x: Math.floor(location.x / gridSize) * gridSize,
		y: Math.floor(location.y / gridSize) * gridSize,
		z: Math.floor(location.z / gridSize) * gridSize,
	};
}

export function getStructureRotationEnum(angle: number, offset?: number): StructureRotation {
	const diff = snapYawToGrid(toUnsigned(angle - (offset ?? 0)));
	console.log(diff);

	if (Math.abs(diff - 90) < Number.EPSILON) return StructureRotation.Rotate90;
	if (Math.abs(diff - 180) < Number.EPSILON) return StructureRotation.Rotate180;
	if (Math.abs(diff - 270) < Number.EPSILON) return StructureRotation.Rotate270;
	return StructureRotation.None;
}

export function getRelativeMovementDirection(player: Player, round: boolean): Vector3 {
	const playerYaw = toRadians(player.getRotation().y);
	const { sin, cos } = { sin: Math.sin(playerYaw), cos: Math.cos(playerYaw) };

	const playerMovement = player.inputInfo.getMovementVector();

	const dx = -sin * playerMovement.y + cos * playerMovement.x;
	const dz = cos * playerMovement.y + sin * playerMovement.x;

	if (round) {
		return { x: Math.round(dx), y: 0, z: Math.round(dz) };
	}
	return { x: dx, y: 0, z: dz };
}

export function restoreInventory(entity: Entity, id: string) {
	const blockLocation = entity.dimension.getBlockFromRay(entity.location, { x: 0, y: -1, z: 0 })!.block.location;
	blockLocation.y++;
	const blockLocation2 = { ...blockLocation, y: blockLocation.y + 1 };

	const savedStructure = world.structureManager.get(id);
	if (savedStructure) world.structureManager.place(savedStructure, entity.dimension, blockLocation);
	world.structureManager.delete(id);

	const block = entity.dimension.getBlock(blockLocation)!;
	const block2 = entity.dimension.getBlock(blockLocation2)!;

	const equipment = entity.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent;
	const invComponent = entity.getComponent(EntityInventoryComponent.componentId) as EntityInventoryComponent;
	const blockInventory = block.getComponent(BlockInventoryComponent.componentId) as BlockInventoryComponent;
	const blockInventory2 = block2.getComponent(BlockInventoryComponent.componentId) as BlockInventoryComponent;

	const slots = Object.values(EquipmentSlot);
	slots.forEach((slot) => {
		equipment.setEquipment(slot, blockInventory.container!.getItem(slots.indexOf(slot))!);
	});

	Array(41)
		.fill(0)
		.forEach((_, i) => {
			if (i < invComponent.container!.size) {
				if (i < 9) {
					// First chest: starts filling from slot 5
					blockInventory.container!.moveItem(i + 5, i, invComponent.container!);
				} else {
					// Second chest: adjusts index for 0-26 range starting from slot 0
					blockInventory2.container!.moveItem(i - 9, i, invComponent.container!);
				}
			}
		});

	blockInventory.container!.clearAll();
	blockInventory2.container!.clearAll();
	block.setPermutation(BlockPermutation.resolve("minecraft:air"));
	block2.setPermutation(BlockPermutation.resolve("minecraft:air"));
}

export function saveInventory(entity: Entity, id: string, clearAll: boolean = false): number {
	const blockLocation = entity.dimension.getTopmostBlock(entity.location)!.location;
	blockLocation.y++;
	const blockLocation2 = { ...blockLocation, y: blockLocation.y + 1 };

	const block = entity.dimension.getBlock(blockLocation)!;
	const block2 = entity.dimension.getBlock(blockLocation2)!;

	block.setPermutation(BlockPermutation.resolve("minecraft:chest"));
	block2.setPermutation(BlockPermutation.resolve("minecraft:chest"));

	const equipment = entity.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent;
	const invComponent = entity.getComponent(EntityInventoryComponent.componentId) as EntityInventoryComponent;
	const blockInventory = block.getComponent(BlockInventoryComponent.componentId) as BlockInventoryComponent;
	const blockInventory2 = block2.getComponent(BlockInventoryComponent.componentId) as BlockInventoryComponent;

	const itemCount = invComponent.container!.size - invComponent.container!.emptySlotsCount;

	Object.values(EquipmentSlot).forEach((slot) => {
		if (clearAll) {
			equipment.setEquipment(slot);
		}
		blockInventory.container!.addItem(equipment.getEquipment(slot) ?? new ItemStack("minecraft:air", 1));
	});

	if (clearAll) {
	}

	Array(41)
		.fill(0)
		.forEach((_, i) => {
			if (i < invComponent.container!.size) {
				if (i < 9) {
					// First chest: starts filling from slot 5
					invComponent.container!.moveItem(i, 5 + i, blockInventory.container!);
				} else {
					// Second chest: adjusts index for 0-26 range starting from slot 0
					invComponent.container!.moveItem(i, i - 9, blockInventory2.container!);
				}
				if (clearAll) {
					invComponent.container!.setItem(i);
				}
			}
		});

	world.structureManager.delete(id);
	world.structureManager.createFromWorld(id, entity.dimension, blockLocation, blockLocation2);

	blockInventory.container!.clearAll();
	blockInventory2.container!.clearAll();

	block.setPermutation(BlockPermutation.resolve("minecraft:air"));
	block2.setPermutation(BlockPermutation.resolve("minecraft:air"));

	return itemCount;
}

export function getPositionRelative(entity: Entity, offset: Vector3): Vector3 {
	const yaw = toRadians(entity.getRotation().y);
	const pitch = toRadians(entity.getRotation().x);

	const x = entity.location.x + offset.x * Math.cos(pitch) * Math.cos(yaw) - offset.z * Math.sin(yaw);
	const y = entity.location.y + offset.x * Math.sin(pitch) + offset.y;
	const z = entity.location.z + offset.x * Math.cos(pitch) * Math.sin(yaw) + offset.z * Math.cos(yaw);

	return { x, y, z };
}
