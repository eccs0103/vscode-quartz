"use strict";

import { TokenType } from "../models/token.js";
import { ClassDef, FieldDef, MethodDef, ParamDef } from "../models/symbol-defs.js";
import { SymbolTable } from "./symbol-table.js";
import { BaseParser } from "./base-parser.js";

//#region Header parser
export class HeaderParser extends BaseParser {
	parse(code: string): SymbolTable {
		this.initTokens(code);
		const table = new SymbolTable();

		while (!this.atEOF()) {
			if (this.current().type !== TokenType.Identifier) {
				this.advance();
				continue;
			}
			const entry = this.#readClass();
			if (entry) table.addClass(entry);
		}

		return table;
	}

	#readClass(): ClassDef | null {
		const name = this.current().value;
		this.advance();

		const typeParams: string[] = [];
		if (this.current().type === TokenType.Operator && this.current().value === "<") {
			this.advance();
			while (!this.atEOF()) {
				const token = this.current();
				if (token.type === TokenType.Operator && token.value === ">") break;
				if (token.type === TokenType.Identifier) typeParams.push(token.value);
				this.advance();
			}
			if (this.current().type === TokenType.Operator) this.advance();
		}

		let parent: string | undefined;
		if (this.current().type === TokenType.Identifier && this.current().value === "from") {
			this.advance();
			parent = this.readType();
		}

		while (!this.atEOF()) {
			const token = this.current();
			if (token.type === TokenType.Bracket && token.value === "{") break;
			this.advance();
		}
		if (this.atEOF()) return null;
		this.advance();

		const methods: MethodDef[] = [];
		const fields: FieldDef[] = [];

		while (!this.atEOF()) {
			const token = this.current();
			if (token.type === TokenType.Bracket && token.value === "}") break;
			this.#readMember(methods, fields);
		}

		if (this.current().type === TokenType.Bracket) this.advance();
		return new ClassDef(name, typeParams, parent, methods, fields);
	}

	#readMember(methods: MethodDef[], fields: FieldDef[]): void {
		const first = this.current();

		if (first.type === TokenType.Bracket && first.value === "[") {
			this.advance();
			let name = "[";
			while (!this.atEOF()) {
				const token = this.current();
				if (token.type === TokenType.Bracket && token.value === "]") break;
				name += token.value;
				this.advance();
			}
			name += "]";
			if (this.current().type === TokenType.Bracket) this.advance();
			const params = this.readParams();
			const retType = this.readType();
			this.skipSemicolon();
			methods.push(new MethodDef(name, params, retType));
			return;
		}

		if (first.type !== TokenType.Identifier) {
			this.advance();
			return;
		}

		const name = first.value;
		this.advance();

		const next = this.current();
		if (next.type === TokenType.Bracket && next.value === "(") {
			const params = this.readParams();
			const retType = this.readType();
			this.skipSemicolon();
			methods.push(new MethodDef(name, params, retType));
		} else {
			const typeName = this.readType();
			this.skipSemicolon();
			fields.push(new FieldDef(name, typeName));
		}
	}
}
//#endregion
