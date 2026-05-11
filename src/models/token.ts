"use strict";

import "adaptive-extender/node";
import { Span } from "./span.js";

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
