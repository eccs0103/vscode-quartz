"use strict";

import "adaptive-extender/node";
import * as FileSystem from "fs";
import * as path from "path";
import { WorkspaceFolder } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { HeaderParser } from "./header-parser.js";
import { DocumentParser } from "./document-parser.js";
import { TypeDefinition, FunctionDefinition, VariableDefinition } from "../models/symbol-definitions.js";
import { MemberSet } from "../models/type-members.js";
import { SymbolTable } from "./symbol-table.js";
import { TypeResolver } from "./type-resolver.js";

//#region Doc cache entry
class DocCacheEntry {
	version: number;
	table: SymbolTable;

	constructor(version: number, table: SymbolTable) {
		this.version = version;
		this.table = table;
	}
}
//#endregion

//#region Symbol service
export class SymbolService {
	#runtimeTable: SymbolTable = new SymbolTable();
	#resolver: TypeResolver = new TypeResolver();
	#docCache: Map<string, DocCacheEntry> = new Map();

	initialize(workspaceFolders: WorkspaceFolder[]): void {
		const runtimeTable = this.#runtimeTable;
		for (const folder of workspaceFolders) {
			const folderPath = this.#pathFrom(folder.uri);
			if (folderPath === null) continue;

			const headerPath = path.join(folderPath, "system.header.qrz");
			if (!FileSystem.existsSync(headerPath)) continue;

			runtimeTable.merge(new HeaderParser().parse(FileSystem.readFileSync(headerPath, "utf8")));
		}

		this.#addWorkspaceGlobals();
	}

	parse(code: string): SymbolTable {
		return new DocumentParser().parse(code);
	}

	getDocumentTable(document: TextDocument): SymbolTable {
		const { uri, version } = document;
		const cached = this.#docCache.get(uri);
		if (cached !== undefined && cached.version === version) return cached.table;
		const table = new DocumentParser().parse(document.getText());
		this.#docCache.set(uri, new DocCacheEntry(version, table));
		return table;
	}

	getAllMembers(baseTypeName: string): MemberSet {
		return this.#resolver.getAllMembers(baseTypeName, this.#runtimeTable);
	}

	typeAt(text: string, end: number, line: number, documentTable: SymbolTable): string | null {
		return this.#resolver.typeAt(text, end, line, this.#runtimeTable, documentTable);
	}

	getType(name: string): TypeDefinition | undefined {
		return this.#runtimeTable.getType(name);
	}

	runtimeTable(): SymbolTable {
		return this.#runtimeTable;
	}

	#addWorkspaceGlobals(): void {
		const runtimeTable = this.#runtimeTable;
		const workspace = runtimeTable.getType("Workspace");
		if (workspace === undefined) return;
		const globalScope = FunctionDefinition.scopeSpan(0, Number.MAX_SAFE_INTEGER);
		for (const method of workspace.methods) runtimeTable.addFunction(new FunctionDefinition(method.name, method.parameters, method.returnType, "@Workspace", globalScope));
		for (const { name, typeName } of workspace.fields) if (!runtimeTable.hasVariable(name)) runtimeTable.addVariable(new VariableDefinition(name, typeName, globalScope, "@Workspace"));
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
}
//#endregion
