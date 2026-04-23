"use strict";

import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { FunctionDefinition } from "../models/symbol-defs.js";
import { SymbolTable } from "./symbol-table.js";
import { LanguageKeywords } from "../models/language-keywords.js";

//#region Completion service
export class CompletionService {
	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getCompletions(document: TextDocument, position: Position): CompletionItem[] {
		const symbolService = this.#symbolService;
		const text = document.getText();
		const offset = document.offsetAt(position);
		const before = text.slice(0, offset);

		const docTable = symbolService.parse(text);

		const dotMatch = /\.([A-Za-z_]\w*)?$/.exec(before);
		if (dotMatch !== null) {
			const dotIndex = before.length - dotMatch[0].length;
			const receiverType = symbolService.typeAt(before, dotIndex, position.line, docTable);
			if (receiverType !== null) return this.#getMembersOf(receiverType);
			return [];
		}

		return this.#getContextItems(position, docTable);
	}

	#getMembersOf(rawType: string): CompletionItem[] {
		const symbolService = this.#symbolService;
		const { base, typeArgs } = SymbolService.toGeneric(rawType);
		const rootType = symbolService.getType(base);
		if (rootType === undefined) return [];

		const substitution = SymbolService.toSubstitution(rootType.typeParams, typeArgs);
		const { methods, fields } = symbolService.getAllMembers(base);

		const items: CompletionItem[] = [];

		const methodOverloads = new Map<string, typeof methods>();
		for (const method of methods) {
			if (method.name.startsWith("[")) continue;
			const overloads = methodOverloads.get(method.name) ?? [];
			overloads.push(method);
			methodOverloads.set(method.name, overloads);
		}

		for (const [label, overloads] of methodOverloads) {
			const first = overloads[0];
			const detail = `(${first.params.map(parameter => `${parameter.name} ${SymbolService.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${SymbolService.mapWith(first.retType, substitution)}`;
			const documentation = overloads.map(overload => `${label}(${overload.params.map(parameter => `${parameter.name} ${SymbolService.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${SymbolService.mapWith(overload.retType, substitution)}`).join("\n");
			items.push({ label, kind: CompletionItemKind.Method, detail, documentation });
		}

		for (const { name: label, typeName } of fields) items.push({ label, kind: CompletionItemKind.Field, detail: SymbolService.mapWith(typeName, substitution), documentation: `Field of ${base}` });

		return items;
	}

	#getContextItems(position: Position, docTable: SymbolTable): CompletionItem[] {
		const symbolService = this.#symbolService;
		const runtime = symbolService.runtimeTable();
		const items: CompletionItem[] = [];
		const added = new Set<string>();

		for (const keyword of LanguageKeywords.values()) this.#addItem(items, added, keyword, CompletionItemKind.Keyword, "keyword");

		for (const name of runtime.classes.keys()) {
			if (name === "workspace") continue;
			this.#addItem(items, added, name, CompletionItemKind.Class, `class ${name}`);
		}

		this.#addFuncItems(items, added, runtime.functions);
		this.#addFuncItems(items, added, docTable.functions);

		for (const { name, typeName } of runtime.getVariablesAt(position.line)) this.#addItem(items, added, name, CompletionItemKind.Variable, typeName);
		for (const { name, typeName } of docTable.getVariablesAt(position.line)) this.#addItem(items, added, name, CompletionItemKind.Variable, typeName);

		return items;
	}

	#addFuncItems(items: CompletionItem[], added: Set<string>, funcs: Map<string, FunctionDefinition[]>): void {
		for (const [name, overloads] of funcs) {
			const signatures = overloads.map(overload => `${name}(${overload.params.map(parameter => `${parameter.name} ${parameter.typeName}`).join(", ")}) ${overload.retType}`);
			this.#addItem(items, added, name, CompletionItemKind.Function, signatures[0], signatures.join("\n"));
		}
	}

	#addItem(items: CompletionItem[], added: Set<string>, label: string, kind: CompletionItemKind, detail: string, documentation?: string): void {
		if (added.has(label)) return;
		added.add(label);
		items.push({ label, kind, detail, documentation });
	}
}
//#endregion
