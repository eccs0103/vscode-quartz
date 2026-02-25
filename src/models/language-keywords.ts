"use strict";

//#region Language keywords
export const KEYWORDS = new Set([
	'if', 'else', 'while', 'repeat', 'for', 'in', 'break', 'continue',
	'return', 'use', 'from', 'this', 'true', 'false', 'null'
]);

export const BUILT_IN_TYPES = new Set([
	'Number', 'String', 'Boolean', 'Any', 'Character', 'Sequence'
]);

export const BUILT_IN_FUNCTIONS = new Set([
	'write', 'read', 'range'
]);
//#endregion
