import { Entity, MolangVariableMap, Player, RGBA, system, world } from "@minecraft/server";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";
import { SimpleDatabase } from "@starktma/minecraft-utils/database";
import { getNamespace } from "../constants";

interface EffectObject {
	id: string;
	entityId: string;
	effectType: string;
	amplifier: number;
	duration: number;
	color: RGBA;
}

interface EntityTracker {
	id: string;
}

class EffectEntityDatabase extends SimpleDatabase<EntityTracker> {
	private static instance: EffectEntityDatabase;

	private constructor() {
		super("effect_entities");
	}

	static getInstance(): EffectEntityDatabase {
		if (!EffectEntityDatabase.instance) {
			EffectEntityDatabase.instance = new EffectEntityDatabase();
		}
		return EffectEntityDatabase.instance;
	}
}

interface EffectSounds {
	ambient?: string; // Sound that plays periodically while effect is active
	start?: string; // Sound that plays when effect is first applied
	end?: string; // Sound that plays when effect expires
}

interface EffectConfig {
	effectType: string;
	color: RGBA;
	sounds?: EffectSounds;
	particleType?: string; // Custom particle type (defaults to minecraft:mobspell_emitter)
	handler: EffectHandler;
}

type EffectHandler = (entity: Entity, effect: EffectObject) => void;

class EffectManager {
	private configs = new Map<string, EffectConfig>();
	private entityDB: EffectEntityDatabase | null = null;
	static instance: EffectManager;

	static getInstance(): EffectManager {
		if (!EffectManager.instance) {
			EffectManager.instance = new EffectManager();
		}
		return EffectManager.instance;
	}

	private constructor() {}

	private getEntityDatabase(): EffectEntityDatabase {
		if (!this.entityDB) {
			this.entityDB = EffectEntityDatabase.getInstance();
		}
		return this.entityDB;
	}

	/**
	 * Track an entity as having effects
	 * @param entity - The entity to track
	 */
	private trackEntity(entity: Entity): void {
		const db = this.getEntityDatabase();
		const tracker: EntityTracker = {
			id: entity.id,
		};

		if (!db.hasObject(entity.id)) {
			db.addObject(tracker);
		}
	}

	/**
	 * Stop tracking an entity (when it has no more effects)
	 * @param entity - The entity to stop tracking
	 */
	private untrackEntity(entity: Entity): void {
		const db = this.getEntityDatabase();
		if (db.hasObject(entity.id)) {
			db.removeObject(entity.id);
		}
	}

	/**
	 * Check if an entity has any effect tags
	 * @param entity - The entity to check
	 * @returns True if entity has any effect tags
	 */
	private entityHasEffectTags(entity: Entity): boolean {
		return entity.getTags().some((tag) => tag.includes("starkteffects"));
	}

	/**
	 * Parse effect data from entity tags regardless of namespace
	 * @param entity - The entity to get effects from
	 * @returns Array of effect objects parsed from all effect tags
	 */
	private getEffectsFromTags(entity: Entity): EffectObject[] {
		return entity
			.getTags()
			.filter((tag) => tag.includes("starkteffects"))
			.map((tag) => {
				const parts = tag.split("_");
				if (parts.length < 4) return null;

				// Find the namespace and effects parts
				const effectsIndex = parts.findIndex((part) => part === "starkteffects");
				if (effectsIndex === -1 || effectsIndex === 0 || effectsIndex >= parts.length - 2) return null;

				const namespace = parts.slice(0, effectsIndex).join("_");
				const effectType = parts.slice(effectsIndex + 1, -2).join("_");
				const amplifier = parseInt(parts[parts.length - 2]);
				const duration = parseInt(parts[parts.length - 1]);
				const config = this.configs.get(effectType);

				return {
					id: `${entity.id}_${effectType}`,
					entityId: entity.id,
					effectType,
					amplifier,
					duration,
					color: config?.color || { red: 1, green: 1, blue: 1, alpha: 1 },
				};
			})
			.filter((effect) => effect !== null) as EffectObject[];
	}

