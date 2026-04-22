"use strict";

import { Hover, MarkupKind, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./symbol-table.js";
import { HoverData } from "../models/hover-data.js";

//#region WordMatch
class WordMatch {
	word: string;
	start: number;

	constructor(word: string, start: number) {
		this.word = word;
		this.start = start;
	}
}
//#endregion

//#region HoverService
export class HoverService {
	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getHover(document: TextDocument, position: Position): Hover | null {
		const text = document.getText();
		const offset = document.offsetAt(position);
		const found = this.#wordAtWithStart(text, offset);
		if (!found) return null;

		const { word, start } = found;
		const docTable = this.#symbolService.parse(text);

		if (start > 0 && text[start - 1] === ".") {
			const receiverType = this.#symbolService.exprType(text, start - 1, position.line, docTable);
			if (!receiverType) return null;
			return this.#makeHoverForMember(word, receiverType);
		}

		return this.#makeHover(word, position.line, docTable);
	}

	#makeHoverForMember(memberName: string, typeName: string): Hover | null {
		const { base, typeArgs } = SymbolService.toGeneric(typeName);
		const typeDef = this.#symbolService.getClass(base);
		if (!typeDef) return null;

		const substitution = SymbolService.toSubstitution(typeDef.typeParams, typeArgs);
		const { methods, fields } = this.#symbolService.getAllMembers(base);

		const matching = methods.filter(entry => entry.name === memberName && !entry.name.startsWith("["));
		if (matching.length > 0) {
			const signatures = matching.map(method => `${memberName}(${method.params.map(parameter => `${parameter.name} ${SymbolService.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${SymbolService.mapWith(method.retType, substitution)}`).join("\n");
			return this.#md(`\`\`\`quartz\n${signatures}\n\`\`\``);
		}

		const field = fields.find(entry => entry.name === memberName);
		if (field) return this.#md(`\`\`\`quartz\n${memberName} ${SymbolService.mapWith(field.typeName, substitution)}\n\`\`\``);

		return null;
	}

	#makeHover(word: string, line: number, docTable: SymbolTable): Hover | null {
		const typeDef = this.#symbolService.getClass(word) ?? docTable.classes.get(word);
		if (typeDef) {
			const memberLines: string[] = [];
			for (const field of typeDef.fields) memberLines.push(`  ${field.name} ${field.typeName}`);
			for (const method of typeDef.methods) {
				if (method.name.startsWith("[")) continue;
				memberLines.push(`  ${method.name}(${method.params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${method.retType}`);
			}
			const typeParamStr = typeDef.typeParams.length > 0 ? `<${typeDef.typeParams.join(", ")}>` : "";
			const header = typeDef.parent ? `${typeDef.name}${typeParamStr} from ${typeDef.parent}` : `${typeDef.name}${typeParamStr}`;
			const body = memberLines.length > 0 ? `\n${memberLines.join("\n")}\n` : "";
			return this.#md(`\`\`\`quartz\n${header} {${body}}\n\`\`\``);
		}

		const allOverloads = [...(this.#symbolService.libFuncs().get(word) ?? []), ...(docTable.funcs.get(word) ?? [])];
		if (allOverloads.length > 0) {
			const signatures = allOverloads.map(overload => `${overload.name}(${overload.params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${overload.retType}`).join("\n");
			return this.#md(`\`\`\`quartz\n${signatures}\n\`\`\``);
		}

		const variable = [...this.#symbolService.libVarsAt(line), ...docTable.getVarsAt(line)].find(entry => entry.name === word);
		if (variable) return this.#md(`\`\`\`quartz\n${variable.name} ${variable.typeName}\n\`\`\``);

		const documentation = HoverData.get(word);
		if (documentation) return this.#md(documentation);

		return null;
	}

	#md(value: string): Hover {
		return { contents: { kind: MarkupKind.Markdown, value } };
	}

	#wordAtWithStart(text: string, offset: number): WordMatch | null {
		const ident = /[A-Za-z_]\w*/g;
		let match: RegExpExecArray | null;
		while ((match = ident.exec(text)) !== null) {
			if (match.index <= offset && offset <= match.index + match[0].length) return new WordMatch(match[0], match.index);
		}
		return null;
	}
}
//#endregion
