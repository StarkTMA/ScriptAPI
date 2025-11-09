import {
	CustomComponentParameters,
	Entity,
	ItemComponentConsumeEvent,
	MolangVariableMap,
	RGBA,
	StartupEvent,
	system,
	Vector3,
	world,
	Dimension,
} from "@minecraft/server";

// ========================== Potion Types =====================================

interface PotionItemParameters {
	amplifier: number;
	duration: number;
	potion_color: [number, number, number, number];
}

interface AreaEffectCloud {
	id: string;
	dimension: string;
	location: Vector3;
	color: RGBA;
	amplifier: number;
	duration: number;
	currentRadius: number;
	maxRadius: number;
	createdTick: number;
	maxLifetime: number;
	affectedEntities: Set<string>;
	handler: PotionEffectHandler;
}

export interface PotionConfig {
	effectKey: string; // machine key (lowercase, no spaces)
	namespace: string; // addon namespace
	handler: PotionEffectHandler; // function to apply the effect
	splashRange?: number; // splash potion radius (default: 4)
	lingeringMaxRadius?: number; // lingering cloud max radius (default: 3)
	lingeringLifetime?: number; // lingering cloud lifetime in ticks (default: 600 = 30s)
	lingeringDurationMultiplier?: number; // duration multiplier for lingering (default: 0.25)
}

export type PotionEffectHandler = (entity: Entity, amplifier: number, duration: number, color: RGBA) => void;

// ========================== Utility Functions ================================

/**
 * Parse effect key from projectile entity type ID
 */
export function parseProjectileTypeId(typeId: string): { namespace: string; effectKey: string } | null {
	const parts = typeId.split(":");
	if (parts.length !== 2) return null;

	const [namespace, entityName] = parts;
	if (!entityName.endsWith("_potion_entity")) return null;

	const effectKey = entityName.replace("_potion_entity", "");
	return { namespace, effectKey };
}

/**
 * Extract RGBA color from entity properties
 */
export function getColorFromEntity(entity: Entity, namespace: string): RGBA {
	return {
		red: entity.getProperty(`${namespace}:color_r`) as number,
		green: entity.getProperty(`${namespace}:color_g`) as number,
		blue: entity.getProperty(`${namespace}:color_b`) as number,
		alpha: entity.getProperty(`${namespace}:color_a`) as number,
	};
}

/**
 * Spawn splash particle effect
 */
export function spawnSplashParticle(dimension: Dimension, location: Vector3, color: RGBA, range: number): void {
	const variables = new MolangVariableMap();
	variables.setFloat("splash_range", range);
	variables.setFloat("splash_power", 1);
	variables.setColorRGBA("color", color);
	dimension.spawnParticle("minecraft:splash_spell_emitter", location, variables);
}

/**
 * Spawn lingering cloud particle effect
 */
export function spawnLingeringParticle(
	dimension: Dimension,
	location: Vector3,
	color: RGBA,
	radius: number,
	maxRadius: number,
	lifetime: number
): void {
	const variables = new MolangVariableMap();
	variables.setFloat("cloud_lifetime", lifetime / 20);
	variables.setFloat("cloud_radius", radius);
	variables.setFloat("particle_multiplier", radius / maxRadius);
	variables.setColorRGBA("color", color);
	dimension.spawnParticle("minecraft:mobspell_lingering", location, variables);
}

// ========================== Potion Manager ===================================

class PotionManager {
	private configs = new Map<string, PotionConfig>();
	private activeAOEClouds = new Map<string, AreaEffectCloud>();
	private cloudIdCounter = 0;
	private isRunning = false;

	/**
	 * Register a potion effect with its configuration and handler
	 */
	registerPotion(config: PotionConfig) {
		const key = `${config.namespace}:${config.effectKey}`;

		// Apply defaults
		const fullConfig: PotionConfig = {
			splashRange: 4,
			lingeringMaxRadius: 3,
			lingeringLifetime: 600,
			lingeringDurationMultiplier: 0.25,
			...config,
		};

		this.configs.set(key, fullConfig);
		return { handler: config.handler };
	}

	/**
	 * Start the potion system - must be called in beforeEvents.worldInitialize
	 */
	start(startup: StartupEvent): void {
		if (this.isRunning) return;
		this.isRunning = true;

		this.registerCustomComponents(startup);
		this.registerProjectileEvents();
		this.startCloudUpdater();
	}

	/**
	 * Get a registered potion configuration (public method)
	 */
	getConfig(effectKey: string, namespace: string): PotionConfig | undefined {
		return this.configs.get(`${namespace}:${effectKey}`);
	}

	private registerCustomComponents(startup: StartupEvent): void {
		// Register potion effect components
		for (const [, config] of this.configs.entries()) {
			const componentId = `${config.namespace}:${config.effectKey}_potion_effect`;
			startup.itemComponentRegistry.registerCustomComponent(componentId, {
				onConsume: (event, params) => this.handleConsume(event, params, config),
			});
		}
	}

	private registerProjectileEvents(): void {
		world.afterEvents.projectileHitBlock.subscribe((event) => {
			this.handleProjectileHit(event.projectile);
		});

		world.afterEvents.projectileHitEntity.subscribe((event) => {
			this.handleProjectileHit(event.projectile);
		});
	}

