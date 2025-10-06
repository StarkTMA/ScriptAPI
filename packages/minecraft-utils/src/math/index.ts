import { RGB, RGBA, Vector3 } from "@minecraft/server";

/**
 * Converts an angle in degrees to radians.
 *
 * @param degrees - The angle in degrees to be converted.
 * @returns The angle in radians.
 */
export function toRadians(degrees: number): number {
	return degrees * (Math.PI / 180);
}

/**
 * Converts an angle in radians to degrees.
 *
 * @param radians - The angle in radians to be converted.
 * @returns The angle in degrees.
 */
export function calculateDistance(position1: Vector3, position2: Vector3): number {
	return Math.sqrt(
		Math.pow(position1.x - position2.x, 2) + Math.pow(position1.y - position2.y, 2) + Math.pow(position1.z - position2.z, 2)
	);
}

/**
 * Converts an angle in radians to degrees.
 *
 * @param radians - The angle in radians to be converted.
 * @returns The angle in degrees.
 */
export function toDegrees(radians: number): number {
	return radians * (180 / Math.PI);
}

/**
 * Converts a hex color string to an RGBA object.
 *
 * @param hex - The hex color string, which can be in the formats #RGB, #RGBA, #RRGGBB, or #RRGGBBAA.
 * @returns An object containing the red, green, blue, and alpha components as numbers between 0 and 1.
 * @throws Error if the hex string is invalid.
 */
export function hexToRgba(hex: string, stripAlpha: boolean = false): RGB | RGBA {
	if (!/^#([a-fA-F0-9]{4}|[a-fA-F0-9]{8}|[a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(hex)) {
		throw new Error("Invalid hex color");
	}

	let normalized = hex.slice(1);
	if (normalized.length === 3 || normalized.length === 4) {
		normalized = normalized
			.split("")
			.map((c) => c + c)
			.join("");
	}

	const red = parseInt(normalized.substring(0, 2), 16) / 255;
	const green = parseInt(normalized.substring(2, 4), 16) / 255;
	const blue = parseInt(normalized.substring(4, 6), 16) / 255;
	const alpha = (normalized.length === 8 ? parseInt(normalized.substring(6, 8), 16) : 255) / 255;

	if (stripAlpha) {
		return { red, green, blue };
	}
	return { red, green, blue, alpha };
}

/**
 * Clamps a value between a minimum and maximum range.
 *
 * @param value - The value to be clamped.
 * @param min - The minimum value of the range.
 * @param max - The maximum value of the range.
 * @returns The clamped value, which will be between `min` and `max`.
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/**
 * Converts an angle in degrees to its signed equivalent in the range [-180, 180].
 *
 * @param angle - The angle in degrees to be converted.
 * @returns The signed angle in degrees, normalized to the range [-180, 180].
 */
export function toSigned(angle: number): number {
	const wrapped = ((angle % 360) + 360) % 360;
	return wrapped > 180 ? wrapped - 360 : wrapped;
}

/**
 * Converts an angle in degrees to its unsigned equivalent in the range [0, 360].
 *
 * @param angle - The angle in degrees to be converted.
 * @returns The unsigned angle in degrees, normalized to the range [0, 360].
 */
export function toUnsigned(angle: number): number {
	return ((angle % 360) + 360) % 360;
}

/**
 * Calculates the shortest signed arc between two angles in degrees.
 *
 * @param from - The starting angle in degrees.
 * @param to - The target angle in degrees.
 * @returns The shortest arc in degrees from `from` to `to`.
 */
export function shortestArc(from: number, to: number): number {
	return -toSigned((to - from + 360) % 360);
}

/**
 * Checks if two positions are equal within a specified tolerance.
 *
 * @param a - The first position.
 * @param b - The second position.
 * @param tolerance - The tolerance for comparison (default is 0.5).
 * @returns `true` if the positions are equal within the tolerance, otherwise `false`.
 */
export function positionsEqual(a: Vector3, b: Vector3, tolerance: number = 0.5): boolean {
	return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance && Math.abs(a.z - b.z) < tolerance;
}

/**
 * Checks if a value is within a specified range.
 *
 * @param value - The value to check.
 * @param min - The minimum value of the range.
 * @param max - The maximum value of the range.
 * @returns `true` if the value is within the range [min, max], otherwise `false`.
 */
export function inRange(value: number, min: number, max: number): boolean {
	return value >= min && value <= max;
}

/**
 * A utility class for performing operations on 3D vectors.
 */
export class VectorOperations {
	static apply(v: Vector3, fn: (component: number) => number): Vector3 {
		return { x: fn(v.x), y: fn(v.y), z: fn(v.z) };
	}

	static add(v1: Vector3, v2: Vector3): Vector3 {
		return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z };
	}

	static subtract(v1: Vector3, v2: Vector3): Vector3 {
		return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z };
	}

	static multiply(v: Vector3, scalar: number): Vector3 {
		return VectorOperations.apply(v, (component) => component * scalar);
	}

	static stringify(v: Vector3): string {
		return `${v.x} ${v.y} ${v.z}`;
	}
}
