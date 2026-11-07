"use strict";

import "adaptive-extender/core";
import { FunctionDefinition, TypeDefinition, VariableDefinition } from "../models/symbol-definitions.js";
import { SymbolTable } from "./symbol-table.js";

//#region Resolution context
export class ResolutionContext {
	#text: string;
	#line: number;
	#runtime: SymbolTable;
	#document: SymbolTable;

	constructor(text: string, line: number, runtime: SymbolTable, document: SymbolTable) {
		this.#text = text;
		this.#line = line;
		this.#runtime = runtime;
		this.#document = document;
	}

	get text(): string { return this.#text; }
	get line(): number { return this.#line; }
	get runtime(): SymbolTable { return this.#runtime; }
	get document(): SymbolTable { return this.#document; }

	findType(name: string): TypeDefinition | null {
		return this.#runtime.getType(name);
	}

	findFunctions(name: string): FunctionDefinition[] | null {
		return this.#runtime.getFunctions(name) ?? this.#document.getFunctions(name);
	}

	findVariable(name: string): VariableDefinition | null {
		const line = this.#line;
		return this.#runtime.findVariableAt(name, line) ?? this.#document.findVariableAt(name, line);
	}
}
//#endregion
