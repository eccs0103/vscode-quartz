"use strict";

import "adaptive-extender/core";

//#region Line formatter
export class LineFormatter {
	static #indent: RegExp = /^\s*/;
	static #keyword: RegExp = /\b(if|else|while|for|in)$/;
	static #operator: RegExp = /[:=!&|<>]/;
	static #unary: RegExp = /[\s(,:]$/;
	static #pascal: RegExp = /[A-Z][a-zA-Z0-9_]*$/;
	static #capital: RegExp = /^[A-Z]/;
	static #before: RegExp = /[a-zA-Z0-9_)>]/;
	static #after: RegExp = /[a-zA-Z0-9_"(<]/;
	static #spaces: RegExp = /\s+/g;
	static #punctuation: RegExp = /\s+([;,)])/g;

	static format(line: string): string {
		const indent = line.match(LineFormatter.#indent)?.[0] ?? String.empty;
		const content = line.trim();

		let inString = false;
		let openQuote = String.empty;
		let result = String.empty;
		let typeDepth = 0;

		for (let offset = 0; offset < content.length; offset++) {
			const char = content[offset];
			const next = offset < content.length - 1 ? content[offset + 1] : String.empty;

			if ((char === '"' || char === "'") && (offset === 0 || content[offset - 1] !== "\\")) {
				if (!inString) {
					inString = true;
					openQuote = char;
				} else if (openQuote === char) {
					inString = false;
					openQuote = String.empty;
				} else {
					result += char;
					continue;
				}
				result += char;
				continue;
			}

			if (inString) { result += char; continue; }

			if (char === "(" && offset > 0 && LineFormatter.#keyword.test(result) && result[result.length - 1] !== " ") result += " ";

			if (char === ",") {
				result += char;
				if (next && next !== " ") result += " ";
				continue;
			}

			if (char === "/" && next === "/") {
				if (result.length > 0 && result[result.length - 1] !== " ") result += " ";
				result += content.substring(offset);
				break;
			}

			if (LineFormatter.#operator.test(char) || char === "+" || char === "-" || char === "*" || char === "/") {
				const lastChar = result[result.length - 1];
				const isUnary = (char === "+" || char === "-" || char === "!") && (LineFormatter.#unary.test(result) || result.length === 0);
				const isGenericOpen = char === "<" && (LineFormatter.#pascal.test(result) || LineFormatter.#capital.test(next));
				const isGenericClose = char === ">" && typeDepth > 0;

				if (isUnary) {
					result += char;
				} else if (isGenericOpen) {
					typeDepth++;
					result += char;
				} else if (isGenericClose) {
					typeDepth--;
					result += char;
				} else {
					if (lastChar && lastChar !== " " && LineFormatter.#before.test(lastChar)) result += " ";
					result += char;
					if ((char === "<" || char === ">" || char === "!" || char === "=") && next === "=") {
						result += next;
						offset++;
						if (offset < content.length - 1 && content[offset + 1] !== " ") result += " ";
						continue;
					}
					if (next && next !== " " && LineFormatter.#after.test(next)) result += " ";
				}
				continue;
			}

			result += char;
		}

		const start = result.indexOf("//");
		const spaces = LineFormatter.#spaces;
		const punctuation = LineFormatter.#punctuation;
		spaces.lastIndex = 0;
		punctuation.lastIndex = 0;
		if (start !== -1) {
			const code = result.substring(0, start);
			const comment = result.substring(start);
			result = code.replace(spaces, " ").replace(punctuation, "$1") + comment;
		} else {
			result = result.replace(spaces, " ").replace(punctuation, "$1");
		}

		return indent + result;
	}
}
//#endregion
