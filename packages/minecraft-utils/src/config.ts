/**
 * Configuration for minecraft-utils package.
 * This allows consumers to set a custom namespace for their project.
 */

let _namespace: string = "starktma"; // Default namespace

/**
 * Sets the namespace for this package instance.
 * This should be called once at the beginning of your application.
 *
 * @param namespace - The namespace to use for this package
 *
 * @example
 * ```typescript
 * import { setNamespace } from "@starktma/minecraft-utils/config";
 *
 * // Set your custom namespace
 * setNamespace("myproject");
 * ```
 */
export function setNamespace(namespace: string): void {
	if (!namespace || typeof namespace !== "string") {
		throw new Error("Namespace must be a non-empty string");
	}
	_namespace = namespace;
}

/**
 * Gets the current namespace.
 *
 * @returns The current namespace
 */
export function getNamespace(): string {
	return _namespace;
}
