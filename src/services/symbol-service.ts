"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import FileSystem from "node:fs";
import Path from "node:path";
import { WorkspaceFolder } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { HeaderParser } from "./header-parser.js";
import { DocumentParser } from "./document-parser.js";
import { TypeDefinition, FunctionDefinition, VariableDefinition } from "../models/symbol-definitions.js";
import { MemberSet } from "../models/type-members.js";
import { SymbolTable } from "./symbol-table.js";
import { TypeResolver } from "./type-resolver.js";
import { ResolutionContext } from "./resolution-context.js";

//#region Cache entry
class CacheEntry {
	#version: number;
	#table: SymbolTable;

	constructor(version: number, table: SymbolTable) {
		this.#version = version;
		this.#table = table;
	}

	get table(): SymbolTable { return this.#table; }

	isAt(version: number): boolean {
		return this.#version === version;
	}
}
//#endregion

//#region Symbol service
export class SymbolService {
	#runtime: SymbolTable = new SymbolTable();
	#resolver: TypeResolver = new TypeResolver();
	#cache: Map<string, CacheEntry> = new Map();

	initialize(folders: WorkspaceFolder[]): void {
		const runtime = this.#runtime;
		for (const folder of folders) {
			const directory = this.#pathFrom(folder.uri);
			if (directory === null) continue;

			const header = Path.join(directory, "system.header.qrz");
			if (!FileSystem.existsSync(header)) continue;

			runtime.merge(new HeaderParser(FileSystem.readFileSync(header, "utf8")).parse());
		}

		this.#addWorkspaceGlobals();
	}

	parse(code: string): SymbolTable {
		return new DocumentParser(code).parse();
	}

	getDocumentTable(document: TextDocument): SymbolTable {
		const cache = this.#cache;
		const { uri, version } = document;
		const cached = cache.get(uri);
		if (cached !== undefined && cached.isAt(version)) return cached.table;
		const table = new DocumentParser(document.getText()).parse();
		cache.set(uri, new CacheEntry(version, table));
		return table;
	}

	getAllMembers(baseTypeName: string): MemberSet {
		return this.#resolver.getAllMembers(baseTypeName, this.#runtime);
	}

	typeAt(text: string, end: number, line: number, table: SymbolTable): string | null {
		return this.#resolver.typeAt(end, new ResolutionContext(text, line, this.#runtime, table));
	}

	getType(name: string): TypeDefinition | null {
		return this.#runtime.getType(name);
	}

	get runtime(): SymbolTable { return this.#runtime; }

	#addWorkspaceGlobals(): void {
		const runtime = this.#runtime;
		const workspace = runtime.getType("Workspace");
		if (workspace === null) return;
		const scope = FunctionDefinition.scopeSpan(0, Number.MAX_SAFE_INTEGER);
		for (const method of workspace.methods) runtime.addFunction(new FunctionDefinition(method.name, method.parameters, method.result, "@Workspace", scope));
		for (const { name, typeName } of workspace.fields) if (!runtime.hasVariable(name)) runtime.addVariable(new VariableDefinition(name, typeName, scope, "@Workspace"));
	}

	#pathFrom(address: string): string | null {
		const uri = URI.tryParse(address);
		if (uri === null || uri.protocol !== "file:") return null;
		return uri.toPath();
	}
}
//#endregion
