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
	startColumn: number;
	endLine: number;
	endColumn: number;
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
	#column: number = 0;

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
				const startColumn = this.#column;

				for (const char of value) {
					if (char === "\n") {
						this.#line++;
						this.#column = 0;
					} else {
						this.#column++;
					}
				}

				if (type !== null) {
					const finalType = type === TokenType.Identifier && this.#keywords.has(value)
						? TokenType.Keyword
						: type;
					tokens.push({
						type: finalType,
						value,
						range: { startLine, startColumn, endLine: this.#line, endColumn: this.#column }
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
					this.#column = 0;
				} else {
					this.#column++;
				}
				this.#cursor++;
			}
		}

		tokens.push({
			type: TokenType.EOF,
			value: "",
			range: { startLine: this.#line, startColumn: this.#column, endLine: this.#line, endColumn: this.#column }
		});

		return tokens;
	}
}
//#endregion
