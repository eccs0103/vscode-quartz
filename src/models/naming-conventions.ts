"use strict";

//#region NamingConventions
export class NamingConventions {
	static #pascal: RegExp = /^[A-Z][a-zA-Z0-9]*$/;
	static #snake: RegExp = /^[a-z_][a-z0-9_]*$/;

	static isPascalCase(name: string): boolean {
		return NamingConventions.#pascal.test(name);
	}

	static isSnakeCase(name: string): boolean {
		return NamingConventions.#snake.test(name);
	}

	static toPascalCase(value: string): string {
		return value.split(/[_\s]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
	}

	static toSnakeCase(value: string): string {
		return value.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "").replace(/[_\s]+/g, "_");
	}
}
//#endregion
