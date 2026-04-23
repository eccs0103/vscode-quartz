"use strict";

//#region Symbol definitions
export class ParamDef {
	name: string;
	typeName: string;

	constructor(name: string, typeName: string) {
		this.name = name;
		this.typeName = typeName;
	}
}

export class MethodDef {
	name: string;
	params: ParamDef[];
	retType: string;

	constructor(name: string, params: ParamDef[], retType: string) {
		this.name = name;
		this.params = params;
		this.retType = retType;
	}
}

export class FieldDef {
	name: string;
	typeName: string;

	constructor(name: string, typeName: string) {
		this.name = name;
		this.typeName = typeName;
	}
}

export class ClassDef {
	name: string;
	typeParams: string[];
	parent: string | undefined;
	methods: MethodDef[];
	fields: FieldDef[];

	constructor(name: string, typeParams: string[], parent: string | undefined, methods: MethodDef[], fields: FieldDef[]) {
		this.name = name;
		this.typeParams = typeParams;
		this.parent = parent;
		this.methods = methods;
		this.fields = fields;
	}
}

export class FuncDef {
	name: string;
	params: ParamDef[];
	retType: string;
	startLine: number;
	endLine: number;

	constructor(name: string, params: ParamDef[], retType: string, startLine: number, endLine: number) {
		this.name = name;
		this.params = params;
		this.retType = retType;
		this.startLine = startLine;
		this.endLine = endLine;
	}
}

export class VarDef {
	name: string;
	typeName: string;
	startLine: number;
	endLine: number;

	constructor(name: string, typeName: string, startLine: number, endLine: number) {
		this.name = name;
		this.typeName = typeName;
		this.startLine = startLine;
		this.endLine = endLine;
	}
}

export class GenericType {
	base: string;
	typeArgs: string[];

	constructor(base: string, typeArgs: string[]) {
		this.base = base;
		this.typeArgs = typeArgs;
	}
}

export class MemberSet {
	methods: MethodDef[];
	fields: FieldDef[];

	constructor(methods: MethodDef[], fields: FieldDef[]) {
		this.methods = methods;
		this.fields = fields;
	}
}
//#endregion
