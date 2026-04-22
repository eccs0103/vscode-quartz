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
		const idx = typeName.indexOf("<");
		if (idx === -1) return { base: typeName, args: [] };
		const base = typeName.slice(0, idx);
		const inner = typeName.slice(idx + 1, typeName.lastIndexOf(">"));
		const args: string[] = [];
		let depth = 0;
		let start = 0;
		for (let i = 0; i < inner.length; i++) {
			if (inner[i] === "<") { depth++; continue; }
			if (inner[i] === ">") { depth--; continue; }
			if (inner[i] === "," && depth === 0) {
				args.push(inner.slice(start, i).trim());
				start = i + 1;
			}
		}
		if (inner.length > 0) args.push(inner.slice(start).trim());
		return { base, args: args.filter(Boolean) };
	}

	static toSubst(typeParams: string[], typeArgs: string[]): Map<string, string> {
		const map = new Map<string, string>();
		for (let i = 0; i < typeParams.length && i < typeArgs.length; i++) {
			map.set(typeParams[i], typeArgs[i]);
		}
		return map;
	}

	static mapWith(typeName: string, subst: Map<string, string>): string {
		if (subst.size === 0) return typeName;
		return typeName.replace(/\b[A-Za-z_]\w*\b/g, w => subst.get(w) ?? w);
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
		const allVars = [...this.runtimeTable.getVarsAt(line), ...docTable.getVarsAt(line)];
		const v = allVars.find(x => x.name === name);
		if (v) return v.typeName;

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
		let current: { name: string; subst: Map<string, string> } | undefined =
			{ name: baseTypeName, subst: new Map() };

		while (current && !visited.has(current.name)) {
			visited.add(current.name);
			const cls = this.runtimeTable.classes.get(current.name);
			if (!cls) break;
			const { subst } = current;

			for (const m of cls.methods) {
				const key = `${m.name}/${m.params.length}`;
				if (seenMethod.has(key)) continue;
				seenMethod.add(key);
				methods.push(subst.size === 0 ? m : {
					name: m.name,
					params: m.params.map(p => ({ name: p.name, typeName: SymbolService.mapWith(p.typeName, subst) })),
					retType: SymbolService.mapWith(m.retType, subst)
				});
			}

			for (const f of cls.fields) {
				if (seenField.has(f.name)) continue;
				seenField.add(f.name);
				fields.push(subst.size === 0 ? f : {
					name: f.name,
					typeName: SymbolService.mapWith(f.typeName, subst)
				});
			}

			if (!cls.parent) break;
			const { base: parentBase, args: parentArgs } = SymbolService.toGeneric(cls.parent);
			const parentCls = this.runtimeTable.classes.get(parentBase);
			if (!parentCls) break;
			const newSubst = SymbolService.toSubst(
				parentCls.typeParams,
				parentArgs.map(a => SymbolService.mapWith(a, subst))
			);
			current = { name: parentBase, subst: newSubst };
		}

		return { methods, fields };
	}

	exprType(text: string, end: number, line: number, docTable: SymbolTable): string | null {
		let i = end - 1;
		while (i >= 0 && (text[i] === " " || text[i] === "\t")) i--;
		if (i < 0) return null;

		if (text[i] === ")") {
			let depth = 1;
			i--;
			while (i >= 0 && depth > 0) {
				if (text[i] === ")") depth++;
				else if (text[i] === "(") depth--;
				i--;
			}
			while (i >= 0 && (text[i] === " " || text[i] === "\t")) i--;
			if (i < 0 || !/[A-Za-z_0-9]/.test(text[i])) return null;
			const nameEnd = i;
			while (i >= 0 && /[A-Za-z_0-9]/.test(text[i])) i--;
			const name = text.slice(i + 1, nameEnd + 1);
			while (i >= 0 && (text[i] === " " || text[i] === "\t")) i--;
			if (i >= 0 && text[i] === ".") {
				const receiverType = this.exprType(text, i, line, docTable);
				if (!receiverType) return null;
				const { base, args } = SymbolService.toGeneric(receiverType);
				const cls = this.runtimeTable.classes.get(base);
				if (!cls) return null;
				const subst = SymbolService.toSubst(cls.typeParams, args);
				const { methods } = this.getAllMembers(base);
				const method = methods.find(m => m.name === name && !m.name.startsWith("["));
				if (!method) return null;
				return SymbolService.mapWith(method.retType, subst);
			}
			return this.#typeOf(name, line, docTable);
		}

		if (text[i] === "]") {
			let depth = 1;
			i--;
			while (i >= 0 && depth > 0) {
				if (text[i] === "]") depth++;
				else if (text[i] === "[") depth--;
				i--;
			}
			const indexeeType = this.exprType(text, i + 1, line, docTable);
			if (!indexeeType) return null;
			const { base, args } = SymbolService.toGeneric(indexeeType);
			const cls = this.runtimeTable.classes.get(base);
			if (!cls) return null;
			const subst = SymbolService.toSubst(cls.typeParams, args);
			const { methods } = this.getAllMembers(base);
			const indexOp = methods.find(m => m.name === "[]" && m.params.length === 1);
			if (!indexOp) return null;
			return SymbolService.mapWith(indexOp.retType, subst);
		}

		if (/[A-Za-z_0-9]/.test(text[i])) {
			const nameEnd = i;
			while (i >= 0 && /[A-Za-z_0-9]/.test(text[i])) i--;
			const name = text.slice(i + 1, nameEnd + 1);
			while (i >= 0 && (text[i] === " " || text[i] === "\t")) i--;
			if (i >= 0 && text[i] === ".") {
				const receiverType = this.exprType(text, i, line, docTable);
				if (!receiverType) return null;
				const { base, args } = SymbolService.toGeneric(receiverType);
				const cls = this.runtimeTable.classes.get(base);
				if (!cls) return null;
				const subst = SymbolService.toSubst(cls.typeParams, args);
				const { fields } = this.getAllMembers(base);
				const field = fields.find(f => f.name === name);
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

		for (const m of workspace.methods) {
			this.runtimeTable.addFunc({
				name: m.name,
				params: m.params,
				retType: m.retType,
				startLine: 0,
				endLine: Number.MAX_SAFE_INTEGER
			});
		}

		for (const f of workspace.fields) {
			const alreadyExists = this.runtimeTable.vars.some(v => v.name === f.name);
			if (!alreadyExists) {
				this.runtimeTable.addVar({
					name: f.name,
					typeName: f.typeName,
					startLine: 0,
					endLine: Number.MAX_SAFE_INTEGER
				});
			}
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
