"use strict";

import "adaptive-extender/node";

//#region Naming conventions
export class NamingConventions {
	static #patternPascal: RegExp = /^[A-Z][a-zA-Z0-9]*$/;
	static #patternSnake: RegExp = /^[a-z_][a-z0-9_]*$/;
	static #patternWordSplit: RegExp = /[_\s]+/;
	static #patternUpper: RegExp = /([A-Z])/g;
	static #patternLeadingUnderscore: RegExp = /^_/;
	static #patternSnakeCleanup: RegExp = /[_\s]+/g;

	static isPascalCase(name: string): boolean {
		return NamingConventions.#patternPascal.test(name);
	}

	static isSnakeCase(name: string): boolean {
		return NamingConventions.#patternSnake.test(name);
	}

	static toPascalCase(value: string): string {
		return value
			.split(NamingConventions.#patternWordSplit)
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join("");
	}

	static toSnakeCase(value: string): string {
		const patternUpper = NamingConventions.#patternUpper;
		const patternSnakeCleanup = NamingConventions.#patternSnakeCleanup;
		patternUpper.lastIndex = 0;
		patternSnakeCleanup.lastIndex = 0;
		return value
			.replace(patternUpper, "_$1")
			.toLowerCase()
			.replace(NamingConventions.#patternLeadingUnderscore, "")
			.replace(patternSnakeCleanup, "_");
	}
}
//#endregion
