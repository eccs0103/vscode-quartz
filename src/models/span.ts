"use strict";

import "adaptive-extender/node";
import { Position, Range } from "vscode-languageserver/node.js";

const { min } = Math;

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
		const { line, column: character } = this;
		return { line, character };
	}

	static fromOffset(text: string, offset: number): Cursor {
		let line = 0;
		let column = 0;
		for (let index = 0; index < min(offset, text.length); index++) {
			if (text[index] !== "\n") {
				column++;
				continue;
			}
			line++;
			column = 0;
		}
		return new Cursor(line, column);
	}
}
//#endregion

//#region Span
export class Span {
	begin: Cursor;
	end: Cursor;

	constructor(start: Cursor, end: Cursor) {
		this.begin = start;
		this.end = end;
	}

	containsLine(line: number): boolean {
		return this.begin.line <= line && line <= this.end.line;
	}

	contains(cursor: Cursor): boolean {
		if (cursor.isBefore(this.begin)) return false;
		if (this.end.isBefore(cursor)) return false;
		return true;
	}

	get isEmpty(): boolean {
		return this.begin.isAt(this.end);
	}

	toRange(): Range {
		const start = this.begin.toPosition();
		const end = this.end.toPosition();
		return { start, end };
	}
}
//#endregion
