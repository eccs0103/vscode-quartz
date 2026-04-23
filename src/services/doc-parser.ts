"use strict";

import { TokenType } from "../models/token.js";
import { FunctionDefinition, ParameterDefinition, VariableDefinition } from "../models/symbol-defs.js";
import { SymbolTable } from "./symbol-table.js";
import { TokenStream } from "./token-stream.js";

//#region Document parser
export class DocumentParser {
	#stream: TokenStream = new TokenStream();
	#table: SymbolTable = new SymbolTable();

	parse(code: string): SymbolTable {
		const stream = this.#stream;
		stream.load(code);
		this.#table = new SymbolTable();
		this.#readProgram();
		return this.#table;
	}

	//#region Top level
	#readProgram(): void {
		const stream = this.#stream;
		while (!stream.atEOF()) {
			if (this.#isFuncDecl()) {
				this.#readFuncDecl();
			} else if (this.#isVarDecl()) {
				this.#readVarDecl(0, Number.MAX_SAFE_INTEGER);
				stream.skipSemicolon();
			} else {
				stream.advance();
			}
		}
	}

	#isFuncDecl(): boolean {
		const stream = this.#stream;
		const current = stream.current();
		const next = stream.peek(1);
		return current.type === TokenType.Identifier && next.type === TokenType.Bracket && next.value === "(";
	}

	#isVarDecl(): boolean {
		const stream = this.#stream;
		const current = stream.current();
		const next = stream.peek(1);
		return current.type === TokenType.Identifier && next.type === TokenType.Identifier;
	}
	//#endregion
	//#region Function declaration
	#readFuncDecl(): void {
		const stream = this.#stream;
		const nameToken = stream.advance();
		const params = stream.readParams();
		const retType = stream.readType();

		const bodyStart = stream.current().range.startLine;
		const bodyEnd = stream.findMatchingBrace();

		this.#table.addFunction(new FunctionDefinition(nameToken.value, params, retType, nameToken.range.startLine, bodyEnd));

		const bodyOpen = stream.current();
		if (!(bodyOpen.type === TokenType.Bracket && bodyOpen.value === "{")) return;
		stream.advance();
		this.#readBlock(params, bodyStart, bodyEnd);
		const closing = stream.current();
		if (closing.type === TokenType.Bracket && closing.value === "}") stream.advance();
	}
	//#endregion
	//#region Block and statements
	#readBlock(initParams: ParameterDefinition[], blockStart: number, blockEnd: number): void {
		const stream = this.#stream;
		for (const parameter of initParams) this.#table.addVariable(new VariableDefinition(parameter.name, parameter.typeName, blockStart, blockEnd));
		while (!stream.atEOF()) {
			const token = stream.current();
			if (token.type === TokenType.Bracket && token.value === "}") break;
			this.#readStatement(blockStart, blockEnd);
		}
	}

	#readStatement(scopeStart: number, scopeEnd: number): void {
		const stream = this.#stream;
		if (this.#isVarDecl()) {
			this.#readVarDecl(scopeStart, scopeEnd);
			stream.skipSemicolon();
			return;
		}

		const token = stream.current();

		if (token.type === TokenType.Keyword) {
			switch (token.value) {
			case "if": this.#readIf(scopeStart, scopeEnd); return;
			case "while": this.#readWhile(scopeStart, scopeEnd); return;
			case "for": this.#readFor(scopeStart, scopeEnd); return;
			case "return": this.#skipToSemicolon(); return;
			case "break": stream.advance(); stream.skipSemicolon(); return;
			case "continue": stream.advance(); stream.skipSemicolon(); return;
			}
		}

		if (token.type === TokenType.Bracket && token.value === "{") {
			const blockStart = token.range.startLine;
			const blockEnd = stream.findMatchingBrace();
			stream.advance();
			this.#readBlock([], blockStart, blockEnd);
			const closing = stream.current();
			if (closing.type === TokenType.Bracket && closing.value === "}") stream.advance();
			return;
		}

		if (token.type === TokenType.Separator && token.value === ";") {
			stream.advance();
			return;
		}

		this.#skipToSemicolon();
	}
	//#endregion
	//#region Control flow
	#readIf(scopeStart: number, scopeEnd: number): void {
		const stream = this.#stream;
		stream.advance();
		this.#skipBalanced("(", ")");
		this.#readStatement(scopeStart, scopeEnd);
		const token = stream.current();
		if (token.type === TokenType.Keyword && token.value === "else") {
			stream.advance();
			this.#readStatement(scopeStart, scopeEnd);
		}
	}

	#readWhile(scopeStart: number, scopeEnd: number): void {
		this.#stream.advance();
		this.#skipBalanced("(", ")");
		this.#readStatement(scopeStart, scopeEnd);
	}

	#readFor(scopeStart: number, scopeEnd: number): void {
		const stream = this.#stream;
		stream.advance();
		const open = stream.current();
		if (!(open.type === TokenType.Bracket && open.value === "(")) {
			this.#skipToSemicolon();
			return;
		}
		stream.advance();

		let name = "";
		let typeName = "";

		const nameToken = stream.current();
		if (nameToken.type === TokenType.Identifier) {
			name = nameToken.value;
			stream.advance();
			typeName = stream.readType();
			const inKeyword = stream.current();
			if (inKeyword.type === TokenType.Keyword && inKeyword.value === "in") stream.advance();
		}

		let depth = 1;
		while (!stream.atEOF() && depth > 0) {
			const token = stream.current();
			if (token.type === TokenType.Bracket && token.value === "(") depth++;
			else if (token.type === TokenType.Bracket && token.value === ")") {
				depth--;
				if (depth === 0) break;
			}
			stream.advance();
		}
		const closeParen = stream.current();
		if (closeParen.type === TokenType.Bracket && closeParen.value === ")") stream.advance();

		const bodyToken = stream.current();
		const bodyEnd = (bodyToken.type === TokenType.Bracket && bodyToken.value === "{")
			? stream.findMatchingBrace()
			: scopeEnd;

		if (name) this.#table.addVariable(new VariableDefinition(name, typeName, bodyToken.range.startLine, bodyEnd));

		this.#readStatement(scopeStart, scopeEnd);
	}
	//#endregion
	//#region Declarations
	#readVarDecl(scopeStart: number, scopeEnd: number): void {
		const stream = this.#stream;
		const nameToken = stream.advance();
		const typeName = stream.readType();

		const colon = stream.current();
		if (colon.type === TokenType.Operator && colon.value === ":") {
			stream.advance();
			this.#skipToSemicolon();
		}

		this.#table.addVariable(new VariableDefinition(nameToken.value, typeName, nameToken.range.startLine, scopeEnd));
	}
	//#endregion
	//#region Utilities
	#skipToSemicolon(): void {
		const stream = this.#stream;
		while (!stream.atEOF()) {
			const token = stream.current();
			if (token.type === TokenType.Separator && token.value === ";") { stream.advance(); return; }
			if (token.type === TokenType.Bracket && token.value === "}") return;
			stream.advance();
		}
	}

	#skipBalanced(open: string, close: string): void {
		const stream = this.#stream;
		const first = stream.current();
		if (!(first.type === TokenType.Bracket && first.value === open)) return;
		let depth = 1;
		stream.advance();
		while (!stream.atEOF() && depth > 0) {
			const token = stream.current();
			if (token.type === TokenType.Bracket && token.value === open) depth++;
			else if (token.type === TokenType.Bracket && token.value === close) depth--;
			stream.advance();
		}
	}
	//#endregion
}
//#endregion
