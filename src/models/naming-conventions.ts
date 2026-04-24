"use strict";

//#region Naming conventions
export class NamingConventions {
	static #pascal: RegExp = /^[A-Z][a-zA-Z0-9]*$/;
	static #snake: RegExp = /^[a-z_][a-z0-9_]*$/;
	static #wordSplitPattern: RegExp = /[_\s]+/;
	static #upperPattern: RegExp = /([A-Z])/g;
	static #leadingUnderscorePattern: RegExp = /^_/;
	static #snakeCleanupPattern: RegExp = /[_\s]+/g;

	static isPascalCase(name: string): boolean {
		return NamingConventions.#pascal.test(name);
	}

	static isSnakeCase(name: string): boolean {
		return NamingConventions.#snake.test(name);
	}

	static toPascalCase(value: string): string {
		return value.split(NamingConventions.#wordSplitPattern).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
	}

	static toSnakeCase(value: string): string {
		const upperPattern = NamingConventions.#upperPattern;
		const cleanupPattern = NamingConventions.#snakeCleanupPattern;
		upperPattern.lastIndex = 0;
		cleanupPattern.lastIndex = 0;
		return value.replace(upperPattern, "_$1").toLowerCase().replace(NamingConventions.#leadingUnderscorePattern, "").replace(cleanupPattern, "_");
	}
}
//#endregion
