"use strict";

import "adaptive-extender/node";
import { TokenType } from "../models/token.js";
import { ParameterDefinition } from "../models/symbol-definitions.js";
import { TokenStream } from "./token-stream.js";

//#region Type reader
export class TypeReader {
	#stream: TokenStream;

	constructor(stream: TokenStream) {
		this.#stream = stream;
	}

	readType(): string {
		const stream = this.#stream;
		const base = stream.current();
		if (base === null || base.type !== TokenType.Identifier) return String.empty;
		stream.advance();

		const next = stream.current();
		if (next !== null && next.type === TokenType.Operator && next.value === "<") {
			stream.advance();
			const typeArgs: string[] = [];
			let depth = 1;
			while (true) {
				const token = stream.current();
				if (token === null || depth === 0) break;
				if (token.type === TokenType.Operator && token.value === "<") { depth++; stream.advance(); continue; }
				if (token.type === TokenType.Operator && token.value === ">") { depth--; if (depth === 0) break; stream.advance(); continue; }
				if (token.type === TokenType.Identifier) { typeArgs.push(this.readType()); continue; }
				if (token.type === TokenType.Separator && token.value === ",") { stream.advance(); continue; }
				stream.advance();
			}
			const close = stream.current();
			if (close !== null && close.type === TokenType.Operator && close.value === ">") stream.advance();
			return `${base.value}<${typeArgs.join(", ")}>`;
		}

		const nullable = stream.current();
		if (nullable !== null && nullable.type === TokenType.Operator && nullable.value === "?") {
			stream.advance();
			return `Nullable<${base.value}>`;
		}

		return base.value;
	}

	readParams(): ParameterDefinition[] {
		const stream = this.#stream;
		const open = stream.current();
		if (open === null || !(open.type === TokenType.Bracket && open.value === "(")) return [];
		stream.advance();
		const params: ParameterDefinition[] = [];
		while (true) {
			const token = stream.current();
			if (token === null) break;
			if (token.type === TokenType.Bracket && token.value === ")") break;
			if (token.type === TokenType.Separator) { stream.advance(); continue; }
			if (token.type !== TokenType.Identifier) { stream.advance(); continue; }
			const name = token.value;
			stream.advance();
			const typeName = this.readType();
			params.push(new ParameterDefinition(name, typeName));
		}
		const close = stream.current();
		if (close !== null && close.type === TokenType.Bracket && close.value === ")") stream.advance();
		return params;
	}
}
//#endregion
