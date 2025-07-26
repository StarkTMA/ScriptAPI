import * as mc from "@minecraft/server";
import { NAMESPACE } from "anvilConstants";

export default function restoreInventory(entity: mc.Entity, id: string) {
	const blockLocation = entity.dimension.getBlockFromRay(entity.location, { x: 0, y: -1, z: 0 })!.block.location;
	blockLocation.y++;
	const blockLocation2 = { ...blockLocation, y: blockLocation.y + 1 };

	entity.runCommand(`structure load "${NAMESPACE}.${id}" ${blockLocation.x} ${blockLocation.y} ${blockLocation.z}`);
	entity.runCommand(`structure delete "${NAMESPACE}.${id}"`);

	const block = entity.dimension.getBlock(blockLocation)!;
	const block2 = entity.dimension.getBlock(blockLocation2)!;

	const equipment = entity.getComponent("minecraft:equippable") as mc.EntityEquippableComponent;
	const invComponent = entity.getComponent("minecraft:inventory") as mc.EntityInventoryComponent;
	const blockInventory = block.getComponent("minecraft:inventory") as mc.BlockInventoryComponent;
	const blockInventory2 = block2.getComponent("minecraft:inventory") as mc.BlockInventoryComponent;

	const slots = [mc.EquipmentSlot.Offhand, mc.EquipmentSlot.Head, mc.EquipmentSlot.Chest, mc.EquipmentSlot.Legs, mc.EquipmentSlot.Feet];

	if (equipment !== undefined) {
		slots.forEach((slot) => {
			equipment.setEquipment(slot, blockInventory.container!.getItem(slots.indexOf(slot))!);
		});
	}

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
	block.setPermutation(mc.BlockPermutation.resolve("minecraft:grass_block"));
	block2.setPermutation(mc.BlockPermutation.resolve("minecraft:grass_block"));

	block.setPermutation(mc.BlockPermutation.resolve("minecraft:air"));
	block2.setPermutation(mc.BlockPermutation.resolve("minecraft:air"));
}
