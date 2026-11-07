"use strict";

import "adaptive-extender/node";
import { type SignatureHelp, SignatureInformation, ParameterInformation, Position } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { FunctionDefinition, ParameterDefinition } from "../models/symbol-definitions.js";
import { TypeResolver } from "./type-resolver.js";
import { OverloadPicker } from "./overload-picker.js";

//#region Call context
class CallContext {
	#name: string;
	#end: number;
	#activeParameter: number;

	constructor(name: string, end: number, activeParameter: number) {
		this.#name = name;
		this.#end = end;
		this.#activeParameter = activeParameter;
	}

	get name(): string { return this.#name; }
	get end(): number { return this.#end; }
	get activeParameter(): number { return this.#activeParameter; }

	filterOverloads(overloads: FunctionDefinition[]): FunctionDefinition[] {
		const name = this.#name;
		return overloads.filter(entry => entry.name === name && !entry.name.startsWith("["));
	}
}
//#endregion

//#region Signature service
export class SignatureService {
	static #identifier: RegExp = /[A-Za-z_0-9]/;

	#symbols: SymbolService;

	constructor(symbols: SymbolService) {
		this.#symbols = symbols;
	}

	getSignatureHelp(document: TextDocument, position: Position): SignatureHelp | null {
		const symbols = this.#symbols;
		const text = document.getText();
		const offset = document.offsetAt(position);
		const context = this.#findCallContext(text, offset);
		if (context === null) return null;

		const { name, end, activeParameter } = context;
		const table = symbols.getDocumentTable(document);

		let nameCursor = end;
		while (nameCursor >= 0 && SignatureService.#identifier.test(text[nameCursor])) nameCursor--;

		let dotCursor = nameCursor;
		while (dotCursor >= 0 && (text[dotCursor] === ' ' || text[dotCursor] === '\t')) dotCursor--;

		const isDot = dotCursor >= 0 && text[dotCursor] === '.';

		let overloads: FunctionDefinition[];
		let owner: string | null;

		if (isDot) {
			const receiver = symbols.typeAt(text, dotCursor, position.line, table);
			if (receiver === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(receiver);
			const typeDefinition = symbols.getType(base);
			const substitution = TypeResolver.toSubstitution(typeDefinition?.typeParams ?? [], typeArgs);
			const { methods } = symbols.getAllMembers(base);
			const matching = context.filterOverloads(methods);
			if (matching.length === 0) return null;
			const declarer = matching[0].owner ?? base;
			owner = (declarer === base) ? receiver : declarer;
			overloads = matching.map(method => new FunctionDefinition(
				method.name,
				method.parameters.map(parameter => new ParameterDefinition(parameter.name, TypeResolver.mapWith(parameter.typeName, substitution))),
				TypeResolver.mapWith(method.result, substitution),
				null,
				null
			));
		} else {
			const { runtime } = symbols;
			const rawOverloads = runtime.getFunctions(name) ?? table.getFunctions(name);
			if (rawOverloads === null || rawOverloads.length === 0) return null;
			owner = rawOverloads[0].owner;
			overloads = rawOverloads;
		}

		const activeSignature = OverloadPicker.pickActive(overloads.map(overload => overload.parameters.length), activeParameter);
		const signatures = overloads.map(overload => this.#makeSignature(overload, owner));
		return { signatures, activeSignature, activeParameter };
	}

	#findCallContext(text: string, offset: number): CallContext | null {
		const identifier = SignatureService.#identifier;
		let nestDepth = 0;
		let bodyDepth = 0;
		let cursor = offset - 1;

		while (cursor >= 0) {
			const char = text[cursor];
			if (char === ')' || char === ']') { nestDepth++; cursor--; continue; }
			if (char === '}') { bodyDepth++; cursor--; continue; }
			if (char === '[') { nestDepth--; if (nestDepth < 0) return null; cursor--; continue; }
			if (char === '{') { bodyDepth--; if (bodyDepth < 0) return null; cursor--; continue; }
			if (char === '(') {
				if (nestDepth > 0) { nestDepth--; cursor--; continue; }
				const openParenOffset = cursor;
				let nameCursor = cursor - 1;
				while (nameCursor >= 0 && (text[nameCursor] === ' ' || text[nameCursor] === '\t')) nameCursor--;
				if (nameCursor < 0 || !identifier.test(text[nameCursor])) return null;
				const nameEnd = nameCursor;
				while (nameCursor >= 0 && identifier.test(text[nameCursor])) nameCursor--;
				const name = text.slice(nameCursor + 1, nameEnd + 1);
				if (name[0] >= '0' && name[0] <= '9') return null;
				const activeParameter = OverloadPicker.indexAt(text, openParenOffset + 1, offset);
				return new CallContext(name, nameEnd, activeParameter);
			}
			cursor--;
		}

		return null;
	}

	#makeSignature(callable: FunctionDefinition, owner: string | null): SignatureInformation {
		const prefix = owner !== null ? `${owner}.` : '';
		const formatted = callable.parameters.map(parameter => parameter.format());
		const label = `${prefix}${callable.name}(${formatted.join(', ')}) ${callable.result}`;
		let offset = prefix.length + callable.name.length + 1;
		const parameters: ParameterInformation[] = formatted.map((text, index) => {
			const info: ParameterInformation = { label: [offset, offset + text.length] };
			offset += text.length + (index < formatted.length - 1 ? 2 : 0);
			return info;
		});
		return { label, parameters };
	}
}
//#endregion
