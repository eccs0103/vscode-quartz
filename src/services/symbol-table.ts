"use strict";

import "adaptive-extender/core";
import { TypeDefinition, FunctionDefinition, VariableDefinition } from "../models/symbol-definitions.js";

//#region Symbol table
export class SymbolTable {
	#types: Map<string, TypeDefinition> = new Map();
	#functions: Map<string, FunctionDefinition[]> = new Map();
	#variables: VariableDefinition[] = [];

	addType(typeDefinition: TypeDefinition): void {
		this.#types.set(typeDefinition.name, typeDefinition);
	}

	addFunction(definition: FunctionDefinition): void {
		const functions = this.#functions;
		functions.add(definition.name, []);
		functions.get(definition.name)?.push(definition);
	}

	addVariable(variableDefinition: VariableDefinition): void {
		this.#variables.push(variableDefinition);
	}

	getType(name: string): TypeDefinition | null {
		return this.#types.get(name) ?? null;
	}

	hasType(name: string): boolean {
		return this.#types.has(name);
	}

	typeNames(): IterableIterator<string> {
		return this.#types.keys();
	}

	typeEntries(): IterableIterator<[string, TypeDefinition]> {
		return this.#types.entries();
	}

	getFunctions(name: string): FunctionDefinition[] | null {
		return this.#functions.get(name) ?? null;
	}

	functionEntries(): IterableIterator<[string, FunctionDefinition[]]> {
		return this.#functions.entries();
	}

	getVariablesAt(line: number): VariableDefinition[] {
		return this.#variables.filter(variable => variable.isInScope(line));
	}

	findVariableAt(name: string, line: number): VariableDefinition | null {
		return this.#variables.find(variable => variable.name === name && variable.isInScope(line)) ?? null;
	}

	hasVariable(name: string): boolean {
		return this.#variables.some(variable => variable.name === name);
	}

	merge(other: SymbolTable): void {
		for (const [, typeDefinition] of other.typeEntries()) this.addType(typeDefinition);
		for (const [, overloads] of other.functionEntries()) overloads.forEach(this.addFunction.bind(this));
		for (const variableDefinition of other.#variables) this.addVariable(variableDefinition);
	}
}
//#endregion
