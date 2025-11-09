import {
	Entity,
	Player,
	Vector3,
	Dimension,
	GameMode,
	EntityEquippableComponent,
	EquipmentSlot,
	StartupEvent,
	CustomComponentParameters,
	ItemComponentUseEvent,
} from "@minecraft/server";
import { toRadians, VectorOperations } from "@starktma/minecraft-utils/math";
import { getNamespace } from "../constants";

// ========================== Types and Interfaces =========================

export interface CustomProjectileItemParameters {
	identifier: string;
	spawn_event?: string;
	offset?: [number, number, number];
	power?: number;
	angle_offset?: number;
}

export type ProjectileItemCallback = (event: ItemComponentUseEvent, params: CustomComponentParameters) => void;

// ========================== Core Utility Functions ======================

/**
 * Calculate the launch direction for a projectile based on player rotation
 */
export function calculateLaunchDirection(rotation: { x: number; y: number }, angleOffset: number = 0): Vector3 {
	const yaw = toRadians(rotation.y);
	const pitch = toRadians(rotation.x);
	const adjustedPitch = pitch + toRadians(angleOffset);

	return {
		x: -Math.sin(yaw) * Math.cos(adjustedPitch),
		y: -Math.sin(adjustedPitch),
		z: Math.cos(yaw) * Math.cos(adjustedPitch),
	};
}

/**
 * Calculate spawn position for projectile with rotation-based offset
 */
export function calculateProjectileSpawnPosition(
	playerLocation: Vector3,
	rotation: { x: number; y: number },
	offset: [number, number, number] = [0, 0, 0]
): Vector3 {
	const yaw = toRadians(rotation.y);
	const pitch = toRadians(rotation.x);
	const pitchAdjustment = -Math.sin(pitch) * 0.5;

	const rawOffset: Vector3 = {
		x: offset[0],
		y: offset[1] + 1.7 + pitchAdjustment,
		z: offset[2],
	};

	const rotatedOffset: Vector3 = {
		x: rawOffset.x * Math.cos(yaw) - rawOffset.z * Math.sin(yaw),
		y: rawOffset.y,
		z: rawOffset.x * Math.sin(yaw) + rawOffset.z * Math.cos(yaw),
	};

	return VectorOperations.add(playerLocation, rotatedOffset);
}

/**
 * Apply velocity scaling to a direction vector
 */
export function scaleVelocity(direction: Vector3, power: number): Vector3 {
	return {
		x: direction.x * power * 2,
		y: direction.y * power,
		z: direction.z * power * 2,
	};
}

/**
 * Spawn a projectile entity with velocity
 */
export function spawnProjectile(
	dimension: Dimension,
	projectileId: string,
	spawnLocation: Vector3,
	velocity: Vector3,
	spawnEvent: string = "minecraft:entity_spawned"
): Entity | undefined {
	if (!dimension.isChunkLoaded(spawnLocation)) return undefined;

	const entity = dimension.spawnEntity(projectileId, spawnLocation, { spawnEvent });
	if (entity?.isValid) {
		entity.applyImpulse(velocity);
		return entity;
	}
	return undefined;
}

/**
 * Consume item from player's hand (creative mode safe)
 */
export function consumeItemStack(player: Player, itemStack: any): void {
	if (player.getGameMode() === GameMode.Creative) return;

	const equippable = player.getComponent(EntityEquippableComponent.componentId);
	if (!equippable) return;

	if (itemStack.amount > 1) {
		itemStack.amount--;
		equippable.setEquipment(EquipmentSlot.Mainhand, itemStack);
	} else {
		equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
	}
}

// ========================== Advanced Projectile Functions ===============

/**
 * Launch a projectile from a player with specified options
 */
export function launchProjectileFromPlayer(
	player: Player,
	options: CustomProjectileItemParameters
): Entity | undefined {
	const spawnLocation = calculateProjectileSpawnPosition(
		player.location,
		player.getRotation(),
		options.offset || [0, 0, 0]
	);

	const direction = calculateLaunchDirection(player.getRotation(), options.angle_offset || 0);

	const velocity = scaleVelocity(direction, (options.power || 1) * 0.2);

	return spawnProjectile(player.dimension, options.identifier, spawnLocation, velocity, options.spawn_event);
}

/**
 * Launch a projectile from any entity with manual direction
 */
export function launchProjectileFromEntity(
	entity: Entity,
	projectileId: string,
	direction: Vector3,
	power: number = 1,
	offset: [number, number, number] = [0, 0, 0],
	spawnEvent?: string
): Entity | undefined {
	const spawnLocation = VectorOperations.add(entity.location, {
		x: offset[0],
		y: offset[1],
		z: offset[2],
	});

	const velocity = scaleVelocity(direction, power * 0.2);

	return spawnProjectile(entity.dimension, projectileId, spawnLocation, velocity, spawnEvent);
}

/**
 * Launch a projectile from a specific location with direction
 */
export function launchProjectileFromLocation(
	dimension: Dimension,
	location: Vector3,
	projectileId: string,
	direction: Vector3,
	power: number = 1,
	spawnEvent?: string
): Entity | undefined {
	const velocity = scaleVelocity(direction, power * 0.2);

	return spawnProjectile(dimension, projectileId, location, velocity, spawnEvent);
}

// ========================== Custom Component Handlers ====================

// Simple map for item callbacks
const itemCallbacks = new Map<string, ProjectileItemCallback>();

/**
 * Register a callback for a specific item identifier
 */
export function registerProjectileItemCallback(itemId: string, callback: ProjectileItemCallback): void {
	itemCallbacks.set(itemId, callback);
}

/**
 * Handle custom projectile component use event
 */
export function handleCustomProjectileUse(
	event: ItemComponentUseEvent,
	params: CustomComponentParameters
): Entity | undefined {
	const player = event.source as Player;
	const itemStack = event.itemStack;
	const projectileParams = params.params as CustomProjectileItemParameters;

	// Launch projectile using default behavior
	const projectile = launchProjectileFromPlayer(player, projectileParams);

	// Handle item consumption
	if (projectile && itemStack) {
		consumeItemStack(player, itemStack);
	}

	// Check for registered callback for this item
	if (itemStack) {
		const callback = itemCallbacks.get(itemStack.typeId);
		if (callback) {
			callback(event, params);
		}
	}

	return projectile;
}

/**
 * Register the custom projectile component
 * Call this in your startup event to register the custom projectile throwing component
 */
export function registerCustomProjectileComponent(startup: StartupEvent): void {
	startup.itemComponentRegistry.registerCustomComponent(`${getNamespace()}:custom_projectile`, {
		onUse: handleCustomProjectileUse,
	});
}
