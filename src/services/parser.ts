"use strict";

import { Lexer, Token, TokenRange, TokenType } from "./lexer.js";
import { FuncDef, ParamDef, SymbolTable, VarDef } from "./symbol-table.js";

//#region DocParser
export class DocParser {
	#tokens: Token[] = [];
	#cursor = 0;
	#table!: SymbolTable;

	parse(code: string): SymbolTable {
		this.#tokens = new Lexer(code).tokenize();
		this.#cursor = 0;
		this.#table = new SymbolTable();
		this.#readProgram();
		return this.#table;
	}

	//#region Top-level

	#readProgram(): void {
		while (!this.#atEOF()) {
			if (this.#isFuncDecl()) {
				this.#readFuncDecl();
			} else if (this.#isVarDecl()) {
				this.#readVarDecl(0, Number.MAX_SAFE_INTEGER);
				this.#skipSemicolon();
			} else {
				this.#advance();
			}
		}
	}

	#isFuncDecl(): boolean {
		const current = this.#current();
		const next = this.#peek(1);
		return current.type === TokenType.Identifier && next.type === TokenType.Bracket && next.value === "(";
	}

	#isVarDecl(): boolean {
		const current = this.#current();
		const next = this.#peek(1);
		return current.type === TokenType.Identifier && next.type === TokenType.Identifier;
	}

	//#endregion

	//#region Function declaration

	#readFuncDecl(): void {
		const nameToken = this.#advance();
		const params = this.#readParams();
		const retType = this.#readType();

		const bodyStart = this.#current().range.startLine;
		const bodyEnd = this.#findMatchingBrace();

		this.#table.addFunc(new FuncDef(nameToken.value, params, retType, nameToken.range.startLine, bodyEnd));

		const bodyOpen = this.#current();
		if (!(bodyOpen.type === TokenType.Bracket && bodyOpen.value === "{")) return;
		this.#advance();
		this.#readBlock(params, bodyStart, bodyEnd);
		const closing = this.#current();
		if (closing.type === TokenType.Bracket && closing.value === "}") this.#advance();
	}

	//#endregion

	//#region Block & statements

	#readBlock(initParams: ParamDef[], blockStart: number, blockEnd: number): void {
		for (const parameter of initParams) this.#table.addVar(new VarDef(parameter.name, parameter.typeName, blockStart, blockEnd));
		while (!this.#atEOF()) {
			const token = this.#current();
			if (token.type === TokenType.Bracket && token.value === "}") break;
			this.#readStatement(blockStart, blockEnd);
		}
	}

	#readStatement(scopeStart: number, scopeEnd: number): void {
		if (this.#isVarDecl()) {
			this.#readVarDecl(scopeStart, scopeEnd);
			this.#skipSemicolon();
			return;
		}

		const token = this.#current();

		if (token.type === TokenType.Keyword) {
			switch (token.value) {
			case "if": this.#readIf(scopeStart, scopeEnd); return;
			case "while": this.#readWhile(scopeStart, scopeEnd); return;
			case "for": this.#readFor(scopeStart, scopeEnd); return;
			case "return": this.#skipToSemicolon(); return;
			case "break": this.#advance(); this.#skipSemicolon(); return;
			case "continue": this.#advance(); this.#skipSemicolon(); return;
			}
		}

		if (token.type === TokenType.Bracket && token.value === "{") {
			const blockStart = token.range.startLine;
			const blockEnd = this.#findMatchingBrace();
			this.#advance();
			this.#readBlock([], blockStart, blockEnd);
			const closing = this.#current();
			if (closing.type === TokenType.Bracket && closing.value === "}") this.#advance();
			return;
		}

		if (token.type === TokenType.Separator && token.value === ";") {
			this.#advance();
			return;
		}

		this.#skipToSemicolon();
	}

	//#endregion

	//#region Control flow

	#readIf(scopeStart: number, scopeEnd: number): void {
		this.#advance();
		this.#skipBalanced("(", ")");
		this.#readStatement(scopeStart, scopeEnd);
		const token = this.#current();
		if (token.type === TokenType.Keyword && token.value === "else") {
			this.#advance();
			this.#readStatement(scopeStart, scopeEnd);
		}
	}

	#readWhile(scopeStart: number, scopeEnd: number): void {
		this.#advance();
		this.#skipBalanced("(", ")");
		this.#readStatement(scopeStart, scopeEnd);
	}

	#readFor(scopeStart: number, scopeEnd: number): void {
		this.#advance();
		const open = this.#current();
		if (!(open.type === TokenType.Bracket && open.value === "(")) {
			this.#skipToSemicolon();
			return;
		}
		this.#advance();

		let name = "";
		let typeName = "";

		const nameToken = this.#current();
		if (nameToken.type === TokenType.Identifier) {
			name = nameToken.value;
			this.#advance();
			typeName = this.#readType();
			const inKeyword = this.#current();
			if (inKeyword.type === TokenType.Keyword && inKeyword.value === "in") this.#advance();
		}

		let depth = 1;
		while (!this.#atEOF() && depth > 0) {
			const token = this.#current();
			if (token.type === TokenType.Bracket && token.value === "(") depth++;
			else if (token.type === TokenType.Bracket && token.value === ")") {
				depth--;
				if (depth === 0) break;
			}
			this.#advance();
		}
		const closeParen = this.#current();
		if (closeParen.type === TokenType.Bracket && closeParen.value === ")") this.#advance();

		const bodyToken = this.#current();
		const bodyEnd = (bodyToken.type === TokenType.Bracket && bodyToken.value === "{")
			? this.#findMatchingBrace()
			: scopeEnd;

		if (name) this.#table.addVar(new VarDef(name, typeName, bodyToken.range.startLine, bodyEnd));

		this.#readStatement(scopeStart, scopeEnd);
	}

	//#endregion

	//#region Declarations

	#readVarDecl(scopeStart: number, scopeEnd: number): void {
		const nameToken = this.#advance();
		const typeName = this.#readType();

		const colon = this.#current();
		if (colon.type === TokenType.Operator && colon.value === ":") {
			this.#advance();
			this.#skipToSemicolon();
		}

		this.#table.addVar(new VarDef(nameToken.value, typeName, nameToken.range.startLine, scopeEnd));
	}

	#readParams(): ParamDef[] {
		const open = this.#current();
		if (!(open.type === TokenType.Bracket && open.value === "(")) return [];
		this.#advance();
		const params: ParamDef[] = [];

		while (!this.#atEOF()) {
			const token = this.#current();
			if (token.type === TokenType.Bracket && token.value === ")") break;
			if (token.type === TokenType.Separator) { this.#advance(); continue; }
			if (token.type !== TokenType.Identifier) { this.#advance(); continue; }
			const name = token.value;
			this.#advance();
			const typeName = this.#readType();
			params.push(new ParamDef(name, typeName));
		}

		const close = this.#current();
		if (close.type === TokenType.Bracket && close.value === ")") this.#advance();
		return params;
	}

	#readType(): string {
		const base = this.#current();
		if (base.type !== TokenType.Identifier) return "";
		this.#advance();

		const next = this.#current();
		if (next.type === TokenType.Operator && next.value === "<") {
			this.#advance();
			const typeArgs: string[] = [];
			let depth = 1;
			while (!this.#atEOF() && depth > 0) {
				const token = this.#current();
				if (token.type === TokenType.Operator && token.value === "<") {
					depth++;
					this.#advance();
					continue;
				}
				if (token.type === TokenType.Operator && token.value === ">") {
					depth--;
					if (depth === 0) break;
					this.#advance();
					continue;
				}
				if (token.type === TokenType.Identifier) {
					typeArgs.push(this.#readType());
					continue;
				}
				if (token.type === TokenType.Separator && token.value === ",") {
					this.#advance();
					continue;
				}
				this.#advance();
			}
			const close = this.#current();
			if (close.type === TokenType.Operator && close.value === ">") this.#advance();
			return `${base.value}<${typeArgs.join(", ")}>`;
		}

		const nullable = this.#current();
		if (nullable.type === TokenType.Operator && nullable.value === "?") {
			this.#advance();
			return `Nullable<${base.value}>`;
		}

		return base.value;
	}

	//#endregion

	//#region Utilities

	#findMatchingBrace(): number {
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

	#skipBalanced(open: string, close: string): void {
		const first = this.#current();
		if (!(first.type === TokenType.Bracket && first.value === open)) return;
		this.#advance();
		let depth = 1;
		while (!this.#atEOF() && depth > 0) {
			const token = this.#current();
			if (token.type === TokenType.Bracket && token.value === open) depth++;
			else if (token.type === TokenType.Bracket && token.value === close) {
				depth--;
				if (depth === 0) break;
			}
			this.#advance();
		}
		const closing = this.#current();
		if (closing.type === TokenType.Bracket && closing.value === close) this.#advance();
	}

	#skipToSemicolon(): void {
		while (!this.#atEOF()) {
			const token = this.#current();
			if (token.type === TokenType.Separator && token.value === ";") { this.#advance(); return; }
			if (token.type === TokenType.Bracket && token.value === "}") return;
			this.#advance();
		}
	}

	#skipSemicolon(): void {
		const token = this.#current();
		if (token.type === TokenType.Separator && token.value === ";") this.#advance();
	}

	#current(): Token {
		return this.#cursor < this.#tokens.length
			? this.#tokens[this.#cursor]
			: new Token(TokenType.EOF, "", new TokenRange(0, 0, 0, 0));
	}

	#peek(offset: number): Token {
		const index = this.#cursor + offset;
		return index < this.#tokens.length
			? this.#tokens[index]
			: new Token(TokenType.EOF, "", new TokenRange(0, 0, 0, 0));
	}

	#advance(): Token {
		const token = this.#current();
		if (this.#cursor < this.#tokens.length) this.#cursor++;
		return token;
	}

	#atEOF(): boolean {
		return this.#cursor >= this.#tokens.length || this.#tokens[this.#cursor].type === TokenType.EOF;
	}
	//#endregion
}
//#endregion
