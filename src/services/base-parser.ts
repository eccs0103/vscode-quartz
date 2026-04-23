"use strict";

import { Lexer } from "./lexer.js";
import { Token, TokenRange, TokenType } from "../models/token.js";
import { ParamDef } from "../models/symbol-defs.js";

//#region Base parser
export abstract class BaseParser {
	#tokens: Token[] = [];
	#cursor: number = 0;

	protected initTokens(code: string): void {
		this.#tokens = new Lexer(code).tokenize();
		this.#cursor = 0;
	}

	protected current(): Token {
		return this.#cursor < this.#tokens.length
			? this.#tokens[this.#cursor]
			: new Token(TokenType.EOF, "", new TokenRange(0, 0, 0, 0));
	}

	protected peek(offset: number): Token {
		const index = this.#cursor + offset;
		return index < this.#tokens.length
			? this.#tokens[index]
			: new Token(TokenType.EOF, "", new TokenRange(0, 0, 0, 0));
	}

	protected advance(): Token {
		const token = this.current();
		if (this.#cursor < this.#tokens.length) this.#cursor++;
		return token;
	}

	protected atEOF(): boolean {
		return this.#cursor >= this.#tokens.length || this.#tokens[this.#cursor].type === TokenType.EOF;
	}

	protected skipSemicolon(): void {
		const token = this.current();
		if (token.type === TokenType.Separator && token.value === ";") this.advance();
	}

	protected readType(): string {
		const base = this.current();
		if (base.type !== TokenType.Identifier) return "";
		this.advance();

		const next = this.current();
		if (next.type === TokenType.Operator && next.value === "<") {
			this.advance();
			const typeArgs: string[] = [];
			let depth = 1;
			while (!this.atEOF() && depth > 0) {
				const token = this.current();
				if (token.type === TokenType.Operator && token.value === "<") { depth++; this.advance(); continue; }
				if (token.type === TokenType.Operator && token.value === ">") { depth--; if (depth === 0) break; this.advance(); continue; }
				if (token.type === TokenType.Identifier) { typeArgs.push(this.readType()); continue; }
				if (token.type === TokenType.Separator && token.value === ",") { this.advance(); continue; }
				this.advance();
			}
			const close = this.current();
			if (close.type === TokenType.Operator && close.value === ">") this.advance();
			return `${base.value}<${typeArgs.join(", ")}>`;
		}

		const nullable = this.current();
		if (nullable.type === TokenType.Operator && nullable.value === "?") {
			this.advance();
			return `Nullable<${base.value}>`;
		}

		return base.value;
	}

	protected readParams(): ParamDef[] {
		const open = this.current();
		if (!(open.type === TokenType.Bracket && open.value === "(")) return [];
		this.advance();
		const params: ParamDef[] = [];
		while (!this.atEOF()) {
			const token = this.current();
			if (token.type === TokenType.Bracket && token.value === ")") break;
			if (token.type === TokenType.Separator) { this.advance(); continue; }
			if (token.type !== TokenType.Identifier) { this.advance(); continue; }
			const name = token.value;
			this.advance();
			const typeName = this.readType();
			params.push(new ParamDef(name, typeName));
		}
		const close = this.current();
		if (close.type === TokenType.Bracket && close.value === ")") this.advance();
		return params;
	}

	protected findMatchingBrace(): number {
		let depth = 0;
		for (let index = this.#cursor; index < this.#tokens.length; index++) {
			const token = this.#tokens[index];
			if (token.type === TokenType.Bracket && token.value === "{") depth++;
			else if (token.type === TokenType.Bracket && token.value === "}") {
				depth--;
				if (depth === 0) return token.range.endLine;
			}
		}
		return Number.MAX_SAFE_INTEGER;
	}
}
//#endregion
