"use strict";

import "adaptive-extender/node";
import { Cursor, Span } from "../models/span.js";
import { Token, TokenType } from "../models/token.js";

//#region Lexer
export class Lexer {
	static #patterns: Map<RegExp, TokenType | null> = new Map([
		[/\s+/y, null],
		[/\/\/[^\n\r]*/y, null],
		[/\/\*[\s\S]*?\*\//y, null],
		[/\d+(\.\d+)?/y, TokenType.Number],
		[/"([^"\\]|\\.)*"/y, TokenType.String],
		[/'([^'\\]|\\.)+'/y, TokenType.Character],
		[/(>=?|<=?|!=|=|\+|-|\*|\/|%|:|\?|&|\||!|\.)/y, TokenType.Operator],
		[/[A-Za-z_]\w*/y, TokenType.Identifier],
		[/[(){}[\]]/y, TokenType.Bracket],
		[/[;,]/y, TokenType.Separator]
	]);

	static #keywords: Set<string> = new Set(["true", "false", "null", "if", "else", "while", "for", "in", "continue", "break", "return"]);

	tokenize(code: string): Token[] {
		const tokens: Token[] = [];
		const len = code.length;
		let cursor = 0;
		let line = 0;
		let column = 0;

		while (cursor < len) {
			let matched = false;

			for (const [regex, type] of Lexer.#patterns) {
				regex.lastIndex = cursor;
				const match = regex.exec(code);
				if (match === null) continue;

				const value = match[0];
				const startLine = line;
				const startColumn = column;
				const lastNL = value.lastIndexOf("\n");

				if (lastNL === -1) {
					column += value.length;
				} else {
					line += value.split("\n").length - 1;
					column = value.length - lastNL - 1;
				}

				if (type !== null) {
					const finalType = type === TokenType.Identifier && Lexer.#keywords.has(value)
						? TokenType.Keyword
						: type;
					const tokenSpan = new Span(new Cursor(startLine, startColumn), new Cursor(line, column));
					tokens.push(new Token(finalType, value, tokenSpan));
				}

				cursor += value.length;
				matched = true;
				break;
			}

			if (!matched) {
				if (code[cursor] === "\n") { line++; column = 0; }
				else { column++; }
				cursor++;
			}
		}

		return tokens;
	}
}
//#endregion
