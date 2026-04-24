"use strict";

import "adaptive-extender/node";
import { Token, TokenRange, TokenType } from "../models/token.js";

//#region Lexer
export class Lexer {
	static #patterns: { regex: RegExp; type: TokenType | null; }[] = [
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

	static #keywords: Set<string> = new Set(["true", "false", "null", "if", "else", "while", "for", "in", "continue", "break", "return"]);

	#code: string;
	#cursor: number = 0;
	#line: number = 0;
	#column: number = 0;

	constructor(code: string) {
		this.#code = code;
	}

	tokenize(): Token[] {
		const tokens: Token[] = [];

		while (this.#cursor < this.#code.length) {
			const remaining = this.#code.slice(this.#cursor);
			let matched = false;

			for (const { regex, type } of Lexer.#patterns) {
				const match = regex.exec(remaining);
				if (match === null) continue;

				const value = match[0];
				const startLine = this.#line;
				const startColumn = this.#column;

				for (const character of value) {
					if (character === "\n") {
						this.#line++;
						this.#column = 0;
					} else {
						this.#column++;
					}
				}

				if (type !== null) {
					const finalType = type === TokenType.Identifier && Lexer.#keywords.has(value)
						? TokenType.Keyword
						: type;
					tokens.push(new Token(finalType, value, new TokenRange(startLine, startColumn, this.#line, this.#column)));
				}

				this.#cursor += value.length;
				matched = true;
				break;
			}

			if (!matched) {
				const character = this.#code[this.#cursor];
				if (character === "\n") {
					this.#line++;
					this.#column = 0;
				} else {
					this.#column++;
				}
				this.#cursor++;
			}
		}

		tokens.push(new Token(TokenType.EndOfFile, "", new TokenRange(this.#line, this.#column, this.#line, this.#column)));
		return tokens;
	}
}
//#endregion