	/**
	 * Parse ALL effect data from entity tags regardless of namespace
	 * @param entity - The entity to get effects from
	 * @returns Array of effect objects parsed from all effect tags
	 */
	private getAllEffectsFromTags(entity: Entity): EffectObject[] {
		return entity
			.getTags()
			.filter((tag) => tag.includes("starkteffects"))
			.map((tag) => {
				const parts = tag.split("_");
				if (parts.length < 4) return null;

				// Find the namespace and effects parts
				const effectsIndex = parts.findIndex((part) => part === "starkteffects");
				if (effectsIndex === -1 || effectsIndex === 0 || effectsIndex >= parts.length - 2) return null;

				const namespace = parts.slice(0, effectsIndex).join("_");
				const effectType = parts.slice(effectsIndex + 1, -2).join("_");
				const amplifier = parseInt(parts[parts.length - 2]);
				const duration = parseInt(parts[parts.length - 1]);
				const config = this.configs.get(effectType);

				return {
					id: `${entity.id}_${effectType}`,
					entityId: entity.id,
					effectType,
					amplifier,
					duration,
					color: config?.color || { red: 1, green: 1, blue: 1, alpha: 1 },
				};
			})
			.filter((effect) => effect !== null) as EffectObject[];
	}

	/**
	 * Register a effect effect with full configuration
	 * @param config - Complete effect configuration including effect type, color, sounds, particle type, and handler
	 * @returns Helper functions for adding, removing, and applying the effect
	 */
	registerEffect(config: EffectConfig) {
		this.configs.set(config.effectType, config);

		return {
			addEffect: (entity: Entity, amplifier: number, duration: number) => {
				this.addEffect(entity, config.effectType, amplifier, duration);
			},
			removeEffect: (entity: Entity) => {
				this.removeEffect(entity, config.effectType);
			},
			applyEffect: config.handler,
		};
	}

	addEffect(entity: Entity, effectType: string, amplifier: number, duration: number): void {
		// Get config if registered
		const config = this.configs.get(effectType);
		const currentNamespace = getNamespace();

		// Find existing effect from tags
		const existingTag = entity
			.getTags()
			.find((tag) => tag.startsWith(`${currentNamespace}_starkteffects_${effectType}_`));

		if (existingTag) {
			// Parse existing effect
			const parts = existingTag.split("_");
			if (parts.length >= 4) {
				const existingAmplifier = parseInt(parts[parts.length - 2]);
				const existingDuration = parseInt(parts[parts.length - 1]);

				// Update if stronger or longer
				if (amplifier > existingAmplifier || (amplifier === existingAmplifier && duration * 20 > existingDuration)) {
					// Remove old tag and add new one
					entity.removeTag(existingTag);
					entity.addTag(`${currentNamespace}_starkteffects_${effectType}_${amplifier}_${duration * 20}`);
				}
			}
		} else {
			// New effect - add tag
			entity.addTag(`${currentNamespace}_starkteffects_${effectType}_${amplifier}_${duration * 20}`);

			// Play start sound if configured
			if (config?.sounds?.start) {
				try {
					entity.dimension.playSound(config.sounds.start, entity.location);
				} catch (error) {}
			}
		}

		// Track this entity as having effects
		this.trackEntity(entity);
	}

	removeEffect(entity: Entity, effectType: string): void {
		const currentNamespace = getNamespace();

		// Find and remove effect tags
		const effectTags = entity
			.getTags()
			.filter((tag) => tag.startsWith(`${currentNamespace}_starkteffects_${effectType}_`));

		if (effectTags.length > 0) {
			// Play end sound if configured
			const config = this.configs.get(effectType);
			if (config?.sounds?.end) {
				try {
					entity.dimension.playSound(config.sounds.end, entity.location);
				} catch (error) {}
			}

			// Remove effect tags
			effectTags.forEach((tag) => {
				entity.removeTag(tag);
			});

			// Check if entity still has any effects, untrack if not
			if (!this.entityHasEffectTags(entity)) {
				this.untrackEntity(entity);
			}
		}
	}

	removeAllEffects(entity: Entity): void {
		const currentNamespace = getNamespace();

		// Get all effect tags
		const effectTags = entity.getTags().filter((tag) => tag.startsWith(`${currentNamespace}_starkteffects_`));

		// Play end sounds for each effect type
		const effectTypes = new Set<string>();
		effectTags.forEach((tag) => {
			const parts = tag.split("_");
			if (parts.length >= 4) {
				const effectType = parts.slice(2, -2).join("_");
				effectTypes.add(effectType);
			}
		});

		effectTypes.forEach((effectType) => {
			const config = this.configs.get(effectType);
			if (config?.sounds?.end) {
				try {
					entity.dimension.playSound(config.sounds.end, entity.location);
				} catch (error) {}
			}
		});

		// Remove all effect tags
		effectTags.forEach((tag) => {
			entity.removeTag(tag);
		});

		// Untrack this entity since it has no more effects
		this.untrackEntity(entity);
	}

