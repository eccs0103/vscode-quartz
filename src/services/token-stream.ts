"use strict";

import "adaptive-extender/node";
import { Lexer } from "./lexer.js";
import { Token, TokenType } from "../models/token.js";

//#region Token stream
export class TokenStream {
	#tokens: Token[];
	#cursor: number = 0;

	constructor(code: string) {
		this.#tokens = new Lexer().tokenize(code);
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
		if (token !== null && token.type === TokenType.separator && token.value === ";") this.advance();
	}

	findMatchingBrace(): number {
		const tokens = this.#tokens;
		let depth = 0;
		for (let index = this.#cursor; index < tokens.length; index++) {
			const token = tokens[index];
			if (token.type === TokenType.bracket && token.value === "{") depth++;
			else if (token.type === TokenType.bracket && token.value === "}") {
				depth--;
				if (depth === 0) return token.span.end.line;
			}
		}
		return Number.MAX_SAFE_INTEGER;
	}
}
//#endregion
