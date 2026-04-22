"use strict";

//#region LanguageKeywords
export class LanguageKeywords {
	static #all: ReadonlySet<string> = new Set([
		"if", "else", "while", "repeat", "for", "in", "break", "continue",
		"return", "use", "from", "this", "true", "false", "null",
		"to", "as", "is"
	]);

	static has(keyword: string): boolean {
		return LanguageKeywords.#all.has(keyword);
	}

	static values(): ReadonlySet<string> {
		return LanguageKeywords.#all;
	}
}
//#endregion