	extendEffect(entity: Entity, effectType: string, additionalDuration: number): boolean {
		// Debug: Show all tags on the entity
		const allTags = entity.getTags();

		// Find effect tags of any namespace
		const effectTags = entity.getTags().filter((tag) => {
			// Tag format: {namespace}_starkteffects_{effectType}_{amplifier}_{duration}
			// We need to find the "_starkteffects_" marker and work from there
			const effectsIndex = tag.indexOf("_starkteffects_");
			if (effectsIndex === -1) return false;

			// Extract parts after "_starkteffects_"
			const afterEffects = tag.substring(effectsIndex + 15); // 15 = "_starkteffects_".length
			const parts = afterEffects.split("_");

			// Need at least 3 parts: effectType, amplifier, duration
			// But effectType might contain underscores, so amplifier and duration are the last 2 parts
			if (parts.length < 3) return false;

			// Extract effect type (everything except the last 2 parts which are amplifier and duration)
			const tagEffectType = parts.slice(0, -2).join("_");

			return tagEffectType === effectType;
		});

		if (effectTags.length === 0) return false;

		// For each matching effect tag, extend its duration
		effectTags.forEach((tag) => {
			// Tag format: {namespace}_starkteffects_{effectType}_{amplifier}_{duration}
			const effectsIndex = tag.indexOf("_starkteffects_");
			const namespace = tag.substring(0, effectsIndex);

			const afterEffects = tag.substring(effectsIndex + 15); // 15 = "_starkteffects_".length
			const parts = afterEffects.split("_");

			// Last two parts are always amplifier and duration
			const amplifier = parseInt(parts[parts.length - 2]);
			const currentDuration = parseInt(parts[parts.length - 1]);
			const newDuration = currentDuration + additionalDuration;

			// Remove old tag and add new one with extended duration
			entity.removeTag(tag);
			const newTag = `${namespace}_starkteffects_${effectType}_${amplifier}_${newDuration}`;
			entity.addTag(newTag);
		});
		return true;
	}

	hasEffect(entity: Entity, effectType: string): boolean {
		const currentNamespace = getNamespace();
		return entity.getTags().some((tag) => tag.startsWith(`${currentNamespace}_starkteffects_${effectType}_`));
	}

	getEffects(entity: Entity): EffectObject[] {
		return this.getAllEffectsFromTags(entity);
	}