	private startCloudUpdater(): void {
		system.runInterval(() => {
			for (const cloud of this.activeAOEClouds.values()) {
				this.updateAreaEffectCloud(cloud);
			}
		});
	}

	private handleConsume(
		event: ItemComponentConsumeEvent,
		params: CustomComponentParameters,
		config: PotionConfig
	): void {
		const itemParams = params.params as PotionItemParameters;
		const color: RGBA = {
			red: itemParams.potion_color[0],
			green: itemParams.potion_color[1],
			blue: itemParams.potion_color[2],
			alpha: itemParams.potion_color[3],
		};

		config.handler(event.source, itemParams.amplifier, itemParams.duration, color);
	}

	/**
	 * Handle projectile hit (splash or lingering)
	 */
	private handleProjectileHit(projectile: Entity): void {
		const parsed = parseProjectileTypeId(projectile.typeId);
		if (!parsed) return;

		const config = this.getConfig(parsed.effectKey, parsed.namespace);
		if (!config) return;

		const potionType = projectile.getProperty(`${parsed.namespace}:type`) as number;

		switch (potionType) {
			case 1:
				this.handleSplashPotion(projectile, config);
				break;
			case 2:
				this.handleLingeringPotion(projectile, config);
				break;
			default:
				projectile.remove();
		}
	}

	/**
	 * Handle splash potion effect
	 */
	private handleSplashPotion(projectile: Entity, config: PotionConfig): void {
		const location = { ...projectile.location, y: projectile.location.y + 0.1 };
		const color = getColorFromEntity(projectile, config.namespace);
		const amplifier = projectile.getProperty(`${config.namespace}:amplifier`) as number;
		const duration = projectile.getProperty(`${config.namespace}:duration`) as number;

		spawnSplashParticle(projectile.dimension, location, color, config.splashRange!);

		const nearbyEntities = projectile.dimension.getEntities({
			excludeTypes: ["minecraft:item", "minecraft:arrow"],
			location: projectile.location,
			maxDistance: config.splashRange!,
		});

		for (const entity of nearbyEntities) {
			if (entity.id !== projectile.id) {
				config.handler(entity, amplifier, duration, color);
			}
		}

		projectile.remove();
	}

	/**
	 * Handle lingering potion effect (creates area cloud)
	 */
	private handleLingeringPotion(projectile: Entity, config: PotionConfig): void {
		const location = { ...projectile.location, y: projectile.location.y + 0.1 };
		const color = getColorFromEntity(projectile, config.namespace);
		const amplifier = projectile.getProperty(`${config.namespace}:amplifier`) as number;
		const duration = projectile.getProperty(`${config.namespace}:duration`) as number;

		const cloud: AreaEffectCloud = {
			id: `aoe_cloud_${this.cloudIdCounter++}`,
			dimension: projectile.dimension.id,
			location,
			color,
			amplifier,
			duration,
			currentRadius: config.lingeringMaxRadius!,
			maxRadius: config.lingeringMaxRadius!,
			createdTick: system.currentTick,
			maxLifetime: config.lingeringLifetime!,
			affectedEntities: new Set<string>(),
			handler: config.handler,
		};

		this.activeAOEClouds.set(cloud.id, cloud);
		projectile.remove();
	}

	/**
	 * Update lingering area effect cloud
	 */
	private updateAreaEffectCloud(cloud: AreaEffectCloud): void {
		const dimension = world.getDimension(cloud.dimension);
		const age = system.currentTick - cloud.createdTick;
		const ageProgress = Math.min(age / cloud.maxLifetime, 1);

		cloud.currentRadius = Math.max(0, cloud.maxRadius * (1 - ageProgress));

		if (age >= cloud.maxLifetime || cloud.currentRadius <= 0) {
			this.activeAOEClouds.delete(cloud.id);
			return;
		}

		spawnLingeringParticle(
			dimension,
			cloud.location,
			cloud.color,
			cloud.currentRadius,
			cloud.maxRadius,
			cloud.maxLifetime
		);

		if (age < 20) return; // Skip entity effects for first second

		this.applyCloudEffects(dimension, cloud);
	}

	private applyCloudEffects(dimension: Dimension, cloud: AreaEffectCloud): void {
		const nearbyEntities = dimension.getEntities({
			location: cloud.location,
			maxDistance: cloud.currentRadius + 1,
			excludeTypes: ["minecraft:item", "minecraft:arrow", "minecraft:xp_orb"],
		});

		for (const entity of nearbyEntities) {
			if (cloud.affectedEntities.has(entity.id)) continue;

			const reducedDuration = Math.floor(cloud.duration * 0.25);
			cloud.handler(entity, cloud.amplifier, reducedDuration, cloud.color);

			cloud.currentRadius = Math.max(0, cloud.currentRadius - 0.5);
			cloud.maxLifetime = Math.max(0, cloud.maxLifetime - 100);

			cloud.affectedEntities.add(entity.id);

			system.runTimeout(() => {
				cloud.affectedEntities.delete(entity.id);
			}, 60); // 3 seconds
		}
	}
}

const potionManager = new PotionManager();

export { PotionManager, potionManager };
