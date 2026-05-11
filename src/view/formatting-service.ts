"use strict";

import "adaptive-extender/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit, Range, Position } from "vscode-languageserver/node.js";
import { LineFormatter } from "./line-formatter.js";

//#region Bracket count
class BracketCount {
	#opens: number;
	#closes: number;
	#leadingCloses: number;

	constructor(opens: number, closes: number, leadingCloses: number) {
		this.#opens = opens;
		this.#closes = closes;
		this.#leadingCloses = leadingCloses;
	}

	levelBefore(current: number): number {
		return Math.max(0, current - this.#leadingCloses);
	}

	levelAfter(current: number): number {
		return Math.max(0, current + this.#opens - (this.#closes - this.#leadingCloses));
	}

	static fromLine(line: string): BracketCount {
		let opens = 0;
		let closes = 0;
		let leadingCloses = 0;
		let leadingDone = false;
		let stringQuote = String.empty;
		for (let offset = 0; offset < line.length; offset++) {
			const char = line[offset];
			if (!String.isEmpty(stringQuote)) {
				if (char === '\\') { offset++; continue; }
				if (char === stringQuote) stringQuote = String.empty;
				continue;
			}
			if (char === '"' || char === "'") { stringQuote = char; leadingDone = true; continue; }
			if (char === '/' && offset + 1 < line.length && line[offset + 1] === '/') break;
			if (char === '{' || char === '[') { opens++; leadingDone = true; }
			else if (char === '}' || char === ']') { closes++; if (!leadingDone) leadingCloses++; }
			else if (char !== ' ' && char !== '\t') { leadingDone = true; }
		}
		return new BracketCount(opens, closes, leadingCloses);
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
