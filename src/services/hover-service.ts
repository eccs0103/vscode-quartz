"use strict";

import { Hover, MarkupKind, Position } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./symbol-table.js";
import { HoverData } from "../models/hover-data.js";

//#region Word match
class WordMatch {
	word: string;
	start: number;

	constructor(word: string, start: number) {
		this.word = word;
		this.start = start;
	}
}
//#endregion

//#region Hover service
export class HoverService {
	static #wordPattern: RegExp = /[A-Za-z_]\w*/g;

	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getHover(document: TextDocument, position: Position): Hover | null {
		const symbolService = this.#symbolService;
		const text = document.getText();
		const offset = document.offsetAt(position);
		const found = this.#wordAt(text, offset);
		if (found === null) return null;

		const { word, start } = found;
		const documentTable = symbolService.parse(text);

		if (start > 0 && text[start - 1] === ".") {
			const receiverType = symbolService.typeAt(text, start - 1, position.line, documentTable);
			if (receiverType === null) return null;
			return this.#makeHoverForMember(word, receiverType);
		}

		return this.#makeHover(word, position.line, documentTable);
	}

	#makeHoverForMember(memberName: string, typeName: string): Hover | null {
		const symbolService = this.#symbolService;
		const { base, typeArgs } = SymbolService.toGeneric(typeName);
		const typeDefinition = symbolService.getType(base);
		if (typeDefinition === undefined) return null;

		const substitution = SymbolService.toSubstitution(typeDefinition.typeParams, typeArgs);
		const { methods, fields } = symbolService.getAllMembers(base);

		const matching = methods.filter(entry => entry.name === memberName && !entry.name.startsWith("["));
		if (matching.length > 0) {
			const signatures = matching.map(method => `${memberName}(${method.params.map(parameter => `${parameter.name} ${SymbolService.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${SymbolService.mapWith(method.retType, substitution)}`).join("\n");
			return this.#md(`\`\`\`quartz\n${signatures}\n\`\`\``);
		}

		const field = fields.find(entry => entry.name === memberName);
		if (field === undefined) return null;
		return this.#md(`\`\`\`quartz\n${memberName} ${SymbolService.mapWith(field.typeName, substitution)}\n\`\`\``);
	}

	#makeHover(word: string, line: number, documentTable: SymbolTable): Hover | null {
		const symbolService = this.#symbolService;
		const typeDefinition = symbolService.getType(word) ?? documentTable.getType(word);
		if (typeDefinition !== undefined) {
			const memberLines: string[] = [];
			for (const { name, typeName } of typeDefinition.fields) memberLines.push(`  ${name} ${typeName}`);
			for (const { name, params, retType } of typeDefinition.methods) {
				if (name.startsWith("[")) continue;
				memberLines.push(`  ${name}(${params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${retType}`);
			}
			const typeParamStr = typeDefinition.typeParams.length > 0 ? `<${typeDefinition.typeParams.join(", ")}>` : "";
			const header = typeDefinition.parent !== undefined ? `${typeDefinition.name}${typeParamStr} from ${typeDefinition.parent}` : `${typeDefinition.name}${typeParamStr}`;
			const body = memberLines.length > 0 ? `\n${memberLines.join("\n")}\n` : "";
			return this.#md(`\`\`\`quartz\n${header} {${body}}\n\`\`\``);
		}

		const runtime = symbolService.runtimeTable();
		const allOverloads = [...(runtime.getFunctions(word) ?? []), ...(documentTable.getFunctions(word) ?? [])];
		if (allOverloads.length > 0) {
			const signatures = allOverloads.map(overload => `${overload.name}(${overload.params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${overload.retType}`).join("\n");
			return this.#md(`\`\`\`quartz\n${signatures}\n\`\`\``);
		}

		const variable = [...runtime.getVariablesAt(line), ...documentTable.getVariablesAt(line)].find(entry => entry.name === word);
		if (variable !== undefined) return this.#md(`\`\`\`quartz\n${variable.name} ${variable.typeName}\n\`\`\``);

		const documentation = HoverData.get(word);
		if (documentation !== undefined) return this.#md(documentation);

		return null;
	}

	#md(value: string): Hover {
		return { contents: { kind: MarkupKind.Markdown, value } };
	}

	#wordAt(text: string, offset: number): WordMatch | null {
		const pattern = HoverService.#wordPattern;
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(text)) !== null) {
			if (match.index <= offset && offset <= match.index + match[0].length) return new WordMatch(match[0], match.index);
		}
		return null;
	}
}
//#endregion
