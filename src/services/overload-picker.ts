"use strict";

import "adaptive-extender/core";

//#region Overload picker
export class OverloadPicker {
	static pickFor(counts: number[], count: number): number {
		if (count < 0) return 0;
		for (let index = 0; index < counts.length; index++) {
			if (counts[index] === count) return index;
		}
		for (let index = 0; index < counts.length; index++) {
			if (counts[index] > count) return index;
		}
		return counts.length - 1;
	}

	static pickActive(counts: number[], active: number): number {
		for (let index = 0; index < counts.length; index++) {
			if (counts[index] > active) return index;
		}
		return counts.length - 1;
	}

	static countAt(text: string, start: number): number {
		let offset = start;
		while (offset < text.length && (text[offset] === ' ' || text[offset] === '\t')) offset++;
		if (offset >= text.length || text[offset] !== '(') return -1;
		offset++;
		let depth = 0;
		let commas = 0;
		let hasContent = false;
		while (offset < text.length) {
			const char = text[offset];
			if (char === '"' || char === "'") {
				const quote = char; offset++;
				while (offset < text.length && text[offset] !== quote) { if (text[offset] === '\\') offset++; offset++; }
				hasContent = true;
			} else if (char === '(' || char === '[') { depth++; hasContent = true; }
			else if (char === ')' || char === ']') { if (depth === 0) break; depth--; hasContent = true; }
			else if (char === ',' && depth === 0) { commas++; hasContent = true; }
			else if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r') { hasContent = true; }
			offset++;
		}
		return hasContent ? commas + 1 : 0;
	}

	static indexAt(text: string, start: number, end: number): number {
		let depth = 0;
		let commas = 0;
		let cursor = start;
		while (cursor < end) {
			const char = text[cursor];
			if (char === '"' || char === "'") {
				const quote = char; cursor++;
				while (cursor < end && text[cursor] !== quote) { if (text[cursor] === '\\') cursor++; cursor++; }
			} else if (char === '(' || char === '[') { depth++; }
			else if (char === ')' || char === ']') { depth--; }
			else if (char === ',' && depth === 0) { commas++; }
			cursor++;
		}
		return commas;
	}
}
//#endregion
