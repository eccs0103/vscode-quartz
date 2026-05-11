"use strict";

import "adaptive-extender/node";
import { Span, Cursor } from "./span.js";

//#region Parameter definition
export class ParameterDefinition {
	name: string;
	typeName: string;

	constructor(name: string, typeName: string) {
		this.name = name;
		this.typeName = typeName;
	}
}
//#endregion

//#region Field definition
export class FieldDefinition {
	name: string;
	typeName: string;

	constructor(name: string, typeName: string) {
		this.name = name;
		this.typeName = typeName;
	}
}
//#endregion

//#region Function definition
export class FunctionDefinition {
	name: string;
	parameters: ParameterDefinition[];
	returnType: string;
	declaringType: string | undefined;
	bodySpan: Span | undefined;

	constructor(name: string, parameters: ParameterDefinition[], returnType: string, declaringType?: string, bodySpan?: Span) {
		this.name = name;
		this.parameters = parameters;
		this.returnType = returnType;
		this.declaringType = declaringType;
		this.bodySpan = bodySpan;
	}

	hasBody(): boolean {
		return this.bodySpan !== undefined;
	}

	isInScope(line: number): boolean {
		return this.bodySpan === undefined || this.bodySpan.containsLine(line);
	}

	static scopeSpan(startLine: number, endLine: number): Span {
		return new Span(new Cursor(startLine, 0), new Cursor(endLine, 0));
	}
}
//#endregion

//#region Type definition
export class TypeDefinition {
	name: string;
	typeParams: string[];
	parent: string | undefined;
	methods: FunctionDefinition[];
	fields: FieldDefinition[];

	constructor(name: string, typeParams: string[], parent: string | undefined, methods: FunctionDefinition[], fields: FieldDefinition[]) {
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
//#endregion

//#region Variable definition
export class VariableDefinition {
	name: string;
	typeName: string;
	scope: Span;
	declaringType: string | undefined;

	constructor(name: string, typeName: string, scope: Span, declaringType?: string) {
		this.name = name;
		this.typeName = typeName;
		this.scope = scope;
		this.declaringType = declaringType;
	}

	isInScope(line: number): boolean {
		return this.scope.containsLine(line);
	}
}
//#endregion
