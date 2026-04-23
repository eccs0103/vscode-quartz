"use strict";

import { TypeDefinition, FunctionDefinition, VariableDefinition } from "../models/symbol-defs.js";

//#region Symbol table
export class SymbolTable {
	classes: Map<string, TypeDefinition> = new Map();
	functions: Map<string, FunctionDefinition[]> = new Map();
	variables: VariableDefinition[] = [];

	addClass(typeDefinition: TypeDefinition): void {
		this.classes.set(typeDefinition.name, typeDefinition);
	}

	addFunction(funcDefinition: FunctionDefinition): void {
		const overloads = this.functions.get(funcDefinition.name) ?? [];
		overloads.push(funcDefinition);
		this.functions.set(funcDefinition.name, overloads);
	}

	addVariable(varDefinition: VariableDefinition): void {
		this.variables.push(varDefinition);
	}

	getVariablesAt(line: number): VariableDefinition[] {
		return this.variables.filter(variable => line >= variable.startLine && line <= variable.endLine);
	}

	merge(other: SymbolTable): void {
		for (const typeDefinition of other.classes.values()) this.addClass(typeDefinition);
		for (const overloads of other.functions.values()) overloads.forEach(this.addFunction.bind(this));
		other.variables.forEach(this.addVariable.bind(this));
	}
}
//#endregion
