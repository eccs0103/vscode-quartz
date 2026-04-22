"use strict";

import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceFolder } from 'vscode-languageserver/node';
import { HeaderParser } from './semantic/header-parser.js';
import { DocParser } from './semantic/parser.js';
import { SymbolTable, MethodDef, FieldDef } from './semantic/symbol-table.js';

//#region SymbolService
// Single source of truth for all language symbols.
// Loads built-in types from runtime.header.qrz once at startup,
// and parses the current document on demand.
export class SymbolService {
	readonly runtimeTable: SymbolTable = new SymbolTable();

	// Parses a generic type string into base name and type arguments.
	// e.g. "Sequence<Number>" → { base: "Sequence", args: ["Number"] }
	static parseGeneric(typeName: string): { base: string; args: string[] } {
		const idx = typeName.indexOf('<');
		if (idx === -1) return { base: typeName, args: [] };
		const base = typeName.slice(0, idx);
		const inner = typeName.slice(idx + 1, typeName.lastIndexOf('>'));
		const args: string[] = [];
		let depth = 0;
		let start = 0;
		for (let i = 0; i < inner.length; i++) {
			if (inner[i] === '<') { depth++; continue; }
			if (inner[i] === '>') { depth--; continue; }
			if (inner[i] === ',' && depth === 0) {
				args.push(inner.slice(start, i).trim());
				start = i + 1;
			}
		}
		if (inner.length > 0) args.push(inner.slice(start).trim());
		return { base, args: args.filter(Boolean) };
	}

	// Builds a substitution map from class generic param names to concrete type arguments.
	// e.g. typeParams=["Content"], typeArgs=["Number"] → { Content → Number }
	static buildSubstitution(typeParams: string[], typeArgs: string[]): Map<string, string> {
		const map = new Map<string, string>();
		for (let i = 0; i < typeParams.length && i < typeArgs.length; i++) {
			map.set(typeParams[i], typeArgs[i]);
		}
		return map;
	}

	// Replaces generic param placeholders in a type name with their concrete counterparts.
	static substituteGenerics(typeName: string, subst: Map<string, string>): string {
		if (subst.size === 0) return typeName;
		return typeName.replace(/\b[A-Za-z_]\w*\b/g, w => subst.get(w) ?? w);
	}

	initialize(workspaceFolders: WorkspaceFolder[]): void {
		for (const folder of workspaceFolders) {
			const folderPath = this.resolveFolderPath(folder.uri);
			if (!folderPath) continue;

			const headerPath = path.join(folderPath, 'runtime.header.qrz');
			if (!fs.existsSync(headerPath)) continue;

			const code = fs.readFileSync(headerPath, 'utf8');
			const headerTable = new HeaderParser().parse(code);
			this.runtimeTable.merge(headerTable);
		}

		this.addWorkspaceGlobals();
	}

	parse(code: string): SymbolTable {
		return new DocParser().parse(code);
	}

	// Resolves the declared type of a name: variable in scope, function return type,
	// or the class itself when a class name is used directly (e.g. workspace).
	resolveType(name: string, line: number, docTable: SymbolTable): string | null {
		const allVars = [...this.runtimeTable.getVarsAt(line), ...docTable.getVarsAt(line)];
		const v = allVars.find(x => x.name === name);
		if (v) return v.typeName;

		const overloads = this.runtimeTable.funcs.get(name) ?? docTable.funcs.get(name);
		if (overloads?.length) return overloads[0].retType;

		if (this.runtimeTable.classes.has(name)) return name;

		return null;
	}

	// Returns all methods and fields for baseTypeName, traversing the parent chain.
	getAllMembers(baseTypeName: string): { methods: MethodDef[]; fields: FieldDef[] } {
		const methods: MethodDef[] = [];
		const fields: FieldDef[] = [];
		const visited = new Set<string>();
		let current: string | undefined = baseTypeName;
		while (current && !visited.has(current)) {
			visited.add(current);
			const cls = this.runtimeTable.classes.get(current);
			if (!cls) break;
			methods.push(...cls.methods);
			fields.push(...cls.fields);
			current = cls.parent ? SymbolService.parseGeneric(cls.parent).base : undefined;
		}
		return { methods, fields };
	}

	// Promotes workspace singleton members to global scope so user code can call
	// write(...), read(...), range(...), pi, e without explicit "workspace." prefix.
	private addWorkspaceGlobals(): void {
		const workspace = this.runtimeTable.classes.get('workspace');
		if (!workspace) return;

		for (const m of workspace.methods) {
			if (!this.runtimeTable.funcs.has(m.name)) {
				this.runtimeTable.addFunc({
					name: m.name,
					params: m.params,
					retType: m.retType,
					startLine: 0,
					endLine: Number.MAX_SAFE_INTEGER
				});
			}
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

	private resolveFolderPath(uri: string): string | null {
		if (!uri.startsWith('file://')) return null;
		try {
			let p = decodeURIComponent(new URL(uri).pathname);
			if (process.platform === 'win32' && p.startsWith('/')) p = p.slice(1);
			return p;
		} catch {
			return null;
		}
	}
}
//#endregion
