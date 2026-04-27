"use strict";

import "adaptive-extender/node";

//#region Line formatter
export class LineFormatter {
	static #patternIndent: RegExp = /^\s*/;
	static #patternControlKeyword: RegExp = /\b(if|else|while|for|in)$/;
	static #patternOperator: RegExp = /[:=!&|<>]/;
	static #patternUnaryContext: RegExp = /[\s(,:]$/;
	static #patternGenericTail: RegExp = /[A-Z][a-zA-Z0-9_]*$/;
	static #patternGenericNextType: RegExp = /^[A-Z]/;
	static #patternOperandBefore: RegExp = /[a-zA-Z0-9_)>]/;
	static #patternOperandAfter: RegExp = /[a-zA-Z0-9_"(<]/;
	static #patternSpaces: RegExp = /\s+/g;
	static #patternSpaceBeforePunctuation: RegExp = /\s+([;,)])/g;

	static format(line: string): string {
		const indent = line.match(LineFormatter.#patternIndent)?.[0] ?? String.empty;
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

			if (char === "(" && offset > 0 && LineFormatter.#patternControlKeyword.test(result) && result[result.length - 1] !== " ") result += " ";

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

			if (LineFormatter.#patternOperator.test(char) || char === "+" || char === "-" || char === "*" || char === "/") {
				const lastChar = result[result.length - 1];
				const isUnary = (char === "+" || char === "-" || char === "!") && (LineFormatter.#patternUnaryContext.test(result) || result.length === 0);
				const isGenericOpen = char === "<" && (LineFormatter.#patternGenericTail.test(result) || LineFormatter.#patternGenericNextType.test(next));
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
					if (lastChar && lastChar !== " " && LineFormatter.#patternOperandBefore.test(lastChar)) result += " ";
					result += char;
					if ((char === "<" || char === ">" || char === "!" || char === "=") && next === "=") {
						result += next;
						offset++;
						if (offset < content.length - 1 && content[offset + 1] !== " ") result += " ";
						continue;
					}
					if (next && next !== " " && LineFormatter.#patternOperandAfter.test(next)) result += " ";
				}
				continue;
			}

			result += char;
		}

		const commentStart = result.indexOf("//");
		const spacesPattern = LineFormatter.#patternSpaces;
		const punctuationPattern = LineFormatter.#patternSpaceBeforePunctuation;
		spacesPattern.lastIndex = 0;
		punctuationPattern.lastIndex = 0;
		if (commentStart !== -1) {
			const code = result.substring(0, commentStart);
			const comment = result.substring(commentStart);
			result = code.replace(spacesPattern, " ").replace(punctuationPattern, "$1") + comment;
		} else {
			result = result.replace(spacesPattern, " ").replace(punctuationPattern, "$1");
		}

		return indent + result;
	}
}
//#endregion
