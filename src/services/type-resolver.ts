"use strict";

import "adaptive-extender/node";
import { FieldDefinition, FunctionDefinition, ParameterDefinition } from "../models/symbol-definitions.js";
import { GenericType, MemberSet } from "../models/type-members.js";
import { SymbolTable } from "./symbol-table.js";
import { ResolutionContext } from "./resolution-context.js";

//#region Backward scanner
class BackwardScanner {
	static #patternIdentifierChar: RegExp = /[A-Za-z_0-9]/;
	static #patternOperatorChar: RegExp = /[^ \t\n\r()\[\]"'A-Za-z_0-9]/;

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
		return this.#cursor >= 0 && BackwardScanner.#patternIdentifierChar.test(this.#text[this.#cursor]);
	}

	isAt(char: string): boolean {
		return this.#cursor >= 0 && this.#text[this.#cursor] === char;
	}

	matches(pattern: RegExp): boolean {
		return this.#cursor >= 0 && pattern.test(this.#text[this.#cursor]);
	}

	skipWhitespace(): void {
		while (this.#cursor >= 0 && (this.#text[this.#cursor] === " " || this.#text[this.#cursor] === "\t")) this.#cursor--;
	}

	skipIdentifier(): void {
		while (this.#cursor >= 0 && BackwardScanner.#patternIdentifierChar.test(this.#text[this.#cursor])) this.#cursor--;
	}

	skipPaired(close: string, open: string): void {
		let depth = 1;
		this.#cursor--;
		while (this.#cursor >= 0 && depth > 0) {
			if (this.#text[this.#cursor] === close) depth++;
			else if (this.#text[this.#cursor] === open) depth--;
			this.#cursor--;
		}
	}

	skipValue(): void {
		if (!this.isValid) return;
		const ch = this.#text[this.#cursor];
		if (ch === ")") { this.skipPaired(")", "("); this.skipIdentifier(); return; }
		if (ch === "]") { this.skipPaired("]", "["); this.skipIdentifier(); return; }
		if (ch === '"') {
			this.#cursor--;
			while (this.#cursor >= 0 && !(this.#text[this.#cursor] === '"' && (this.#cursor === 0 || this.#text[this.#cursor - 1] !== "\\"))) this.#cursor--;
			this.#cursor--;
			return;
		}
		if (ch === "'") {
			this.#cursor--;
			while (this.#cursor >= 0 && this.#text[this.#cursor] !== "'") this.#cursor--;
			this.#cursor--;
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
		const exclusiveEnd = this.#cursor + 1;
		while (this.#cursor >= 0 && BackwardScanner.#patternOperatorChar.test(this.#text[this.#cursor])) this.#cursor--;
		return this.#text.slice(this.#cursor + 1, exclusiveEnd);
	}

	static isIdentChar(ch: string): boolean {
		return BackwardScanner.#patternIdentifierChar.test(ch);
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
	static #patternTypeWord: RegExp = /\b[A-Za-z_]\w*\b/g;

	#memberCache: Map<string, MemberSet> = new Map();

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
		const pattern = TypeResolver.#patternTypeWord;
		pattern.lastIndex = 0;
		return typeName.replace(pattern, word => substitution.get(word) ?? word);
	}

	getAllMembers(baseTypeName: string, runtimeTable: SymbolTable): MemberSet {
		const cached = this.#memberCache.get(baseTypeName);
		if (cached !== undefined) return cached;

		const methods: FunctionDefinition[] = [];
		const fields: FieldDefinition[] = [];
		const seenMethod = new Set<string>();
		const seenField = new Set<string>();
		const visited = new Set<string>();

		let step = new StepState(baseTypeName, new Map<string, string>());
		while (!visited.has(step.name)) {
			visited.add(step.name);
			const typeDefinition = runtimeTable.getType(step.name);
			if (typeDefinition === undefined) break;

			for (const method of typeDefinition.methods) {
				const { name, parameters, returnType } = method;
				const key = `${name}/${parameters.map(p => p.typeName).join(",")}`;
				if (seenMethod.has(key)) continue;
				seenMethod.add(key);
				methods.push(new FunctionDefinition(name, parameters.map(parameter => new ParameterDefinition(parameter.name, step.applyTo(parameter.typeName))), step.applyTo(returnType), step.name));
			}

			for (const field of typeDefinition.fields) {
				const { name, typeName } = field;
				if (seenField.has(name)) continue;
				seenField.add(name);
				fields.push(new FieldDefinition(name, step.applyTo(typeName)));
			}

			if (typeDefinition.parent === undefined) break;
			const { base, typeArgs } = TypeResolver.toGeneric(typeDefinition.parent);
			const baseType = runtimeTable.getType(base);
			if (baseType === undefined) break;
			step = new StepState(base, TypeResolver.toSubstitution(baseType.typeParams, typeArgs.map(word => step.applyTo(word))));
		}

		const result = new MemberSet(methods, fields);
		this.#memberCache.set(baseTypeName, result);
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
			const indexeeType = this.typeAt(scanner.cursor + 1, context);
			if (indexeeType === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(indexeeType);
			const typeDefinition = context.findType(base);
			if (typeDefinition === undefined) return null;
			const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
			const { methods } = this.getAllMembers(base, context.runtimeTable);
			const indexOp = methods.find(entry => entry.name === "[]" && entry.parameters.length === 1);
			if (indexOp === undefined) return null;
			return TypeResolver.mapWith(indexOp.returnType, substitution);
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

	#typeForName(cursorBefore: number, name: string, isCall: boolean, context: ResolutionContext): string | null {
		const scanner = new BackwardScanner(context.text, cursorBefore);
		scanner.skipWhitespace();
		if (scanner.isAt(".")) {
			const receiverType = this.typeAt(scanner.cursor, context);
			if (receiverType === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(receiverType);
			const typeDefinition = context.findType(base);
			if (typeDefinition === undefined) return null;
			const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
			const members = this.getAllMembers(base, context.runtimeTable);
			if (isCall) {
				const method = members.findMethod(name);
				if (method === undefined) return null;
				return TypeResolver.mapWith(method.returnType, substitution);
			}
			const field = members.findField(name);
			if (field === undefined) return null;
			return TypeResolver.mapWith(field.typeName, substitution);
		}
		if (isCall) {
			const overloads = context.findFunctions(name);
			if (overloads !== undefined && overloads.length > 0) return overloads[0].returnType;
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

		const opStart = scanner.cursor + 1;
		const leftType = this.typeAt(opStart, context);
		if (leftType === null) return this.typeAt(closeParen, context);

		const { base, typeArgs } = TypeResolver.toGeneric(leftType);
		const typeDef = context.findType(base);
		if (typeDef === undefined) return this.typeAt(closeParen, context);
		const substitution = TypeResolver.toSubstitution(typeDef.typeParams, typeArgs);
		const { methods } = this.getAllMembers(base, context.runtimeTable);
		const binaryMethods = methods.filter(m => m.name === `[${operator}]` && m.parameters.length > 0);
		if (binaryMethods.length === 0) return this.typeAt(closeParen, context);

		const rightType = this.typeAt(closeParen, context);
		const matched = (rightType !== null
			? binaryMethods.find(m => TypeResolver.mapWith(m.parameters[0].typeName, substitution) === rightType)
			: undefined) ?? binaryMethods[0];
		return TypeResolver.mapWith(matched.returnType, substitution);
	}

	#typeFromGeneric(text: string, startCursor: number): string | null {
		let cursor = startCursor;
		const typeEnd = cursor;
		let depth = 1;
		cursor--;
		while (cursor >= 0 && depth > 0) {
			if (text[cursor] === ">") depth++;
			else if (text[cursor] === "<") depth--;
			cursor--;
		}
		while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
		if (cursor < 0 || !BackwardScanner.isIdentChar(text[cursor])) return null;
		const nameEnd = cursor;
		while (cursor >= 0 && BackwardScanner.isIdentChar(text[cursor])) cursor--;
		return text.slice(cursor + 1, typeEnd + 1).replace(/\s+/g, "");
	}

	#typeOf(name: string, context: ResolutionContext): string | null {
		if (name === "true" || name === "false") return "Boolean";
		if (name === "null") return "Null";
		if (name.length > 0 && name[0] >= "0" && name[0] <= "9") return "Number";
		const variable = context.findVariable(name);
		if (variable !== undefined) return variable.typeName;
		const overloads = context.findFunctions(name);
		if (overloads !== undefined && overloads.length > 0) return "Function";
		const typeDefinition = context.findType(name);
		if (typeDefinition !== undefined && !typeDefinition.isTemplate) return name;
		return null;
	}
}
//#endregion
