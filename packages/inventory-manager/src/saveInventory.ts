import * as mc from "@minecraft/server";
import { NAMESPACE } from "anvilConstants";

export default function saveInventory(entity: mc.Entity, id: string): number {
	const blockLocation = entity.dimension.getBlockFromRay(entity.location, { x: 0, y: -1, z: 0 })!.block.location;
	blockLocation.y++;
	const blockLocation2 = { ...blockLocation, y: blockLocation.y + 1 };

	const block = entity.dimension.getBlock(blockLocation)!;
	const block2 = entity.dimension.getBlock(blockLocation2)!;

	block.setPermutation(mc.BlockPermutation.resolve("minecraft:chest"));
	block2.setPermutation(mc.BlockPermutation.resolve("minecraft:chest"));

	const equipment = entity.getComponent("minecraft:equippable") as mc.EntityEquippableComponent;
	const invComponent = entity.getComponent("minecraft:inventory") as mc.EntityInventoryComponent;
	const blockInventory = block.getComponent("minecraft:inventory") as mc.BlockInventoryComponent;
	const blockInventory2 = block2.getComponent("minecraft:inventory") as mc.BlockInventoryComponent;

	const slots = [mc.EquipmentSlot.Offhand, mc.EquipmentSlot.Head, mc.EquipmentSlot.Chest, mc.EquipmentSlot.Legs, mc.EquipmentSlot.Feet];
	const itemCount = invComponent.container!.size - invComponent.container!.emptySlotsCount;

	slots.forEach((slot) => {
		let item = equipment?.getEquipment(slot) ?? new mc.ItemStack("minecraft:air", 1);
		if (equipment !== undefined) {
			equipment.setEquipment(slot, new mc.ItemStack("minecraft:air", 1));
		}
		blockInventory.container!.addItem(item);
	});

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
			}
		});

	entity.runCommand(
		`structure save "${NAMESPACE}.${id}" ${blockLocation.x} ${blockLocation.y} ${blockLocation.z} ${blockLocation2.x} ${blockLocation2.y} ${blockLocation2.z} false disk`
	);

	blockInventory.container!.clearAll();
	blockInventory2.container!.clearAll();

	block.setPermutation(mc.BlockPermutation.resolve("minecraft:air"));
	block2.setPermutation(mc.BlockPermutation.resolve("minecraft:air"));

	return itemCount;
}
