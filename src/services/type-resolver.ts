"use strict";

import "adaptive-extender/node";
import { FieldDefinition, GenericType, MemberSet, MethodDefinition, ParameterDefinition } from "../models/symbol-definitions.js";
import { SymbolTable } from "./symbol-table.js";

//#region Type step
class StepState {
	name: string;
	substitution: Map<string, string>;

	constructor(name: string, substitution: Map<string, string>) {
		this.name = name;
		this.substitution = substitution;
	}
}
//#endregion

//#region Type resolver
export class TypeResolver {
	static #patternTypeWord: RegExp = /\b[A-Za-z_]\w*\b/g;
	static #patternIdentifierChar: RegExp = /[A-Za-z_0-9]/;

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

	static #isIdentifierChar(value: string): boolean {
		return TypeResolver.#patternIdentifierChar.test(value);
	}

	getAllMembers(baseTypeName: string, runtimeTable: SymbolTable): MemberSet {
		const cached = this.#memberCache.get(baseTypeName);
		if (cached !== undefined) return cached;

		const methods: MethodDefinition[] = [];
		const fields: FieldDefinition[] = [];
		const seenMethod = new Set<string>();
		const seenField = new Set<string>();
		const visited = new Set<string>();

		let step = new StepState(baseTypeName, new Map<string, string>());
		while (!visited.has(step.name)) {
			visited.add(step.name);
			const typeDefinition = runtimeTable.getType(step.name);
			if (typeDefinition === undefined) break;
			const substitution: Map<string, string> = step.substitution;

			for (const method of typeDefinition.methods) {
				const { name, params, retType } = method;
				const key = `${name}/${params.map(p => p.typeName).join(",")}`;
				if (seenMethod.has(key)) continue;
				seenMethod.add(key);
				const mappedParams = substitution.size === 0 ? params : params.map(parameter => new ParameterDefinition(parameter.name, TypeResolver.mapWith(parameter.typeName, substitution)));
				const mappedRet = substitution.size === 0 ? retType : TypeResolver.mapWith(retType, substitution);
				methods.push(new MethodDefinition(name, mappedParams, mappedRet, step.name));
			}

			for (const field of typeDefinition.fields) {
				const { name, typeName } = field;
				if (seenField.has(name)) continue;
				seenField.add(name);
				fields.push(substitution.size === 0 ? field : new FieldDefinition(name, TypeResolver.mapWith(typeName, substitution)));
			}

			if (typeDefinition.parent === undefined) break;
			const { base, typeArgs } = TypeResolver.toGeneric(typeDefinition.parent);
			const baseType = runtimeTable.getType(base);
			if (baseType === undefined) break;
			step = new StepState(base, TypeResolver.toSubstitution(baseType.typeParams, typeArgs.map(word => TypeResolver.mapWith(word, substitution))));
		}

		const result = new MemberSet(methods, fields);
		this.#memberCache.set(baseTypeName, result);
		return result;
	}

	typeAt(text: string, end: number, line: number, runtimeTable: SymbolTable, docTable: SymbolTable): string | null {
		let cursor = end - 1;
		while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
		if (cursor < 0) return null;

		if (text[cursor] === ")") {
			const endParen = cursor;
			let depth = 1;
			cursor--;
			while (cursor >= 0 && depth > 0) {
				if (text[cursor] === ")") depth++;
				else if (text[cursor] === "(") depth--;
				cursor--;
			}
			while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
			if (cursor < 0 || !TypeResolver.#isIdentifierChar(text[cursor])) {
				if (cursor >= 0 && text[cursor] === ">") return this.#typeFromGeneric(text, cursor);
				return this.#typeOfGroup(text, endParen, line, runtimeTable, docTable);
			}
			const nameEnd = cursor;
			while (cursor >= 0 && TypeResolver.#isIdentifierChar(text[cursor])) cursor--;
			const name = text.slice(cursor + 1, nameEnd + 1);
			return this.#typeForName(text, cursor, name, true, line, runtimeTable, docTable);
		}

		if (text[cursor] === "]") {
			let depth = 1;
			cursor--;
			while (cursor >= 0 && depth > 0) {
				if (text[cursor] === "]") depth++;
				else if (text[cursor] === "[") depth--;
				cursor--;
			}
			const indexeeType = this.typeAt(text, cursor + 1, line, runtimeTable, docTable);
			if (indexeeType === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(indexeeType);
			const typeDefinition = runtimeTable.getType(base);
			if (typeDefinition === undefined) return null;
			const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
			const { methods } = this.getAllMembers(base, runtimeTable);
			const indexOp = methods.find(entry => entry.name === "[]" && entry.params.length === 1);
			if (indexOp === undefined) return null;
			return TypeResolver.mapWith(indexOp.retType, substitution);
		}

		if (TypeResolver.#isIdentifierChar(text[cursor])) {
			const nameEnd = cursor;
			while (cursor >= 0 && TypeResolver.#isIdentifierChar(text[cursor])) cursor--;
			const name = text.slice(cursor + 1, nameEnd + 1);
			return this.#typeForName(text, cursor, name, false, line, runtimeTable, docTable);
		}

		if (text[cursor] === ">") return this.#typeFromGeneric(text, cursor);
		if (text[cursor] === '"') return "String";
		if (text[cursor] === "'") return "Character";
		return null;
	}

	#typeForName(text: string, cursor: number, name: string, isCall: boolean, line: number, runtimeTable: SymbolTable, docTable: SymbolTable): string | null {
		while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
		if (cursor >= 0 && text[cursor] === ".") {
			const receiverType = this.typeAt(text, cursor, line, runtimeTable, docTable);
			if (receiverType === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(receiverType);
			const typeDefinition = runtimeTable.getType(base);
			if (typeDefinition === undefined) return null;
			const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
			const members = this.getAllMembers(base, runtimeTable);
			if (isCall) {
				const method = members.methods.find(entry => entry.name === name && !entry.name.startsWith("["));
				if (method === undefined) return null;
				return TypeResolver.mapWith(method.retType, substitution);
			}
			const field = members.fields.find(entry => entry.name === name);
			if (field === undefined) return null;
			return TypeResolver.mapWith(field.typeName, substitution);
		}
		if (isCall) {
			const fnOverloads = runtimeTable.getFunctions(name) ?? docTable.getFunctions(name);
			if (fnOverloads !== undefined && fnOverloads.length > 0) return fnOverloads[0].retType;
		}
		return this.#typeOf(name, line, runtimeTable, docTable);
	}

	#typeOfGroup(text: string, closeParen: number, line: number, runtimeTable: SymbolTable, docTable: SymbolTable): string | null {
		let cursor = closeParen - 1;
		while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
		if (cursor < 0) return null;

		cursor = this.#skipValueBackward(text, cursor);
		while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
		if (cursor < 0) return this.typeAt(text, closeParen, line, runtimeTable, docTable);

		if (TypeResolver.#isIdentifierChar(text[cursor]) || /[()\[\]"']/.test(text[cursor])) return this.typeAt(text, closeParen, line, runtimeTable, docTable);

		const opEnd = cursor + 1;
		while (cursor >= 0 && !TypeResolver.#isIdentifierChar(text[cursor]) && !/[()\[\]"' \t\n\r]/.test(text[cursor])) cursor--;
		const opStart = cursor + 1;
		const operator = text.slice(opStart, opEnd);

		if (operator === "." || operator === ":" || operator === ";" || operator.length === 0) return this.typeAt(text, closeParen, line, runtimeTable, docTable);

		const leftType = this.typeAt(text, opStart, line, runtimeTable, docTable);
		if (leftType === null) return this.typeAt(text, closeParen, line, runtimeTable, docTable);

		const { base, typeArgs } = TypeResolver.toGeneric(leftType);
		const typeDef = runtimeTable.getType(base);
		if (typeDef === undefined) return this.typeAt(text, closeParen, line, runtimeTable, docTable);
		const substitution = TypeResolver.toSubstitution(typeDef.typeParams, typeArgs);
		const { methods } = this.getAllMembers(base, runtimeTable);
		const binaryMethods = methods.filter(m => m.name === `[${operator}]` && m.params.length > 0);
		if (binaryMethods.length === 0) return this.typeAt(text, closeParen, line, runtimeTable, docTable);

		const rightType = this.typeAt(text, closeParen, line, runtimeTable, docTable);
		const matched = (rightType !== null
			? binaryMethods.find(m => TypeResolver.mapWith(m.params[0].typeName, substitution) === rightType)
			: undefined) ?? binaryMethods[0];
		return TypeResolver.mapWith(matched.retType, substitution);
	}

	#skipValueBackward(text: string, cursor: number): number {
		if (cursor < 0) return cursor;
		const ch = text[cursor];

		if (ch === ")") {
			let depth = 1;
			cursor--;
			while (cursor >= 0 && depth > 0) {
				if (text[cursor] === ")") depth++;
				else if (text[cursor] === "(") depth--;
				cursor--;
			}
			while (cursor >= 0 && TypeResolver.#isIdentifierChar(text[cursor])) cursor--;
			return cursor;
		}

		if (ch === "]") {
			let depth = 1;
			cursor--;
			while (cursor >= 0 && depth > 0) {
				if (text[cursor] === "]") depth++;
				else if (text[cursor] === "[") depth--;
				cursor--;
			}
			while (cursor >= 0 && TypeResolver.#isIdentifierChar(text[cursor])) cursor--;
			return cursor;
		}

		if (ch === '"') {
			cursor--;
			while (cursor >= 0 && !(text[cursor] === '"' && (cursor === 0 || text[cursor - 1] !== "\\"))) cursor--;
			cursor--;
			return cursor;
		}

		if (ch === "'") {
			cursor--;
			while (cursor >= 0 && text[cursor] !== "'") cursor--;
			cursor--;
			return cursor;
		}

		while (cursor >= 0 && TypeResolver.#isIdentifierChar(text[cursor])) cursor--;
		return cursor;
	}

	#typeFromGeneric(text: string, cursor: number): string | null {
		const typeEnd = cursor;
		let depth = 1;
		cursor--;
		while (cursor >= 0 && depth > 0) {
			if (text[cursor] === ">") depth++;
			else if (text[cursor] === "<") depth--;
			cursor--;
		}
		while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
		if (cursor < 0 || !TypeResolver.#isIdentifierChar(text[cursor])) return null;
		const nameEnd = cursor;
		while (cursor >= 0 && TypeResolver.#isIdentifierChar(text[cursor])) cursor--;
		return text.slice(cursor + 1, typeEnd + 1).replace(/\s+/g, "");
	}

	#typeOf(name: string, line: number, runtimeTable: SymbolTable, docTable: SymbolTable): string | null {
		if (name === "true" || name === "false") return "Boolean";
		if (name === "null") return "Null";
		if (name.length > 0 && name[0] >= "0" && name[0] <= "9") return "Number";
		const variable = runtimeTable.findVariableAt(name, line) ?? docTable.findVariableAt(name, line);
		if (variable !== undefined) return variable.typeName;
		const overloads = runtimeTable.getFunctions(name) ?? docTable.getFunctions(name);
		if (overloads !== undefined && overloads.length > 0) return "Function";
		const typeDefinition = runtimeTable.getType(name);
		if (typeDefinition !== undefined && !typeDefinition.isTemplate) return name;
		return null;
	}
}
//#endregion
