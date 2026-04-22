"use strict";

import * as fs from "fs";
import * as path from "path";
import { WorkspaceFolder } from "vscode-languageserver/node";
import { HeaderParser } from "./header-parser.js";
import { DocParser } from "./doc-parser.js";
import { ClassDef, FieldDef, FuncDef, GenericType, MemberSet, MethodDef, ParamDef, SymbolTable, VarDef } from "./symbol-table.js";

//#region TypeStep
class TypeStep {
	name: string;
	substitution: Map<string, string>;

	constructor(name: string, substitution: Map<string, string>) {
		this.name = name;
		this.substitution = substitution;
	}
}
//#endregion

//#region SymbolService
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

	static mapWith(typeName: string, subst: Map<string, string>): string {
		if (subst.size === 0) return typeName;
		return typeName.replace(/\b[A-Za-z_]\w*\b/g, word => subst.get(word) ?? word);
	}

	initialize(workspaceFolders: WorkspaceFolder[]): void {
		for (const folder of workspaceFolders) {
			const folderPath = this.#pathFrom(folder.uri);
			if (!folderPath) continue;

			const headerPath = path.join(folderPath, "runtime.header.qrz");
			if (!fs.existsSync(headerPath)) continue;

			const code = fs.readFileSync(headerPath, "utf8");
			const headerTable = new HeaderParser().parse(code);
			this.#runtimeTable.merge(headerTable);
		}

		this.#addWorkspaceGlobals();
	}

	parse(code: string): SymbolTable {
		return new DocParser().parse(code);
	}

	#typeOf(name: string, line: number, docTable: SymbolTable): string | null {
		const variable = [...this.#runtimeTable.getVarsAt(line), ...docTable.getVarsAt(line)].find(entry => entry.name === name);
		if (variable) return variable.typeName;

		const overloads = this.#runtimeTable.funcs.get(name) ?? docTable.funcs.get(name);
		if (overloads?.length) return overloads[0].retType;

		if (this.#runtimeTable.classes.has(name)) return name;

		return null;
	}

	getAllMembers(baseTypeName: string): MemberSet {
		const methods: MethodDef[] = [];
		const fields: FieldDef[] = [];
		const seenMethod = new Set<string>();
		const seenField = new Set<string>();
		const visited = new Set<string>();
		let step: TypeStep | undefined = new TypeStep(baseTypeName, new Map());

		while (step && !visited.has(step.name)) {
			visited.add(step.name);
			const typeDef = this.#runtimeTable.classes.get(step.name);
			if (!typeDef) break;
			const { substitution } = step;

			for (const method of typeDef.methods) {
				const key = `${method.name}/${method.params.length}`;
				if (seenMethod.has(key)) continue;
				seenMethod.add(key);
				methods.push(substitution.size === 0 ? method : new MethodDef(method.name, method.params.map(parameter => new ParamDef(parameter.name, SymbolService.mapWith(parameter.typeName, substitution))), SymbolService.mapWith(method.retType, substitution)));
			}

			for (const field of typeDef.fields) {
				if (seenField.has(field.name)) continue;
				seenField.add(field.name);
				fields.push(substitution.size === 0 ? field : new FieldDef(field.name, SymbolService.mapWith(field.typeName, substitution)));
			}

			if (!typeDef.parent) break;
			const { base, typeArgs } = SymbolService.toGeneric(typeDef.parent);
			const baseType = this.#runtimeTable.classes.get(base);
			if (!baseType) break;
			const newSubstitution = SymbolService.toSubstitution(baseType.typeParams, typeArgs.map(word => SymbolService.mapWith(word, substitution)));
			step = new TypeStep(base, newSubstitution);
		}

		return new MemberSet(methods, fields);
	}

	exprType(text: string, end: number, line: number, docTable: SymbolTable): string | null {
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
				const receiverType = this.exprType(text, cursor, line, docTable);
				if (!receiverType) return null;
				const { base, typeArgs } = SymbolService.toGeneric(receiverType);
				const typeDef = this.#runtimeTable.classes.get(base);
				if (!typeDef) return null;
				const substitution = SymbolService.toSubstitution(typeDef.typeParams, typeArgs);
				const { methods } = this.getAllMembers(base);
				const method = methods.find(entry => entry.name === name && !entry.name.startsWith("["));
				if (!method) return null;
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
			const indexeeType = this.exprType(text, cursor + 1, line, docTable);
			if (!indexeeType) return null;
			const { base, typeArgs } = SymbolService.toGeneric(indexeeType);
			const typeDef = this.#runtimeTable.classes.get(base);
			if (!typeDef) return null;
			const substitution = SymbolService.toSubstitution(typeDef.typeParams, typeArgs);
			const { methods } = this.getAllMembers(base);
			const indexOp = methods.find(entry => entry.name === "[]" && entry.params.length === 1);
			if (!indexOp) return null;
			return SymbolService.mapWith(indexOp.retType, substitution);
		}

		if (/[A-Za-z_0-9]/.test(text[cursor])) {
			const nameEnd = cursor;
			while (cursor >= 0 && /[A-Za-z_0-9]/.test(text[cursor])) cursor--;
			const name = text.slice(cursor + 1, nameEnd + 1);
			while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
			if (cursor >= 0 && text[cursor] === ".") {
				const receiverType = this.exprType(text, cursor, line, docTable);
				if (!receiverType) return null;
				const { base, typeArgs } = SymbolService.toGeneric(receiverType);
				const typeDef = this.#runtimeTable.classes.get(base);
				if (!typeDef) return null;
				const substitution = SymbolService.toSubstitution(typeDef.typeParams, typeArgs);
				const { fields } = this.getAllMembers(base);
				const field = fields.find(entry => entry.name === name);
				if (!field) return null;
				return SymbolService.mapWith(field.typeName, substitution);
			}
			return this.#typeOf(name, line, docTable);
		}

		return null;
	}

	#addWorkspaceGlobals(): void {
		const workspace = this.#runtimeTable.classes.get("workspace");
		if (!workspace) return;

		for (const { name, params, retType } of workspace.methods) this.#runtimeTable.addFunc(new FuncDef(name, params, retType, 0, Number.MAX_SAFE_INTEGER));
		for (const { name, typeName } of workspace.fields) if (!this.#runtimeTable.vars.some(variable => variable.name === name)) this.#runtimeTable.addVar(new VarDef(name, typeName, 0, Number.MAX_SAFE_INTEGER));
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

	getClass(name: string): ClassDef | undefined {
		return this.#runtimeTable.classes.get(name);
	}

	typeNames(): IterableIterator<string> {
		return this.#runtimeTable.classes.keys();
	}

	libFuncs(): Map<string, FuncDef[]> {
		return this.#runtimeTable.funcs;
	}

	libVarsAt(line: number): VarDef[] {
		return this.#runtimeTable.getVarsAt(line);
	}
}
//#endregion
