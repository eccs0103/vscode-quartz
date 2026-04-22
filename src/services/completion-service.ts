"use strict";

import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./symbol-table.js";
import { KEYWORDS } from "../models/language-keywords.js";

//#region CompletionService
export class CompletionService {
	#symService: SymbolService;

	constructor(symService: SymbolService) {
		this.#symService = symService;
	}

	getCompletions(document: TextDocument, position: Position, triggerChar?: string): CompletionItem[] {
		const text = document.getText();
		const offset = this.#lineColumnToOffset(text, position.line, position.character);
		const before = text.slice(0, offset);

		const docTable = this.#symService.parse(text);

		const dotMatch = /\.([A-Za-z_]\w*)?$/.exec(before);
		if (dotMatch) {
			const dotIndex = before.length - dotMatch[0].length;
			const receiverType = this.#symService.exprType(before, dotIndex, position.line, docTable);
			if (receiverType) return this.#getMembersOf(receiverType);
			return [];
		}

		return this.#getContextItems(position, docTable);
	}

	#getMembersOf(rawType: string): CompletionItem[] {
		const { base, args } = SymbolService.toGeneric(rawType);
		const rootType = this.#symService.runtimeTable.classes.get(base);
		if (!rootType) return [];

		const subst = SymbolService.toSubst(rootType.typeParams, args);
		const { methods, fields } = this.#symService.getAllMembers(base);

		const items: CompletionItem[] = [];

		const methodOverloads = new Map<string, typeof methods>();
		for (const method of methods) {
			if (method.name.startsWith("[")) continue;
			const overloads = methodOverloads.get(method.name) ?? [];
			overloads.push(method);
			methodOverloads.set(method.name, overloads);
		}

		for (const [name, overloads] of methodOverloads) {
			const first = overloads[0];
			const detail = `(${first.params.map(parameter => `${parameter.name} ${SymbolService.mapWith(parameter.typeName, subst)}`).join(", ")}) ${SymbolService.mapWith(first.retType, subst)}`;
			const documentation = overloads.map(overload => `${name}(${overload.params.map(parameter => `${parameter.name} ${SymbolService.mapWith(parameter.typeName, subst)}`).join(", ")}) ${SymbolService.mapWith(overload.retType, subst)}`).join("\n");
			items.push({ label: name, kind: CompletionItemKind.Method, detail, documentation });
		}

		const fieldSeen = new Set<string>();
		for (const field of fields) {
			if (fieldSeen.has(field.name)) continue;
			fieldSeen.add(field.name);
			items.push({ label: field.name, kind: CompletionItemKind.Field, detail: SymbolService.mapWith(field.typeName, subst), documentation: `Field of ${base}` });
		}

		return items;
	}

	#getContextItems(position: Position, docTable: SymbolTable): CompletionItem[] {
		const items: CompletionItem[] = [];
		const added = new Set<string>();

		const add = (label: string, kind: CompletionItemKind, detail: string, documentation?: string) => {
			if (added.has(label)) return;
			added.add(label);
			items.push({ label, kind, detail, documentation });
		};

		for (const keyword of KEYWORDS) add(keyword, CompletionItemKind.Keyword, "keyword");

		for (const name of this.#symService.runtimeTable.classes.keys()) {
			if (name === "workspace") continue;
			add(name, CompletionItemKind.Class, `class ${name}`);
		}

		for (const [name, overloads] of this.#symService.runtimeTable.funcs) {
			const signatures = overloads.map(overload => `${name}(${overload.params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${overload.retType}`);
			add(name, CompletionItemKind.Function, signatures[0], signatures.join("\n"));
		}

		for (const [name, overloads] of docTable.funcs) {
			const signatures = overloads.map(overload => `${name}(${overload.params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${overload.retType}`);
			add(name, CompletionItemKind.Function, signatures[0], signatures.join("\n"));
		}

		for (const variable of this.#symService.runtimeTable.getVarsAt(position.line)) add(variable.name, CompletionItemKind.Variable, variable.typeName);
		for (const variable of docTable.getVarsAt(position.line)) add(variable.name, CompletionItemKind.Variable, variable.typeName);

		return items;
	}

	#lineColumnToOffset(text: string, line: number, column: number): number {
		let currentLine = 0;
		let offset = 0;
		while (offset < text.length && currentLine < line) {
			if (text[offset] === "\n") currentLine++;
			offset++;
		}
		return offset + column;
	}
}
//#endregion
