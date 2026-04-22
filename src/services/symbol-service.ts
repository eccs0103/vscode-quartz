"use strict";

import * as fs from "fs";
import * as path from "path";
import { WorkspaceFolder } from "vscode-languageserver/node";
import { HeaderParser } from "./semantic/header-parser.js";
import { DocParser } from "./semantic/parser.js";
import { SymbolTable, MethodDef, FieldDef } from "./semantic/symbol-table.js";

//#region SymbolService
export class SymbolService {
	readonly runtimeTable: SymbolTable = new SymbolTable();

	static toGeneric(typeName: string): { base: string; args: string[] } {
		const index = typeName.indexOf("<");
		if (index === -1) return { base: typeName, args: [] };
		const base = typeName.slice(0, index);
		const inner = typeName.slice(index + 1, typeName.lastIndexOf(">"));
		const args: string[] = [];
		let depth = 0;
		let start = 0;
		for (let offset = 0; offset < inner.length; offset++) {
			if (inner[offset] === "<") { depth++; continue; }
			if (inner[offset] === ">") { depth--; continue; }
			if (inner[offset] === "," && depth === 0) {
				args.push(inner.slice(start, offset).trim());
				start = offset + 1;
			}
		}
		if (inner.length > 0) args.push(inner.slice(start).trim());
		return { base, args: args.filter(Boolean) };
	}

	static toSubst(typeParams: string[], typeArgs: string[]): Map<string, string> {
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
			this.runtimeTable.merge(headerTable);
		}

		this.#addWorkspaceGlobals();
	}

	parse(code: string): SymbolTable {
		return new DocParser().parse(code);
	}

	#typeOf(name: string, line: number, docTable: SymbolTable): string | null {
		const variable = [...this.runtimeTable.getVarsAt(line), ...docTable.getVarsAt(line)].find(entry => entry.name === name);
		if (variable) return variable.typeName;

		const overloads = this.runtimeTable.funcs.get(name) ?? docTable.funcs.get(name);
		if (overloads?.length) return overloads[0].retType;

		if (this.runtimeTable.classes.has(name)) return name;

		return null;
	}

	getAllMembers(baseTypeName: string): { methods: MethodDef[]; fields: FieldDef[] } {
		const methods: MethodDef[] = [];
		const fields: FieldDef[] = [];
		const seenMethod = new Set<string>();
		const seenField = new Set<string>();
		const visited = new Set<string>();
		let current: { name: string; subst: Map<string, string> } | undefined = { name: baseTypeName, subst: new Map() };

		while (current && !visited.has(current.name)) {
			visited.add(current.name);
			const typeDef = this.runtimeTable.classes.get(current.name);
			if (!typeDef) break;
			const { subst } = current;

			for (const method of typeDef.methods) {
				const key = `${method.name}/${method.params.length}`;
				if (seenMethod.has(key)) continue;
				seenMethod.add(key);
				methods.push(subst.size === 0 ? method : {
					name: method.name,
					params: method.params.map(parameter => ({ name: parameter.name, typeName: SymbolService.mapWith(parameter.typeName, subst) })),
					retType: SymbolService.mapWith(method.retType, subst)
				});
			}

			for (const field of typeDef.fields) {
				if (seenField.has(field.name)) continue;
				seenField.add(field.name);
				fields.push(subst.size === 0 ? field : { name: field.name, typeName: SymbolService.mapWith(field.typeName, subst) });
			}

			if (!typeDef.parent) break;
			const { base, args } = SymbolService.toGeneric(typeDef.parent);
			const baseType = this.runtimeTable.classes.get(base);
			if (!baseType) break;
			const newSubst = SymbolService.toSubst(baseType.typeParams, args.map(word => SymbolService.mapWith(word, subst)));
			current = { name: base, subst: newSubst };
		}

		return { methods, fields };
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
				const { base, args } = SymbolService.toGeneric(receiverType);
				const typeDef = this.runtimeTable.classes.get(base);
				if (!typeDef) return null;
				const subst = SymbolService.toSubst(typeDef.typeParams, args);
				const { methods } = this.getAllMembers(base);
				const method = methods.find(entry => entry.name === name && !entry.name.startsWith("["));
				if (!method) return null;
				return SymbolService.mapWith(method.retType, subst);
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
			const { base, args } = SymbolService.toGeneric(indexeeType);
			const typeDef = this.runtimeTable.classes.get(base);
			if (!typeDef) return null;
			const subst = SymbolService.toSubst(typeDef.typeParams, args);
			const { methods } = this.getAllMembers(base);
			const indexOp = methods.find(entry => entry.name === "[]" && entry.params.length === 1);
			if (!indexOp) return null;
			return SymbolService.mapWith(indexOp.retType, subst);
		}

		if (/[A-Za-z_0-9]/.test(text[cursor])) {
			const nameEnd = cursor;
			while (cursor >= 0 && /[A-Za-z_0-9]/.test(text[cursor])) cursor--;
			const name = text.slice(cursor + 1, nameEnd + 1);
			while (cursor >= 0 && (text[cursor] === " " || text[cursor] === "\t")) cursor--;
			if (cursor >= 0 && text[cursor] === ".") {
				const receiverType = this.exprType(text, cursor, line, docTable);
				if (!receiverType) return null;
				const { base, args } = SymbolService.toGeneric(receiverType);
				const typeDef = this.runtimeTable.classes.get(base);
				if (!typeDef) return null;
				const subst = SymbolService.toSubst(typeDef.typeParams, args);
				const { fields } = this.getAllMembers(base);
				const field = fields.find(entry => entry.name === name);
				if (!field) return null;
				return SymbolService.mapWith(field.typeName, subst);
			}
			return this.#typeOf(name, line, docTable);
		}

		return null;
	}

	#addWorkspaceGlobals(): void {
		const workspace = this.runtimeTable.classes.get("workspace");
		if (!workspace) return;

		for (const method of workspace.methods) {
			this.runtimeTable.addFunc({ name: method.name, params: method.params, retType: method.retType, startLine: 0, endLine: Number.MAX_SAFE_INTEGER });
		}

		for (const field of workspace.fields) {
			if (!this.runtimeTable.vars.some(variable => variable.name === field.name)) this.runtimeTable.addVar({ name: field.name, typeName: field.typeName, startLine: 0, endLine: Number.MAX_SAFE_INTEGER });
		}
	}

	#pathFrom(uri: string): string | null {
		if (!uri.startsWith("file://")) return null;
		try {
			let p = decodeURIComponent(new URL(uri).pathname);
			if (process.platform === "win32" && p.startsWith("/")) p = p.slice(1);
			return p;
		} catch {
			return null;
		}
	}
}
//#endregion
