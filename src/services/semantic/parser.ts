"use strict";

import { Lexer, Token, TokenType } from './lexer.js';
import { FuncDef, ParamDef, SymbolTable, VarDef } from './symbol-table.js';

//#region DocParser
// Parses Quartz user code. Matches the grammar from Quartz.Application/Parsing/Parser.cs:
//   Program      = (FuncDecl | VarDecl ";")*
//   FuncDecl     = Ident "(" Params ")" Type Block
//   VarDecl      = Ident Type [":" Expr]
//   Type         = Ident ["<" Type {"," Type} ">"] ["?"]
//   Params       = [Param {"," Param}]
//   Param        = Ident Type
//   Statement    = VarDecl ";" | IfStmt | WhileStmt | ForStmt | "return" ... ";"
//                | "break" ";" | "continue" ";" | Block | Expr ";"
export class DocParser {
	private tokens: Token[] = [];
	private cursor = 0;
	private table!: SymbolTable;

	parse(code: string): SymbolTable {
		this.tokens = new Lexer(code).tokenize();
		this.cursor = 0;
		this.table = new SymbolTable();
		this.readProgram();
		return this.table;
	}

	//#region Top-level

	private readProgram(): void {
		while (!this.atEOF()) {
			if (this.isFuncDecl()) {
				this.readFuncDecl(Number.MAX_SAFE_INTEGER);
			} else if (this.isVarDecl()) {
				this.readVarDecl(0, Number.MAX_SAFE_INTEGER);
				this.skipSemi();
			} else {
				this.advance();
			}
		}
	}

	// Quartz function: name(params) RetType { body }  — no 'function' keyword
	private isFuncDecl(): boolean {
		const cur = this.curr();
		const nxt = this.peek(1);
		return cur.type === TokenType.Identifier && nxt.type === TokenType.Bracket && nxt.value === '(';
	}

	// Variable declaration: name Type  (two consecutive identifiers)
	private isVarDecl(): boolean {
		const cur = this.curr();
		const nxt = this.peek(1);
		return cur.type === TokenType.Identifier && nxt.type === TokenType.Identifier;
	}

	//#endregion

	//#region Function declaration

	private readFuncDecl(outerEnd: number): void {
		const nameToken = this.advance(); // function name
		const params = this.readParams();
		const retType = this.readType();

		const bodyStart = this.curr().range.startLine;
		const bodyEnd = this.findMatchingBrace();

		this.table.addFunc({
			name: nameToken.value,
			params,
			retType,
			startLine: nameToken.range.startLine,
			endLine: bodyEnd
		});

		const blk = this.curr();
		if (!(blk.type === TokenType.Bracket && blk.value === '{')) return;
		this.advance(); // consume '{'
		this.readBlock(params, bodyStart, bodyEnd);
		const closing = this.curr();
		if (closing.type === TokenType.Bracket && closing.value === '}') this.advance();
	}

	//#endregion

	//#region Block & statements

	private readBlock(initParams: ParamDef[], blockStart: number, blockEnd: number): void {
		// Register function parameters as variables scoped to this block
		for (const p of initParams) {
			this.table.addVar({ name: p.name, typeName: p.typeName, startLine: blockStart, endLine: blockEnd });
		}
		while (!this.atEOF()) {
			const t = this.curr();
			if (t.type === TokenType.Bracket && t.value === '}') break;
			this.readStatement(blockStart, blockEnd);
		}
	}

