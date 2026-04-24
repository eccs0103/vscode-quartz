"use strict";

import "adaptive-extender/node";

//#region Token types
export enum TokenType {
	Number = "Number",
	Character = "Character",
	String = "String",
	Identifier = "Identifier",
	Keyword = "Keyword",
	Operator = "Operator",
	Bracket = "Bracket",
	Separator = "Separator",
	EndOfFile = "EndOfFile"
}

export class TokenRange {
	startLine: number;
	startColumn: number;
	endLine: number;
	endColumn: number;

	constructor(startLine: number, startColumn: number, endLine: number, endColumn: number) {
		this.startLine = startLine;
		this.startColumn = startColumn;
		this.endLine = endLine;
		this.endColumn = endColumn;
	}
}

export class Token {
	type: TokenType;
	value: string;
	range: TokenRange;

	constructor(type: TokenType, value: string, range: TokenRange) {
		this.type = type;
		this.value = value;
		this.range = range;
	}
}
//#endregion
