"use strict";

import "adaptive-extender/node";
import { TypeDefinition, FunctionDefinition, VariableDefinition } from "../models/symbol-definitions.js";

//#region Symbol table
export class SymbolTable {
	#typeMap: Map<string, TypeDefinition> = new Map();
	#functionMap: Map<string, FunctionDefinition[]> = new Map();
	#variableList: VariableDefinition[] = [];

	addType(typeDefinition: TypeDefinition): void {
		this.#typeMap.set(typeDefinition.name, typeDefinition);
	}

	addFunction(funcDefinition: FunctionDefinition): void {
		const functionMap = this.#functionMap;
		functionMap.add(funcDefinition.name, []);
		functionMap.get(funcDefinition.name)?.push(funcDefinition);
	}

	addVariable(variableDefinition: VariableDefinition): void {
		this.#variableList.push(variableDefinition);
	}

	getType(name: string): TypeDefinition | undefined {
		return this.#typeMap.get(name);
	}

	hasType(name: string): boolean {
		return this.#typeMap.has(name);
	}

	typeNames(): IterableIterator<string> {
		return this.#typeMap.keys();
	}

	typeEntries(): IterableIterator<[string, TypeDefinition]> {
		return this.#typeMap.entries();
	}

	getFunctions(name: string): FunctionDefinition[] | undefined {
		return this.#functionMap.get(name);
	}

	functionEntries(): IterableIterator<[string, FunctionDefinition[]]> {
		return this.#functionMap.entries();
	}

	getVariablesAt(line: number): VariableDefinition[] {
		return this.#variableList.filter(variable => variable.isInScope(line));
	}

	findVariableAt(name: string, line: number): VariableDefinition | undefined {
		return this.#variableList.find(variable => variable.name === name && variable.isInScope(line));
	}

	hasVariable(name: string): boolean {
		return this.#variableList.some(variable => variable.name === name);
	}

	merge(other: SymbolTable): void {
		for (const [, typeDefinition] of other.typeEntries()) this.addType(typeDefinition);
		for (const [, overloads] of other.functionEntries()) overloads.forEach(this.addFunction.bind(this));
		for (const variableDefinition of other.#variableList) this.addVariable(variableDefinition);
	}
}
//#endregion
