"use strict";

import "adaptive-extender/node";
import { Hover, MarkupKind, Position } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./symbol-table.js";
import { TypeResolver } from "./type-resolver.js";
import { HoverData } from "../models/hover-data.js";

//#region Hover service
export class HoverService {
	static #patternWord: RegExp = /[A-Za-z_]\w*/g;

	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getHover(document: TextDocument, position: Position): Hover | null {
		const symbolService = this.#symbolService;
		const text = document.getText();
		const offset = document.offsetAt(position);
		const match = this.#wordAt(text, offset);
		if (match === null) return null;

		const word = match[0];
		const start = match.index;
		const wordEnd = start + word.length;
		const documentTable = symbolService.parse(text);

		if (start > 0 && text[start - 1] === ".") {
			const receiverType = symbolService.typeAt(text, start - 1, position.line, documentTable);
			if (receiverType === null) return null;
			return this.#makeHoverForMember(word, wordEnd, receiverType, text);
		}

		return this.#makeHover(word, wordEnd, position.line, text, documentTable);
	}

	#makeHoverForMember(memberName: string, wordEnd: number, typeName: string, text: string): Hover | null {
		const symbolService = this.#symbolService;
		const { base, typeArgs } = TypeResolver.toGeneric(typeName);
		const typeDefinition = symbolService.getType(base);
		if (typeDefinition === undefined) return null;

		const substitution = TypeResolver.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods, fields } = symbolService.getAllMembers(base);

		const matching = methods.filter(entry => entry.name === memberName && !entry.name.startsWith("["));
		if (matching.length > 0) {
			const argCount = this.#argCountAt(text, wordEnd);
			const resolved = matching[this.#pickOverloadIndex(matching.map(method => method.params.length), argCount)];
			const signature = `${typeName}.${memberName}(${resolved.params.map(parameter => `${parameter.name} ${TypeResolver.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${TypeResolver.mapWith(resolved.retType, substitution)}`;
			const overloadNote = matching.length > 1 ? `\n_+${matching.length - 1} ${matching.length - 1 === 1 ? "overload" : "overloads"}_` : String.empty;
			return this.#md(`\`\`\`quartz\n${signature}\n\`\`\`${overloadNote}`);
		}

		const field = fields.find(entry => entry.name === memberName);
		if (field === undefined) return null;
		return this.#md(`\`\`\`quartz\n${memberName} ${TypeResolver.mapWith(field.typeName, substitution)}\n\`\`\``);
	}

	#makeHover(word: string, wordEnd: number, line: number, text: string, documentTable: SymbolTable): Hover | null {
		const symbolService = this.#symbolService;
		const typeDefinition = symbolService.getType(word) ?? documentTable.getType(word);
		if (typeDefinition !== undefined) {
			const memberLines: string[] = [];
			for (const { name, typeName } of typeDefinition.fields) memberLines.push(`  ${name} ${typeName}`);
			for (const { name, params, retType } of typeDefinition.methods) {
				if (name.startsWith("[")) continue;
				memberLines.push(`  ${name}(${params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${retType}`);
			}
			const typeParamStr = typeDefinition.typeParams.length > 0 ? `<${typeDefinition.typeParams.join(", ")}>` : String.empty;
			const header = typeDefinition.parent !== undefined ? `${typeDefinition.name}${typeParamStr} from ${typeDefinition.parent}` : `${typeDefinition.name}${typeParamStr}`;
			const body = memberLines.length > 0 ? `\n${memberLines.join("\n")}\n` : String.empty;
			return this.#md(`\`\`\`quartz\n${header} {${body}}\n\`\`\``);
		}

		const runtime = symbolService.runtimeTable();
		const allOverloads = [...(runtime.getFunctions(word) ?? []), ...(documentTable.getFunctions(word) ?? [])];
		if (allOverloads.length > 0) {
			const argCount = this.#argCountAt(text, wordEnd);
			const resolved = allOverloads[this.#pickOverloadIndex(allOverloads.map(overload => overload.params.length), argCount)];
			const prefix = resolved.ownerType !== undefined ? `${resolved.ownerType}.` : '';
			const signature = `${prefix}${resolved.name}(${resolved.params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${resolved.retType}`;
			const overloadNote = allOverloads.length > 1 ? `\n_+${allOverloads.length - 1} ${allOverloads.length - 1 === 1 ? "overload" : "overloads"}_` : String.empty;
			return this.#md(`\`\`\`quartz\n${signature}\n\`\`\`${overloadNote}`);
		}

		const variable = [...runtime.getVariablesAt(line), ...documentTable.getVariablesAt(line)].find(entry => entry.name === word);
		if (variable !== undefined) return this.#md(`\`\`\`quartz\n${variable.name} ${variable.typeName}\n\`\`\``);

		const documentation = HoverData.get(word);
		if (documentation !== undefined) return this.#md(documentation);

		return null;
	}

	#argCountAt(text: string, scanStart: number): number {
		let offset = scanStart;
		while (offset < text.length && (text[offset] === ' ' || text[offset] === '\t')) offset++;
		if (offset >= text.length || text[offset] !== '(') return -1;
		offset++;
		let depth = 0;
		let commas = 0;
		let hasContent = false;
		while (offset < text.length) {
			const char = text[offset];
			if (char === '"' || char === "'") {
				const quoteChar = char; offset++;
				while (offset < text.length && text[offset] !== quoteChar) { if (text[offset] === '\\') offset++; offset++; }
				hasContent = true;
			} else if (char === '(' || char === '[') { depth++; hasContent = true; }
			else if (char === ')' || char === ']') { if (depth === 0) break; depth--; hasContent = true; }
			else if (char === ',' && depth === 0) { commas++; hasContent = true; }
			else if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r') { hasContent = true; }
			offset++;
		}
		return hasContent ? commas + 1 : 0;
	}

	#pickOverloadIndex(paramCounts: number[], argCount: number): number {
		if (argCount < 0) return 0;
		for (let index = 0; index < paramCounts.length; index++) {
			if (paramCounts[index] === argCount) return index;
		}
		for (let index = 0; index < paramCounts.length; index++) {
			if (paramCounts[index] > argCount) return index;
		}
		return paramCounts.length - 1;
	}

	#md(value: string): Hover {
		return { contents: { kind: MarkupKind.Markdown, value } };
	}

	#wordAt(text: string, offset: number): RegExpExecArray | null {
		const pattern = HoverService.#patternWord;
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(text)) !== null) {
			if (match.index <= offset && offset <= match.index + match[0].length) return match;
		}
		return null;
	}
}
//#endregion
