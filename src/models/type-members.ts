"use strict";

import "adaptive-extender/node";
import { FunctionDefinition } from "./symbol-definitions.js";
import { FieldDefinition } from "./symbol-definitions.js";

//#region Generic type
export class GenericType {
	#base: string;
	#typeArgs: string[];

	constructor(base: string, typeArgs: string[]) {
		this.#base = base;
		this.#typeArgs = typeArgs;
	}

	get base(): string { return this.#base; }
	get typeArgs(): string[] { return this.#typeArgs; }

	format(): string {
		const base = this.#base;
		const typeArgs = this.#typeArgs;
		return typeArgs.length > 0 ? `${base}<${typeArgs.join(", ")}>` : base;
	}
}
//#endregion

//#region Member set
export class MemberSet {
	#methods: FunctionDefinition[];
	#fields: FieldDefinition[];

	constructor(methods: FunctionDefinition[], fields: FieldDefinition[]) {
		this.#methods = methods;
		this.#fields = fields;
	}

	get methods(): FunctionDefinition[] { return this.#methods; }
	get fields(): FieldDefinition[] { return this.#fields; }

	findMethod(name: string): FunctionDefinition | undefined {
		return this.#methods.find(entry => entry.name === name && !entry.name.startsWith("["));
	}

	findField(name: string): FieldDefinition | undefined {
		return this.#fields.find(entry => entry.name === name);
	}
}
//#endregion
