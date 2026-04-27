"use strict";

import "adaptive-extender/node";

//#region Overload picker
export class OverloadPicker {
	static pickFor(argCounts: number[], argCount: number): number {
		if (argCount < 0) return 0;
		for (let index = 0; index < argCounts.length; index++) {
			if (argCounts[index] === argCount) return index;
		}
		for (let index = 0; index < argCounts.length; index++) {
			if (argCounts[index] > argCount) return index;
		}
		return argCounts.length - 1;
	}

	static pickActive(argCounts: number[], argIndex: number): number {
		for (let index = 0; index < argCounts.length; index++) {
			if (argCounts[index] > argIndex) return index;
		}
		return argCounts.length - 1;
	}

	static argsAt(text: string, scanStart: number): number {
		let offset = scanStart;
		while (offset < text.length && (text[offset] === ' ' || text[offset] === '\t')) offset++;
		if (offset >= text.length || text[offset] !== '(') return -1;
		offset++;
		let depth = 0;
		let commas = 0;
		let hasContent = false;
		while (offset < text.length) {
			const char = text[offset];
			if (char === '"' || char === "'") {
				const quoteChar = char; offset++;
				while (offset < text.length && text[offset] !== quoteChar) { if (text[offset] === '\\') offset++; offset++; }
				hasContent = true;
			} else if (char === '(' || char === '[') { depth++; hasContent = true; }
			else if (char === ')' || char === ']') { if (depth === 0) break; depth--; hasContent = true; }
			else if (char === ',' && depth === 0) { commas++; hasContent = true; }
			else if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r') { hasContent = true; }
			offset++;
		}
		return hasContent ? commas + 1 : 0;
	}

	static argIndexAt(text: string, start: number, end: number): number {
		let depth = 0;
		let commas = 0;
		let cursor = start;
		while (cursor < end) {
			const char = text[cursor];
			if (char === '"' || char === "'") {
				const quoteChar = char; cursor++;
				while (cursor < end && text[cursor] !== quoteChar) { if (text[cursor] === '\\') cursor++; cursor++; }
			} else if (char === '(' || char === '[') { depth++; }
			else if (char === ')' || char === ']') { depth--; }
			else if (char === ',' && depth === 0) { commas++; }
			cursor++;
		}
		return commas;
	}
}
//#endregion
