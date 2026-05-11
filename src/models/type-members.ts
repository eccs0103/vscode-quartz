"use strict";

import "adaptive-extender/node";
import { FunctionDefinition } from "./symbol-definitions.js";
import { FieldDefinition } from "./symbol-definitions.js";

//#region Generic type
export class GenericType {
	base: string;
	typeArgs: string[];

	constructor(base: string, typeArgs: string[]) {
		this.base = base;
		this.typeArgs = typeArgs;
	}
}
//#endregion

//#region Member set
export class MemberSet {
	methods: FunctionDefinition[];
	fields: FieldDefinition[];

	constructor(methods: FunctionDefinition[], fields: FieldDefinition[]) {
		this.methods = methods;
		this.fields = fields;
	}
}
//#endregion
