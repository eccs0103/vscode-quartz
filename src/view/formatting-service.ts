"use strict";

import "adaptive-extender/core";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit, Range, Position } from "vscode-languageserver-types";
import { LineFormatter } from "./line-formatter.js";

//#region Bracket count
class BracketCount {
	#opens: number;
	#closes: number;
	#leading: number;

	constructor(opens: number, closes: number, leading: number) {
		this.#opens = opens;
		this.#closes = closes;
		this.#leading = leading;
	}

	levelBefore(current: number): number {
		return Math.max(0, current - this.#leading);
	}

	levelAfter(current: number): number {
		return Math.max(0, current + this.#opens - (this.#closes - this.#leading));
	}

	static fromLine(line: string): BracketCount {
		let opens = 0;
		let closes = 0;
		let leading = 0;
		let seen = false;
		let quote = String.empty;
		for (let offset = 0; offset < line.length; offset++) {
			const char = line[offset];
			if (!String.isEmpty(quote)) {
				if (char === '\\') { offset++; continue; }
				if (char === quote) quote = String.empty;
				continue;
			}
			if (char === '"' || char === "'") {
				quote = char;
				seen = true;
				continue;
			}
			if (char === '/' && offset + 1 < line.length && line[offset + 1] === '/') break;
			if (char === '{' || char === '[') {
				opens++;
				seen = true;
				continue;
			}
			if (char === '}' || char === ']') {
				closes++;
				if (!seen) leading++;
				continue;
			}
			if (char !== ' ' && char !== '\t') seen = true;
		}
		return new BracketCount(opens, closes, leading);
	}
}
//#endregion

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

		for (const raw of lines) {
			if (String.isWhitespace(raw)) {
				formatted.push(String.empty);
				continue;
			}
			const line = raw.trim();
			const isComment = line.startsWith("//") || line.startsWith("/*") || line.startsWith("*");
			if (isComment) {
				formatted.push(tab.repeat(level) + line);
				continue;
			}
			const brackets = BracketCount.fromLine(line);
			level = brackets.levelBefore(level);
			formatted.push(tab.repeat(level) + line);
			level = brackets.levelAfter(level);
		}

		return formatted.map(line => {
			const trimmed = line.trim();
			if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return line;
			return LineFormatter.format(line);
		}).join("\n");
	}
}
//#endregion
