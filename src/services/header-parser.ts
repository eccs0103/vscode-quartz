"use strict";

import "adaptive-extender/node";
import { TokenType } from "../models/token.js";
import { TypeDefinition, FieldDefinition, MethodDefinition, ParameterDefinition } from "../models/symbol-definitions.js";
import { SymbolTable } from "./symbol-table.js";
import { TokenStream } from "./token-stream.js";

//#region Header parser
export class HeaderParser {
	#stream!: TokenStream;

	parse(code: string): SymbolTable {
		this.#stream = new TokenStream(code);
		const stream = this.#stream;
		const table = new SymbolTable();

		while (!stream.atEOF()) {
			if (stream.current().type !== TokenType.Identifier) {
				stream.advance();
				continue;
			}
			const entry = this.#readClass();
			if (entry !== null) table.addType(entry);
		}

		return table;
	}

	#readClass(): TypeDefinition | null {
		const stream = this.#stream;
		const name = stream.current().value;
		stream.advance();

		const typeParams: string[] = [];
		if (stream.current().type === TokenType.Operator && stream.current().value === "<") {
			stream.advance();
			while (!stream.atEOF()) {
				const token = stream.current();
				if (token.type === TokenType.Operator && token.value === ">") break;
				if (token.type === TokenType.Identifier) typeParams.push(token.value);
				stream.advance();
			}
			if (stream.current().type === TokenType.Operator) stream.advance();
		}

		let parent: string | undefined;
		if (stream.current().type === TokenType.Identifier && stream.current().value === "from") {
			stream.advance();
			parent = stream.readType();
		}

		while (!stream.atEOF()) {
			const token = stream.current();
			if (token.type === TokenType.Bracket && token.value === "{") break;
			stream.advance();
		}
		if (stream.atEOF()) return null;
		stream.advance();

		const methods: MethodDefinition[] = [];
		const fields: FieldDefinition[] = [];

		while (!stream.atEOF()) {
			const token = stream.current();
			if (token.type === TokenType.Bracket && token.value === "}") break;
			this.#readMember(methods, fields);
		}

		if (stream.current().type === TokenType.Bracket) stream.advance();
		return new TypeDefinition(name, typeParams, parent, methods, fields);
	}

	#readMember(methods: MethodDefinition[], fields: FieldDefinition[]): void {
		const stream = this.#stream;
		const first = stream.current();

		if (first.type === TokenType.Bracket && first.value === "[") {
			stream.advance();
			let name = "[";
			while (!stream.atEOF()) {
				const token = stream.current();
				if (token.type === TokenType.Bracket && token.value === "]") break;
				name += token.value;
				stream.advance();
			}
			name += "]";
			if (stream.current().type === TokenType.Bracket) stream.advance();
			const params = stream.readParams();
			const retType = stream.readType();
			stream.skipSemicolon();
			methods.push(new MethodDefinition(name, params, retType));
			return;
		}

		if (first.type !== TokenType.Identifier) {
			stream.advance();
			return;
		}

		const name = first.value;
		stream.advance();

		const next = stream.current();
		if (next.type === TokenType.Bracket && next.value === "(") {
			const params = stream.readParams();
			const retType = stream.readType();
			stream.skipSemicolon();
			methods.push(new MethodDefinition(name, params, retType));
		} else {
			const typeName = stream.readType();
			stream.skipSemicolon();
			fields.push(new FieldDefinition(name, typeName));
		}
	}
}
//#endregion
