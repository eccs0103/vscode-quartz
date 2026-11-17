"use strict";

import "adaptive-extender/core";
import { Cursor, Span } from "../models/span.js";
import { Token, TokenType } from "../models/token.js";

//#region Lexer
export class Lexer {
	static #patterns: Map<RegExp, TokenType | null> = new Map([
		[/\s+/y, null],
		[/\/\/[^\n\r]*/y, null],
		[/\/\*[\s\S]*?\*\//y, null],
		[/\d+(\.\d+)?/y, TokenType.number],
		[/"([^"\\]|\\.)*"/y, TokenType.string],
		[/'([^'\\]|\\.)+'/y, TokenType.character],
		[/(>=?|<=?|!=|=|\+|-|\*|\/|%|:|\?|&|\||!|\.)/y, TokenType.operator],
		[/[A-Za-z_]\w*/y, TokenType.identifier],
		[/[(){}[\]]/y, TokenType.bracket],
		[/[;,]/y, TokenType.separator]
	]);

	static #keywords: Set<string> = new Set(["true", "false", "null", "if", "else", "while", "for", "in", "continue", "break", "return"]);

	tokenize(code: string): Token[] {
		const tokens: Token[] = [];
		const { length } = code;
		let cursor = 0;
		let line = 0;
		let column = 0;

		while (cursor < length) {
			let matched = false;

			for (const [regex, type] of Lexer.#patterns) {
				regex.lastIndex = cursor;
				const match = regex.exec(code);
				if (match === null) continue;

				const value = match[0];
				const begin = new Cursor(line, column);
				const newline = value.lastIndexOf("\n");

				column += value.length;
				if (newline !== -1) {
					line += value.split("\n").length - 1;
					column = value.length - newline - 1;
				}

				if (type !== null) {
					const kind = type === TokenType.identifier && Lexer.#keywords.has(value) ? TokenType.keyword : type;
					tokens.push(new Token(kind, value, new Span(begin, new Cursor(line, column))));
				}

				cursor += value.length;
				matched = true;
				break;
			}

			if (matched) continue;
			column++;
			if (code[cursor] === "\n") {
				line++;
				column = 0;
			}
			cursor++;
		}

		return tokens;
	}
}
//#endregion