	private readStatement(scopeStart: number, scopeEnd: number): void {
		// Variable declaration at statement level
		if (this.isVarDecl()) {
			this.readVarDecl(scopeStart, scopeEnd);
			this.skipSemi();
			return;
		}

		const t = this.curr();

		// Keywords
		if (t.type === TokenType.Keyword) {
			switch (t.value) {
			case 'if': this.readIf(scopeStart, scopeEnd); return;
			case 'while': this.readWhile(scopeStart, scopeEnd); return;
			case 'for': this.readFor(scopeStart, scopeEnd); return;
			case 'return': this.skipToSemi(); return;
			case 'break': this.advance(); this.skipSemi(); return;
			case 'continue': this.advance(); this.skipSemi(); return;
			}
		}

		// Anonymous block
		if (t.type === TokenType.Bracket && t.value === '{') {
			const blkStart = t.range.startLine;
			const blkEnd = this.findMatchingBrace();
			this.advance(); // consume '{'
			this.readBlock([], blkStart, blkEnd);
			const closing = this.curr();
			if (closing.type === TokenType.Bracket && closing.value === '}') this.advance();
			return;
		}

		// Empty statement
		if (t.type === TokenType.Separator && t.value === ';') {
			this.advance();
			return;
		}

		// Expression / assignment statement — skip to semicolon
		this.skipToSemi();
	}

	//#endregion

	//#region Control flow

	private readIf(scopeStart: number, scopeEnd: number): void {
		this.advance(); // consume 'if'
		this.skipBalanced('(', ')');
		this.readStatement(scopeStart, scopeEnd);
		const t = this.curr();
		if (t.type === TokenType.Keyword && t.value === 'else') {
			this.advance();
			this.readStatement(scopeStart, scopeEnd);
		}
	}

	private readWhile(scopeStart: number, scopeEnd: number): void {
		this.advance(); // consume 'while'
		this.skipBalanced('(', ')');
		this.readStatement(scopeStart, scopeEnd);
	}

	private readFor(scopeStart: number, scopeEnd: number): void {
		this.advance(); // consume 'for'
		const open = this.curr();
		if (!(open.type === TokenType.Bracket && open.value === '(')) {
			this.skipToSemi();
			return;
		}
		this.advance(); // consume '('

		let varName = '';
		let typeName = '';

		const ident = this.curr();
		if (ident.type === TokenType.Identifier) {
			varName = ident.value;
			this.advance();
			typeName = this.readType();
			const inKw = this.curr();
			if (inKw.type === TokenType.Keyword && inKw.value === 'in') this.advance();
		}

		// Skip to closing ')'
		let depth = 1;
		while (!this.atEOF() && depth > 0) {
			const t = this.curr();
			if (t.type === TokenType.Bracket && t.value === '(') depth++;
			else if (t.type === TokenType.Bracket && t.value === ')') {
				depth--;
				if (depth === 0) break;
			}
			this.advance();
		}
		const closeParen = this.curr();
		if (closeParen.type === TokenType.Bracket && closeParen.value === ')') this.advance();

		// Determine body scope end
		const bodyToken = this.curr();
		const bodyEnd = (bodyToken.type === TokenType.Bracket && bodyToken.value === '{')
			? this.findMatchingBrace()
			: scopeEnd;

		if (varName) {
			this.table.addVar({ name: varName, typeName, startLine: bodyToken.range.startLine, endLine: bodyEnd });
		}

		this.readStatement(scopeStart, scopeEnd);
	}

	//#endregion

	//#region Declarations

	private readVarDecl(scopeStart: number, scopeEnd: number): void {
		const nameToken = this.advance(); // variable name
		const typeName = this.readType();

		const colon = this.curr();
		if (colon.type === TokenType.Operator && colon.value === ':') {
			this.advance();
			this.skipToSemi();
		}

		this.table.addVar({ name: nameToken.value, typeName, startLine: nameToken.range.startLine, endLine: scopeEnd } as VarDef);
	}

	private readParams(): ParamDef[] {
		const open = this.curr();
		if (!(open.type === TokenType.Bracket && open.value === '(')) return [];
		this.advance();
		const params: ParamDef[] = [];

		while (!this.atEOF()) {
			const t = this.curr();
			if (t.type === TokenType.Bracket && t.value === ')') break;
			if (t.type === TokenType.Separator) { this.advance(); continue; }
			if (t.type !== TokenType.Identifier) { this.advance(); continue; }
			const paramName = t.value;
			this.advance();
			const type = this.readType();
			params.push({ name: paramName, typeName: type });
		}

		const close = this.curr();
		if (close.type === TokenType.Bracket && close.value === ')') this.advance();
		return params;
	}

