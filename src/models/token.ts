"use strict";

import "adaptive-extender/node";
import { Span } from "./span.js";

//#region Token types
export enum TokenType {
	number = "Number",
	character = "Character",
	string = "String",
	identifier = "Identifier",
	keyword = "Keyword",
	operator = "Operator",
	bracket = "Bracket",
	separator = "Separator",
	eof = "EndOfFile"
}
//#endregion

//#region Token
export class Token {
	type: TokenType;
	value: string;
	span: Span;

	constructor(type: TokenType, value: string, span: Span) {
		this.type = type;
		this.value = value;
		this.span = span;
	}
}
//#endregion
