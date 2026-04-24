"use strict";

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

	constructor(name: string, params: ParameterDefinition[], retType: string) {
		this.name = name;
		this.params = params;
		this.retType = retType;
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
}

export class FunctionDefinition {
	name: string;
	params: ParameterDefinition[];
	retType: string;
	startLine: number;
	endLine: number;

	constructor(name: string, params: ParameterDefinition[], retType: string, startLine: number, endLine: number) {
		this.name = name;
		this.params = params;
		this.retType = retType;
		this.startLine = startLine;
		this.endLine = endLine;
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
