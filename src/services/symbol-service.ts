"use strict";

import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceFolder } from 'vscode-languageserver/node';
import { HeaderParser } from './semantic/header-parser.js';
import { DocParser } from './semantic/parser.js';
import { SymbolTable } from './semantic/symbol-table.js';

//#region SymbolService
// Single source of truth for all language symbols.
// Loads built-in types from runtime.header.qrz once at startup,
// and parses the current document on demand.
export class SymbolService {
	readonly runtimeTable: SymbolTable = new SymbolTable();

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
