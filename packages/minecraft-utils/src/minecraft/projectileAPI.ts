import {
	Entity,
	Player,
	Vector3,
	Dimension,
	GameMode,
	EntityEquippableComponent,
	EquipmentSlot,
	StartupEvent,
	EntityProjectileComponent,
	system,
} from "@minecraft/server";
import { Trigonometry, Vector } from "@starktma/minecraft-utils/math";
import { getNamespace } from "../constants";

// ============================= Types =========================================

interface CustomProjectileItemParameters {
	identifier: string;
	spawn_event?: string;
	offset?: [number, number, number];
	power?: number;
	angle_offset?: number;
}

// ============================= ProjectileManager =============================

class ProjectileManager {
	private static instance: ProjectileManager;
	private static shotProjectiles: Map<
		string,
		{ entity: Entity; component: EntityProjectileComponent; velocity: Vector3 }
	> = new Map();

	static getInstance(): ProjectileManager {
		if (!ProjectileManager.instance) {
			ProjectileManager.instance = new ProjectileManager();
		}
		return ProjectileManager.instance;
	}

	private constructor() {}

	private calculateLaunchDirection(rotation: { x: number; y: number }, angleOffset: number = 0): Vector3 {
		const yaw = Trigonometry.radians(rotation.y);
		const pitch = Trigonometry.radians(rotation.x);
		const adjustedPitch = pitch + Trigonometry.radians(angleOffset);

		return {
			x: -Math.sin(yaw) * Math.cos(adjustedPitch),
			y: -Math.sin(adjustedPitch),
			z: Math.cos(yaw) * Math.cos(adjustedPitch),
		};
	}

	private calculateSpawnPosition(
		playerLocation: Vector3,
		rotation: { x: number; y: number },
		offset: Vector3 = { x: 0, y: 0, z: 0 }
	): Vector3 {
		const yaw = Trigonometry.radians(rotation.y);
		const pitch = Trigonometry.radians(rotation.x);
		const pitchAdjustment = -Math.sin(pitch) * 0.5;

		const rawOffset: Vector3 = {
			x: offset.x,
			y: offset.y + 1.7 + pitchAdjustment,
			z: offset.z,
		};

		const rotatedOffset: Vector3 = {
			x: rawOffset.x * Math.cos(yaw) - rawOffset.z * Math.sin(yaw),
			y: rawOffset.y,
			z: rawOffset.x * Math.sin(yaw) + rawOffset.z * Math.cos(yaw),
		};

		return Vector.add(playerLocation, rotatedOffset);
	}

	private scaleVelocity(direction: Vector3, power: number): Vector3 {
		return {
			x: direction.x * power * 2,
			y: direction.y * power,
			z: direction.z * power * 2,
		};
	}

	private consumeItem(player: Player, itemStack: any): void {
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

	// ============================= Public API ================================

	launchProjectile(
		player: Player,
		projectileId: string,
		options: {
			spawnEvent?: string;
			offset?: Vector3;
			power?: number;
			angleOffset?: number;
		} = {}
	): Entity | undefined {
		const spawnLocation = this.calculateSpawnPosition(
			player.location,
			player.getRotation(),
			options.offset || { x: 0, y: 0, z: 0 }
		);

		if (!player.dimension.isChunkLoaded(spawnLocation)) return undefined;

		const direction = this.calculateLaunchDirection(player.getRotation(), options.angleOffset || 0);
		const velocity = this.scaleVelocity(direction, (options.power || 1) * 0.2);

		const projectile = player.dimension.spawnEntity(projectileId, spawnLocation, {
			spawnEvent: options.spawnEvent || "minecraft:entity_spawned",
		});

		if (projectile?.isValid) {
			projectile.applyImpulse(velocity);
			return projectile;
		}

		return undefined;
	}

	launchProjectileFromEntity(
		entity: Entity,
		projectileId: string,
		direction: Vector3,
		power: number = 1,
		offset: Vector3 = { x: 0, y: 0, z: 0 },
		spawnEvent?: string
	): Entity | undefined {
		const spawnLocation = Vector.add(entity.location, offset);

		if (!entity.dimension.isChunkLoaded(spawnLocation)) return undefined;

		const velocity = this.scaleVelocity(direction, power * 0.2);

		const projectile = entity.dimension.spawnEntity(projectileId, spawnLocation, {
			spawnEvent: spawnEvent || "minecraft:entity_spawned",
		});

		if (projectile?.isValid) {
			const projectileComponent = projectile.getComponent(EntityProjectileComponent.componentId);
			projectileComponent?.shoot(velocity);
			return projectile;
		}

		return undefined;
	}

	launchProjectileFromLocation(
		dimension: Dimension,
		location: Vector3,
		projectileId: string,
		direction: Vector3,
		power: number = 1,
		spawnEvent?: string
	): Entity | undefined {
		if (!dimension.isChunkLoaded(location)) return undefined;

		const velocity = this.scaleVelocity(direction, power * 0.2);

		const projectile = dimension.spawnEntity(projectileId, location, {
			spawnEvent: spawnEvent || "minecraft:entity_spawned",
		});

		if (projectile?.isValid) {
			const projectileComponent = projectile.getComponent(EntityProjectileComponent.componentId)!;
			ProjectileManager.shotProjectiles.set(projectile.id, {
				entity: projectile,
				component: projectileComponent!,
				velocity,
			});
			projectile.applyImpulse(velocity);
			return projectile;
		}

		return undefined;
	}

	// ============================= System ====================================

	start(startup: StartupEvent): void {
		startup.itemComponentRegistry.registerCustomComponent(`${getNamespace()}:custom_projectile`, {
			onUse: (event, params) => {
				const player = event.source as Player;
				const itemStack = event.itemStack;
				const projectileParams = params.params as CustomProjectileItemParameters;

				const offset: Vector3 = projectileParams.offset
					? { x: projectileParams.offset[0], y: projectileParams.offset[1], z: projectileParams.offset[2] }
					: { x: 0, y: 0, z: 0 };

				const projectile = this.launchProjectile(player, projectileParams.identifier, {
					spawnEvent: projectileParams.spawn_event,
					offset,
					power: projectileParams.power,
					angleOffset: projectileParams.angle_offset,
				});

				if (projectile && itemStack) {
					this.consumeItem(player, itemStack);
				}

				return projectile;
			},
		});

		system.runInterval(() => {
			for (const [, { entity, component, velocity }] of ProjectileManager.shotProjectiles) {
				if (!entity.isValid) {
					ProjectileManager.shotProjectiles.delete(entity.id);
					continue;
				}
				entity.applyImpulse(Vector.scalarDivide(velocity, 2));
				velocity.y -= 0.01;
			}
		});
	}
}

const projectileManager = ProjectileManager.getInstance();

export { ProjectileManager, projectileManager };
