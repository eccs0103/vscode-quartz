"use strict";

import * as fileSystem from "fs";
import * as path from "path";
import { WorkspaceFolder } from "vscode-languageserver/node";
import { HeaderParser } from "./header-parser.js";
import { DocumentParser } from "./doc-parser.js";
import { TypeDefinition, FieldDefinition, FunctionDefinition, GenericType, MemberSet, MethodDefinition, ParameterDefinition, VariableDefinition } from "../models/symbol-defs.js";
import { SymbolTable } from "./symbol-table.js";

//#region Type step
class TypeStep {
	name: string;
	substitution: Map<string, string>;

	constructor(name: string, substitution: Map<string, string>) {
		this.name = name;
		this.substitution = substitution;
	}
}
//#endregion

//#region Symbol service
export class SymbolService {
	#runtimeTable: SymbolTable = new SymbolTable();

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
			if (inner[offset] === "," && depth === 0) {
				typeArgs.push(inner.slice(start, offset).trim());
				start = offset + 1;
			}
		}
		if (inner.length > 0) typeArgs.push(inner.slice(start).trim());
		return new GenericType(base, typeArgs.filter(Boolean));
	}

	static toSubstitution(typeParams: string[], typeArgs: string[]): Map<string, string> {
		const map = new Map<string, string>();
		for (let index = 0; index < typeParams.length && index < typeArgs.length; index++) map.set(typeParams[index], typeArgs[index]);
		return map;
	}

	static mapWith(typeName: string, substitution: Map<string, string>): string {
		if (substitution.size === 0) return typeName;
		return typeName.replace(/\b[A-Za-z_]\w*\b/g, word => substitution.get(word) ?? word);
	}

	initialize(workspaceFolders: WorkspaceFolder[]): void {
		const runtimeTable = this.#runtimeTable;
		for (const folder of workspaceFolders) {
			const folderPath = this.#pathFrom(folder.uri);
			if (folderPath === null) continue;

			const headerPath = path.join(folderPath, "runtime.header.qrz");
			if (!fileSystem.existsSync(headerPath)) continue;

			const code = fileSystem.readFileSync(headerPath, "utf8");
			const headerTable = new HeaderParser().parse(code);
			runtimeTable.merge(headerTable);
		}

		this.#addWorkspaceGlobals();
	}

	parse(code: string): SymbolTable {
		return new DocumentParser().parse(code);
	}

	#typeOf(name: string, line: number, docTable: SymbolTable): string | null {
		const runtimeTable = this.#runtimeTable;
		const variable = [...runtimeTable.getVariablesAt(line), ...docTable.getVariablesAt(line)].find(entry => entry.name === name);
		if (variable !== undefined) return variable.typeName;

		const overloads = runtimeTable.functions.get(name) ?? docTable.functions.get(name);
		if (overloads !== undefined && overloads.length > 0) return overloads[0].retType;

		if (runtimeTable.classes.has(name)) return name;

		return null;
	}

	getAllMembers(baseTypeName: string): MemberSet {
		const runtimeTable = this.#runtimeTable;
		const methods: MethodDefinition[] = [];
		const fields: FieldDefinition[] = [];
		const seenMethod = new Set<string>();
		const seenField = new Set<string>();
		const visited = new Set<string>();
		let step: TypeStep | undefined = new TypeStep(baseTypeName, new Map());

		while (step !== undefined && !visited.has(step.name)) {
			visited.add(step.name);
			const typeDefinition = runtimeTable.classes.get(step.name);
			if (typeDefinition === undefined) break;
			const { substitution } = step;

			for (const method of typeDefinition.methods) {
				const { name, params, retType } = method;
				const key = `${name}/${params.length}`;
				if (seenMethod.has(key)) continue;
				seenMethod.add(key);
				methods.push(substitution.size === 0 ? method : new MethodDefinition(name, params.map(parameter => new ParameterDefinition(parameter.name, SymbolService.mapWith(parameter.typeName, substitution))), SymbolService.mapWith(retType, substitution)));
			}

			for (const field of typeDefinition.fields) {
				const { name, typeName } = field;
				if (seenField.has(name)) continue;
				seenField.add(name);
				fields.push(substitution.size === 0 ? field : new FieldDefinition(name, SymbolService.mapWith(typeName, substitution)));
			}

			if (typeDefinition.parent === undefined) break;
			const { base, typeArgs } = SymbolService.toGeneric(typeDefinition.parent);
			const baseType = runtimeTable.classes.get(base);
			if (baseType === undefined) break;
			const newSubstitution = SymbolService.toSubstitution(baseType.typeParams, typeArgs.map(word => SymbolService.mapWith(word, substitution)));
			step = new TypeStep(base, newSubstitution);
		}

		return new MemberSet(methods, fields);
	}

	typeAt(text: string, end: number, line: number, docTable: SymbolTable): string | null {
		const runtimeTable = this.#runtimeTable;
		let cursor = end - 1;
		while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
		if (cursor < 0) return null;

		if (text[cursor] === ")") {
			let depth = 1;
			cursor--;
			while (cursor >= 0 && depth > 0) {
				if (text[cursor] === ")") depth++;
				else if (text[cursor] === "(") depth--;
				cursor--;
			}
			while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
			if (cursor < 0 || !/[A-Za-z_0-9]/.test(text[cursor])) return null;
			const nameEnd = cursor;
			while (cursor >= 0 && /[A-Za-z_0-9]/.test(text[cursor])) cursor--;
			const name = text.slice(cursor + 1, nameEnd + 1);
			while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
			if (cursor >= 0 && text[cursor] === ".") {
				const receiverType = this.typeAt(text, cursor, line, docTable);
				if (receiverType === null) return null;
				const { base, typeArgs } = SymbolService.toGeneric(receiverType);
				const typeDefinition = runtimeTable.classes.get(base);
				if (typeDefinition === undefined) return null;
				const substitution = SymbolService.toSubstitution(typeDefinition.typeParams, typeArgs);
				const { methods } = this.getAllMembers(base);
				const method = methods.find(entry => entry.name === name && !entry.name.startsWith("["));
				if (method === undefined) return null;
				return SymbolService.mapWith(method.retType, substitution);
			}
			return this.#typeOf(name, line, docTable);
		}

		if (text[cursor] === "]") {
			let depth = 1;
			cursor--;
			while (cursor >= 0 && depth > 0) {
				if (text[cursor] === "]") depth++;
				else if (text[cursor] === "[") depth--;
				cursor--;
			}
			const indexeeType = this.typeAt(text, cursor + 1, line, docTable);
			if (indexeeType === null) return null;
			const { base, typeArgs } = SymbolService.toGeneric(indexeeType);
			const typeDefinition = runtimeTable.classes.get(base);
			if (typeDefinition === undefined) return null;
			const substitution = SymbolService.toSubstitution(typeDefinition.typeParams, typeArgs);
			const { methods } = this.getAllMembers(base);
			const indexOp = methods.find(entry => entry.name === "[]" && entry.params.length === 1);
			if (indexOp === undefined) return null;
			return SymbolService.mapWith(indexOp.retType, substitution);
		}

		if (/[A-Za-z_0-9]/.test(text[cursor])) {
			const nameEnd = cursor;
			while (cursor >= 0 && /[A-Za-z_0-9]/.test(text[cursor])) cursor--;
			const name = text.slice(cursor + 1, nameEnd + 1);
			while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
			if (cursor >= 0 && text[cursor] === ".") {
				const receiverType = this.typeAt(text, cursor, line, docTable);
				if (receiverType === null) return null;
				const { base, typeArgs } = SymbolService.toGeneric(receiverType);
				const typeDefinition = runtimeTable.classes.get(base);
				if (typeDefinition === undefined) return null;
				const substitution = SymbolService.toSubstitution(typeDefinition.typeParams, typeArgs);
				const { fields } = this.getAllMembers(base);
				const field = fields.find(entry => entry.name === name);
				if (field === undefined) return null;
				return SymbolService.mapWith(field.typeName, substitution);
			}
			return this.#typeOf(name, line, docTable);
		}

		return null;
	}

	#addWorkspaceGlobals(): void {
		const runtimeTable = this.#runtimeTable;
		const workspace = runtimeTable.classes.get("workspace");
		if (workspace === undefined) return;

		for (const { name, params, retType } of workspace.methods) runtimeTable.addFunction(new FunctionDefinition(name, params, retType, 0, Number.MAX_SAFE_INTEGER));
		for (const { name, typeName } of workspace.fields) if (!runtimeTable.variables.some(variable => variable.name === name)) runtimeTable.addVariable(new VariableDefinition(name, typeName, 0, Number.MAX_SAFE_INTEGER));
	}

	#pathFrom(uri: string): string | null {
		if (!uri.startsWith("file://")) return null;
		try {
			let filePath = decodeURIComponent(new URL(uri).pathname);
			if (process.platform === "win32" && filePath.startsWith("/")) filePath = filePath.slice(1);
			return filePath;
		} catch {
			return null;
		}
	}

	runtimeTable(): SymbolTable {
		return this.#runtimeTable;
	}

	getType(name: string): TypeDefinition | undefined {
		return this.#runtimeTable.classes.get(name);
	}
}
//#endregion
