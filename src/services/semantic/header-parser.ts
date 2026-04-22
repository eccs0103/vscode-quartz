"use strict";

import { Lexer, Token, TokenType } from "./lexer.js";
import { ClassDef, FieldDef, MethodDef, ParamDef, SymbolTable } from "./symbol-table.js";

//#region HeaderParser
export class HeaderParser {
	#tokens: Token[] = [];
	#cursor = 0;

	parse(code: string): SymbolTable {
		this.#tokens = new Lexer(code).tokenize();
		this.#cursor = 0;
		const table = new SymbolTable();

		while (!this.#atEOF()) {
			if (this.#curr().type !== TokenType.Identifier) {
				this.#advance();
				continue;
			}
			const cls = this.#readClass();
			if (cls) table.addClass(cls);
		}

		return table;
	}

	#readClass(): ClassDef | null {
		const name = this.#curr().value;
		this.#advance();

		const typeParams: string[] = [];
		if (this.#curr().type === TokenType.Operator && this.#curr().value === "<") {
			this.#advance();
			while (!this.#atEOF()) {
				const t = this.#curr();
				if (t.type === TokenType.Operator && t.value === ">") break;
				if (t.type === TokenType.Identifier) typeParams.push(t.value);
				this.#advance();
			}
			if (this.#curr().type === TokenType.Operator) this.#advance();
		}

		let parent: string | undefined;
		if (this.#curr().type === TokenType.Identifier && this.#curr().value === "from") {
			this.#advance();
			parent = this.#readType();
		}

		while (!this.#atEOF()) {
			const t = this.#curr();
			if (t.type === TokenType.Bracket && t.value === "{") break;
			this.#advance();
		}
		if (this.#atEOF()) return null;
		this.#advance();

		const methods: MethodDef[] = [];
		const fields: FieldDef[] = [];

		while (!this.#atEOF()) {
			const t = this.#curr();
			if (t.type === TokenType.Bracket && t.value === "}") break;
			this.#readMember(methods, fields);
		}

		if (this.#curr().type === TokenType.Bracket) this.#advance();
		return { name, typeParams, parent, methods, fields };
	}

	#readMember(methods: MethodDef[], fields: FieldDef[]): void {
		const first = this.#curr();

		if (first.type === TokenType.Bracket && first.value === "[") {
			this.#advance();
			let opName = "[";
			while (!this.#atEOF()) {
				const t = this.#curr();
				if (t.type === TokenType.Bracket && t.value === "]") break;
				opName += t.value;
				this.#advance();
			}
			opName += "]";
			if (this.#curr().type === TokenType.Bracket) this.#advance();
			const params = this.#readParams();
			const retType = this.#readType();
			this.#skipSemi();
			methods.push({ name: opName, params, retType });
			return;
		}

		if (first.type !== TokenType.Identifier) {
			this.#advance();
			return;
		}

		const memberName = first.value;
		this.#advance();

		const next = this.#curr();
		if (next.type === TokenType.Bracket && next.value === "(") {
			const params = this.#readParams();
			const retType = this.#readType();
			this.#skipSemi();
			methods.push({ name: memberName, params, retType });
		} else {
			const typeName = this.#readType();
			this.#skipSemi();
			fields.push({ name: memberName, typeName });
		}
	}

	#readParams(): ParamDef[] {
		const open = this.#curr();
		if (!(open.type === TokenType.Bracket && open.value === "(")) return [];
		this.#advance();
		const params: ParamDef[] = [];

		while (!this.#atEOF()) {
			const t = this.#curr();
			if (t.type === TokenType.Bracket && t.value === ")") break;
			if (t.type === TokenType.Separator && t.value === ",") {
				this.#advance();
				continue;
			}
			if (t.type !== TokenType.Identifier) {
				this.#advance();
				continue;
			}
			const paramName = t.value;
			this.#advance();
			const typeName = this.#readType();
			params.push({ name: paramName, typeName });
		}

		if (this.#curr().type === TokenType.Bracket) this.#advance();
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
			while (!this.#atEOF()) {
				const t = this.#curr();
				if (t.type === TokenType.Operator && t.value === ">") break;
				if (t.type === TokenType.Separator && t.value === ",") {
					this.#advance();
					continue;
				}
				if (t.type === TokenType.Identifier) {
					args.push(this.#readType());
				} else {
					this.#advance();
				}
			}
			if (this.#curr().type === TokenType.Operator) this.#advance();
			return `${base.value}<${args.join(", ")}>`;
		}

		const afterIdent = this.#curr();
		if (afterIdent.type === TokenType.Operator && afterIdent.value === "?") {
			this.#advance();
			return `Nullable<${base.value}>`;
		}

		return base.value;
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

	#advance(): Token {
		const t = this.#curr();
		if (this.#cursor < this.#tokens.length) this.#cursor++;
		return t;
	}

	#atEOF(): boolean {
		return this.#cursor >= this.#tokens.length || this.#tokens[this.#cursor].type === TokenType.EOF;
	}
}
//#endregion
