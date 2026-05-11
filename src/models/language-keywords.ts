"use strict";

import "adaptive-extender/node";

//#region Language keywords
export class LanguageKeywords {
	static #all: Set<string> = new Set([
		"if", "else", "while", "for", "in", "break", "continue",
		"return", "use", "from", "this", "true", "false", "null",
		"to", "as", "is"
	]);

	static has(keyword: string): boolean {
		return LanguageKeywords.#all.has(keyword);
	}

	static* values(): Iterable<string> {
		for (const keyword of LanguageKeywords.#all) yield keyword;
	}
}
//#endregion
