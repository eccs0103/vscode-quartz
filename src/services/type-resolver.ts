"use strict";

import "adaptive-extender/core";
import { FieldDefinition, FunctionDefinition, ParameterDefinition } from "../models/symbol-definitions.js";
import { GenericType, MemberSet } from "../models/type-members.js";
import { SymbolTable } from "./symbol-table.js";
import { ResolutionContext } from "./resolution-context.js";

//#region Backward scanner
class BackwardScanner {
	static #identifier: RegExp = /[A-Za-z_0-9]/;
	static #operator: RegExp = /[^ \t\n\r()\[\]"'A-Za-z_0-9]/;

	#text: string;
	#cursor: number;

	constructor(text: string, cursor: number) {
		this.#text = text;
		this.#cursor = cursor;
	}

	get cursor(): number { return this.#cursor; }
	get char(): string { return this.#text[this.#cursor]; }
	get isValid(): boolean { return this.#cursor >= 0; }

	isIdentifierChar(): boolean {
		const cursor = this.#cursor;
		return cursor >= 0 && BackwardScanner.#identifier.test(this.#text[cursor]);
	}

	isAt(char: string): boolean {
		const cursor = this.#cursor;
		return cursor >= 0 && this.#text[cursor] === char;
	}

	matches(pattern: RegExp): boolean {
		const cursor = this.#cursor;
		return cursor >= 0 && pattern.test(this.#text[cursor]);
	}

	skipWhitespace(): void {
		const text = this.#text;
		let cursor = this.#cursor;
		while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
		this.#cursor = cursor;
	}

	skipIdentifier(): void {
		const text = this.#text;
		const identifier = BackwardScanner.#identifier;
		let cursor = this.#cursor;
		while (cursor >= 0 && identifier.test(text[cursor])) cursor--;
		this.#cursor = cursor;
	}

	skipPaired(close: string, open: string): void {
		const text = this.#text;
		let depth = 1;
		let cursor = this.#cursor - 1;
		while (cursor >= 0 && depth > 0) {
			if (text[cursor] === close) depth++;
			else if (text[cursor] === open) depth--;
			cursor--;
		}
		this.#cursor = cursor;
	}

	skipValue(): void {
		if (!this.isValid) return;
		const text = this.#text;
		const start = this.#cursor;
		const char = text[start];
		if (char === ")") { this.skipPaired(")", "("); this.skipIdentifier(); return; }
		if (char === "]") { this.skipPaired("]", "["); this.skipIdentifier(); return; }
		if (char === '"') {
			let cursor = start - 1;
			while (cursor >= 0 && !(text[cursor] === '"' && (cursor === 0 || text[cursor - 1] !== "\\"))) cursor--;
			this.#cursor = cursor - 1;
			return;
		}
		if (char === "'") {
			let cursor = start - 1;
			while (cursor >= 0 && text[cursor] !== "'") cursor--;
			this.#cursor = cursor - 1;
			return;
		}
		this.skipIdentifier();
	}

	readIdentifier(): string {
		const end = this.#cursor;
		this.skipIdentifier();
		return this.#text.slice(this.#cursor + 1, end + 1);
	}

	readOperator(): string {
		const text = this.#text;
		const operator = BackwardScanner.#operator;
		let cursor = this.#cursor;
		const end = cursor + 1;
		while (cursor >= 0 && operator.test(text[cursor])) cursor--;
		this.#cursor = cursor;
		return text.slice(cursor + 1, end);
	}

	static isIdentifier(char: string): boolean {
		return BackwardScanner.#identifier.test(char);
	}
}
//#endregion

//#region Type step
class StepState {
	#name: string;
	#substitution: Map<string, string>;

	constructor(name: string, substitution: Map<string, string>) {
		this.#name = name;
		this.#substitution = substitution;
	}

	get name(): string { return this.#name; }

	applyTo(typeName: string): string {
		return TypeResolver.mapWith(typeName, this.#substitution);
	}
}
//#endregion

//#region Type resolver
export class TypeResolver {
	static #word: RegExp = /\b[A-Za-z_]\w*\b/g;

	#cache: Map<string, MemberSet> = new Map();

	static toGeneric(typeName: string): GenericType {
		const index = typeName.indexOf("<");
		if (index === -1) return new GenericType(typeName, []);
		const base = typeName.slice(0, index);
		const inner = typeName.slice(index + 1, typeName.lastIndexOf(">"));
		const typeArgs: string[] = [];
		let depth = 0;
		let start = 0;
		for (let offset = 0; offset < inner.length; offset++) {
			if (inner[offset] === "<") { depth++; continue; }
			if (inner[offset] === ">") { depth--; continue; }
			if (inner[offset] === "," && depth === 0) { typeArgs.push(inner.slice(start, offset).trim()); start = offset + 1; }
		}
		if (!String.isEmpty(inner)) typeArgs.push(inner.slice(start).trim());
		return new GenericType(base, typeArgs.filter(typeArg => !String.isEmpty(typeArg)));
	}

	static toSubstitution(typeParams: string[], typeArgs: string[]): Map<string, string> {
		const map = new Map<string, string>();
		for (let index = 0; index < typeParams.length && index < typeArgs.length; index++) map.set(typeParams[index], typeArgs[index]);
		return map;
	}

	static mapWith(typeName: string, substitution: Map<string, string>): string {
		if (substitution.size === 0) return typeName;
		const pattern = TypeResolver.#word;
		pattern.lastIndex = 0;
		return typeName.replace(pattern, word => substitution.get(word) ?? word);
	}

	getAllMembers(baseTypeName: string, runtime: SymbolTable): MemberSet {
		const cache = this.#cache;
		const cached = cache.get(baseTypeName);
		if (cached !== undefined) return cached;

		const methods: FunctionDefinition[] = [];
		const fields: FieldDefinition[] = [];
		const seenMethod = new Set<string>();
		const seenField = new Set<string>();
		const visited = new Set<string>();

		let step = new StepState(baseTypeName, new Map<string, string>());
		while (!visited.has(step.name)) {
			visited.add(step.name);
			const typeDefinition = runtime.getType(step.name);
			if (typeDefinition === null) break;

			for (const method of typeDefinition.methods) {
				const { name, parameters, result } = method;
				const key = `${name}/${parameters.map(parameter => parameter.typeName).join(",")}`;
				if (seenMethod.has(key)) continue;
				seenMethod.add(key);
				methods.push(new FunctionDefinition(name, parameters.map(parameter => new ParameterDefinition(parameter.name, step.applyTo(parameter.typeName))), step.applyTo(result), step.name, null));
			}

			for (const field of typeDefinition.fields) {
				const { name, typeName } = field;
				if (seenField.has(name)) continue;
				seenField.add(name);
				fields.push(new FieldDefinition(name, step.applyTo(typeName)));
			}

			const { parent } = typeDefinition;
			if (parent === null) break;
			const { base, typeArgs } = TypeResolver.toGeneric(parent);
			const baseType = runtime.getType(base);
			if (baseType === null) break;
			step = new StepState(base, TypeResolver.toSubstitution(baseType.typeParams, typeArgs.map(word => step.applyTo(word))));
		}

		const result = new MemberSet(methods, fields);
		cache.set(baseTypeName, result);
		return result;
	}

	typeAt(end: number, context: ResolutionContext): string | null {
		const scanner = new BackwardScanner(context.text, end - 1);
		scanner.skipWhitespace();
		if (!scanner.isValid) return null;

		if (scanner.isAt(")")) {
			const endParen = scanner.cursor;
			scanner.skipPaired(")", "(");
			scanner.skipWhitespace();
			if (!scanner.isValid || !scanner.isIdentifierChar()) {
				if (scanner.isAt(">")) return this.#typeFromGeneric(context.text, scanner.cursor);
				return this.#typeOfGroup(endParen, context);
			}
			const name = scanner.readIdentifier();
			return this.#typeForName(scanner.cursor, name, true, context);
		}

		if (scanner.isAt("]")) {
			scanner.skipPaired("]", "[");
			const indexee = this.typeAt(scanner.cursor + 1, context);
			if (indexee === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(indexee);
			const typeDefinition = context.findType(base);
			if (typeDefinition === null) return null;
			const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
			const { methods } = this.getAllMembers(base, context.runtime);
			const indexer = methods.find(entry => entry.name === "[]" && entry.parameters.length === 1);
			if (indexer === undefined) return null;
			return TypeResolver.mapWith(indexer.result, substitution);
		}

		if (scanner.isIdentifierChar()) {
			const name = scanner.readIdentifier();
			return this.#typeForName(scanner.cursor, name, false, context);
		}

		if (scanner.isAt(">")) return this.#typeFromGeneric(context.text, scanner.cursor);
		if (scanner.isAt('"')) return "String";
		if (scanner.isAt("'")) return "Character";
		return null;
	}

	#typeForName(cursor: number, name: string, isCall: boolean, context: ResolutionContext): string | null {
		const scanner = new BackwardScanner(context.text, cursor);
		scanner.skipWhitespace();
		if (scanner.isAt(".")) {
			const receiver = this.typeAt(scanner.cursor, context);
			if (receiver === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(receiver);
			const typeDefinition = context.findType(base);
			if (typeDefinition === null) return null;
			const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
			const members = this.getAllMembers(base, context.runtime);
			if (isCall) {
				const method = members.findMethod(name);
				if (method === null) return null;
				return TypeResolver.mapWith(method.result, substitution);
			}
			const field = members.findField(name);
			if (field === null) return null;
			return TypeResolver.mapWith(field.typeName, substitution);
		}
		if (isCall) {
			const overloads = context.findFunctions(name);
			if (overloads !== null && overloads.length > 0) return overloads[0].result;
		}
		return this.#typeOf(name, context);
	}

	#typeOfGroup(closeParen: number, context: ResolutionContext): string | null {
		const scanner = new BackwardScanner(context.text, closeParen - 1);
		scanner.skipWhitespace();
		if (!scanner.isValid) return null;

		scanner.skipValue();
		scanner.skipWhitespace();
		if (!scanner.isValid) return this.typeAt(closeParen, context);

		if (scanner.isIdentifierChar() || /[()\[\]"']/.test(scanner.char)) return this.typeAt(closeParen, context);

		const operator = scanner.readOperator();
		if (operator === "." || operator === ":" || operator === ";" || operator.length === 0) return this.typeAt(closeParen, context);

		const start = scanner.cursor + 1;
		const leftType = this.typeAt(start, context);
		if (leftType === null) return this.typeAt(closeParen, context);

		const { base, typeArgs } = TypeResolver.toGeneric(leftType);
		const typeDefinition = context.findType(base);
		if (typeDefinition === null) return this.typeAt(closeParen, context);
		const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods } = this.getAllMembers(base, context.runtime);
		const binaryMethods = methods.filter(method => method.name === `[${operator}]` && method.parameters.length > 0);
		if (binaryMethods.length === 0) return this.typeAt(closeParen, context);

		const rightType = this.typeAt(closeParen, context);
		let matched = binaryMethods[0];
		if (rightType !== null) matched = binaryMethods.find(method => TypeResolver.mapWith(method.parameters[0].typeName, substitution) === rightType) ?? matched;
		return TypeResolver.mapWith(matched.result, substitution);
	}

	#typeFromGeneric(text: string, start: number): string | null {
		let cursor = start;
		const typeEnd = cursor;
		let depth = 1;
		cursor--;
		while (cursor >= 0 && depth > 0) {
			if (text[cursor] === ">") depth++;
			else if (text[cursor] === "<") depth--;
			cursor--;
		}
		while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
		if (cursor < 0 || !BackwardScanner.isIdentifier(text[cursor])) return null;
		while (cursor >= 0 && BackwardScanner.isIdentifier(text[cursor])) cursor--;
		return text.slice(cursor + 1, typeEnd + 1).replace(/\s+/g, "");
	}

	#typeOf(name: string, context: ResolutionContext): string | null {
		if (name === "true" || name === "false") return "Boolean";
		if (name === "null") return "Null";
		if (name.length > 0 && name[0] >= "0" && name[0] <= "9") return "Number";
		const variable = context.findVariable(name);
		if (variable !== null) return variable.typeName;
		const overloads = context.findFunctions(name);
		if (overloads !== null && overloads.length > 0) return "Function";
		const typeDefinition = context.findType(name);
		if (typeDefinition !== null && !typeDefinition.isTemplate) return name;
		return null;
	}
}
//#endregion
