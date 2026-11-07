"use strict";

import "adaptive-extender/core";

//#region Naming conventions
export class NamingConventions {
	static #pascal: RegExp = /^[A-Z][a-zA-Z0-9]*$/;
	static #snake: RegExp = /^[a-z_][a-z0-9_]*$/;
	static #separator: RegExp = /[_\s]+/;
	static #upper: RegExp = /([A-Z])/g;
	static #underscore: RegExp = /^_/;
	static #separators: RegExp = /[_\s]+/g;

	static isPascalCase(name: string): boolean {
		return NamingConventions.#pascal.test(name);
	}

	static isSnakeCase(name: string): boolean {
		return NamingConventions.#snake.test(name);
	}

	static toPascalCase(value: string): string {
		return value
			.split(NamingConventions.#separator)
			.map(word => word.toTitleCase())
			.join(String.empty);
	}

	static toSnakeCase(value: string): string {
		const upper = NamingConventions.#upper;
		const separators = NamingConventions.#separators;
		upper.lastIndex = 0;
		separators.lastIndex = 0;
		return value
			.replace(upper, part => `_${part}`)
			.toLowerCase()
			.replace(NamingConventions.#underscore, String.empty)
			.replace(separators, "_");
	}
}
//#endregion
