import { getNamespace } from "./config";

/**
 * Gets the current namespace for the package.
 * This can be configured using setNamespace() from the config module.
 */
export function getPackageNamespace(): string {
	return getNamespace();
}