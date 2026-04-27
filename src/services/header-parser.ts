"use strict";

import "adaptive-extender/node";
import { TokenType } from "../models/token.js";
import { TypeDefinition, FieldDefinition, MethodDefinition, ParameterDefinition } from "../models/symbol-definitions.js";
import { SymbolTable } from "./symbol-table.js";
import { TokenStream } from "./token-stream.js";
import { TypeReader } from "./type-reader.js";

//#region Header parser
export class HeaderParser {
	#stream!: TokenStream;
	#reader!: TypeReader;

	parse(code: string): SymbolTable {
		this.#stream = new TokenStream(code);
		this.#reader = new TypeReader(this.#stream);
		const stream = this.#stream;
		const table = new SymbolTable();

		while (true) {
			const token = stream.current();
			if (token === null) break;
			if (token.type !== TokenType.Identifier) {
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
		const nameToken = stream.current();
		if (nameToken === null) return null;
		const name = nameToken.value;
		stream.advance();

		const typeParams: string[] = [];
		const openAngle = stream.current();
		if (openAngle !== null && openAngle.type === TokenType.Operator && openAngle.value === "<") {
			stream.advance();
			while (true) {
				const token = stream.current();
				if (token === null || (token.type === TokenType.Operator && token.value === ">")) break;
				if (token.type === TokenType.Identifier) typeParams.push(token.value);
				stream.advance();
			}
			const closeAngle = stream.current();
			if (closeAngle !== null && closeAngle.type === TokenType.Operator) stream.advance();
		}

		let parent: string | undefined;
		const fromToken = stream.current();
		if (fromToken !== null && fromToken.type === TokenType.Identifier && fromToken.value === "from") {
			stream.advance();
			parent = this.#reader.readType();
		}

		while (true) {
			const token = stream.current();
			if (token === null) return null;
			if (token.type === TokenType.Bracket && token.value === "{") break;
			stream.advance();
		}
		stream.advance();

		const methods: MethodDefinition[] = [];
		const fields: FieldDefinition[] = [];

		while (true) {
			const token = stream.current();
			if (token === null || (token.type === TokenType.Bracket && token.value === "}")) break;
			this.#readMember(methods, fields);
		}

		const closing = stream.current();
		if (closing !== null && closing.type === TokenType.Bracket) stream.advance();
		return new TypeDefinition(name, typeParams, parent, methods, fields);
	}

	#readMember(methods: MethodDefinition[], fields: FieldDefinition[]): void {
		const stream = this.#stream;
		const first = stream.current();
		if (first === null) return;

		if (first.type === TokenType.Bracket && first.value === "[") {
			stream.advance();
			let name = "[";
			while (true) {
				const token = stream.current();
				if (token === null || (token.type === TokenType.Bracket && token.value === "]")) break;
				name += token.value;
				stream.advance();
			}
			name += "]";
			const afterBracket = stream.current();
			if (afterBracket !== null && afterBracket.type === TokenType.Bracket) stream.advance();
			const params = this.#reader.readParams();
			const retType = this.#reader.readType();
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
		if (next !== null && next.type === TokenType.Bracket && next.value === "(") {
			const params = this.#reader.readParams();
			const retType = this.#reader.readType();
			stream.skipSemicolon();
			methods.push(new MethodDefinition(name, params, retType));
		} else {
			const typeName = this.#reader.readType();
			stream.skipSemicolon();
			fields.push(new FieldDefinition(name, typeName));
		}
	}
}
//#endregion
