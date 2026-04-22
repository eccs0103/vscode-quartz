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
	readonly classes: Map<string, ClassDef> = new Map();
	readonly funcs: Map<string, FuncDef[]> = new Map();
	readonly vars: VarDef[] = [];

	addClass(cls: ClassDef): void {
		this.classes.set(cls.name, cls);
	}

	addFunc(fn: FuncDef): void {
		const overloads = this.funcs.get(fn.name) ?? [];
		overloads.push(fn);
		this.funcs.set(fn.name, overloads);
	}

	addVar(v: VarDef): void {
		this.vars.push(v);
	}

	getVarsAt(line: number): VarDef[] {
		return this.vars.filter(v => line >= v.startLine && line <= v.endLine);
	}

	merge(other: SymbolTable): void {
		for (const cls of other.classes.values()) this.addClass(cls);
		for (const overloads of other.funcs.values()) overloads.forEach(fn => this.addFunc(fn));
		other.vars.forEach(v => this.addVar(v));
	}
}

//#endregion