	// Reads TypeName[<Args>][?] and advances cursor
	private readType(): string {
		const base = this.curr();
		if (base.type !== TokenType.Identifier) return '';
		this.advance();

		const afterBase = this.curr();
		if (afterBase.type === TokenType.Operator && afterBase.value === '<') {
			this.advance();
			const args: string[] = [];
			let depth = 1;
			while (!this.atEOF() && depth > 0) {
				const t = this.curr();
				if (t.type === TokenType.Operator && t.value === '<') { depth++; this.advance(); continue; }
				if (t.type === TokenType.Operator && t.value === '>') {
					depth--;
					if (depth === 0) break;
					this.advance();
					continue;
				}
				if (t.type === TokenType.Identifier) { args.push(this.readType()); continue; }
				if (t.type === TokenType.Separator && t.value === ',') { this.advance(); continue; }
				this.advance();
			}
			const close = this.curr();
			if (close.type === TokenType.Operator && close.value === '>') this.advance();
			return `${base.value}<${args.join(', ')}>`;
		}

		const maybeQ = this.curr();
		if (maybeQ.type === TokenType.Operator && maybeQ.value === '?') {
			this.advance();
			return `Nullable<${base.value}>`;
		}

		return base.value;
	}

	//#endregion

	//#region Utilities

	// Look ahead at the matching '}' for the '{' at current cursor position
	private findMatchingBrace(): number {
		let depth = 0;
		for (let i = this.cursor; i < this.tokens.length; i++) {
			const t = this.tokens[i];
			if (t.type === TokenType.Bracket && t.value === '{') depth++;
			else if (t.type === TokenType.Bracket && t.value === '}') {
				depth--;
				if (depth === 0) return t.range.endLine;
			}
		}
		return Number.MAX_SAFE_INTEGER;
	}

	private skipBalanced(open: string, close: string): void {
		const first = this.curr();
		if (!(first.type === TokenType.Bracket && first.value === open)) return;
		this.advance();
		let depth = 1;
		while (!this.atEOF() && depth > 0) {
			const t = this.curr();
			if (t.type === TokenType.Bracket && t.value === open) depth++;
			else if (t.type === TokenType.Bracket && t.value === close) {
				depth--;
				if (depth === 0) break;
			}
			this.advance();
		}
		const closing = this.curr();
		if (closing.type === TokenType.Bracket && closing.value === close) this.advance();
	}

	private skipToSemi(): void {
		while (!this.atEOF()) {
			const t = this.curr();
			if (t.type === TokenType.Separator && t.value === ';') { this.advance(); return; }
			// Stop at block boundaries to avoid eating function bodies
			if (t.type === TokenType.Bracket && t.value === '}') return;
			this.advance();
		}
	}

	private skipSemi(): void {
		const t = this.curr();
		if (t.type === TokenType.Separator && t.value === ';') this.advance();
	}

	// Each call to curr() is opaque to TypeScript narrowing (method, not getter)
	private curr(): Token {
		return this.cursor < this.tokens.length
			? this.tokens[this.cursor]
			: { type: TokenType.EOF, value: '', range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 } };
	}

	private peek(offset: number): Token {
		const idx = this.cursor + offset;
		return idx < this.tokens.length
			? this.tokens[idx]
			: { type: TokenType.EOF, value: '', range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 } };
	}

	private advance(): Token {
		const t = this.curr();
		if (this.cursor < this.tokens.length) this.cursor++;
		return t;
	}

	private atEOF(): boolean {
		return this.cursor >= this.tokens.length || this.tokens[this.cursor].type === TokenType.EOF;
	}

	//#endregion
}
//#endregion
