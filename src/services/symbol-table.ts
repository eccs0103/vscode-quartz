"use strict";

//#region Type definitions
export interface ParamDef {
	name: string;
	typeName: string;
}

export interface MethodDef {
	name: string;
	params: ParamDef[];
	retType: string;
}

export interface FieldDef {
	name: string;
	typeName: string;
}

export interface ClassDef {
	name: string;
	typeParams: string[];
	parent?: string;
	methods: MethodDef[];
	fields: FieldDef[];
}

export interface FuncDef {
	name: string;
	params: ParamDef[];
	retType: string;
	startLine: number;
	endLine: number;
}

export interface VarDef {
	name: string;
	typeName: string;
	startLine: number;
	endLine: number;
}
//#endregion

//#region SymbolTable
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
		for (const overloads of other.funcs.values()) overloads.forEach(funcDef => this.addFunc(funcDef));
		other.vars.forEach(varDef => this.addVar(varDef));
	}
}
//#endregion
