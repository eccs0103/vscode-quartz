"use strict";

import "adaptive-extender/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit, Range, Position } from "vscode-languageserver/node.js";

//#region Formatting service
export class FormattingService {
		static #patternOpenBrace: RegExp = /\{/g;
		static #patternCloseBrace: RegExp = /\}/g;
		static #patternIndent: RegExp = /^\s*/;
		static #patternControlKeyword: RegExp = /\b(if|else|while|for|in)$/;
		static #patternOperator: RegExp = /[:=!&|<>]/;
		static #patternUnaryContext: RegExp = /[\s(,:]$/;
		static #patternGenericTail: RegExp = /[A-Z][a-zA-Z0-9_]*$/;
		static #patternGenericNextType: RegExp = /^[A-Z]/;
		static #patternOperandBefore: RegExp = /[a-zA-Z0-9_)>]/;
		static #patternOperandAfter: RegExp = /[a-zA-Z0-9_\"(<]/;
		static #patternSpaces: RegExp = /\s+/g;
		static #patternSpaceBeforePunctuation: RegExp = /\s+([;,)])/g;

	getEdits(document: TextDocument): TextEdit[] {
		const text = document.getText();
		const formatted = this.#format(text);
		if (formatted === text) return [];
		const lastLine = document.lineCount - 1;
		const lastChar = document.getText({ start: { line: lastLine, character: 0 }, end: { line: lastLine, character: Number.MAX_VALUE } }).length;
		return [TextEdit.replace(Range.create(Position.create(0, 0), Position.create(lastLine, lastChar)), formatted)];
	}

	#format(code: string): string {
		const lines = code.split("\n");
		const formatted: string[] = [];
		let level = 0;
		const tab = "\t";

		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const raw = lines[lineIndex];
			if (String.isWhitespace(raw)) {
				formatted.push(String.empty);
				continue;
			}
			let line = raw.trim();

			const isComment = line.startsWith("//") || line.startsWith("/*") || line.startsWith("*");

			if (line.startsWith("}")) level = Math.max(0, level - 1);

			formatted.push(tab.repeat(level) + line);

			if (line.endsWith("{") && !isComment) {
				level++;
			} else if (line.includes("{") && !line.includes("}") && !isComment) {
				level++;
			}

			if (line.includes("}") && line.includes("{")) {
				const openCount = this.#countMatches(line, FormattingService.#patternOpenBrace);
				const endCount = this.#countMatches(line, FormattingService.#patternCloseBrace);
				if (endCount > openCount) level = Math.max(0, level - (endCount - openCount));
			}
		}

		return formatted.map(line => {
			const trimmed = line.trim();
			if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return line;
			return this.#formatLine(line);
		}).join("\n");
	}

	#formatLine(line: string): string {
		const indent = line.match(FormattingService.#patternIndent)?.[0] ?? String.empty;
		const content = line.trim();

		let inString = false;
		let openQuote = String.empty;
		let result = String.empty;
		let genericDepth = 0;

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

			if (char === "(" && offset > 0 && FormattingService.#patternControlKeyword.test(result) && result[result.length - 1] !== " ") result += " ";

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

			if (FormattingService.#patternOperator.test(char) || char === "+" || char === "-" || char === "*" || char === "/") {
				const prevChar = result[result.length - 1];
				const isUnary = (char === "+" || char === "-" || char === "!") && (FormattingService.#patternUnaryContext.test(result) || result.length === 0);
				const isGenericOpen = char === "<" && (FormattingService.#patternGenericTail.test(result) || FormattingService.#patternGenericNextType.test(next));
				const isGenericClose = char === ">" && genericDepth > 0;

				if (isUnary) {
					result += char;
				} else if (isGenericOpen) {
					genericDepth++;
					result += char;
				} else if (isGenericClose) {
					genericDepth--;
					result += char;
				} else {
					if (prevChar && prevChar !== " " && FormattingService.#patternOperandBefore.test(prevChar)) result += " ";
					result += char;
					if ((char === "<" || char === ">" || char === "!" || char === "=") && next === "=") {
						result += next;
						offset++;
						if (offset < content.length - 1 && content[offset + 1] !== " ") result += " ";
						continue;
					}
					if (next && next !== " " && FormattingService.#patternOperandAfter.test(next)) result += " ";
				}
				continue;
			}

			result += char;
		}

		const index = result.indexOf("//");
		const spacesPattern = FormattingService.#patternSpaces;
		const punctuationPattern = FormattingService.#patternSpaceBeforePunctuation;
		spacesPattern.lastIndex = 0;
		punctuationPattern.lastIndex = 0;
		if (index !== -1) {
			const code = result.substring(0, index);
			const comment = result.substring(index);
			result = code.replace(spacesPattern, " ").replace(punctuationPattern, "$1") + comment;
		} else {
			result = result.replace(spacesPattern, " ").replace(punctuationPattern, "$1");
		}

		return indent + result;
	}

	#countMatches(text: string, pattern: RegExp): number {
		pattern.lastIndex = 0;
		return (text.match(pattern) ?? []).length;
	}
}
//#endregion
