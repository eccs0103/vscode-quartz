"use strict";

import "adaptive-extender/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit, Range, Position } from "vscode-languageserver/node";

//#region Formatting service
export class FormattingService {
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
				formatted.push("");
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
				const openCount = (line.match(/\{/g) ?? []).length;
				const endCount = (line.match(/\}/g) ?? []).length;
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
		const indent = line.match(/^\s*/)?.[0] ?? "";
		const content = line.trim();

		let inString = false;
		let openQuote = "";
		let result = "";

		for (let offset = 0; offset < content.length; offset++) {
			const char = content[offset];
			const next = offset < content.length - 1 ? content[offset + 1] : "";

			if ((char === '"' || char === "'") && (offset === 0 || content[offset - 1] !== "\\")) {
				if (!inString) {
					inString = true;
					openQuote = char;
				} else if (openQuote === char) {
					inString = false;
					openQuote = "";
				} else {
					result += char;
					continue;
				}
				result += char;
				continue;
			}

			if (inString) { result += char; continue; }

			if (char === "(" && offset > 0 && /\b(if|else|while|for|in)$/.test(result) && result[result.length - 1] !== " ") result += " ";

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

			if (/[:=!&|<>]/.test(char) || char === "+" || char === "-" || char === "*" || char === "/") {
				const prevChar = result[result.length - 1];
				const isUnary = (char === "+" || char === "-" || char === "!") && (/[\s(,:]$/.test(result) || result.length === 0);
				const isGeneric = (char === "<" || char === ">") && (/[A-Z][a-zA-Z0-9_]*$/.test(result) || /^[A-Z]/.test(next));

				if (isUnary) {
					result += char;
				} else if (isGeneric) {
					result += char;
				} else {
					if (prevChar && prevChar !== " " && /[a-zA-Z0-9_)>]/.test(prevChar)) result += " ";
					result += char;
					if ((char === "<" || char === ">" || char === "!" || char === "=") && next === "=") {
						result += next;
						offset++;
						if (offset < content.length - 1 && content[offset + 1] !== " ") result += " ";
						continue;
					}
					if (next && next !== " " && /[a-zA-Z0-9_\("<]/.test(next) && !isGeneric) result += " ";
				}
				continue;
			}

			result += char;
		}

		const index = result.indexOf("//");
		if (index !== -1) {
			const code = result.substring(0, index);
			const comment = result.substring(index);
			result = code.replace(/\s+/g, " ").replace(/\s+([;,)])/g, "$1") + comment;
		} else {
			result = result.replace(/\s+/g, " ").replace(/\s+([;,)])/g, "$1");
		}

		return indent + result;
	}
}
//#endregion
