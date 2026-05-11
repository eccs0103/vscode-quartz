"use strict";

import "adaptive-extender/node";
import { Position, Range } from "vscode-languageserver/node.js";

//#region Cursor
export class Cursor {
	line: number;
	column: number;

	constructor(line: number, column: number) {
		this.line = line;
		this.column = column;
	}

	isBefore(other: Cursor): boolean {
		if (this.line !== other.line) return this.line < other.line;
		return this.column < other.column;
	}

	isAt(other: Cursor): boolean {
		return this.line === other.line && this.column === other.column;
	}

	toPosition(): Position {
		return { line: this.line, character: this.column };
	}

	static fromOffset(text: string, offset: number): Cursor {
		let line = 0;
		let column = 0;
		const end = Math.min(offset, text.length);
		for (let index = 0; index < end; index++) {
			if (text[index] === "\n") { line++; column = 0; }
			else column++;
		}
		return new Cursor(line, column);
	}
}
//#endregion

//#region Span
export class Span {
	start: Cursor;
	end: Cursor;

	constructor(start: Cursor, end: Cursor) {
		this.start = start;
		this.end = end;
	}

	containsLine(line: number): boolean {
		return line >= this.start.line && line <= this.end.line;
	}

	contains(cursor: Cursor): boolean {
		if (cursor.isBefore(this.start)) return false;
		if (this.end.isBefore(cursor)) return false;
		return true;
	}

	isEmpty(): boolean {
		return this.start.isAt(this.end);
	}

	toRange(): Range {
		return { start: this.start.toPosition(), end: this.end.toPosition() };
	}
}
//#endregion
