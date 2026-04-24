"use strict";

import "adaptive-extender/node";
import { Token, TokenRange, TokenType } from "../models/token.js";

//#region Lexer
export class Lexer {
	static #patterns: Map<RegExp, TokenType | null> = new Map([
		[/^\s+/, null],
		[/^\/\/[^\n\r]*/, null],
		[/^\/\*[\s\S]*?\*\//, null],
		[/^\d+(\.\d+)?/, TokenType.Number],
		[/^"([^"\\]|\\.)*"/, TokenType.String],
		[/^'([^'\\]|\\.)'/, TokenType.Character],
		[/^(>=?|<=?|!=|=|\+|-|\*|\/|%|:|\?|&|\||!|\.)/, TokenType.Operator],
		[/^[A-Za-z_]\w*/, TokenType.Identifier],
		[/^[(){}[\]]/, TokenType.Bracket],
		[/^[;,]/, TokenType.Separator]
	]);

	static #keywords: Set<string> = new Set(["true", "false", "null", "if", "else", "while", "for", "in", "continue", "break", "return"]);

	#code: string;
	#cursor: number = 0;
	#line: number = 0;
	#column: number = 0;

	constructor(code: string) {
		this.#code = code;
	}

	tokenize(): Token[] {
		const code = this.#code;
		const tokens: Token[] = [];

		while (this.#cursor < code.length) {
			const remaining = code.slice(this.#cursor);
			let matched = false;

			for (const [regex, type] of Lexer.#patterns) {
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
				const character = code[this.#cursor];
				if (character === "\n") {
					this.#line++;
					this.#column = 0;
				} else {
					this.#column++;
				}
				this.#cursor++;
			}
		}

		return tokens;
	}
}
//#endregion
