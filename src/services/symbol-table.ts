"use strict";

import { ClassDef, FuncDef, VarDef } from "../models/symbol-defs.js";

//#region Symbol table
export class SymbolTable {
	classes: Map<string, ClassDef> = new Map();
	funcs: Map<string, FuncDef[]> = new Map();
	vars: VarDef[] = [];

	addClass(typeDef: ClassDef): void {
		this.classes.set(typeDef.name, typeDef);
	}

	addFunc(funcDef: FuncDef): void {
		const overloads = this.funcs.get(funcDef.name) ?? [];
		overloads.push(funcDef);
		this.funcs.set(funcDef.name, overloads);
	}

	addVar(varDef: VarDef): void {
		this.vars.push(varDef);
	}

	getVarsAt(line: number): VarDef[] {
		return this.vars.filter(variable => line >= variable.startLine && line <= variable.endLine);
	}

	merge(other: SymbolTable): void {
		for (const typeDef of other.classes.values()) this.addClass(typeDef);
		for (const overloads of other.funcs.values()) overloads.forEach(this.addFunc.bind(this));
		other.vars.forEach(this.addVar.bind(this));
	}
}
//#endregion
