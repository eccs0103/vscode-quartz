"use strict";

import { Lexer, Token, TokenType } from "./lexer.js";
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
				this.#skipSemi();
			} else {
				this.#advance();
			}
		}
	}

	#isFuncDecl(): boolean {
		const cur = this.#curr();
		const nxt = this.#peek(1);
		return cur.type === TokenType.Identifier && nxt.type === TokenType.Bracket && nxt.value === "(";
	}

	#isVarDecl(): boolean {
		const cur = this.#curr();
		const nxt = this.#peek(1);
		return cur.type === TokenType.Identifier && nxt.type === TokenType.Identifier;
	}

	//#endregion

	//#region Function declaration

	#readFuncDecl(): void {
		const nameToken = this.#advance();
		const params = this.#readParams();
		const retType = this.#readType();

		const bodyStart = this.#curr().range.startLine;
		const bodyEnd = this.#findMatchingBrace();

		this.#table.addFunc({
			name: nameToken.value,
			params,
			retType,
			startLine: nameToken.range.startLine,
			endLine: bodyEnd
		});

		const blk = this.#curr();
		if (!(blk.type === TokenType.Bracket && blk.value === "{")) return;
		this.#advance();
		this.#readBlock(params, bodyStart, bodyEnd);
		const closing = this.#curr();
		if (closing.type === TokenType.Bracket && closing.value === "}") this.#advance();
	}

	//#endregion

	//#region Block & statements

	#readBlock(initParams: ParamDef[], blockStart: number, blockEnd: number): void {
		for (const p of initParams) {
			this.#table.addVar({ name: p.name, typeName: p.typeName, startLine: blockStart, endLine: blockEnd });
		}
		while (!this.#atEOF()) {
			const t = this.#curr();
			if (t.type === TokenType.Bracket && t.value === "}") break;
			this.#readStatement(blockStart, blockEnd);
		}
	}

	#readStatement(scopeStart: number, scopeEnd: number): void {
		if (this.#isVarDecl()) {
			this.#readVarDecl(scopeStart, scopeEnd);
			this.#skipSemi();
			return;
		}

		const t = this.#curr();

		if (t.type === TokenType.Keyword) {
			switch (t.value) {
			case "if": this.#readIf(scopeStart, scopeEnd); return;
			case "while": this.#readWhile(scopeStart, scopeEnd); return;
			case "for": this.#readFor(scopeStart, scopeEnd); return;
			case "return": this.#skipToSemi(); return;
			case "break": this.#advance(); this.#skipSemi(); return;
			case "continue": this.#advance(); this.#skipSemi(); return;
			}
		}

		if (t.type === TokenType.Bracket && t.value === "{") {
			const blkStart = t.range.startLine;
			const blkEnd = this.#findMatchingBrace();
			this.#advance();
			this.#readBlock([], blkStart, blkEnd);
			const closing = this.#curr();
			if (closing.type === TokenType.Bracket && closing.value === "}") this.#advance();
			return;
		}

		if (t.type === TokenType.Separator && t.value === ";") {
			this.#advance();
			return;
		}

		this.#skipToSemi();
	}

	//#endregion

	//#region Control flow

	#readIf(scopeStart: number, scopeEnd: number): void {
		this.#advance();
		this.#skipBalanced("(", ")");
		this.#readStatement(scopeStart, scopeEnd);
		const t = this.#curr();
		if (t.type === TokenType.Keyword && t.value === "else") {
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
		const open = this.#curr();
		if (!(open.type === TokenType.Bracket && open.value === "(")) {
			this.#skipToSemi();
			return;
		}
		this.#advance();

		let varName = "";
		let typeName = "";

		const ident = this.#curr();
		if (ident.type === TokenType.Identifier) {
			varName = ident.value;
			this.#advance();
			typeName = this.#readType();
			const inKw = this.#curr();
			if (inKw.type === TokenType.Keyword && inKw.value === "in") this.#advance();
		}

		let depth = 1;
		while (!this.#atEOF() && depth > 0) {
			const t = this.#curr();
			if (t.type === TokenType.Bracket && t.value === "(") depth++;
			else if (t.type === TokenType.Bracket && t.value === ")") {
				depth--;
				if (depth === 0) break;
			}
			this.#advance();
		}
		const closeParen = this.#curr();
		if (closeParen.type === TokenType.Bracket && closeParen.value === ")") this.#advance();

		const bodyToken = this.#curr();
		const bodyEnd = (bodyToken.type === TokenType.Bracket && bodyToken.value === "{")
			? this.#findMatchingBrace()
			: scopeEnd;

		if (varName) {
			this.#table.addVar({ name: varName, typeName, startLine: bodyToken.range.startLine, endLine: bodyEnd });
		}

		this.#readStatement(scopeStart, scopeEnd);
	}

	//#endregion

	//#region Declarations

	#readVarDecl(scopeStart: number, scopeEnd: number): void {
		const nameToken = this.#advance();
		const typeName = this.#readType();

		const colon = this.#curr();
		if (colon.type === TokenType.Operator && colon.value === ":") {
			this.#advance();
			this.#skipToSemi();
		}

		this.#table.addVar({ name: nameToken.value, typeName, startLine: nameToken.range.startLine, endLine: scopeEnd } as VarDef);
	}

	#readParams(): ParamDef[] {
		const open = this.#curr();
		if (!(open.type === TokenType.Bracket && open.value === "(")) return [];
		this.#advance();
		const params: ParamDef[] = [];

		while (!this.#atEOF()) {
			const t = this.#curr();
			if (t.type === TokenType.Bracket && t.value === ")") break;
			if (t.type === TokenType.Separator) { this.#advance(); continue; }
			if (t.type !== TokenType.Identifier) { this.#advance(); continue; }
			const paramName = t.value;
			this.#advance();
			const type = this.#readType();
			params.push({ name: paramName, typeName: type });
		}

		const close = this.#curr();
		if (close.type === TokenType.Bracket && close.value === ")") this.#advance();
		return params;
	}

	#readType(): string {
		const base = this.#curr();
		if (base.type !== TokenType.Identifier) return "";
		this.#advance();

		const afterBase = this.#curr();
		if (afterBase.type === TokenType.Operator && afterBase.value === "<") {
			this.#advance();
			const args: string[] = [];
			let depth = 1;
			while (!this.#atEOF() && depth > 0) {
				const t = this.#curr();
				if (t.type === TokenType.Operator && t.value === "<") { depth++; this.#advance(); continue; }
				if (t.type === TokenType.Operator && t.value === ">") {
					depth--;
					if (depth === 0) break;
					this.#advance();
					continue;
				}
				if (t.type === TokenType.Identifier) { args.push(this.#readType()); continue; }
				if (t.type === TokenType.Separator && t.value === ",") { this.#advance(); continue; }
				this.#advance();
			}
			const close = this.#curr();
			if (close.type === TokenType.Operator && close.value === ">") this.#advance();
			return `${base.value}<${args.join(", ")}>`;
		}

		const maybeQ = this.#curr();
		if (maybeQ.type === TokenType.Operator && maybeQ.value === "?") {
			this.#advance();
			return `Nullable<${base.value}>`;
		}

		return base.value;
	}

	//#endregion

	//#region Utilities

	#findMatchingBrace(): number {
		let depth = 0;
		for (let i = this.#cursor; i < this.#tokens.length; i++) {
			const t = this.#tokens[i];
			if (t.type === TokenType.Bracket && t.value === "{") depth++;
			else if (t.type === TokenType.Bracket && t.value === "}") {
				depth--;
				if (depth === 0) return t.range.endLine;
			}
		}
		return Number.MAX_SAFE_INTEGER;
	}

	#skipBalanced(open: string, close: string): void {
		const first = this.#curr();
		if (!(first.type === TokenType.Bracket && first.value === open)) return;
		this.#advance();
		let depth = 1;
		while (!this.#atEOF() && depth > 0) {
			const t = this.#curr();
			if (t.type === TokenType.Bracket && t.value === open) depth++;
			else if (t.type === TokenType.Bracket && t.value === close) {
				depth--;
				if (depth === 0) break;
			}
			this.#advance();
		}
		const closing = this.#curr();
		if (closing.type === TokenType.Bracket && closing.value === close) this.#advance();
	}

	#skipToSemi(): void {
		while (!this.#atEOF()) {
			const t = this.#curr();
			if (t.type === TokenType.Separator && t.value === ";") { this.#advance(); return; }
			if (t.type === TokenType.Bracket && t.value === "}") return;
			this.#advance();
		}
	}

	#skipSemi(): void {
		const t = this.#curr();
		if (t.type === TokenType.Separator && t.value === ";") this.#advance();
	}

	#curr(): Token {
		return this.#cursor < this.#tokens.length
			? this.#tokens[this.#cursor]
			: { type: TokenType.EOF, value: "", range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 } };
	}

	#peek(offset: number): Token {
		const idx = this.#cursor + offset;
		return idx < this.#tokens.length
			? this.#tokens[idx]
			: { type: TokenType.EOF, value: "", range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 } };
	}

	#advance(): Token {
		const t = this.#curr();
		if (this.#cursor < this.#tokens.length) this.#cursor++;
		return t;
	}

	#atEOF(): boolean {
		return this.#cursor >= this.#tokens.length || this.#tokens[this.#cursor].type === TokenType.EOF;
	}

	//#endregion
}
//#endregion