	/**
	 * Debug function to display all active effects for an entity in the action bar
	 * @param entity - The entity to display effects for (must be a Player)
	 */
	debugShowEffects(entity: Entity): void {
		// Only works for players
		if (!(entity instanceof Player)) {
			return;
		}

		const currentNamespace = getNamespace();
		// Get effects from tags instead of database
		const effectTags = entity.getTags().filter((tag) => tag.includes(`starkteffects`));

		if (effectTags.length === 0) {
			entity.onScreenDisplay.setActionBar("§8[§7Effects§8] §7No active effects");
			return;
		}

		// Parse effect data from tags
		const effects = effectTags
			.map((tag) => {
				// Format: namespace_starkteffects_${effectType}_${amplifier}_${duration}
				const parts = tag.split("_");
				if (parts.length < 4) return null;

				const effectType = parts.slice(2, -2).join("_"); // Handle effect types with underscores
				const amplifier = parseInt(parts[parts.length - 2]);
				const duration = parseInt(parts[parts.length - 1]);

				return { effectType, amplifier, duration };
			})
			.filter((effect) => effect !== null);

		if (effects.length === 0) {
			entity.onScreenDisplay.setActionBar("§8[§7Effects§8] §7No active effects");
			return;
		}

		// Sort effects by remaining duration (longest first)
		const sortedEffects = effects.sort((a, b) => b.duration - a.duration);

		const effectStrings = sortedEffects.map((effect) => {
			const seconds = Math.ceil(effect.duration / 20);
			const minutes = Math.floor(seconds / 60);
			const remainingSeconds = seconds % 60;

			// Format time with different colors based on urgency
			let timeString: string;
			let timeColor: string;

			if (seconds > 60) {
				timeString = `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
				timeColor = "§a"; // Green for long duration
			} else if (seconds > 10) {
				timeString = `${seconds}s`;
				timeColor = "§e"; // Yellow for medium duration
			} else {
				timeString = `${seconds}s`;
				timeColor = "§c"; // Red for short duration
			}

			// Format effect name with proper capitalization
			const effectName = effect.effectType.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1))[1];

			// Format amplifier with Roman numerals for style
			const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
			const amplifierDisplay =
				effect.amplifier < romanNumerals.length ? romanNumerals[effect.amplifier] : (effect.amplifier + 1).toString();

			return `§6${effectName}§r §7${amplifierDisplay}§r §8(${timeColor}${timeString}§8)§r`;
		});

		// Create a formatted display with header and effects
		const header = "§8[§bActive Effects§8]§r";
		const effectsDisplay = effectStrings.join("\n");

		const displayText = `${header}\n${effectsDisplay}`;
		entity.onScreenDisplay.setActionBar(displayText);
	}

	start(): void {
		if (!EffectManager.instance) return;

		system.runInterval(() => {
			const entityDB = this.getEntityDatabase();
			const trackedEntityIds = entityDB.getAllObjects();

			for (const tracker of trackedEntityIds) {
				const entity = world.getEntity(tracker.id);

				// If entity doesn't exist, clean up tracking
				if (!entity) continue;

				// Check if entity still has effect tags (cleanup orphaned tracking)
				if (!this.entityHasEffectTags(entity)) {
					entityDB.removeObject(tracker.id);
					continue;
				}

				this.debugShowEffects(entity);

				const effects = this.getEffectsFromTags(entity).filter((effect) => {
					// Only process effects from current namespace
					const currentNamespace = getNamespace();
					return entity
						.getTags()
						.some((tag) => tag.startsWith(`${currentNamespace}_starkteffects_${effect.effectType}_`));
				});

				for (const effect of effects) {
					// Get config for this effect
					const config = this.configs.get(effect.effectType);

					// Apply effect handler
					if (config?.handler) {
						config.handler(entity, effect);
					}

					// Play ambient sound periodically (every 2 seconds)
					if (config?.sounds?.ambient && system.currentTick % 40 === 0) {
						try {
							entity.dimension.playSound(config.sounds.ambient, entity.location, { volume: 0.5 });
						} catch (error) {}
					}

					// Spawn particles
					if (system.currentTick % 2 === 0) {
						const particleLocation = entity.location;
						particleLocation.y++;
						const variables = new MolangVariableMap();
						variables.setColorRGBA("color", effect.color);

						const particleType = config?.particleType || "minecraft:mobspell_emitter";
						try {
							entity.dimension.spawnParticle(particleType, particleLocation, variables);
						} catch (error) {}
					}

					// Update duration
					const newDuration = effect.duration - 1;

					if (newDuration <= 0) {
						// Play end sound when effect expires naturally
						if (config?.sounds?.end) {
							try {
								entity.dimension.playSound(config.sounds.end, entity.location);
							} catch (error) {}
						}

						// Remove expired effect tag
						const currentNamespace = getNamespace();
						entity.removeTag(
							`${currentNamespace}_starkteffects_${effect.effectType}_${effect.amplifier}_${effect.duration}`
						);
					} else {
						// Update tag with new duration
						const currentNamespace = getNamespace();
						entity.removeTag(
							`${currentNamespace}_starkteffects_${effect.effectType}_${effect.amplifier}_${effect.duration}`
						);
						entity.addTag(`${currentNamespace}_starkteffects_${effect.effectType}_${effect.amplifier}_${newDuration}`);
					}
				}

				// Clean up tracking if entity has no more effects
				if (!this.entityHasEffectTags(entity)) {
					entityDB.removeObject(tracker.id);
				}
			}
		});

		world.afterEvents.itemCompleteUse.subscribe((event) => {
			if (event.itemStack.typeId === MinecraftItemTypes.MilkBucket) {
				this.removeAllEffects(event.source);
			}
		});
	}
}

export { EffectManager, EffectObject, EffectConfig, EffectSounds };
