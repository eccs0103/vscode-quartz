"use strict";

import "adaptive-extender/core";
import { Span, Cursor } from "./span.js";

//#region Parameter definition
export class ParameterDefinition {
	#name: string;
	#typeName: string;

	constructor(name: string, typeName: string) {
		this.#name = name;
		this.#typeName = typeName;
	}

	get name(): string { return this.#name; }
	get typeName(): string { return this.#typeName; }

	format(): string { return `${this.#name} ${this.#typeName}`; }
}
//#endregion

//#region Field definition
export class FieldDefinition {
	#name: string;
	#typeName: string;

	constructor(name: string, typeName: string) {
		this.#name = name;
		this.#typeName = typeName;
	}

	get name(): string { return this.#name; }
	get typeName(): string { return this.#typeName; }

	format(): string { return `${this.#name} ${this.#typeName}`; }

	substituted(map: Map<string, string>): FieldDefinition {
		const typeName = this.#typeName;
		return new FieldDefinition(this.#name, map.get(typeName) ?? typeName);
	}
}
//#endregion

//#region Function definition
export class FunctionDefinition {
	#owner: string | null;
	#name: string;
	#parameters: ParameterDefinition[];
	#result: string;
	#body: Span | null;

	constructor(name: string, parameters: ParameterDefinition[], result: string, owner: string | null, body: Span | null) {
		this.#owner = owner;
		this.#name = name;
		this.#parameters = parameters;
		this.#result = result;
		this.#body = body;
	}

	get owner(): string | null { return this.#owner; }
	get name(): string { return this.#name; }
	get parameters(): ParameterDefinition[] { return this.#parameters; }
	get result(): string { return this.#result; }

	isInScope(line: number): boolean {
		const body = this.#body;
		return body === null || body.contains(line);
	}

	static scopeSpan(begin: number, end: number): Span {
		return new Span(new Cursor(begin, 0), new Cursor(end, 0));
	}
}
//#endregion

//#region Type definition
export class TypeDefinition {
	#name: string;
	#typeParams: string[];
	#parent: string | null;
	#methods: FunctionDefinition[];
	#fields: FieldDefinition[];

	constructor(name: string, typeParams: string[], parent: string | null, methods: FunctionDefinition[], fields: FieldDefinition[]) {
		this.#name = name;
		this.#typeParams = typeParams;
		this.#parent = parent;
		this.#methods = methods;
		this.#fields = fields;
	}

	get name(): string { return this.#name; }
	get typeParams(): string[] { return this.#typeParams; }
	get parent(): string | null { return this.#parent; }
	get methods(): FunctionDefinition[] { return this.#methods; }
	get fields(): FieldDefinition[] { return this.#fields; }

	get isTemplate(): boolean { return this.#typeParams.length > 0; }
}
//#endregion

//#region Variable definition
export class VariableDefinition {
	#name: string;
	#typeName: string;
	#scope: Span;
	#owner: string | null;

	constructor(name: string, typeName: string, scope: Span, owner: string | null) {
		this.#name = name;
		this.#typeName = typeName;
		this.#scope = scope;
		this.#owner = owner;
	}

	get name(): string { return this.#name; }
	get typeName(): string { return this.#typeName; }
	get scope(): Span { return this.#scope; }
	get owner(): string | null { return this.#owner; }

	isInScope(line: number): boolean {
		return this.#scope.contains(line);
	}
}
//#endregion
