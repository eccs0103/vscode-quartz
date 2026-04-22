"use strict";

//#region Naming conventions
const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z0-9]*$/;
const SNAKE_CASE_REGEX = /^[a-z_][a-z0-9_]*$/;

export function isPascalCase(name: string): boolean {
	return PASCAL_CASE_REGEX.test(name);
}

export function isSnakeCase(name: string): boolean {
	return SNAKE_CASE_REGEX.test(name);
}

export function toPascalCase(value: string): string {
	return value.split(/[_\s]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
}

export function toSnakeCase(value: string): string {
	return value.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "").replace(/[_\s]+/g, "_");
}
//#endregion
