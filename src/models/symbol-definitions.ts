"use strict";

import "adaptive-extender/node";
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
		return new FieldDefinition(this.#name, map.get(this.#typeName) ?? this.#typeName);
	}
}
//#endregion

//#region Function definition
export class FunctionDefinition {
	#name: string;
	#parameters: ParameterDefinition[];
	#returnType: string;
	#declaringType: string | undefined;
	#bodySpan: Span | undefined;

	constructor(name: string, parameters: ParameterDefinition[], returnType: string, declaringType?: string, bodySpan?: Span) {
		this.#name = name;
		this.#parameters = parameters;
		this.#returnType = returnType;
		this.#declaringType = declaringType;
		this.#bodySpan = bodySpan;
	}

	get name(): string { return this.#name; }
	get parameters(): ParameterDefinition[] { return this.#parameters; }
	get returnType(): string { return this.#returnType; }
	get declaringType(): string | undefined { return this.#declaringType; }
	get bodySpan(): Span | undefined { return this.#bodySpan; }

	hasBody(): boolean {
		return this.#bodySpan !== undefined;
	}

	isInScope(line: number): boolean {
		return this.#bodySpan === undefined || this.#bodySpan.containsLine(line);
	}

	static scopeSpan(startLine: number, endLine: number): Span {
		return new Span(new Cursor(startLine, 0), new Cursor(endLine, 0));
	}
}
//#endregion

//#region Type definition
export class TypeDefinition {
	#name: string;
	#typeParams: string[];
	#parent: string | undefined;
	#methods: FunctionDefinition[];
	#fields: FieldDefinition[];

	constructor(name: string, typeParams: string[], parent: string | undefined, methods: FunctionDefinition[], fields: FieldDefinition[]) {
		this.#name = name;
		this.#typeParams = typeParams;
		this.#parent = parent;
		this.#methods = methods;
		this.#fields = fields;
	}

	get name(): string { return this.#name; }
	get typeParams(): string[] { return this.#typeParams; }
	get parent(): string | undefined { return this.#parent; }
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
	#declaringType: string | undefined;

	constructor(name: string, typeName: string, scope: Span, declaringType?: string) {
		this.#name = name;
		this.#typeName = typeName;
		this.#scope = scope;
		this.#declaringType = declaringType;
	}

	get name(): string { return this.#name; }
	get typeName(): string { return this.#typeName; }
	get scope(): Span { return this.#scope; }
	get declaringType(): string | undefined { return this.#declaringType; }

	isInScope(line: number): boolean {
		return this.#scope.containsLine(line);
	}
}
//#endregion
