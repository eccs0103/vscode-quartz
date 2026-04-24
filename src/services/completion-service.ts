"use strict";

import "adaptive-extender/node";
import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolService } from "./symbol-service.js";
import { SymbolTable } from "./symbol-table.js";
import { TypeResolver } from "./type-resolver.js";
import { LanguageKeywords } from "../models/language-keywords.js";

//#region Completion service
export class CompletionService {
	static #patternMemberAccess: RegExp = /\.([A-Za-z_]\w*)?$/;

	#symbolService: SymbolService;

	constructor(symbolService: SymbolService) {
		this.#symbolService = symbolService;
	}

	getCompletions(document: TextDocument, position: Position): CompletionItem[] {
		const symbolService = this.#symbolService;
		const text = document.getText();
		const offset = document.offsetAt(position);
		const before = text.slice(0, offset);

		const documentTable = symbolService.parse(text);

		const dotMatch = CompletionService.#patternMemberAccess.exec(before);
		if (dotMatch !== null) {
			const dotIndex = before.length - dotMatch[0].length;
			const receiverType = symbolService.typeAt(before, dotIndex, position.line, documentTable);
			if (receiverType !== null) return this.#getMembersOf(receiverType);
			return [];
		}

		return this.#getContextItems(position, documentTable);
	}

	#getMembersOf(rawType: string): CompletionItem[] {
		const symbolService = this.#symbolService;
		const { base, typeArgs } = TypeResolver.toGeneric(rawType);
		const rootType = symbolService.getType(base);
		if (rootType === undefined) return [];

		const substitution = TypeResolver.toSubstitution(rootType.typeParams, typeArgs);
		const { methods, fields } = symbolService.getAllMembers(base);

		const items: CompletionItem[] = [];

		const methodOverloads = new Map<string, typeof methods>();
		for (const method of methods) {
			if (method.name.startsWith("[")) continue;
			methodOverloads.add(method.name, []);
			methodOverloads.get(method.name)?.push(method);
		}

		for (const [label, overloads] of methodOverloads) {
			const first = overloads[0];
			const detail = `(${first.params.map(parameter => `${parameter.name} ${TypeResolver.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${TypeResolver.mapWith(first.retType, substitution)}`;
			const documentation = overloads.map(overload => `${label}(${overload.params.map(parameter => `${parameter.name} ${TypeResolver.mapWith(parameter.typeName, substitution)}`).join(", ")}) ${TypeResolver.mapWith(overload.retType, substitution)}`).join("\n");
			items.push({ label, kind: CompletionItemKind.Method, detail, documentation });
		}

		for (const { name: label, typeName } of fields) items.push({ label, kind: CompletionItemKind.Field, detail: TypeResolver.mapWith(typeName, substitution), documentation: `Field of ${base}` });

		return items;
	}

	#getContextItems(position: Position, documentTable: SymbolTable): CompletionItem[] {
		const symbolService = this.#symbolService;
		const runtime = symbolService.runtimeTable();
		const items: CompletionItem[] = [];
		const added = new Set<string>();

		for (const keyword of LanguageKeywords.values()) this.#addItem(items, added, keyword, CompletionItemKind.Keyword, "keyword");

		for (const name of runtime.typeNames()) {
			if (name === "workspace") continue;
			this.#addItem(items, added, name, CompletionItemKind.Class, `class ${name}`);
		}

		this.#addFunctionItems(items, added, runtime);
		this.#addFunctionItems(items, added, documentTable);

		for (const { name, typeName } of runtime.getVariablesAt(position.line)) this.#addItem(items, added, name, CompletionItemKind.Variable, typeName);
		for (const { name, typeName } of documentTable.getVariablesAt(position.line)) this.#addItem(items, added, name, CompletionItemKind.Variable, typeName);

		return items;
	}

	#addFunctionItems(items: CompletionItem[], added: Set<string>, table: SymbolTable): void {
		for (const [name, overloads] of table.functionEntries()) {
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
