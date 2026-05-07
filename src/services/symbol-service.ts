"use strict";

import "adaptive-extender/node";
import * as FileSystem from "fs";
import * as path from "path";
import { WorkspaceFolder } from "vscode-languageserver/node.js";
import { HeaderParser } from "./header-parser.js";
import { DocumentParser } from "./document-parser.js";
import { TypeDefinition, FunctionDefinition, MemberSet, VariableDefinition } from "../models/symbol-definitions.js";
import { SymbolTable } from "./symbol-table.js";
import { TypeResolver } from "./type-resolver.js";

//#region Symbol service
export class SymbolService {
	#runtimeTable: SymbolTable = new SymbolTable();
	#resolver: TypeResolver = new TypeResolver();

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
		for (const { name, params, retType } of workspace.methods) runtimeTable.addFunction(new FunctionDefinition(name, params, retType, 0, Number.MAX_SAFE_INTEGER, "@Workspace"));
		for (const { name, typeName } of workspace.fields) if (!runtimeTable.hasVariable(name)) runtimeTable.addVariable(new VariableDefinition(name, typeName, 0, Number.MAX_SAFE_INTEGER, "@Workspace"));
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
