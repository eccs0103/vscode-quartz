"use strict";

import "adaptive-extender/node";
import { Lexer } from "./lexer.js";
import { Token, TokenType } from "../models/token.js";
import { ParameterDefinition } from "../models/symbol-definitions.js";

//#region Token stream
export class TokenStream {
	#tokens: Token[];
	#cursor: number = 0;

	constructor(code: string) {
		this.#tokens = new Lexer(code).tokenize();
	}

	current(): Token | null {
		return this.#cursor < this.#tokens.length ? this.#tokens[this.#cursor] : null;
	}

	peek(offset: number): Token | null {
		const index = this.#cursor + offset;
		return index < this.#tokens.length ? this.#tokens[index] : null;
	}

	advance(): Token | null {
		const token = this.current();
		if (this.#cursor < this.#tokens.length) this.#cursor++;
		return token;
	}

	skipSemicolon(): void {
		const token = this.current();
		if (token !== null && token.type === TokenType.Separator && token.value === ";") this.advance();
	}

	readType(): string {
		const base = this.current();
		if (base === null || base.type !== TokenType.Identifier) return String.empty;
		this.advance();

		const next = this.current();
		if (next !== null && next.type === TokenType.Operator && next.value === "<") {
			this.advance();
			const typeArgs: string[] = [];
			let depth = 1;
			while (true) {
				const token = this.current();
				if (token === null || depth === 0) break;
				if (token.type === TokenType.Operator && token.value === "<") { depth++; this.advance(); continue; }
				if (token.type === TokenType.Operator && token.value === ">") { depth--; if (depth === 0) break; this.advance(); continue; }
				if (token.type === TokenType.Identifier) { typeArgs.push(this.readType()); continue; }
				if (token.type === TokenType.Separator && token.value === ",") { this.advance(); continue; }
				this.advance();
			}
			const close = this.current();
			if (close !== null && close.type === TokenType.Operator && close.value === ">") this.advance();
			return `${base.value}<${typeArgs.join(", ")}>`;
		}

		const nullable = this.current();
		if (nullable !== null && nullable.type === TokenType.Operator && nullable.value === "?") {
			this.advance();
			return `Nullable<${base.value}>`;
		}

		return base.value;
	}

	readParams(): ParameterDefinition[] {
		const open = this.current();
		if (open === null || !(open.type === TokenType.Bracket && open.value === "(")) return [];
		this.advance();
		const params: ParameterDefinition[] = [];
		while (true) {
			const token = this.current();
			if (token === null) break;
			if (token.type === TokenType.Bracket && token.value === ")") break;
			if (token.type === TokenType.Separator) { this.advance(); continue; }
			if (token.type !== TokenType.Identifier) { this.advance(); continue; }
			const name = token.value;
			this.advance();
			const typeName = this.readType();
			params.push(new ParameterDefinition(name, typeName));
		}
		const close = this.current();
		if (close !== null && close.type === TokenType.Bracket && close.value === ")") this.advance();
		return params;
	}

	findMatchingBrace(): number {
		const tokens = this.#tokens;
		let depth = 0;
		for (let index = this.#cursor; index < tokens.length; index++) {
			const token = tokens[index];
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
