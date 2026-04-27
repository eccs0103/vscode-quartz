"use strict";

import "adaptive-extender/node";

//#region Symbol definitions
export class ParameterDefinition {
	name: string;
	typeName: string;

	constructor(name: string, typeName: string) {
		this.name = name;
		this.typeName = typeName;
	}
}

export class MethodDefinition {
	name: string;
	params: ParameterDefinition[];
	retType: string;
	declType: string | undefined;

	constructor(name: string, params: ParameterDefinition[], retType: string, declType?: string) {
		this.name = name;
		this.params = params;
		this.retType = retType;
		this.declType = declType;
	}
}

export class FieldDefinition {
	name: string;
	typeName: string;

	constructor(name: string, typeName: string) {
		this.name = name;
		this.typeName = typeName;
	}
}

export class TypeDefinition {
	name: string;
	typeParams: string[];
	parent: string | undefined;
	methods: MethodDefinition[];
	fields: FieldDefinition[];

	constructor(name: string, typeParams: string[], parent: string | undefined, methods: MethodDefinition[], fields: FieldDefinition[]) {
		this.name = name;
		this.typeParams = typeParams;
		this.parent = parent;
		this.methods = methods;
		this.fields = fields;
	}

	get isTemplate(): boolean {
		return this.typeParams.length > 0;
	}
}

export class FunctionDefinition {
	name: string;
	params: ParameterDefinition[];
	retType: string;
	startLine: number;
	endLine: number;
	ownerType: string | undefined;

	constructor(name: string, params: ParameterDefinition[], retType: string, startLine: number, endLine: number, ownerType?: string) {
		this.name = name;
		this.params = params;
		this.retType = retType;
		this.startLine = startLine;
		this.endLine = endLine;
		this.ownerType = ownerType;
	}
}

export class VariableDefinition {
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
	methods: MethodDefinition[];
	fields: FieldDefinition[];

	constructor(methods: MethodDefinition[], fields: FieldDefinition[]) {
		this.methods = methods;
		this.fields = fields;
	}
}
//#endregion
