import { Entity, MolangVariableMap, Player, RGBA, system, world } from "@minecraft/server";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";
import { SimpleObject, SimpleDatabase } from "@starktma/minecraft-utils/database";

interface EffectObject extends SimpleObject {
	entityId: string;
	effectType: string;
	amplifier: number;
	duration: number;
	color: RGBA;
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

class EffectDatabase extends SimpleDatabase<EffectObject> {
	private static instance: EffectDatabase;

	private constructor() {
		super("effect_effects", undefined);
	}

	static getInstance(): EffectDatabase {
		if (!EffectDatabase.instance) {
			EffectDatabase.instance = new EffectDatabase();
		}
		return EffectDatabase.instance;
	}
}

class EffectManager {
	private database: EffectDatabase | null = null;
	private configs = new Map<string, EffectConfig>();
	static instance: EffectManager;

	static getInstance(): EffectManager {
		if (!EffectManager.instance) {
			EffectManager.instance = new EffectManager();
		}
		return EffectManager.instance;
	}

	private constructor() {}

	private getDatabase(): EffectDatabase {
		if (!this.database) {
			this.database = EffectDatabase.getInstance();
		}
		return this.database;
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
		const db = this.getDatabase();
		const effectId = `${entity.id}_${effectType}`;

		// Get config if registered
		const config = this.configs.get(effectType);

		// Use color from config if not provided
		const effectColor = config?.color || { red: 1, green: 1, blue: 1, alpha: 1 };

		// Find existing effect
		const existing = db.getAllObjects().find((e) => e.entityId === entity.id && e.effectType === effectType);

		const isNewEffect = !existing;
		const newEffect: EffectObject = {
			id: effectId,
			entityId: entity.id,
			effectType,
			amplifier,
			duration: duration * 20,
			color: effectColor,
		};

		if (!existing) {
			db.addObject(newEffect);

			// Add effect tag
			entity.addTag(`starktma_effects_${effectType}_${amplifier}_${duration * 20}`);

			// Play start sound if configured
			if (config?.sounds?.start) {
				try {
					entity.dimension.playSound(config.sounds.start, entity.location);
				} catch (error) {}
			}
		} else {
			// Update if stronger or longer
			if (existing.amplifier <= newEffect.amplifier) {
				if (existing.amplifier < newEffect.amplifier || existing.duration < newEffect.duration) {
					// Remove old tag
					entity
						.getTags()
						.filter((tag) => tag.startsWith(`starktma_effects_${effectType}_`))
						.forEach((tag) => {
							entity.removeTag(tag);
						});

					// Update database
					existing.amplifier = newEffect.amplifier;
					existing.duration = newEffect.duration;
					existing.color = newEffect.color;
					db.updateObject(existing);

					// Add new tag
					entity.addTag(`starktma_effects_${effectType}_${existing.amplifier}_${existing.duration}`);
				}
			}
		}
	}

	removeEffect(entity: Entity, effectType: string): void {
		const db = this.getDatabase();
		const effect = db.getAllObjects().find((e) => e.entityId === entity.id && e.effectType === effectType);
		if (effect) {
			// Play end sound if configured
			const config = this.configs.get(effectType);
			if (config?.sounds?.end) {
				try {
					entity.dimension.playSound(config.sounds.end, entity.location);
				} catch (error) {}
			}

			// Remove from database
			db.removeObject(effect.id);

			// Remove effect tags
			entity
				.getTags()
				.filter((tag) => tag.startsWith(`starktma_effects_${effectType}_`))
				.forEach((tag) => {
					entity.removeTag(tag);
				});
		}
	}

	removeAllEffects(entity: Entity): void {
		const db = this.getDatabase();
		const effects = db.getAllObjects().filter((e) => e.entityId === entity.id);
		effects.forEach((effect) => {
			// Play end sound if configured
			const config = this.configs.get(effect.effectType);
			if (config?.sounds?.end) {
				try {
					entity.dimension.playSound(config.sounds.end, entity.location);
				} catch (error) {}
			}

			// Remove from database
			db.removeObject(effect.id);
		});

		// Remove all effect tags for this entity
		entity
			.getTags()
			.filter((tag) => tag.startsWith("starktma_effects_"))
			.forEach((tag) => {
				entity.removeTag(tag);
			});
	}

	hasEffect(entity: Entity, effectType: string): boolean {
		const db = this.getDatabase();
		return db.getAllObjects().some((e) => e.entityId === entity.id && e.effectType === effectType);
	}

	getEffects(entity: Entity): EffectObject[] {
		const db = this.getDatabase();
		return db.getAllObjects().filter((e) => e.entityId === entity.id);
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

		// Get effects from tags instead of database
		const effectTags = entity.getTags().filter((tag) => tag.startsWith("starktma_effects_"));

		if (effectTags.length === 0) {
			entity.onScreenDisplay.setActionBar("§8[§7Effects§8] §7No active effects");
			return;
		}

		// Parse effect data from tags
		const effects = effectTags
			.map((tag) => {
				// Format: starktma_effects_${effectType}_${amplifier}_${duration}
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
			const effectName = effect.effectType
				.split("_")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");

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
			const db = this.getDatabase();

			for (const effect of db.getAllObjects()) {
				const entity = world.getEntity(effect.entityId);
				if (!entity) continue;
				this.debugShowEffects(entity);
				// Get config for this effect
				const config = this.configs.get(effect.effectType);

				// Display effect info
				const seconds = effect.duration / 20;

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
				effect.duration--;
				if (effect.duration <= 0) {
					// Play end sound when effect expires naturally
					if (config?.sounds?.end) {
						try {
							entity.dimension.playSound(config.sounds.end, entity.location);
						} catch (error) {}
					}

					// Remove from database
					db.removeObject(effect.id);

					// Remove effect tags
					entity
						.getTags()
						.filter((tag) => tag.startsWith(`starktma_effects_${effect.effectType}_`))
						.forEach((tag) => {
							entity.removeTag(tag);
						});
				} else {
					// Update database
					db.updateObject(effect);

					// Update effect tags
					entity
						.getTags()
						.filter((tag) => tag.startsWith(`starktma_effects_${effect.effectType}_`))
						.forEach((tag) => {
							entity.removeTag(tag);
						});
					entity.addTag(`starktma_effects_${effect.effectType}_${effect.amplifier}_${effect.duration}`);
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
