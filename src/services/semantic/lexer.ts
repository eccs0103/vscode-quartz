"use strict";

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
	EOF = "EOF"
}

export interface Range {
	startLine: number;
	startCol: number;
	endLine: number;
	endCol: number;
}

export interface Token {
	type: TokenType;
	value: string;
	range: Range;
}
//#endregion

//#region Lexer
export class Lexer {
	#code: string;
	#cursor: number = 0;
	#line: number = 0;
	#col: number = 0;

	#patterns: readonly { regex: RegExp; type: TokenType | null }[] = [
		{ regex: /^\s+/, type: null },
		{ regex: /^\/\/[^\n\r]*/, type: null },
		{ regex: /^\/\*[\s\S]*?\*\//, type: null },
		{ regex: /^\d+(\.\d+)?/, type: TokenType.Number },
		{ regex: /^"([^"\\]|\\.)*"/, type: TokenType.String },
		{ regex: /^'([^'\\]|\\.)'/, type: TokenType.Character },
		{ regex: /^(>=?|<=?|!=|=|\+|-|\*|\/|%|:|\?|&|\||!|\.)/, type: TokenType.Operator },
		{ regex: /^[A-Za-z_]\w*/, type: TokenType.Identifier },
		{ regex: /^[(){}[\]]/, type: TokenType.Bracket },
		{ regex: /^[;,]/, type: TokenType.Separator }
	];

	#keywords: ReadonlySet<string> = new Set([
		"true", "false", "null", "if", "else", "while", "for", "in", "continue", "break", "return"
	]);

	constructor(code: string) {
		this.#code = code;
	}

	tokenize(): Token[] {
		const tokens: Token[] = [];

		while (this.#cursor < this.#code.length) {
			const remaining = this.#code.slice(this.#cursor);
			let matched = false;

			for (const { regex, type } of this.#patterns) {
				const match = regex.exec(remaining);
				if (!match) continue;

				const value = match[0];
				const startLine = this.#line;
				const startCol = this.#col;

				for (const char of value) {
					if (char === "\n") {
						this.#line++;
						this.#col = 0;
					} else {
						this.#col++;
					}
				}

				if (type !== null) {
					const finalType = type === TokenType.Identifier && this.#keywords.has(value)
						? TokenType.Keyword
						: type;
					tokens.push({
						type: finalType,
						value,
						range: { startLine, startCol, endLine: this.#line, endCol: this.#col }
					});
				}

				this.#cursor += value.length;
				matched = true;
				break;
			}

			if (!matched) {
				const char = this.#code[this.#cursor];
				if (char === "\n") {
					this.#line++;
					this.#col = 0;
				} else {
					this.#col++;
				}
				this.#cursor++;
			}
		}

		tokens.push({
			type: TokenType.EOF,
			value: "",
			range: { startLine: this.#line, startCol: this.#col, endLine: this.#line, endCol: this.#col }
		});

		return tokens;
	}
}
//#endregion
