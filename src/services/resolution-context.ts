"use strict";

import "adaptive-extender/node";
import { FunctionDefinition, TypeDefinition, VariableDefinition } from "../models/symbol-definitions.js";
import { SymbolTable } from "./symbol-table.js";

//#region Resolution context
export class ResolutionContext {
	text: string;
	line: number;
	#runtimeTable: SymbolTable;
	#docTable: SymbolTable;

	constructor(text: string, line: number, runtimeTable: SymbolTable, docTable: SymbolTable) {
		this.text = text;
		this.line = line;
		this.#runtimeTable = runtimeTable;
		this.#docTable = docTable;
	}

	findType(name: string): TypeDefinition | undefined {
		return this.#runtimeTable.getType(name);
	}

	findFunctions(name: string): FunctionDefinition[] | undefined {
		return this.#runtimeTable.getFunctions(name) ?? this.#docTable.getFunctions(name);
	}

	findVariable(name: string): VariableDefinition | undefined {
		return this.#runtimeTable.findVariableAt(name, this.line) ?? this.#docTable.findVariableAt(name, this.line);
	}

	runtimeTable(): SymbolTable {
		return this.#runtimeTable;
	}

	docTable(): SymbolTable {
		return this.#docTable;
	}
}
//#endregion
