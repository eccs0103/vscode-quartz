"use strict";

import "adaptive-extender/node";
import { SignatureHelp, SignatureInformation, ParameterInformation, Position } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { ParameterDefinition } from "../models/symbol-definitions.js";
import { TypeResolver } from "./type-resolver.js";
import { OverloadPicker } from "./overload-picker.js";

//#region Call context
class CallContext {
	name: string;
	nameEndInText: number;
	activeParameter: number;

	constructor(name: string, nameEndInText: number, activeParameter: number) {
		this.name = name;
		this.nameEndInText = nameEndInText;
		this.activeParameter = activeParameter;
	}
}
//#endregion

//#region Signature service
export class SignatureService {
	static #patternIdentChar: RegExp = /[A-Za-z_0-9]/;

	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getSignatureHelp(document: TextDocument, position: Position): SignatureHelp | null {
		const symbolService = this.#symbolService;
		const text = document.getText();
		const offset = document.offsetAt(position);
		const context = this.#findCallContext(text, offset);
		if (context === null) return null;

		const { name, nameEndInText, activeParameter } = context;
		const documentTable = symbolService.parse(text);

		let nameCursor = nameEndInText;
		while (nameCursor >= 0 && SignatureService.#patternIdentChar.test(text[nameCursor])) nameCursor--;

		let dotCursor = nameCursor;
		while (dotCursor >= 0 && (text[dotCursor] === ' ' || text[dotCursor] === '\t')) dotCursor--;

		const isDot = dotCursor >= 0 && text[dotCursor] === '.';

		let overloads: { name: string; params: ParameterDefinition[]; retType: string }[];
		let ownerType: string | undefined;

		if (isDot) {
			const receiverType = symbolService.typeAt(text, dotCursor, position.line, documentTable);
			if (receiverType === null) return null;
			const { base, typeArgs } = TypeResolver.toGeneric(receiverType);
			const typeDefinition = symbolService.getType(base);
			const substitution = TypeResolver.toSubstitution(typeDefinition?.typeParams ?? [], typeArgs);
			const { methods } = symbolService.getAllMembers(base);
			const matching = methods.filter(method => method.name === name && !method.name.startsWith('['));
			if (matching.length === 0) return null;
			const declType = matching[0].declType ?? base;
			ownerType = (declType === base) ? receiverType : declType;
			overloads = matching.map(method => ({
				name: method.name,
				params: method.params.map(parameter => new ParameterDefinition(parameter.name, TypeResolver.mapWith(parameter.typeName, substitution))),
				retType: TypeResolver.mapWith(method.retType, substitution)
			}));
		} else {
			const runtime = symbolService.runtimeTable();
			const rawOverloads = runtime.getFunctions(name) ?? documentTable.getFunctions(name);
			if (rawOverloads === undefined || rawOverloads.length === 0) return null;
			ownerType = rawOverloads[0].ownerType;
			overloads = rawOverloads;
		}

		const activeSignature = OverloadPicker.pickActive(overloads.map(overload => overload.params.length), activeParameter);
		const signatures = overloads.map(overload => this.#makeSignature(overload, ownerType));
		return { signatures, activeSignature, activeParameter };
	}

	#findCallContext(text: string, offset: number): CallContext | null {
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
				if (nameCursor < 0 || !SignatureService.#patternIdentChar.test(text[nameCursor])) return null;
				const nameEnd = nameCursor;
				while (nameCursor >= 0 && SignatureService.#patternIdentChar.test(text[nameCursor])) nameCursor--;
				const name = text.slice(nameCursor + 1, nameEnd + 1);
				if (name[0] >= '0' && name[0] <= '9') return null;
				const activeParameter = OverloadPicker.argIndexAt(text, openParenOffset + 1, offset);
				return new CallContext(name, nameEnd, activeParameter);
			}
			cursor--;
		}

		return null;
	}

	#makeSignature(callable: { name: string; params: ParameterDefinition[]; retType: string }, ownerType: string | undefined): SignatureInformation {
		const prefix = ownerType !== undefined ? `${ownerType}.` : '';
		const paramStrings = callable.params.map(parameter => `${parameter.name} ${parameter.typeName}`);
		const label = `${prefix}${callable.name}(${paramStrings.join(', ')}) ${callable.retType}`;
		let charOffset = prefix.length + callable.name.length + 1;
		const parameters: ParameterInformation[] = paramStrings.map((param, index) => {
			const info: ParameterInformation = { label: [charOffset, charOffset + param.length] };
			charOffset += param.length + (index < paramStrings.length - 1 ? 2 : 0);
			return info;
		});
		return { label, parameters };
	}
}
//#endregion
